import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ── Workflow template ────────────────────────────────────────────────────────
// This is what gets committed to .github/workflows/carbon-gate.yml
// Uses the public action reference so it works on any repo.

const WORKFLOW_YAML = `name: Carbon Gate Check

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write
  contents: write

jobs:
  carbon-gate:
    runs-on: ubuntu-latest
    name: Check Carbon Emissions
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Carbon Gate
        uses: averyhochheiser/bit-manip-hackeurope@eva/backend-api
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
          api-endpoint: "https://bit-manip-hackeurope.vercel.app"
          org-api-key: \${{ secrets.CARBON_GATE_ORG_KEY }}
          crusoe-api-key: \${{ secrets.CRUSOE_API_KEY }}
`;

const CONFIG_YAML = `carbon-gate:
  estimated_hours: 4.0
  gpu: H100
  region: us-east-1

  # Emission thresholds (kgCO₂e)
  threshold_kg_co2: 2.0
  warn_kg_co2: 1.0

  # AI-powered suggestions via Crusoe Cloud
  suggest_crusoe: true
  auto_refactor: true

  security:
    allowed_teams: []
    max_overrides_per_month: 5
    notify_on_override: true
    override_permission: admin
    require_justification: true
`;

// ── GitHub Contents API helper ───────────────────────────────────────────────

async function putFile(
  token: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch?: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const base64 = Buffer.from(content).toString("base64");

  // Check if file already exists (to get its SHA for update)
  const getRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}${branch ? `?ref=${branch}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  let sha: string | undefined;
  if (getRes.ok) {
    const existing = (await getRes.json()) as { sha?: string };
    sha = existing.sha;
  }

  const body: Record<string, unknown> = {
    message,
    content: base64,
  };
  if (sha) body.sha = sha;
  if (branch) body.branch = branch;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    return { ok: false, status: res.status, error: err };
  }

  return { ok: true, status: res.status };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Authenticate
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2. Get GitHub token from cookie
  const cookieStore = await cookies();
  const ghToken = cookieStore.get("gh_token")?.value;
  if (!ghToken) {
    return NextResponse.json(
      { error: "No GitHub token — please sign out and sign in again to grant repo access." },
      { status: 401 },
    );
  }

  // 3. Parse request
  const { repo, branch } = (await req.json()) as { repo?: string; branch?: string };
  if (!repo || typeof repo !== "string" || !repo.includes("/")) {
    return NextResponse.json({ error: "Invalid repo — expected owner/name" }, { status: 400 });
  }

  // 4. Get org API key for the user
  const { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const orgKey = profile?.org_id ?? ""; // org_id doubles as the API key for now

  // 5. Commit both files
  const results = await Promise.all([
    putFile(
      ghToken,
      repo,
      ".github/workflows/carbon-gate.yml",
      WORKFLOW_YAML,
      "ci: add Carbon Gate workflow\n\nAutomatic carbon emissions checking on every PR.",
      branch,
    ),
    putFile(
      ghToken,
      repo,
      "carbon-gate.yml",
      CONFIG_YAML,
      "chore: add Carbon Gate configuration\n\nDefault thresholds: 2.0 kgCO₂e block, 1.0 kgCO₂e warn.",
      branch,
    ),
  ]);

  const [workflowResult, configResult] = results;

  if (!workflowResult.ok || !configResult.ok) {
    const errors = results.filter((r) => !r.ok).map((r) => r.error);
    return NextResponse.json(
      {
        error: "Failed to install Carbon Gate",
        details: errors,
        hint: workflowResult.status === 404
          ? "Make sure you have push access to this repository."
          : undefined,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: `Carbon Gate installed on ${repo}`,
    files: [".github/workflows/carbon-gate.yml", "carbon-gate.yml"],
    next_steps: [
      orgKey
        ? `Add CARBON_GATE_ORG_KEY=${orgKey} as a GitHub repository secret`
        : "Add your CARBON_GATE_ORG_KEY as a GitHub repository secret (find it in Settings)",
      "Optionally add CRUSOE_API_KEY for AI-powered optimization suggestions",
      "Open a Pull Request to trigger your first gate check",
    ],
    orgKey: orgKey || undefined,
  });
}
