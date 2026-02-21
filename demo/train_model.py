"""
Demo ML Training Script for Carbon Gate
This simulates a typical ML training job that would trigger the Carbon Gate action
"""

import time
import random
import numpy as np


def simulate_model_training(epochs=100, batch_size=32):
    """
    Simulates a GPU-intensive model training job
    In reality, this would be something like:
    - PyTorch model.fit()
    - TensorFlow training loop
    - JAX optimization
    """
    print("=" * 80)
    print("Starting ML Model Training")
    print("=" * 80)
    print(f"Configuration:")
    print(f"  Epochs: {epochs}")
    print(f"  Batch size: {batch_size}")
    print(f"  Estimated time: ~4 hours on A100")
    print()
    
    # Simulate training progress
    for epoch in range(1, epochs + 1):
        # Simulate batch processing
        train_loss = 2.5 * np.exp(-epoch / 50) + random.uniform(0, 0.1)
        val_loss = 2.7 * np.exp(-epoch / 50) + random.uniform(0, 0.15)
        accuracy = min(0.99, 0.5 + 0.5 * (1 - np.exp(-epoch / 30)))
        
        if epoch % 10 == 0:
            print(f"Epoch {epoch:3d}/{epochs} | "
                  f"Train Loss: {train_loss:.4f} | "
                  f"Val Loss: {val_loss:.4f} | "
                  f"Accuracy: {accuracy:.2%}")
        
        # Small delay to simulate computation
        time.sleep(0.01)
    
    print()
    print("=" * 80)
    print("[SUCCESS] Training Complete!")
    print("=" * 80)
    print(f"Final Accuracy: {accuracy:.2%}")
    print(f"Final Loss: {train_loss:.4f}")
    print()
    print("Saving model checkpoint...")
    print("[OK] Model saved to: ./checkpoints/model_final.pth")
    print()
    print("Training Statistics:")
    print(f"  Total epochs: {epochs}")
    print(f"  Total batches processed: {epochs * 100}")  # Simulated
    print(f"  GPU hours (estimated): 4.0")
    print(f"  Carbon emissions (estimated): ~3.2 kgCO2eq")
    print()


if __name__ == "__main__":
    print("""
    CARBON GATE DEMO - ML Training Job
    
    This training job will:
    1. Trigger the Carbon Gate GitHub Action on PR
    2. Estimate carbon emissions based on carbon-gate.yml config
    3. Post a detailed report to the PR
    4. Block/warn based on configured thresholds
    
    """)
    
    simulate_model_training(epochs=100, batch_size=32)
