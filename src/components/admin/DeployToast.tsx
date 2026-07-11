"use client";

import { useEffect, useRef, useState } from "react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";

type DeployState = "building" | "ready" | "error";

const POLL_MS = 5000;
const MAX_POLLS = 60; // ~5 minuti

// Toast fisso in basso a destra che monitora il deploy Vercel del commit
// appena salvato (via GitHub Deployments API). Compare quando sha è valorizzato.
export default function DeployToast({
  sha,
  onDone,
}: {
  sha: string | null;
  onDone: () => void;
}) {
  const { t } = useAdminLanguage();
  const [state, setState] = useState<DeployState>("building");
  const polls = useRef(0);

  useEffect(() => {
    if (!sha) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("building");
    polls.current = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;
      polls.current += 1;
      try {
        const res = await fetch(`/api/admin/deploy-status?sha=${sha}`);
        const data = (await res.json()) as { state?: string };
        if (cancelled) return;
        if (data.state === "ready") {
          setState("ready");
          setTimeout(() => !cancelled && onDone(), 4000);
          return;
        }
        if (data.state === "error") {
          setState("error");
          return;
        }
      } catch {
        // errore di rete transitorio: continua a fare polling
      }
      if (polls.current < MAX_POLLS) {
        timer = setTimeout(poll, POLL_MS);
      } else {
        onDone(); // timeout: nascondi senza esito
      }
    }

    timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sha]);

  if (!sha) return null;

  const styles: Record<DeployState, string> = {
    building: "border-gold/50 bg-background text-foreground/80",
    ready: "border-green-500/50 bg-green-50 text-green-800",
    error: "border-red-500/50 bg-red-50 text-red-800",
  };
  const icons: Record<DeployState, string> = {
    building: "⏳",
    ready: "✅",
    error: "❌",
  };
  const labels: Record<DeployState, string> = {
    building: t.deploy.building,
    ready: t.deploy.ready,
    error: t.deploy.error,
  };

  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg text-sm ${styles[state]}`}
    >
      <span className={`text-lg leading-none ${state === "building" ? "animate-pulse" : ""}`}>
        {icons[state]}
      </span>
      {labels[state]}
      {state === "error" && (
        <button
          onClick={onDone}
          className="ml-2 text-red-800/60 hover:text-red-800 transition"
          aria-label={t.common.close}
        >
          ✕
        </button>
      )}
    </div>
  );
}
