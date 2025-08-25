/* Front-end negotiation simulator implementing the specified algorithm */

import { 
  loadRLModel, 
  buildStateVector, 
  predictBATNAs, 
  generateBaselineBATNAs,
  type ModelType,
  type ProfileType,
  type NegotiationParams as ModelParams
} from './batnaModel';

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
  month_to_key?: number; // Month-to-key value for negotiation timeline
}

export interface BidRecord {
  round: number;
  agent: "buyer" | "seller";
  bid: number;
  month: number; // Month-to-key coordinate for graph plotting
  calculation_range: { lower: number; upper: number };
  batna_constraint_check: { valid: boolean; reason: string };
  timestamp: string;
  verbiage?: string; // Negotiation language (V1/V2 for seller, V1 for buyer)
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
  month_to_key: number;
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

// Helper function to calculate percentage change
function pctChange(newVal: number, oldVal: number): number {
  if (oldVal === 0) return 0; // Avoid division by zero
  return (newVal - oldVal) / oldVal;
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

// Helper function to get seller BATNA multiplier for SBID upper bound formula
function getSellerBatnaMultiplier(profile: SellerProfile): number {
  switch (profile) {
    case "bulldozer": return 0.1;
    case "diplomat": return 0.02;
    case "chameleon": return 0.05;
    default: return 0.02;
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
    "0: I appreciate the offer, but I wonder if we might revisit the terms to better align with expectations.",
    "1: Thank you for proposing this—may we discuss a possible revision for mutual benefit?",
    "2: I’m grateful for the offer and would love to explore adjustments that reflect the complexity of the role.",
    "3: Your proposal is thoughtful; could we revisit a few details to bring it closer to what’s fair?",
    "4: Thank you sincerely—I would welcome a chance to refine the offer further, if possible.",
    "5: I’m truly excited by this opportunity—might we update the terms slightly to improve alignment?",
    "6: This is a solid start; may we adjust some elements to reflect current market conditions?.",
    "7: I value your offer and kindly ask whether we can revise certain aspects to better reflect my experience.",
    "8: Your offer is generous—I’d appreciate discussing a few small adjustments before finalizing.",
    "9: This is a solid offer; may we adjust some elements to reflect current market conditions?",
    "10: I'm enthusiastic about this role and hope we can modestly enhance the offer to secure mutual satisfaction.",
  ],
  
  // Harsh Sentences (51-100): When V1 = TRUE
  harsh: [
    "51: This offer falls short and simply needs to be overhauled.",
    "52: The numbers aren’t acceptable—this offer has to change before I agree.",
    "53: Frankly, this offer doesn’t cut it and requires a serious revision.",
    "54: This proposal misses the mark entirely; we need to fix it.",
    "55: The offer is inadequate—I won’t accept it as it stands.",
    "56: Clear the air: this needs revising or it's a non-starter.",
    "57: This deal doesn’t make sense—I expect it to be reworked immediately..",
    "58: The offer is off base and needs immediate correction..",
    "59: I can’t accept this as presented—it has to be revised.",
    "60: This is unacceptable; a new version of the offer is necessary.",
   
  ]
};

// Buyer Verbiage Generator for Buyer Negotiation Language  
const BUYER_VERBIAGE_SENTENCES = {
  // Soft Sentences (0-50): When Buyer V1 = FALSE
  soft: [
    "0: I appreciate the offer, but I wonder if we might revisit the terms to better align with expectations.",
    "1: Thank you for proposing this—may we discuss a possible revision for mutual benefit?",
    "2: I’m grateful for the offer and would love to explore adjustments that reflect the complexity of the role.",
    "3: Your proposal is thoughtful; could we revisit a few details to bring it closer to what’s fair?",
    "4: Thank you sincerely—I would welcome a chance to refine the offer further, if possible.",
    "5: I’m truly excited by this opportunity—might we update the terms slightly to improve alignment?",
    "6: This is a solid start; may we adjust some elements to reflect current market conditions?.",
    "7: I value your offer and kindly ask whether we can revise certain aspects to better reflect my experience.",
    "8: Your offer is generous—I’d appreciate discussing a few small adjustments before finalizing.",
    "9: This is a solid offer; may we adjust some elements to reflect current market conditions?",
    "10: I'm enthusiastic about this role and hope we can modestly enhance the offer to secure mutual satisfaction.",
  ],
  
  // Harsh Sentences (51-100): When Buyer V1 = TRUE
  harsh: [
    "51: This offer falls short and simply needs to be overhauled.",
    "52: The numbers aren’t acceptable—this offer has to change before I agree.",
    "53: Frankly, this offer doesn’t cut it and requires a serious revision.",
    "54: This proposal misses the mark entirely; we need to fix it.",
    "55: The offer is inadequate—I won’t accept it as it stands.",
    "56: Clear the air: this needs revising or it's a non-starter.",
    "57: This deal doesn’t make sense—I expect it to be reworked immediately..",
    "58: The offer is off base and needs immediate correction..",
    "59: I can’t accept this as presented—it has to be revised.",
    "60: This is unacceptable; a new version of the offer is necessary.",
   
  ]
};

// Buyer V2 Verbiage Generator for Buyer Acceptance-Seeking Language  
const BUYER_V2_VERBIAGE_SENTENCES = {
  // Soft Sentences (101-150): When Buyer V2 = FALSE
  soft: [
    "101: I believe my offer truly reflects the mutual benefits we’re aiming for.",
    "102: I'm confident that this offer captures both value and thoughtfulness with care.",
    "103: My proposal is designed to align perfectly with shared goals—hope it feels just right.",
    "104: I genuinely feel that the offer I crafted respects your needs and expectations.",
    "105: This offer was thoughtfully structured to support both parties—hope it shows.?",
    "106: I feel good about this offer—it’s generous and considerate in the best ways.",
    "107: I hope the care and value embedded in this offer are clear and compelling.",
    "108: My offer is meant to be both fair and thoughtful—crafted with your interests in mind.",
    "109: I believe this proposal achieves a delicate balance between generosity and clarity.",
    "110: I’ve crafted this offer with warmth and fairness, hoping it proves compelling to you.",
    
  ],
  
  // Harsh Sentences (151-200): When Buyer V2 = TRUE
  harsh: [
    "151: My offer is rock-solid—it’s exactly what needs to be accepted.",
    "152: This is a powerhouse offer—take it or watch it disappear.",
    "153: This deal is nothing short of excellent—don’t let it slip away.",
    "154: That’s a killer offer—I’d be crazy not to go for it.",
    "155: My proposition is top-tier; anything less would be absurd.",
    "156: This offer hits the mark hard—there’s no improving on it.",
    "157: You’d be smart to grab this offer—it’s a rare gem.",
    "158: My terms are strong—don’t underestimate this deal.",
    "159: This is a no-brainer offer; it’s as good as it gets.",
    "160: If you pass on this, you'd be passing on a damn good deal.",
  ]
};

// V2 Verbiage Generator for Seller Acceptance-Seeking Language
const SELLER_V2_VERBIAGE_SENTENCES = {
  // Soft Sentences (100-150): When V2 = FALSE
  soft: [
    "101: I believe my offer truly reflects the mutual benefits we’re aiming for.",
    "102: I'm confident that this offer captures both value and thoughtfulness with care.",
    "103: My proposal is designed to align perfectly with shared goals—hope it feels just right.",
    "104: I genuinely feel that the offer I crafted respects your needs and expectations.",
    "105: This offer was thoughtfully structured to support both parties—hope it shows.?",
    "106: I feel good about this offer—it’s generous and considerate in the best ways.",
    "107: I hope the care and value embedded in this offer are clear and compelling.",
    "108: My offer is meant to be both fair and thoughtful—crafted with your interests in mind.",
    "109: I believe this proposal achieves a delicate balance between generosity and clarity.",
    "110: I’ve crafted this offer with warmth and fairness, hoping it proves compelling to you.",
    
  ],
  
  // Harsh Sentences (151-200): When V2 = TRUE
  harsh: [
    "151: My offer is rock-solid—it’s exactly what needs to be accepted.",
    "152: This is a powerhouse offer—take it or watch it disappear.",
    "153: This deal is nothing short of excellent—don’t let it slip away.",
    "154: That’s a killer offer—I’d be crazy not to go for it.",
    "155: My proposition is top-tier; anything less would be absurd.",
    "156: This offer hits the mark hard—there’s no improving on it.",
    "157: You’d be smart to grab this offer—it’s a rare gem.",
    "158: My terms are strong—don’t underestimate this deal.",
    "159: This is a no-brainer offer; it’s as good as it gets.",
    "160: If you pass on this, you'd be passing on a damn good deal.",
  ]
};

/**
 * V2 Verbiage Generator for Seller Acceptance-Seeking Language
 * Generates acceptance-seeking language based on seller's position relative to their BATNA
 * 
 * Core V2 Formula Logic:
 * V2 = TRUE if (SBID - SBATNA < 10k) OR ((SBID - SBATNA) / (SBID - BBID) <= 0.1)
 * 
 * Rules:
 * - If V2 = TRUE: Return "Harsh" acceptance-seeking language (sentences 151-200)
 * - If V2 = FALSE: Return "Soft" acceptance-seeking language (sentences 100-150)
 * 
 * @param SBATNA - Seller's Best Alternative to Negotiated Agreement (in thousands)
 * @param BBID - Buyer's current bid (in thousands)
 * @param SBID - Seller's current bid (in thousands)
 * @param rand - Random number generator function (0-1)
 * @returns Appropriate acceptance-seeking verbiage string
 */
function generateV2Verbiage(SBATNA: number, BBID: number, SBID: number, rand: () => number): string {
  // Special case for starting price (no buyer bid yet)
  if (BBID === 0) {
    return "100: Does this price work for you?";
  }
  
  // Handle edge cases - invalid or negative values
  if (SBATNA < 0 || BBID < 0 || SBID < 0) {
    // Default to soft language for invalid inputs
    const sentences = SELLER_V2_VERBIAGE_SENTENCES.soft;
    return sentences[Math.floor(rand() * sentences.length)];
  }
  
  // V2 Formula Implementation:
  // V2 = TRUE if (SBID - SBATNA < 10k) OR ((SBID - SBATNA) / (SBID - BBID) <= 0.1)
  const sellerMargin = SBID - SBATNA; // How much above seller's BATNA the bid is
  const denominator = SBID - BBID;   // Difference between seller and buyer bids
  
  let v2Condition = false;
  
  // First condition: SBID - SBATNA < 10k
  // (Seller's bid is less than $10k above their BATNA - tight margin)
  if (sellerMargin < 10) {
    v2Condition = true;
  }
  
  // Second condition: (SBID - SBATNA) / (SBID - BBID) <= 0.1 (10%)
  // Handle division by zero case (when SBID equals BBID)
  if (!v2Condition && denominator !== 0) {
    const ratio = sellerMargin / denominator;
    if (ratio <= 0.1) {
      v2Condition = true;
    }
  }
  
  // Select sentence category based on V2 result
  const sentences = v2Condition ? SELLER_V2_VERBIAGE_SENTENCES.harsh : SELLER_V2_VERBIAGE_SENTENCES.soft;
  
  // Randomly select from appropriate category (1-50 for soft, 51-100 for harsh)
  return sentences[Math.floor(rand() * sentences.length)];
}

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
 * Buyer V2 Verbiage Generator for Buyer Acceptance-Seeking Language
 * Generates acceptance-seeking language based on buyer's position relative to their BATNA
 * 
 * Core Buyer V2 Formula Logic:
 * Buyer V2 = TRUE if (BBID - BBATNA < 10k) OR ((BBID - SBATNA) / (BBID - SBID) <= 0.1)
 * 
 * Rules:
 * - If Buyer V2 = TRUE: Return "Harsh" acceptance-seeking language (sentences 251-300)
 * - If Buyer V2 = FALSE: Return "Soft" acceptance-seeking language (sentences 200-250)
 * 
 * @param BBATNA - Buyer's Best Alternative to Negotiated Agreement (in thousands)
 * @param SBATNA - Seller's Best Alternative to Negotiated Agreement (in thousands) 
 * @param BBID - Buyer's current bid (in thousands)
 * @param SBID - Seller's current bid (in thousands)
 * @param rand - Random number generator function (0-1)
 * @returns Appropriate acceptance-seeking verbiage string
 */
function generateBuyerV2Verbiage(BBATNA: number, SBATNA: number, BBID: number, SBID: number, rand: () => number): string {
  // Handle edge cases - invalid or negative values
  if (BBATNA < 0 || SBATNA < 0 || BBID < 0 || SBID < 0) {
    // Default to soft language for invalid inputs
    const sentences = BUYER_V2_VERBIAGE_SENTENCES.soft;
    return sentences[Math.floor(rand() * sentences.length)];
  }
  
  // Buyer V2 Formula Implementation:
  // Buyer V2 = TRUE if (BBID - BBATNA < 10k) OR ((BBID - SBATNA) / (BBID - SBID) <= 0.1)
  const buyerMargin = BBID - BBATNA; // How much above buyer's BATNA the bid is
  const denominator = BBID - SBID;   // Difference between buyer and seller bids
  
  let buyerV2Condition = false;
  
  // First condition: BBID - BBATNA < 10k
  // (Buyer's bid is less than $10k above their BATNA - tight margin)
  if (buyerMargin < 10) {
    buyerV2Condition = true;
  }
  
  // Second condition: (BBID - SBATNA) / (BBID - SBID) <= 0.1 (10%)
  // Handle division by zero case (when BBID equals SBID)
  if (!buyerV2Condition && denominator !== 0) {
    const ratio = (BBID - SBATNA) / denominator;
    if (ratio <= 0.1) {
      buyerV2Condition = true;
    }
  }
  
  // Select sentence category based on Buyer V2 result
  const sentences = buyerV2Condition ? BUYER_V2_VERBIAGE_SENTENCES.harsh : BUYER_V2_VERBIAGE_SENTENCES.soft;
  
  // Randomly select from appropriate category (200-250 for soft, 251-300 for harsh)
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
  previous_seller_bid: number | null; // Track previous seller bid for month-to-key rule
  previous_buyer_bid: number | null; // Track previous buyer bid for month-to-key rule  
  current_month: number; // Current month-to-key value (m)
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
      previous_seller_bid: null,
      previous_buyer_bid: null,
      current_month: Math.max(0, Math.min(12, params.month_to_key ?? 12)), // Initialize month-to-key from params (clamped 0-12)
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
    
    // Generate ONLY V2 verbiage for starting price (first offer)
    const v2Verbiage = generateV2Verbiage(
      this.state.params.seller_batna,
      0, // No buyer bid yet, use 0
      this.state.current_seller_bid,
      this.state.rand
    );
    
    // Use only V2 verbiage for starting price
    const verbiage = v2Verbiage;
    
    this.state.rounds.push({
      round: this.state.current_round_index,
      agent: "seller",
      bid: Number(this.state.current_seller_bid.toFixed(2)),
      month: this.state.current_month, // Use current month-to-key value
      calculation_range: { 
        lower: Number(this.state.current_seller_bid.toFixed(2)), 
        upper: Number(this.state.current_seller_bid.toFixed(2)) 
      },
      batna_constraint_check: initialSellerCheck,
      timestamp: isoNow(),
      verbiage: verbiage
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
    // FORCE the BBID formula for initial buyer bid
    const buyer_profile = this.state.params.buyer_profile ?? "diplomat";
    const adjustment = getPersonalityAdjustment(buyer_profile);
    const personalityRange = getPersonalityRange(buyer_profile, "buyer");
    
    // BBID = [max(BBID, ESBATNA × (1-x)), min(BBATNA, SBID, starting_price)]
    // For initial bid, current_buyer_bid is null, so use 0 as minimum
    const buyerRangeLower = Math.max(0, this.state.params.estimated_seller_batna * (1 - (adjustment.x || 0.02)));
    const buyerRangeUpper = Math.min(this.state.params.buyer_batna, this.state.current_seller_bid as number, this.state.params.starting_price);
    
    // Ensure valid range
    if (buyerRangeUpper < buyerRangeLower) {
      console.log("Invalid buyer range for initial bid, terminating negotiation");
      this.state.termination_reason = "no_deal";
      this.state.is_finished = true;
      return null as any;
    }
    
    let first_buyer_bid: number;
    if (buyerRangeUpper === buyerRangeLower) {
      first_buyer_bid = buyerRangeLower;
    } else {
      const rangeSize = buyerRangeUpper - buyerRangeLower;
      const personalityFactor = uniform(this.state.rand, personalityRange.min, personalityRange.max);
      first_buyer_bid = buyerRangeLower + (rangeSize * personalityFactor);
    }
    first_buyer_bid = roundToHalf(first_buyer_bid);
    
    this.state.current_round_index += 1;
    this.state.current_buyer_bid = first_buyer_bid;
    
    // Generate both V1 and V2 verbiage for buyer initial bid
    const buyerV1Verbiage = generateBuyerVerbiage(
      this.state.params.buyer_batna,
      this.state.current_seller_bid as number,
      first_buyer_bid,
      this.state.rand
    );
    
    const buyerV2Verbiage = generateBuyerV2Verbiage(
      this.state.params.buyer_batna,
      this.state.params.seller_batna,
      first_buyer_bid,
      this.state.current_seller_bid as number,
      this.state.rand
    );
    
    // Combine V1 and V2 verbiage with line break
    const initialBuyerVerbiage = buyerV1Verbiage + "\n" + buyerV2Verbiage;
    
    const bidRecord: BidRecord = {
      round: this.state.current_round_index,
      agent: "buyer",
      bid: Number(first_buyer_bid.toFixed(2)),
      month: this.state.current_month, // Use current month-to-key value
      calculation_range: {
        lower: Number(buyerRangeLower.toFixed(2)),
        upper: Number(buyerRangeUpper.toFixed(2)),
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
    const yMultiplier = getSellerBatnaMultiplier(seller_profile);
    
    // Update estimated BATNAs using bid formulas (reverse-engineered)
    // From SBID formula: if seller bid is low, their BATNA must be lower
    // From BBID formula: if buyer bid is high, their BATNA must be higher
    this.state.params.estimated_seller_batna = Math.min(this.state.params.estimated_seller_batna, this.state.current_seller_bid as number);
    this.state.params.estimated_buyer_batna = Math.max(this.state.params.estimated_buyer_batna, this.state.current_buyer_bid as number);
    
    // Calculate seller bid range based on ZOPA
    let sellerRangeLower: number;
    let sellerRangeUpper: number;
    
    // SBID = [max(BBID, BBID, SBATNA), min(EBBATNA*(1+Y), SBID, starting_price)]
    // Y = 0.1 for bulldozer, 0.02 for diplomat, 0.05 for chameleon
    sellerRangeLower = Math.max(this.state.current_buyer_bid as number, this.state.current_buyer_bid as number, this.state.params.seller_batna);
    sellerRangeUpper = Math.min(this.state.params.estimated_buyer_batna * (1 + yMultiplier), this.state.current_seller_bid as number, this.state.params.starting_price);
    
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
    
    // Update month-to-key value based on seller rule before updating current_seller_bid
    this.updateMonthToKey(next_seller_bid);
    
    // Update previous seller bid before setting new one
    this.state.previous_seller_bid = this.state.current_seller_bid;
    
    this.state.current_round_index += 1;
    this.state.current_seller_bid = next_seller_bid;
    
    // Generate both V1 and V2 verbiage for seller
    const v1Verbiage = generateV1Verbiage(
      this.state.params.seller_batna,
      this.state.current_buyer_bid as number,
      next_seller_bid,
      this.state.rand
    );
    
    const v2Verbiage = generateV2Verbiage(
      this.state.params.seller_batna,
      this.state.current_buyer_bid as number,
      next_seller_bid,
      this.state.rand
    );
    
    // Combine V1 and V2 verbiage with line break
    const verbiage = v1Verbiage + "\n" + v2Verbiage;
    
    const bidRecord: BidRecord = {
      round: this.state.current_round_index,
      agent: "seller",
      bid: Number(next_seller_bid.toFixed(2)),
      month: this.state.current_month, // Use updated month-to-key value
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
    
    // Update estimated BATNAs using bid formulas (reverse-engineered)
    // From SBID formula: if seller bid is low, their BATNA must be lower
    // From BBID formula: if buyer bid is high, their BATNA must be higher
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
    
    // Update previous buyer bid before setting new one
    this.state.previous_buyer_bid = this.state.current_buyer_bid;
    
    this.state.current_round_index += 1;
    this.state.current_buyer_bid = next_buyer_bid;
    
    // Update month-to-key based on buyer bid change
    this.updateMonthToKeyForBuyer(next_buyer_bid);
    
    // Generate both V1 and V2 verbiage for buyer
    const buyerV1Verbiage = generateBuyerVerbiage(
      this.state.params.buyer_batna,
      this.state.current_seller_bid as number,
      next_buyer_bid,
      this.state.rand
    );
    
    const buyerV2Verbiage = generateBuyerV2Verbiage(
      this.state.params.buyer_batna,
      this.state.params.seller_batna,
      next_buyer_bid,
      this.state.current_seller_bid as number,
      this.state.rand
    );
    
    // Combine V1 and V2 verbiage with line break
    const buyerVerbiage = buyerV1Verbiage + "\n" + buyerV2Verbiage;
    
    const bidRecord: BidRecord = {
      round: this.state.current_round_index,
      agent: "buyer",
      bid: Number(next_buyer_bid.toFixed(2)),
      month: this.state.current_month, // Use current month-to-key value
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
      // Updated surplus calculation: use final_price as the "last bid"
      // Buyer surplus = BBATNA - Last bid
      // Seller surplus = Last bid - SBATNA
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
      month_to_key: this.state.current_month,
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

  /**
   * Updates the month-to-key value based on seller rule
   * For first seller bid: If SBID - FirstBid < 20k, 50% chance M=M-1, else 50% chance M=M+1
   * For subsequent bids: If SBID - BBID < 25k, 50% chance M=M-1, else 50% chance M=M+1
   * M is clamped between 0 and 12
   */
  private updateMonthToKey(newSellerBid: number): void {
    let bid_gap: number;
    let threshold: number;
    
    // Check if this is the first seller bid (after starting price)
    if (this.state.current_buyer_bid === null) {
      // First seller bid: compare against starting price (FirstBid)
      bid_gap = newSellerBid - this.state.params.starting_price;
      threshold = 20; // 20k threshold for first bid
    } else {
      // Subsequent bids: compare against buyer bid
      bid_gap = newSellerBid - this.state.current_buyer_bid;
      threshold = 25; // 25k threshold for subsequent bids
    }
    
    // Apply the rule: If bid_gap < threshold, 50% chance M=M-1, else 50% chance M=M+1
    if (bid_gap < threshold) {
      if (this.state.rand() < 0.5) {
        this.state.current_month = Math.max(0, this.state.current_month - 1);
      }
    } else {
      if (this.state.rand() < 0.5) {
        this.state.current_month = Math.min(12, this.state.current_month + 1);
      }
    }
  }

  private updateMonthToKeyForBuyer(newBuyerBid: number): void {
    // Calculate bid gap: seller_bid - BBID (or starting_price if no seller bid)
    const sellerBid = this.state.current_seller_bid ?? this.state.params.starting_price;
    const bid_gap = sellerBid - newBuyerBid;
    
    // Buyer rule: If seller_bid - BBID < 20k, then m decreases by 1 with 50% probability
    // Otherwise, m increases by 1 with 50% probability
    if (bid_gap < 20) {
      if (this.state.rand() < 0.5) {
        this.state.current_month = Math.max(0, this.state.current_month - 1);
      }
    } else {
      if (this.state.rand() < 0.5) {
        this.state.current_month = Math.min(12, this.state.current_month + 1);
      }
    }
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
  
  // Month-to-key tracking variables
  let previous_seller_bid: number | null = null;
  let previous_buyer_bid: number | null = null;
  let current_month: number = Math.max(0, Math.min(12, params.month_to_key ?? 12)); // Initialize month-to-key from params
  
  // Helper function to update month-to-key value based on seller rule
  const updateMonthToKey = (next_seller_bid: number) => {
    let bid_gap: number;
    let threshold: number;
    
    // Check if this is the first seller bid (after starting price)
    if (current_buyer_bid === null) {
      // First seller bid: compare against starting price (FirstBid)
      bid_gap = next_seller_bid - params.starting_price;
      threshold = 20; // 20k threshold for first bid
    } else {
      // Subsequent bids: compare against buyer bid
      bid_gap = next_seller_bid - current_buyer_bid;
      threshold = 25; // 25k threshold for subsequent bids
    }
    
    // Apply the rule: If bid_gap < threshold, 50% chance M=M-1, else 50% chance M=M+1
    if (bid_gap < threshold) {
      if (rand() < 0.5) {
        current_month = Math.max(0, current_month - 1);
      }
    } else {
      if (rand() < 0.5) {
        current_month = Math.min(12, current_month + 1);
      }
    }
  };

  // Helper function to update month-to-key value based on buyer rule
  const updateMonthToKeyForBuyer = (next_buyer_bid: number) => {
    // Calculate bid gap: seller_bid - BBID (or starting_price if no seller bid)
    const sellerBid = current_seller_bid ?? params.starting_price;
    const bid_gap = sellerBid - next_buyer_bid;
    
    // Buyer rule: If seller_bid - BBID < 20k, then m decreases by 1 with 50% probability
    // Otherwise, m increases by 1 with 50% probability
    if (bid_gap < 20) {
      if (rand() < 0.5) {
        current_month = Math.max(0, current_month - 1);
      }
    } else {
      if (rand() < 0.5) {
        current_month = Math.min(12, current_month + 1);
      }
    }
  };

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
  previous_seller_bid = current_seller_bid; // Set initial previous bid for month tracking
  const initialSellerCheck = { valid: true, reason: "not_enforced" };
  
  // Generate ONLY V2 verbiage for starting price (first offer) - matches StepByStepNegotiation
  const initialV2Verbiage = generateV2Verbiage(
    params.seller_batna,
    0, // No buyer bid yet, use 0
    current_seller_bid,
    rand
  );
  
  // Use only V2 verbiage for starting price
  const initialVerbiage = initialV2Verbiage;
  
  rounds.push({
    round: current_round_index,
    agent: "seller",
    bid: Number(current_seller_bid.toFixed(2)),
    month: current_month, // Use current month-to-key value
    calculation_range: { lower: Number(current_seller_bid.toFixed(2)), upper: Number(current_seller_bid.toFixed(2)) },
    batna_constraint_check: initialSellerCheck,
    timestamp: isoNow(),
    verbiage: initialVerbiage
  });

  // FORCE the BBID formula for initial buyer bid
  const buyerAdjustment = getPersonalityAdjustment(buyer_profile);
  const buyerPersonalityRange = getPersonalityRange(buyer_profile, "buyer");
  
  // BBID = [max(BBID, ESBATNA × (1-x)), min(BBATNA, SBID, starting_price)]
  // For initial bid, current_buyer_bid is null, so use 0 as minimum
  const buyerRangeLower = Math.max(0, params.estimated_seller_batna * (1 - (buyerAdjustment.x || 0.02)));
  const buyerRangeUpper = Math.min(params.buyer_batna, current_seller_bid, params.starting_price);
  
  // Ensure valid range
  if (buyerRangeUpper < buyerRangeLower) {
    console.log("Invalid buyer range for initial bid in runSingleNegotiation, terminating");
    termination_reason = "no_deal";
    return {
      meta: { 
        negotiation_id: "", 
        starting_price: params.starting_price, 
        buyer_batna: params.buyer_batna, 
        seller_batna: params.seller_batna,
        estimated_buyer_batna: params.estimated_buyer_batna,
        estimated_seller_batna: params.estimated_seller_batna,
        buyer_profile: buyer_profile,
        seller_profile: seller_profile,
        outcome: "no_deal", 
        final_price: null, 
        total_rounds: 0, 
        month_to_key: 12,
        termination_reason: "no_deal",
        timestamp: isoNow(),
        post_negotiation_analysis: {
          batna_revealed: false,
          seller_value_capture: 0,
          buyer_value_capture: 0,
          total_value_created: 0,
          deal_feasible: false
        }
      },
      rounds: [],
      value_report: { 
        batna_revelation: {
          actual_buyer_batna: params.buyer_batna,
          actual_seller_batna: params.seller_batna,
          buyer_estimation_accuracy: 0,
          seller_estimation_accuracy: 0
        },
        value_capture: { final_deal_price: null, seller_surplus: 0, buyer_surplus: 0, total_surplus: 0, surplus_split_ratio: null } 
      },
      sessionFiles: { folder: "", files: { "negotiation_meta.json": "", "bid_transcript.json": "", "value_analysis.json": "" } }
    };
  }
  
  let first_buyer_bid: number;
  if (buyerRangeUpper === buyerRangeLower) {
    first_buyer_bid = buyerRangeLower;
  } else {
    const rangeSize = buyerRangeUpper - buyerRangeLower;
    const personalityFactor = uniform(rand, buyerPersonalityRange.min, buyerPersonalityRange.max);
    first_buyer_bid = buyerRangeLower + (rangeSize * personalityFactor);
  }
  first_buyer_bid = roundToHalf(first_buyer_bid);
  
  // Generate both V1 and V2 verbiage for buyer initial bid
  const buyerV1Verbiage = generateBuyerVerbiage(
    params.buyer_batna,
    current_seller_bid,
    first_buyer_bid,
    rand
  );
  
  const buyerV2Verbiage = generateBuyerV2Verbiage(
    params.buyer_batna,
    params.seller_batna,
    first_buyer_bid,
    current_seller_bid,
    rand
  );
  
  // Combine V1 and V2 verbiage with line break
  const initialBuyerVerbiage = buyerV1Verbiage + "\n" + buyerV2Verbiage;
  
  current_round_index += 1;
  const firstCheck = { valid: true, reason: "not_enforced" };
  rounds.push({
    round: current_round_index,
    agent: "buyer",
    bid: Number(first_buyer_bid.toFixed(2)),
    month: current_month, // Use current month-to-key value
    calculation_range: {
      lower: Number(buyerRangeLower.toFixed(2)),
      upper: Number(buyerRangeUpper.toFixed(2)),
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
    
    // Update estimated BATNAs using bid formulas (reverse-engineered)
    // From SBID formula: if seller bid is low, their BATNA must be lower
    // From BBID formula: if buyer bid is high, their BATNA must be higher
    params.estimated_seller_batna = Math.min(params.estimated_seller_batna, current_seller_bid as number);
    params.estimated_buyer_batna = Math.max(params.estimated_buyer_batna, current_buyer_bid as number);
    
    // Calculate seller bid range based on ZOPA
    let sellerRangeLower: number;
    let sellerRangeUpper: number;
    const yMultiplier = getSellerBatnaMultiplier(seller_profile);
    
    // SBID = [max(BBID, BBID, SBATNA), min(EBBATNA*(1+Y), SBID, starting_price)]
    // Y = 0.1 for bulldozer, 0.02 for diplomat, 0.05 for chameleon
    sellerRangeLower = Math.max(current_buyer_bid as number, current_buyer_bid as number, params.seller_batna);
    sellerRangeUpper = Math.min(params.estimated_buyer_batna * (1 + yMultiplier), current_seller_bid as number, params.starting_price);
    
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
    
    // Generate both V1 and V2 verbiage for seller
    const v1Verbiage = generateV1Verbiage(
      params.seller_batna,
      current_buyer_bid as number,
      next_seller_bid,
      rand
    );
    
    const v2Verbiage = generateV2Verbiage(
      params.seller_batna,
      current_buyer_bid as number,
      next_seller_bid,
      rand
    );
    
    // Update month-to-key value based on seller rule before recording bid
    updateMonthToKey(next_seller_bid);
    
    // Combine V1 and V2 verbiage with line break
    const verbiage = v1Verbiage + "\n" + v2Verbiage;
    
    current_round_index += 1;
    rounds.push({
      round: current_round_index,
      agent: "seller",
      bid: Number(next_seller_bid.toFixed(2)),
      month: current_month, // Use updated month-to-key value
      calculation_range: { lower: Number(sellerCalcLower.toFixed(2)), upper: Number(sellerCalcUpper.toFixed(2)) },
      batna_constraint_check: sellerCheck,
      timestamp: isoNow(),
      verbiage: verbiage,
    });
    
    // Update previous seller bid before setting new one
    previous_seller_bid = current_seller_bid;
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
    
    // Update estimated BATNAs using bid formulas (reverse-engineered)
    // From SBID formula: if seller bid is low, their BATNA must be lower
    // From BBID formula: if buyer bid is high, their BATNA must be higher
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
    
    // Generate both V1 and V2 verbiage for buyer counter-offer
    const buyerV1Verbiage = generateBuyerVerbiage(
      params.buyer_batna,
      current_seller_bid as number,
      next_buyer_bid,
      rand
    );
    
    const buyerV2Verbiage = generateBuyerV2Verbiage(
      params.buyer_batna,
      params.seller_batna,
      next_buyer_bid,
      current_seller_bid as number,
      rand
    );
    
    // Combine V1 and V2 verbiage with line break
    const buyerVerbiage = buyerV1Verbiage + "\n" + buyerV2Verbiage;
    
    current_round_index += 1;
    rounds.push({
      round: current_round_index,
      agent: "buyer",
      bid: Number(next_buyer_bid.toFixed(2)),
      month: current_month, // Use current month-to-key value
      calculation_range: { lower: Number(buyerCalcLower.toFixed(2)), upper: Number(buyerCalcUpper.toFixed(2)) },
      batna_constraint_check: buyerCheck2,
      timestamp: isoNow(),
      verbiage: buyerVerbiage,
    });
    
    // Update previous buyer bid before setting new one
    previous_buyer_bid = current_buyer_bid;
    current_buyer_bid = next_buyer_bid;
    
    // Update month-to-key based on buyer bid change
    updateMonthToKeyForBuyer(next_buyer_bid);
    
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
    // Updated surplus calculation: use final_price as the "last bid"
    // Buyer surplus = BBATNA - Last bid
    // Seller surplus = Last bid - SBATNA
    seller_surplus = Number((final_price - params.seller_batna).toFixed(2));
    buyer_surplus = Number((params.buyer_batna - final_price).toFixed(2));
    total_surplus = Number((seller_surplus + buyer_surplus).toFixed(2));
    deal_feasible_flag = true;
  }

  // Use the final current_month value for month_to_key
  const finalMonth = current_month;

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
    month_to_key: finalMonth,
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

export async function runMultipleSimulations(count: number, modelType?: ModelType): Promise<MultipleRunResult> {
  // Load model if not using baseline
  let model: any = null;
  if (modelType && modelType !== 'baseline') {
    try {
      console.log(`Loading ${modelType.toUpperCase()} model...`);
      model = await loadRLModel(modelType);
      console.log(`Successfully loaded ${modelType.toUpperCase()} model`);
    } catch (error) {
      console.warn(`Failed to load ${modelType} model, falling back to baseline:`, error);
      modelType = undefined; // Fall back to baseline
    }
  }

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

    // Randomly assign personality profiles first
    const buyerProfiles: ProfileType[] = ["bulldozer", "diplomat", "chameleon"];
    const sellerProfiles: ProfileType[] = ["bulldozer", "diplomat", "chameleon"];
    const buyerProfile = buyerProfiles[Math.floor(Math.random() * buyerProfiles.length)];
    const sellerProfile = sellerProfiles[Math.floor(Math.random() * sellerProfiles.length)];
    
    // Generate estimated BATNAs using model prediction or baseline
    let est_seller: number;
    let est_buyer: number;
    
    if (modelType && modelType !== 'baseline' && model) {
      try {
        // Build state vector for model prediction (initial state)
        const modelParams: ModelParams = {
          currentRound: 1,
          maxRounds: 4, // Max counter offers default
          startingPrice: sp,
          currentBid: 0, // No bid yet at initial state
          currentAgent: 'seller', // Seller starts
          buyerProfile,
          sellerProfile,
          prevBid1: 0,
          prevBid2: 0,
          totalRounds: 1, // Initial assumption
          lastSellerBid: 0,
          lastBuyerBid: 0,
          spread: 0,
          sellerDrop: 0,
          buyerRaise: 0,
          currentV1: 0,
          currentV2: 0
        };
        
        const stateVector = buildStateVector(modelParams);
        const prediction = await predictBATNAs(model, stateVector);
        est_seller = prediction.estSeller;
        est_buyer = prediction.estBuyer;
      } catch (error) {
        console.warn(`Model prediction failed for simulation ${i}, using baseline:`, error);
        const fallback = generateBaselineBATNAs(sp);
        est_seller = fallback.estSeller;
        est_buyer = fallback.estBuyer;
      }
    } else {
      // Baseline: use original hardcoded random estimation
      const fallback = generateBaselineBATNAs(sp);
      est_seller = fallback.estSeller;
      est_buyer = fallback.estBuyer;
    }
    
    // Randomize starting month_to_key (0-16)
    const randomMonthToKey = Math.floor(Math.random() * 17); // 0 to 16 inclusive
    
    const res = runSingleNegotiation({
      starting_price: Number(sp.toFixed(2)),
      buyer_batna: Number(buyer_batna.toFixed(2)),
      seller_batna: Number(seller_batna.toFixed(2)),
      estimated_buyer_batna: Number(est_buyer.toFixed(2)),
      estimated_seller_batna: Number(est_seller.toFixed(2)),
      max_counter_offers: 4,
      random_seed: null,
      buyer_profile: buyerProfile as BuyerProfile,
      seller_profile: sellerProfile as SellerProfile,
      month_to_key: randomMonthToKey,
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
    "month_to_key",
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
    bidHeaders.push(`round_${round}_month_to_key`);
    bidHeaders.push(`round_${round}_v1_number`);
    bidHeaders.push(`round_${round}_v2_number`);
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
      String(res.meta.month_to_key),
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
        bidData.push(String(roundData.month)); // month_to_key for this round
        
        // Extract V1 and V2 sentence numbers from verbiage
        let v1Number = "";
        let v2Number = "";
        
        if (roundData.verbiage) {
          if (roundData.agent === "seller") {
            // For sellers: V1 sentences are 0-100, V2 sentences are 100-200
            // Check if verbiage contains newline (both V1 and V2) or just V2 (round 1)
            if (roundData.verbiage.includes('\n')) {
              // Combined V1 and V2 verbiage
              const v1Match = roundData.verbiage.match(/^(\d{1,3}):/); // First number at start
              const v2Match = roundData.verbiage.match(/\n(\d{3}):/); // Second number after newline
              v1Number = v1Match ? v1Match[1] : "";
              v2Number = v2Match ? v2Match[1] : "";
            } else {
              // Only V2 verbiage (seller's initial bid)
              const v2OnlyMatch = roundData.verbiage.match(/^(\d{3}):/); // V2 number at start (100-200)
              v1Number = ""; // No V1 for initial seller bid
              v2Number = v2OnlyMatch ? v2OnlyMatch[1] : "";
            }
          } else {
            // For buyers: extract V1 and V2 numbers
            // Buyer V1 sentences are 0-100, Buyer V2 sentences are 200-300
            const v1Match = roundData.verbiage.match(/^(\d{1,3}):/); // First number at start
            const v2Match = roundData.verbiage.match(/\n(\d{3}):/); // Second number after newline
            v1Number = v1Match ? v1Match[1] : "";
            v2Number = v2Match ? v2Match[1] : "";
          }
        }
        
        bidData.push(v1Number);
        bidData.push(v2Number);
      } else {
        bidData.push("");  // Empty agent
        bidData.push("");  // Empty bid
        bidData.push("");  // Empty month_to_key
        bidData.push("");  // Empty v1_number
        bidData.push("");  // Empty v2_number
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




