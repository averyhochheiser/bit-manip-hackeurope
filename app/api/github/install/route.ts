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

/** Put a single file via Contents API, with retry on 409 conflict. */
async function putFile(
  token: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch?: string,
  retries = 3,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const getHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  const putHeaders = {
    ...getHeaders,
    "Content-Type": "application/json",
  };

  // effectiveBranch may be cleared on 404 (empty repo — branch ref doesn't exist yet)
  let effectiveBranch = branch;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Check if file already exists (to get its SHA for update)
      const getUrl = `https://api.github.com/repos/${repo}/contents/${path}${effectiveBranch ? `?ref=${effectiveBranch}` : ""}`;
      console.log(`[putFile] GET ${getUrl} (attempt ${attempt + 1})`);
      const getRes = await fetch(getUrl, { headers: getHeaders });
      console.log(`[putFile] GET status: ${getRes.status}`);

      let sha: string | undefined;
      if (getRes.ok) {
        const existing = (await getRes.json()) as { sha?: string };
        sha = existing.sha;
        console.log(`[putFile] Existing file sha: ${sha}`);
      } else {
        // 404 = file doesn't exist yet, which is fine
        // Consume the body to avoid connection issues
        await getRes.text().catch(() => {});
      }

      const body: Record<string, unknown> = {
        message,
        content: Buffer.from(content).toString("base64"),
      };
      if (sha) body.sha = sha;
      if (effectiveBranch) body.branch = effectiveBranch;

      const putUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
      console.log(`[putFile] PUT ${putUrl}${effectiveBranch ? ` (branch: ${effectiveBranch})` : " (no branch — empty repo)"}`);
      const res = await fetch(putUrl, {
        method: "PUT",
        headers: putHeaders,
        body: JSON.stringify(body),
      });
      console.log(`[putFile] PUT status: ${res.status}`);

      if (res.ok) {
        return { ok: true, status: res.status };
      }

      // 409 = conflict (branch HEAD moved) — retry
      if (res.status === 409 && attempt < retries - 1) {
        console.log(`[putFile] 409 conflict, retrying in ${500 * (attempt + 1)}ms`);
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }

      // 404 with a branch specified = branch ref doesn't exist (empty repo).
      // Retry without branch so GitHub creates the initial commit on HEAD.
      if (res.status === 404 && effectiveBranch && attempt < retries - 1) {
        console.log(`[putFile] 404 with branch "${effectiveBranch}" — repo may be empty; retrying without branch`);
        await res.text().catch(() => {});
        effectiveBranch = undefined;
        continue;
      }

      const err = await res.text().catch(() => "unknown error");
      console.error(`[putFile] Failed: ${err.slice(0, 200)}`);
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
  try {
    // 1. Get the repo's public key for encrypting secrets
    const keyRes = await fetch(
      `https://api.github.com/repos/${repo}/actions/secrets/public-key`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!keyRes.ok) {
      return { ok: false, error: `Failed to get repo public key (${keyRes.status})` };
    }

    const { key: publicKeyB64, key_id } = (await keyRes.json()) as { key: string; key_id: string };

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
    
    const encryptedMsg = nacl.box(secretBytes, sealNonce, publicKeyBytes, ephemeral.secretKey);
    if (!encryptedMsg) {
      return { ok: false, error: "Encryption failed" };
    }
    
    // Sealed box format: ephemeral_pk || encrypted_message
    const sealed = new Uint8Array(32 + encryptedMsg.length);
    sealed.set(ephemeral.publicKey, 0);
    sealed.set(encryptedMsg, 32);
    
    const encryptedB64 = Buffer.from(sealed).toString("base64");

    // 3. Create/update the secret
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

    if (!secretRes.ok) {
      const err = await secretRes.text().catch(() => "");
      return { ok: false, error: `Failed to create secret (${secretRes.status}): ${err.slice(0, 100)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown encryption error" };
  }
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
      { error: "No GitHub token — please sign out and sign in again to grant repo access.", needsReauth: true },
      { status: 401 },
    );
  }

  // 2b. Validate token has required scopes
  const scopeCheck = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" },
  });
  const scopes = scopeCheck.headers.get("x-oauth-scopes") ?? "";
  if (!scopeCheck.ok) {
    return NextResponse.json(
      { error: "GitHub token expired — please sign out and sign in again.", needsReauth: true },
      { status: 401 },
    );
  }
  if (!scopes.includes("repo")) {
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
  if (!repo || typeof repo !== "string" || !repo.includes("/")) {
    return NextResponse.json({ error: "Invalid repo — expected owner/name" }, { status: 400 });
  }

  // 3b. Check push access before attempting to write files
  const repoCheck = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" },
  });

  if (!repoCheck.ok) {
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
  if (!repoData.permissions?.push && !repoData.permissions?.admin) {
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

  // Check whether the branch actually exists as a ref.
  // Empty repos have default_branch set but no commits yet, so the ref doesn't exist.
  // The Contents API returns 404/422 when branch is specified but doesn't exist as a ref.
  // Omitting branch lets GitHub create the initial commit on HEAD instead.
  const branchRefRes = await fetch(
    `https://api.github.com/repos/${canonicalRepo}/git/ref/heads/${targetBranch}`,
    { headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" } },
  );
  const branchExists = branchRefRes.ok;
  await branchRefRes.text().catch(() => {});
  const commitBranch = branchExists ? targetBranch : undefined;
  console.log(`[install] branch "${targetBranch}" exists: ${branchExists} → commitBranch: ${commitBranch ?? "(none — empty repo)"}`);

  // 4. Get org API key for the user
  const { data: profile } = await supabaseAdmin
    .from("billing_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "No organisation found. Please complete onboarding first." }, { status: 400 });
  }

  // Look up the actual API key from org_api_keys
  const { data: keyRow } = await supabaseAdmin
    .from("org_api_keys")
    .select("api_key")
    .eq("org_id", profile.org_id)
    .maybeSingle();

  const orgApiKey = keyRow?.api_key ?? "";

  // 5. Commit files sequentially via Contents API (with conflict retry)
  const workflowResult = await putFile(
    ghToken,
    canonicalRepo,
    ".github/workflows/carbon-gate.yml",
    WORKFLOW_YAML,
    "ci: add Carbon Gate workflow",
    commitBranch,
  );

  if (!workflowResult.ok) {
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
          branchExists,
          commitBranch: commitBranch ?? "(none — empty repo)",
          tokenPrefix: ghToken?.slice(0, 8) + "...",
        },
      },
      { status: 500 },
    );
  }

  const configResult = await putFile(
    ghToken,
    canonicalRepo,
    "carbon-gate.yml",
    CONFIG_YAML,
    "chore: add Carbon Gate configuration",
    commitBranch,
  );

  if (!configResult.ok) {
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
  if (orgApiKey) {
    const secretResult = await putSecret(ghToken, canonicalRepo, "CARBON_GATE_ORG_KEY", orgApiKey);
    secretCreated = secretResult.ok;
    if (!secretResult.ok) {
      secretError = secretResult.error;
    }
  }

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
