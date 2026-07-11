"use client";

import { useEffect, useState } from "react";
import type { SiteContent, MapBookmark, Review, AreaPlace, L10n, Details } from "@/lib/siteContent";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import DeployToast from "@/components/admin/DeployToast";

type SaveState = "idle" | "saving" | "success" | "error";
type TranslateState = "idle" | "translating" | "done" | "error";
type SubTab = "struttura" | "testi" | "area" | "servizi" | "recensioni" | "seo";

const SUB_TAB_LABELS: Record<string, Record<SubTab, string>> = {
  it: { struttura: "Struttura", testi: "Testi", area: "Area", servizi: "Servizi", recensioni: "Recensioni", seo: "SEO" },
  en: { struttura: "Property", testi: "Texts", area: "Area", servizi: "Services", recensioni: "Reviews", seo: "SEO" },
  es: { struttura: "Propiedad", testi: "Textos", area: "Área", servizi: "Servicios", recensioni: "Reseñas", seo: "SEO" },
  fr: { struttura: "Propriété", testi: "Textes", area: "Zone", servizi: "Services", recensioni: "Avis", seo: "SEO" },
};

const SUB_TABS: SubTab[] = ["struttura", "testi", "area", "servizi", "recensioni", "seo"];

const SEO_LABELS = {
  it: { intro: "Come appari su Google e a chi cerca la tua struttura. Aiuta chi ti ha trovato su Airbnb a ritrovarti qui, sul sito diretto.", preview: "Anteprima Google", metaDesc: "Descrizione per Google", metaDescHelp: "La frase sotto il titolo nei risultati. ~155 caratteri.", altNames: "Nomi alternativi", altNamesHelp: "Altri nomi con cui ti cercano (nome corto, titolo dell'annuncio Airbnb…), separati da virgola.", titleSuffix: "Aggiunta al titolo", titleSuffixHelp: "Un riferimento di zona per la SEO, es. «a due passi dal Vaticano».", titleSuffixPh: "a due passi da…" },
  en: { intro: "How you appear on Google and to people searching for your place. Helps guests who found you on Airbnb find you here, on the direct site.", preview: "Google preview", metaDesc: "Description for Google", metaDescHelp: "The line under the title in results. ~155 characters.", altNames: "Alternative names", altNamesHelp: "Other names people search for (short name, your Airbnb listing title…), comma-separated.", titleSuffix: "Title add-on", titleSuffixHelp: "A landmark for SEO, e.g. “steps from the Vatican”.", titleSuffixPh: "steps from…" },
  es: { intro: "Cómo apareces en Google y ante quien busca tu alojamiento. Ayuda a quien te encontró en Airbnb a hallarte aquí, en el sitio directo.", preview: "Vista previa de Google", metaDesc: "Descripción para Google", metaDescHelp: "La frase bajo el título en los resultados. ~155 caracteres.", altNames: "Nombres alternativos", altNamesHelp: "Otros nombres con los que te buscan (nombre corto, título del anuncio de Airbnb…), separados por comas.", titleSuffix: "Añadido al título", titleSuffixHelp: "Una referencia de zona para el SEO, p. ej. «a un paso del Vaticano».", titleSuffixPh: "a un paso de…" },
  fr: { intro: "Comment vous apparaissez sur Google et pour ceux qui cherchent votre logement. Aide ceux qui vous ont trouvé sur Airbnb à vous retrouver ici, sur le site direct.", preview: "Aperçu Google", metaDesc: "Description pour Google", metaDescHelp: "La phrase sous le titre dans les résultats. ~155 caractères.", altNames: "Noms alternatifs", altNamesHelp: "Autres noms recherchés (nom court, titre de l'annonce Airbnb…), séparés par des virgules.", titleSuffix: "Ajout au titre", titleSuffixHelp: "Un point de repère pour le SEO, ex. « à deux pas du Vatican ».", titleSuffixPh: "à deux pas de…" },
} as const;

const inputCls =
  "rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold";
const labelCls = "flex flex-col gap-1 text-sm";
const labelTextCls = "text-foreground/70";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className={labelTextCls}>{children}</span>;
}

function SaveButton({
  saveState,
  onClick,
  labels,
}: {
  saveState: SaveState;
  onClick: () => void;
  labels: { save: string; saving: string; saved: string; error: string };
}) {
  return (
    <div className="flex items-center gap-4 pt-6">
      <button
        onClick={onClick}
        disabled={saveState === "saving"}
        className="rounded-full bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:opacity-90 disabled:opacity-50"
      >
        {saveState === "saving" ? labels.saving : labels.save}
      </button>
      {saveState === "success" && <span className="text-sm text-green-600">{labels.saved}</span>}
      {saveState === "error" && <span className="text-sm text-red-600">{labels.error}</span>}
    </div>
  );
}

function LangBadge({ lang }: { lang: string }) {
  return (
    <span className="ml-2 rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold">
      {lang.toUpperCase()}
    </span>
  );
}

