# Person 1 Deliverables - GitHub Action & Demo

This directory contains Person 1's deliverables for the Carbon Gate hackathon project.

## 📁 Files Created

### Core Action Files
- **`action.yml`** - GitHub Action definition
- **`gate_check.py`** - Main Python script that runs the gate check
- **`requirements.txt`** - Python dependencies

### Demo Files
- **`demo/train_model.py`** - Simulated ML training script for live demo
- **`carbon-gate.yml`** - Example configuration file
- **`.github/workflows/carbon-gate.yml`** - Workflow file that triggers the action on PRs

## 🚀 How to Use

### 1. Set Up Repository Secrets

In your GitHub repository settings, add these secrets:

```
CARBON_GATE_ORG_KEY - Your organization API key (get from dashboard)
CARBON_GATE_API_ENDPOINT - (Optional) API endpoint URL, defaults to production
```

### 2. Add carbon-gate.yml to Your Repo

Copy the `carbon-gate.yml` file to your repository root and customize:

```yaml
carbon-gate:
  gpu: A100                    # GPU type: A100, H100, V100, A10
  estimated_hours: 4.0         # Estimated training time
  region: us-east-1            # Cloud region
  threshold_kg_co2: 2.0        # Block if over this
  warn_kg_co2: 1.0             # Warn if over this
  suggest_crusoe: true         # Show Crusoe alternative
```

### 3. The Action Runs Automatically

When you open a PR that modifies Python files or `carbon-gate.yml`, the action will:

1. ✅ Read your `carbon-gate.yml` configuration
2. 🌐 Call the Carbon Gate API to estimate emissions
3. 💬 Post a detailed report as a PR comment
4. 🚫 Block the PR if emissions exceed your threshold (or ⚠️ warn)

## 🎬 Live Demo Flow

For the hackathon pitch, follow this sequence:

### Step 1: Show the Dashboard
Open the Carbon Gate web dashboard showing org is at 85% of monthly budget.

### Step 2: Make a Code Change
```bash
cd demo
# Edit train_model.py to increase epochs
git checkout -b demo/high-carbon-training
git add .
git commit -m "Increase training epochs to 200"
git push origin demo/high-carbon-training
```

### Step 3: Open Pull Request
Create a PR on GitHub. The action will trigger automatically.

### Step 4: Watch the Magic
- GitHub Action runs in real-time
- PR comment appears with full Carbon Gate report
- Shows current emissions vs Crusoe alternative
- Dashboard updates with new usage

### Step 5: Show the Override
Add `carbon-override` label or comment `/crusoe-run` to demonstrate bypass/reroute features.

## 🧪 Local Testing

Test the gate check script locally:

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GITHUB_REPOSITORY="averyhochheiser/bit-manip-hackeurope"
export PR_NUMBER="1"
export API_ENDPOINT="http://localhost:3000"  # Or production URL
export ORG_API_KEY="test-key-123"

# Run the check
python gate_check.py
```

## 📊 PR Comment Format

The action posts a comment that looks like this:

```markdown
## 🌍 Carbon Gate Report

Estimated emissions: 3.2 kgCO₂eq ⚠️ Exceeds warning level (1.0 kg)
Current grid: us-east-1 — 420 gCO₂/kWh
Training cost: ~$14.20

---

### 💡 Crusoe Alternative
Region: us-east-1 (geothermal)
Estimated emissions: 0.38 kgCO₂eq ✅ 88% cleaner
Available GPUs: h100-sxm-80gb-1x
Estimated cost: ~$16.40 (+$2.20 for 88% less carbon)

---

### 📊 Monthly Budget
Used this month: 37.6 / 50.0 kgCO₂eq
Remaining: 12.4 kg before overage billing kicks in

---

### ⏰ Optimal Window
Grid forecast: wait 3 hours, save 34%

---

Actions:
- To override this gate: add label `carbon-override` to this PR
- To reroute to Crusoe: comment `/crusoe-run`
```

## 🔧 Integration Points

### API Endpoint: `/api/gate/check`

**Request:**
```json
{
  "repo": "myorg/myrepo",
  "pr_number": 42,
  "gpu": "A100",
  "estimated_hours": 4,
  "region": "us-east-1",
  "api_key": "org-key-123"
}
```

**Response:**
```json
{
  "emissions_kg": 3.2,
  "crusoe_emissions_kg": 0.38,
  "budget_remaining_kg": 12.4,
  "status": "warn",
  "overage_kg": 0,
  "optimal_window": "wait 3 hours, save 34%",
  "crusoe_available": true,
  "crusoe_instance": "h100-sxm-80gb-1x",
  "carbon_intensity": 420,
  "pue_used": 1.15
}
```

## 📝 Interface Contract

This is what Person 3's backend must provide:

**Endpoint:** `POST /api/gate/check`

**Status field values:**
- `"pass"` - Emissions within acceptable limits
- `"warn"` - Emissions exceed warning threshold but not blocking
- `"block"` - Emissions exceed blocking threshold, PR should be blocked

The action will exit with code 1 (failing the check) if status is `"block"`.

## 🎯 Testing Checklist

Before the demo:

- [ ] Secrets are set in GitHub repo settings
- [ ] `carbon-gate.yml` is in repo root
- [ ] Workflow file is in `.github/workflows/carbon-gate.yml`
- [ ] Action can call the API endpoint successfully
- [ ] PR comments are formatted correctly
- [ ] Gate blocks PRs when threshold is exceeded
- [ ] Demo repo can be pushed live during presentation
- [ ] Timing: PR → Action trigger → Comment posted takes < 60 seconds

## 🐛 Troubleshooting

**Action fails with "Module not found"**
- The action installs dependencies automatically, but check `requirements.txt` is present

**API call fails**
- Check `CARBON_GATE_API_ENDPOINT` secret is set correctly
- Verify API is deployed and accessible
- For development, the script falls back to mock data

**PR comment not posted**
- Ensure `GITHUB_TOKEN` has `pull-requests: write` permission
- Check workflow file has correct permissions block

**Gate doesn't block high emissions**
- Verify `threshold_kg_co2` in `carbon-gate.yml`
- Check API is returning correct `status` value

## ⏱️ Time Estimate

- [x] Core action.yml structure - 30 min ✅
- [x] gate_check.py script - 1 hour ✅
- [x] PR comment formatting - 30 min ✅
- [x] Demo training script - 20 min ✅
- [x] Documentation - 30 min ✅
- [ ] Testing & debugging with live API - 1 hour
- [ ] Final integration & demo rehearsal - 1 hour

**Total:** ~4.5 hours

## 🤝 Dependencies on Other Team Members

- **Person 3** must deploy `/api/gate/check` endpoint
- **Person 4** must provide production API URL for secrets
- **Person 2**'s calculations are used by Person 3's backend

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Creating a Composite Action](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action)
- [GitHub API - Create Issue Comment](https://docs.github.com/en/rest/issues/comments#create-an-issue-comment)

---

Built for HackEurope 2026 | Crusoe Sustainability Track | Person 1 Deliverable
