/* Front-end negotiation simulator implementing the specified algorithm */

export type NegotiationOutcome =
  | "deal"
  | "walkaway"
  | "no_deal"
  | "no_deal_batna_violation"
  | "no_deal_impossible_range";

export interface NegotiationParameters {
  starting_price: number;
  buyer_batna: number;
  seller_batna: number;
  estimated_buyer_batna: number;
  estimated_seller_batna: number;
  max_counter_offers?: number; // default 4
  random_seed?: number | null;
  // Negotiation styles (optional). Defaults: buyer "diplomat", seller "moderate"
  buyer_profile?: BuyerProfile;
  seller_profile?: SellerProfile;
}

export interface BidRecord {
  round: number;
  agent: "buyer" | "seller";
  bid: number;
  calculation_range: { lower: number; upper: number };
  batna_constraint_check: { valid: boolean; reason: string };
  timestamp: string;
  verbiage?: string; // Seller negotiation language (V1 generator)
}

export interface PostNegotiationAnalysis {
  batna_revealed: boolean;
  seller_value_capture: number;
  buyer_value_capture: number;
  total_value_created: number;
  deal_feasible: boolean;
}

export interface NegotiationMeta {
  negotiation_id: string;
  timestamp: string;
  starting_price: number;
  buyer_batna: number;
  seller_batna: number;
  estimated_buyer_batna: number;
  estimated_seller_batna: number;
  buyer_profile?: string;
  seller_profile?: string;
  outcome: NegotiationOutcome;
  final_price: number | null;
  total_rounds: number;
  post_negotiation_analysis: PostNegotiationAnalysis;
  random_seed?: number | null;
  termination_reason?: string | null;
}

export interface ValueAnalysisReport {
  batna_revelation: {
    actual_buyer_batna: number;
    actual_seller_batna: number;
    buyer_estimation_accuracy: number;
    seller_estimation_accuracy: number;
  };
  value_capture: {
    final_deal_price: number | null;
    seller_surplus: number;
    buyer_surplus: number;
    total_surplus: number;
    surplus_split_ratio: string | null;
  };
}

export interface SessionFiles {
  folder: string; // negotiations/YYYY-MM-DD_HH-MM-SS_[id]
  files: {
    "negotiation_meta.json": string;
    "bid_transcript.json": string;
    "value_analysis.json": string;
  };
}

export type BuyerProfile = "bulldozer" | "diplomat" | "chameleon";
export type SellerProfile = "bulldozer" | "diplomat" | "chameleon";

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Helper function to check if negotiation is within ZOPA
function isWithinZOPA(buyerBatna: number, sellerBatna: number): boolean {
  return buyerBatna >= sellerBatna;
}

// Helper function to get personality adjustment factors
function getPersonalityAdjustment(profile: BuyerProfile | SellerProfile): { x?: number; y?: number } {
  switch (profile) {
    case "bulldozer": return { x: 0.1, y: 0.1 };
    case "diplomat": return { x: 0.02, y: 0.02 };
    case "chameleon": return { x: 0.05, y: 0.05 };
    default: return { x: 0.02, y: 0.02 };
  }
}

// Helper function to get personality bid selection ranges
function getPersonalityRange(profile: BuyerProfile | SellerProfile, agent: "buyer" | "seller"): { min: number; max: number } {
  if (agent === "buyer") {
    switch (profile) {
      case "bulldozer": return { min: 0.0, max: 0.2 };
      case "diplomat": return { min: 0.4, max: 0.6 };
      case "chameleon": return { min: 0.0, max: 1.0 };
      default: return { min: 0.4, max: 0.6 };
    }
  } else { // seller
    switch (profile) {
      case "bulldozer": return { min: 0.8, max: 1.0 };
      case "diplomat": return { min: 0.4, max: 0.6 };
      case "chameleon": return { min: 0.0, max: 1.0 };
      default: return { min: 0.4, max: 0.6 };
    }
  }
}

function isoNow(): string {
  return new Date().toISOString();
}

function uniform(rand: () => number, a: number, b: number): number {
  if (a > b) throw new Error("Lower bound greater than upper bound");
  return a + (b - a) * rand();
}

// Quantize to nearest 0.5 (values are in thousands)
function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

// V1 Verbiage Generator for Seller Negotiation Language
const VERBIAGE_SENTENCES = {
  // Soft Sentences (1-50): When V1 = FALSE
  soft: [
    "I really like this; is there any small way to make it even better?",
    "We're close — could we add something minor to smooth it out?",
    "This looks solid; maybe a small touch could make it more appealing.",
    "I'm nearly there with you — could we find a little sweetener?",
    "Everything lines up well; just wondering if there's a light improvement possible.",
    "You've built a fair proposal; maybe a slight adjustment would seal it.",
    "This is strong; a small addition would really make it stand out.",
    "I like what's here — can we polish it a little?",
    "The offer works; a tiny improvement would help me decide quicker.",
    "I see value here — could we add something to balance it?",
    "The structure is great; a little more would make it perfect.",
    "This proposal is almost there; a gentle enhancement would close it.",
    "I think we're aligned — can we make it a bit more inviting?",
    "I appreciate this; maybe we can enrich it slightly.",
    "You've done well — perhaps a light sweetener would finish it.",
    "I'm comfortable, but one more small step could secure it.",
    "This already feels good — could we fine-tune it further?",
    "The numbers are fair; maybe a small sweetener makes it complete.",
    "I'm inclined to agree; could you add just a little more?",
    "The deal is sound; a tiny improvement would make it excellent.",
    "You've given me a good option — could we soften it slightly?",
    "I'm positive on this; a bit more would really settle it.",
    "The framework is right; could we polish the details?",
    "This is promising — could you add a finishing touch?",
    "It's a fair balance; perhaps we can make it a little sweeter.",
    "We're close; can you refine it just a touch more?",
    "This works; maybe a small add-on makes it stronger.",
    "I'd be ready to move if there's a minor sweetener.",
    "Your proposal is solid — one tweak could finalize it.",
    "I see a path forward; let's add a little more weight.",
    "The agreement looks good; a small bonus would confirm it.",
    "We've come far — one last sweetener could close the gap.",
    "I like this direction — can we enrich it slightly more?",
    "This makes sense; a small gesture would complete it.",
    "I want to sign; give me a little more to get there.",
    "The proposal has strength; one soft addition makes it stronger.",
    "We're nearly aligned; a slight improvement would do it.",
    "I feel good about this; a sweetener makes it even better.",
    "You've done most of the work — just one more step.",
    "I'm ready if the deal gets just a little sweeter.",
    "It looks fine; a touch more makes it feel complete.",
    "The offer is fair; a sweetener would tip the scales.",
    "I think this is workable; can we smooth it just a bit?",
    "This already appeals to me — a slight bonus finalizes it.",
    "The plan is reasonable; maybe a little more support helps.",
    "I'm open to it; a finishing detail would settle things.",
    "This is a good deal; a tiny addition would make it excellent.",
    "I can agree if we sweeten it just a touch.",
    "We're almost done — let's add a small incentive.",
    "The proposal is sound; one last improvement would close it nicely."
  ],
  
  // Harsh Sentences (51-100): When V1 = TRUE
  harsh: [
    "This isn't strong enough — make it worthwhile.",
    "The deal lacks substance; add something real.",
    "I can't accept this unless it's made stronger.",
    "What you've given me isn't enough.",
    "Sweeten this or the negotiation is over.",
    "This proposal is weak; strengthen it significantly.",
    "I need much more value to consider this seriously.",
    "The terms are insufficient; improve them substantially.",
    "This doesn't meet my requirements; fix it.",
    "Without major improvements, this won't work.",
    "The offer is too low; bring something better.",
    "I won't proceed unless you add significant value.",
    "This is unacceptable in its current form.",
    "You need to do much better than this.",
    "The proposal lacks the strength I require.",
    "I'm not satisfied with what's on the table.",
    "This needs substantial enhancement to be viable.",
    "The deal is too weak to move forward.",
    "I require much more to make this worthwhile.",
    "This doesn't justify my time without improvement.",
    "The terms need significant strengthening.",
    "I won't accept anything less than substantial improvement.",
    "This proposal falls short of my expectations.",
    "You'll need to add considerable value.",
    "The offer requires major enhancement.",
    "I need to see much more substance here.",
    "This doesn't provide adequate value.",
    "The deal needs fundamental strengthening.",
    "I require substantial improvements to proceed.",
    "This is inadequate; make it much stronger.",
    "The proposal lacks sufficient incentive.",
    "I need significantly more to consider this.",
    "This doesn't offer enough value for me.",
    "The terms require major improvement.",
    "I won't move forward without substantial changes.",
    "This needs dramatic enhancement.",
    "The offer is too weak to be acceptable.",
    "I require much more substantial terms.",
    "This doesn't meet minimum requirements.",
    "The proposal needs complete restructuring.",
    "I need significantly better terms.",
    "This is far from what I require.",
    "The deal needs major strengthening.",
    "I won't consider this without substantial improvement.",
    "This lacks the value I demand.",
    "The terms are completely inadequate.",
    "I require dramatic improvements to proceed.",
    "This offer is insufficient by any measure.",
    "The proposal needs total reconstruction.",
    "I demand much better terms than this."
  ]
};

