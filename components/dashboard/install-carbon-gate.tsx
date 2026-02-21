"use client";

import { useState } from "react";
import { Zap, Check, Loader2, AlertCircle, ExternalLink, Key, Copy } from "lucide-react";

type InstallButtonProps = {
  repo: string;
};

export function InstallCarbonGate({ repo }: InstallButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [orgApiKey, setOrgApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
          <span className="text-xs font-semibold">Workflow installed!</span>
        </div>

        {orgApiKey && (
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

        {!orgApiKey && (
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
        <div className="flex items-start gap-2 rounded-lg border border-crusoe/20 bg-crusoe/[0.05] px-3 py-2">
          <AlertCircle size={12} className="mt-0.5 shrink-0 text-crusoe/70" />
          <p className="text-[11px] text-crusoe/70">{message}</p>
        </div>
      )}
    </div>
  );
}
