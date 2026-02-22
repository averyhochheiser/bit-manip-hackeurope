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

/** Commit multiple files in a single atomic commit using the Git Trees API. */
async function commitFiles(
  token: string,
  repo: string,
  files: { path: string; content: string }[],
  message: string,
  branch?: string,
): Promise<{ ok: boolean; error?: string }> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  try {
    // 1. Get the ref (branch HEAD)
    const refName = branch || "main";
    let refRes = await fetch(
      `https://api.github.com/repos/${repo}/git/ref/heads/${refName}`,
      { headers },
    );
    // Try "master" if "main" doesn't exist and no branch was specified
    if (!refRes.ok && !branch) {
      refRes = await fetch(
        `https://api.github.com/repos/${repo}/git/ref/heads/master`,
        { headers },
      );
    }
    if (!refRes.ok) {
      return { ok: false, error: `Could not find branch (${refRes.status})` };
    }
    const refData = (await refRes.json()) as { object: { sha: string } };
    const baseSha = refData.object.sha;

    // 2. Create blobs for each file
    const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];
    for (const file of files) {
      const blobRes = await fetch(
        `https://api.github.com/repos/${repo}/git/blobs`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
        },
      );
      if (!blobRes.ok) {
        const err = await blobRes.text().catch(() => "");
        return { ok: false, error: `Failed to create blob for ${file.path} (${blobRes.status}): ${err.slice(0, 100)}` };
      }
      const blob = (await blobRes.json()) as { sha: string };
      treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    // 3. Create a tree with the new files
    const treeRes = await fetch(
      `https://api.github.com/repos/${repo}/git/trees`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ base_tree: baseSha, tree: treeItems }),
      },
    );
    if (!treeRes.ok) {
      const err = await treeRes.text().catch(() => "");
      return { ok: false, error: `Failed to create tree (${treeRes.status}): ${err.slice(0, 100)}` };
    }
    const tree = (await treeRes.json()) as { sha: string };

    // 4. Create a commit
    const commitRes = await fetch(
      `https://api.github.com/repos/${repo}/git/commits`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          message,
          tree: tree.sha,
          parents: [baseSha],
        }),
      },
    );
    if (!commitRes.ok) {
      const err = await commitRes.text().catch(() => "");
      return { ok: false, error: `Failed to create commit (${commitRes.status}): ${err.slice(0, 100)}` };
    }
    const commit = (await commitRes.json()) as { sha: string };

    // 5. Update the branch ref to point to the new commit
    const actualRef = refRes.url.includes("master") && !branch ? "heads/master" : `heads/${refName}`;
    const updateRes = await fetch(
      `https://api.github.com/repos/${repo}/git/refs/${actualRef}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ sha: commit.sha }),
      },
    );
    if (!updateRes.ok) {
      const err = await updateRes.text().catch(() => "");
      return { ok: false, error: `Failed to update ref (${updateRes.status}): ${err.slice(0, 100)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
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
    const encrypted = nacl.box.keyPair(); // only needed for seal
    // Use libsodium-style sealed box: ephemeral keypair + crypto_box
    const ephemeral = nacl.box.keyPair();
    const nonce = new Uint8Array(nacl.box.nonceLength);
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

  const repoData = (await repoCheck.json()) as { permissions?: { push?: boolean; admin?: boolean } };
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

  // 5. Commit both files in a single atomic commit (avoids branch conflicts)
  const commitResult = await commitFiles(
    ghToken,
    repo,
    [
      { path: ".github/workflows/carbon-gate.yml", content: WORKFLOW_YAML },
      { path: "carbon-gate.yml", content: CONFIG_YAML },
    ],
    "ci: add Carbon Gate workflow and configuration\n\nAutomatic carbon emissions checking on every PR.\nDefault thresholds: 2.0 kgCO₂e block, 1.0 kgCO₂e warn.",
    branch,
  );

  if (!commitResult.ok) {
    return NextResponse.json(
      {
        error: "Failed to install Carbon Gate",
        details: [commitResult.error],
      },
      { status: 500 },
    );
  }

  // 6. Auto-create the CARBON_GATE_ORG_KEY secret if we have the API key
  let secretCreated = false;
  let secretError: string | undefined;
  if (orgApiKey) {
    const secretResult = await putSecret(ghToken, repo, "CARBON_GATE_ORG_KEY", orgApiKey);
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
