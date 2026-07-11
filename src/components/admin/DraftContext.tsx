"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import DeployToast from "@/components/admin/DeployToast";

// Archivio BOZZE dell'admin. Le modifiche di Calendario/Contenuti/Immagini non si
// pubblicano subito (niente commit/redeploy a ogni tab): con "Salva" finiscono qui
// (in memoria + sessionStorage, così sopravvivono a cambio tab/menu e a un refresh),
// e con "Pubblica" vengono committate TUTTE insieme.
//
// Chiave bozza = "<sezione>:<unitId>":
//   - "calendar:<unit>"  → { defaultPrice, overrides }         → POST /api/admin/save?unit=
//   - "content:<unit>"   → oggetto content completo (testi + immagini, condiviso da
//                          Contenuti e Immagini)                → POST /api/admin/content?unit=
const STORAGE_KEY = "dimora-admin-drafts-v1";

type Drafts = Record<string, unknown>;
type PublishState = "idle" | "publishing" | "success" | "error";

interface DraftContextValue {
  // true quando le bozze sono state lette da sessionStorage (dopo il primo render
  // client). Gli editor si rimontano quando passa a true, così dopo un refresh leggono
  // la bozza e non i dati del server.
  hydrated: boolean;
  setDraft: (key: string, value: unknown) => void;
  getDraft: <T = unknown>(key: string) => T | undefined;
  pending: number;
  discardAll: () => void;
  publish: () => Promise<void>;
  publishState: PublishState;
  publishError: string;
}

const Ctx = createContext<DraftContextValue | null>(null);

export function useDrafts(): DraftContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDrafts deve essere usato dentro <DraftProvider>");
  return c;
}

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [hydrated, setHydrated] = useState(false);
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishError, setPublishError] = useState("");
  const [lastCommitSha, setLastCommitSha] = useState<string | null>(null);

  // Idrata da sessionStorage al mount: sync da un sistema esterno (storage), legittimo.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s) setDrafts(JSON.parse(s));
    } catch { /* storage non disponibile / JSON corrotto: si riparte vuoti */ }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persiste a ogni cambio (dopo l'idratazione, per non sovrascrivere subito con {}).
  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(drafts)); } catch { /* ignora */ }
  }, [drafts, hydrated]);

  const setDraft = useCallback((key: string, value: unknown) => {
    setDrafts((d) => ({ ...d, [key]: value }));
  }, []);
  const getDraft = useCallback(<T,>(key: string): T | undefined => drafts[key] as T | undefined, [drafts]);
  const discardAll = useCallback(() => setDrafts({}), []);

  const publish = useCallback(async () => {
    const entries = Object.entries(drafts);
    if (entries.length === 0) return;
    setPublishState("publishing");
    setPublishError("");
    try {
      let sha: string | null = null;
      for (const [key, value] of entries) {
        const i = key.indexOf(":");
        const section = key.slice(0, i);
        const unit = key.slice(i + 1);
        const endpoint = section === "calendar" ? "save" : "content";
        const res = await fetch(`/api/admin/${endpoint}?unit=${encodeURIComponent(unit)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; commitSha?: string };
        if (!res.ok) throw new Error(data.error ?? "Pubblicazione fallita");
        if (data.commitSha) sha = data.commitSha;
      }
      setDrafts({});
      setLastCommitSha(sha);
      setPublishState("success");
      setTimeout(() => setPublishState("idle"), 4000);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Errore");
      setPublishState("error");
    }
  }, [drafts]);

  return (
    <Ctx.Provider
      value={{ hydrated, setDraft, getDraft, pending: Object.keys(drafts).length, discardAll, publish, publishState, publishError }}
    >
      {children}
      <DeployToast sha={lastCommitSha} onDone={() => setLastCommitSha(null)} />
    </Ctx.Provider>
  );
}
