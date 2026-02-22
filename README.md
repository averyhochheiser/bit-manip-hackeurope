:)
# 🌍 Carbon Gate

> A GitHub Action that intercepts ML training jobs in a pull request pipeline, estimates their carbon emissions using real-time grid data, and either warns the developer, blocks the run, or suggests rerouting to Crusoe's clean energy infrastructure.

**Built for HackEurope 2026 | Crusoe Sustainability Track**

---

## 🎯 What It Does

Carbon Gate puts a **financial price on carbon emissions** in your ML workflow:

1. 🔍 **Intercepts** every ML training PR
2. 📊 **Estimates** carbon emissions using real-time grid data & advanced physics
3. 💬 **Reports** emissions cost vs. Crusoe's clean alternative directly in the PR
4. 🚫 **Blocks** or ⚠️ **warns** based on your configured thresholds
5. 💰 **Bills** carbon overage — creating real financial incentive to optimize

---

## 🏆 Why We're Different

Other tools just measure. **We enforce.**

- ✅ Real carbon overage billing (Stripe metered billing)
- ✅ Mirrors EU CBAM carbon credit markets
- ✅ Admin-only overrides prevent unauthorized bypass of billing
- ✅ Advanced thermodynamic PUE modeling (not flat 1.1 assumptions)
- ✅ Fourier forecasting for optimal training windows
- ✅ Direct Crusoe API integration for immediate rerouting

---

## 🚀 Quick Start

### 1. Add Config to Your Repo

Create `carbon-gate.yml` in your repository root:

```yaml
carbon-gate:
  gpu: A100
  estimated_hours: 4.0
  region: us-east-1
  threshold_kg_co2: 2.0
  warn_kg_co2: 1.0
  suggest_crusoe: true
```

### 2. Set Up GitHub Action

Create `.github/workflows/carbon-gate.yml`:

```yaml
name: Carbon Gate Check

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write
  contents: read

jobs:
  carbon-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: averyhochheiser/bit-manip-hackeurope@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          org-api-key: ${{ secrets.CARBON_GATE_ORG_KEY }}
```

### 3. Add Repository Secrets

In Settings → Secrets → Actions:

