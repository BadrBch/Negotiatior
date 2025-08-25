#!/usr/bin/env python3
"""
Convert H5 model weights to TensorFlow.js compatible format.
This script extracts weights from Keras H5 files and saves them as numpy arrays
that can be converted to TensorFlow.js binary format.
"""

import numpy as np
import h5py
import json
import struct
import os

def extract_h5_weights(h5_file_path):
    """Extract weights from H5 file."""
    weights = {}
    
    with h5py.File(h5_file_path, 'r') as f:
        print(f"H5 file structure for {h5_file_path}:")
        
        def print_structure(name, obj):
            print(f"  {name}: {type(obj)} - {obj.shape if hasattr(obj, 'shape') else 'group'}")
        
        f.visititems(print_structure)
        
        # Extract weights from the actual H5 structure found
        try:
            # Based on the structure, weights are in layers/dense/vars/0 (kernel) and layers/dense/vars/1 (bias)
            layers_root = f['layers']
            
            # Extract layer weights in the order: dense, dense_1, dense_2, dense_3
            layer_names = ['dense', 'dense_1', 'dense_2', 'dense_3']
            
            for layer_name in layer_names:
                if layer_name in layers_root:
                    layer_group = layers_root[layer_name]
                    
                    if 'vars' in layer_group:
                        vars_group = layer_group['vars']
                        
                        # Extract kernel (index 0)
                        if '0' in vars_group:
                            kernel = vars_group['0'][:]
                            weights[f'{layer_name}/kernel'] = kernel
                            print(f"Extracted {layer_name}/kernel: {kernel.shape}")
                        
                        # Extract bias (index 1)  
                        if '1' in vars_group:
                            bias = vars_group['1'][:]
                            weights[f'{layer_name}/bias'] = bias
                            print(f"Extracted {layer_name}/bias: {bias.shape}")
            
        except Exception as e:
            print(f"Error extracting weights: {e}")
            return None
    
    return weights

def create_tfjs_weights(weights, output_path):
    """Create TensorFlow.js compatible weight file."""
    
    # Create the binary weight file
    bin_path = os.path.join(output_path, 'group1-shard1of1.bin')
    
    with open(bin_path, 'wb') as f:
        weight_specs = []
        offset = 0
        
        # Write weights in the expected order
        weight_order = [
            'dense/kernel', 'dense/bias',
            'dense_1/kernel', 'dense_1/bias', 
            'dense_2/kernel', 'dense_2/bias',
            'dense_3/kernel', 'dense_3/bias'
        ]
        
        for weight_name in weight_order:
            if weight_name in weights:
                weight_data = weights[weight_name].astype(np.float32)
                
                # Write to binary file
                f.write(weight_data.tobytes())
                
                # Record weight specification
                weight_specs.append({
                    "name": weight_name,
                    "shape": weight_data.shape,
                    "dtype": "float32"
                })
                
                print(f"Written {weight_name}: {weight_data.shape} at offset {offset}")
                offset += weight_data.nbytes
    
    print(f"Created binary weights file: {bin_path}")
    print(f"Total size: {offset} bytes")
    return weight_specs

def main():
    # Model files to convert
    models = [
        ('ddpg', '/Users/badrbouchabchoub/Downloads/Negotiator/RL/batna_RL_badr 2/best_actor_ddpg.weights.h5'),
        ('td3', '/Users/badrbouchabchoub/Downloads/Negotiator/RL/batna_RL_badr 2/best_actor.weights.h5'),  # Assuming this is TD3
        ('sac', '/Users/badrbouchabchoub/Downloads/Negotiator/RL/batna_RL_badr 2/best_actor_sac.weights.h5')
    ]
    
    base_path = '/Users/badrbouchabchoub/Downloads/Negotiator/Negotiatior/public/models'
    
    for model_name, h5_path in models:
        print(f"\n=== Converting {model_name.upper()} model ===")
        
        if not os.path.exists(h5_path):
            print(f"Warning: {h5_path} not found, skipping...")
            continue
        
        # Extract weights from H5
        weights = extract_h5_weights(h5_path)
        
        if weights is None:
            print(f"Failed to extract weights from {h5_path}")
            continue
        
        # Create output directory
        output_path = os.path.join(base_path, model_name)
        os.makedirs(output_path, exist_ok=True)
        
        # Create TensorFlow.js weights
        weight_specs = create_tfjs_weights(weights, output_path)
        
        print(f"Successfully converted {model_name} model!")
        print(f"Weights saved to: {output_path}")

if __name__ == "__main__":
    main()