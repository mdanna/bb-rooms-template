"use client";

import { useState } from "react";
import { useDrafts } from "@/components/admin/DraftContext";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";

// Barra con due bottoni: "Salva" (mette la sezione corrente in bozza, istantaneo, niente
// deploy) e "Pubblica" (committa TUTTE le bozze in sospeso, un solo deploy). Va messa sia
// in cima sia in fondo all'editor per non costringere a scorrere. `onSave` è l'azione
// dell'editor che scrive la propria bozza.
const LABELS = {
  it: { save: "Salva", saved: "Salvato ✓", publish: "Pubblica", publishing: "Pubblicazione…", published: "Pubblicato — il sito si aggiornerà tra poco.", none: "Nessuna modifica da pubblicare", error: "Errore nella pubblicazione", hint: "in sospeso" },
  en: { save: "Save", saved: "Saved ✓", publish: "Publish", publishing: "Publishing…", published: "Published — the site will update shortly.", none: "Nothing to publish", error: "Publish error", hint: "pending" },
  es: { save: "Guardar", saved: "Guardado ✓", publish: "Publicar", publishing: "Publicando…", published: "Publicado — el sitio se actualizará en breve.", none: "Nada que publicar", error: "Error al publicar", hint: "pendientes" },
  fr: { save: "Enregistrer", saved: "Enregistré ✓", publish: "Publier", publishing: "Publication…", published: "Publié — le site se mettra à jour sous peu.", none: "Rien à publier", error: "Erreur de publication", hint: "en attente" },
} as const;

export default function AdminSaveBar({ onSave }: { onSave: () => void }) {
  const { locale } = useAdminLanguage();
  const L = LABELS[locale as keyof typeof LABELS] ?? LABELS.en;
  const { publish, pending, publishState, publishError } = useDrafts();
  const [justSaved, setJustSaved] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gold/30 bg-card/60 px-4 py-2.5">
      <button
        onClick={() => { onSave(); setJustSaved(true); window.setTimeout(() => setJustSaved(false), 2500); }}
        className="rounded-full border border-gold/50 px-5 py-2 text-xs uppercase tracking-widest text-foreground/80 transition hover:bg-gold/10"
      >
        {L.save}
      </button>
      {justSaved && <span className="text-xs text-green-700">{L.saved}</span>}

      <button
        onClick={publish}
        disabled={pending === 0 || publishState === "publishing"}
        className="rounded-full border border-gold bg-gold px-5 py-2 text-xs font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-gold disabled:hover:text-[#faf6ec]"
      >
        {publishState === "publishing" ? L.publishing : L.publish}{pending > 0 ? ` (${pending})` : ""}
      </button>
      {pending > 0 && publishState !== "success" && (
        <span className="text-xs text-foreground/50">{pending} {L.hint}</span>
      )}
      {publishState === "success" && <span className="text-xs text-green-700">{L.published}</span>}
      {publishState === "error" && <span className="text-xs text-red-600">{publishError || L.error}</span>}
    </div>
  );
}