/**
 * V1 Verbiage Generator for Seller Negotiation Language
 * Generates appropriate negotiation language based on seller's bargaining position
 * 
 * Core V1 Formula Logic:
 * V1 = TRUE if (BBID - SBATNA >= 25k) OR ((BBID - SBATNA) / (SBID - BBID) >= 0.5)
 * 
 * Rules:
 * - If V1 = TRUE: Return "Harsh" language (sentences 51-100)
 * - If V1 = FALSE: Return "Soft" language (sentences 1-50)
 * 
 * @param SBATNA - Seller's Best Alternative to Negotiated Agreement (in thousands)
 * @param BBID - Buyer's current bid (in thousands) 
 * @param SBID - Seller's current bid (in thousands)
 * @param rand - Random number generator function (0-1)
 * @returns Appropriate negotiation verbiage string
 */
function generateV1Verbiage(SBATNA: number, BBID: number, SBID: number, rand: () => number): string {
  // Handle edge cases - invalid or negative values
  if (SBATNA < 0 || BBID < 0 || SBID < 0) {
    // Default to soft language for invalid inputs
    const sentences = VERBIAGE_SENTENCES.soft;
    return sentences[Math.floor(rand() * sentences.length)];
  }
  
  // V1 Formula Implementation:
  // V1 = TRUE if (BBID - SBATNA >= 25k) OR ((BBID - SBATNA) / (SBID - BBID) >= 0.5)
  const buyerExcess = BBID - SBATNA; // How much buyer's bid exceeds seller's BATNA
  const denominator = SBID - BBID;   // Difference between seller and buyer bids
  
  let v1Condition = false;
  
  // First condition: BBID - SBATNA >= 25k
  // (Buyer's bid is at least $25k above seller's BATNA)
  if (buyerExcess >= 25) {
    v1Condition = true;
  }
  
  // Second condition: (BBID - SBATNA) / (SBID - BBID) >= 0.5
  // Handle division by zero case (when SBID equals BBID)
  if (!v1Condition && denominator !== 0) {
    const ratio = buyerExcess / denominator;
    if (ratio >= 0.5) {
      v1Condition = true;
    }
  }
  
  // Select sentence category based on V1 result
  const sentences = v1Condition ? VERBIAGE_SENTENCES.harsh : VERBIAGE_SENTENCES.soft;
  
  // Randomly select from appropriate category (1-50 for soft, 51-100 for harsh)
  return sentences[Math.floor(rand() * sentences.length)];
}

// BATNA checks are not enforced in the unified simulator; kept disabled intentionally

export interface SingleRunResult {
  meta: NegotiationMeta;
  rounds: BidRecord[];
  value_report: ValueAnalysisReport;
  sessionFiles: SessionFiles;
}

export interface StepNegotiationState {
  params: NegotiationParameters;
  rounds: BidRecord[];
  current_seller_bid: number | null;
  current_buyer_bid: number | null;
  current_round_index: number;
  termination_reason: string | null;
  final_price: number | null;
  is_finished: boolean;
  rand: () => number;
  negotiation_id: string;
  rounds_without_change: number;
}

export class StepByStepNegotiation {
  private state: StepNegotiationState;
  private sellerShouldAccept: (diff: number) => boolean;
  private sellerShouldWalk: (diff: number) => boolean;
  private buyerShouldAccept: (diff: number) => boolean;
  private buyerShouldWalk: (diff: number) => boolean;

