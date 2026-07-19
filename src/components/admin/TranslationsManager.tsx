"use client";

import { useEffect, useState } from "react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import type { AdminLocaleCode } from "@/i18n/admin";

// Gestione della chiave Anthropic per-sito (opzionale, cifrata nel DB), usata per la
// traduzione automatica di contenuti e recensioni. Vive nella sezione "Traduzioni"
// del pannello (Il tuo sito) — prima era annegata dentro la Sincronizzazione calendari.

type State = "idle" | "saving" | "success" | "error";
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface Labels {
  title: string;
  desc: string;
  set: string;
  unset: string;
  ph: string;
  saveBtn: string;
  remove: string;
  saved: string;
  saving: string;
  saveError: string;
  demo: string;
}

const LABELS: Record<AdminLocaleCode, Labels> = {
  it: {
    title: "Traduzione automatica (chiave Anthropic)",
    desc: "Le traduzioni dei contenuti e delle recensioni usano l'AI. Puoi usare una tua chiave Anthropic; se non la imposti, viene usata la chiave predefinita del gestore.",
    set: "Chiave personale impostata ✓",
    unset: "Nessuna chiave personale: si usa quella predefinita del gestore.",
    ph: "sk-ant-…",
    saveBtn: "Salva chiave",
    remove: "Rimuovi",
    saved: "Chiave salvata.",
    saving: "Salvataggio…",
    saveError: "Si è verificato un errore. Riprova.",
    demo: "In demo la chiave non viene salvata.",
  },
  en: {
    title: "Automatic translation (Anthropic key)",
    desc: "Content and review translations use AI. You can use your own Anthropic key; if you don't set one, the provider's default key is used.",
    set: "Personal key set ✓",
    unset: "No personal key: the provider's default is used.",
    ph: "sk-ant-…",
    saveBtn: "Save key",
    remove: "Remove",
    saved: "Key saved.",
    saving: "Saving…",
    saveError: "Something went wrong. Try again.",
    demo: "In the demo the key isn't saved.",
  },
  es: {
    title: "Traducción automática (clave Anthropic)",
    desc: "Las traducciones de contenidos y reseñas usan IA. Puedes usar tu propia clave Anthropic; si no configuras ninguna, se usa la clave predeterminada del gestor.",
    set: "Clave personal configurada ✓",
    unset: "Sin clave personal: se usa la predeterminada del gestor.",
    ph: "sk-ant-…",
    saveBtn: "Guardar clave",
    remove: "Quitar",
    saved: "Clave guardada.",
    saving: "Guardando…",
    saveError: "Se produjo un error. Inténtalo de nuevo.",
    demo: "En la demo la clave no se guarda.",
  },
  fr: {
    title: "Traduction automatique (clé Anthropic)",
    desc: "Les traductions des contenus et des avis utilisent l'IA. Vous pouvez utiliser votre propre clé Anthropic ; sans clé, la clé par défaut du gestionnaire est utilisée.",
    set: "Clé personnelle configurée ✓",
    unset: "Aucune clé personnelle : la clé par défaut du gestionnaire est utilisée.",
    ph: "sk-ant-…",
    saveBtn: "Enregistrer la clé",
    remove: "Retirer",
    saved: "Clé enregistrée.",
    saving: "Enregistrement…",
    saveError: "Une erreur s'est produite. Réessayez.",
    demo: "Dans la démo, la clé n'est pas enregistrée.",
  },
};

export default function TranslationsManager() {
  const { locale } = useAdminLanguage();
  const L = LABELS[locale];

  const [anthSet, setAnthSet] = useState<boolean | null>(null);
  const [anthDraft, setAnthDraft] = useState("");
  const [anthState, setAnthState] = useState<State>("idle");

  useEffect(() => {
    fetch("/api/admin/anthropic-key")
      .then((r) => r.json())
      .then((d: { set?: boolean }) => setAnthSet(!!d.set))
      .catch(() => setAnthSet(false));
  }, []);

  async function saveAnth() {
    const key = anthDraft.trim();
    if (!key) return;
    setAnthState("saving");
    try {
      const res = await fetch("/api/admin/anthropic-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) throw new Error();
      setAnthSet(true);
      setAnthDraft("");
      setAnthState("success");
      setTimeout(() => setAnthState("idle"), 3000);
    } catch {
      setAnthState("error");
    }
  }

  async function removeAnth() {
    setAnthState("saving");
    try {
      const res = await fetch("/api/admin/anthropic-key", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAnthSet(false);
      setAnthState("idle");
    } catch {
      setAnthState("error");
    }
  }

  return (
    <div className="rounded-lg border border-gold/40 bg-card p-6">
      <h2 className="font-serif-display text-2xl italic text-foreground">{L.title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-foreground/60">{L.desc}</p>
      <p className="mt-3 text-xs text-foreground/50">
        {anthSet === null ? "…" : anthSet ? L.set : L.unset}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={anthDraft}
          autoComplete="off"
          onChange={(e) => { setAnthDraft(e.target.value); setAnthState("idle"); }}
          placeholder={L.ph}
          className="min-w-0 flex-1 rounded border border-gold/30 bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-gold"
        />
        <button
          onClick={saveAnth}
          disabled={anthState === "saving" || !anthDraft.trim()}
          className="rounded-full border border-gold bg-gold px-5 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50"
        >
          {anthState === "saving" ? L.saving : L.saveBtn}
        </button>
        {anthSet && (
          <button
            onClick={removeAnth}
            disabled={anthState === "saving"}
            className="rounded-full border border-foreground/30 px-4 py-2 text-xs text-foreground/60 transition hover:border-red-400 hover:text-red-600 disabled:opacity-50"
          >
            {L.remove}
          </button>
        )}
      </div>
      {anthState === "success" && <p className="mt-2 text-xs text-green-700">{DEMO ? L.demo : L.saved}</p>}
      {anthState === "error" && <p className="mt-2 text-xs text-red-600">{L.saveError}</p>}
    </div>
  );
}
