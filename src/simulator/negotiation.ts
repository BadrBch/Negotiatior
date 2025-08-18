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
  // Soft Sentences (0-50): When V1 = FALSE
  soft: [
    "0: Yeah, I'm liking this - maybe just tweak it a tiny bit?",
    "1: Hey, we're super close - just add one small thing?",
    "2: This looks solid! Maybe one little touch would make it even better?",
    "3: I'm almost there - could we find a small sweetener?",
    "4: Everything's looking good! Just wondering if there's room for a tiny improvement?",
    "5: This is pretty fair - maybe just a slight tweak?",
    "6: This is actually strong - one small addition would make it shine.",
    "7: I like this - think we could polish it up a bit more?",
    "8: This works for me - a tiny improvement would help me say yes faster.",
    "9: I see value here - could we add something small?",
    "10: The structure's great - just a little more would be perfect.",
    "11: This is so close - one gentle touch would totally close it for me.",
    "12: I think we're aligned - can we make it a bit more appealing?",
    "13: I appreciate this - maybe we can enrich it slightly?",
    "14: You've done well - perhaps a light sweetener would finish it?",
    "15: I'm comfortable with this, but one more small step would secure it.",
    "16: This feels good - could we fine-tune it a bit more?",
    "17: The numbers look fair - maybe a small sweetener?",
    "18: I'm inclined to agree - could you add just a little more?",
    "19: The deal seems sound - a tiny improvement would be excellent.",
    "20: This is a good option - could we soften it up slightly?",
    "21: I'm feeling positive - a bit more would settle everything.",
    "22: The framework feels right - could we polish the details?",
    "23: This is promising - could you add one finishing touch?",
    "24: It's a fair balance - perhaps we can make it sweeter?",
    "25: We're close - can you refine it just a touch?",
    "26: This works - maybe a small add-on?",
    "27: I'd be ready to move if there's a minor sweetener.",
    "28: Your proposal's solid - one small tweak could finalize it.",
    "29: I see a clear path - let's add a little more weight.",
    "30: The agreement looks good - a small bonus would confirm it.",
    "31: We've come far - one last sweetener could close this gap.",
    "32: I like this direction - can we enrich it slightly?",
    "33: This makes sense - a small gesture would complete it.",
    "34: I want to sign - give me just a little more?",
    "35: The proposal's strong - one soft addition would help.",
    "36: We're nearly aligned - a slight improvement would do it.",
    "37: I feel good about this - a sweetener would be even better.",
    "38: You've done most of the work - just need one more step.",
    "39: I'm ready if this gets a little sweeter.",
    "40: It looks fine - a touch more would feel right.",
    "41: The offer's fair - a sweetener would tip the scales.",
    "42: This is workable - can we smooth it out a bit?",
    "43: This appeals to me - a slight bonus would finalize it.",
    "44: The plan's reasonable - maybe a little more support?",
    "45: I'm open to moving forward - a finishing detail would settle it.",
    "46: This is a good deal - a tiny addition would be excellent.",
    "47: I can agree if we sweeten it just a touch.",
    "48: We're almost done - let's add one small incentive.",
    "49: The proposal's sound - one last improvement would close it.",
    "50: I'm impressed with this - just one more small touch?"
  ],
  
  // Harsh Sentences (51-100): When V1 = TRUE
  harsh: [
    "51: Look, this just isn't strong enough - you gotta make it worth my while.",
    "52: I'll be honest, this deal's pretty weak - add something real.",
    "53: I can't accept this - it needs to be way stronger.",
    "54: What you're offering just isn't enough.",
    "55: You need to sweeten this big time or we're done.",
    "56: This feels weak to me - you'll need to beef it up considerably.",
    "57: I need to see way more value before I take this seriously.",
    "58: These terms aren't cutting it - they need major improvement.",
    "59: This doesn't meet my basic needs - you gotta fix it.",
    "60: Without major improvements, this won't work for me.",
    "61: The offer's way too low - bring me something better.",
    "62: I won't move unless you add significant value.",
    "63: This is totally unacceptable as is.",
    "64: You're gonna need to do way better than this.",
    "65: This proposal lacks what I absolutely need.",
    "66: I'm not satisfied with what's on the table.",
    "67: This needs major enhancement before it works.",
    "68: The deal's too weak for me to move forward.",
    "69: I need way more than this to make it worthwhile.",
    "70: This doesn't justify my time without serious improvement.",
    "71: The terms need serious strengthening across the board.",
    "72: I won't accept anything less than major improvement.",
    "73: This proposal falls short of what I expect.",
    "74: You'll need to add serious value to get my attention.",
    "75: The offer needs major enhancement before I'll consider it.",
    "76: I need to see way more substance in this.",
    "77: This doesn't provide nearly enough value.",
    "78: The deal needs fundamental strengthening from the ground up.",
    "79: I need major improvements before we can proceed.",
    "80: This is inadequate - you need to make it way stronger.",
    "81: The proposal lacks enough incentive for me to say yes.",
    "82: I need way more value to even consider this.",
    "83: This doesn't offer enough for someone in my position.",
    "84: The terms need major improvement before I'll agree.",
    "85: I won't move forward without substantial changes.",
    "86: This needs dramatic enhancement to get my interest.",
    "87: The offer's too weak to be acceptable.",
    "88: I need way more substantial terms than this.",
    "89: This doesn't meet even my minimum requirements.",
    "90: The proposal needs complete restructuring before I'll look at it.",
    "91: I need way better terms than what you're showing me.",
    "92: This is far from what I need to make a deal.",
    "93: The deal needs major strengthening in every area.",
    "94: I won't consider this without major improvement across the board.",
    "95: This lacks the real value I demand.",
    "96: The terms are totally inadequate for what I'm looking for.",
    "97: I need dramatic improvements before we can proceed.",
    "98: This offer's insufficient by any measure.",
    "99: The proposal needs total reconstruction before I'll engage.",
    "100: I need way better terms than what you're presenting."
  ]
};

