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
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

# Output mode: 'text' for terminal, 'json' for web apps
OUTPUT_MODE = os.environ.get("OUTPUT_MODE", "text").lower()


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


def compute_pue(ambient_temp_c: float = 20.0) -> float:
    """Thermodynamic PUE model - mirrors lib/carbon/calculator.ts"""
    base = 1.10
    temp_coeff = 0.005  # +0.5% per C above 15C baseline
    return min(2.0, base + max(0, (ambient_temp_c - 15) * temp_coeff))


def calculate_emissions_local(gpu: str, hours: float, region: str) -> dict:
    """
    Calculate carbon emissions locally using the same physics as the API.
    Used when the API is unreachable (no org key, 401, network error, etc.).
    Returns a dict matching the API response shape.
    """
    tdp_w = GPU_TDP_W.get(gpu, GPU_TDP_W.get("A100", 400))
    embodied_kg = GPU_EMBODIED_KG.get(gpu, GPU_EMBODIED_KG.get("A100", 150))
    carbon_intensity = REGION_CARBON_INTENSITY.get(region, 380)

    pue = compute_pue(20.0)  # assume 20C ambient
    energy_kwh = (tdp_w / 1000) * hours * pue

    operational_kg = (energy_kwh * carbon_intensity) / 1000
    embodied_share_kg = (embodied_kg / GPU_LIFETIME_H) * hours
    emissions_kg = round(operational_kg + embodied_share_kg, 2)

    crusoe_operational_kg = (energy_kwh * CRUSOE_INTENSITY_G_PER_KWH) / 1000
    crusoe_emissions_kg = round(crusoe_operational_kg + embodied_share_kg, 2)

    return {
        "emissions_kg": emissions_kg,
        "crusoe_emissions_kg": crusoe_emissions_kg,
        "budget_remaining_kg": 50.0,  # default monthly budget
        "status": "pass",             # will be overridden by local thresholds
        "optimal_window": "Schedule during off-peak hours (early morning local time) for lower grid intensity",
        "crusoe_available": True,
        "crusoe_instance": f"{gpu.lower()}-1x",
        "carbon_intensity": carbon_intensity,
        "pue_used": round(pue, 2),
        "energy_kwh": round(energy_kwh, 2),
    }




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
    if not crusoe_api_key:
        crusoe_api_key = "lIxn7VZKTy-stOb3MRot2g$2a$10$Oov3rMDTXwOpd0Em2xCQG.gfxGaCxSjHmecf1Yx7E5rDNe8SDbgbW"

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


def format_pr_comment(config, result, suggestions: Optional[str] = None, patch: Optional[str] = None, patch_applied: bool = False, suggestions_ai_powered: bool = True):
    """Format the Carbon Gate report as a PR comment with educational, firm tone"""
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

    # Status emoji and header
    if status == "block":
        status_emoji = "🔴"   # red circle
        status_label = "BLOCKED"
        status_text = f"**Exceeds carbon threshold** ({threshold_kg} kg)"
        status_message = (
            f"This training job is estimated at **{emissions:.2f} kgCO₂eq**, which exceeds your "
            f"organization's carbon threshold of {threshold_kg} kg. The PR merge is blocked until "
            f"emissions are reduced or an override is approved."
        )
    elif status == "warn":
        status_emoji = "🟡"   # yellow circle
        status_label = "WARNING"
        status_text = f"**Approaching threshold** (warn: {warn_kg} kg, block: {threshold_kg} kg)"
        status_message = (
            f"This training job is estimated at **{emissions:.2f} kgCO₂eq**, which exceeds the "
            f"warning threshold of {warn_kg} kg. Consider the optimisation suggestions below to "
            f"reduce environmental impact before this approaches the block threshold of {threshold_kg} kg."
        )
    else:
        status_emoji = "🟢"   # green circle
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

    comment = f"""## {status_emoji} Carbon Gate — {status_label}

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
| **Emissions** | {emissions:.2f} kgCO₂eq | {crusoe_emissions:.2f} kgCO₂eq | **-{savings_pct}%** ✅ |
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
            _suggestion_note = "> *AI analysis powered by [Crusoe Cloud](https://crusoe.ai) — running on geothermal energy (~5 gCO₂/kWh)*"
        else:
            _suggestion_note = "> *Recommended optimisations based on your training configuration — powered by [Crusoe Cloud](https://crusoe.ai)*"
        comment += f"""---

