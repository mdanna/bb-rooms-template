"use client";

import { useEffect, useState } from "react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import DeployToast from "@/components/admin/DeployToast";

type SaveState = "idle" | "saving" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GH_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

const LABELS = {
  it: {
    title: "Accessi amministratore",
    intro: "Chi può accedere al pannello. Le email valgono per il link via email e per l'accesso con Google; gli username per l'accesso con GitHub. Le modifiche diventano attive dopo il breve aggiornamento del sito (come per contenuti e colori).",
    listLabel: "Email autorizzate (link email + Google)",
    placeholder: "nome@esempio.com",
    add: "Aggiungi",
    remove: "Rimuovi",
    empty: "Nessuna email.",
    invalid: "Indirizzo email non valido.",
    duplicate: "Indirizzo già presente.",
    githubListLabel: "Username GitHub autorizzati",
    githubPlaceholder: "username-github",
    githubEmpty: "Nessun username GitHub.",
    githubInvalid: "Username GitHub non valido.",
    githubDuplicate: "Username già presente.",
    atLeastOne: "Deve restare almeno un accesso autorizzato (email o GitHub).",
    save: "Salva", saving: "Salvataggio…", saved: "Salvato", error: "Errore",
  },
  en: {
    title: "Admin access",
    intro: "Who can sign in to the panel. Emails work for the email link and for Google sign-in; usernames for GitHub sign-in. Changes take effect after the site's brief update (like content and colors).",
    listLabel: "Authorized emails (email link + Google)",
    placeholder: "name@example.com",
    add: "Add",
    remove: "Remove",
    empty: "No emails.",
    invalid: "Invalid email address.",
    duplicate: "Address already in the list.",
    githubListLabel: "Authorized GitHub usernames",
    githubPlaceholder: "github-username",
    githubEmpty: "No GitHub usernames.",
    githubInvalid: "Invalid GitHub username.",
    githubDuplicate: "Username already in the list.",
    atLeastOne: "At least one authorized sign-in must remain (email or GitHub).",
    save: "Save", saving: "Saving…", saved: "Saved", error: "Error",
  },
  es: {
    title: "Accesos de administrador",
    intro: "Quién puede entrar en el panel. Los correos valen para el enlace por email y para el acceso con Google; los usuarios para el acceso con GitHub. Los cambios se aplican tras la breve actualización del sitio (como contenidos y colores).",
    listLabel: "Correos autorizados (enlace email + Google)",
    placeholder: "nombre@ejemplo.com",
    add: "Añadir",
    remove: "Quitar",
    empty: "Ningún correo.",
    invalid: "Dirección de correo no válida.",
    duplicate: "La dirección ya está en la lista.",
    githubListLabel: "Usuarios de GitHub autorizados",
    githubPlaceholder: "usuario-github",
    githubEmpty: "Ningún usuario de GitHub.",
    githubInvalid: "Usuario de GitHub no válido.",
    githubDuplicate: "El usuario ya está en la lista.",
    atLeastOne: "Debe quedar al menos un acceso autorizado (correo o GitHub).",
    save: "Guardar", saving: "Guardando…", saved: "Guardado", error: "Error",
  },
  fr: {
    title: "Accès administrateur",
    intro: "Qui peut se connecter au panneau. Les e-mails valent pour le lien par e-mail et pour la connexion avec Google ; les identifiants pour la connexion avec GitHub. Les changements prennent effet après la brève mise à jour du site (comme les contenus et les couleurs).",
    listLabel: "E-mails autorisés (lien e-mail + Google)",
    placeholder: "nom@exemple.com",
    add: "Ajouter",
    remove: "Retirer",
    empty: "Aucun e-mail.",
    invalid: "Adresse e-mail non valide.",
    duplicate: "Adresse déjà dans la liste.",
    githubListLabel: "Identifiants GitHub autorisés",
    githubPlaceholder: "identifiant-github",
    githubEmpty: "Aucun identifiant GitHub.",
    githubInvalid: "Identifiant GitHub non valide.",
    githubDuplicate: "Identifiant déjà dans la liste.",
    atLeastOne: "Au moins une connexion autorisée doit rester (e-mail ou GitHub).",
    save: "Enregistrer", saving: "Enregistrement…", saved: "Enregistré", error: "Erreur",
  },
} as const;

export default function AdminAccessEditor() {
  const { t, locale } = useAdminLanguage();
  const L = LABELS[locale] ?? LABELS.en;
  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const [emails, setEmails] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [githubLogins, setGithubLogins] = useState<string[]>([]);
  const [ghDraft, setGhDraft] = useState("");
  const [ghFieldError, setGhFieldError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deploySha, setDeploySha] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/admins")
      .then((r) => r.json())
      .then((d: { emails?: string[]; githubLogins?: string[] }) => {
        setEmails(Array.isArray(d.emails) ? d.emails : []);
        setGithubLogins(Array.isArray(d.githubLogins) ? d.githubLogins : []);
      })
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

  function addGithub() {
    const g = ghDraft.trim().toLowerCase();
    if (!g) return;
    if (!GH_RE.test(g)) { setGhFieldError(L.githubInvalid); return; }
    if (githubLogins.includes(g)) { setGhFieldError(L.githubDuplicate); return; }
    setGithubLogins([...githubLogins, g]);
    setGhDraft("");
    setGhFieldError("");
    setSaveState("idle");
  }

  function removeGithub(g: string) {
    setGithubLogins(githubLogins.filter((x) => x !== g));
    setSaveState("idle");
  }

  async function save() {
    if (!emails) return;
    if (emails.length === 0 && githubLogins.length === 0) {
      setError(L.atLeastOne); setSaveState("error"); return;
    }
    setSaveState("saving"); setError("");
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, githubLogins }),
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
          <p className="text-sm text-foreground/50">{L.empty}</p>
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
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/50">{L.githubListLabel}</h2>

        {githubLogins.length === 0 ? (
          <p className="text-sm text-foreground/50">{L.githubEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {githubLogins.map((g) => (
              <li key={g} className="flex items-center justify-between gap-3 rounded-lg border border-gold/30 bg-background px-3 py-2">
                <span className="truncate font-mono text-sm text-foreground">{g}</span>
                <button
                  onClick={() => removeGithub(g)}
                  aria-label={`${L.remove} ${g}`}
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
            type="text"
            value={ghDraft}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => { setGhDraft(e.target.value); setGhFieldError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGithub(); } }}
            placeholder={L.githubPlaceholder}
            className="min-w-0 flex-1 rounded border border-gold/30 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
          />
          <button
            onClick={addGithub}
            className="rounded-full border border-gold/40 px-4 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10"
          >
            {L.add}
          </button>
        </div>
        {ghFieldError && <p className="text-xs text-red-600">{ghFieldError}</p>}
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