// Buyer Verbiage Generator for Buyer Negotiation Language  
const BUYER_VERBIAGE_SENTENCES = {
  // Soft Sentences (0-50): When Buyer V1 = FALSE
  soft: [
    "0: Yeah, this looks good - maybe we could meet somewhere in the middle?",
    "1: Hey, I like where this is heading - can we find a sweet spot?",
    "2: This seems fair! Maybe we could adjust it just a bit?",
    "3: I'm pretty close to saying yes - could we tweak it slightly?",
    "4: Everything's looking reasonable! Just wondering if we can fine-tune it?",
    "5: This is a solid offer - maybe we could nudge it a little?",
    "6: I'm actually pretty interested - one small adjustment would seal it.",
    "7: I like this direction - think we could massage it a bit more?",
    "8: This works for me mostly - a tiny change would get me there.",
    "9: I see good value here - could we find a middle ground?",
    "10: The framework's good - just a small shift would be perfect.",
    "11: This is really close - one gentle adjustment would close it for me.",
    "12: I think we're on the same page - can we fine-tune the details?",
    "13: I appreciate this offer - maybe we can meet halfway?",
    "14: You've done well here - perhaps we could split the difference?",
    "15: I'm comfortable with this direction, but could we adjust slightly?",
    "16: This feels pretty good - could we dial it in a bit more?",
    "17: The numbers seem reasonable - maybe we could compromise?",
    "18: I'm leaning toward yes - could we find a middle point?",
    "19: The deal looks solid - a small adjustment would be perfect.",
    "20: This is a good starting point - could we meet in between?",
    "21: I'm feeling positive about this - maybe we could split it?",
    "22: The structure works - could we adjust the details?",
    "23: This is promising - could we find a compromise?",
    "24: It's a fair approach - perhaps we can meet halfway?",
    "25: We're close - can we find that sweet spot?",
    "26: This works mostly - maybe a small compromise?",
    "27: I'd be ready to agree if we could meet in the middle.",
    "28: Your offer's reasonable - one adjustment could finalize it.",
    "29: I see potential here - let's find that middle ground.",
    "30: The deal looks good - a small compromise would confirm it.",
    "31: We've made progress - one last adjustment could close this.",
    "32: I like this approach - can we meet somewhere in between?",
    "33: This makes sense - a small compromise would complete it.",
    "34: I'm ready to move - just need us to meet halfway.",
    "35: The offer's strong - one small adjustment would help.",
    "36: We're almost there - a slight compromise would do it.",
    "37: I feel good about this - meeting halfway would be perfect.",
    "38: You've made a fair offer - just need a small adjustment.",
    "39: I'm ready if we can find that middle point.",
    "40: It looks reasonable - a compromise would feel right.",
    "41: The offer's fair - meeting halfway would work for me.",
    "42: This is workable - can we find a middle ground?",
    "43: This appeals to me - a small compromise would finalize it.",
    "44: The approach is good - maybe we could split the difference?",
    "45: I'm open to this - finding middle ground would settle it.",
    "46: This is a solid deal - a small compromise would be excellent.",
    "47: I can work with this if we meet somewhere in the middle.",
    "48: We're almost there - let's find that compromise point.",
    "49: The offer's sound - one small adjustment would close it.",
    "50: I'm interested - just need us to find that sweet spot."
  ],
  
  // Harsh Sentences (51-100): When Buyer V1 = TRUE
  harsh: [
    "51: Look, this is way too high - you gotta come down significantly.",
    "52: I'll be honest, this price is pretty steep - bring it down.",
    "53: I can't work with this - it needs to be much lower.",
    "54: What you're asking is just too much.",
    "55: You need to drop this price big time or we're done.",
    "56: This feels too expensive - you'll need to come down considerably.",
    "57: I need to see way better pricing before I take this seriously.",
    "58: This price isn't realistic - it needs major reduction.",
    "59: This doesn't fit my budget - you gotta lower it.",
    "60: Without a major price drop, this won't work for me.",
    "61: The price is way too high - bring me something reasonable.",
    "62: I won't move unless you drop the price significantly.",
    "63: This is totally out of my range as is.",
    "64: You're gonna need to come down way more than this.",
    "65: This price is beyond what I can justify.",
    "66: I'm not comfortable with this pricing level.",
    "67: This needs major price reduction before it works.",
    "68: The price is too high for me to move forward.",
    "69: I need way better pricing to make this worthwhile.",
    "70: This doesn't fit my budget without serious price cuts.",
    "71: The pricing needs serious reduction across the board.",
    "72: I won't accept anything less than major price reduction.",
    "73: This price falls well above what I can do.",
    "74: You'll need to drop the price seriously to get my attention.",
    "75: The price needs major reduction before I'll consider it.",
    "76: I need to see way better pricing in this deal.",
    "77: This doesn't provide good value at this price point.",
    "78: The pricing needs fundamental adjustment from the ground up.",
    "79: I need major price reductions before we can proceed.",
    "80: This is overpriced - you need to make it way more affordable.",
    "81: The price lacks what I need to say yes.",
    "82: I need way better pricing to even consider this.",
    "83: This doesn't offer good value for someone in my position.",
    "84: The price needs major improvement before I'll agree.",
    "85: I won't move forward without substantial price cuts.",
    "86: This needs dramatic price reduction to get my interest.",
    "87: The price is too high to be acceptable.",
    "88: I need way better pricing than what you're proposing.",
    "89: This doesn't meet even my basic budget requirements.",
    "90: The pricing needs complete restructuring before I'll look at it.",
    "91: I need way better pricing than what you're showing me.",
    "92: This is far from the price range I need to make a deal.",
    "93: The price needs major reduction in every area.",
    "94: I won't consider this without major price cuts across the board.",
    "95: This lacks the value I need at this price point.",
    "96: The pricing is totally out of line for what I'm looking for.",
    "97: I need dramatic price reductions before we can proceed.",
    "98: This price is unreasonable by any measure.",
    "99: The pricing needs total reconstruction before I'll engage.",
    "100: I need way better pricing than what you're presenting."
  ]
};

