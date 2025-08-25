import { runMultipleSimulations, runSingleNegotiation, type MultipleRunResult, type NegotiationParameters, type BuyerProfile, type SellerProfile } from './negotiation';
import type { ModelType } from './batnaModel';

export interface ComparisonMetrics {
  modelType: string;
  dealRate: number;
  walkawayRate: number;
  closureRateInZOPA: number;
  buyerBATNAMAE: number;
  sellerBATNAMAE: number;
  averageRounds: number;
  avgBuyerStep: number;
  avgSellerStep: number;
  totalSimulations: number;
}

export interface ComparisonResult {
  metrics: ComparisonMetrics[];
  csv: string;
  timestamp: string;
}

interface FixedSimulationParams {
  starting_price: number;
  buyer_batna: number;
  seller_batna: number;
  buyer_profile: BuyerProfile;
  seller_profile: SellerProfile;
  month_to_key: number;
}

/**
 * Generate fixed simulation parameters for fair comparison
 */
function generateFixedSimulationParams(count: number): FixedSimulationParams[] {
  const params: FixedSimulationParams[] = [];
  const buyerProfiles: BuyerProfile[] = ["bulldozer", "diplomat", "chameleon"];
  const sellerProfiles: SellerProfile[] = ["bulldozer", "diplomat", "chameleon"];

  // Use a seeded random function for reproducible results
  let seed = 12345; // Fixed seed for consistent comparison
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < count; i++) {
    // Generate parameters using exact same logic as negotiation.ts
    const sp = Math.round((seededRandom() * (1000 - 250) + 250) * 2) / 2; // roundToHalf
    
    // Seller's BATNA = SP * (1 - p), p in [0, 0.2]
    const p = seededRandom() * 0.2;
    const seller_batna = sp * (1 - p);
    
    // Buyer's BATNA = SP * (1 + q), q in [0, 0.2]
    const q = seededRandom() * 0.2;
    const buyer_batna = sp * (1 + q);
    
    // Random profiles
    const buyer_profile = buyerProfiles[Math.floor(seededRandom() * buyerProfiles.length)];
    const seller_profile = sellerProfiles[Math.floor(seededRandom() * sellerProfiles.length)];
    
    // Random month to key (0-16)
    const month_to_key = Math.floor(seededRandom() * 17);

    params.push({
      starting_price: Number(sp.toFixed(2)),
      buyer_batna: Number(buyer_batna.toFixed(2)),
      seller_batna: Number(seller_batna.toFixed(2)),
      buyer_profile,
      seller_profile,
      month_to_key
    });
  }

  return params;
}

/**
 * Run comparative analysis with identical parameters for all models
 */
export async function runComparison(count: number): Promise<ComparisonResult> {
  const models: (ModelType | 'baseline')[] = ['baseline', 'ddpg', 'td3', 'sac'];
  const metrics: ComparisonMetrics[] = [];

  console.log(`Starting fair comparative analysis with ${count} identical simulations per model...`);

  // Generate fixed parameters for fair comparison
  console.log('Generating fixed simulation parameters...');
  const fixedParams = generateFixedSimulationParams(count);
  console.log(`Generated ${fixedParams.length} identical parameter sets`);

  // Run each model with the same exact parameters
  for (const modelType of models) {
    console.log(`Running ${count} simulations for ${modelType} with identical parameters...`);
    
    try {
      const results = await runModelWithFixedParams(modelType, fixedParams);
      const comparisonMetric = calculateComparisonMetricsFromResults(modelType, results);
      metrics.push(comparisonMetric);
      
      console.log(`Completed ${modelType}: Deal rate ${comparisonMetric.dealRate}%`);
    } catch (error) {
      console.error(`Failed to run simulations for ${modelType}:`, error);
      // Add placeholder metrics for failed model
      metrics.push({
        modelType,
        dealRate: 0,
        walkawayRate: 0,
        closureRateInZOPA: 0,
        buyerBATNAMAE: 0,
        sellerBATNAMAE: 0,
        averageRounds: 0,
        totalSimulations: 0
      });
    }
  }

  // Generate comparison CSV
  const csv = generateComparisonCSV(metrics);
  const timestamp = new Date().toISOString().replace(/[:]/g, '-').slice(0, 19);

  console.log('Fair comparative analysis completed');
  
  return {
    metrics,
    csv,
    timestamp
  };
}

