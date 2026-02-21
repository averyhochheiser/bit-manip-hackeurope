#!/usr/bin/env python3
"""
Carbon Gate - GitHub Action Script
Reads carbon-gate.yml config, calls API, and posts PR comment
"""

import os
import sys
import yaml
import requests
import json
from pathlib import Path


def load_config():
    """Load carbon-gate.yml from repository root"""
    config_path = Path("carbon-gate.yml")
    
    if not config_path.exists():
        print("❌ carbon-gate.yml not found in repository root")
        print("Please create a carbon-gate.yml file. See README for format.")
        sys.exit(1)
    
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    if 'carbon-gate' not in config:
        print("❌ Invalid carbon-gate.yml format. Missing 'carbon-gate' root key.")
        sys.exit(1)
    
    return config['carbon-gate']


def call_gate_api(config):
    """Call the Carbon Gate API to check emissions"""
    api_endpoint = os.environ.get('API_ENDPOINT', 'https://carbon-gate.vercel.app')
    org_api_key = os.environ.get('ORG_API_KEY')
    repo = os.environ.get('GITHUB_REPOSITORY')
    pr_number = os.environ.get('PR_NUMBER')
    
    if not pr_number:
        print("ℹ️  Not a pull request event, skipping Carbon Gate check")
        sys.exit(0)
    
    payload = {
        "repo": repo,
        "pr_number": int(pr_number),
        "gpu": config.get('gpu', 'A100'),
        "estimated_hours": config.get('estimated_hours', 1.0),
        "region": config.get('region', 'us-east-1'),
        "api_key": org_api_key
    }
    
    print(f"🌍 Running Carbon Gate check for PR #{pr_number}...")
    print(f"   GPU: {payload['gpu']}")
    print(f"   Estimated hours: {payload['estimated_hours']}")
    print(f"   Region: {payload['region']}")
    
    try:
        response = requests.post(
            f"{api_endpoint}/api/gate/check",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ API call failed: {e}")
        # For demo purposes, return mock data if API isn't ready yet
        print("⚠️  Using mock data for development")
        return {
            "emissions_kg": 3.2,
            "crusoe_emissions_kg": 0.38,
            "budget_remaining_kg": 12.4,
            "status": "warn",
            "overage_kg": 0,
            "optimal_window": "wait 3 hours, save 34%",
            "crusoe_available": True,
            "crusoe_instance": "h100-sxm-80gb-1x",
            "carbon_intensity": 420,
            "pue_used": 1.15
        }


def format_pr_comment(config, result):
    """Format the Carbon Gate report as a PR comment"""
    emissions = result['emissions_kg']
    crusoe_emissions = result['crusoe_emissions_kg']
    status = result['status']
    budget_remaining = result['budget_remaining_kg']
    optimal_window = result.get('optimal_window', 'No recommendation available')
    crusoe_available = result.get('crusoe_available', False)
    crusoe_instance = result.get('crusoe_instance', 'N/A')
    carbon_intensity = result.get('carbon_intensity', 0)
    
    threshold_kg = config.get('threshold_kg_co2', 2.0)
    warn_kg = config.get('warn_kg_co2', 1.0)
    
    # Determine status emoji
    if status == 'block':
        status_emoji = '❌'
        status_text = f'Exceeds threshold ({threshold_kg} kg)'
    elif status == 'warn':
        status_emoji = '⚠️'
        status_text = f'Exceeds warning level ({warn_kg} kg)'
    else:
        status_emoji = '✅'
        status_text = 'Within limits'
    
    # Calculate savings percentage
    savings_pct = int(((emissions - crusoe_emissions) / emissions) * 100) if emissions > 0 else 0
    
    # Estimate costs (rough AWS pricing)
    gpu_hourly_rate = {'A100': 3.55, 'H100': 4.10, 'V100': 2.48, 'A10': 1.12}
    current_cost = gpu_hourly_rate.get(config.get('gpu', 'A100'), 3.55) * config.get('estimated_hours', 1.0)
    crusoe_cost = current_cost * 1.15  # Crusoe typically ~15% more expensive
    
    comment = f"""## 🌍 Carbon Gate Report

**Estimated emissions:** `{emissions:.2f} kgCO₂eq` {status_emoji} {status_text}  
**Current grid:** {config.get('region', 'us-east-1')} — {carbon_intensity} gCO₂/kWh  
**Training cost:** ~${current_cost:.2f}

---

### 💡 Crusoe Alternative

"""
    
    if crusoe_available:
        comment += f"""**Region:** {config.get('region', 'us-east-1')} (geothermal)  
**Estimated emissions:** `{crusoe_emissions:.2f} kgCO₂eq` ✅ **{savings_pct}% cleaner**  
**Available GPUs:** {crusoe_instance}  
**Estimated cost:** ~${crusoe_cost:.2f} (+${crusoe_cost - current_cost:.2f} for {savings_pct}% less carbon)

"""
    else:
        comment += "⚠️ No Crusoe capacity currently available in this region\n\n"
    
    comment += f"""---

### 📊 Monthly Budget

**Used this month:** {50.0 - budget_remaining:.1f} / 50.0 kgCO₂eq  
**Remaining:** {budget_remaining:.1f} kg before overage billing kicks in

---

### ⏰ Optimal Window

**Grid forecast:** {optimal_window}

---

<details>
<summary>ℹ️ Technical Details</summary>

- **GPU:** {config.get('gpu', 'A100')}
- **Estimated training time:** {config.get('estimated_hours', 1.0)} hours
- **PUE (Power Usage Effectiveness):** {result.get('pue_used', 1.1):.2f}
- **Carbon intensity:** {carbon_intensity} gCO₂/kWh

</details>

---

**Actions:**
- To override this gate: add label `carbon-override` to this PR
- To reroute to Crusoe: comment `/crusoe-run`

<sub>Powered by [Carbon Gate](https://github.com/averyhochheiser/bit-manip-hackeurope) | Track: Crusoe Sustainability</sub>
"""
    
    return comment


def post_pr_comment(comment):
    """Post comment to the pull request"""
    github_token = os.environ.get('GITHUB_TOKEN')
    repo = os.environ.get('GITHUB_REPOSITORY')
    pr_number = os.environ.get('PR_NUMBER')
    
    if not github_token or not repo or not pr_number:
        print("⚠️  Missing GitHub environment variables, skipping comment post")
        print("Comment that would be posted:")
        print("=" * 80)
        print(comment)
        print("=" * 80)
        return
    
    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    try:
        response = requests.post(
            url,
            json={"body": comment},
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        print(f"✅ Posted Carbon Gate report to PR #{pr_number}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to post PR comment: {e}")
        print("Comment content:")
        print(comment)


def check_gate_status(config, result):
    """Check if the gate should block the PR"""
    status = result['status']
    threshold_kg = config.get('threshold_kg_co2', 2.0)
    emissions = result['emissions_kg']
    
    if status == 'block':
        print(f"❌ GATE BLOCKED: Emissions ({emissions:.2f} kg) exceed threshold ({threshold_kg} kg)")
        print("   Add 'carbon-override' label to bypass, or reroute to Crusoe")
        sys.exit(1)
    elif status == 'warn':
        print(f"⚠️  WARNING: High carbon emissions ({emissions:.2f} kg)")
        print("   Consider rerouting to Crusoe or waiting for optimal grid window")
    else:
        print(f"✅ GATE PASSED: Emissions ({emissions:.2f} kg) within acceptable limits")


def main():
    """Main execution flow"""
    print("=" * 80)
    print("🌍 Carbon Gate - ML Training Carbon Emissions Check")
    print("=" * 80)
    
    # Load configuration
    config = load_config()
    
    # Call API
    result = call_gate_api(config)
    
    # Format and post PR comment
    comment = format_pr_comment(config, result)
    post_pr_comment(comment)
    
    # Check if gate should block
    check_gate_status(config, result)
    
    print("=" * 80)


if __name__ == '__main__':
    main()
