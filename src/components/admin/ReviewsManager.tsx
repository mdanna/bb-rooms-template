"use client";

import { useEffect, useState } from "react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";

interface AdminReview {
  id: number;
  author_name: string;
  author_email: string | null;
  rating: number;
  body: string;
  locale: string;
  translations: Record<string, string> | null;
  stay_month: string | null;
  booking_code: string | null;
  verified: boolean;
  status: "pending" | "published" | "rejected";
  consent: boolean;
  published_at: string | null;
  created_at: string;
}

// Etichette localizzate sulla lingua dell'admin (it/en/es/fr), come le altre schermate.
const L: Record<string, Record<string, string>> = {
  it: {
    title: "Moderazione recensioni",
    intro:
      "Le recensioni le inviano gli ospiti dal sito. Solo quelle che approvi qui compaiono in pagina e nei dati strutturati (schema.org). Nessuna recensione arriva da Airbnb o altre piattaforme. Rifiuta solo spam, offese o contenuti fuori tema: la direttiva Omnibus vieta di nascondere selettivamente le recensioni negative autentiche.",
    empty: "Nessuna recensione ricevuta.",
    pending: "Da moderare",
    published: "Pubblicate",
    rejected: "Rifiutate",
    verified: "Soggiorno verificato",
    notVerified: "Non verificato",
    publish: "Pubblica",
    publishing: "Pubblicazione…",
    retranslate: "Rigenera traduzioni",
    retranslating: "Traduzione…",
    reject: "Rifiuta",
    unpublish: "Rimuovi dalla pubblicazione",
    del: "Elimina",
    confirmDelete: "Eliminare definitivamente questa recensione?",
    privateEmail: "Email (privata)",
    stay: "Soggiorno",
    code: "Codice",
    loading: "Caricamento…",
    error: "Errore",
    translating: "Traduzione…",
  },
  en: {
    title: "Review moderation",
    intro:
      "Reviews are submitted by guests from the site. Only the ones you approve here appear on the page and in structured data (schema.org). No review comes from Airbnb or other platforms. Reject only spam, abuse or off-topic content: the EU Omnibus directive forbids selectively hiding genuine negative reviews.",
    empty: "No reviews received.",
    pending: "To moderate",
    published: "Published",
    rejected: "Rejected",
    verified: "Verified stay",
    notVerified: "Not verified",
    publish: "Publish",
    publishing: "Publishing…",
    retranslate: "Regenerate translations",
    retranslating: "Translating…",
    reject: "Reject",
    unpublish: "Unpublish",
    del: "Delete",
    confirmDelete: "Permanently delete this review?",
    privateEmail: "Email (private)",
    stay: "Stay",
    code: "Code",
    loading: "Loading…",
    error: "Error",
    translating: "Translating…",
  },
  es: {
    title: "Moderación de reseñas",
    intro:
      "Las reseñas las envían los huéspedes desde el sitio. Solo las que apruebes aquí aparecen en la página y en los datos estructurados (schema.org). Ninguna reseña proviene de Airbnb u otras plataformas. Rechaza solo spam, ofensas o contenido fuera de tema: la directiva Omnibus prohíbe ocultar selectivamente las reseñas negativas auténticas.",
    empty: "No se han recibido reseñas.",
    pending: "Por moderar",
    published: "Publicadas",
    rejected: "Rechazadas",
    verified: "Estancia verificada",
    notVerified: "No verificado",
    publish: "Publicar",
    publishing: "Publicando…",
    retranslate: "Regenerar traducciones",
    retranslating: "Traduciendo…",
    reject: "Rechazar",
    unpublish: "Retirar de publicación",
    del: "Eliminar",
    confirmDelete: "¿Eliminar definitivamente esta reseña?",
    privateEmail: "Email (privado)",
    stay: "Estancia",
    code: "Código",
    loading: "Cargando…",
    error: "Error",
    translating: "Traduciendo…",
  },
  fr: {
    title: "Modération des avis",
    intro:
      "Les avis sont envoyés par les voyageurs depuis le site. Seuls ceux que vous approuvez ici apparaissent sur la page et dans les données structurées (schema.org). Aucun avis ne provient d'Airbnb ou d'autres plateformes. Refusez uniquement le spam, les insultes ou le hors-sujet : la directive Omnibus interdit de masquer sélectivement les avis négatifs authentiques.",
    empty: "Aucun avis reçu.",
    pending: "À modérer",
    published: "Publiés",
    rejected: "Refusés",
    verified: "Séjour vérifié",
    notVerified: "Non vérifié",
    publish: "Publier",
    publishing: "Publication…",
    retranslate: "Régénérer les traductions",
    retranslating: "Traduction…",
    reject: "Refuser",
    unpublish: "Dépublier",
    del: "Supprimer",
    confirmDelete: "Supprimer définitivement cet avis ?",
    privateEmail: "E-mail (privé)",
    stay: "Séjour",
    code: "Code",
    loading: "Chargement…",
    error: "Erreur",
    translating: "Traduction…",
  },
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-gold">
      {"★".repeat(rating)}
      <span className="text-gold/30">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function ReviewsManager() {
  const { locale } = useAdminLanguage();
  const M = L[locale] ?? L.en;

  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/admin/reviews");
      const data = (await res.json()) as { reviews?: AdminReview[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? M.error);
      setReviews(data.reviews ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : M.error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patch(id: number, payload: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (!res.ok) throw new Error(M.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : M.error);
    } finally {
      setBusyId(null);
    }
  }

  // Pubblica: il server rileva la lingua e traduce il testo nelle 9 lingue in
  // automatico (vedi /api/admin/reviews). Se la traduzione fallisce, pubblica
  // comunque: la pagina pubblica farà fallback al testo originale.
  async function publish(r: AdminReview) {
    await patch(r.id, { status: "published" });
  }

  // Rigenera le traduzioni on-demand (autodetect + ritraduzione del testo originale).
  async function retranslate(id: number) {
    await patch(id, { retranslate: true });
  }

  async function remove(id: number) {
    if (!window.confirm(M.confirmDelete)) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(M.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : M.error);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-foreground/60">{M.loading}</p>;

  const groups: { key: AdminReview["status"]; label: string }[] = [
    { key: "pending", label: M.pending },
    { key: "published", label: M.published },
    { key: "rejected", label: M.rejected },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif-display text-2xl italic text-foreground">{M.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground/60">{M.intro}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {reviews.length === 0 && <p className="text-sm text-foreground/60">{M.empty}</p>}

      {groups.map(({ key, label }) => {
        const items = reviews.filter((r) => r.status === key);
        if (items.length === 0) return null;
        return (
          <section key={key} className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/50">
              {label} ({items.length})
            </h2>
            {items.map((r) => (
              <div key={r.id} className="rounded-lg border border-gold/30 bg-background p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Stars rating={r.rating} />
                    <span className="text-sm font-semibold text-foreground">{r.author_name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        r.verified ? "bg-gold/10 text-gold" : "bg-foreground/10 text-foreground/50"
                      }`}
                    >
                      {r.verified ? `✓ ${M.verified}` : M.notVerified}
                    </span>
                    <span className="text-[10px] uppercase text-foreground/40">{r.locale}</span>
                  </div>
                  <span className="text-[10px] text-foreground/40">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm leading-6 text-foreground/80">&ldquo;{r.body}&rdquo;</p>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-foreground/40">
                  {r.author_email && <span>{M.privateEmail}: {r.author_email}</span>}
                  {r.stay_month && <span>{M.stay}: {r.stay_month}</span>}
                  {r.booking_code && <span>{M.code}: {r.booking_code}</span>}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {(r.status === "pending" || r.status === "rejected") && (
                    <button
                      onClick={() => publish(r)}
                      disabled={busyId === r.id}
                      className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
                    >
                      {busyId === r.id ? M.publishing : M.publish}
                    </button>
                  )}
                  {r.status === "pending" && (
                    <button
                      onClick={() => patch(r.id, { status: "rejected" })}
                      disabled={busyId === r.id}
                      className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
                    >
                      {M.reject}
                    </button>
                  )}
                  {r.status === "published" && (
                    <button
                      onClick={() => patch(r.id, { status: "pending" })}
                      disabled={busyId === r.id}
                      className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
                    >
                      {M.unpublish}
                    </button>
                  )}
                  {r.status === "published" && (
                    <button
                      onClick={() => retranslate(r.id)}
                      disabled={busyId === r.id}
                      className="rounded-full border border-gold/40 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-gold/10 disabled:opacity-50"
                    >
                      {busyId === r.id ? M.retranslating : M.retranslate}
                    </button>
                  )}
                  <button
                    onClick={() => remove(r.id)}
                    disabled={busyId === r.id}
                    className="rounded-full px-4 py-1.5 text-xs text-red-500 transition hover:text-red-700 disabled:opacity-50"
                  >
                    {M.del}
                  </button>
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
