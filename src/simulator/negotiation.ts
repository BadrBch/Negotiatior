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
    const prev_seller_bid = current_seller_bid;
    const prev_buyer_bid = current_buyer_bid;
    
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
    current_round_index += 1;
    rounds.push({
      round: current_round_index,
      agent: "seller",
      bid: Number(next_seller_bid.toFixed(2)),
      calculation_range: { lower: Number(sellerCalcLower.toFixed(2)), upper: Number(sellerCalcUpper.toFixed(2)) },
      batna_constraint_check: sellerCheck,
      timestamp: isoNow(),
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
      } else {
        bidData.push("");  // Empty agent
        bidData.push("");  // Empty bid
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




