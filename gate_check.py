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


def get_pr_file_contents(max_files: int = 5) -> Optional[dict]:
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
        for f in python_files[:max_files]:
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


def call_crusoe_for_refactoring(diff: str, config: dict, files_content: dict) -> Optional[dict]:
    """
    Send the PR diff to Crusoe's LLM and return complete refactored code files
    for carbon efficiency improvements.
    Returns dict with {filename: refactored_code} or None if unavailable.
    """
    crusoe_api_key = os.environ.get("CRUSOE_API_KEY", "").strip()
    if not crusoe_api_key:
        return None

    gpu = config.get("gpu", "A100")
    estimated_hours = config.get("estimated_hours", 1.0)

    # Prepare full file contents for context
    files_section = ""
    for filename, content in files_content.items():
        files_section += f"\n### {filename}\n```python\n{content}\n```\n"

    prompt = f"""You are a carbon-efficiency expert refactoring ML training code to reduce energy consumption.

The training job runs on **{gpu}** GPUs for approximately **{estimated_hours} h** and has HIGH CARBON EMISSIONS.

**Your task:** Refactor the code below to significantly reduce compute time and energy usage while maintaining functionality.

**Focus on:**
- Adding mixed-precision training (`torch.cuda.amp.autocast`, `GradScaler`)
- Implementing gradient checkpointing for large models
- Optimizing data loading (increase `num_workers`, enable `pin_memory`, prefetch)
- Reducing unnecessary CPU↔GPU transfers
- Adding early stopping when validation loss plateaus
- Removing redundant computations or forward passes
- Optimizing batch size and gradient accumulation

**CRITICAL - Output format (you MUST follow this exactly):**

For each file that needs changes, use this EXACT format:

=== FILENAME: path/to/file.py ===
```python
# Complete refactored code here
import torch
...
```
=== END ===

**Example:**
=== FILENAME: train.py ===
```python
import torch
from torch.cuda.amp import autocast, GradScaler

def train():
    model = MyModel().cuda()
    scaler = GradScaler()
    ...
```
=== END ===

Only refactor files where you can make meaningful carbon-efficiency improvements.

## Current Code
{files_section}

## Recent Changes (for context)
{diff}

Provide complete, runnable refactored code."""

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
                "max_tokens": 2500,
                "temperature": 0.2,
            },
            timeout=90,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()
        
        output(f"Received response from Crusoe AI ({len(content)} chars)", "debug")
        
        # Debug: Save response to file if in debug mode
        if os.environ.get("DEBUG_REFACTOR"):
            with open("crusoe_refactor_response.txt", "w") as f:
                f.write(content)
            output("Saved AI response to crusoe_refactor_response.txt", "debug")
        
        # Parse the response to extract refactored files
        refactored = {}
        
        # Try parsing with the expected format first
        if "=== FILENAME:" in content and "=== END ===" in content:
            parts = content.split("=== FILENAME:")
            for part in parts[1:]:  # Skip first empty part
                if "=== END ===" in part:
                    try:
                        header, code_section = part.split("===", 1)
                        filename = header.strip()
                        code = code_section.replace("END ===", "").strip()
                        
                        # Remove markdown code fences if present
                        if code.startswith("```python") or code.startswith("```"):
                            lines = code.split("\n")
                            # Remove first line (```python or ```) and last line (```)
                            if lines[-1].strip() == "```":
                                code = "\n".join(lines[1:-1])
                            else:
                                code = "\n".join(lines[1:])
                        
                        if filename and code:
                            refactored[filename] = code
                            output(f"Parsed refactored file: {filename} ({len(code)} chars)", "debug")
                    except Exception as e:
                        output(f"Error parsing refactored section: {e}", "warn")
                        continue
        else:
            # Fallback: AI might have just returned code without special markers
            output("AI response doesn't contain expected format markers, attempting fallback parsing", "warn")
            # Try to extract any Python code blocks
            if "```python" in content:
                blocks = content.split("```python")
                for i, block in enumerate(blocks[1:], 1):
                    if "```" in block:
                        code = block.split("```")[0].strip()
                        if code:
                            refactored[f"refactored_code_{i}.py"] = code
                            output(f"Extracted code block {i} ({len(code)} chars)", "debug")
        
        if not refactored:
            output("No refactored code could be extracted from AI response", "warn")
            output(f"Response preview: {content[:500]}...", "debug")
        
        return refactored if refactored else None
    except Exception as e:
        output(f"Crusoe refactoring call failed: {e}", "warn")
        return None


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
    """Call the Carbon Gate API to check emissions"""
    api_endpoint = os.environ.get("API_ENDPOINT", "https://carbon-gate.vercel.app")
    org_api_key = os.environ.get("ORG_API_KEY")
    repo = os.environ.get("GITHUB_REPOSITORY")
    pr_number = os.environ.get("PR_NUMBER")

    if not pr_number:
        output("Not a pull request event, skipping Carbon Gate check", "info")
        sys.exit(0)

    payload = {
        "repo": repo,
        "pr_number": int(pr_number),
        "gpu": config.get("gpu", "A100"),
        "estimated_hours": config.get("estimated_hours", 1.0),
        "region": config.get("region", "us-east-1"),
        "api_key": org_api_key,
    }

    output(
        f"Running Carbon Gate check for PR #{pr_number}",
        "info",
        {
            "gpu": payload["gpu"],
            "estimated_hours": payload["estimated_hours"],
            "region": payload["region"],
        },
    )

    try:
        response = requests.post(
            f"{api_endpoint}/api/gate/check",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        output(f"API call failed: {e}", "error")
        # For demo purposes, return mock data if API isn't ready yet
        output("Using mock data for development", "warn")
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
            "pue_used": 1.15,
        }


