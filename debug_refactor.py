"""
Debug test for AI refactoring feature
Run this to see exactly what the AI is returning
"""
import os
import sys

# Load .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Loaded .env file")
except ImportError:
    print("⚠️  python-dotenv not installed, trying to load .env manually...")
    # Manual .env loading
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()
        print("✅ Manually loaded .env file")

# Enable debug output
os.environ['DEBUG_REFACTOR'] = '1'
os.environ['OUTPUT_MODE'] = 'text'

print("=" * 70)
print("AI REFACTORING DEBUG TEST")
print("=" * 70)

# Check environment
print("\n1. Checking environment...")
crusoe_key = os.environ.get('CRUSOE_API_KEY', '').strip()
if crusoe_key:
    print(f"   ✅ CRUSOE_API_KEY: {crusoe_key[:20]}...")
else:
    print("   ❌ CRUSOE_API_KEY not set!")
    print("\n   Checked:")
    print(f"   - .env file exists: {os.path.exists('.env')}")
    print("\n   Set it with:")
    print("   $env:CRUSOE_API_KEY = 'your-key-here'")
    print("   OR install python-dotenv: pip install python-dotenv")
    sys.exit(1)

# Import after env vars set
from gate_check import call_crusoe_for_refactoring

# Test data - inefficient training code
print("\n2. Preparing test data...")
test_files = {
    "train.py": """import torch
import torch.nn as nn
from torch.utils.data import DataLoader

def train():
    model = nn.Linear(100, 10).cuda()
    optimizer = torch.optim.Adam(model.parameters())
    criterion = nn.CrossEntropyLoss()
    
    dataloader = DataLoader(dataset, batch_size=32, num_workers=0, pin_memory=False)
    
    for epoch in range(100):
        for batch_idx, (data, target) in enumerate(dataloader):
            data, target = data.cuda(), target.cuda()
            
            optimizer.zero_grad()
            output = model(data)
            loss = criterion(output, target)
            loss.backward()
            optimizer.step()
            
            # Inefficient: CPU transfer in training loop
            if batch_idx % 100 == 0:
                print(f'Loss: {loss.item()}')
"""
}

test_diff = """### train.py
```diff
+ def train():
+     model = nn.Linear(100, 10).cuda()
+     optimizer = torch.optim.Adam(model.parameters())
```
"""

test_config = {
    "gpu": "H100",
    "estimated_hours": 8.0,
    "auto_refactor": True
}

print(f"   Test file: train.py ({len(test_files['train.py'])} chars)")

# Call the refactoring function
print("\n3. Calling Crusoe AI for refactoring...")
print("   This may take 30-90 seconds...")

try:
    result = call_crusoe_for_refactoring(test_diff, test_config, test_files)
    
    print("\n4. Results:")
    print("=" * 70)
    
    if result:
        print(f"✅ SUCCESS! Received {len(result)} refactored file(s):\n")
        
        for filename, code in result.items():
            print(f"\n📄 {filename}")
            print("-" * 70)
            print(code)
            print("-" * 70)
            print(f"({len(code)} characters)")
    else:
        print("❌ No refactored code returned")
        print("\nCheck crusoe_refactor_response.txt for the raw AI response")
        
        if os.path.exists("crusoe_refactor_response.txt"):
            print("\nRaw AI response preview:")
            with open("crusoe_refactor_response.txt", "r") as f:
                preview = f.read()[:500]
                print(preview)
                if len(preview) >= 500:
                    print("...")
            
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
print("Debug files created:")
if os.path.exists("crusoe_refactor_response.txt"):
    print("  - crusoe_refactor_response.txt (raw AI response)")
print("=" * 70)
