# Testing AI Refactoring in a Dummy Repo

## Quick Setup

### 1. Create a new test repository on GitHub
```bash
# On GitHub.com:
# Click "+" → "New repository"
# Name: carbon-gate-test
# Description: Testing AI refactoring
# Public or Private
# Don't initialize with README
```

### 2. Add this repo as a new remote
```powershell
# Add test repo as a remote
git remote add test-repo https://github.com/YOUR_USERNAME/carbon-gate-test.git

# Push everything to test repo
git push test-repo Avery:main
```

### 3. Set up secrets in test repo
Go to: Settings → Secrets and variables → Actions → New repository secret

Add these secrets:
- `CRUSOE_API_KEY`: Your Crusoe API key
- `CARBON_GATE_ORG_KEY`: Any test value (e.g., "test-org-key-123")
- `CARBON_GATE_API_ENDPOINT`: https://bit-manip-hackeurope.vercel.app

### 4. Create a test PR in the test repo
```powershell
# Create a test branch with high-carbon code
git checkout -b test-refactor
git add demo/inefficient_train.py
git commit -m "Add inefficient training code"
git push test-repo test-refactor

# Then create PR on GitHub: test-refactor → main
```

### 5. Check the PR comment
The Carbon Gate action will run and you'll see:
- AI Code Efficiency Analysis
- 🤖 AI-Generated Carbon-Optimized Code section

---

## Alternative: Test in Current Repo (Safe)

Your PR doesn't affect main until you merge it!

1. Your branch `Avery` is already pushed
2. Create/update the PR (don't merge it)
3. Carbon Gate runs on every push
4. Check the PR comments for refactored code
5. When done testing, just close the PR (don't merge)

**Your main branch stays clean** - PRs are isolated until merged.

---

## Force Refactoring to Trigger

To guarantee refactoring shows up, temporarily lower thresholds:

```yaml
# In carbon-gate.yml on your test branch
carbon-gate:
  estimated_hours: 8.0
  gpu: H100
  region: us-east-1
  
  suggest_crusoe: true
  auto_refactor: true
  
  warn_kg_co2: 0.1      # ← Very low! Forces "warn" status
  threshold_kg_co2: 0.5  # ← Ensures refactoring triggers
```

Then push:
```powershell
git add carbon-gate.yml
git commit -m "Lower thresholds to force refactoring"
git push origin Avery  # or: git push test-repo test-refactor
```

---

## Debug: Check if it ran

In the PR, click **"Checks" → "Check Carbon Emissions"** and look for:

```
[INFO] High emissions detected (warn), generating AI code refactoring...
[DEBUG] Received response from Crusoe AI (2254 chars)
[DEBUG] Parsed refactored file: demo/inefficient_train.py
[SUCCESS] Successfully generated refactored code for 1 file(s)
```

If you see these logs but NO refactored code in comment, there's a parsing issue.
If you DON'T see these logs, the status is "pass" (emissions too low).
