# Demo Training Script

This directory contains the demo ML training script for live demonstrations.

## 🎬 How to Use for Demo

### Quick Run

```bash
python train_model.py
```

This simulates a 4-hour GPU training job in about 2 seconds.

## 🚀 Demo Workflow

### Pre-Demo Setup (do this before the pitch)

1. **Prepare the branch:**
```bash
git checkout main
git pull
git checkout -b demo/high-carbon-training
```

2. **Verify the action is configured:**
- Check `.github/workflows/carbon-gate.yml` exists
- Verify `CARBON_GATE_ORG_KEY` secret is set
- Ensure `carbon-gate.yml` config is in root

### During the Live Demo

**Step 1:** Show existing state
- Show the web dashboard (budget at ~85%)
- Show this demo script in VS Code

**Step 2:** Make a "dangerous" change
```python
# Edit train_model.py line 56 - increase epochs
simulate_model_training(epochs=200, batch_size=32)  # Was 100
```

**Step 3:** Commit and push
```bash
git add train_model.py
git commit -m "feat: increase training epochs to 200 - expect higher emissions"
git push origin demo/high-carbon-training
```

**Step 4:** Open PR
- Go to GitHub
- Click "Compare & pull request"
- Title: "Increase model training duration"
- Create PR

**Step 5:** Watch the magic ✨
- Action triggers automatically (visible in PR checks)
- ~20-30 seconds later: Carbon Gate comment appears
- Shows emissions estimate, Crusoe alternative, budget impact
- PR check may fail if over threshold

**Step 6:** Show override options
- Add `carbon-override` label to PR
- Or comment `/crusoe-run` to reroute

**Step 7:** Show dashboard update
- Refresh web dashboard
- New usage appears in real-time

## 🎭 Rehearsal Tips

**Practice the timing:**
- From push to comment should be < 60 seconds
- Have GitHub and dashboard open in separate tabs
- Pre-stage the code change to avoid live typos

**Backup plan:**
- If Wi-Fi is slow, have a pre-recorded screen capture
- Or use localhost API endpoint for instant response

**Talking points while waiting for the action:**
- Explain what's happening under the hood
- Mention the physics calculations
- Talk about the Crusoe API integration
- Highlight the business model (overage billing)

## 📝 Variations for Different Demo Scenarios

### Low Emissions (should pass)
```python
simulate_model_training(epochs=50, batch_size=16)
```
Update `carbon-gate.yml`:
```yaml
estimated_hours: 2.0
```

### Medium Emissions (warning)
```python
simulate_model_training(epochs=100, batch_size=32)
```
Update `carbon-gate.yml`:
```yaml
estimated_hours: 4.0
threshold_kg_co2: 5.0  # High threshold
warn_kg_co2: 2.0       # Low warning
```

### High Emissions (blocked)
```python
simulate_model_training(epochs=500, batch_size=64)
```
Update `carbon-gate.yml`:
```yaml
estimated_hours: 12.0
gpu: H100
threshold_kg_co2: 2.0  # Low threshold
```

## 🧪 Local Testing

Test the gate check without opening a PR:

```bash
cd ..
export GITHUB_REPOSITORY="averyhochheiser/bit-manip-hackeurope"
export PR_NUMBER="999"
export API_ENDPOINT="https://carbon-gate.vercel.app"
export ORG_API_KEY="your-dev-key"

python gate_check.py
```

This will run the check and print the comment that would be posted.

## 🎯 Success Metrics

Your demo is successful if:

- ✅ Push → PR → Comment takes < 60 seconds
- ✅ Comment is formatted correctly with all sections
- ✅ Crusoe alternative is shown
- ✅ Budget tracking is accurate
- ✅ Status (pass/warn/block) matches configuration
- ✅ Audience can clearly see the value proposition

## 📊 Expected Output

Running the default script should produce:

```
================================================================================
🌍 Carbon Gate - ML Training Job

This training job will:
1. Trigger the Carbon Gate GitHub Action on PR
2. Estimate carbon emissions based on carbon-gate.yml config
3. Post a detailed report to the PR
4. Block/warn based on configured thresholds

================================================================================
🚀 Starting ML Model Training
================================================================================
Configuration:
  Epochs: 100
  Batch size: 32
  Estimated time: ~4 hours on A100

Epoch  10/100 | Train Loss: 2.0458 | Val Loss: 2.2134 | Accuracy: 16.18%
Epoch  20/100 | Train Loss: 1.6775 | Val Loss: 1.8234 | Accuracy: 28.98%
...
Epoch 100/100 | Train Loss: 0.1264 | Val Loss: 0.1756 | Accuracy: 95.02%

================================================================================
✅ Training Complete!
================================================================================
Final Accuracy: 95.02%
Final Loss: 0.1264

💾 Saving model checkpoint...
✅ Model saved to: ./checkpoints/model_final.pth

📊 Training Statistics:
  Total epochs: 100
  Total batches processed: 10000
  GPU hours (estimated): 4.0
  Carbon emissions (estimated): ~3.2 kgCO₂eq
```

---

**Good luck with the demo! 🚀**