/**
 * Buyer Verbiage Generator for Buyer Negotiation Language
 * Generates appropriate negotiation language based on buyer's bargaining position
 * 
 * Core Buyer Formula Logic:
 * Buyer V1 = TRUE if (SBID - BBATNA >= 25k) OR ((SBID - BBATNA) / (BBID - SBID) >= 0.5)
 * 
 * Rules:
 * - If Buyer V1 = TRUE: Return "Harsh" language (sentences 51-100) 
 * - If Buyer V1 = FALSE: Return "Soft" language (sentences 0-50)
 * 
 * @param BBATNA - Buyer's Best Alternative to Negotiated Agreement (in thousands)
 * @param SBID - Seller's current bid (in thousands)
 * @param BBID - Buyer's current bid (in thousands) 
 * @param rand - Random number generator function (0-1)
 * @returns Appropriate negotiation verbiage string
 */
function generateBuyerVerbiage(BBATNA: number, SBID: number, BBID: number, rand: () => number): string {
  // Handle edge cases - invalid or negative values
  if (BBATNA < 0 || SBID < 0 || BBID < 0) {
    // Default to soft language for invalid inputs
    const sentences = BUYER_VERBIAGE_SENTENCES.soft;
    return sentences[Math.floor(rand() * sentences.length)];
  }
  
  // Buyer V1 Formula Implementation:
  // Buyer V1 = TRUE if (SBID - BBATNA >= 25k) OR ((SBID - BBATNA) / (BBID - SBID) >= 0.5)
  const sellerExcess = SBID - BBATNA; // How much seller's bid exceeds buyer's BATNA
  const denominator = BBID - SBID;   // Difference between buyer and seller bids
  
  let buyerV1Condition = false;
  
  // First condition: SBID - BBATNA >= 25k
  // (Seller's bid is at least $25k above buyer's BATNA)
  if (sellerExcess >= 25) {
    buyerV1Condition = true;
  }
  
  // Second condition: (SBID - BBATNA) / (BBID - SBID) >= 0.5
  // Handle division by zero case (when BBID equals SBID)
  if (!buyerV1Condition && denominator !== 0) {
    const ratio = sellerExcess / denominator;
    if (ratio >= 0.5) {
      buyerV1Condition = true;
    }
  }
  
  // Select sentence category based on Buyer V1 result
  const sentences = buyerV1Condition ? BUYER_VERBIAGE_SENTENCES.harsh : BUYER_VERBIAGE_SENTENCES.soft;
  
  // Randomly select from appropriate category (0-50 for soft, 51-100 for harsh)
  return sentences[Math.floor(rand() * sentences.length)];
}