  constructor(params: NegotiationParameters) {
    const seed = params.random_seed ?? Math.floor(Math.random() * 1e9);
    const rand = mulberry32(seed);
    
    this.state = {
      params,
      rounds: [],
      current_seller_bid: null,
      current_buyer_bid: null,
      current_round_index: 1,
      termination_reason: null,
      final_price: null,
      is_finished: false,
      rand,
      negotiation_id: Math.random().toString(36).slice(2, 10),
      rounds_without_change: 0
    };

    // Set up personality-based decision functions
    const buyer_profile = params.buyer_profile ?? "diplomat";
    const seller_profile = params.seller_profile ?? "diplomat";

    this.buyerShouldAccept = (diff: number): boolean => {
      switch (buyer_profile) {
        case "bulldozer": return diff <= 5;
        case "diplomat": return diff <= 10;
        case "chameleon": return diff <= 10 && rand() < 0.5;
        default: return diff <= 10;
      }
    };

    this.buyerShouldWalk = (diff: number): boolean => {
      switch (buyer_profile) {
        case "bulldozer": return diff >= 75;
        case "diplomat": return diff >= 100;
        case "chameleon": return diff >= 100 && rand() < 0.5;
        default: return diff >= 100;
      }
    };

    this.sellerShouldAccept = (diff: number): boolean => {
      switch (seller_profile) {
        case "bulldozer": return diff <= 5;
        case "diplomat": return diff <= 10;
        case "chameleon": return diff <= 10 && rand() < 0.5;
        default: return diff <= 10;
      }
    };

    this.sellerShouldWalk = (diff: number): boolean => {
      switch (seller_profile) {
        case "bulldozer": return diff >= 75;
        case "diplomat": return diff >= 100;
        case "chameleon": return diff >= 100 && rand() < 0.5;
        default: return diff >= 100;
      }
    };

    // Initialize with seller's opening bid
    this.initializeNegotiation();
  }

  private initializeNegotiation() {
    // Seller's initial bid (starting price)
    this.state.current_seller_bid = roundToHalf(this.state.params.starting_price);
    const initialSellerCheck = { valid: true, reason: "not_enforced" };
    this.state.rounds.push({
      round: this.state.current_round_index,
      agent: "seller",
      bid: Number(this.state.current_seller_bid.toFixed(2)),
      calculation_range: { 
        lower: Number(this.state.current_seller_bid.toFixed(2)), 
        upper: Number(this.state.current_seller_bid.toFixed(2)) 
      },
      batna_constraint_check: initialSellerCheck,
      timestamp: isoNow(),
    });
  }

  public getState(): StepNegotiationState {
    return { ...this.state };
  }

  public getCurrentRounds(): BidRecord[] {
    return [...this.state.rounds];
  }

  public isFinished(): boolean {
    return this.state.is_finished;
  }

  public nextStep(): BidRecord | null {
    if (this.state.is_finished) return null;

    // Track previous bids to detect stalemate
    const prev_seller_bid = this.state.current_seller_bid;
    const prev_buyer_bid = this.state.current_buyer_bid;

    // If this is the first step after initialization, generate buyer's initial bid
    if (this.state.rounds.length === 1 && this.state.current_buyer_bid === null) {
      return this.generateBuyerInitialBid();
    }

    // Continue with alternating seller/buyer decisions
    const lastRound = this.state.rounds[this.state.rounds.length - 1];
    
    let result: BidRecord | null;
    if (lastRound.agent === "buyer") {
      result = this.processSellerDecision();
    } else {
      result = this.processBuyerDecision();
    }
    
    // Check for stalemate after processing decision
    if (!this.state.is_finished && this.state.current_seller_bid === prev_seller_bid && this.state.current_buyer_bid === prev_buyer_bid) {
      this.state.rounds_without_change++;
      if (this.state.rounds_without_change >= 10) {
        this.state.termination_reason = "no_progress_stalemate";
        this.state.is_finished = true;
        return null;
      }
    } else {
      this.state.rounds_without_change = 0;
    }
    
    return result;
  }

  private generateBuyerInitialBid(): BidRecord {
    const buyerRangeLower = Math.min(this.state.params.estimated_seller_batna, this.state.params.buyer_batna);
    const buyerRangeUpper = Math.max(this.state.params.estimated_seller_batna, this.state.params.buyer_batna);
    
    // Buyer should bid LOWER than seller's current ask (starting price)
    const sellerCurrentBid = this.state.current_seller_bid!;
    const maxBuyerBid = Math.min(buyerRangeUpper, sellerCurrentBid - 1); // At least $1 below seller's ask
    const effectiveUpper = Math.max(buyerRangeLower, maxBuyerBid);
    
    let first_buyer_bid: number;
    if (effectiveUpper <= buyerRangeLower) {
      first_buyer_bid = roundToHalf(buyerRangeLower);
    } else {
      first_buyer_bid = uniform(this.state.rand, buyerRangeLower, effectiveUpper);
    }
    first_buyer_bid = roundToHalf(first_buyer_bid);
    
    this.state.current_round_index += 1;
    this.state.current_buyer_bid = first_buyer_bid;
    
    const bidRecord: BidRecord = {
      round: this.state.current_round_index,
      agent: "buyer",
      bid: Number(first_buyer_bid.toFixed(2)),
      calculation_range: {
        lower: Number(buyerRangeLower.toFixed(2)),
        upper: Number(effectiveUpper.toFixed(2)),
      },
      batna_constraint_check: { valid: true, reason: "not_enforced" },
      timestamp: isoNow(),
    };
    
    this.state.rounds.push(bidRecord);
    return bidRecord;
  }

  private processSellerDecision(): BidRecord | null {
    const diff1 = Math.abs((this.state.current_seller_bid as number) - (this.state.current_buyer_bid as number));
    
    if (this.sellerShouldWalk(diff1)) {
      this.state.termination_reason = "seller_walkaway_bid_difference";
      this.state.is_finished = true;
      return null;
    }
    
    if (this.sellerShouldAccept(diff1) && (this.state.current_buyer_bid as number) >= this.state.params.seller_batna) {
      this.state.final_price = Number((this.state.current_buyer_bid as number).toFixed(2));
      this.state.is_finished = true;
      return null;
    }
    
    // Generate seller counter-offer
    return this.generateSellerCounterOffer();
  }

  private processBuyerDecision(): BidRecord | null {
    const diff2 = Math.abs((this.state.current_seller_bid as number) - (this.state.current_buyer_bid as number));
    
    if (this.buyerShouldWalk(diff2)) {
      this.state.termination_reason = "buyer_walkaway_bid_difference";
      this.state.is_finished = true;
      return null;
    }
    
    if (this.buyerShouldAccept(diff2) && (this.state.current_seller_bid as number) <= this.state.params.buyer_batna && (this.state.current_seller_bid as number) >= this.state.params.seller_batna) {
      this.state.final_price = Number((this.state.current_seller_bid as number).toFixed(2));
      this.state.is_finished = true;
      return null;
    }
    
    // Generate buyer counter-offer
    return this.generateBuyerCounterOffer();
  }

