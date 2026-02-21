"use client";

import { useState } from "react";
import { Zap, Check, Loader2, AlertCircle, Key, ExternalLink } from "lucide-react";

type InstallButtonProps = {
  repo: string;
  orgKey?: string;
};

export function InstallCarbonGate({ repo, orgKey }: InstallButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  async function handleInstall() {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/github/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Something went wrong");
        return;
      }

      setState("done");
      setMessage(data.message);
      setShowSecrets(true);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Network error");
    }
  }

  if (state === "done") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sage">
          <Check size={14} />
          <span className="text-xs font-semibold">Installed!</span>
        </div>
        {showSecrets && (
          <div className="rounded-xl border border-floral/[0.08] bg-floral/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Key size={12} className="text-crusoe/60" />
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-floral/40">
                Last step: Add repository secret
              </p>
            </div>
            <p className="text-xs text-floral/50 leading-relaxed">
              Go to your repo settings and add this secret so the workflow can authenticate:
            </p>
            {orgKey && (
              <div className="flex items-center gap-2 rounded-lg border border-floral/[0.08] bg-black/30 px-3 py-2">
                <code className="flex-1 font-monoData text-xs text-floral/70">
                  CARBON_GATE_ORG_KEY={orgKey}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(orgKey)}
                  className="shrink-0 text-[10px] font-bold text-crusoe/60 hover:text-crusoe"
                >
                  Copy
                </button>
              </div>
            )}
            <a
              href={`https://github.com/${repo}/settings/secrets/actions/new`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sage hover:text-sage/80 transition"
            >
              Open GitHub Secrets <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleInstall}
        disabled={state === "loading"}
        className="inline-flex items-center gap-2 rounded-lg border border-sage/30 bg-sage/10 px-4 py-2 text-xs font-bold text-sage transition hover:bg-sage/20 disabled:opacity-50"
      >
        {state === "loading" ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Installing…
          </>
        ) : (
          <>
            <Zap size={12} />
            Install Carbon Gate
          </>
        )}
      </button>
      {state === "error" && message && (
        <div className="flex items-start gap-2 rounded-lg border border-crusoe/20 bg-crusoe/[0.05] px-3 py-2">
          <AlertCircle size={12} className="mt-0.5 shrink-0 text-crusoe/70" />
          <p className="text-[11px] text-crusoe/70">{message}</p>
        </div>
      )}
    </div>
  );
}