- `CARBON_GATE_ORG_KEY` - Get from [carbon-gate.vercel.app](https://carbon-gate.vercel.app)

### 4. Open a PR

The action runs automatically and posts a detailed carbon report!

---

## 📊 What You Get

Every PR gets a comment like this:

```markdown
🌍 Carbon Gate Report

Estimated emissions: 3.2 kgCO₂eq ⚠️ Exceeds warning level
Current grid: us-east-1 — 420 gCO₂/kWh
Training cost: ~$14.20

💡 Crusoe Alternative
Estimated emissions: 0.38 kgCO₂eq ✅ 88% cleaner
Available now: h100-sxm-80gb-1x
Estimated cost: ~$16.40 (+$2.20 for 88% less carbon)

📊 Monthly Budget
Used: 37.6 / 50.0 kgCO₂eq
Remaining: 12.4 kg before overage billing

⏰ Optimal Window
Grid forecast: wait 3 hours, save 34%
```

---

## 💸 Carbon Overage Billing

**The business model that makes us unique:**

1. Set a monthly carbon budget (e.g., 50 kgCO₂eq/month)
2. Every gate check logs emissions to your account
3. Stay under budget → no extra charge
4. **Exceed budget → automatic billing** at $2/kgCO₂ overage
5. Creates real financial incentive to optimize or reroute to Crusoe

This mirrors **EU CBAM** (Carbon Border Adjustment Mechanism) — companies already pay for carbon in the real world. We bring that into the dev workflow.

---

## 🏗️ Tech Stack

| Component     | Technology                |
| ------------- | ------------------------- |
| GitHub Action | Python (composite action) |
| Backend API   | Next.js (Vercel)          |
| Database      | Supabase (Postgres)       |
| Billing       | Stripe Metered Billing    |
| Carbon Data   | Electricity Maps API      |
| Clean Compute | Crusoe API                |
| Calculations  | Custom physics models     |

---

## 🔬 Advanced Physics

We don't use flat assumptions. Our calculations include:

1. **Thermodynamic PUE modeling** - Dynamic, based on real ambient temperature
2. **GPU thermal throttling** - Coupled differential equations
3. **Fourier forecasting** - Predict optimal training windows
4. **Embodied carbon** - Manufacturing emissions amortized over lifetime
5. **Radiative forcing** - Express emissions in W/m² atmospheric impact

---

## 👥 Team Structure

This is a hackathon project split across 4 people:

- **Person 1** (this repo) - GitHub Action + Demo
- **Person 2** - Physics calculations (`calculations.py`)
- **Person 3** - Backend API + Crusoe/Electricity Maps integration
- **Person 4** - Frontend dashboard + Stripe billing

---

## 📁 Repository Structure

```
bit-manip-hackeurope/
├── action.yml                    # GitHub Action definition
├── gate_check.py                 # Main Python script
├── requirements.txt              # Python dependencies
├── carbon-gate.yml               # Your config
├── carbon-gate.example.yml       # Example config
├── .github/
│   └── workflows/
│       └── carbon-gate.yml       # Workflow that triggers action
├── demo/
│   ├── train_model.py            # Demo ML training script
│   └── README.md                 # Demo documentation
└── README.md                     # This file
```

---

## 🎬 Live Demo

For the pitch, we'll:

1. Show dashboard at 85% of carbon budget
2. Push a high-emission training job to demo repo
3. Watch GitHub Action trigger in real-time
4. PR comment appears with full report
5. Dashboard updates live
6. Show override/reroute features

**Timing:** < 60 seconds from push to PR comment

---

## 🔌 API Integration

The action calls `POST /api/gate/check`:

**Request:**

```json
{
  "repo": "myorg/myrepo",
  "pr_number": 42,
  "gpu": "A100",
  "estimated_hours": 4,
  "region": "us-east-1"
}
```

**Response:**

```json
{
  "emissions_kg": 3.2,
  "crusoe_emissions_kg": 0.38,
  "budget_remaining_kg": 12.4,
  "status": "warn",
  "optimal_window": "wait 3 hours, save 34%",
  "crusoe_available": true
}
```

---

## 🐛 Development

### Local Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GITHUB_REPOSITORY="averyhochheiser/bit-manip-hackeurope"
export PR_NUMBER="1"
export API_ENDPOINT="http://localhost:3000"
export ORG_API_KEY="test-key"

# Run gate check
python gate_check.py
```

### Run Demo Training

```bash
cd demo
python train_model.py
```

---

## 📚 Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Crusoe API Docs](https://docs.crusoecloud.com/)
- [Electricity Maps API](https://www.electricitymaps.com/api)
- [Stripe Metered Billing](https://stripe.com/docs/billing/subscriptions/metered-billing)

---

## �️ Running the Web App (Dashboard)

The dashboard is a Next.js 16 app. Here's how to get it running locally.

### Prerequisites

- Node.js 20+
- A Supabase project (URL + service role key)
- Crusoe API key
- Electricity Maps API key (sandbox key works)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase — get from supabase.com → project → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Crusoe — NOTE: escape any $ signs with \$ or the value will be corrupted
CRUSOE_API_KEY=your-key-here

# Electricity Maps — sandbox key works fine for development
ELECTRICITY_MAPS_API_KEY=your-key-here

# Stripe — leave blank to skip billing (uses mock data)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_BASE_PRICE_ID=
STRIPE_METERED_PRICE_ID=
STRIPE_METER_EVENT_NAME=carbon_usage_kg

# Internal cron auth — can leave blank locally
CRON_SECRET=
```

> ⚠️ **Crusoe key gotcha:** If your key contains `$` characters (bcrypt-style keys do), escape each one with `\$` in `.env.local`, otherwise `dotenv-expand` will silently corrupt the value.

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Route | Description |
|---|---|
| `/` | Marketing landing page |
| `/dashboard` | Carbon usage, gate history, billing overview |
| `/settings` | Policy thresholds and budget configuration |

### 4. Verify API connectivity

```bash
curl http://localhost:3000/api/health
# → { "status": "ok", "services": { "crusoe": "ok", "supabase": "ok" } }

curl http://localhost:3000/api/crusoe/models
# → { "available": true, "model_count": 7, "models": [...] }
```

### Other useful commands

```bash
npm run build      # production build
npm run typecheck  # TypeScript checks
npm run lint       # ESLint
```

---

## �📄 License

MIT License - built for HackEurope 2026

---

## 🤝 Contributing

This is a hackathon project built in 30 hours. Contributions welcome after the event!

---

**Built with ❤️ and ⚡ for a sustainable future**

_Track: Crusoe Sustainability | Prize: €1,000 | HackEurope 2026_
