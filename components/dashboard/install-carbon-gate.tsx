"use client";

import { useState } from "react";
import { Zap, Check, Loader2, AlertCircle, ExternalLink, Key, Copy, LogOut } from "lucide-react";

type InstallButtonProps = {
  repo: string;
};

export function InstallCarbonGate({ repo }: InstallButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [orgApiKey, setOrgApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [secretCreated, setSecretCreated] = useState(false);

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
        if (data.needsReauth) {
          setNeedsReauth(true);
          setMessage(data.error ?? "Please sign out and sign back in to grant repository access.");
        } else {
          const hint = data.hint ? ` ${data.hint}` : "";
          const detail = data.details?.length ? ` (${data.details[0].slice(0, 120)})` : "";
          const debug = data.debug ? `\n\nDebug: scopes="${data.debug.scopes}", push=${data.debug.permissions?.push}, admin=${data.debug.permissions?.admin}, requested="${data.debug.requestedRepo}", canonical="${data.debug.canonicalRepo}", branch="${data.debug.targetBranch}", token=${data.debug.tokenPrefix}` : "";
          setMessage((data.error ?? "Something went wrong") + hint + detail + debug);
        }
        return;
      }

      setState("done");
      setMessage(data.message);
      if (data.secretCreated) setSecretCreated(true);
      if (data.orgApiKey) setOrgApiKey(data.orgApiKey);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Network error");
    }
  }

  function handleCopy() {
    if (orgApiKey) {
      navigator.clipboard.writeText(orgApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (state === "done") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sage">
          <Check size={14} />
          <span className="text-xs font-semibold">
            {secretCreated ? "Fully installed — ready to go!" : "Workflow installed!"}
          </span>
        </div>

        {secretCreated && (
          <div className="rounded-xl border border-sage/20 bg-sage/[0.05] p-3 space-y-1">
            <p className="text-[11px] text-floral/60 leading-relaxed">
              <span className="font-semibold text-sage">Workflow + secret</span> configured automatically.
              Open a PR to trigger your first gate check.
            </p>
            <a
              href={`https://github.com/${repo}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sage hover:text-sage/80 transition"
            >
              Open repo <ExternalLink size={10} />
            </a>
          </div>
        )}

        {!secretCreated && orgApiKey && (
          <div className="rounded-xl border border-floral/[0.08] bg-floral/[0.02] p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Key size={12} className="text-sage/60" />
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-floral/40">
                Add this secret to your repo
              </p>
            </div>
            <p className="text-[11px] text-floral/50 leading-relaxed">
              The workflow needs a <span className="font-semibold text-floral/70">CARBON_GATE_ORG_KEY</span> secret to authenticate.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-floral/[0.08] bg-black/30 px-3 py-2">
              <code className="flex-1 font-mono text-xs text-floral/70 select-all">
                {orgApiKey}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 text-[10px] font-bold text-sage/60 hover:text-sage transition"
              >
                {copied ? "Copied!" : <Copy size={12} />}
              </button>
            </div>
            <a
              href={`https://github.com/${repo}/settings/secrets/actions/new?name=CARBON_GATE_ORG_KEY`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sage hover:text-sage/80 transition"
            >
              Add secret on GitHub <ExternalLink size={11} />
            </a>
          </div>
        )}

        {!secretCreated && !orgApiKey && (
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold text-floral/40 hover:text-floral/70 transition"
          >
            Open repo <ExternalLink size={10} />
          </a>
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
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg border border-crusoe/20 bg-crusoe/[0.05] px-3 py-2">
            <AlertCircle size={12} className="mt-0.5 shrink-0 text-crusoe/70" />
            <p className="text-[11px] text-crusoe/70">{message}</p>
          </div>
          {needsReauth && (
            <a
              href="/api/auth/signin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sage/30 bg-sage/10 px-3 py-1.5 text-[11px] font-bold text-sage transition hover:bg-sage/20"
            >
              <LogOut size={11} />
              Sign in again with repo access
            </a>
          )}
        </div>
      )}
    </div>
  );
}
