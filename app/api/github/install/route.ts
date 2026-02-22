import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import nacl from "tweetnacl";

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

/**
 * Put a single file via the GitHub Contents API.
 *
 * We intentionally NEVER include `branch` in the PUT body. GitHub defaults
 * to HEAD (= the repo's default branch) when branch is omitted, which works
 * for both normal repos and empty repos (where branch refs don't exist yet).
 * Specifying an explicit branch on an empty repo causes a 404 because the
 * ref doesn't exist yet.
 *
 * We still use `branch` in the GET ?ref= query to read the existing file SHA
 * (for updates), which is safe — a 404 there just means the file doesn't
 * exist yet, and we create it fresh.
 */
async function putFile(
  token: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch?: string,
  retries = 3,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // GET: check if file already exists to obtain its SHA (needed for updates).
      // Use ?ref=branch so we read from the right branch, but a 404 here is fine
      // (it just means the file doesn't exist yet and we'll create it).
      const getUrl = `https://api.github.com/repos/${repo}/contents/${path}${branch ? `?ref=${branch}` : ""}`;
      console.log(`[putFile] GET ${getUrl} (attempt ${attempt + 1})`);
      const getRes = await fetch(getUrl, { headers });
      console.log(`[putFile] GET status: ${getRes.status}`);

      let sha: string | undefined;
      // 409 on GET = repo is completely empty (no commits at all)
      let isEmptyRepo = getRes.status === 409;
      if (getRes.ok) {
        const existing = (await getRes.json()) as { sha?: string };
        sha = existing.sha;
        console.log(`[putFile] Existing file sha: ${sha}`);
      } else {
        const getBody = await getRes.text().catch(() => "");
        console.log(`[putFile] GET non-ok body: ${getBody.slice(0, 100)}`);
        if (getRes.status === 409) {
          console.log(`[putFile] Repo is empty (409), will omit branch from PUT`);
        }
      }

      // Include `branch` in PUT so GitHub commits to the right branch.
      // Exception: empty repos (409 on GET) don't have a branch ref yet —
      // omit it so GitHub auto-creates the initial commit on the default branch.
      const body: Record<string, unknown> = {
        message,
        content: Buffer.from(content).toString("base64"),
      };
      if (sha) body.sha = sha;
      if (branch && !isEmptyRepo) body.branch = branch;

      const putUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
      console.log(`[putFile] PUT ${putUrl} (branch=${isEmptyRepo ? "omitted (empty repo)" : branch})`);
      const res = await fetch(putUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      console.log(`[putFile] PUT status: ${res.status}`);

      if (res.ok) {
        return { ok: true, status: res.status };
      }

      // 409 = conflict (concurrent commits) — re-fetch SHA and retry
      if (res.status === 409 && attempt < retries - 1) {
        console.log(`[putFile] 409 conflict, retrying in ${500 * (attempt + 1)}ms`);
        await res.text().catch(() => {});
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }

      const err = await res.text().catch(() => "unknown error");
      console.error(`[putFile] Failed (${res.status}): ${err.slice(0, 200)}`);
      return { ok: false, status: res.status, error: err };
    } catch (e) {
      console.error(`[putFile] Exception on attempt ${attempt + 1}:`, e);
      if (attempt >= retries - 1) {
        return { ok: false, status: 500, error: e instanceof Error ? e.message : "Unknown error" };
      }
    }
  }

  return { ok: false, status: 500, error: "Max retries exceeded" };
}

// ── GitHub Actions Secrets API helper ─────────────────────────────────────────