def format_pr_comment(config, result, suggestions: Optional[str] = None, refactored_code: Optional[dict] = None, suggestions_ai_powered: bool = True):
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

    # Determine status with educational messaging
    if status == "block":
        status_text = f"**Exceeds carbon threshold** ({threshold_kg} kg)"
        status_message = (
            f"**Energy Impact Alert** — This training job will consume significant energy resources. "
            f"At {emissions:.2f} kgCO₂eq, it exceeds your organization's carbon threshold."
        )
    elif status == "warn":
        status_text = f"**High emissions warning** ({warn_kg} kg)"
        status_message = (
            f"**Optimization Opportunity** — This training job will emit {emissions:.2f} kgCO₂eq. "
            f"While within limits, there are cleaner alternatives available that could reduce environmental impact significantly."
        )
    else:
        status_text = "Within acceptable limits"
        status_message = f"This training job is estimated at {emissions:.2f} kgCO₂eq, which is within your configured limits."

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

    comment = f"""## Carbon Gate — Energy Impact Report

{status_message}

---

### Emissions Estimate

| Metric | Value |
|--------|-------|
| **Carbon Footprint** | {emissions:.2f} kgCO₂eq {status_text} |
| **Grid Carbon Intensity** | {carbon_intensity} gCO₂/kWh ({config.get('region', 'us-east-1')}) |
| **Equivalent Impact** | ~{car_miles:.0f} miles driven by car, or {trees_needed:.1f} trees needed to grow for 1 year to absorb the CO2 emissions from the job |
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
            _suggestion_note = "> *Analysed by [Crusoe Cloud](https://crusoe.ai) — geothermal-powered AI inference (~5 gCO₂/kWh)*"
        else:
            _suggestion_note = "> *Recommended optimisations for your training config. Add CRUSOE_API_KEY for code-specific AI analysis via Crusoe Cloud.*"
        comment += f"""---

### 🧠 Code Efficiency Suggestions

{_suggestion_note}

{suggestions}

"""

    if refactored_code:
        comment += """---

### 🤖 AI-Generated Carbon-Optimized Code

