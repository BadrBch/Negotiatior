import * as tf from '@tensorflow/tfjs';

export type ModelType = 'ddpg' | 'td3' | 'sac';
export type ProfileType = 'bulldozer' | 'diplomat' | 'chameleon';

export interface NegotiationParams {
  currentRound: number;
  maxRounds: number;
  startingPrice: number;
  currentBid: number;
  currentAgent: 'buyer' | 'seller';
  buyerProfile: ProfileType;
  sellerProfile: ProfileType;
  prevBid1: number;
  prevBid2: number;
  totalRounds: number;
  lastSellerBid: number;
  lastBuyerBid: number;
  spread: number;
  sellerDrop: number;
  buyerRaise: number;
  currentV1: number;
  currentV2: number;
}

export interface BATNAEstimation {
  estBuyer: number;
  estSeller: number;
}

let loadedModels: { [key in ModelType]?: tf.LayersModel } = {};

/**
 * Load a pre-trained TensorFlow.js model for BATNA prediction
 */
export async function loadRLModel(modelType: ModelType): Promise<tf.LayersModel> {
  if (loadedModels[modelType]) {
    return loadedModels[modelType]!;
  }

  try {
    const modelPath = `/models/${modelType}/model.json`;
    console.log(`Loading ${modelType.toUpperCase()} model from ${modelPath}`);
    
    const model = await tf.loadLayersModel(modelPath);
    loadedModels[modelType] = model;
    
    console.log(`Successfully loaded ${modelType.toUpperCase()} model`);
    return model;
  } catch (error) {
    console.error(`Failed to load ${modelType.toUpperCase()} model:`, error);
    throw new Error(`Model loading failed: ${error}`);
  }
}

/**
 * Encode personality profile to numeric value matching Python training code
 */
function encodeProfile(profile: ProfileType): number {
  const mapping = {
    'bulldozer': 0,
    'diplomat': 1, 
    'chameleon': 2
  };
  return mapping[profile] || 0;
}

/**
 * Build the 17-dimensional state vector matching the Python training code
 * This matches exactly the state vector construction in lines 370-388 of batna_prediction_python_sac.py
 */
export function buildStateVector(params: NegotiationParams): Float32Array {
  const {
    currentRound,
    maxRounds,
    startingPrice,
    currentBid,
    currentAgent,
    buyerProfile,
    sellerProfile,
    prevBid1,
    prevBid2,
    totalRounds,
    lastSellerBid,
    lastBuyerBid,
    spread,
    sellerDrop,
    buyerRaise,
    currentV1,
    currentV2
  } = params;

  // Encode profiles (bulldozer=0, diplomat=1, chameleon=2)
  const buyerProfileEncoded = encodeProfile(buyerProfile);
  const sellerProfileEncoded = encodeProfile(sellerProfile);
  
  // Convert agent to numeric (buyer=0, seller=1)
  const currentAgentEncoded = currentAgent === 'buyer' ? 0 : 1;

  // Build state vector with exact normalization from Python code
  const state = new Float32Array([
    currentRound / Math.max(1, maxRounds),           // Current round normalized
    startingPrice / 1000.0,                         // Starting price
    currentBid / 1000.0,                            // Current bid
    currentAgentEncoded,                            // Current agent (0=buyer, 1=seller)
    buyerProfileEncoded / 2.0,                      // Buyer profile normalized
    sellerProfileEncoded / 2.0,                     // Seller profile normalized
    prevBid1 / 1000.0,                              // Previous bid 1
    prevBid2 / 1000.0,                              // Previous bid 2
    (currentBid - startingPrice) / 1000.0,          // Bid difference from starting price
    totalRounds / Math.max(1, maxRounds),           // Total rounds normalized
    lastSellerBid / 1000.0,                         // Last seller bid
    lastBuyerBid / 1000.0,                          // Last buyer bid
    spread / 1000.0,                                // Spread (seller - buyer)
    sellerDrop / 1000.0,                            // Positive seller drop since previous
    buyerRaise / 1000.0,                            // Positive buyer raise since previous
    currentV1 / 300.0,                              // Current round V1 verbiage score
    currentV2 / 300.0                               // Current round V2 verbiage score
  ]);

  return state;
}

/**
 * Predict BATNA values using the trained model
 * Models output normalized values [0,1] that need to be denormalized
 */
export async function predictBATNAs(
  model: tf.LayersModel, 
  stateVector: Float32Array
): Promise<BATNAEstimation> {
  try {
    // Reshape state vector for model input [batch_size=1, features=17]
    const inputTensor = tf.tensor2d([Array.from(stateVector)], [1, 17]);
    
    // Run inference
    const prediction = model.predict(inputTensor) as tf.Tensor;
    const output = await prediction.data();
    
    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();
    
    // Extract normalized predictions [buyerBATNA, sellerBATNA] both in range [0,1]
    const normalizedBuyerBATNA = output[0];
    const normalizedSellerBATNA = output[1];
    
    // Denormalize using reasonable BATNA ranges
    // These ranges should ideally match the training data percentiles (5th-95th percentile)
    // Using conservative estimates based on the current system's BATNA generation
    const buyerBATNAMin = 250;    // Conservative estimate
    const buyerBATNAMax = 1200;   // Conservative estimate
    const sellerBATNAMin = 200;   // Conservative estimate  
    const sellerBATNAMax = 1000;  // Conservative estimate
    
    const estBuyer = buyerBATNAMin + normalizedBuyerBATNA * (buyerBATNAMax - buyerBATNAMin);
    const estSeller = sellerBATNAMin + normalizedSellerBATNA * (sellerBATNAMax - sellerBATNAMin);
    
    return {
      estBuyer: Math.round(estBuyer),
      estSeller: Math.round(estSeller)
    };
  } catch (error) {
    console.error('BATNA prediction failed:', error);
    throw new Error(`Prediction failed: ${error}`);
  }
}

/**
 * Generate fallback random BATNA estimation (baseline mode)
 * This matches the original hardcoded logic from negotiation.ts lines 1793-1798
 */
export function generateBaselineBATNAs(startingPrice: number): BATNAEstimation {
  // ESBATNA = starting price - e, where e <= 12%
  const e_seller = Math.random() * 0.12; // 0 to 0.12
  const est_seller = Math.round(startingPrice * (1 - e_seller));
  
  // EBBATNA = starting price + e, where -12% <= e <= 12%
  const e_buyer = (Math.random() * 0.24) - 0.12; // -0.12 to 0.12
  const est_buyer = Math.round(startingPrice * (1 + e_buyer));
  
  return {
    estBuyer: est_buyer,
    estSeller: est_seller
  };
}

/**
 * Clean up loaded models to free memory
 */
export function disposeModels(): void {
  Object.values(loadedModels).forEach(model => {
    if (model) {
      model.dispose();
    }
  });
  loadedModels = {};
}