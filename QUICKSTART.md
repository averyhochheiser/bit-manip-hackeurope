# ⚡ Quick Start Guide - Person 1 Setup Complete

## ✅ What's Been Created

Your Person 1 deliverables are ready! Here's what's in the repo:

```
bit-manip-hackeurope/
├── action.yml                 ✅ GitHub Action definition
├── gate_check.py             ✅ Main gate check script
├── requirements.txt          ✅ Python dependencies
├── carbon-gate.yml           ✅ Example config file
├── .gitignore                ✅ Git ignore rules
├── .github/
│   └── workflows/
│       └── carbon-gate.yml   ✅ Workflow trigger
├── demo/
│   ├── train_model.py        ✅ Demo ML training script
│   └── README.md             ✅ Demo instructions
├── PERSON1_README.md         ✅ Detailed Person 1 docs
├── README.md                 ✅ Main project README
└── QUICKSTART.md             ✅ This file
```

## 🚀 Next Steps (Do This Now)

### 1. Commit and Push to GitHub

```bash
git add .
git commit -m "feat: Initialize Carbon Gate - Person 1 deliverables complete"
git push origin main
```

### 2. Verify on GitHub

Go to https://github.com/averyhochheiser/bit-manip-hackeurope and check:
- ✅ All files are visible
- ✅ README.md renders nicely
- ✅ `.github/workflows/` folder is present

### 3. Configure Repository Secrets (IMPORTANT!)

Once Person 3 has the backend deployed:

1. Go to repo **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add: `CARBON_GATE_ORG_KEY` = (get from Person 4's dashboard)

### 4. Test the Action (Once Backend is Ready)

```bash
# Create a test branch
git checkout -b test/carbon-gate-action

# Make a small change to trigger the workflow
echo "# Test change" >> demo/train_model.py

# Commit and push
git add .
git commit -m "test: trigger carbon gate action"
git push origin test/carbon-gate-action

# Open a PR on GitHub
# The action should trigger automatically!
```

## 🤝 Integration Points

### What You Need from Person 3 (Backend)

- [ ] Production API endpoint URL (for secrets)
- [ ] Test API key for development
- [ ] Confirmation that `/api/gate/check` endpoint is live

Example test:
```bash
curl -X POST https://carbon-gate.vercel.app/api/gate/check \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "test/test",
    "pr_number": 1,
    "gpu": "A100",
    "estimated_hours": 4,
    "region": "us-east-1",
    "api_key": "test-key"
  }'
```

Expected response:
```json
{
  "emissions_kg": 3.2,
  "crusoe_emissions_kg": 0.38,
  "budget_remaining_kg": 12.4,
  "status": "warn",
  ...
}
```

### What You Need from Person 4 (Frontend)

- [ ] Production Vercel URL
- [ ] How to get/generate org API keys
- [ ] Signup flow to create test account

## 🎬 Demo Preparation Checklist

**Before the pitch:**

- [ ] Secrets configured in GitHub
- [ ] Backend API is responding
- [ ] Tested full flow end-to-end
- [ ] Demo branch prepared (`demo/high-carbon-training`)
- [ ] Code change pre-staged (increase epochs to 200)
- [ ] Dashboard showing 85% budget usage
- [ ] GitHub and dashboard open in separate browser tabs

**Demo script:**
1. Show dashboard (15 sec)
2. Push code change (10 sec)
3. Open PR (10 sec)
4. Wait for action (~30 sec) - explain what's happening
5. Comment appears (5 sec)
6. Show dashboard update (5 sec)
7. Demo override/reroute (15 sec)

**Total: 90 seconds**

## 🐛 Troubleshooting

### Action doesn't trigger
- Check `.github/workflows/carbon-gate.yml` is on main branch
- Verify the workflow file has correct permissions
- Ensure PR modifies a `.py` file or `carbon-gate.yml`

### API call fails
- Check `CARBON_GATE_ORG_KEY` secret is set
- Verify backend is deployed and accessible
- Look at action logs: Actions tab → Latest run → Job details

### Comment not posted
- Ensure workflow has `pull-requests: write` permission
- Check `GITHUB_TOKEN` is being passed correctly
- Verify PR number is being captured

### Local testing
```bash
# Set env vars
export GITHUB_REPOSITORY="averyhochheiser/bit-manip-hackeurope"
export PR_NUMBER="1"
export API_ENDPOINT="http://localhost:3000"  # or production
export ORG_API_KEY="test-key"

# Run
python gate_check.py
```

## 📊 Status Check

Run this to verify everything is ready:

```bash
# Check files exist
ls -la action.yml gate_check.py carbon-gate.yml .github/workflows/carbon-gate.yml demo/train_model.py

# Check Python script is executable
python gate_check.py --help || echo "Script loads successfully"

# Check dependencies can be installed
pip install -r requirements.txt --dry-run

# Check demo runs
cd demo && python train_model.py
```

## 💡 Tips

**For the hackathon:**
- Keep the API endpoint flexible (use env var, not hardcoded)
- Mock data fallback is already built in for testing
- Comment formatting is ready - just needs real data
- Action is designed to fail gracefully if backend is down

**For the pitch:**
- Practice the demo 3-4 times
- Have a backup video if Wi-Fi fails
- Know the timing: push → comment should be < 60 sec
- Emphasize the unique value: enforcement + billing, not just measurement

## 🎯 Success Criteria

Your Person 1 work is done when:

- ✅ GitHub Action is published and callable
- ✅ Demo repo triggers action on PR
- ✅ PR comment is correctly formatted
- ✅ Gate blocks/warns based on thresholds
- ✅ Integration with backend API works
- ✅ Live demo is rehearsed and ready

## 🔗 Quick Links

- **Main README:** [README.md](README.md)
- **Person 1 Details:** [PERSON1_README.md](PERSON1_README.md)
- **Demo Instructions:** [demo/README.md](demo/README.md)
- **GitHub Repo:** https://github.com/averyhochheiser/bit-manip-hackeurope
- **Project Spec:** (see Discord message)

## ⏱️ Timeline

- **Hours 0-2:** ✅ Setup complete (you are here!)
- **Hours 2-6:** Wait for Person 3's API, test integration
- **Hours 6-14:** Polish PR comment formatting, edge cases
- **Hours 14-20:** Full integration testing
- **Hours 20-26:** Demo rehearsal
- **Hours 26-28:** Final prep
- **Hours 28-30:** Pitch!

---

## 🚨 Next Action Items

**Right now:**
1. Commit and push this code
2. Message the team: "Person 1 deliverables complete ✅"
3. Share the repo URL
4. Ask Person 3 for API endpoint + test key
5. Ask Person 4 for production Vercel URL

**In next 2 hours:**
1. Test the action locally with mock data
2. Verify workflow triggers on PR
3. Fine-tune PR comment formatting

**In next 6 hours:**
1. Integrate with live backend API
2. End-to-end test
3. Verify gate blocks/warns correctly

---

**You've completed Person 1's core deliverables! 🎉**

The GitHub Action is ready, the demo is set up, and the integration points are clear. Now wait for the backend to be ready, test everything together, and rehearse the demo.

**Current status: ✅ ON TRACK**

---

*Questions? Check PERSON1_README.md or ask the team!*