/**
 * V1 Verbiage Generator for Seller Negotiation Language
 * Generates appropriate negotiation language based on seller's bargaining position
 * 
 * Core V1 Formula Logic:
 * V1 = TRUE if (BBID - SBATNA >= 25k) OR ((BBID - SBATNA) / (SBID - BBID) >= 0.5)
 * 
 * Rules:
 * - If V1 = TRUE: Return "Harsh" language (sentences 51-100)
 * - If V1 = FALSE: Return "Soft" language (sentences 0-50)
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
  
  // Randomly select from appropriate category (0-50 for soft, 51-100 for harsh)
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
    
    // Generate buyer verbiage for initial bid
    const initialBuyerVerbiage = generateBuyerVerbiage(
      this.state.params.buyer_batna,
      this.state.current_seller_bid as number,
      first_buyer_bid,
      this.state.rand
    );
    
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
      verbiage: initialBuyerVerbiage,
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
    
    // Generate buyer verbiage
    const buyerVerbiage = generateBuyerVerbiage(
      this.state.params.buyer_batna,
      this.state.current_seller_bid as number,
      next_buyer_bid,
      this.state.rand
    );
    
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
      verbiage: buyerVerbiage,
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
  
  // Generate buyer verbiage for initial bid
  const initialBuyerVerbiage = generateBuyerVerbiage(
    params.buyer_batna,
    current_seller_bid,
    first_buyer_bid,
    rand
  );
  
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
    verbiage: initialBuyerVerbiage,
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
    
    // Generate buyer verbiage for counter-offer
    const buyerVerbiage = generateBuyerVerbiage(
      params.buyer_batna,
      current_seller_bid as number,
      next_buyer_bid,
      rand
    );
    
    current_round_index += 1;
    rounds.push({
      round: current_round_index,
      agent: "buyer",
      bid: Number(next_buyer_bid.toFixed(2)),
      calculation_range: { lower: Number(buyerCalcLower.toFixed(2)), upper: Number(buyerCalcUpper.toFixed(2)) },
      batna_constraint_check: buyerCheck2,
      timestamp: isoNow(),
      verbiage: buyerVerbiage,
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




