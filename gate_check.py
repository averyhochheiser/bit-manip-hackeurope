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
import hmac as _hmac
import hashlib
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


def build_pay_to_override_url(sha: str) -> Optional[str]:
    """Generate a signed pay-to-override Stripe checkout link for this commit SHA.

    Canonical HMAC payload (keys sorted alphabetically):
      check=<check>&owner=<owner>&repo=<repo>&sha=<sha>&ts=<ts_ms>
    """
    secret = os.environ.get("OVERRIDE_SIGNING_SECRET", "").strip()
    if not secret:
        return None

    api_endpoint = os.environ.get(
        "API_ENDPOINT", "https://bit-manip-hackeurope.vercel.app"
    ).rstrip("/")

    repository = os.environ.get("GITHUB_REPOSITORY", "")
    if "/" not in repository:
        return None
    owner, repo_name = repository.split("/", 1)

    pr_number = os.environ.get("PR_NUMBER", "")
    check = "carbon"
    ts = str(int(datetime.now(timezone.utc).timestamp() * 1000))

    # Canonical payload — keys must be sorted alphabetically to match server
    payload = f"check={check}&owner={owner}&repo={repo_name}&sha={sha}&ts={ts}"
    sig = _hmac.new(
        secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    qs = (
        f"check={check}&owner={owner}&pr={pr_number}"
        f"&repo={repo_name}&sha={sha}&sig={sig}&ts={ts}"
    )
    return f"{api_endpoint}/api/override/create-checkout?{qs}"


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
    """Fetch changed Python files from the PR and return a formatted diff string."""
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
            if not patch:
                continue
            snippet = patch[:max_chars_per_file]
            diff_parts.append(f"### {filename}\n```diff\n{snippet}\n```")
            total_chars += len(snippet)
            if total_chars >= 8000:
                break

        return "\n\n".join(diff_parts) if diff_parts else None
    except requests.exceptions.RequestException as e:
        output(f"Could not fetch PR diff: {e}", "warn")
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

# Region → average grid carbon intensity (gCO₂/kWh)  – 2024 estimates
REGION_CARBON_INTENSITY = {
    "us-east-1": 380,   # Virginia
    "us-east-2": 440,   # Ohio
    "us-west-1": 210,   # N. California
    "us-west-2": 280,   # Oregon
    "eu-west-1": 300,   # Ireland
    "eu-west-2": 230,   # London
    "eu-west-3": 55,    # Paris (nuclear)
    "eu-central-1": 340,# Frankfurt
    "eu-north-1": 25,   # Stockholm (hydro)
    "ap-northeast-1": 480, # Tokyo
    "ap-south-1": 640,  # Mumbai
}


def calculate_emissions_local(gpu: str, hours: float, region: str, config: dict = None) -> dict:
    """
    Calculate carbon emissions using the full physics pipeline from calculations.py.

    When the hosted API is unreachable, this runs the same thermodynamic models locally:
    - Carnot-cycle PUE derived from ambient temperature (not a flat assumption)
    - GPU thermal throttling via coupled ODE (scipy RK45) — accounts for power
      limit governors that reduce actual draw 10-15% below nameplate TDP
    - Embodied carbon amortised over GPU lifecycle (Gupta et al. 2022 LCA data)
    - Uncertainty propagation (±σ) through the full calculation chain
    - WattTime marginal intensity when credentials are available; regional
      statistical baselines otherwise

    Falls back to a simplified model if numpy/scipy aren't installed.
    """
    if FULL_CALC_AVAILABLE:
        import numpy as np
        # Generate synthetic intensity history for Fourier forecast
        # (real deployment would cache actual history from Electricity Maps)
        np.random.seed(42)
        t = np.arange(168)  # 1 week hourly
        base = _REGION_BASELINE.get(region, 200.0)
        rng = _REGION_RANGE.get(region, 250.0)
        history = (
            base + rng * 0.4
            + rng * 0.3 * np.sin(2 * np.pi * t / 24)
            + rng * 0.1 * np.sin(2 * np.pi * t / 168)
            + np.random.normal(0, rng * 0.05, len(t))
        ).tolist()

        carbon_intensity = base + rng * 0.4  # ~median for region

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

        # Map to API response shape
        gate = r.get("gate", {})
        return {
            "emissions_kg": r["emissions_kg"],
            "emissions_sigma": r.get("emissions_sigma", 0),
            "crusoe_emissions_kg": r["crusoe_emissions_kg"],
            "budget_remaining_kg": 50.0,
            "status": "pass",  # overridden by local thresholds in main()
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
        # Simplified fallback if numpy/scipy not available
        tdp_w = GPU_TDP_W.get(gpu, GPU_TDP_W.get("A100", 400))
        embodied_kg = GPU_EMBODIED_KG.get(gpu, GPU_EMBODIED_KG.get("A100", 150))
        carbon_intensity = REGION_CARBON_INTENSITY.get(region, 380)
        pue = min(2.0, 1.10 + max(0, (20 - 15) * 0.005))
        energy_kwh = (tdp_w / 1000) * hours * pue
        op_kg = (energy_kwh * carbon_intensity) / 1000
        emb_kg = (GPU_EMBODIED_KG.get(gpu, 150) / GPU_LIFETIME_H) * hours
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


def call_crusoe_for_suggestions(diff: str, config: dict) -> Optional[str]:
    """
    Send the PR diff to Crusoe's LLM and return Markdown suggestions for
    making the training code more carbon-efficient.
    Returns None if CRUSOE_API_KEY is absent or the call fails.
    """
    crusoe_api_key = os.environ.get("CRUSOE_API_KEY", "").strip()
    if not crusoe_api_key:
        return None

    gpu = config.get("gpu", "A100")
    estimated_hours = config.get("estimated_hours", 1.0)

    prompt = f"""You are a carbon-efficiency expert reviewing ML training code in a pull request.

The training job is configured to run on **{gpu}** GPUs for approximately **{estimated_hours} h**.

Analyse the following code changes and provide:
1. **2–3 specific, actionable suggestions** to reduce compute time and energy consumption.
2. **A short refactored code snippet** for the single most impactful suggestion (where applicable).

Focus on concrete patterns such as:
- Redundant forward/backward passes or unnecessary re-computation
- Missing mixed-precision (`torch.autocast`) or gradient checkpointing
- Inefficient data loading (blocking I/O, no `pin_memory`, `num_workers=0`)
- Suboptimal batch-size / learning-rate schedule choices
- Unnecessary CPU↔GPU transfers or `.item()` calls inside training loops
- Early stopping absent when validation loss plateaus
- Model architecture over-parameterisation for the stated task

Be specific to the actual code shown. Skip generic advice that doesn't apply.

## Changed Python files
{diff}

Respond in Markdown only. Keep the total response under 450 words."""

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
                "max_tokens": 700,
                "temperature": 0.3,
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        output(f"Crusoe suggestion call failed: {e}", "warn")
        return None


def get_static_suggestions(config: dict) -> str:
    """
    Return hardcoded carbon-efficiency tips based on the job config.
    Used as a fallback when CRUSOE_API_KEY is absent or the API call fails.
    """
    gpu = config.get("gpu", "A100")
    hours = config.get("estimated_hours", 1.0)

    tips = [
        (
            "**Enable mixed-precision training**",
            "Wrap your training loop with `torch.autocast('cuda')` (PyTorch) or "
            "`tf.keras.mixed_precision.set_global_policy('mixed_float16')` (TensorFlow). "
            "This typically cuts GPU memory in half and speeds up compute by 1.5–3×, "
            "directly reducing energy consumption.\n\n"
            "```python\n"
            "from torch.cuda.amp import autocast, GradScaler\n"
            "scaler = GradScaler()\n"
            "with autocast():\n"
            "    loss = model(batch)\n"
            "scaler.scale(loss).backward()\n"
            "scaler.step(optimizer)\n"
            "scaler.update()\n"
            "```"
        ),
        (
            "**Add early stopping**",
            f"With {hours:.0f}h estimated runtime on {gpu}, training to completion wastes compute "
            "if validation loss has plateaued. Use patience-based early stopping (e.g. patience=3–5 epochs) "
            "to halt automatically when performance stops improving."
        ),
        (
            "**Optimise data loading**",
            "Ensure your DataLoader uses `num_workers >= 2` and `pin_memory=True` to eliminate "
            "CPU bottlenecks that artificially extend GPU wall-clock time:\n\n"
            "```python\n"
            "DataLoader(dataset, batch_size=32, num_workers=4, pin_memory=True)\n"
            "```"
        ),
    ]

    lines = []
    for i, (title, body) in enumerate(tips, 1):
        lines.append(f"{i}. {title}\n   {body}")

    return "\n\n".join(lines)


# ── Apply-patch feature ─────────────────────────────────────────────────────

def get_pr_file_contents() -> list[dict]:
    """
    Fetch the full content and metadata of changed Python files in the PR.
    Returns a list of dicts: [{"filename": str, "content": str, "patch": str}]
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    if not github_token or not repo or not pr_number:
        return []

    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    try:
        # Get list of changed files
        url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/files"
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        files = response.json()

        python_files = [f for f in files if f.get("filename", "").endswith(".py")]
        if not python_files:
            return []

        result = []
        for f in python_files[:5]:  # cap at 5 files
            filename = f["filename"]
            patch = f.get("patch", "")
            # Get the raw file content from the PR head branch
            raw_url = f.get("raw_url")
            if raw_url:
                try:
                    content_resp = requests.get(raw_url, headers=headers, timeout=15)
                    content_resp.raise_for_status()
                    content = content_resp.text
                except Exception:
                    content = ""
            else:
                content = ""

            if content and patch:
                result.append({
                    "filename": filename,
                    "content": content,
                    "patch": patch,
                })

        return result
    except requests.exceptions.RequestException as e:
        output(f"Could not fetch PR file contents: {e}", "warn")
        return []


def call_crusoe_for_patch(file_info: list[dict], config: dict) -> dict:
    """
    Send file contents to Crusoe AI and get back optimized versions.
    Returns: {"filename": "optimized content", ...} or empty dict on failure.
    """
    crusoe_api_key = os.environ.get("CRUSOE_API_KEY", "").strip()
    if not crusoe_api_key:
        output("CRUSOE_API_KEY not set — cannot generate patch", "warn")
        return {}

    gpu = config.get("gpu", "A100")
    estimated_hours = config.get("estimated_hours", 1.0)

    # Build prompt with all file contents
    files_block = ""
    for f in file_info:
        files_block += f"\n### {f['filename']}\n```python\n{f['content'][:4000]}\n```\n"
        files_block += f"\n#### Changes in this PR:\n```diff\n{f['patch'][:2000]}\n```\n"

    prompt = f"""You are a carbon-efficiency expert optimizing ML training code.

The training job runs on **{gpu}** GPUs for approximately **{estimated_hours}h**.

Below are the Python files from the pull request. Your task is to return **complete, optimized versions** of each file that reduce energy consumption through:
- Mixed-precision training (torch.autocast / GradScaler)
- Gradient checkpointing where applicable
- Efficient data loading (num_workers, pin_memory)
- Early stopping when validation loss plateaus
- Removing unnecessary CPU↔GPU transfers
- Any other concrete energy-saving improvements

**IMPORTANT RULES:**
1. Return ONLY the optimized Python code — no explanations, no markdown fences, no commentary.
2. If multiple files are provided, separate them with a line containing exactly: `===FILE_SEPARATOR===`
3. Before each file, include a line: `===FILENAME: path/to/file.py===`
4. Keep all existing functionality intact — only add/modify for efficiency.
5. Add brief inline comments (# CARBON-OPT: ...) to explain each optimization.

## Files to optimize
{files_block}

Return the complete optimized files now:"""

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
                "max_tokens": 4000,
                "temperature": 0.2,
            },
            timeout=90,
        )
        response.raise_for_status()
        data = response.json()
        ai_text = data["choices"][0]["message"]["content"].strip()

        # Parse the response into filename → content mapping
        return _parse_patch_response(ai_text, file_info)

    except Exception as e:
        output(f"Crusoe patch generation failed: {e}", "warn")
        return {}


def _parse_patch_response(ai_text: str, file_info: list[dict]) -> dict:
    """
    Parse the AI response into a dict of {filename: optimized_content}.
    Handles the ===FILENAME: ...=== / ===FILE_SEPARATOR=== format,
    and falls back to using the original file list if only one file.
    """
    result = {}

    # Strip markdown fences if the model wrapped them
    cleaned = ai_text
    if cleaned.startswith("```"):
        # Remove opening fence
        first_newline = cleaned.index("\n") if "\n" in cleaned else len(cleaned)
        cleaned = cleaned[first_newline + 1:]
    if cleaned.rstrip().endswith("```"):
        cleaned = cleaned.rstrip()[:-3].rstrip()

    # Try structured format first
    if "===FILENAME:" in cleaned:
        parts = cleaned.split("===FILE_SEPARATOR===")
        for part in parts:
            part = part.strip()
            if not part:
                continue
            if "===FILENAME:" in part:
                header_end = part.index("===", part.index("===FILENAME:") + 12)
                filename = part[part.index("===FILENAME:") + 12:header_end].strip()
                code = part[header_end + 3:].strip()
                # Strip any markdown fences around the code
                if code.startswith("```"):
                    first_nl = code.index("\n") if "\n" in code else len(code)
                    code = code[first_nl + 1:]
                if code.rstrip().endswith("```"):
                    code = code.rstrip()[:-3].rstrip()
                result[filename] = code
    elif len(file_info) == 1:
        # Single file — just use the whole response
        result[file_info[0]["filename"]] = cleaned

    return result


def apply_patch_to_pr():
    """
    Main entry point for the /apply-crusoe-patch command.
    Fetches PR files, generates optimized versions via Crusoe AI,
    writes them to disk, commits, pushes, and posts a PR comment.
    """
    import subprocess

    output("Starting Crusoe efficiency patch generation...", "info")

    # Load config (might not exist in dummy repos, use defaults)
    try:
        config = load_config()
    except SystemExit:
        output("No carbon-gate.yml found, using defaults", "warn")
        config = {
            "gpu": "A100",
            "estimated_hours": 4.0,
            "suggest_crusoe": True,
            "auto_refactor": True,
        }

    # Get file contents from the PR
    file_info = get_pr_file_contents()
    if not file_info:
        _post_patch_comment(False, "No Python files found in this PR to optimize.")
        sys.exit(1)

    output(f"Found {len(file_info)} Python file(s) to optimize", "info")

    # Call Crusoe AI to generate optimized versions
    patches = call_crusoe_for_patch(file_info, config)
    if not patches:
        _post_patch_comment(False, "Could not generate optimized code. The Crusoe AI service may be unavailable, or `CRUSOE_API_KEY` may not be set.")
        sys.exit(1)

    output(f"Generated patches for {len(patches)} file(s)", "success")

    # Write optimized files to disk
    files_written = []
    for filename, content in patches.items():
        try:
            filepath = Path(filename)
            filepath.parent.mkdir(parents=True, exist_ok=True)
            filepath.write_text(content, encoding="utf-8")
            files_written.append(filename)
            output(f"  Wrote optimized: {filename}", "info")
        except Exception as e:
            output(f"  Failed to write {filename}: {e}", "warn")

    if not files_written:
        _post_patch_comment(False, "Generated patches but failed to write files to disk.")
        sys.exit(1)

    # Commit and push
    try:
        pr_author = os.environ.get("PR_AUTHOR", "carbon-gate[bot]")
        subprocess.run(["git", "config", "user.name", "Carbon Gate Bot"], check=True, capture_output=True)
        subprocess.run(["git", "config", "user.email", "carbon-gate[bot]@users.noreply.github.com"], check=True, capture_output=True)
        subprocess.run(["git", "add"] + files_written, check=True, capture_output=True)

        # Check if there are actual changes
        result = subprocess.run(["git", "diff", "--cached", "--quiet"], capture_output=True)
        if result.returncode == 0:
            _post_patch_comment(False, "The AI-generated optimizations produced no changes to the existing code. Your code may already be well-optimized!")
            sys.exit(0)

        commit_msg = (
            "perf: apply Crusoe AI carbon-efficiency optimizations\n\n"
            "Auto-generated by Carbon Gate. Changes include:\n"
            + "\n".join(f"- {f}" for f in files_written)
            + "\n\nOptimizations: mixed-precision, efficient data loading, "
            "gradient checkpointing, early stopping, etc."
        )
        subprocess.run(["git", "commit", "-m", commit_msg], check=True, capture_output=True)
        subprocess.run(["git", "push"], check=True, capture_output=True)
        output("Committed and pushed optimized code", "success")
    except subprocess.CalledProcessError as e:
        output(f"Git operation failed: {e}", "error")
        if e.stderr:
            output(f"  stderr: {e.stderr.decode('utf-8', errors='replace')}", "debug")
        _post_patch_comment(False, f"Generated patches but failed to commit: {e}")
        sys.exit(1)

    # Post success comment
    file_list = "\n".join(f"- `{f}`" for f in files_written)
    _post_patch_comment(
        True,
        f"Successfully applied Crusoe AI efficiency optimizations to:\n\n{file_list}\n\n"
        f"The optimized code includes mixed-precision training, efficient data loading, "
        f"and other carbon-reducing improvements. Please review the changes."
    )

    output("Patch applied successfully!", "success")


def _post_patch_comment(success: bool, message: str):
    """Post a comment to the PR about the patch result."""
    github_token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    if not github_token or not repo or not pr_number:
        output(f"Cannot post comment (missing env vars): {message}", "warn")
        return

    if success:
        comment = f"## Crusoe Efficiency Patch Applied\n\n{message}\n\n---\n<sub>Powered by [Crusoe Cloud](https://crusoe.ai) — geothermal-powered AI inference</sub>"
    else:
        comment = f"## ❌ Crusoe Efficiency Patch Failed\n\n{message}\n\n---\n<sub>Powered by [Carbon Gate](https://github.com/averyhochheiser/bit-manip-hackeurope) 🌱</sub>"

    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json",
    }

    try:
        response = requests.post(url, json={"body": comment}, headers=headers, timeout=10)
        response.raise_for_status()
        output(f"Posted patch result to PR #{pr_number}", "success")
    except requests.exceptions.RequestException as e:
        output(f"Failed to post patch comment: {e}", "error")


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
    api_endpoint = os.environ.get("API_ENDPOINT", "https://bit-manip-hackeurope.vercel.app")
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
            return data, True  # (result, from_api)
        except requests.exceptions.RequestException as e:
            status_code = getattr(getattr(e, 'response', None), 'status_code', None)
            if status_code == 401:
                output("API authentication failed — check your CARBON_GATE_ORG_KEY secret", "warn")
            else:
                output(f"API call failed ({e}), calculating emissions locally", "warn")
    else:
        output("No ORG_API_KEY set — calculating emissions locally", "info")

    # Local fallback: compute real emissions using the same physics as the API
    result = calculate_emissions_local(gpu, hours, region)
    output(
        f"Local calculation: {result['emissions_kg']:.2f} kgCO₂eq "
        f"({gpu}, {hours}h, {region} @ {result['carbon_intensity']} gCO₂/kWh)",
        "info",
    )
    return result, False  # (result, from_api)


def format_pr_comment(config, result, suggestions: Optional[str] = None, suggestions_ai_powered: bool = True, override_checkout_url: Optional[str] = None):
    """Format the Carbon Gate report as a PR comment with educational, firm tone"""
    # GPU TDP reference for Technical Details section
    _GPU_TDP_REF = {"H100": 700, "A100": 400, "V100": 300, "A10": 150, "A10G": 150, "T4": 70, "L40": 300}
    emissions = result["emissions_kg"]
    crusoe_emissions = result["crusoe_emissions_kg"]
    status = result["status"]
    budget_remaining = result["budget_remaining_kg"]
    optimal_window = result.get("optimal_window", "No recommendation available")
    crusoe_available = result.get("crusoe_available", False)
    crusoe_instance = result.get("crusoe_instance", "N/A")
    carbon_intensity = result.get("carbon_intensity", 0)

    threshold_kg = config.get("threshold_kg_co2", 2.0)
    warn_kg = config.get("warn_kg_co2", 1.0)

    # Status header
    if status == "block":
        status_label = "BLOCKED"
        status_text = f"Exceeds carbon threshold ({threshold_kg} kg)"
        status_message = (
            f"This training job is estimated at **{emissions:.2f} kgCO₂eq**, which exceeds your "
            f"organization's carbon threshold of {threshold_kg} kg. The PR merge is blocked until "
            f"emissions are reduced or an override is approved."
        )
    elif status == "warn":
        status_label = "WARNING"
        status_text = f"Approaching threshold (warn: {warn_kg} kg, block: {threshold_kg} kg)"
        status_message = (
            f"This training job is estimated at **{emissions:.2f} kgCO₂eq**, which exceeds the "
            f"warning threshold of {warn_kg} kg. Consider the optimisation suggestions below to "
            f"reduce environmental impact before this approaches the block threshold of {threshold_kg} kg."
        )
    else:
        status_label = "PASSED"
        status_text = "Within acceptable limits"
        status_message = (
            f"This training job is estimated at **{emissions:.2f} kgCO₂eq**, which is within your "
            f"configured limits (warn: {warn_kg} kg, block: {threshold_kg} kg)."
        )

    # Calculate environmental impact
    savings_pct = (
        int(((emissions - crusoe_emissions) / emissions) * 100) if emissions > 0 else 0
    )

    # Equivalent impact (make it tangible)
    car_miles = emissions * 2.31  # 1 kgCO2 ≈ 2.31 miles driven
    trees_needed = emissions / 21  # 1 tree absorbs ~21kg CO2/year

    # Estimate costs (rough AWS pricing)
    gpu_hourly_rate = {"A100": 3.55, "H100": 4.10, "V100": 2.48, "A10": 1.12}
    current_cost = gpu_hourly_rate.get(config.get("gpu", "A100"), 3.55) * config.get(
        "estimated_hours", 1.0
    )
    crusoe_cost = current_cost * 1.15  # Crusoe typically ~15% more expensive

    comment = f"""## Carbon Gate — {status_label}

{status_message}

---

### Emissions Estimate

| Metric | Value |
|--------|-------|
| **Carbon Footprint** | **{emissions:.2f} kgCO₂eq** — {status_text} |
| **Grid Carbon Intensity** | {carbon_intensity} gCO₂/kWh ({config.get('region', 'us-east-1')}) |
| **Equivalent Impact** | ~{car_miles:.0f} miles driven by car \u2022 {trees_needed:.2f} tree-years to offset |
| **Compute Cost** | ~${current_cost:.2f} |

"""

    if crusoe_available:
        cost_increase_pct = ((crusoe_cost - current_cost) / current_cost) * 100
        comment += f"""---

### Cleaner Alternative Available

**Crusoe Cloud is ready to run this job with {savings_pct}% less carbon:**

| Comparison | Current Setup | Crusoe (Geothermal) | Improvement |
|------------|---------------|---------------------|-------------|
| **Emissions** | {emissions:.2f} kgCO₂eq | {crusoe_emissions:.2f} kgCO₂eq | **-{savings_pct}%** |
| **Energy Source** | Grid mix | 100% geothermal | Clean energy |
| **Cost** | ${current_cost:.2f} | ${crusoe_cost:.2f} | +${crusoe_cost - current_cost:.2f} (+{cost_increase_pct:.1f}%) |
| **Available GPUs** | — | `{crusoe_instance}` | Ready now |

**Why this matters:** Using clean energy infrastructure reduces environmental impact while maintaining performance. The additional cost represents a {cost_increase_pct:.1f}% premium for {savings_pct}% cleaner computing.

"""
    else:
        comment += f"""---

### Clean Energy Option

Crusoe's geothermal infrastructure could reduce emissions by up to {savings_pct}%, but is currently at capacity in this region. Consider:
- Scheduling this job for when Crusoe capacity becomes available
- Running during lower grid carbon intensity hours (see optimal window below)

"""

    comment += f"""---

### Your Carbon Budget

**Monthly usage:** {50.0 - budget_remaining:.1f} / 50.0 kgCO₂eq  
**Remaining budget:** {budget_remaining:.1f} kg  
**After this job:** {budget_remaining - emissions:.1f} kg remaining

"""

    if budget_remaining - emissions < 0:
        overage = emissions - budget_remaining
        overage_cost = overage * 2.0  # $2/kg carbon price
        comment += f"""**Budget Alert:** This job would exceed your monthly carbon budget by {overage:.1f} kg, resulting in ${overage_cost:.2f} in overage charges.

"""
    elif budget_remaining - emissions < 10:
        comment += f"""**Budget Notice:** This job would leave only {budget_remaining - emissions:.1f} kg in your monthly budget.

"""

    comment += f"""---

### Timing Optimization

**Grid forecast:** {optimal_window}

Running your job when grid carbon intensity is lower can significantly reduce emissions at no additional cost.

---

<details>
<summary> Technical Details</summary>

| Parameter | Value |
|-----------|-------|
| GPU Type | {config.get('gpu', 'A100')} |
| Est. Training Time | {config.get('estimated_hours', 1.0)} hours |
| PUE (Power Usage Effectiveness) | {result.get('pue_used', 1.1):.2f} |
| Region | {config.get('region', 'us-east-1')} |
| Grid Carbon Intensity | {carbon_intensity} gCO₂/kWh |

**Calculation:** energy (kWh) = TDP × hours × PUE / 1000 → CO₂ (kg) = energy × carbon_intensity / 1000

</details>

"""

    if suggestions:
        if suggestions_ai_powered:
            suggestion_header = "> *Analysed by [Crusoe Cloud](https://crusoe.ai) \u2014 geothermal-powered AI inference (~5\u202fgCO\u2082/kWh)*"
        else:
            suggestion_header = "> *Recommended optimisations based on your training configuration \u2014 add `CRUSOE_API_KEY` for code-specific AI analysis powered by [Crusoe Cloud](https://crusoe.ai)*"
        comment += f"""---

### \U0001f9e0 Code Efficiency Suggestions

{suggestion_header}

{suggestions}

"""

    comment += """---

### What You Can Do

"""

    if status == "block":
        comment += f"""**This PR is currently blocked due to high emissions.** To proceed, you have these options:

1. **Reroute to Crusoe** (Recommended) — Comment `/crusoe-run: [reason]` to use clean energy infrastructure
2. **Auto-Patch Code** — Comment `/apply-crusoe-patch` to have Crusoe AI automatically optimize your code and commit the changes
3. **Optimize Timing** — {optimal_window}
4. **Request Override** — Authorized team members can add the `carbon-override` label with justification
"""
    else:
        comment += f"""Consider these options to reduce environmental impact:

1. **Switch to Clean Energy** — Comment `/crusoe-run: [reason]` to use Crusoe's geothermal infrastructure ({savings_pct}% cleaner)
2. **Auto-Patch Code** — Comment `/apply-crusoe-patch` to have Crusoe AI automatically optimize your code and commit the changes
3. **Optimize Timing** — {optimal_window}

"""

    # Add security policy info
    security_config = config.get("security", {})
    required_perm = security_config.get("override_permission", "admin")

    comment += f"""<sub>

**Override Policy:** Requires `{required_perm}` permissions"""

    if security_config.get("require_justification", True):
        comment += f" + justification"

    if security_config.get("allowed_teams"):
        teams = ", ".join(security_config["allowed_teams"])
        comment += f" | Authorized teams: {teams}"

    comment += f"""

[Learn more about Carbon Gate](https://github.com/averyhochheiser/bit-manip-hackeurope)

</sub>
"""

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


def check_gate_status(config, result):
    """Check if the gate should block the PR"""
    status = result["status"]
    threshold_kg = config.get("threshold_kg_co2", 2.0)
    warn_kg = config.get("warn_kg_co2", 1.0)
    emissions = result["emissions_kg"]
    crusoe_emissions = result.get("crusoe_emissions_kg", emissions)
    savings_pct = int(((emissions - crusoe_emissions) / emissions) * 100) if emissions > 0 else 0

    if status == "block":
        print()
        output(
            f"Carbon Gate BLOCKED this PR — estimated emissions of {emissions:.2f} kgCO₂eq exceed your {threshold_kg} kg threshold",
            "error",
        )
        output(
            f"To proceed: (1) add the 'carbon-override' label, (2) comment '/crusoe-run: reason' to use clean energy ({savings_pct}% less carbon), or (3) optimise the training code",
            "info",
        )
        sys.exit(1)
    elif status == "warn":
        print()
        output(
            f"Carbon Gate WARNING — {emissions:.2f} kgCO₂eq exceeds {warn_kg} kg warning threshold (block at {threshold_kg} kg)",
            "warn",
        )
        output(
            f"Tip: Switching to Crusoe would cut emissions to {crusoe_emissions:.2f} kgCO₂eq ({savings_pct}% reduction)",
            "info",
        )
    else:
        print()
        output(
            f"Carbon Gate PASSED — {emissions:.2f} kgCO₂eq is within limits (warn: {warn_kg} kg, block: {threshold_kg} kg)",
            "success",
        )


def main():
    """Main execution flow"""

    # Check if this is an apply-patch request (from /apply-crusoe-patch comment)
    if os.environ.get("APPLY_PATCH_REQUESTED", "").lower() == "true":
        output("Apply-patch mode detected", "info")
        apply_patch_to_pr()
        return

    if OUTPUT_MODE != "json":
        print("=" * 80)
        print("Carbon Gate - ML Training Carbon Emissions Check")
        print("=" * 80)

    # Load configuration
    config = load_config()

    # Check for override label (with enhanced security)
    override_check = check_override_label(config)
    if override_check and override_check["allowed"]:
        output(override_check["reason"], "success")
        if override_check.get("justification"):
            output(f"Justification: {override_check['justification'][:100]}", "info")
        output("Skipping carbon gate check (override approved)", "info")
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

    # Call API (or compute locally)
    result, from_api = call_gate_api(config)

    # Override status based on local thresholds from carbon-gate.yml
    # The API uses monthly budget logic; local thresholds give per-job control
    threshold_kg = config.get("threshold_kg_co2", 2.0)
    warn_kg = config.get("warn_kg_co2", 1.0)
    emissions = result["emissions_kg"]

    if emissions >= threshold_kg:
        result["status"] = "block"
    elif emissions >= warn_kg:
        result["status"] = "warn"
    else:
        result["status"] = "pass"

    output(
        f"Emissions: {emissions:.2f} kgCO₂eq | Thresholds: warn={warn_kg} kg, block={threshold_kg} kg | Status: {result['status'].upper()}",
        "info",
    )

    if not from_api:
        output(
            "Note: Emissions calculated locally (same physics model as the API). "
            "Set CARBON_GATE_ORG_KEY for budget tracking and usage history.",
            "info",
        )

    # Fetch AI code suggestions from Crusoe (opt-in via suggest_crusoe config)
    suggestions = None
    suggestions_ai_powered = False
    if config.get("suggest_crusoe", True):
        crusoe_key = os.environ.get("CRUSOE_API_KEY", "").strip()
        if crusoe_key:
            output("Fetching AI carbon-efficiency suggestions from Crusoe...", "info")
            diff = get_pr_diff()
            if diff:
                suggestions = call_crusoe_for_suggestions(diff, config)
                if suggestions:
                    suggestions_ai_powered = True
                    output("AI suggestions generated successfully", "success")
                else:
                    output("Crusoe API returned no content, falling back to static suggestions", "warn")
            else:
                output("No Python file changes found in PR diff, using static suggestions", "info")
        else:
            output("CRUSOE_API_KEY not set — using static efficiency suggestions", "info")

        # Always show something useful if we didn't get AI content
        if not suggestions:
            suggestions = get_static_suggestions(config)
            output("Using static carbon-efficiency suggestions", "info")
    else:
        output("AI suggestions disabled (suggest_crusoe: false in config)", "info")

    # Build signed pay-to-override URL (only when gate is blocked)
    override_checkout_url: Optional[str] = None
    if result["status"] == "block":
        sha = os.environ.get("PR_SHA") or os.environ.get("GITHUB_SHA", "")
        if sha:
            override_checkout_url = build_pay_to_override_url(sha)
            if override_checkout_url:
                output("Pay-to-override link generated for PR comment", "info")
            else:
                output("OVERRIDE_SIGNING_SECRET not set — pay-to-override link omitted", "info")

    # Format and post PR comment
    comment = format_pr_comment(config, result, suggestions, suggestions_ai_powered, override_checkout_url)
    post_pr_comment(comment)

    # Check if gate should block
    check_gate_status(config, result)

    if OUTPUT_MODE != "json":
        print("=" * 80)


if __name__ == "__main__":
    main()
