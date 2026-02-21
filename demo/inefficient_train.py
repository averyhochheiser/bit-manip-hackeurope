"""
Intentionally inefficient training code to trigger high carbon emissions
"""
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

class SimpleDataset(Dataset):
    def __init__(self, size=10000):
        self.size = size
        
    def __len__(self):
        return self.size
    
    def __getitem__(self, idx):
        # Inefficient: generating data on the fly without caching
        x = torch.randn(128)
        y = torch.randint(0, 10, (1,))
        return x, y

class LargeModel(nn.Module):
    def __init__(self):
        super().__init__()
        # Overly large model for simple task
        self.layers = nn.Sequential(
            nn.Linear(128, 2048),
            nn.ReLU(),
            nn.Linear(2048, 2048),
            nn.ReLU(),
            nn.Linear(2048, 2048),
            nn.ReLU(),
            nn.Linear(2048, 1024),
            nn.ReLU(),
            nn.Linear(1024, 10)
        )
    
    def forward(self, x):
        return self.layers(x)

def train():
    # Inefficiencies to trigger refactoring suggestions:
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = LargeModel().to(device)
    
    # No mixed precision training
    # No gradient checkpointing
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    criterion = nn.CrossEntropyLoss()
    
    # Inefficient data loading
    dataset = SimpleDataset()
    dataloader = DataLoader(
        dataset, 
        batch_size=32,
        num_workers=0,  # Blocking I/O
        pin_memory=False  # Inefficient GPU transfer
    )
    
    # No early stopping
    num_epochs = 100
    
    for epoch in range(num_epochs):
        total_loss = 0
        for batch_idx, (data, target) in enumerate(dataloader):
            data, target = data.to(device), target.to(device)
            
            optimizer.zero_grad()
            output = model(data)
            loss = criterion(output, target.squeeze())
            loss.backward()
            optimizer.step()
            
            # Inefficient: CPU transfer in training loop
            total_loss += loss.item()
            
            # Inefficient: printing every batch
            if batch_idx % 10 == 0:
                print(f'Epoch {epoch}, Batch {batch_idx}, Loss: {loss.item()}')
        
        print(f'Epoch {epoch} average loss: {total_loss / len(dataloader)}')

if __name__ == '__main__':
    train()