> *Crusoe AI has refactored your code to reduce energy consumption*

"""
        for filename, code in refactored_code.items():
            comment += f"""<details>
<summary><b>📄 {filename}</b> — Click to view refactored code</summary>

```python
{code}
```

**To apply this refactoring:**
1. Review the changes carefully
2. Copy the refactored code above
3. Replace your current implementation
4. Test thoroughly before merging
5. Re-run the Carbon Gate check to see the reduction

</details>

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
    emissions = result["emissions_kg"]

    if status == "block":
        output(
            f"GATE BLOCKED: Emissions ({emissions:.2f} kg) exceed threshold ({threshold_kg} kg)",
            "error",
            {
                "emissions_kg": emissions,
                "threshold_kg": threshold_kg,
                "status": "block",
            },
        )
        output("Add 'carbon-override' label to bypass, or reroute to Crusoe", "info")
        sys.exit(1)
    elif status == "warn":
        output(
            f"WARNING: High carbon emissions ({emissions:.2f} kg)",
            "warn",
            {"emissions_kg": emissions, "threshold_kg": threshold_kg, "status": "warn"},
        )
        output(
            "Consider rerouting to Crusoe or waiting for optimal grid window", "info"
        )
    else:
        output(
            f"GATE PASSED: Emissions ({emissions:.2f} kg) within acceptable limits",
            "success",
            {"emissions_kg": emissions, "threshold_kg": threshold_kg, "status": "pass"},
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
        output(f"Overriding status to 'block' (emissions {emissions_kg:.2f} kg >= threshold {threshold_kg} kg)", "info")
    elif emissions_kg >= warn_kg:
        result["status"] = "warn"
        output(f"Overriding status to 'warn' (emissions {emissions_kg:.2f} kg >= warning {warn_kg} kg)", "info")
    else:
        result["status"] = "pass"
        output(f"Status: 'pass' (emissions {emissions_kg:.2f} kg < warning {warn_kg} kg)", "info")

    # Fetch AI code suggestions from Crusoe (opt-in via suggest_crusoe config + CRUSOE_API_KEY)
    suggestions = None
    refactored_code = None
    
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
                    output("Crusoe API returned no content, using static suggestions", "warn")
            else:
                output("No Python file changes found in PR diff, using static suggestions", "info")
        else:
            output("CRUSOE_API_KEY not set — using static efficiency suggestions", "warn")

        if not suggestions:
            suggestions = get_static_suggestions(config)
            output("Using static carbon-efficiency suggestions", "info")
    else:
        output("AI suggestions disabled (suggest_crusoe: false in config)", "info")

    # Generate refactored code for high-emission PRs (opt-in via auto_refactor config)
    status = result.get("status", "pass")
    if (
        config.get("auto_refactor", False)
        and os.environ.get("CRUSOE_API_KEY", "").strip()
        and status in ["warn", "block"]
    ):
        output(f"High emissions detected ({status}), generating AI code refactoring...", "info")
        diff = get_pr_diff()
        file_contents = get_pr_file_contents()
        
        if diff and file_contents:
            try:
                refactored_code = call_crusoe_for_refactoring(diff, config, file_contents)
                if refactored_code:
                    file_count = len(refactored_code)
                    output(f"Successfully generated refactored code for {file_count} file(s)", "success")
                    output(f"Files refactored: {', '.join(refactored_code.keys())}", "debug")
                else:
                    output("Crusoe refactoring call returned no content, skipping", "warn")
            except Exception as e:
                output(f"Error during refactoring: {e}", "error")
                refactored_code = None
        else:
            output("No Python files to refactor", "info")

    # Format and post PR comment
    comment = format_pr_comment(config, result, suggestions, refactored_code, suggestions_ai_powered)
    post_pr_comment(comment)

    # Check if gate should block
    check_gate_status(config, result)

    if OUTPUT_MODE != "json":
        print("=" * 80)


if __name__ == "__main__":
    main()