  private generateSellerCounterOffer(): BidRecord | null {
    const seller_profile = this.state.params.seller_profile ?? "diplomat";
    const adjustment = getPersonalityAdjustment(seller_profile);
    const personalityRange = getPersonalityRange(seller_profile, "seller");
    
    // Update estimated BATNAs before calculating bid range
    this.state.params.estimated_seller_batna = Math.min(this.state.params.estimated_seller_batna, this.state.current_seller_bid as number);
    this.state.params.estimated_buyer_batna = Math.max(this.state.params.estimated_buyer_batna, this.state.current_buyer_bid as number);
    
    // Calculate seller bid range based on ZOPA
    let sellerRangeLower: number;
    let sellerRangeUpper: number;
    
    // SBID = [max(BBID, BBID, SBATNA), min(EBBATNA*(1.02), SBID, starting_price)]
    sellerRangeLower = Math.max(this.state.current_buyer_bid as number, this.state.current_buyer_bid as number, this.state.params.seller_batna);
    sellerRangeUpper = Math.min(this.state.params.estimated_buyer_batna * 1.02, this.state.current_seller_bid as number, this.state.params.starting_price);
    
    // Ensure valid range
    if (sellerRangeUpper < sellerRangeLower) {
      console.log("Invalid seller range detected, terminating negotiation");
      this.state.termination_reason = "no_deal";
      this.state.is_finished = true;
      return null;
    }
    
    // Select bid based on personality within the calculated range
    let next_seller_bid: number;
    if (sellerRangeUpper === sellerRangeLower) {
      next_seller_bid = sellerRangeLower;
    } else {
      const rangeSize = sellerRangeUpper - sellerRangeLower;
      const personalityFactor = uniform(this.state.rand, personalityRange.min, personalityRange.max);
      next_seller_bid = sellerRangeLower + (rangeSize * personalityFactor);
    }
    
    next_seller_bid = roundToHalf(next_seller_bid);
    
    
    
    // Check if bid crosses buyer's current bid (would result in acceptance)
    if (next_seller_bid <= (this.state.current_buyer_bid as number)) {
      if ((this.state.current_buyer_bid as number) >= this.state.params.seller_batna) {
        this.state.final_price = Number((this.state.current_buyer_bid as number).toFixed(2));
        this.state.is_finished = true;
        return null;
      } else {
        this.state.termination_reason = "seller_batna_violation";
        this.state.is_finished = true;
        return null;
      }
    }
    
    this.state.current_round_index += 1;
    this.state.current_seller_bid = next_seller_bid;
    
    // Generate V1 verbiage for seller
    const verbiage = generateV1Verbiage(
      this.state.params.seller_batna,
      this.state.current_buyer_bid as number,
      next_seller_bid,
      this.state.rand
    );
    
    const bidRecord: BidRecord = {
      round: this.state.current_round_index,
      agent: "seller",
      bid: Number(next_seller_bid.toFixed(2)),
      calculation_range: { 
        lower: Number(sellerRangeLower.toFixed(2)), 
        upper: Number(sellerRangeUpper.toFixed(2)) 
      },
      batna_constraint_check: { valid: true, reason: "not_enforced" },
      timestamp: isoNow(),
      verbiage: verbiage,
    };
    
    this.state.rounds.push(bidRecord);
    return bidRecord;
  }

  private generateBuyerCounterOffer(): BidRecord | null {
    const buyer_profile = this.state.params.buyer_profile ?? "diplomat";
    const adjustment = getPersonalityAdjustment(buyer_profile);
    const personalityRange = getPersonalityRange(buyer_profile, "buyer");
    
    // Update estimated BATNAs before calculating bid range
    this.state.params.estimated_seller_batna = Math.min(this.state.params.estimated_seller_batna, this.state.current_seller_bid as number);
    this.state.params.estimated_buyer_batna = Math.max(this.state.params.estimated_buyer_batna, this.state.current_buyer_bid as number);
    
    // Calculate buyer bid range based on ZOPA
    let buyerRangeLower: number;
    let buyerRangeUpper: number;
    
    // BBID = [max(BBID, ESBATNA × (1-x)), min(BBATNA, SBID, starting_price)]
    buyerRangeLower = Math.max(this.state.current_buyer_bid as number || 0, this.state.params.estimated_seller_batna * (1 - (adjustment.x || 0.02)));
    buyerRangeUpper = Math.min(this.state.params.buyer_batna, this.state.current_seller_bid as number, this.state.params.starting_price);
    
    // Ensure valid range
    if (buyerRangeUpper < buyerRangeLower) {
      console.log("Invalid buyer range detected, terminating negotiation");
      this.state.termination_reason = "no_deal";
      this.state.is_finished = true;
      return null;
    }
    
    // Select bid based on personality within the calculated range
    let next_buyer_bid: number;
    if (buyerRangeUpper === buyerRangeLower) {
      next_buyer_bid = buyerRangeLower;
    } else {
      const rangeSize = buyerRangeUpper - buyerRangeLower;
      const personalityFactor = uniform(this.state.rand, personalityRange.min, personalityRange.max);
      next_buyer_bid = buyerRangeLower + (rangeSize * personalityFactor);
    }
    
    next_buyer_bid = roundToHalf(next_buyer_bid);
    
    // Check if bid exceeds seller's current bid (would result in acceptance)
    if (next_buyer_bid >= (this.state.current_seller_bid as number)) {
      if ((this.state.current_seller_bid as number) <= this.state.params.buyer_batna && (this.state.current_seller_bid as number) >= this.state.params.seller_batna) {
        this.state.final_price = Number((this.state.current_seller_bid as number).toFixed(2));
        this.state.is_finished = true;
        return null;
      } else {
        this.state.termination_reason = "buyer_batna_violation";
        this.state.is_finished = true;
        return null;
      }
    }
    
    
    this.state.current_round_index += 1;
    this.state.current_buyer_bid = next_buyer_bid;
    
    const bidRecord: BidRecord = {
      round: this.state.current_round_index,
      agent: "buyer",
      bid: Number(next_buyer_bid.toFixed(2)),
      calculation_range: { 
        lower: Number(buyerRangeLower.toFixed(2)), 
        upper: Number(buyerRangeUpper.toFixed(2)) 
      },
      batna_constraint_check: { valid: true, reason: "not_enforced" },
      timestamp: isoNow(),
    };
    
    this.state.rounds.push(bidRecord);
    return bidRecord;
  }