/**
 * Run a specific model with fixed parameters
 */
async function runModelWithFixedParams(
  modelType: ModelType | 'baseline', 
  fixedParams: FixedSimulationParams[]
): Promise<any[]> {
  const results = [];
  
  // Load the model once if not baseline
  let model: any = null;
  if (modelType && modelType !== 'baseline') {
    try {
      const { loadRLModel } = await import('./batnaModel');
      model = await loadRLModel(modelType);
      console.log(`Loaded ${modelType.toUpperCase()} model`);
    } catch (error) {
      console.warn(`Failed to load ${modelType} model, using baseline:`, error);
      modelType = 'baseline';
    }
  }

  for (const params of fixedParams) {
    try {
      // Generate estimated BATNAs using the appropriate method
      let estimated_buyer_batna: number;
      let estimated_seller_batna: number;

      if (modelType === 'baseline' || !model) {
        // Use baseline estimation
        const { generateBaselineBATNAs } = await import('./batnaModel');
        const baseline = generateBaselineBATNAs(params.starting_price);
        estimated_buyer_batna = baseline.estBuyer;
        estimated_seller_batna = baseline.estSeller;
      } else {
        // Use model prediction
        const { buildStateVector, predictBATNAs } = await import('./batnaModel');
        
        const modelParams = {
          currentRound: 1,
          maxRounds: 4,
          startingPrice: params.starting_price,
          currentBid: 0,
          currentAgent: 'seller' as const,
          buyerProfile: params.buyer_profile,
          sellerProfile: params.seller_profile,
          prevBid1: 0,
          prevBid2: 0,
          totalRounds: 1,
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
        estimated_buyer_batna = prediction.estBuyer;
        estimated_seller_batna = prediction.estSeller;
      }

      // Run single negotiation with these parameters
      const negotiationParams: NegotiationParameters = {
        starting_price: params.starting_price,
        buyer_batna: params.buyer_batna,
        seller_batna: params.seller_batna,
        estimated_buyer_batna,
        estimated_seller_batna,
        max_counter_offers: 4,
        random_seed: null,
        buyer_profile: params.buyer_profile,
        seller_profile: params.seller_profile,
        month_to_key: params.month_to_key
      };

      const result = runSingleNegotiation(negotiationParams);
      results.push({
        ...result,
        // Add original true BATNAs and estimated BATNAs for analysis
        true_buyer_batna: params.buyer_batna,
        true_seller_batna: params.seller_batna,
        estimated_buyer_batna,
        estimated_seller_batna,
        model_type: modelType
      });
      
    } catch (error) {
      console.error(`Error in simulation for ${modelType}:`, error);
      // Add a failed result to maintain count
      results.push({
        meta: {
          outcome: 'no_deal' as const,
          final_price: null,
          total_rounds: 0,
          deal_feasible: false
        },
        model_type: modelType,
        true_buyer_batna: params.buyer_batna,
        true_seller_batna: params.seller_batna,
        estimated_buyer_batna: 0,
        estimated_seller_batna: 0
      });
    }
  }

  return results;
}

/**
 * Calculate comparison metrics from direct simulation results
 */
function calculateComparisonMetricsFromResults(
  modelType: string,
  results: any[]
): ComparisonMetrics {
  let dealsInsideZOPA = 0;
  let buyerBATNAErrors: number[] = [];
  let sellerBATNAErrors: number[] = [];
  let totalRounds = 0;
  let successfulDeals = 0;
  let walkawayCount = 0;
  let buyerSteps: number[] = [];
  let sellerSteps: number[] = [];

  results.forEach(result => {
    const finalPrice = result.meta?.final_price;
    const outcome = result.meta?.outcome;
    const rounds = result.meta?.total_rounds || 0;
    
    // Count different outcome types
    if (outcome === 'deal') {
      successfulDeals++;
    } else if (outcome === 'walkaway') {
      walkawayCount++;
    }
    
    // Calculate total rounds
    totalRounds += rounds;
    
    // Calculate buyer and seller steps using rounds data
    const bidRounds = result.rounds || [];
    const startingPrice = result.meta?.starting_price || 0;
    
    // Find first buyer bid and first seller counter-offer from rounds
    let firstBuyerBid = null;
    let firstSellerCounter = null;
    
    bidRounds.forEach((round: any) => {
      if (round.agent === 'buyer' && firstBuyerBid === null && round.bid) {
        firstBuyerBid = round.bid;
      } else if (round.agent === 'seller' && firstSellerCounter === null && round.bid && firstBuyerBid !== null) {
        firstSellerCounter = round.bid;
      }
    });
    
    // Calculate buyer step: difference between starting price and first buyer bid
    if (firstBuyerBid !== null && startingPrice > 0) {
      const buyerStep = Math.abs(firstBuyerBid - startingPrice);
      buyerSteps.push(buyerStep);
    }
    
    // Calculate seller step: difference between first buyer bid and first seller counter
    if (firstBuyerBid !== null && firstSellerCounter !== null) {
      const sellerStep = Math.abs(firstSellerCounter - firstBuyerBid);
      sellerSteps.push(sellerStep);
    }
    
    // BATNA estimation errors
    if (result.estimated_buyer_batna && result.true_buyer_batna) {
      buyerBATNAErrors.push(Math.abs(result.estimated_buyer_batna - result.true_buyer_batna));
    }
    if (result.estimated_seller_batna && result.true_seller_batna) {
      sellerBATNAErrors.push(Math.abs(result.estimated_seller_batna - result.true_seller_batna));
    }
    
    // Check if deal is inside ZOPA (final price between true BATNAs)
    if (outcome === 'deal' && finalPrice !== null && finalPrice !== undefined) {
      const buyerBATNA = result.true_buyer_batna;
      const sellerBATNA = result.true_seller_batna;
      
      if (finalPrice >= sellerBATNA && finalPrice <= buyerBATNA) {
        dealsInsideZOPA++;
      }
    }
  });

  const totalSimulations = results.length;
  const dealRate = totalSimulations > 0 ? (successfulDeals / totalSimulations) * 100 : 0;
  const walkawayRate = totalSimulations > 0 ? (walkawayCount / totalSimulations) * 100 : 0;
  const closureRateInZOPA = successfulDeals > 0 ? (dealsInsideZOPA / successfulDeals) * 100 : 0;
  const buyerBATNAMAE = buyerBATNAErrors.length > 0 ? buyerBATNAErrors.reduce((a, b) => a + b, 0) / buyerBATNAErrors.length : 0;
  const sellerBATNAMAE = sellerBATNAErrors.length > 0 ? sellerBATNAErrors.reduce((a, b) => a + b, 0) / sellerBATNAErrors.length : 0;
  const averageRounds = totalSimulations > 0 ? totalRounds / totalSimulations : 0;
  const avgBuyerStep = buyerSteps.length > 0 ? buyerSteps.reduce((a, b) => a + b, 0) / buyerSteps.length : 0;
  const avgSellerStep = sellerSteps.length > 0 ? sellerSteps.reduce((a, b) => a + b, 0) / sellerSteps.length : 0;

  return {
    modelType,
    dealRate: Math.round(dealRate * 100) / 100,
    walkawayRate: Math.round(walkawayRate * 100) / 100,
    closureRateInZOPA: Math.round(closureRateInZOPA * 100) / 100,
    buyerBATNAMAE: Math.round(buyerBATNAMAE * 100) / 100,
    sellerBATNAMAE: Math.round(sellerBATNAMAE * 100) / 100,
    averageRounds: Math.round(averageRounds * 100) / 100,
    avgBuyerStep: Math.round(avgBuyerStep * 100) / 100,
    avgSellerStep: Math.round(avgSellerStep * 100) / 100,
    totalSimulations
  };
}

/**
 * Calculate comparison metrics from MultipleRunResult (legacy function for backwards compatibility)
 */
function calculateComparisonMetrics(
  modelType: string,
  result: MultipleRunResult,
  expectedCount: number
): ComparisonMetrics {
  const stats = result.stats;
  
  // Parse CSV to analyze individual negotiations for detailed metrics
  const csvLines = result.csv.split('\n').filter(line => line.trim());
  const headers = csvLines[0]?.split(',') || [];
  const negotiations = csvLines.slice(1).map(line => {
    const values = line.split(',');
    const nego: any = {};
    headers.forEach((header, index) => {
      nego[header.trim()] = values[index]?.trim();
    });
    return nego;
  });

  // Calculate closure rate (deals closed "inside the ZOPA")
  let insideZOPA = 0;
  let buyerBATNAErrors: number[] = [];
  let sellerBATNAErrors: number[] = [];
  let totalRounds = 0;
  let validNegotiations = 0;

  negotiations.forEach(nego => {
    if (!nego.final_price || !nego.buyer_batna || !nego.seller_batna) return;
    
    const finalPrice = parseFloat(nego.final_price);
    const buyerBATNA = parseFloat(nego.buyer_batna);
    const sellerBATNA = parseFloat(nego.seller_batna);
    const estBuyerBATNA = parseFloat(nego.estimated_buyer_batna || '0');
    const estSellerBATNA = parseFloat(nego.estimated_seller_batna || '0');
    const rounds = parseInt(nego.total_rounds || '0');

    if (isNaN(finalPrice) || isNaN(buyerBATNA) || isNaN(sellerBATNA)) return;
    
    validNegotiations++;
    
    // Check if deal is inside ZOPA (final price between seller's BATNA and buyer's BATNA)
    if (nego.outcome === 'deal' && finalPrice >= sellerBATNA && finalPrice <= buyerBATNA) {
      insideZOPA++;
    }
    
    // Calculate BATNA estimation errors
    if (!isNaN(estBuyerBATNA)) {
      buyerBATNAErrors.push(Math.abs(estBuyerBATNA - buyerBATNA));
    }
    if (!isNaN(estSellerBATNA)) {
      sellerBATNAErrors.push(Math.abs(estSellerBATNA - sellerBATNA));
    }
    
    // Accumulate rounds
    if (!isNaN(rounds)) {
      totalRounds += rounds;
    }
  });

  const closureRate = validNegotiations > 0 ? (insideZOPA / validNegotiations) * 100 : 0;
  const buyerBATNAMAE = buyerBATNAErrors.length > 0 ? buyerBATNAErrors.reduce((a, b) => a + b, 0) / buyerBATNAErrors.length : 0;
  const sellerBATNAMAE = sellerBATNAErrors.length > 0 ? sellerBATNAErrors.reduce((a, b) => a + b, 0) / sellerBATNAErrors.length : 0;
  const averageRounds = validNegotiations > 0 ? totalRounds / validNegotiations : 0;

  return {
    modelType,
    dealRate: Math.round(stats.deal_success_rate * 10000) / 100,
    walkawayRate: 0, // Would need to parse CSV to get accurate walkaway rate
    closureRateInZOPA: Math.round(closureRate * 100) / 100,
    buyerBATNAMAE: Math.round(buyerBATNAMAE * 100) / 100,
    sellerBATNAMAE: Math.round(sellerBATNAMAE * 100) / 100,
    averageRounds: Math.round(averageRounds * 100) / 100,
    avgBuyerStep: 0, // Would need transcript parsing
    avgSellerStep: 0, // Would need transcript parsing  
    totalSimulations: expectedCount
  };
}

/**
 * Generate CSV with comparison metrics
 */
function generateComparisonCSV(metrics: ComparisonMetrics[]): string {
  const headers = [
    'Model Type',
    'Deal Rate (%)',
    'Walkaway Rate (%)',
    'Closure Rate in ZOPA (%)',
    'Buyer BATNA MAE',
    'Seller BATNA MAE',
    'Average Rounds',
    'Avg Buyer Step',
    'Avg Seller Step',
    'Total Simulations'
  ];

  const rows = metrics.map(metric => [
    metric.modelType,
    metric.dealRate.toString(),
    metric.walkawayRate.toString(),
    metric.closureRateInZOPA.toString(),
    metric.buyerBATNAMAE.toString(),
    metric.sellerBATNAMAE.toString(),
    metric.averageRounds.toString(),
    metric.avgBuyerStep.toString(),
    metric.avgSellerStep.toString(),
    metric.totalSimulations.toString()
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Trigger download of comparison results
 */
export function downloadComparisonResults(result: ComparisonResult): void {
  const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `model_comparison_${result.timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  
  URL.revokeObjectURL(url);
}