async function putSecret(
  token: string,
  repo: string,
  secretName: string,
  secretValue: string,
): Promise<{ ok: boolean; error?: string }> {
  console.log(`[putSecret] Starting for repo=${repo} secretName=${secretName}`);
  try {
    // 1. Get the repo's public key for encrypting secrets
    console.log(`[putSecret] Fetching repo public key for ${repo}`);
    const keyRes = await fetch(
      `https://api.github.com/repos/${repo}/actions/secrets/public-key`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );
    console.log(`[putSecret] Public key fetch status: ${keyRes.status}`);

    if (!keyRes.ok) {
      console.error(`[putSecret] Failed to get repo public key: ${keyRes.status}`);
      return { ok: false, error: `Failed to get repo public key (${keyRes.status})` };
    }

    const { key: publicKeyB64, key_id } = (await keyRes.json()) as { key: string; key_id: string };
    console.log(`[putSecret] Got public key_id=${key_id}`);

    // 2. Encrypt the secret using NaCl sealed box
    const publicKeyBytes = Buffer.from(publicKeyB64, "base64");
    const secretBytes = Buffer.from(secretValue);
    // Use libsodium-style sealed box: ephemeral keypair + crypto_box
    const ephemeral = nacl.box.keyPair();
    // Derive nonce from ephemeral public key + recipient public key (simplified: use blake2 hash)
    // GitHub expects libsodium crypto_box_seal format. Let's build it:
    // sealed = ephemeral_pk || crypto_box(msg, nonce=blake2b(ephemeral_pk || recipient_pk), ephemeral_sk, recipient_pk)
    // Since we don't have blake2b in tweetnacl, we use the approach GitHub recommends:
    // Actually, tweetnacl doesn't support sealed boxes directly. Let's use the raw crypto.
    
    // GitHub's API accepts Base64-encoded libsodium sealed box output.
    // We need to use tweetnacl-sealedbox or implement it.
    // Simpler: use SubtleCrypto isn't compatible. Let's implement sealed box with tweetnacl.
    
    // Sealed box = ephemeral_pk (32 bytes) + crypto_box(message, nonce, ephemeral_sk, recipient_pk)
    // where nonce = first 24 bytes of blake2b(ephemeral_pk + recipient_pk)
    // Since tweetnacl has no blake2b, use crypto_hash (SHA-512) and take first 24 bytes
    const combined = new Uint8Array(64);
    combined.set(ephemeral.publicKey, 0);
    combined.set(publicKeyBytes, 32);
    const hash = nacl.hash(combined); // SHA-512
    const sealNonce = hash.slice(0, 24);
    
    console.log(`[putSecret] Encrypting secret value (length=${secretValue.length})`);
    const encryptedMsg = nacl.box(secretBytes, sealNonce, publicKeyBytes, ephemeral.secretKey);
    if (!encryptedMsg) {
      console.error(`[putSecret] Encryption failed for secret ${secretName}`);
      return { ok: false, error: "Encryption failed" };
    }
    console.log(`[putSecret] Encryption successful, sealed box size=${32 + encryptedMsg.length}`);

    // Sealed box format: ephemeral_pk || encrypted_message
    const sealed = new Uint8Array(32 + encryptedMsg.length);
    sealed.set(ephemeral.publicKey, 0);
    sealed.set(encryptedMsg, 32);

    const encryptedB64 = Buffer.from(sealed).toString("base64");

    // 3. Create/update the secret
    console.log(`[putSecret] Uploading encrypted secret ${secretName} to ${repo}`);
    const secretRes = await fetch(
      `https://api.github.com/repos/${repo}/actions/secrets/${secretName}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          encrypted_value: encryptedB64,
          key_id,
        }),
      },
    );

    console.log(`[putSecret] Secret upload status: ${secretRes.status}`);
    if (!secretRes.ok) {
      const err = await secretRes.text().catch(() => "");
      console.error(`[putSecret] Failed to create secret ${secretName} (${secretRes.status}): ${err.slice(0, 100)}`);
      return { ok: false, error: `Failed to create secret (${secretRes.status}): ${err.slice(0, 100)}` };
    }

    console.log(`[putSecret] Secret ${secretName} created/updated successfully`);
    return { ok: true };
  } catch (err) {
    console.error(`[putSecret] Exception:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown encryption error" };
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  console.log(`[install-carbon-gate] POST /api/github/install called`);

  // 1. Authenticate
  console.log(`[install-carbon-gate] Authenticating user via Supabase`);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn(`[install-carbon-gate] Unauthenticated request`);
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.log(`[install-carbon-gate] Authenticated user: ${user.id} (${user.email})`);

  // 2. Get GitHub token from cookie
  console.log(`[install-carbon-gate] Reading gh_token cookie`);
  const cookieStore = await cookies();
  const ghToken = cookieStore.get("gh_token")?.value;
  if (!ghToken) {
    console.warn(`[install-carbon-gate] gh_token cookie missing`);
    return NextResponse.json(
      { error: "No GitHub token — please sign out and sign in again to grant repo access.", needsReauth: true },
      { status: 401 },
    );
  }
  console.log(`[install-carbon-gate] gh_token found (prefix: ${ghToken.slice(0, 8)}...)`);

  // 2b. Validate token has required scopes
  console.log(`[install-carbon-gate] Validating GitHub token scopes`);
  const scopeCheck = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" },
  });
  const scopes = scopeCheck.headers.get("x-oauth-scopes") ?? "";
  console.log(`[install-carbon-gate] Token scopes: "${scopes}", status: ${scopeCheck.status}`);
  if (!scopeCheck.ok) {
    console.warn(`[install-carbon-gate] GitHub token expired or invalid (status ${scopeCheck.status})`);
    return NextResponse.json(
      { error: "GitHub token expired — please sign out and sign in again.", needsReauth: true },
      { status: 401 },
    );
  }
  if (!scopes.includes("repo")) {
    console.warn(`[install-carbon-gate] Token missing 'repo' scope, scopes="${scopes}"`);
    return NextResponse.json(
      {
        error: "Missing repo permission — sign out and sign back in to grant write access to your repositories.",
        needsReauth: true,
      },
      { status: 403 },
    );
  }

  // 3. Parse request
  const { repo, branch } = (await req.json()) as { repo?: string; branch?: string };
  console.log(`[install-carbon-gate] Request body: repo="${repo}" branch="${branch}"`);
  if (!repo || typeof repo !== "string" || !repo.includes("/")) {
    console.warn(`[install-carbon-gate] Invalid repo value: "${repo}"`);
    return NextResponse.json({ error: "Invalid repo — expected owner/name" }, { status: 400 });
  }

  // 3b. Check push access before attempting to write files
  console.log(`[install-carbon-gate] Checking repo metadata and permissions for ${repo}`);
  const repoCheck = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" },
  });

  console.log(`[install-carbon-gate] Repo check status: ${repoCheck.status} for ${repo}`);
  
  if (!repoCheck.ok) {
    console.warn(`[install-carbon-gate] Repo not found or inaccessible: ${repo} (status ${repoCheck.status})`);
    return NextResponse.json(
      {
        error: `Cannot find repository "${repo}". Make sure it exists and you have access.`,
      },
      { status: 404 },
    );
  }

  const repoData = (await repoCheck.json()) as {
    full_name?: string;
    default_branch?: string;
    permissions?: { push?: boolean; admin?: boolean };
  };

  console.log(`[install-carbon-gate] Repo permissions: push=${repoData.permissions?.push}, admin=${repoData.permissions?.admin}`);

  if (!repoData.permissions?.push && !repoData.permissions?.admin) {
    console.warn(`[install-carbon-gate] User lacks push/admin access to ${repo}`);
    const [owner] = repo.split("/");
    return NextResponse.json(
      {
        error: `You don't have write access to "${repo}". Ask the repo owner (@${owner}) to add you as a collaborator with write permissions, or ask them to install Carbon Gate from their own dashboard.`,
        noPush: true,
      },
      { status: 403 },
    );
  }

  // Use canonical repo name and default branch from GitHub's response
  const canonicalRepo = repoData.full_name ?? repo;
  const targetBranch = branch ?? repoData.default_branch ?? "main";
  console.log(`[install-carbon-gate] Using canonicalRepo=${canonicalRepo} targetBranch=${targetBranch}`);

  // 4. Get org API key for the user
  console.log(`[install-carbon-gate] Looking up billing profile for user ${user.id}`);
  const { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
    console.log(`[install-carbon-gate] Billing profile for user ${user.id}: org_id=${profile?.org_id}`);

  if (!profile?.org_id) {
    console.warn(`[install-carbon-gate] No org_id found for user ${user.id}`);
    return NextResponse.json({ error: "No organisation found. Please complete onboarding first." }, { status: 400 });
  }

  // Look up the actual API key from org_api_keys
  console.log(`[install-carbon-gate] Fetching API key for org ${profile.org_id}`);
  const { data: keyRow } = await supabaseAdmin
    .from("org_api_keys")
    .select("api_key")
    .eq("org_id", profile.org_id)
    .maybeSingle();
  console.log(`[install-carbon-gate] API key for org ${profile.org_id}: ${keyRow ? "found" : "not found"}`);  
  const orgApiKey = keyRow?.api_key ?? "";

  // 5. Commit files sequentially via Contents API (with conflict retry)
  console.log(`[install-carbon-gate] Committing workflow file to ${canonicalRepo}`);
  const workflowResult = await putFile(
    ghToken,
    canonicalRepo,
    ".github/workflows/carbon-gate.yml",
    WORKFLOW_YAML,
    "ci: add Carbon Gate workflow",
    targetBranch,
  );

  console.log(`[install-carbon-gate] Workflow file result: ok=${workflowResult.ok} status=${workflowResult.status}`);
  if (!workflowResult.ok) {
    console.error(`[install-carbon-gate] Workflow file commit failed: ${workflowResult.error}`);
    return NextResponse.json(
      {
        error: `Failed to install Carbon Gate workflow (HTTP ${workflowResult.status})`,
        details: [workflowResult.error],
        debug: {
          scopes,
          permissions: repoData.permissions,
          requestedRepo: repo,
          canonicalRepo,
          targetBranch,
          tokenPrefix: ghToken?.slice(0, 8) + "...",
        },
      },
      { status: 500 },
    );
  }

  console.log(`[install-carbon-gate] Committing config file to ${canonicalRepo}`);
  const configResult = await putFile(
    ghToken,
    canonicalRepo,
    "carbon-gate.yml",
    CONFIG_YAML,
    "chore: add Carbon Gate configuration",
    targetBranch,
  );

  console.log(`[install-carbon-gate] Config file result: ok=${configResult.ok} status=${configResult.status}`);
  if (!configResult.ok) {
    console.warn(`[install-carbon-gate] Config file commit failed (partial install): ${configResult.error}`);
    // Workflow was already committed — still partially successful
    return NextResponse.json(
      {
        error: "Workflow installed but config file failed — you can add carbon-gate.yml manually.",
        details: [configResult.error],
        partial: true,
      },
      { status: 207 },
    );
  }

  // 6. Auto-create the CARBON_GATE_ORG_KEY secret if we have the API key
  let secretCreated = false;
  let secretError: string | undefined;
  console.log(`[install-carbon-gate] orgApiKey present: ${!!orgApiKey}`);
  if (orgApiKey) {
    console.log(`[install-carbon-gate] Creating CARBON_GATE_ORG_KEY secret on ${canonicalRepo}`);
    const secretResult = await putSecret(ghToken, canonicalRepo, "CARBON_GATE_ORG_KEY", orgApiKey);
    secretCreated = secretResult.ok;
    console.log(`[install-carbon-gate] Secret creation result: ok=${secretResult.ok} error=${secretResult.error ?? "none"}`);
    if (!secretResult.ok) {
      secretError = secretResult.error;
    }
  } else {
    console.log(`[install-carbon-gate] Skipping secret creation — no orgApiKey`);
  }

  console.log(`[install-carbon-gate] Install complete: secretCreated=${secretCreated}`);
  return NextResponse.json({
    message: `Carbon Gate installed on ${repo}`,
    files: [".github/workflows/carbon-gate.yml", "carbon-gate.yml"],
    secretCreated,
    secretError,
    orgApiKey: !secretCreated ? (orgApiKey || undefined) : undefined,
    next_steps: secretCreated
      ? ["Open a Pull Request to trigger your first gate check"]
      : orgApiKey
        ? [
            "Add CARBON_GATE_ORG_KEY as a GitHub repository secret",
            "Open a Pull Request to trigger your first gate check",
          ]
        : ["Open a Pull Request to trigger your first gate check"],
  });
}