  public getFinalResult(): SingleRunResult {
    // Determine outcome
    let outcome: NegotiationOutcome;
    if (this.state.termination_reason == null && this.state.final_price != null) {
      outcome = "deal";
    } else if (
      this.state.termination_reason &&
      (this.state.termination_reason.startsWith("seller_walkaway") || this.state.termination_reason.startsWith("buyer_walkaway"))
    ) {
      outcome = "walkaway";
    } else if (
      this.state.termination_reason &&
      (this.state.termination_reason.includes("batna_violation"))
    ) {
      outcome = "no_deal_batna_violation";
    } else {
      outcome = "no_deal";
    }

    // Post-negotiation analysis
    let seller_surplus = 0;
    let buyer_surplus = 0;
    let total_surplus = 0;
    let deal_feasible_flag = false;
    if (this.state.final_price != null) {
      seller_surplus = Number((this.state.final_price - this.state.params.seller_batna).toFixed(2));
      buyer_surplus = Number((this.state.params.buyer_batna - this.state.final_price).toFixed(2));
      total_surplus = Number((seller_surplus + buyer_surplus).toFixed(2));
      deal_feasible_flag = true;
    }

    const meta: NegotiationMeta = {
      negotiation_id: this.state.negotiation_id,
      timestamp: isoNow(),
      starting_price: Number(this.state.params.starting_price.toFixed(2)),
      buyer_batna: Number(this.state.params.buyer_batna.toFixed(2)),
      seller_batna: Number(this.state.params.seller_batna.toFixed(2)),
      estimated_buyer_batna: Number(this.state.params.estimated_buyer_batna.toFixed(2)),
      estimated_seller_batna: Number(this.state.params.estimated_seller_batna.toFixed(2)),
      buyer_profile: this.state.params.buyer_profile,
      seller_profile: this.state.params.seller_profile,
      outcome,
      final_price: this.state.final_price,
      total_rounds: this.state.rounds.length ? Math.max(...this.state.rounds.map((r) => r.round)) : 0,
      post_negotiation_analysis: {
        batna_revealed: true,
        seller_value_capture: seller_surplus,
        buyer_value_capture: buyer_surplus,
        total_value_created: total_surplus,
        deal_feasible: deal_feasible_flag,
      },
      random_seed: this.state.params.random_seed ?? null,
      termination_reason: this.state.termination_reason,
    };

    const buyer_estimation_accuracy = Number((this.state.params.estimated_buyer_batna - this.state.params.buyer_batna).toFixed(2));
    const seller_estimation_accuracy = Number((this.state.params.estimated_seller_batna - this.state.params.seller_batna).toFixed(2));
    let surplus_split_ratio: string | null = null;
    if (total_surplus > 0) {
      const seller_pct = (seller_surplus / total_surplus) * 100;
      const buyer_pct = (buyer_surplus / total_surplus) * 100;
      surplus_split_ratio = `seller:${seller_pct.toFixed(1)}%, buyer:${buyer_pct.toFixed(1)}%`;
    }
    
    const value_report: ValueAnalysisReport = {
      batna_revelation: {
        actual_buyer_batna: Number(this.state.params.buyer_batna.toFixed(2)),
        actual_seller_batna: Number(this.state.params.seller_batna.toFixed(2)),
        buyer_estimation_accuracy,
        seller_estimation_accuracy,
      },
      value_capture: {
        final_deal_price: this.state.final_price,
        seller_surplus,
        buyer_surplus,
        total_surplus,
        surplus_split_ratio,
      },
    };

    const tsFolder = new Date()
      .toISOString()
      .replace(/[:]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    const sessionFolder = `negotiations/${tsFolder}_${this.state.negotiation_id}`;

    const sessionFiles: SessionFiles = {
      folder: sessionFolder,
      files: {
        "negotiation_meta.json": JSON.stringify(meta, null, 2),
        "bid_transcript.json": JSON.stringify({ rounds: this.state.rounds }, null, 2),
        "value_analysis.json": JSON.stringify(value_report, null, 2),
      },
    };

    return { meta, rounds: this.state.rounds, value_report, sessionFiles };
  }
}

export function runSingleNegotiation(params: NegotiationParameters): SingleRunResult {
  // No max rounds limit in the new unified algorithm
  const seed = params.random_seed ?? Math.floor(Math.random() * 1e9);
  const rand = mulberry32(seed);

  const negotiation_id = Math.random().toString(36).slice(2, 10);
  const tsFolder = new Date()
    .toISOString()
    .replace(/[:]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const sessionFolder = `negotiations/${tsFolder}_${negotiation_id}`;

  const rounds: BidRecord[] = [];
  let termination_reason: string | null = null;
  // No counter limit tracking
  let current_round_index = 1;

  let current_seller_bid: number | null = null;
  let current_buyer_bid: number | null = null;

  // Negotiation styles
  const buyer_profile: BuyerProfile = params.buyer_profile ?? "diplomat";
  const seller_profile: SellerProfile = params.seller_profile ?? "diplomat";

  // Helper predicates based on bid difference (values are in thousands)
  const buyerShouldAccept = (diff: number): boolean => {
    switch (buyer_profile) {
      case "bulldozer":
        return diff <= 5;
      case "diplomat":
        return diff <= 10;
      case "chameleon":
        return diff <= 10 && rand() < 0.5;
      default:
        return diff <= 10;
    }
  };
  const buyerShouldWalk = (diff: number): boolean => {
    switch (buyer_profile) {
      case "bulldozer":
        return diff >= 75;
      case "diplomat":
        return diff >= 100;
      case "chameleon":
        return diff >= 100 && rand() < 0.5;
      default:
        return diff >= 100;
    }
  };
  const sellerShouldAccept = (diff: number): boolean => {
    switch (seller_profile) {
      case "bulldozer":
        return diff <= 5;
      case "diplomat":
        return diff <= 10;
      case "chameleon":
        return diff <= 10 && rand() < 0.5;
      default:
        return diff <= 10;
    }
  };
  const sellerShouldWalk = (diff: number): boolean => {
    switch (seller_profile) {
      case "bulldozer":
        return diff >= 75;
      case "diplomat":
        return diff >= 100;
      case "chameleon":
        return diff >= 100 && rand() < 0.5;
      default:
        return diff >= 100;
    }
  };



  // Seed initial seller ask (starting price) as round 1 (no BATNA enforcement)
  current_seller_bid = roundToHalf(params.starting_price);
  const initialSellerCheck = { valid: true, reason: "not_enforced" };
  rounds.push({
    round: current_round_index,
    agent: "seller",
    bid: Number(current_seller_bid.toFixed(2)),
    calculation_range: { lower: Number(current_seller_bid.toFixed(2)), upper: Number(current_seller_bid.toFixed(2)) },
    batna_constraint_check: initialSellerCheck,
    timestamp: isoNow(),
  });

  // Initial Buyer Bid per requested rule:
  // Uniform between Seller EBATNA and Buyer BATNA, but buyer must bid LOWER than seller's ask
  const buyerRangeLower = Math.min(params.estimated_seller_batna, params.buyer_batna);
  const buyerRangeUpper = Math.max(params.estimated_seller_batna, params.buyer_batna);
  
  // Buyer should bid LOWER than seller's current ask (starting price)
  const maxBuyerBid = Math.min(buyerRangeUpper, current_seller_bid - 1); // At least $1 below seller's ask
  const effectiveBuyerUpper = Math.max(buyerRangeLower, maxBuyerBid);
  
  let first_buyer_bid: number;
  if (effectiveBuyerUpper <= buyerRangeLower) {
    // No valid interval: use the single value
    first_buyer_bid = roundToHalf(buyerRangeLower);
  } else {
    first_buyer_bid = uniform(rand, buyerRangeLower, effectiveBuyerUpper);
  }
  first_buyer_bid = roundToHalf(first_buyer_bid);
  current_round_index += 1;
  const firstCheck = { valid: true, reason: "not_enforced" };
  rounds.push({
    round: current_round_index,
    agent: "buyer",
    bid: Number(first_buyer_bid.toFixed(2)),
    calculation_range: {
      lower: Number(buyerRangeLower.toFixed(2)),
      upper: Number(effectiveBuyerUpper.toFixed(2)),
    },
    batna_constraint_check: firstCheck,
    timestamp: isoNow(),
  });
  current_buyer_bid = first_buyer_bid;

  // Alternating decision loop: seller reacts to buyer, then buyer reacts to seller
  let final_price: number | null = null;
  let rounds_without_change = 0;
  const MAX_STALE_ROUNDS = 10; // Prevent infinite loops when bids don't change
  const MAX_TOTAL_ROUNDS = 100; // Absolute maximum to prevent any infinite loops
  let total_rounds = 0;
  
  while (termination_reason == null && final_price == null && total_rounds < MAX_TOTAL_ROUNDS) {
    total_rounds++;
    if (total_rounds % 10 === 0) {
      console.log(`Negotiation round ${total_rounds}, seller: ${current_seller_bid}, buyer: ${current_buyer_bid}`);
    }
    const prev_seller_bid: number | null = current_seller_bid;
    const prev_buyer_bid: number | null = current_buyer_bid;
    
    // SELLER decision on current buyer bid
    const diff1 = Math.abs((current_seller_bid as number) - (current_buyer_bid as number));
    if (sellerShouldWalk(diff1)) {
      termination_reason = "seller_walkaway_bid_difference";
      break;
    }
    if (sellerShouldAccept(diff1) && (current_buyer_bid as number) >= params.seller_batna) {
      // Seller accepts buyer's current bid (bid difference acceptable AND satisfies seller's BATNA)
      final_price = Number((current_buyer_bid as number).toFixed(2));
      break;
    }
    // Counter by seller using ZOPA-based approach
    const sellerAdjustment = getPersonalityAdjustment(seller_profile);
    const sellerPersonalityRange = getPersonalityRange(seller_profile, "seller");
    
    // Update estimated BATNAs before calculating bid range
    params.estimated_seller_batna = Math.min(params.estimated_seller_batna, current_seller_bid as number);
    params.estimated_buyer_batna = Math.max(params.estimated_buyer_batna, current_buyer_bid as number);
    
    // Calculate seller bid range based on ZOPA
    let sellerRangeLower: number;
    let sellerRangeUpper: number;
    
    // SBID = [max(BBID, BBID, SBATNA), min(EBBATNA*(1.02), SBID, starting_price)]
    sellerRangeLower = Math.max(current_buyer_bid as number, current_buyer_bid as number, params.seller_batna);
    sellerRangeUpper = Math.min(params.estimated_buyer_batna * 1.02, current_seller_bid as number, params.starting_price);
    
    // Ensure valid range
    if (sellerRangeUpper < sellerRangeLower) {
      console.log("Invalid seller range in runSingleNegotiation, terminating");
      termination_reason = "no_deal";
      break;
    }
    
    // Select bid based on personality within the calculated range
    let next_seller_bid: number;
    if (sellerRangeUpper === sellerRangeLower) {
      next_seller_bid = sellerRangeLower;
    } else {
      const rangeSize = sellerRangeUpper - sellerRangeLower;
      const personalityFactor = uniform(rand, sellerPersonalityRange.min, sellerPersonalityRange.max);
      next_seller_bid = sellerRangeLower + (rangeSize * personalityFactor);
    }
    
    next_seller_bid = roundToHalf(next_seller_bid);
    
    // If crossed the buyer bid, treat as acceptance at buyer price (only if satisfies seller's BATNA)
    if (next_seller_bid <= (current_buyer_bid as number)) {
      if ((current_buyer_bid as number) >= params.seller_batna) {
        final_price = Number((current_buyer_bid as number).toFixed(2));
        break;
      } else {
        // Seller cannot accept because it violates their BATNA
        termination_reason = "seller_batna_violation";
        break;
      }
    }
    
    // Use the calculated range for display
    let sellerCalcLower = sellerRangeLower;
    let sellerCalcUpper = sellerRangeUpper;
    const sellerCheck = { valid: true, reason: "not_enforced" };
    
    // Generate V1 verbiage for seller
    const verbiage = generateV1Verbiage(
      params.seller_batna,
      current_buyer_bid as number,
      next_seller_bid,
      rand
    );
    
    current_round_index += 1;
    rounds.push({
      round: current_round_index,
      agent: "seller",
      bid: Number(next_seller_bid.toFixed(2)),
      calculation_range: { lower: Number(sellerCalcLower.toFixed(2)), upper: Number(sellerCalcUpper.toFixed(2)) },
      batna_constraint_check: sellerCheck,
      timestamp: isoNow(),
      verbiage: verbiage,
    });
    current_seller_bid = next_seller_bid;
    
    // continue until accept or walk

    // BUYER decision on current seller bid
    const diff2 = Math.abs((current_seller_bid as number) - (current_buyer_bid as number));
    if (buyerShouldWalk(diff2)) {
      termination_reason = "buyer_walkaway_bid_difference";
      break;
    }
    if (buyerShouldAccept(diff2) && (current_seller_bid as number) <= params.buyer_batna && (current_seller_bid as number) >= params.seller_batna) {
      // Buyer accepts seller's current bid (bid difference acceptable AND satisfies both BATNAs)
      final_price = Number((current_seller_bid as number).toFixed(2));
      break;
    }
    // Counter by buyer using ZOPA-based approach
    const buyerAdjustment = getPersonalityAdjustment(buyer_profile);
    const buyerPersonalityRange = getPersonalityRange(buyer_profile, "buyer");
    
    // Update estimated BATNAs before calculating bid range
    params.estimated_seller_batna = Math.min(params.estimated_seller_batna, current_seller_bid as number);
    params.estimated_buyer_batna = Math.max(params.estimated_buyer_batna, current_buyer_bid as number);
    
    // Calculate buyer bid range based on ZOPA
    let buyerRangeLower: number;
    let buyerRangeUpper: number;
    
    // BBID = [max(BBID, ESBATNA × (1-x)), min(BBATNA, SBID, starting_price)]
    buyerRangeLower = Math.max(current_buyer_bid as number || 0, params.estimated_seller_batna * (1 - (buyerAdjustment.x || 0.02)));
    buyerRangeUpper = Math.min(params.buyer_batna, current_seller_bid as number, params.starting_price);
    
    // Ensure valid range
    if (buyerRangeUpper < buyerRangeLower) {
      console.log("Invalid buyer range in runSingleNegotiation, terminating");
      termination_reason = "no_deal";
      break;
    }
    
    // Select bid based on personality within the calculated range
    let next_buyer_bid: number;
    if (buyerRangeUpper === buyerRangeLower) {
      next_buyer_bid = buyerRangeLower;
    } else {
      const rangeSize = buyerRangeUpper - buyerRangeLower;
      const personalityFactor = uniform(rand, buyerPersonalityRange.min, buyerPersonalityRange.max);
      next_buyer_bid = buyerRangeLower + (rangeSize * personalityFactor);
    }
    
    next_buyer_bid = roundToHalf(next_buyer_bid);
    
    // Cap at seller's current bid (only if satisfies both BATNAs)
    if (next_buyer_bid >= (current_seller_bid as number)) {
      if ((current_seller_bid as number) <= params.buyer_batna && (current_seller_bid as number) >= params.seller_batna) {
        final_price = Number((current_seller_bid as number).toFixed(2));
        break;
      } else {
        // Buyer cannot accept because it violates BATNA constraints
        termination_reason = "buyer_batna_violation";
        break;
      }
    }
    
    // Use the calculated range for display
    let buyerCalcLower = buyerRangeLower;
    let buyerCalcUpper = buyerRangeUpper;
    const buyerCheck2 = { valid: true, reason: "not_enforced" };
    current_round_index += 1;
    rounds.push({
      round: current_round_index,
      agent: "buyer",
      bid: Number(next_buyer_bid.toFixed(2)),
      calculation_range: { lower: Number(buyerCalcLower.toFixed(2)), upper: Number(buyerCalcUpper.toFixed(2)) },
      batna_constraint_check: buyerCheck2,
      timestamp: isoNow(),
    });
    current_buyer_bid = next_buyer_bid;
    
    // Check if bids haven't changed (prevent infinite loops)
    if (current_seller_bid === prev_seller_bid && current_buyer_bid === prev_buyer_bid) {
      rounds_without_change++;
      if (rounds_without_change >= MAX_STALE_ROUNDS) {
        termination_reason = "no_progress_stalemate";
        break;
      }
    } else {
      rounds_without_change = 0; // Reset counter if bids changed
    }
    // continue until accept or walk
  }

  // Check if we hit the absolute maximum rounds limit
  if (total_rounds >= MAX_TOTAL_ROUNDS && termination_reason == null && final_price == null) {
    termination_reason = "max_rounds_exceeded";
    console.log(`Negotiation terminated after ${MAX_TOTAL_ROUNDS} rounds`);
  }

  // Determine outcome
  // If no final price and no termination reason set, it means we ran zero iterations

  let outcome: NegotiationOutcome;
  if (termination_reason == null && final_price != null) {
    outcome = "deal";
  } else if (
    termination_reason &&
    (termination_reason.startsWith("seller_walkaway") || termination_reason.startsWith("buyer_walkaway"))
  ) {
    outcome = "walkaway";
  } else if (
    termination_reason &&
    (termination_reason.includes("batna_violation"))
  ) {
    outcome = "no_deal_batna_violation";
  } else {
    outcome = "no_deal";
  }

  // Post-negotiation analysis
  let seller_surplus = 0;
  let buyer_surplus = 0;
  let total_surplus = 0;
  let deal_feasible_flag = false;
  if (final_price != null) {
    seller_surplus = Number((final_price - params.seller_batna).toFixed(2));
    buyer_surplus = Number((params.buyer_batna - final_price).toFixed(2));
    total_surplus = Number((seller_surplus + buyer_surplus).toFixed(2));
    deal_feasible_flag = true;
  }

  const meta: NegotiationMeta = {
    negotiation_id,
    timestamp: isoNow(),
    starting_price: Number(params.starting_price.toFixed(2)),
    buyer_batna: Number(params.buyer_batna.toFixed(2)),
    seller_batna: Number(params.seller_batna.toFixed(2)),
    estimated_buyer_batna: Number(params.estimated_buyer_batna.toFixed(2)),
    estimated_seller_batna: Number(params.estimated_seller_batna.toFixed(2)),
    buyer_profile: params.buyer_profile,
    seller_profile: params.seller_profile,
    outcome,
    final_price,
    total_rounds: rounds.length ? Math.max(...rounds.map((r) => r.round)) : 0,
    post_negotiation_analysis: {
      batna_revealed: true,
      seller_value_capture: seller_surplus,
      buyer_value_capture: buyer_surplus,
      total_value_created: total_surplus,
      deal_feasible: deal_feasible_flag,
    },
    random_seed: params.random_seed ?? null,
    termination_reason,
  };

  const buyer_estimation_accuracy = Number((params.estimated_buyer_batna - params.buyer_batna).toFixed(2));
  const seller_estimation_accuracy = Number((params.estimated_seller_batna - params.seller_batna).toFixed(2));
  let surplus_split_ratio: string | null = null;
  if (total_surplus > 0) {
    const seller_pct = (seller_surplus / total_surplus) * 100;
    const buyer_pct = (buyer_surplus / total_surplus) * 100;
    surplus_split_ratio = `seller:${seller_pct.toFixed(1)}%, buyer:${buyer_pct.toFixed(1)}%`;
  }
  const value_report: ValueAnalysisReport = {
    batna_revelation: {
      actual_buyer_batna: Number(params.buyer_batna.toFixed(2)),
      actual_seller_batna: Number(params.seller_batna.toFixed(2)),
      buyer_estimation_accuracy,
      seller_estimation_accuracy,
    },
    value_capture: {
      final_deal_price: final_price,
      seller_surplus,
      buyer_surplus,
      total_surplus,
      surplus_split_ratio,
    },
  };

  const sessionFiles: SessionFiles = {
    folder: sessionFolder,
    files: {
      "negotiation_meta.json": JSON.stringify(meta, null, 2),
      "bid_transcript.json": JSON.stringify({ rounds }, null, 2),
      "value_analysis.json": JSON.stringify(value_report, null, 2),
    },
  };

  return { meta, rounds, value_report, sessionFiles };
}

export interface MultipleRunStats {
  num_sessions: number;
  deal_success_rate: number;
  average_value_capture: { seller: number; buyer: number };
  batna_estimation_accuracy: { buyer_mean_error: number; seller_mean_error: number };
  common_walkaway_scenarios: Record<string, number>;
}

export interface MultipleRunResult {
  stats: MultipleRunStats;
  csv: string;
  sessions: SessionFiles[];
}

export function runMultipleSimulations(count: number): MultipleRunResult {
  // Create horizontal CSV with one row per negotiation and all bids as columns
  const rows: string[] = [];
  
  let deals = 0;
  let totalSeller = 0;
  let totalBuyer = 0;
  const buyerErrors: number[] = [];
  const sellerErrors: number[] = [];
  const reasons: Record<string, number> = {};
  const sessions: SessionFiles[] = [];
  
  // First pass to determine maximum number of rounds for header
  let maxRounds = 0;
  const allResults: any[] = [];

  for (let i = 0; i < count; i++) {
    if (i % 100 === 0) {
      console.log(`Running simulation ${i + 1} of ${count}`);
    }
    // Starting price constrained to 250k - 1000k (values are in thousands)
    const sp = roundToHalf(Math.random() * (1000 - 250) + 250);
    // Seller's BATNA = SP * (1 - p), p in [0, 0.2]
    const p = uniform(Math.random, 0.0, 0.2);
    const seller_batna = sp * (1 - p);
    // Buyer's BATNA = SP * (1 + q), q in [0, 0.2]
    const q = uniform(Math.random, 0.0, 0.2);
    const buyer_batna = sp * (1 + q);
    // ESBATNA = starting price - e, where e <= 12%
    const e_seller = uniform(Math.random, 0.0, 0.12);
    const est_seller = Math.round(sp * (1 - e_seller));
    // EBBATNA = starting price + e, where -12% <= e <= 12%
    const e_buyer = uniform(Math.random, -0.12, 0.12);
    const est_buyer = Math.round(sp * (1 + e_buyer));

    // Randomly assign personality profiles
    const buyerProfiles = ["bulldozer", "diplomat", "chameleon"];
    const sellerProfiles = ["bulldozer", "diplomat", "chameleon"];
    
    const res = runSingleNegotiation({
      starting_price: Number(sp.toFixed(2)),
      buyer_batna: Number(buyer_batna.toFixed(2)),
      seller_batna: Number(seller_batna.toFixed(2)),
      estimated_buyer_batna: Number(est_buyer.toFixed(2)),
      estimated_seller_batna: Number(est_seller.toFixed(2)),
      max_counter_offers: 4,
      random_seed: null,
      buyer_profile: buyerProfiles[Math.floor(Math.random() * buyerProfiles.length)] as BuyerProfile,
      seller_profile: sellerProfiles[Math.floor(Math.random() * sellerProfiles.length)] as SellerProfile,
    });

    allResults.push(res);
    maxRounds = Math.max(maxRounds, res.rounds.length);

    sessions.push(res.sessionFiles);
    const vc = res.value_report.value_capture;
    if (res.meta.outcome === "deal" && res.meta.final_price != null) {
      deals += 1;
      totalSeller += vc.seller_surplus;
      totalBuyer += vc.buyer_surplus;
    }
    if (res.meta.termination_reason) {
      reasons[res.meta.termination_reason] = (reasons[res.meta.termination_reason] || 0) + 1;
    }
    buyerErrors.push(res.meta.estimated_buyer_batna - res.meta.buyer_batna);
    sellerErrors.push(res.meta.estimated_seller_batna - res.meta.seller_batna);
  }

  // Create dynamic header based on max rounds
  const baseHeader = [
    "negotiation_id",
    "starting_price",
    "buyer_batna",
    "seller_batna",
    "estimated_buyer_batna", 
    "estimated_seller_batna",
    "buyer_profile",
    "seller_profile",
    "outcome",
    "final_price",
    "total_rounds",
    "termination_reason",
    "seller_surplus",
    "buyer_surplus",
    "total_surplus"
  ];
  
  // Add bid columns for each round
  const bidHeaders: string[] = [];
  for (let round = 1; round <= maxRounds; round++) {
    bidHeaders.push(`round_${round}_agent`);
    bidHeaders.push(`round_${round}_bid`);
    bidHeaders.push(`round_${round}_verbiage`);
  }
  
  const header = [...baseHeader, ...bidHeaders];
  rows.push(header.join(","));

  // Second pass to create rows
  for (const res of allResults) {
    const vc = res.value_report.value_capture;
    
    const baseRow = [
      res.meta.negotiation_id,
      res.meta.starting_price.toFixed(2),
      res.meta.buyer_batna.toFixed(2),
      res.meta.seller_batna.toFixed(2),
      res.meta.estimated_buyer_batna.toFixed(2),
      res.meta.estimated_seller_batna.toFixed(2),
      res.meta.buyer_profile || "diplomat",
      res.meta.seller_profile || "diplomat",
      res.meta.outcome,
      res.meta.final_price != null ? res.meta.final_price.toFixed(2) : "",
      String(res.meta.total_rounds),
      res.meta.termination_reason ?? "",
      vc.seller_surplus.toFixed(2),
      vc.buyer_surplus.toFixed(2),
      vc.total_surplus.toFixed(2)
    ];
    
    // Add bid data for each round
    const bidData: string[] = [];
    for (let round = 1; round <= maxRounds; round++) {
      const roundData = res.rounds.find((r: BidRecord) => r.round === round);
      if (roundData) {
        bidData.push(roundData.agent);
        bidData.push(roundData.bid.toFixed(2));
        bidData.push(roundData.verbiage || "");  // Include verbiage (empty if not present)
      } else {
        bidData.push("");  // Empty agent
        bidData.push("");  // Empty bid
        bidData.push("");  // Empty verbiage
      }
    }
    
    const fullRow = [...baseRow, ...bidData];
    rows.push(fullRow.join(","));
  }

  const stats: MultipleRunStats = {
    num_sessions: count,
    deal_success_rate: deals / Math.max(1, count),
    average_value_capture: {
      seller: Number((totalSeller / Math.max(1, deals)).toFixed(2)),
      buyer: Number((totalBuyer / Math.max(1, deals)).toFixed(2)),
    },
    batna_estimation_accuracy: {
      buyer_mean_error:
        Number((buyerErrors.reduce((a, b) => a + b, 0) / Math.max(1, buyerErrors.length)).toFixed(2)),
      seller_mean_error:
        Number((sellerErrors.reduce((a, b) => a + b, 0) / Math.max(1, sellerErrors.length)).toFixed(2)),
    },
    common_walkaway_scenarios: reasons,
  };

  const csv = rows.join("\n");
  return { stats, csv, sessions };
}

export async function buildZipBlob(sessions: SessionFiles[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const s of sessions) {
    const folder = zip.folder(s.folder)!
      .file("negotiation_meta.json", s.files["negotiation_meta.json"])!
      .file("bid_transcript.json", s.files["bid_transcript.json"])!
      .file("value_analysis.json", s.files["value_analysis.json"]);
    void folder; // chain for clarity
  }
  return zip.generateAsync({ type: "blob" });
}




