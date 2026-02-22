#!/usr/bin/env python3
"""
Carbon Gate - GitHub Action Script
Reads carbon-gate.yml config, calls API, and posts PR comment
"""

import os
import re
import sys
import base64
import yaml
import requests
import json
import re
import hmac as _hmac_module
import hashlib
import time
from urllib.parse import quote as _url_quote
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

# Full physics-based carbon calculator (Carnot PUE, thermal throttling ODE,
# Fourier grid forecasting, embodied carbon LCA, uncertainty propagation)
try:
    from calculations import estimate_emissions as _estimate_emissions_full
    from calculations import _REGION_BASELINE, _REGION_RANGE
    FULL_CALC_AVAILABLE = True
except ImportError:
    FULL_CALC_AVAILABLE = False

# Output mode: 'text' for terminal, 'json' for web apps
OUTPUT_MODE = os.environ.get("OUTPUT_MODE", "text").lower()

# Set by the carbon-gate-apply workflow when a user comments /apply-crusoe-patch
APPLY_PATCH_REQUESTED = os.environ.get("APPLY_PATCH_REQUESTED", "false").lower() == "true"


def output(message: str, level: str = "info", data: Optional[Dict] = None):
    """Unified output function that can switch between text and JSON modes"""
    if OUTPUT_MODE == "json":
        print(
            json.dumps(
                {
                    "level": level,
                    "message": message,
                    "data": data or {},
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
        )
    else:
        # Text mode (terminal)
        prefix = {
            "error": "[ERROR]",
            "warn": "[WARN]",
            "info": "[INFO]",
            "success": "[OK]",
            "debug": "[DEBUG]",
        }.get(level, "[INFO]")
        print(f"{prefix} {message}")
        if data and level == "debug":
            for key, value in data.items():
                print(f"  {key}: {value}")


def get_pr_diff(max_chars_per_file: int = 3000) -> Optional[str]:
    """
    Fetch changed Python files from the PR.

    Returns a string with two sections per file:
      1. The unified diff (so the LLM understands what changed).
      2. The **full current source** fetched via the Git Blobs API
         (so the LLM can quote verbatim lines for the <carbon_patch> <old> block).
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    if not github_token or not repo or not pr_number:
        return None

    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/files"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        files = response.json()

        python_files = [f for f in files if f.get("filename", "").endswith(".py")]
        if not python_files:
            return None

        diff_parts = []
        total_chars = 0
        for f in python_files[:10]:  # cap at 10 files
            filename = f["filename"]
            patch = f.get("patch", "")
            blob_sha = f.get("sha", "")
            if not patch:
                continue

            snippet = patch[:max_chars_per_file]
            section = f"### {filename}\n```diff\n{snippet}\n```"

            # Fetch the actual file source via the Git Blobs API so the LLM
            # can generate a verbatim <old> block (the diff format with +/- prefixes
            # cannot be used directly for string-replacement matching).
            if blob_sha:
                try:
                    blob_resp = requests.get(
                        f"https://api.github.com/repos/{repo}/git/blobs/{blob_sha}",
                        headers=headers,
                        timeout=10,
                    )
                    if blob_resp.ok:
                        blob_data = blob_resp.json()
                        raw = blob_data.get("content", "")
                        encoding = blob_data.get("encoding", "base64")
                        if encoding == "base64":
                            file_src = base64.b64decode(
                                raw.replace("\n", "").encode()
                            ).decode("utf-8", errors="replace")
                        else:
                            file_src = raw
                        # Truncate long files — keep first 3 000 chars of source
                        src_preview = file_src[:3000]
                        section += (
                            f"\n\n**Current source of `{filename}`"
                            f" (quote these lines verbatim in `<old>`):**\n"
                            f"```python\n{src_preview}\n```"
                        )
                        total_chars += len(src_preview)
                except Exception as e:
                    output(f"Could not fetch blob for {filename}: {e}", "warn")

            diff_parts.append(section)
            total_chars += len(snippet)
            if total_chars >= 12000:
                break

        return "\n\n".join(diff_parts) if diff_parts else None
    except requests.exceptions.RequestException as e:
        output(f"Could not fetch PR diff: {e}", "warn")
        return None


def get_pr_file_contents() -> Optional[dict]:
    """Fetch full content of changed Python files from the PR."""
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    if not github_token or not repo or not pr_number:
        return None

    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/files"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        files = response.json()

        python_files = [f for f in files if f.get("filename", "").endswith(".py")]
        if not python_files:
            return None

        file_contents = {}
        for f in python_files:
            filename = f["filename"]
            # Fetch raw content
            raw_url = f.get("raw_url")
            if raw_url:
                content_response = requests.get(raw_url, headers=headers, timeout=10)
                if content_response.ok:
                    file_contents[filename] = content_response.text

        return file_contents if file_contents else None
    except requests.exceptions.RequestException as e:
        output(f"Could not fetch PR file contents: {e}", "warn")
        return None


CRUSOE_API_BASE = "https://hackeurope.crusoecloud.com/v1"
CRUSOE_MODEL = "NVFP4/Qwen3-235B-A22B-Instruct-2507-FP4"

# ── Local carbon calculator (mirrors lib/carbon/calculator.ts) ──────────────

GPU_TDP_W = {
    "H100": 700, "A100": 400, "V100": 300,
    "A10": 150, "A10G": 150, "T4": 70, "L40": 300,
}

GPU_EMBODIED_KG = {
    "H100": 250, "A100": 150, "V100": 120,
    "A10": 80, "A10G": 80, "T4": 50, "L40": 120,
}

GPU_LIFETIME_H = 5 * 365 * 24 * 0.5  # ~21,900 h at 50% utilisation

CRUSOE_INTENSITY_G_PER_KWH = 5  # Crusoe geothermal/solar grid

# Region -> average grid carbon intensity (gCO2/kWh) - 2024 estimates
REGION_CARBON_INTENSITY = {
    "us-east-1": 380,    # Virginia
    "us-east-2": 440,    # Ohio
    "us-west-1": 210,    # N. California
    "us-west-2": 280,    # Oregon
    "eu-west-1": 300,    # Ireland
    "eu-west-2": 230,    # London
    "eu-west-3": 55,     # Paris (nuclear)
    "eu-central-1": 340, # Frankfurt
    "eu-north-1": 25,    # Stockholm (hydro)
    "ap-northeast-1": 480, # Tokyo
    "ap-south-1": 640,   # Mumbai
}


def calculate_emissions_local(gpu: str, hours: float, region: str, config: dict = None) -> dict:
    """
    Calculate carbon emissions using the full physics pipeline from calculations.py.

    When the hosted API is unreachable, this runs the same thermodynamic models locally:
    - Carnot-cycle PUE derived from ambient temperature (not a flat assumption)
    - GPU thermal throttling via coupled ODE (scipy RK45)
    - Embodied carbon amortised over GPU lifecycle (Gupta et al. 2022 LCA data)
    - Uncertainty propagation (±σ) through the full calculation chain
    - WattTime marginal intensity when credentials are available

    Falls back to a simplified model if numpy/scipy aren't installed.
    """
    if FULL_CALC_AVAILABLE:
        import numpy as np
        np.random.seed(42)
        t = np.arange(168)
        base = _REGION_BASELINE.get(region, 200.0)
        rng = _REGION_RANGE.get(region, 250.0)
        history = (
            base + rng * 0.4
            + rng * 0.3 * np.sin(2 * np.pi * t / 24)
            + rng * 0.1 * np.sin(2 * np.pi * t / 168)
            + np.random.normal(0, rng * 0.05, len(t))
        ).tolist()

        carbon_intensity = base + rng * 0.4

        r = _estimate_emissions_full(
            gpu=gpu,
            hours=hours,
            region=region,
            ambient_temp_c=20.0,
            carbon_intensity=carbon_intensity,
            intensity_history=history,
            monthly_budget_kg=50.0,
            monthly_used_kg=0.0,
            previous_emissions_kg=None,
            is_crusoe=False,
            crusoe_available=True,
            model_params_billions=7.0,
            queries_per_day=10_000.0,
            deployment_months=12.0,
        )

        gate = r.get("gate", {})
        return {
            "emissions_kg": r["emissions_kg"],
            "emissions_sigma": r.get("emissions_sigma", 0),
            "crusoe_emissions_kg": r["crusoe_emissions_kg"],
            "budget_remaining_kg": 50.0,
            "status": "pass",
            "optimal_window": _format_optimal_window(r),
            "crusoe_available": True,
            "crusoe_instance": f"{gpu.lower()}-1x",
            "carbon_intensity": r["carbon_intensity"],
            "pue_used": r["pue_used"],
            "pue_sigma": r.get("pue_sigma", 0),
            "throttle_adjustment_pct": r.get("throttle_adjustment_pct", 0),
            "operational_kg": r.get("operational_kg", 0),
            "embodied_kg": r.get("embodied_kg", 0),
            "lifecycle_kg": r.get("lifecycle_kg", 0),
            "intensity_sigma": r.get("intensity_sigma", 0),
            "intensity_source": r.get("intensity_source", "fallback"),
            "volatility_score": r.get("volatility_score", 0),
            "radiative_forcing_w_m2": r.get("radiative_forcing_w_m2", 0),
            "forecast_meta": r.get("forecast_meta", {}),
            "resolution_options": r.get("resolution_options", []),
            "carbon_diff": r.get("carbon_diff", {}),
            "energy_kwh": r.get("operational_kg", 0) / (r["carbon_intensity"] / 1000) if r["carbon_intensity"] > 0 else 0,
        }
    else:
        tdp_w = GPU_TDP_W.get(gpu, GPU_TDP_W.get("A100", 400))
        embodied_kg_val = GPU_EMBODIED_KG.get(gpu, GPU_EMBODIED_KG.get("A100", 150))
        carbon_intensity = REGION_CARBON_INTENSITY.get(region, 380)
        pue = min(2.0, 1.10 + max(0, (20 - 15) * 0.005))
        energy_kwh = (tdp_w / 1000) * hours * pue
        op_kg = (energy_kwh * carbon_intensity) / 1000
        emb_kg = (embodied_kg_val / GPU_LIFETIME_H) * hours
        emissions = round(op_kg + emb_kg, 2)
        crusoe_emissions = round((energy_kwh * CRUSOE_INTENSITY_G_PER_KWH / 1000) + emb_kg, 2)

        return {
            "emissions_kg": emissions,
            "emissions_sigma": round(emissions * 0.15, 2),
            "crusoe_emissions_kg": crusoe_emissions,
            "budget_remaining_kg": 50.0,
            "status": "pass",
            "optimal_window": "Schedule during off-peak hours (early morning local time) for lower grid intensity",
            "crusoe_available": True,
            "crusoe_instance": f"{gpu.lower()}-1x",
            "carbon_intensity": carbon_intensity,
            "pue_used": round(pue, 2),
            "pue_sigma": 0.02,
            "throttle_adjustment_pct": 0,
            "operational_kg": round(op_kg, 4),
            "embodied_kg": round(emb_kg, 4),
            "lifecycle_kg": 0,
            "intensity_sigma": round(carbon_intensity * 0.1, 2),
            "intensity_source": "regional_baseline",
            "volatility_score": 0,
            "radiative_forcing_w_m2": 0,
            "forecast_meta": {},
            "resolution_options": [],
            "carbon_diff": {},
            "energy_kwh": round(energy_kwh, 2),
        }


def _format_optimal_window(r: dict) -> str:
    """Format the optimal window forecast into a human-readable string."""
    wait = r.get("optimal_window_hours", 0)
    conf = r.get("optimal_window_confidence", 0)
    save = r.get("carbon_savings_pct", 0)
    meta = r.get("forecast_meta", {})
    source = meta.get("source", "unknown")
    conf_label = meta.get("confidence_label", "unknown")

    if wait <= 0 or save < 2:
        return "Current window is near-optimal — no significant savings from waiting"

    source_note = "WattTime MOER forecast" if "watttime" in source else "Fourier harmonic model"
    return (
        f"Wait ~{wait:.0f}h for {save:.0f}% lower carbon intensity "
        f"(confidence: {conf_label}, source: {source_note})"
    )




def get_static_suggestions(config: dict) -> str:
    """
    Return hardcoded carbon-efficiency tips based on job config.
    Fallback when CRUSOE_API_KEY is absent or the API call fails.
    """
    gpu = config.get("gpu", "A100")
    hours = config.get("estimated_hours", 1.0)

    tips = [
        (
            "**Enable mixed-precision training**",
            "Wrap your training loop with `torch.autocast('cuda')`. "
            "This typically halves GPU memory and speeds up compute by 1.5–3×, "
            "directly cutting energy consumption.\n\n"
            "```python\n"
            "from torch.cuda.amp import autocast, GradScaler\n"
            "scaler = GradScaler()\n"
            "with autocast():\n"
            "    loss = model(batch)\n"
            "scaler.scale(loss).backward()\n"
            "scaler.step(optimizer)\n"
            "scaler.update()\n"
            "```",
        ),
        (
            "**Add early stopping**",
            f"With {hours:.0f}h estimated runtime on {gpu}, training to completion "
            "wastes compute if validation loss has plateaued. "
            "Add patience-based early stopping (patience=3–5 epochs).",
        ),
        (
            "**Optimise data loading**",
            "Use `num_workers >= 4` and `pin_memory=True` on your DataLoader:\n\n"
            "```python\n"
            "DataLoader(ds, batch_size=64, num_workers=4, pin_memory=True, prefetch_factor=2)\n"
            "```",
        ),
        (
            "**Enable gradient checkpointing**",
            "Allows larger batches and reduces total training time:\n\n"
            "```python\n"
            "model.gradient_checkpointing_enable()  # HuggingFace\n"
            "# or: torch.utils.checkpoint.checkpoint(module, *inputs)\n"
            "```",
        ),
    ]

    return "\n\n".join(
        f"{i}. {title}  \n   {body}" for i, (title, body) in enumerate(tips, 1)
    )

def call_crusoe_for_suggestions(file_contents: dict, config: dict) -> tuple:
    """
    Send PR file contents to Crusoe AI.
    Returns (suggestions_markdown, unified_diff_patch) or (None, None).
    """
    crusoe_api_key = os.environ.get("CRUSOE_API_KEY", "").strip()

    gpu = config.get("gpu", "A100")
    estimated_hours = config.get("estimated_hours", 1.0)

    # Build file listing
    files_section = ""
    for filename, content in file_contents.items():
        files_section += f"\n### {filename}\n```python\n{content}\n```\n"

    prompt = f"""You are a carbon-efficiency expert reviewing ML training code.

The training job runs on **{gpu}** GPUs for ~**{estimated_hours} h**.

Analyse ALL the Python files below. Provide:
1. Every actionable suggestion to reduce compute time and energy usage.
2. A complete unified diff (git patch) that implements ALL your suggestions.

Focus on:
- Missing mixed-precision (torch.autocast / GradScaler)
- Missing gradient checkpointing
- Inefficient data loading (num_workers=0, no pin_memory, no prefetch)
- Suboptimal batch size / learning-rate schedule
- Unnecessary CPU-GPU transfers or .item() inside loops
- No early stopping when validation loss plateaus
- Redundant forward/backward passes
- Model over-parameterisation

**Output format — follow EXACTLY:**

## Suggestions

(numbered list of every suggestion, with explanation)

## Patch

```diff
(unified diff that can be applied with `git apply`)
(use --- a/path and +++ b/path headers)
(include all changes across all files)
```

Be thorough. Do not limit yourself.

## Files
{files_section}
"""

    try:
        response = requests.post(
            f"{CRUSOE_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {crusoe_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": CRUSOE_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4096,
                "temperature": 0.3,
            },
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        raw = data["choices"][0]["message"]["content"].strip()

        # Split into suggestions and patch
        suggestions = None
        patch = None

        # Extract suggestions section
        sug_match = re.search(r'## Suggestions\s*\n(.*?)(?=## Patch|$)', raw, re.DOTALL)
        if sug_match:
            suggestions = sug_match.group(1).strip()

        # Extract patch from code fence
        patch_match = re.search(r'```diff\n(.*?)```', raw, re.DOTALL)
        if patch_match:
            candidate = patch_match.group(1).strip()
            if '--- a/' in candidate:
                patch = candidate
            else:
                output("Patch block found but doesn't look like a unified diff", "warn")

        if not suggestions:
            # fallback: return the whole response as suggestions
            suggestions = raw

        return suggestions, patch
    except Exception as e:
        output(f"Crusoe AI call failed: {e}", "warn")
        return None, None



def apply_patch_to_pr(patch: str) -> bool:
    """
    Apply a unified diff patch to the PR branch by committing changed files
    via the GitHub API (no local git needed).
    Returns True if all files were committed successfully.
    """
    import base64

    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    if not github_token or not repo or not pr_number:
        output("Missing env vars for patch apply", "warn")
        return False

    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    # Get the PR branch ref
    pr_url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
    pr_resp = requests.get(pr_url, headers=headers, timeout=10)
    if not pr_resp.ok:
        output(f"Could not fetch PR info: {pr_resp.status_code}", "warn")
        return False
    pr_data = pr_resp.json()
    branch = pr_data["head"]["ref"]
    head_sha = pr_data["head"]["sha"]

    # Parse patch into per-file changes
    # We need the original files to apply the patch, so fetch them first
    file_contents = get_pr_file_contents()
    if not file_contents:
        output("Could not fetch file contents for patch apply", "warn")
        return False

    # Apply the patch using a simple line-based approach
    # Parse the unified diff
    current_file = None
    file_patches = {}  # filename -> list of (old_start, old_lines, new_lines)
    current_old_lines = []
    current_new_lines = []

    for line in patch.split("\n"):
        if line.startswith("--- a/"):
            pass  # old file header
        elif line.startswith("+++ b/"):
            current_file = line[6:]
            if current_file not in file_patches:
                file_patches[current_file] = []
        elif line.startswith("@@"):
            # hunk header
            pass
        elif current_file:
            if not line.startswith("---") and not line.startswith("+++"):
                pass  # we'll use the simpler approach below

    # Simpler approach: ask Crusoe for full file content, then commit those
    # Actually, we have the patch — let's apply it with subprocess if available
    import subprocess
    import tempfile

    applied_files = {}
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # Write original files
            for filename, content in file_contents.items():
                filepath = os.path.join(tmpdir, filename)
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                with open(filepath, 'w') as f:
                    f.write(content)

            # Write patch file
            patch_path = os.path.join(tmpdir, 'efficiency.patch')
            with open(patch_path, 'w') as f:
                f.write(patch)

            # Try to apply
            result = subprocess.run(
                ['git', 'apply', '--stat', patch_path],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=10,
            )
            output(f"Patch stats: {result.stdout.strip()}", "debug")

            # Actually apply
            result = subprocess.run(
                ['git', 'apply', '--no-index', patch_path],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode != 0:
                output(f"git apply failed: {result.stderr}", "warn")
                return False

            # Read back the modified files
            for filename in file_contents:
                filepath = os.path.join(tmpdir, filename)
                if os.path.exists(filepath):
                    with open(filepath, 'r') as f:
                        new_content = f.read()
                    if new_content != file_contents[filename]:
                        applied_files[filename] = new_content
    except Exception as e:
        output(f"Patch apply failed: {e}", "warn")
        return False

    if not applied_files:
        output("Patch applied but no files changed", "warn")
        return False

    # Commit each changed file via GitHub API
    committed = 0
    latest_sha = head_sha

    for filename, new_content in applied_files.items():
        # Get current file SHA
        file_url = f"https://api.github.com/repos/{repo}/contents/{filename}?ref={branch}"
        file_resp = requests.get(file_url, headers=headers, timeout=10)
        if not file_resp.ok:
            output(f"Could not get file SHA for {filename}: {file_resp.status_code}", "warn")
            continue
        file_sha = file_resp.json()["sha"]

        # Update the file
        encoded = base64.b64encode(new_content.encode('utf-8')).decode('ascii')
        update_url = f"https://api.github.com/repos/{repo}/contents/{filename}"
        update_resp = requests.put(
            update_url,
            headers=headers,
            json={
                "message": f"\u26a1 Carbon Gate: apply efficiency patch to {filename}",
                "content": encoded,
                "sha": file_sha,
                "branch": branch,
            },
            timeout=15,
        )
        if update_resp.ok:
            committed += 1
            output(f"Committed optimized {filename} to {branch}", "success")
        else:
            output(f"Failed to commit {filename}: {update_resp.status_code} {update_resp.text[:200]}", "warn")

    output(f"Applied efficiency patch: {committed}/{len(applied_files)} files committed to {branch}", "info")
    return committed > 0


def _post_reply(message: str):
    """Post a comment to the PR (used for apply-patch mode responses)."""
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    if not github_token or not repo or not pr_number:
        output("Missing env vars for reply comment", "warn")
        return

    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }
    try:
        resp = requests.post(url, json={"body": message}, headers=headers, timeout=10)
        resp.raise_for_status()
        output("Posted reply comment", "success")
    except requests.exceptions.RequestException as e:
        output(f"Failed to post reply: {e}", "warn")


def run_patch_apply_mode(config: dict):
    """
    Apply the Crusoe AI optimization patch in response to a /apply-crusoe-patch comment.
    Generates the patch fresh from Crusoe and commits it to the PR branch.
    """
    pr_number = os.environ.get("PR_NUMBER")
    output(f"Patch apply mode for PR #{pr_number}", "info")

    file_contents = get_pr_file_contents()
    if not file_contents:
        _post_reply("❌ No Python files found in this PR — nothing to patch.")
        return

    output("Generating Crusoe AI optimizations...", "info")
    suggestions, patch = call_crusoe_for_suggestions(file_contents, config)

    if not patch:
        if suggestions:
            _post_reply(
                "⚠️ Crusoe generated suggestions but no auto-applicable patch was found. "
                "Please apply manually:\n\n<details>\n<summary>Suggestions</summary>\n\n"
                f"{suggestions}\n\n</details>"
            )
        else:
            _post_reply("❌ Could not generate a patch. Please try again or apply suggestions manually.")
        return

    output(f"Applying patch ({len(patch)} chars)...", "info")
    applied = apply_patch_to_pr(patch)

    if applied:
        why_block = f"\n\n**What was changed and why:**\n\n{suggestions}\n" if suggestions else ""
        _post_reply(
            "⚡ **Crusoe efficiency patch applied!**\n\n"
            "Optimized code has been committed to this branch. "
            "Re-run or push a new commit to verify reduced emissions."
            f"{why_block}\n"
            "<details>\n<summary>View diff</summary>\n\n"
            f"```diff\n{patch}\n```\n\n</details>"
        )
        output("Efficiency patch committed to PR branch", "success")
    else:
        _post_reply(
            "⚠️ Could not auto-apply the patch. Please apply manually:\n\n"
            "```bash\n# Save the patch below to efficiency.patch, then:\ngit apply efficiency.patch\n```\n\n"
            f"<details>\n<summary>Patch</summary>\n\n```diff\n{patch}\n```\n\n</details>"
        )


# ── Auto-apply helpers ────────────────────────────────────────────────────────


def parse_carbon_patch(text: str) -> Optional[Dict[str, str]]:
    """
    Extract the <carbon_patch> block from the LLM response.
    Returns {file, old, new} or None.
    """
    m = re.search(
        r"<carbon_patch>\s*"
        r"<file>\s*(.+?)\s*</file>\s*"
        r"<old>\s*\n(.*?)\n\s*</old>\s*"
        r"<new>\s*\n(.*?)\n\s*</new>\s*"
        r"</carbon_patch>",
        text,
        re.DOTALL,
    )
    if not m:
        return None
    # Strip leading/trailing newlines only — preserves meaningful indentation
    # inside the block while preventing spurious whitespace mismatches.
    return {
        "file": m.group(1).strip(),
        "old": m.group(2).strip("\n"),
        "new": m.group(3).strip("\n"),
    }


def strip_carbon_patch(text: str) -> str:
    """Remove the machine-readable patch block before posting human-visible comment."""
    return re.sub(
        r"\s*<carbon_patch>.*?</carbon_patch>\s*", "\n", text, flags=re.DOTALL
    ).strip()


def get_pr_branch() -> Optional[str]:
    """
    Return the head branch name for the current PR.

    Returns None (disabling auto-apply) when:
      - environment variables are missing
      - the PR comes from a fork (GITHUB_TOKEN cannot push to fork repos)
      - the API call fails
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")
    if not github_token or not repo or not pr_number:
        return None
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }
    try:
        r = requests.get(url, headers=headers, timeout=10)
        r.raise_for_status()
        data = r.json()

        # Detect fork PRs — GITHUB_TOKEN cannot write to a contributor's fork.
        head_full = (data.get("head", {}).get("repo") or {}).get("full_name", "")
        base_full = (data.get("base", {}).get("repo") or {}).get("full_name", "")
        if head_full and base_full and head_full != base_full:
            output(
                f"auto-apply: PR is from a fork ({head_full}) — skipping auto-apply "
                "(GITHUB_TOKEN cannot push to fork branches). "
                "Suggestions will still be posted as a comment.",
                "warn",
            )
            return None

        return data["head"]["ref"]
    except Exception as e:
        output(f"Could not fetch PR branch: {e}", "warn")
        return None


def apply_patch_to_pr(
    file_path: str, old_code: str, new_code: str, branch: str
) -> bool:
    """
    Apply a text replacement to a file on the PR branch using the GitHub
    Contents API, committing the result directly.

    Returns True on success, False on any failure (so callers can fall back
    gracefully to just posting the suggestion as a comment).
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not github_token or not repo:
        return False

    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    # 1. Fetch current file content + SHA
    url = f"https://api.github.com/repos/{repo}/contents/{file_path}"
    try:
        r = requests.get(url, params={"ref": branch}, headers=headers, timeout=15)
        r.raise_for_status()
        payload = r.json()
        current_content = base64.b64decode(payload["content"].replace("\n", "")).decode("utf-8")
        sha = payload["sha"]
    except Exception as e:
        output(f"auto-apply: could not fetch {file_path}: {e}", "warn")
        return False

    # 2. Verify old code is present verbatim
    if old_code not in current_content:
        output(
            f"auto-apply: patch target not found verbatim in {file_path} — skipping",
            "warn",
        )
        return False

    # 3. Apply replacement
    new_content = current_content.replace(old_code, new_code, 1)
    if new_content == current_content:
        output(f"auto-apply: replacement produced no change in {file_path}", "warn")
        return False

    # 4. Commit back to the PR branch
    encoded = base64.b64encode(new_content.encode("utf-8")).decode("ascii")
    pr_number = os.environ.get("PR_NUMBER", "?")
    try:
        put_r = requests.put(
            url,
            headers=headers,
            json={
                "message": f"chore(carbon-gate): auto-apply efficiency patch [PR #{pr_number}]",
                "content": encoded,
                "sha": sha,
                "branch": branch,
            },
            timeout=20,
        )
        put_r.raise_for_status()
        output(f"auto-apply: committed optimised {file_path} to {branch}", "success")
        return True
    except Exception as e:
        output(f"auto-apply: commit failed for {file_path}: {e}", "warn")
        return False


def try_auto_apply(suggestions_text: str) -> bool:
    """
    Parse the LLM response for a <carbon_patch> block and, if found,
    apply it to the PR branch.

    Returns True if a patch was successfully committed.
    """
    patch = parse_carbon_patch(suggestions_text)
    if not patch:
        output("No auto-apply patch found in Crusoe response", "info")
        return False

    branch = get_pr_branch()
    if not branch:
        output("auto-apply: could not determine PR branch", "warn")
        return False

    output(
        f"auto-apply: attempting patch on {patch['file']} (branch: {branch})", "info"
    )
    return apply_patch_to_pr(patch["file"], patch["old"], patch["new"], branch)


def load_config():
    """Load carbon-gate.yml from repository root"""
    config_path = Path("carbon-gate.yml")

    if not config_path.exists():
        output("carbon-gate.yml not found in repository root", "error")
        output("Please create a carbon-gate.yml file. See README for format.", "info")
        sys.exit(1)

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    if "carbon-gate" not in config:
        output(
            "Invalid carbon-gate.yml format. Missing 'carbon-gate' root key.", "error"
        )
        sys.exit(1)

    return config["carbon-gate"]


def check_user_permission(username: str) -> str:
    """
    Check GitHub user's permission level on the repository.
    Returns: 'admin', 'maintain', 'write', 'read', or 'none'
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")

    if not github_token or not repo or not username:
        return "none"

    url = f"https://api.github.com/repos/{repo}/collaborators/{username}/permission"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get("permission", "none")
    except requests.exceptions.RequestException as e:
        output(f"Could not verify user permissions: {e}", "warn")
        return "none"


def check_user_teams(username: str, allowed_teams: list) -> bool:
    """
    Check if user is a member of any allowed teams.
    Returns: True if user is in an allowed team, False otherwise
    """
    if not allowed_teams:
        return False

    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")

    if not github_token or not repo or not username:
        return False

    # Extract org from repo (owner/repo format)
    org = repo.split("/")[0]

    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    try:
        # Get user's teams in the org
        url = f"https://api.github.com/orgs/{org}/teams"
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        teams = response.json()

        # Check each allowed team
        for team in teams:
            if team["name"] in allowed_teams or team["slug"] in allowed_teams:
                # Check if user is a member of this team
                team_slug = team["slug"]
                member_url = f"https://api.github.com/orgs/{org}/teams/{team_slug}/memberships/{username}"
                member_response = requests.get(member_url, headers=headers, timeout=10)

                if member_response.status_code == 200:
                    membership = member_response.json()
                    if membership.get("state") == "active":
                        return True

        return False

    except requests.exceptions.RequestException as e:
        print(f"⚠️  Could not verify team membership: {e}")
        return False


def has_permission_to_override(username: str, config: dict) -> tuple[bool, str]:
    """
    Check if user has permission to override based on config.
    Returns: (allowed: bool, reason: str)
    """
    security_config = config.get("security", {})
    required_permission = security_config.get("override_permission", "admin")
    allowed_teams = security_config.get("allowed_teams", [])

    # Check permission level
    user_permission = check_user_permission(username)

    # Define permission hierarchy
    permission_levels = {"admin": 4, "maintain": 3, "write": 2, "read": 1, "none": 0}
    required_level = permission_levels.get(required_permission, 4)
    user_level = permission_levels.get(user_permission, 0)

    # Check if user meets permission requirement
    if user_level >= required_level:
        return True, f"@{username} has {user_permission} permissions"

    # Check if user is in an allowed team
    if allowed_teams and check_user_teams(username, allowed_teams):
        return True, f"@{username} is member of authorized team"

    # Permission denied
    return (
        False,
        f"@{username} has {user_permission} permissions (requires {required_permission})",
    )


def extract_justification(text: str, command: str) -> Optional[str]:
    """
    Extract justification text from a comment or label.
    Expected format: '/crusoe-run: reason here' or after the command
    """
    if not text or command not in text:
        return None

    # Find text after the command
    parts = text.split(command, 1)
    if len(parts) < 2:
        return None

    justification = parts[1].strip()
    # Remove leading colon or dash if present
    justification = justification.lstrip(":-").strip()

    if (
        justification and len(justification) >= 10
    ):  # Minimum 10 chars for valid justification
        return justification

    return None


def check_override_label(config: dict) -> Optional[Dict[str, Any]]:
    """
    Check if PR has 'carbon-override' label and verify the user who added it.
    Returns: {'allowed': bool, 'user': str, 'reason': str, 'justification': str} or None
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    if not github_token or not repo or not pr_number:
        return None

    security_config = config.get("security", {})
    require_justification = security_config.get("require_justification", True)

    # Check if label exists
    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        pr_data = response.json()

        labels = [label["name"] for label in pr_data.get("labels", [])]

        if "carbon-override" not in labels:
            return None

        # Label exists - check who added it and look for justification in comments
        events_url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/events"
        events_response = requests.get(events_url, headers=headers, timeout=10)
        events_response.raise_for_status()
        events = events_response.json()

        # Find who added the carbon-override label
        user = None
        label_timestamp = None
        for event in reversed(events):
            if (
                event.get("event") == "labeled"
                and event.get("label", {}).get("name") == "carbon-override"
            ):
                user = event.get("actor", {}).get("login")
                label_timestamp = event.get("created_at")
                break

        if not user:
            return {
                "allowed": False,
                "user": "unknown",
                "reason": "Security check failed: Could not verify who added the override label",
            }

        # Check permissions
        allowed, perm_reason = has_permission_to_override(user, config)

        if not allowed:
            return {
                "allowed": False,
                "user": user,
                "reason": f"Override request denied: {perm_reason}",
            }

        # Check for justification if required
        justification = None
        if require_justification:
            # Look for justification in comments near the label time
            comments_url = (
                f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
            )
            comments_response = requests.get(comments_url, headers=headers, timeout=10)
            comments_response.raise_for_status()
            comments = comments_response.json()

            # Find comments by the user around the time they added the label
            for comment in comments:
                if comment.get("user", {}).get("login") == user:
                    body = comment.get("body", "").lower()
                    # Look for override justification keywords
                    if any(
                        keyword in body
                        for keyword in ["override", "exception", "urgent", "critical"]
                    ):
                        justification = comment.get("body", "").strip()
                        break

            if not justification:
                return {
                    "allowed": False,
                    "user": user,
                    "reason": f"Override denied: {perm_reason}, but justification required. Please comment explaining why this override is necessary.",
                }

        # All checks passed
        return {
            "allowed": True,
            "user": user,
            "reason": f"Override authorized: {perm_reason}",
            "justification": justification or "Not provided",
        }

    except requests.exceptions.RequestException as e:
        print(f"Could not check override label: {e}")
        return None


def check_crusoe_reroute_command(config: dict) -> Optional[Dict[str, Any]]:
    """
    Check if someone commented '/crusoe-run' and verify their permissions.
    Returns: {'allowed': bool, 'user': str, 'reason': str, 'justification': str} or None
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    if not github_token or not repo or not pr_number:
        return None

    security_config = config.get("security", {})
    require_justification = security_config.get("require_justification", True)

    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        comments = response.json()

        # Check comments in reverse (most recent first)
        for comment in reversed(comments):
            body = comment.get("body", "").strip()

            if "/crusoe-run" in body.lower():
                user = comment.get("user", {}).get("login")

                if not user:
                    continue

                # Check permissions
                allowed, perm_reason = has_permission_to_override(user, config)

                if not allowed:
                    return {
                        "allowed": False,
                        "user": user,
                        "reason": f"Crusoe reroute denied: {perm_reason}",
                    }

                # Extract justification from comment
                justification = extract_justification(body, "/crusoe-run")

                if require_justification and not justification:
                    return {
                        "allowed": False,
                        "user": user,
                        "reason": f"Crusoe reroute denied: Justification required. Use format: `/crusoe-run: reason for rerouting`",
                    }

                # All checks passed
                return {
                    "allowed": True,
                    "user": user,
                    "reason": f"Crusoe reroute authorized: {perm_reason}",
                    "justification": justification or "Not provided",
                }

        return None

    except requests.exceptions.RequestException as e:
        output(f"Could not check override label: {e}", "warn")
        return None


def call_gate_api(config):
    """Call the Carbon Gate API to check emissions. Falls back to local calculation on failure."""
    api_endpoint = os.environ.get("API_ENDPOINT", "").strip() or "https://bit-manip-hackeurope.vercel.app"
    org_api_key = os.environ.get("ORG_API_KEY", "").strip()
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    gpu = config.get("gpu", "A100")
    hours = config.get("estimated_hours", 1.0)
    region = config.get("region", "us-east-1")

    if not pr_number:
        output("Not a pull request event, skipping Carbon Gate check", "info")
        sys.exit(0)

    output(
        f"Running Carbon Gate check for PR #{pr_number}",
        "info",
        {"gpu": gpu, "estimated_hours": hours, "region": region},
    )

    # Try the hosted API first (requires a valid org API key)
    if org_api_key:
        payload = {
            "repo": repo,
            "pr_number": int(pr_number),
            "gpu": gpu,
            "estimated_hours": hours,
            "region": region,
            "api_key": org_api_key,
        }
        try:
            response = requests.post(
                f"{api_endpoint}/api/gate/check",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            output("Emissions calculated via Carbon Gate API", "success")
            return data
        except requests.exceptions.RequestException as e:
            status_code = getattr(getattr(e, 'response', None), 'status_code', None)
            if status_code == 401:
                output("API authentication failed \u2014 check your CARBON_GATE_ORG_KEY secret", "warn")
            else:
                output(f"API call failed ({e}), calculating emissions locally", "warn")
    else:
        output("No ORG_API_KEY set \u2014 calculating emissions locally", "info")

    # Local fallback: compute real emissions using the same physics as the API
    result = calculate_emissions_local(gpu, hours, region)
    output(
        f"Local calculation: {result['emissions_kg']:.2f} kgCO\u2082eq "
        f"({gpu}, {hours}h, {region} @ {result['carbon_intensity']} gCO\u2082/kWh)",
        "info",
    )
    return result



def generate_sha_override_link(sha: str, pr_number: str) -> Optional[str]:
    """
    Generate a signed GET URL for the pay-to-override checkout endpoint.

    Requires OVERRIDE_SIGNING_SECRET env var (passed from the action input).
    The link is valid for 24 hours (matching the server-side CHECKOUT_WINDOW_MS).

    Canonical payload (keys sorted alphabetically — must match lib/hmac.ts):
        check=carbon&owner=<owner>&repo=<repo>&sha=<sha>&ts=<epoch_ms>
    """
    secret = os.environ.get("OVERRIDE_SIGNING_SECRET", "").strip()
    api_endpoint = os.environ.get("API_ENDPOINT", "https://bit-manip-hackeurope.vercel.app").rstrip("/")
    repo_full = os.environ.get("GITHUB_REPOSITORY", "")

    if not secret or not sha or not repo_full or "/" not in repo_full:
        return None

    owner, repo_name = repo_full.split("/", 1)
    ts = str(int(time.time() * 1000))  # epoch milliseconds
    check = "carbon"

    payload = f"check={check}&owner={owner}&repo={repo_name}&sha={sha}&ts={ts}"
    sig = _hmac_module.new(
        secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    return (
        f"{api_endpoint}/api/override/create-checkout"
        f"?owner={_url_quote(owner, safe='')}"
        f"&repo={_url_quote(repo_name, safe='')}"
        f"&sha={_url_quote(sha, safe='')}"
        f"&check={check}"
        f"&pr={_url_quote(str(pr_number), safe='')}"
        f"&ts={ts}&sig={sig}"
    )


def check_sha_paid_override() -> bool:
    """
    Check if the current commit SHA has a valid paid override via /api/override/valid.
    Returns True if a paid override exists and is still valid.
    """
    secret = os.environ.get("OVERRIDE_SIGNING_SECRET", "").strip()
    api_endpoint = os.environ.get("API_ENDPOINT", "https://bit-manip-hackeurope.vercel.app").rstrip("/")
    repo_full = os.environ.get("GITHUB_REPOSITORY", "")
    sha = os.environ.get("PR_SHA", "") or os.environ.get("GITHUB_SHA", "")

    if not secret or not sha or not repo_full or "/" not in repo_full:
        return False

    owner, repo_name = repo_full.split("/", 1)
    ts = str(int(time.time() * 1000))
    check = "carbon"

    payload = f"check={check}&owner={owner}&repo={repo_name}&sha={sha}&ts={ts}"
    sig = _hmac_module.new(
        secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    url = (
        f"{api_endpoint}/api/override/valid"
        f"?owner={_url_quote(owner, safe='')}"
        f"&repo={_url_quote(repo_name, safe='')}"
        f"&sha={_url_quote(sha, safe='')}"
        f"&check={check}"
        f"&ts={ts}"
    )

    try:
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {sig}"},
            timeout=10,
        )
        if resp.ok:
            data = resp.json()
            return bool(data.get("valid", False))
        return False
    except Exception as e:
        output(f"Paid override check failed: {e}", "warn")
        return False


def format_override_section(result):
    """Generate markdown for the pay-to-override section shown in blocked PRs."""
    pay_link = os.environ.get("PAY_OVERRIDE_URL", "").strip() or None

    if not pay_link:
        if not os.environ.get("OVERRIDE_SIGNING_SECRET", "").strip():
            output("OVERRIDE_SIGNING_SECRET is not set — pay-to-override link will not appear in PR comment", "warn")

    lines_out = []

    if pay_link:
        lines_out.append("")
        lines_out.append("---")
        lines_out.append("")
        lines_out.append("### 💳 Pay to Override")
        lines_out.append("")
        lines_out.append(f"> ### 👉 [Click here to pay and unblock this PR →]({pay_link})")
        lines_out.append("")
        lines_out.append("One-time payment. After paying, **re-run this check** and it will pass automatically.")
        lines_out.append("")
    else:
        lines_out.append("")
        lines_out.append("**To unblock:** ask a repo admin to add the `carbon-override` label, or apply the efficiency suggestions above.")
        lines_out.append("")

    return "
".join(lines_out)


def format_pr_comment(config, result, suggestions: Optional[str] = None, patch: Optional[str] = None, suggestions_ai_powered: bool = True):
    """Format the Carbon Gate report as a concise PR comment."""
    _GPU_TDP_REF = {"H100": 700, "A100": 400, "V100": 300, "A10": 150, "A10G": 150, "T4": 70, "L40": 300}
    emissions = result["emissions_kg"]
    crusoe_emissions = result["crusoe_emissions_kg"]
    status = result["status"]
    optimal_window = result.get("optimal_window", "")
    carbon_intensity = result.get("carbon_intensity", 0)

    threshold_kg = config.get("threshold_kg_co2", 2.0)
    warn_kg = config.get("warn_kg_co2", 1.0)

    api_endpoint = os.environ.get("API_ENDPOINT", "https://bit-manip-hackeurope.vercel.app")
    dashboard_url = f"{api_endpoint}/dashboard"

    # Pay link built in action.yml YAML expression and passed via env var
    pay_link = os.environ.get("PAY_OVERRIDE_URL", "").strip() or None
    output(f"Pay-to-override link: {pay_link}", "info")

    if status == "block":
        status_emoji = "🔴"
        status_label = "BLOCKED"
        limit_note = f"exceeds {threshold_kg} kg block threshold — merge blocked"
    elif status == "warn":
        status_emoji = "🟡"
        status_label = "WARNING"
        limit_note = f"above {warn_kg} kg warning threshold (block at {threshold_kg} kg)"
    else:
        status_emoji = "🟢"
        status_label = "PASSED"
        limit_note = f"within limits (warn: {warn_kg} kg, block: {threshold_kg} kg)"

    savings_pct = int(((emissions - crusoe_emissions) / emissions) * 100) if emissions > 0 else 0
    gpu_hourly_rate = {"A100": 3.55, "H100": 4.10, "V100": 2.48, "A10": 1.12}
    current_cost = gpu_hourly_rate.get(config.get("gpu", "A100"), 3.55) * config.get("estimated_hours", 1.0)
    crusoe_cost = current_cost * 1.15
    cost_diff_pct = ((crusoe_cost - current_cost) / current_cost) * 100

    repo = os.environ.get("GITHUB_REPOSITORY", "")

    # Header + Crusoe comparison table
    pay_cta = f"\n\n**Pay to override:** [Click here to pay and unblock this PR]({pay_link}) — after paying, re-run this check and it will pass." if (status == "block" and pay_link) else ""
    comment = f"""## {status_emoji} Carbon Gate — {status_label}

**{emissions:.2f} kgCO₂eq** — {limit_note}{pay_cta}

[View full report & repo stats →]({dashboard_url})

---

| | Current | Crusoe (Geothermal) | |
|--|---------|---------------------|--|
| **Emissions** | {emissions:.2f} kgCO₂eq | {crusoe_emissions:.2f} kgCO₂eq | **-{savings_pct}%** ✅ |
| **Energy** | Grid mix ({carbon_intensity} gCO₂/kWh) | 100% geothermal (5 gCO₂/kWh) | Clean |
| **Cost** | ${current_cost:.2f} | ${crusoe_cost:.2f} | +{cost_diff_pct:.0f}% |

"""

    # Crusoe AI CTA — no suggestions/patch shown here; explanation comes after /apply-crusoe-patch
    if suggestions:
        ai_note = "Crusoe Cloud geothermal inference (~5 gCO₂/kWh)" if suggestions_ai_powered else "static analysis"
        has_patch = bool(patch)

        suggestion_count = sum(
            1 for line in suggestions.splitlines()
            if line.strip() and line.strip()[0].isdigit() and ". " in line[:5]
        )
        count_str = f"{suggestion_count} optimization{'s' if suggestion_count != 1 else ''}" if suggestion_count else "optimizations"

        comment += f"""---

### 🧠 Crusoe AI: {count_str} found

> *Powered by [{ai_note}](https://crusoe.ai)*

Crusoe analyzed your code and found changes that could reduce compute time and emissions.
{'A ready-to-apply patch is available.' if has_patch else 'Manual suggestions are available.'}

**Comment below — Crusoe will apply the changes and explain what it did:**
```
/apply-crusoe-patch
```

"""

    # Technical details (collapsed)
    comment += f"""---

<details>
<summary>🔍 Technical details & methodology</summary>

| Parameter | Value | Source |
|-----------|-------|--------|
| GPU | {config.get('gpu', 'A100')} ({_GPU_TDP_REF.get(config.get('gpu', 'A100'), '?')}W TDP) | NVIDIA datasheet |
| Training time | {config.get('estimated_hours', 1.0)} h | carbon-gate.yml |
| PUE | {result.get('pue_used', 1.1):.4f} ± {result.get('pue_sigma', 0):.4f} | Carnot-cycle thermodynamic model |
| Thermal throttling | -{result.get('throttle_adjustment_pct', 0):.1f}% | Coupled ODE (scipy RK45) |
| Region | {config.get('region', 'us-east-1')} | carbon-gate.yml |
| Grid intensity | {carbon_intensity} ± {result.get('intensity_sigma', 0):.0f} gCO₂/kWh | {result.get('intensity_source', 'regional baseline').replace('_', ' ').title()} |
| Operational | {result.get('operational_kg', emissions * 0.95):.4f} kgCO₂eq | energy × intensity |
| Embodied | {result.get('embodied_kg', emissions * 0.05):.4f} kgCO₂eq | lifecycle amortisation (±30%) |
| Uncertainty | ± {result.get('emissions_sigma', 0):.4f} kgCO₂eq | quadrature propagation |

**Calculation pipeline:**
1. PUE from Carnot efficiency: COP = η × T_cold / (T_hot − T_cold)
2. Thermal throttling via coupled ODE (RK45)
3. Operational CO₂ = ∫P(t)dt × PUE × grid_intensity / 1000
4. Embodied carbon = C_mfg / (lifetime_h × utilisation)
5. Total = Operational + Embodied, σ = √(σ_op² + σ_emb²)

</details>

"""

    security_config = config.get("security", {})
    required_perm = security_config.get("override_permission", "admin")
    timing_note = ""
    if optimal_window and len(optimal_window) > 20 and "no significant" not in optimal_window.lower():
        timing_note = f" · ⏰ {optimal_window[:80]}"

    # Override options come BEFORE the <sub> footer tag (HTML breaks Markdown heading rendering)
    if result.get("status") == "block":
        try:
            comment += format_override_section(result)
        except Exception as _e:
            print(f"::warning::format_override_section failed: {_e}")
            comment += "\n\n**Override options:** Add the `carbon-override` label, or ask a repo admin.\n\n"

    comment += f"""<sub>[Dashboard →]({dashboard_url}){timing_note} · Override: `{required_perm}` + justification via `carbon-override` label · 🌱</sub>"""

    return comment


def post_pr_comment(comment):
    """Post comment to the pull request"""
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    if not github_token or not repo or not pr_number:
        output("Missing GitHub environment variables, skipping comment post", "warn")
        if OUTPUT_MODE != "json":
            print("\nComment that would be posted:")
            print("=" * 80)
            print(comment)
            print("=" * 80)
        return

    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    try:
        response = requests.post(
            url, json={"body": comment}, headers=headers, timeout=10
        )
        response.raise_for_status()
        output(f"Posted Carbon Gate report to PR #{pr_number}", "success")
    except requests.exceptions.RequestException as e:
        output(f"Failed to post PR comment: {e}", "error")
        if OUTPUT_MODE != "json":
            print("\nComment content:")
            print(comment)



def check_override_eligibility(config, result):
    """
    Call the /api/override/check endpoint to see if the user can override the block.
    Returns the API response dict, or None if the call fails.
    """
    api_endpoint = os.environ.get("API_ENDPOINT", "https://bit-manip-hackeurope.vercel.app").rstrip("/")
    org_api_key = os.environ.get("ORG_API_KEY", "").strip()
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    pr_number = os.environ.get("PR_NUMBER", "")
    pr_author = os.environ.get("PR_AUTHOR", "")

    if not org_api_key or not repo or not pr_number:
        return None

    # Get the PR author's GitHub permission level
    author_role = check_user_permission(pr_author) if pr_author else "none"

    try:
        resp = requests.post(
            f"{api_endpoint}/api/override/check",
            json={
                "api_key": org_api_key,
                "repo": repo,
                "pr_number": int(pr_number),
                "emissions_kg": result.get("emissions_kg", 0),
                "github_user": pr_author,
                "github_role": author_role,
            },
            timeout=10,
        )
        if resp.ok:
            return resp.json()
        else:
            output(f"Override check API returned {resp.status_code}", "warn")
            return None
    except Exception as e:
        output(f"Override check failed: {e}", "warn")
        return None


def request_admin_override(config, result, justification=None):
    """
    Call the /api/override/admin endpoint to log a free admin override.
    Returns True if successful.
    """
    api_endpoint = os.environ.get("API_ENDPOINT", "https://bit-manip-hackeurope.vercel.app").rstrip("/")
    org_api_key = os.environ.get("ORG_API_KEY", "").strip()
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    pr_number = os.environ.get("PR_NUMBER", "")
    pr_author = os.environ.get("PR_AUTHOR", "")

    if not org_api_key or not repo or not pr_number:
        return False

    try:
        resp = requests.post(
            f"{api_endpoint}/api/override/admin",
            json={
                "api_key": org_api_key,
                "repo": repo,
                "pr_number": int(pr_number),
                "github_user": pr_author or "unknown",
                "emissions_kg": result.get("emissions_kg", 0),
                "justification": justification,
            },
            timeout=10,
        )
        return resp.ok
    except Exception as e:
        output(f"Admin override API failed: {e}", "warn")
        return False


def get_override_purchase_url(config, result, github_user, github_role, justification=None):
    """
    Call the /api/override/purchase endpoint to get a Stripe checkout URL.
    Returns the checkout URL or None.
    """
    api_endpoint = os.environ.get("API_ENDPOINT", "https://bit-manip-hackeurope.vercel.app").rstrip("/")
    org_api_key = os.environ.get("ORG_API_KEY", "").strip()
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    pr_number = os.environ.get("PR_NUMBER", "")

    if not org_api_key or not repo or not pr_number:
        return None

    try:
        resp = requests.post(
            f"{api_endpoint}/api/override/purchase",
            json={
                "api_key": org_api_key,
                "repo": repo,
                "pr_number": int(pr_number),
                "github_user": github_user,
                "github_role": github_role,
                "emissions_kg": result.get("emissions_kg", 0),
                "justification": justification,
            },
            timeout=10,
        )
        if resp.ok:
            data = resp.json()
            return data.get("checkout_url")
        else:
            output(f"Override purchase API returned {resp.status_code}", "warn")
            return None
    except Exception as e:
        output(f"Override purchase request failed: {e}", "warn")
        return None


def check_gate_status(config, result):
    """Check if the gate should block the PR, with override support"""
    status = result["status"]
    threshold_kg = config.get("threshold_kg_co2", 2.0)
    warn_kg = config.get("warn_kg_co2", 1.0)
    emissions = result["emissions_kg"]
    crusoe_emissions = result.get("crusoe_emissions_kg", emissions)
    savings_pct = int(((emissions - crusoe_emissions) / emissions) * 100) if emissions > 0 else 0

    if status == "block":
        print()
        output(
            f"Carbon Gate BLOCKED \u2014 estimated emissions of {emissions:.2f} kgCO\u2082eq exceed your {threshold_kg} kg threshold",
            "error",
        )

        # Check override eligibility via API
        override_info = check_override_eligibility(config, result)
        if override_info:
            output(f"Repo usage this month: {override_info.get('repo_usage_kg', 0):.1f} / {override_info.get('hard_cap_kg', 20)} kgCO\u2082", "info")
            output(f"Overrides used: {override_info.get('overrides_used', 0)} / {override_info.get('max_overrides', 5)}", "info")

            if override_info.get("allowed"):
                otype = override_info.get("override_type")
                if otype == "admin":
                    output("Admin override available \u2014 add 'carbon-override' label to proceed", "info")
                elif otype == "paid":
                    cost = override_info.get("cost_usd", 0)
                    output(f"Paid override available \u2014 ${cost:.2f} to unblock this PR", "info")
            else:
                output(f"Override not available: {override_info.get('reason', 'Unknown')}", "warn")
        else:
            output("To proceed: (1) apply AI code suggestions, (2) add 'carbon-override' label (admin only), or (3) optimise your code", "info")

        sys.exit(1)
    elif status == "warn":
        print()
        output(
            f"Carbon Gate WARNING \u2014 {emissions:.2f} kgCO\u2082eq exceeds {warn_kg} kg warning threshold (block at {threshold_kg} kg)",
            "warn",
        )
        output(
            f"Tip: Switching to Crusoe would cut emissions to {crusoe_emissions:.2f} kgCO\u2082eq ({savings_pct}% reduction)",
            "info",
        )
    else:
        print()
        output(
            f"Carbon Gate PASSED \u2014 {emissions:.2f} kgCO\u2082eq is within limits (warn: {warn_kg} kg, block: {threshold_kg} kg)",
            "success",
        )



def main():
    """Main execution flow"""
    if OUTPUT_MODE != "json":
        print("=" * 80)
        print("Carbon Gate - ML Training Carbon Emissions Check")
        print("=" * 80)

    # Load configuration
    config = load_config()

    # Handle /apply-crusoe-patch comment command (separate workflow trigger)
    if APPLY_PATCH_REQUESTED:
        run_patch_apply_mode(config)
        if OUTPUT_MODE != "json":
            print("=" * 80)
        return

    # Check for SHA-based paid override (Stripe payment already completed)
    if check_sha_paid_override():
        sha = os.environ.get("PR_SHA", "") or os.environ.get("GITHUB_SHA", "")
        output(f"Paid override verified for SHA {sha[:7]} — carbon gate bypassed", "success")
        if OUTPUT_MODE != "json":
            print("=" * 80)
        sys.exit(0)

    # Check for override label (with enhanced security)
    override_check = check_override_label(config)
    if override_check and override_check["allowed"]:
        output(override_check["reason"], "success")
        if override_check.get("justification"):
            output(f"Justification: {override_check['justification'][:100]}", "info")

        # Log the admin override via API (tracks usage + enforces caps)
        result_stub = {"emissions_kg": config.get("threshold_kg_co2", 2.0)}
        api_logged = request_admin_override(
            config, result_stub,
            justification=override_check.get("justification"),
        )
        if api_logged:
            output("Admin override logged to billing system", "info")
        else:
            output("Could not log override to billing API (proceeding anyway)", "warn")

        output("Skipping carbon gate check (admin override approved)", "info")
        if OUTPUT_MODE != "json":
            print("=" * 80)
        sys.exit(0)
    elif override_check and not override_check["allowed"]:
        output(override_check["reason"], "warn")
        output("Proceeding with carbon gate check", "info")

    # Check for Crusoe reroute command (with enhanced security)
    crusoe_check = check_crusoe_reroute_command(config)
    if crusoe_check and crusoe_check["allowed"]:
        output(crusoe_check["reason"], "success")
        if crusoe_check.get("justification"):
            output(f"Justification: {crusoe_check['justification'][:100]}", "info")
        output("Routing job to Crusoe clean energy infrastructure", "info")
        # TODO: Person 3 will implement actual Crusoe API rerouting
        output("Skipping carbon gate check (job will run on Crusoe)", "info")
        if OUTPUT_MODE != "json":
            print("=" * 80)
        sys.exit(0)
    elif crusoe_check and not crusoe_check["allowed"]:
        output(crusoe_check["reason"], "warn")
        output("Proceeding with carbon gate check", "info")

    # Call API
    result = call_gate_api(config)

    # Override status based on local config thresholds (API uses budget-based logic)
    # This ensures thresholds from carbon-gate.yml are respected
    emissions_kg = result.get("emissions_kg", 0)
    threshold_kg = config.get("threshold_kg_co2", 2.0)
    warn_kg = config.get("warn_kg_co2", 1.0)
    
    if emissions_kg >= threshold_kg:
        result["status"] = "block"
        output(f"Emissions: {emissions_kg:.2f} kgCO\u2082eq | Thresholds: warn={warn_kg} kg, block={threshold_kg} kg | Status: BLOCK", "info")
    elif emissions_kg >= warn_kg:
        result["status"] = "warn"
        output(f"Emissions: {emissions_kg:.2f} kgCO\u2082eq | Thresholds: warn={warn_kg} kg, block={threshold_kg} kg | Status: WARN", "info")
    else:
        result["status"] = "pass"
        output(f"Emissions: {emissions_kg:.2f} kgCO\u2082eq | Thresholds: warn={warn_kg} kg, block={threshold_kg} kg | Status: PASS", "info")

    # Fetch AI code suggestions + patch from Crusoe
    suggestions = None
    patch = None
    suggestions_ai_powered = False

    if config.get("suggest_crusoe", True):
        crusoe_key = os.environ.get("CRUSOE_API_KEY", "").strip()
        if crusoe_key:
            output("Fetching AI carbon-efficiency analysis from Crusoe...", "info")
            file_contents = get_pr_file_contents()
            if file_contents:
                suggestions, patch = call_crusoe_for_suggestions(file_contents, config)
                if suggestions:
                    suggestions_ai_powered = True
                    output("AI analysis generated successfully", "success")
                else:
                    output("Crusoe API returned no content, using static suggestions", "warn")

                if patch:
                    output(f"Unified diff patch generated ({len(patch)} chars) — comment /apply-crusoe-patch to apply", "info")
            else:
                output("No Python files found in PR, using static suggestions", "info")
        else:
            output("Crusoe API key available, but no Python files changed in PR", "info")

        if not suggestions:
            suggestions = get_static_suggestions(config)
            output("Using static carbon-efficiency suggestions", "info")
    else:
        output("AI suggestions disabled (suggest_crusoe: false in config)", "info")

    # Format and post PR comment
    comment = format_pr_comment(config, result, suggestions, patch, suggestions_ai_powered)
    post_pr_comment(comment)

    # Check if gate should block
    check_gate_status(config, result)

    if OUTPUT_MODE != "json":
        print("=" * 80)


if __name__ == "__main__":
    main()
