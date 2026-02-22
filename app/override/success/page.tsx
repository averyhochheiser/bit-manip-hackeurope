/**
 * /override/success
 *
 * Shown after a successful Stripe payment for a SHA override.
 * Stripe appends ?session_id=SESS_... which we use to retrieve metadata
 * (sha, repo, check) server-side — nothing sensitive is exposed to the client.
 */

import { stripe } from "@/lib/stripe";

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function OverrideSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;

  let sha: string | null = null;
  let owner: string | null = null;
  let repo: string | null = null;
  let check: string | null = null;
  let pr: string | null = null;
  let amountFormatted: string | null = null;

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.metadata?.override_type === "sha") {
        sha = session.metadata.sha ?? null;
        owner = session.metadata.owner ?? null;
        repo = session.metadata.repo ?? null;
        check = session.metadata.check ?? null;
        pr = session.metadata.pr || null;
        if (session.amount_total != null && session.currency) {
          amountFormatted = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: session.currency.toUpperCase(),
          }).format(session.amount_total / 100);
        }
      }
    } catch {
      // Session not found or expired — show generic success
    }
  }

  const fullRepo = owner && repo ? `${owner}/${repo}` : repo ?? "your repository";
  const shortSha = sha ? sha.slice(0, 7) : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#23282E] px-4">
      <div className="max-w-lg w-full bg-[#2A3038] rounded-2xl shadow-panel p-8 space-y-6">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-sage/20 mx-auto">
          <svg
            className="w-8 h-8 text-sage"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Heading */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-white">
            Payment received
          </h1>
          <p className="text-gray-400 text-sm">
            Your carbon gate override has been activated.
          </p>
        </div>

        {/* Details */}
        {shortSha && (
          <div className="bg-[#1e2329] rounded-xl p-4 space-y-3 text-sm font-mono">
            <Row label="Commit" value={shortSha} />
            {fullRepo && <Row label="Repository" value={fullRepo} />}
            {check && <Row label="Check" value={check} />}
            {pr && <Row label="PR" value={`#${pr}`} />}
            {amountFormatted && <Row label="Amount paid" value={amountFormatted} />}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-crusoe/10 border border-crusoe/30 rounded-xl p-4 space-y-2">
          <p className="text-crusoe font-medium text-sm">Next steps</p>
          <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
            <li>Return to your pull request on GitHub.</li>
            <li>
              Re-run the <span className="font-mono bg-black/30 px-1 rounded">carbon-gate</span> check
              (Actions → Re-run jobs, or push a new commit).
            </li>
            <li>The gate will detect your paid override and pass automatically.</li>
          </ol>
        </div>

        <p className="text-xs text-gray-500 text-center">
          This override applies only to commit{" "}
          {shortSha ? (
            <span className="font-mono text-gray-400">{shortSha}</span>
          ) : (
            "the paid commit"
          )}{" "}
          and expires after 7 days.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}