export default function ContentEditor() {
  const { t, locale } = useAdminLanguage();
  const tc = t.contents;
  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const subTabLabels = SUB_TAB_LABELS[locale] ?? SUB_TAB_LABELS.en;
  const saveLabels = { save: tc.save, saving: tc.saving, saved: DEMO ? t.common.demoSaved : tc.saved, error: t.common.error };

  const CONTENT_LABELS = {
    it: { property: "Struttura", posizione: "Posizione (visualizzata)", città: "Città", indirizzo: "Indirizzo", tel: "Telefono", email: "Email contatto", emailPren: "Email prenotazioni", piva: "Partita IVA / Codice fiscale host", cin: "CIN (Codice Identificativo Nazionale)", nomeHost: "Nome host", metaDesc: "Meta description (SEO)", privacyNote: "Visualizzato nella pagina Privacy come titolare del trattamento dati.", airbnbUrl: "URL Airbnb", rating: "Rating", numReviews: "Numero recensioni", details: "Dettagli", tipoAlloggio: "Tipo di alloggio", caratteristiche: "Caratteristiche", composizione: "Composizione", capacità: "Capacità", zona: "Zona", titoloStruttura: "Titolo struttura", sottotitoloHero: "Sottotitolo hero", titoloRacconto: "Titolo racconto", paragrafiRacconto: "Paragrafi racconto", aggiungiParag: "+ Aggiungi paragrafo", descArea: "Descrizione area", descrizione: "Descrizione", coordinate: "Coordinate appartamento", lat: "Latitudine", lng: "Longitudine", segnalibri: "Segnalibri mappa (max 5)", etichetta: "Etichetta", aggiungiSegnalibro: "Aggiungi segnalibro", puntiInteresse: "Punti di interesse", nome: "Nome", commento: "Commento", aggiungiPunto: "Aggiungi punto", servizi: "Servizi", aggiungiServizio: "Aggiungi servizio", autore: "Autore", testoRecensione: "Testo recensione", aggiungiRecensione: "Aggiungi recensione", elimina: "Elimina", rimuovi: "Rimuovi", traduceTutto: "Traduci tutto", traduceDesc: "Traduce automaticamente tutti i contenuti in 8 lingue con un solo clic, poi salva.", traduzioneCompletata: "Traduzione completata — ricordati di salvare.", traduciAuto: "Traduci automaticamente", traduciDettagli: "Traduci dettagli", traduciArea: "Traduci", traduciPunti: "Traduci punti di interesse", traduciServizi: "Traduci servizi", traduciRecensioni: "Traduci recensioni", inCorso: "Traduzione in corso…", vediEn: "Vedi traduzioni (EN)", nascondi: "Nascondi", tradotto: "Tradotto", airbnbSection: "Airbnb", paragrafoPh: "Paragrafo {n}…" },
    en: { property: "Property", posizione: "Location (displayed)", città: "City", indirizzo: "Address", tel: "Phone", email: "Contact email", emailPren: "Booking email", piva: "VAT / Tax ID (host)", cin: "CIN (National ID Code)", nomeHost: "Host name", metaDesc: "Meta description (SEO)", privacyNote: "Shown on the Privacy page as data controller.", airbnbUrl: "Airbnb URL", rating: "Rating", numReviews: "Review count", details: "Details", tipoAlloggio: "Accommodation type", caratteristiche: "Features", composizione: "Composition", capacità: "Capacity", zona: "Area", titoloStruttura: "Property title", sottotitoloHero: "Hero subtitle", titoloRacconto: "Story title", paragrafiRacconto: "Story paragraphs", aggiungiParag: "+ Add paragraph", descArea: "Area description", descrizione: "Description", coordinate: "Property coordinates", lat: "Latitude", lng: "Longitude", segnalibri: "Map bookmarks (max 5)", etichetta: "Label", aggiungiSegnalibro: "Add bookmark", puntiInteresse: "Points of interest", nome: "Name", commento: "Comment", aggiungiPunto: "Add point", servizi: "Services", aggiungiServizio: "Add service", autore: "Author", testoRecensione: "Review text", aggiungiRecensione: "Add review", elimina: "Delete", rimuovi: "Remove", traduceTutto: "Translate all", traduceDesc: "Automatically translates all content into 8 languages with one click, then save.", traduzioneCompletata: "Translation complete — remember to save.", traduciAuto: "Translate automatically", traduciDettagli: "Translate details", traduciArea: "Translate", traduciPunti: "Translate points", traduciServizi: "Translate services", traduciRecensioni: "Translate reviews", inCorso: "Translating…", vediEn: "Show translations (EN)", nascondi: "Hide", tradotto: "Translated", airbnbSection: "Airbnb", paragrafoPh: "Paragraph {n}…" },
    es: { property: "Propiedad", posizione: "Ubicación (mostrada)", città: "Ciudad", indirizzo: "Dirección", tel: "Teléfono", email: "Email de contacto", emailPren: "Email de reservas", piva: "NIF / CIF (anfitrión)", cin: "CIN (Código de Identificación)", nomeHost: "Nombre anfitrión", metaDesc: "Meta descripción (SEO)", privacyNote: "Mostrado en la página de Privacidad como responsable del tratamiento.", airbnbUrl: "URL Airbnb", rating: "Valoración", numReviews: "Nº de reseñas", details: "Detalles", tipoAlloggio: "Tipo de alojamiento", caratteristiche: "Características", composizione: "Composición", capacità: "Capacidad", zona: "Zona", titoloStruttura: "Título del alojamiento", sottotitoloHero: "Subtítulo hero", titoloRacconto: "Título de la historia", paragrafiRacconto: "Párrafos de la historia", aggiungiParag: "+ Añadir párrafo", descArea: "Descripción del área", descrizione: "Descripción", coordinate: "Coordenadas del alojamiento", lat: "Latitud", lng: "Longitud", segnalibri: "Marcadores del mapa (máx 5)", etichetta: "Etiqueta", aggiungiSegnalibro: "Añadir marcador", puntiInteresse: "Puntos de interés", nome: "Nombre", commento: "Comentario", aggiungiPunto: "Añadir punto", servizi: "Servicios", aggiungiServizio: "Añadir servicio", autore: "Autor", testoRecensione: "Texto de la reseña", aggiungiRecensione: "Añadir reseña", elimina: "Eliminar", rimuovi: "Quitar", traduceTutto: "Traducir todo", traduceDesc: "Traduce automáticamente todos los contenidos a 8 idiomas con un clic, luego guarda.", traduzioneCompletata: "Traducción completa — recuerda guardar.", traduciAuto: "Traducir automáticamente", traduciDettagli: "Traducir detalles", traduciArea: "Traducir", traduciPunti: "Traducir puntos", traduciServizi: "Traducir servicios", traduciRecensioni: "Traducir reseñas", inCorso: "Traduciendo…", vediEn: "Ver traducciones (EN)", nascondi: "Ocultar", tradotto: "Traducido", airbnbSection: "Airbnb", paragrafoPh: "Párrafo {n}…" },
    fr: { property: "Propriété", posizione: "Localisation (affichée)", città: "Ville", indirizzo: "Adresse", tel: "Téléphone", email: "Email de contact", emailPren: "Email de réservation", piva: "N° TVA / SIRET (hôte)", cin: "CIN (Code d'Identification National)", nomeHost: "Nom de l'hôte", metaDesc: "Méta description (SEO)", privacyNote: "Affiché sur la page Politique de confidentialité comme responsable du traitement.", airbnbUrl: "URL Airbnb", rating: "Note", numReviews: "Nombre d'avis", details: "Détails", tipoAlloggio: "Type de logement", caratteristiche: "Caractéristiques", composizione: "Composition", capacità: "Capacité", zona: "Zone", titoloStruttura: "Titre du logement", sottotitoloHero: "Sous-titre hero", titoloRacconto: "Titre de l'histoire", paragrafiRacconto: "Paragraphes de l'histoire", aggiungiParag: "+ Ajouter un paragraphe", descArea: "Description de la zone", descrizione: "Description", coordinate: "Coordonnées du logement", lat: "Latitude", lng: "Longitude", segnalibri: "Signets de la carte (max 5)", etichetta: "Étiquette", aggiungiSegnalibro: "Ajouter un signet", puntiInteresse: "Points d'intérêt", nome: "Nom", commento: "Commentaire", aggiungiPunto: "Ajouter un point", servizi: "Services", aggiungiServizio: "Ajouter un service", autore: "Auteur", testoRecensione: "Texte de l'avis", aggiungiRecensione: "Ajouter un avis", elimina: "Supprimer", rimuovi: "Retirer", traduceTutto: "Tout traduire", traduceDesc: "Traduit automatiquement tous les contenus en 8 langues en un clic, puis enregistrez.", traduzioneCompletata: "Traduction terminée — pensez à enregistrer.", traduciAuto: "Traduire automatiquement", traduciDettagli: "Traduire les détails", traduciArea: "Traduire", traduciPunti: "Traduire les points", traduciServizi: "Traduire les services", traduciRecensioni: "Traduire les avis", inCorso: "Traduction en cours…", vediEn: "Voir les traductions (EN)", nascondi: "Masquer", tradotto: "Traduit", airbnbSection: "Airbnb", paragrafoPh: "Paragraphe {n}…" },
  } as const;

  const L = CONTENT_LABELS[locale as keyof typeof CONTENT_LABELS] ?? CONTENT_LABELS.en;
  const S = SEO_LABELS[locale as keyof typeof SEO_LABELS] ?? SEO_LABELS.en;
  const srcLang = locale as keyof L10n;
  // Best available source text: prefer current admin locale, fallback to Italian
  const src = (field: L10n): string => field[srcLang] || field.it || Object.values(field).find(Boolean) || "";

  const [content, setContent] = useState<SiteContent | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deploySha, setDeploySha] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<SubTab>("struttura");

  // Translation states
  const [textsTranslateState, setTextsTranslateState] = useState<TranslateState>("idle");
  const [textsTranslateError, setTextsTranslateError] = useState("");
  const [textsTranslatePreview, setTextsTranslatePreview] = useState<Record<string, string> | null>(null);
  const [showTextsPreview, setShowTextsPreview] = useState(false);

  const [areaDescTranslateState, setAreaDescTranslateState] = useState<TranslateState>("idle");
  const [areaDescTranslateError, setAreaDescTranslateError] = useState("");

  const [placesTranslateState, setPlacesTranslateState] = useState<TranslateState>("idle");
  const [placesTranslateError, setPlacesTranslateError] = useState("");

  const [amenitiesTranslateState, setAmenitiesTranslateState] = useState<TranslateState>("idle");
  const [amenitiesTranslateError, setAmenitiesTranslateError] = useState("");

  const [reviewsTranslateState, setReviewsTranslateState] = useState<TranslateState>("idle");
  const [reviewsTranslateError, setReviewsTranslateError] = useState("");

  const [detailsTranslateState, setDetailsTranslateState] = useState<TranslateState>("idle");
  const [detailsTranslateError, setDetailsTranslateError] = useState("");

  const [allTranslateState, setAllTranslateState] = useState<TranslateState>("idle");
  const [allTranslateError, setAllTranslateError] = useState("");

  useEffect(() => {
    fetch("/api/admin/content")
      .then((r) => r.json())
      .then(setContent)
      .catch(() => setLoadError(t.common.error));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!content) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const data = (await res.json()) as { error?: string; commitSha?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      setSaveState("success");
      if (data.commitSha) setDeploySha(data.commitSha);
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
    }
  }

  function set<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setContent((c) => (c ? { ...c, [key]: value } : c));
  }

  function setL10nField(key: keyof SiteContent, lang: string, value: string) {
    setContent((c) => {
      if (!c) return c;
      const prev = c[key] as L10n;
      return { ...c, [key]: { ...prev, [lang]: value } };
    });
  }

  async function handleTranslateTexts() {
    if (!content) return;
    setTextsTranslateState("translating");
    setTextsTranslateError("");
    setTextsTranslatePreview(null);
    try {
      const paragraphTexts: Record<string, string> = {};
      content.storyParagraphs.forEach((p, i) => { paragraphTexts[`storyP${i}`] = src(p); });
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: {
            siteTitle: src(content.siteTitle),
            heroSubtitle: src(content.heroSubtitle),
            storyTitle: src(content.storyTitle),
            ...paragraphTexts,
          },
          sourceLang: locale,
        }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? t.common.error);
      const tr = data.translations;
      setContent((c) => {
        if (!c) return c;
        const mergeNonEmpty = (field: L10n, trObj: Record<string, string> | undefined): L10n =>
          trObj ? { ...field, ...Object.fromEntries(Object.entries(trObj).filter(([, v]) => v)) } : field;
        const merge = (field: L10n, key: string): L10n => mergeNonEmpty(field, tr[key]);
        const storyParagraphs = c.storyParagraphs.map((p, i) => {
          const trP = tr[`storyP${i}`];
          if (!trP) return p;
          // Only merge non-empty translations to avoid blanking existing content
          const merged = Object.fromEntries(Object.entries(trP).filter(([, v]) => v));
          return { ...p, ...merged };
        });
        return {
          ...c,
          siteTitle: merge(c.siteTitle, "siteTitle"),
          heroSubtitle: merge(c.heroSubtitle, "heroSubtitle"),
          storyTitle: merge(c.storyTitle, "storyTitle"),
          storyParagraphs,
        };
      });
      // Preview EN
      const preview: Record<string, string> = {
        siteTitle: tr.siteTitle?.en ?? "",
        heroSubtitle: tr.heroSubtitle?.en ?? "",
        storyTitle: tr.storyTitle?.en ?? "",
      };
      content.storyParagraphs.forEach((_, i) => { preview[`storyP${i}`] = tr[`storyP${i}`]?.en ?? ""; });
      setTextsTranslatePreview(preview);
      setTextsTranslateState("done");
    } catch (e) {
      setTextsTranslateError(e instanceof Error ? e.message : t.common.error);
      setTextsTranslateState("error");
    }
  }

  async function handleTranslateAreaDesc() {
    if (!content) return;
    setAreaDescTranslateState("translating");
    setAreaDescTranslateError("");
    try {
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: { areaDescription: src(content.areaDescription) }, sourceLang: locale }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? t.common.error);
      const tr = data.translations.areaDescription ?? {};
      setContent((c) => c ? { ...c, areaDescription: { ...c.areaDescription, ...tr } } : c);
      setAreaDescTranslateState("done");
    } catch (e) {
      setAreaDescTranslateError(e instanceof Error ? e.message : t.common.error);
      setAreaDescTranslateState("error");
    }
  }

  async function handleTranslatePlaces() {
    if (!content) return;
    setPlacesTranslateState("translating");
    setPlacesTranslateError("");
    try {
      // Build a flat texts object: place_0_name, place_0_distance, place_1_name, ...
      const texts: Record<string, string> = {};
      content.areaPlaces.forEach((p, i) => {
        texts[`place_${i}_name`] = src(p.name);
        texts[`place_${i}_comment`] = src(p.comment);
      });
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts, sourceLang: locale }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? t.common.error);
      const tr = data.translations;
      setContent((c) => {
        if (!c) return c;
        const updated = c.areaPlaces.map((p, i) => ({
          name: { ...p.name, ...(tr[`place_${i}_name`] ?? {}) },
          comment: { ...p.comment, ...(tr[`place_${i}_comment`] ?? {}) },
        }));
        return { ...c, areaPlaces: updated };
      });
      setPlacesTranslateState("done");
    } catch (e) {
      setPlacesTranslateError(e instanceof Error ? e.message : t.common.error);
      setPlacesTranslateState("error");
    }
  }

  async function handleTranslateAmenities() {
    if (!content) return;
    setAmenitiesTranslateState("translating");
    setAmenitiesTranslateError("");
    try {
      const texts: Record<string, string> = {};
      content.amenities.forEach((a, i) => { texts[`amenity_${i}`] = src(a as L10n); });
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts, sourceLang: locale }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? t.common.error);
      const tr = data.translations;
      setContent((c) => {
        if (!c) return c;
        const updated = c.amenities.map((a, i) => ({ ...a, ...(tr[`amenity_${i}`] ?? {}) }));
        return { ...c, amenities: updated };
      });
      setAmenitiesTranslateState("done");
    } catch (e) {
      setAmenitiesTranslateError(e instanceof Error ? e.message : t.common.error);
      setAmenitiesTranslateState("error");
    }
  }

  async function handleTranslateReviews() {
    if (!content) return;
    setReviewsTranslateState("translating");
    setReviewsTranslateError("");
    try {
      const texts: Record<string, string> = {};
      content.reviews.forEach((r, i) => { texts[`review_${i}`] = src(r.text as L10n); });
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts, sourceLang: locale }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? t.common.error);
      const tr = data.translations;
      setContent((c) => {
        if (!c) return c;
        const updated = c.reviews.map((r, i) => {
          const trR = tr[`review_${i}`];
          const merged = trR ? Object.fromEntries(Object.entries(trR).filter(([, v]) => v)) : {};
          return { ...r, text: { ...(r.text as L10n), ...merged } };
        });
        return { ...c, reviews: updated };
      });
      setReviewsTranslateState("done");
    } catch (e) {
      setReviewsTranslateError(e instanceof Error ? e.message : t.common.error);
      setReviewsTranslateState("error");
    }
  }

  async function handleTranslateDetails() {
    if (!content) return;
    setDetailsTranslateState("translating");
    setDetailsTranslateError("");
    try {
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: {
            entirePlace: src(content.details.entirePlace),
            quietCourtyard: src(content.details.quietCourtyard),
            roomInfo: src(content.details.roomInfo),
            maxGuests: src(content.details.maxGuests),
            neighborhood: src(content.details.neighborhood),
          },
          sourceLang: locale,
        }),
      });
      const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
      if (!res.ok || !data.translations) throw new Error(data.error ?? t.common.error);
      const tr = data.translations;
      setContent((c) => {
        if (!c) return c;
        const merge = (field: L10n, key: string): L10n => {
          if (!tr[key]) return field;
          return { ...field, ...tr[key] };
        };
        return {
          ...c,
          details: {
            entirePlace: merge(c.details.entirePlace, "entirePlace"),
            quietCourtyard: merge(c.details.quietCourtyard, "quietCourtyard"),
            roomInfo: merge(c.details.roomInfo, "roomInfo"),
            maxGuests: merge(c.details.maxGuests, "maxGuests"),
            neighborhood: merge(c.details.neighborhood, "neighborhood"),
          },
        };
      });
      setDetailsTranslateState("done");
    } catch (e) {
      setDetailsTranslateError(e instanceof Error ? e.message : t.common.error);
      setDetailsTranslateState("error");
    }
  }

  async function handleTranslateAll() {
    if (!content) return;
    setAllTranslateState("translating");
    setAllTranslateError("");
    try {
      // Batch A: short fields (titles, details, amenities, area places)
      const batchA: Record<string, string> = {
        siteTitle: src(content.siteTitle),
        heroSubtitle: src(content.heroSubtitle),
        storyTitle: src(content.storyTitle),
        areaDescription: src(content.areaDescription),
        entirePlace: src(content.details.entirePlace),
        quietCourtyard: src(content.details.quietCourtyard),
        roomInfo: src(content.details.roomInfo),
        maxGuests: src(content.details.maxGuests),
        neighborhood: src(content.details.neighborhood),
      };
      content.amenities.forEach((a, i) => { batchA[`amenity_${i}`] = src(a as L10n); });
      content.areaPlaces.forEach((p, i) => {
        batchA[`place_${i}_name`] = src(p.name);
        batchA[`place_${i}_comment`] = src(p.comment);
      });

      // Batch B: long fields (story paragraphs + reviews)
      const batchB: Record<string, string> = {};
      content.storyParagraphs.forEach((p, i) => { batchB[`storyP${i}`] = src(p); });
      content.reviews.forEach((r, i) => { batchB[`review_${i}`] = src(r.text as L10n); });

      const translate = async (texts: Record<string, string>) => {
        const res = await fetch("/api/admin/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts, sourceLang: locale }),
        });
        const data = (await res.json()) as { translations?: Record<string, Record<string, string>>; error?: string };
        if (!res.ok || !data.translations) throw new Error(data.error ?? t.common.error);
        return data.translations;
      };

      const [trA, trB] = await Promise.all([translate(batchA), translate(batchB)]);
      const tr = { ...trA, ...trB };
      const mergeNE = (field: L10n, trObj: Record<string, string> | undefined): L10n =>
        trObj ? { ...field, ...Object.fromEntries(Object.entries(trObj).filter(([, v]) => v)) } : field;
      const merge = (field: L10n, key: string): L10n => mergeNE(field, tr[key]);

      setContent((c) => {
        if (!c) return c;
        return {
          ...c,
          siteTitle: merge(c.siteTitle, "siteTitle"),
          heroSubtitle: merge(c.heroSubtitle, "heroSubtitle"),
          storyTitle: merge(c.storyTitle, "storyTitle"),
          storyParagraphs: c.storyParagraphs.map((p, i) => mergeNE(p, tr[`storyP${i}`])),
          areaDescription: merge(c.areaDescription, "areaDescription"),
          areaPlaces: c.areaPlaces.map((p, i) => ({
            name: mergeNE(p.name, tr[`place_${i}_name`]),
            comment: mergeNE(p.comment, tr[`place_${i}_comment`]),
          })),
          amenities: c.amenities.map((a, i) => mergeNE(a as L10n, tr[`amenity_${i}`])),
          reviews: c.reviews.map((r, i) => ({
            ...r,
            text: mergeNE(r.text as L10n, tr[`review_${i}`]),
          })),
          details: {
            entirePlace: merge(c.details.entirePlace, "entirePlace"),
            quietCourtyard: merge(c.details.quietCourtyard, "quietCourtyard"),
            roomInfo: merge(c.details.roomInfo, "roomInfo"),
            maxGuests: merge(c.details.maxGuests, "maxGuests"),
            neighborhood: merge(c.details.neighborhood, "neighborhood"),
          },
        };
      });
      setAllTranslateState("done");
      setTimeout(() => setAllTranslateState("idle"), 4000);
    } catch (e) {
      setAllTranslateError(e instanceof Error ? e.message : t.common.error);
      setAllTranslateState("error");
    }
  }

  if (!content) {
    return <p className="text-sm text-foreground/60">{loadError || t.common.loading}</p>;
  }

  // ---- Sub-tab renders ----

  function renderStruttura() {
    if (!content) return null;
    return (
      <div className="space-y-6">
        {/* Struttura card */}
        <div className="rounded-lg border border-gold/30 bg-background p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground/50">{L.property}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {(
              [
                [L.posizione, "locationDisplay"],
                [L.città, "city"],
                [L.indirizzo, "address"],
                [L.tel, "phone"],
                [L.email, "email"],
                [L.emailPren, "bookingEmail"],
                [L.piva, "vatNumber"],
                [L.cin, "cin"],
                [L.nomeHost, "hostName"],
              ] as [string, keyof SiteContent][]
            ).map(([label, key]) => (
              <label key={key} className={labelCls}>
                <FieldLabel>{label}</FieldLabel>
                <input
                  type="text"
                  value={(content[key] as string) ?? ""}
                  onChange={(e) => set(key, e.target.value as SiteContent[typeof key])}
                  className={inputCls}
                />
              </label>
            ))}
            <p className="col-span-full text-xs text-foreground/40 -mt-2">{L.privacyNote}</p>
          </div>
        </div>

        {/* Airbnb card */}
        <div className="rounded-lg border border-gold/30 bg-background p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground/50">{L.airbnbSection}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              <FieldLabel>{L.rating}</FieldLabel>
              <input
                type="number"
                step="0.01"
                value={content.airbnbRating}
                onChange={(e) => set("airbnbRating", Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              <FieldLabel>{L.numReviews}</FieldLabel>
              <input
                type="number"
                value={content.airbnbReviewCount}
                onChange={(e) => set("airbnbReviewCount", Number(e.target.value))}
                className={inputCls}
              />
            </label>
          </div>
        </div>

        {/* Dettagli card */}
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">{L.details}</h3>
          {(
            [
              { key: "entirePlace", label: L.tipoAlloggio },
              { key: "quietCourtyard", label: L.caratteristiche },
              { key: "roomInfo", label: L.composizione },
              { key: "maxGuests", label: L.capacità },
              { key: "neighborhood", label: L.zona },
            ] as { key: keyof Details; label: string }[]
          ).map(({ key, label }) => (
            <label key={key} className={labelCls}>
              <span className={labelTextCls}>{label} <LangBadge lang={locale} /></span>
              <input
                type="text"
                value={content.details[key][srcLang] ?? ""}
                onChange={(e) =>
                  setContent((c) =>
                    c ? { ...c, details: { ...c.details, [key]: { ...c.details[key], it: e.target.value } } } : c
                  )
                }
                className={inputCls}
              />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button onClick={handleTranslateDetails} disabled={detailsTranslateState === "translating"}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50">
              {detailsTranslateState === "translating" ? L.inCorso : L.traduciDettagli}
            </button>
            {detailsTranslateState === "done" && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">{L.tradotto}</span>}
            {detailsTranslateState === "error" && <span className="text-xs text-red-600">{detailsTranslateError}</span>}
          </div>
        </div>

        <SaveButton saveState={saveState} onClick={handleSave} labels={saveLabels} />
      </div>
    );
  }

  function renderTesti() {
    if (!content) return null;
    const MAX_PARAGRAPHS = 5;

    function addParagraph() {
      const empty: L10n = { it: "", en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" };
      set("storyParagraphs", [...content!.storyParagraphs, empty]);
    }

    function removeParagraph(idx: number) {
      set("storyParagraphs", content!.storyParagraphs.filter((_, i) => i !== idx));
    }

    function setParagraphIt(idx: number, value: string) {
      const updated = content!.storyParagraphs.map((p, i) => {
        if (i !== idx) return p;
        const base = typeof p === "string" ? { it: p as string, en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" } as L10n : p;
        return { ...base, [srcLang]: value };
      });
      set("storyParagraphs", updated);
    }

    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-5">
          {/* Titolo struttura */}
          <label className={labelCls}>
            <span className={labelTextCls}>{L.titoloStruttura} <LangBadge lang={locale} /></span>
            <input type="text" value={content.siteTitle[srcLang] ?? ""}
              onChange={(e) => setL10nField("siteTitle", srcLang, e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            <span className={labelTextCls}>{L.sottotitoloHero} <LangBadge lang={locale} /></span>
            <input type="text" value={content.heroSubtitle[srcLang] ?? ""}
              onChange={(e) => setL10nField("heroSubtitle", srcLang, e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            <span className={labelTextCls}>{L.titoloRacconto} <LangBadge lang={locale} /></span>
            <input type="text" value={content.storyTitle[srcLang] ?? ""}
              onChange={(e) => setL10nField("storyTitle", srcLang, e.target.value)} className={inputCls} />
          </label>
        </div>

        {/* Paragrafi racconto */}
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">
              {L.paragrafiRacconto} <LangBadge lang={locale} />
              <span className="ml-2 text-foreground/40 normal-case font-normal">
                ({content.storyParagraphs.length}/{MAX_PARAGRAPHS})
              </span>
            </h3>
            {content.storyParagraphs.length < MAX_PARAGRAPHS && (
              <button onClick={addParagraph} className="rounded-full border border-gold/50 px-3 py-1 text-xs text-gold hover:bg-gold/10 transition">
                {L.aggiungiParag}
              </button>
            )}
          </div>
          {content.storyParagraphs.map((p, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <textarea
                rows={4}
                value={p[srcLang] ?? ""}
                onChange={(e) => setParagraphIt(idx, e.target.value)}
                placeholder={L.paragrafoPh.replace('{n}', String(idx + 1))}
                className={`${inputCls} flex-1`}
              />
              {content.storyParagraphs.length > 1 && (
                <button
                  onClick={() => removeParagraph(idx)}
                  title={L.rimuovi}
                  className="mt-1 text-foreground/30 hover:text-red-500 transition text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Translate button */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleTranslateTexts}
            disabled={textsTranslateState === "translating"}
            className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
          >
            {textsTranslateState === "translating" ? L.inCorso : L.traduciAuto}
          </button>
          {textsTranslateState === "done" && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">{L.tradotto}</span>
          )}
          {textsTranslateState === "error" && (
            <span className="text-xs text-red-600">{textsTranslateError}</span>
          )}
          {textsTranslatePreview && (
            <button
              onClick={() => setShowTextsPreview((v) => !v)}
              className="text-xs text-foreground/50 underline"
            >
              {showTextsPreview ? L.nascondi : L.vediEn}
            </button>
          )}
        </div>

        {showTextsPreview && textsTranslatePreview && (
          <div className="rounded-lg border border-gold/20 bg-card p-4 space-y-3 text-sm">
            {Object.entries(textsTranslatePreview).map(([k, v]) => (
              <div key={k}>
                <p className="text-xs font-bold uppercase tracking-widest text-foreground/40">{k}</p>
                <p className="mt-1 text-foreground/80">{v}</p>
              </div>
            ))}
          </div>
        )}

        <SaveButton saveState={saveState} onClick={handleSave} labels={saveLabels} />
      </div>
    );
  }

  function renderArea() {
    if (!content) return null;
    return (
      <div className="space-y-6">
        {/* Descrizione */}
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">{L.descArea}</h3>
          <label className={labelCls}>
            <span className={labelTextCls}>
              {L.descrizione} <LangBadge lang={locale} />
            </span>
            <textarea
              rows={3}
              value={content.areaDescription[srcLang] ?? ""}
              onChange={(e) => setL10nField("areaDescription", srcLang, e.target.value)}
              className={inputCls}
            />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleTranslateAreaDesc}
              disabled={areaDescTranslateState === "translating"}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {areaDescTranslateState === "translating" ? L.inCorso : L.traduciArea}
            </button>
            {areaDescTranslateState === "done" && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">{L.tradotto}</span>
            )}
            {areaDescTranslateState === "error" && (
              <span className="text-xs text-red-600">{areaDescTranslateError}</span>
            )}
          </div>
        </div>

        {/* Coordinate */}
        <div className="rounded-lg border border-gold/30 bg-background p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-foreground/50">
            {L.coordinate}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelCls}>
              <FieldLabel>{L.lat}</FieldLabel>
              <input
                type="number"
                step="any"
                value={content.mapLat}
                onChange={(e) => set("mapLat", Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              <FieldLabel>{L.lng}</FieldLabel>
              <input
                type="number"
                step="any"
                value={content.mapLng}
                onChange={(e) => set("mapLng", Number(e.target.value))}
                className={inputCls}
              />
            </label>
          </div>
        </div>

        {/* Segnalibri mappa */}
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">{L.segnalibri}</h3>
          {content.mapBookmarks.map((bm, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm flex-1 min-w-24">
                <FieldLabel>Lat</FieldLabel>
                <input
                  type="number"
                  step="any"
                  value={bm.lat}
                  onChange={(e) => {
                    const updated: MapBookmark[] = content.mapBookmarks.map((b, j) =>
                      j === i ? { ...b, lat: Number(e.target.value) } : b
                    );
                    set("mapBookmarks", updated);
                  }}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm flex-1 min-w-24">
                <FieldLabel>Lng</FieldLabel>
                <input
                  type="number"
                  step="any"
                  value={bm.lng}
                  onChange={(e) => {
                    const updated: MapBookmark[] = content.mapBookmarks.map((b, j) =>
                      j === i ? { ...b, lng: Number(e.target.value) } : b
                    );
                    set("mapBookmarks", updated);
                  }}
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm flex-1 min-w-40">
                <FieldLabel>{L.etichetta}</FieldLabel>
                <input
                  type="text"
                  value={bm.label}
                  onChange={(e) => {
                    const updated: MapBookmark[] = content.mapBookmarks.map((b, j) =>
                      j === i ? { ...b, label: e.target.value } : b
                    );
                    set("mapBookmarks", updated);
                  }}
                  className={inputCls}
                />
              </label>
              <button
                onClick={() => set("mapBookmarks", content.mapBookmarks.filter((_, j) => j !== i))}
                className="text-xs text-red-500 hover:text-red-700 pb-2"
              >
                {L.rimuovi}
              </button>
            </div>
          ))}
          {content.mapBookmarks.length < 5 && (
            <button
              onClick={() =>
                set("mapBookmarks", [...content.mapBookmarks, { lat: 0, lng: 0, label: "" }])
              }
              className="rounded-full border border-gold/40 px-4 py-1.5 text-xs text-foreground/60 hover:bg-gold/5"
            >
              {L.aggiungiSegnalibro}
            </button>
          )}
        </div>

        {/* Punti di interesse */}
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">{L.puntiInteresse}</h3>
          {content.areaPlaces.map((place, i) => (
            <div key={i} className="rounded-lg border border-gold/20 bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelCls}>
                    <span className={labelTextCls}>
                      {L.nome} <LangBadge lang={locale} />
                    </span>
                    <input
                      type="text"
                      value={place.name[srcLang] ?? ""}
                      onChange={(e) => {
                        const updated: AreaPlace[] = content.areaPlaces.map((p, j) =>
                          j === i ? { ...p, name: { ...p.name, [srcLang]: e.target.value } } : p
                        );
                        set("areaPlaces", updated);
                      }}
                      className={inputCls}
                    />
                  </label>
                  <label className={labelCls}>
                    <span className={labelTextCls}>
                      {L.commento} <LangBadge lang={locale} />
                    </span>
                    <input
                      type="text"
                      value={place.comment[srcLang] ?? ""}
                      onChange={(e) => {
                        const updated: AreaPlace[] = content.areaPlaces.map((p, j) =>
                          j === i ? { ...p, comment: { ...p.comment, [srcLang]: e.target.value } } : p
                        );
                        set("areaPlaces", updated);
                      }}
                      className={inputCls}
                    />
                  </label>
                </div>
                <button
                  onClick={() => set("areaPlaces", content.areaPlaces.filter((_, j) => j !== i))}
                  className="ml-3 text-xs text-red-500 hover:text-red-700 mt-6"
                >
                  {L.elimina}
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              set("areaPlaces", [
                ...content.areaPlaces,
                {
                  name: { it: "", en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" },
                  comment: { it: "", en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" },
                },
              ])
            }
            className="rounded-full border border-gold/40 px-4 py-1.5 text-xs text-foreground/60 hover:bg-gold/5"
          >
            {L.aggiungiPunto}
          </button>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={handleTranslatePlaces}
              disabled={placesTranslateState === "translating"}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {placesTranslateState === "translating" ? L.inCorso : L.traduciPunti}
            </button>
            {placesTranslateState === "done" && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">{L.tradotto}</span>
            )}
            {placesTranslateState === "error" && (
              <span className="text-xs text-red-600">{placesTranslateError}</span>
            )}
          </div>
        </div>

        <SaveButton saveState={saveState} onClick={handleSave} labels={saveLabels} />
      </div>
    );
  }

  function renderServizi() {
    if (!content) return null;
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gold/30 bg-background p-6 space-y-2">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground/50">
            {L.servizi}
          </h3>
          {content.amenities.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={(item as L10n)[srcLang] ?? ""}
                onChange={(e) => {
                  const updated = content.amenities.map((a, j) =>
                    j === i ? { ...(a as L10n), [srcLang]: e.target.value } : a
                  );
                  set("amenities", updated);
                }}
                className={`${inputCls} flex-1`}
              />
              <button
                onClick={() => set("amenities", content.amenities.filter((_, j) => j !== i))}
                className="text-xs text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() =>
                set("amenities", [
                  ...content.amenities,
                  { it: "", en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" },
                ])
              }
              className="rounded-full border border-gold/40 px-4 py-1.5 text-xs text-foreground/60 hover:bg-gold/5"
            >
              {L.aggiungiServizio}
            </button>
            <button
              onClick={handleTranslateAmenities}
              disabled={amenitiesTranslateState === "translating"}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {amenitiesTranslateState === "translating" ? L.inCorso : L.traduciServizi}
            </button>
            {amenitiesTranslateState === "done" && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">{L.tradotto}</span>
            )}
            {amenitiesTranslateState === "error" && (
              <span className="text-xs text-red-600">{amenitiesTranslateError}</span>
            )}
          </div>
        </div>
        <SaveButton saveState={saveState} onClick={handleSave} labels={saveLabels} />
      </div>
    );
  }

  function renderRecensioni() {
    if (!content) return null;
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {content.reviews.map((review, i) => (
            <div key={i} className="rounded-lg border border-gold/30 bg-background p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex flex-1 flex-col gap-1 text-sm">
                  <FieldLabel>{L.autore}</FieldLabel>
                  <input
                    type="text"
                    value={review.author}
                    onChange={(e) => {
                      const updated: Review[] = content.reviews.map((r, j) =>
                        j === i ? { ...r, author: e.target.value } : r
                      );
                      set("reviews", updated);
                    }}
                    className={inputCls}
                  />
                </label>
                <button
                  onClick={() => set("reviews", content.reviews.filter((_, j) => j !== i))}
                  className="mt-5 text-xs text-red-500 hover:text-red-700"
                >
                  {L.elimina}
                </button>
              </div>
              <label className={labelCls}>
                <span className={labelTextCls}>
                  {L.testoRecensione} <LangBadge lang={locale} />
                </span>
                <textarea
                  rows={4}
                  value={(review.text as L10n)[srcLang] ?? ""}
                  onChange={(e) => {
                    const updated: Review[] = content.reviews.map((r, j) =>
                      j === i ? { ...r, text: { ...(r.text as L10n), [srcLang]: e.target.value } } : r
                    );
                    set("reviews", updated);
                  }}
                  className={inputCls}
                />
              </label>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() =>
                set("reviews", [
                  ...content.reviews,
                  { text: { it: "", en: "", fr: "", de: "", es: "", pt: "", zh: "", ja: "", ko: "" }, author: "" },
                ])
              }
              className="rounded-full border border-gold/40 px-4 py-1.5 text-xs text-foreground/60 hover:bg-gold/5"
            >
              {L.aggiungiRecensione}
            </button>
            <button
              onClick={handleTranslateReviews}
              disabled={reviewsTranslateState === "translating"}
              className="rounded-full border border-foreground/30 px-4 py-1.5 text-xs text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
            >
              {reviewsTranslateState === "translating" ? L.inCorso : L.traduciRecensioni}
            </button>
            {reviewsTranslateState === "done" && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">{L.tradotto}</span>
            )}
            {reviewsTranslateState === "error" && (
              <span className="text-xs text-red-600">{reviewsTranslateError}</span>
            )}
          </div>
        </div>
        <SaveButton saveState={saveState} onClick={handleSave} labels={saveLabels} />
      </div>
    );
  }

  function renderSeo() {
    if (!content) return null;
    const suffix = content.seoTitleSuffix ? ` · ${content.seoTitleSuffix}` : "";
    const previewTitle = `${content.siteTitle.it} — ${content.locationDisplay}${suffix}`;
    const desc = content.metaDescription ?? "";
    const names = content.alternateNames ?? [];
    const host = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return (
      <div className="max-w-2xl space-y-6">
        <p className="text-sm text-foreground/60">{S.intro}</p>

        {/* Anteprima Google */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">{S.preview}</span>
          <div className="mt-1 rounded-lg border border-gold/40 bg-background px-4 py-3">
            {host && <p className="text-xs text-green-700">{host}</p>}
            <p className="text-lg leading-snug text-[#1a0dab]">
              {previewTitle.length > 62 ? previewTitle.slice(0, 62) + "…" : previewTitle}
            </p>
            <p className="text-sm text-foreground/70">
              {desc ? (desc.length > 158 ? desc.slice(0, 158) + "…" : desc) : "…"}
            </p>
          </div>
        </div>

        {/* Descrizione per Google */}
        <label className={labelCls}>
          <FieldLabel>
            {S.metaDesc} <span className="text-foreground/40">({desc.length}/155)</span>
          </FieldLabel>
          <textarea rows={3} value={desc} onChange={(e) => set("metaDescription", e.target.value)} className={inputCls} />
          <span className="text-xs text-foreground/40">{S.metaDescHelp}</span>
        </label>

        {/* Aggiunta al titolo (landmark/zona) */}
        <label className={labelCls}>
          <FieldLabel>{S.titleSuffix}</FieldLabel>
          <input type="text" value={content.seoTitleSuffix ?? ""} onChange={(e) => set("seoTitleSuffix", e.target.value)} placeholder={S.titleSuffixPh} className={inputCls} />
          <span className="text-xs text-foreground/40">{S.titleSuffixHelp}</span>
        </label>

        {/* Nomi alternativi */}
        <label className={labelCls}>
          <FieldLabel>{S.altNames}</FieldLabel>
          <input
            type="text"
            value={names.join(", ")}
            onChange={(e) => set("alternateNames", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            placeholder="Casa Misteriosa, The Mysterious Home…"
            className={inputCls}
          />
          <span className="text-xs text-foreground/40">{S.altNamesHelp}</span>
        </label>

        <SaveButton saveState={saveState} onClick={handleSave} labels={saveLabels} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Traduci tutto */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
        <button
          onClick={handleTranslateAll}
          disabled={allTranslateState === "translating"}
          className="rounded-full bg-gold px-5 py-1.5 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:opacity-90 disabled:opacity-50"
        >
          {allTranslateState === "translating" ? L.inCorso : L.traduceTutto}
        </button>
        <p className="text-xs text-foreground/50">
          {L.traduceDesc}
        </p>
        {allTranslateState === "done" && (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
            {L.traduzioneCompletata}
          </span>
        )}
        {allTranslateState === "error" && (
          <span className="text-xs text-red-600">{allTranslateError}</span>
        )}
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-6 border-b border-gold/20">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm transition ${
              activeTab === tab
                ? "border-b border-foreground text-foreground"
                : "text-foreground/60 hover:text-foreground/80"
            }`}
          >
            {subTabLabels[tab]}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === "struttura" && renderStruttura()}

        {activeTab === "testi" && renderTesti()}
        {activeTab === "area" && renderArea()}
        {activeTab === "servizi" && renderServizi()}
        {activeTab === "recensioni" && renderRecensioni()}
        {activeTab === "seo" && renderSeo()}
      </div>

      <DeployToast sha={deploySha} onDone={() => setDeploySha(null)} />
    </div>
  );
}
