"use client";

import { useEffect, useState } from "react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import DeployToast from "@/components/admin/DeployToast";

type SaveState = "idle" | "saving" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LABELS = {
  it: {
    title: "Accessi amministratore",
    intro: "Gli indirizzi email autorizzati ad accedere al pannello con il link via email. Le modifiche diventano attive dopo il breve aggiornamento del sito (come per contenuti e colori).",
    listLabel: "Email autorizzate",
    placeholder: "nome@esempio.com",
    add: "Aggiungi",
    remove: "Rimuovi",
    empty: "Nessun indirizzo. Aggiungine almeno uno per non restare senza accesso.",
    invalid: "Indirizzo email non valido.",
    duplicate: "Indirizzo già presente.",
    atLeastOne: "Deve restare almeno un indirizzo autorizzato.",
    githubNote: "Gli accessi tramite GitHub sono configurati a parte (variabili d'ambiente).",
    save: "Salva", saving: "Salvataggio…", saved: "Salvato", error: "Errore",
  },
  en: {
    title: "Admin access",
    intro: "The email addresses allowed to sign in to the panel via the email link. Changes take effect after the site's brief update (like content and colors).",
    listLabel: "Authorized emails",
    placeholder: "name@example.com",
    add: "Add",
    remove: "Remove",
    empty: "No addresses. Add at least one so you don't lock yourself out.",
    invalid: "Invalid email address.",
    duplicate: "Address already in the list.",
    atLeastOne: "At least one authorized address must remain.",
    githubNote: "GitHub sign-in is configured separately (environment variables).",
    save: "Save", saving: "Saving…", saved: "Saved", error: "Error",
  },
  es: {
    title: "Accesos de administrador",
    intro: "Las direcciones de correo autorizadas a entrar en el panel con el enlace por email. Los cambios se aplican tras la breve actualización del sitio (como contenidos y colores).",
    listLabel: "Correos autorizados",
    placeholder: "nombre@ejemplo.com",
    add: "Añadir",
    remove: "Quitar",
    empty: "Ninguna dirección. Añade al menos una para no quedarte sin acceso.",
    invalid: "Dirección de correo no válida.",
    duplicate: "La dirección ya está en la lista.",
    atLeastOne: "Debe quedar al menos una dirección autorizada.",
    githubNote: "El acceso con GitHub se configura aparte (variables de entorno).",
    save: "Guardar", saving: "Guardando…", saved: "Guardado", error: "Error",
  },
  fr: {
    title: "Accès administrateur",
    intro: "Les adresses e-mail autorisées à se connecter au panneau via le lien par e-mail. Les changements prennent effet après la brève mise à jour du site (comme les contenus et les couleurs).",
    listLabel: "E-mails autorisés",
    placeholder: "nom@exemple.com",
    add: "Ajouter",
    remove: "Retirer",
    empty: "Aucune adresse. Ajoutez-en au moins une pour ne pas perdre l'accès.",
    invalid: "Adresse e-mail non valide.",
    duplicate: "Adresse déjà dans la liste.",
    atLeastOne: "Au moins une adresse autorisée doit rester.",
    githubNote: "La connexion via GitHub se configure à part (variables d'environnement).",
    save: "Enregistrer", saving: "Enregistrement…", saved: "Enregistré", error: "Erreur",
  },
} as const;

export default function AdminAccessEditor() {
  const { t, locale } = useAdminLanguage();
  const L = LABELS[locale] ?? LABELS.en;
  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const [emails, setEmails] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deploySha, setDeploySha] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    fetch("/api/admin/admins")
      .then((r) => r.json())
      .then((d: { emails?: string[] }) => setEmails(Array.isArray(d.emails) ? d.emails : []))
      .catch(() => setError(L.error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addEmail() {
    if (!emails) return;
    const e = draft.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL_RE.test(e)) { setFieldError(L.invalid); return; }
    if (emails.includes(e)) { setFieldError(L.duplicate); return; }
    setEmails([...emails, e]);
    setDraft("");
    setFieldError("");
    setSaveState("idle");
  }

  function removeEmail(e: string) {
    if (!emails) return;
    setEmails(emails.filter((x) => x !== e));
    setSaveState("idle");
  }

  async function save() {
    if (!emails) return;
    if (emails.length === 0) { setError(L.atLeastOne); setSaveState("error"); return; }
    setSaveState("saving"); setError("");
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const d = (await res.json()) as { error?: string; commitSha?: string };
      if (!res.ok) throw new Error(d.error ?? L.error);
      setSaveState("success");
      if (d.commitSha) setDeploySha(d.commitSha);
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : L.error);
      setSaveState("error");
    }
  }

  if (!emails) {
    return <p className="text-sm text-foreground/50">{error || "…"}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-xl italic text-foreground">{L.title}</h1>
        <p className="mt-1 text-sm text-foreground/60">{L.intro}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/50">{L.listLabel}</h2>

        {emails.length === 0 ? (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{L.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {emails.map((e) => (
              <li key={e} className="flex items-center justify-between gap-3 rounded-lg border border-gold/30 bg-background px-3 py-2">
                <span className="truncate font-mono text-sm text-foreground">{e}</span>
                <button
                  onClick={() => removeEmail(e)}
                  aria-label={`${L.remove} ${e}`}
                  className="shrink-0 rounded-full border border-gold/30 px-2 py-0.5 text-xs text-foreground/60 transition hover:border-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-start gap-2">
          <input
            type="email"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setFieldError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
            placeholder={L.placeholder}
            className="min-w-0 flex-1 rounded border border-gold/30 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
          />
          <button
            onClick={addEmail}
            className="rounded-full border border-gold/40 px-4 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10"
          >
            {L.add}
          </button>
        </div>
        {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}
        <p className="text-xs text-foreground/45">{L.githubNote}</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saveState === "saving"}
          className="rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50"
        >
          {saveState === "saving" ? L.saving : L.save}
        </button>
        {saveState === "success" && <span className="text-sm text-green-600">{DEMO ? t.common.demoSaved : L.saved}</span>}
        {saveState === "error" && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <DeployToast sha={deploySha} onDone={() => setDeploySha(null)} />
    </div>
  );
}