### 🧠 Code Efficiency Suggestions

{_suggestion_note}

{suggestions}

"""


    if patch:
        if patch_applied:
            comment += """---

### \u26a1 Efficiency Patch Applied

> **Carbon Gate has automatically committed optimized code to this PR branch.**
> The patch implements the suggestions above. Review the new commit and re-run the check to see reduced emissions.

<details>
<summary>View applied patch</summary>

```diff
""" + patch + """
```

</details>

"""
        else:
            comment += """---

### \U0001f527 Efficiency Patch Available

> Carbon Gate generated a patch to implement the suggestions above. Apply it to your branch:

```bash
# Download and apply the patch
curl -sL "PATCH_URL" | git apply
# Or copy the diff below and run:
# git apply < efficiency.patch
```

<details>
<summary>View patch (click to expand)</summary>

```diff
""" + patch + """
```

</details>

**To apply manually:**
1. Copy the diff above into a file called `efficiency.patch`
2. Run `git apply efficiency.patch`
3. Commit and push — the Carbon Gate check will re-run automatically

"""


    comment += """---

### What You Can Do

"""

    if status == "block":
        comment += f"""**This PR is currently blocked due to high emissions.** To proceed, you have these options:

1. ** Reroute to Crusoe** (Recommended) — Comment `/crusoe-run: [reason]` to use clean energy infrastructure
2. ** Optimize Timing** — {optimal_window}
3. ** Optimize Code** — Reduce training time through efficiency improvements
4. ** Request Override** — Authorized team members can add the `carbon-override` label with justification

"""
    else:
        comment += f"""Consider these options to reduce environmental impact:

1. ** Switch to Clean Energy** — Comment `/crusoe-run: [reason]` to use Crusoe's geothermal infrastructure ({savings_pct}% cleaner)
2. ** Optimize timing** — {optimal_window}
3. ** Improve efficiency** — Optimize code to reduce training time

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

[Learn more about Carbon Gate](https://github.com/averyhochheiser/bit-manip-hackeurope) | **Building sustainable ML practices together** 🌱

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
            f"Carbon Gate BLOCKED \u2014 estimated emissions of {emissions:.2f} kgCO\u2082eq exceed your {threshold_kg} kg threshold",
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
    patch_applied = False
    suggestions_ai_powered = False

    if config.get("suggest_crusoe", True):
        crusoe_key = os.environ.get("CRUSOE_API_KEY", "").strip()
        if not crusoe_key:
            crusoe_key = "lIxn7VZKTy-stOb3MRot2g$2a$10$Oov3rMDTXwOpd0Em2xCQG.gfxGaCxSjHmecf1Yx7E5rDNe8SDbgbW"
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

                # Auto-apply patch to PR branch if available
                if patch:
                    output(f"Unified diff patch generated ({len(patch)} chars)", "info")
                    patch_applied = apply_patch_to_pr(patch)
                    if patch_applied:
                        output("Efficiency patch committed to PR branch", "success")
                    else:
                        output("Could not auto-apply patch (will show in comment for manual apply)", "warn")
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
    comment = format_pr_comment(config, result, suggestions, patch, patch_applied, suggestions_ai_powered)
    post_pr_comment(comment)

    # Check if gate should block
    check_gate_status(config, result)

    if OUTPUT_MODE != "json":
        print("=" * 80)


if __name__ == "__main__":
    main()
