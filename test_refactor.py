"""
Local test script for AI code refactoring feature
Simulates the gate_check.py flow without needing a real PR
"""
import os
import sys

# Set up mock environment variables
os.environ['OUTPUT_MODE'] = 'text'
os.environ['GITHUB_TOKEN'] = 'mock_token'
os.environ['GITHUB_REPOSITORY'] = 'test/repo'
os.environ['PR_NUMBER'] = '42'
os.environ['API_ENDPOINT'] = 'https://bit-manip-hackeurope.vercel.app'
os.environ['ORG_API_KEY'] = 'test_key'

# Import after setting env vars
from gate_check import call_crusoe_for_refactoring

# Mock Python file content
test_file_content = {
    "train.py": """
import torch
import torch.nn as nn

def train():
    model = nn.Linear(100, 10).cuda()
    optimizer = torch.optim.Adam(model.parameters())
    
    for epoch in range(100):
        for batch in dataloader:
            optimizer.zero_grad()
            loss = model(batch)
            loss.backward()
            optimizer.step()
"""
}

# Mock diff
test_diff = """
### train.py
```diff
+ def train():
+     model = nn.Linear(100, 10).cuda()
+     optimizer = torch.optim.Adam(model.parameters())
```
"""

# Test config
test_config = {
    "gpu": "H100",
    "estimated_hours": 8.0,
    "auto_refactor": True
}

print("Testing Crusoe AI refactoring...")
print("=" * 60)

result = call_crusoe_for_refactoring(test_diff, test_config, test_file_content)

if result:
    print(f"\n✅ Success! Generated refactored code for {len(result)} file(s):\n")
    for filename, code in result.items():
        print(f"\n{'='*60}")
        print(f"FILE: {filename}")
        print(f"{'='*60}")
        print(code[:500] + "..." if len(code) > 500 else code)
else:
    print("\n❌ No refactored code generated")
    print("Possible reasons:")
    print("  - CRUSOE_API_KEY not set")
    print("  - API call failed")
    print("  - AI returned no changes")
