"use client";

import { useEffect, useState } from "react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import { adminLocaleOrder, adminTranslations, type AdminLocaleCode } from "@/i18n/admin";
import type { CalendarSyncResult } from "@/app/api/admin/calendar-sync/route";
import type { OtaPlatform } from "@/data/availability";
import { PORTAL_LINK } from "@/lib/portalLink";
import { bookableUnits, rootUnitId } from "@/lib/structure";

type State = "idle" | "saving" | "success" | "error";

// Etichetta "Unità" per il selettore OTA per-unità (fuori dall'oggetto LABELS grande).
const UNIT_LABELS: Record<string, { unit: string }> = {
  it: { unit: "Unità" },
  en: { unit: "Unit" },
  es: { unit: "Unidad" },
  fr: { unit: "Unité" },
};

const PLATFORMS: OtaPlatform[] = ["airbnb", "booking", "vrbo"];
const PLATFORM_NAME: Record<OtaPlatform, string> = { airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo" };
const PLATFORM_COLOR: Record<OtaPlatform, string> = { airbnb: "#FF5A5F", booking: "#003580", vrbo: "#0D9488" };
const ICAL_PLACEHOLDER: Record<OtaPlatform, string> = {
  airbnb: "https://www.airbnb.com/calendar/ical/…",
  booking: "https://admin.booking.com/…/ical/…",
  vrbo: "http://www.vrbo.com/icalendar/…",
};

const LABELS = {
  it: {
    title: "Sincronizzazione calendari",
    desc: "Importa le prenotazioni da Airbnb, Booking e Vrbo tramite l'URL iCal di ciascuna piattaforma. Le date prenotate altrove bloccano il calendario così eviti le doppie prenotazioni.",
    icalUrl: "URL iCal",
    save: "Salva URL", saving: "Salvataggio…", saved: "URL salvati.", saveError: "Errore nel salvataggio.",
    syncNow: "Sincronizza ora", syncing: "Sincronizzazione…", syncError: "Sincronizzazione fallita.",
    imported: "importate", blocks: "bloccate", noneConfigured: "Inserisci almeno un URL iCal e salva.",
    conflicts: (n: number) => `⚠ ${n} ${n === 1 ? "conflitto rilevato" : "conflitti rilevati"} (overbooking) — controlla il calendario`,
    reverseTitle: "Da bloccare sulle altre piattaforme",
    reverseItem: (label: string, on: string) => `Blocca le notti di “${label}” su: ${on}`,
    bookingDisclaimer: "Nota: l'iCal di Booking spesso non distingue una prenotazione da un blocco, quindi alcuni conflitti che coinvolgono Booking potrebbero non essere rilevati automaticamente.",
    fetchError: (p: string) => `Impossibile scaricare il calendario ${p} — i dati precedenti sono stati mantenuti.`,
    changed: "Sincronizzazione completata — il sito si aggiornerà tra qualche secondo.",
    unchanged: "Sincronizzazione completata — nessuna modifica.",
    demo: "In demo la sincronizzazione non viene eseguita.",
    autoSyncNote: "La sincronizzazione in import è automatica ogni 3 ore; qui puoi anche forzarla subito.",
    lastAutoSync: "Ultima sincronizzazione automatica",
    lastAutoSyncNever: "nessuna ancora",
    exportTitle: "Esporta il tuo calendario",
    exportDesc: "Incolla il link di ciascuna unità nel campo \u201cimporta calendario\u201d del rispettivo annuncio (Airbnb, Booking\u2026): vedranno le notti gi\u00e0 occupate qui e le bloccheranno.",
    exportCopy: "Copia",
    exportCopied: "Copiato \u2713",
    exportSecret: "Link segreti: non condividerli pubblicamente.",
    extTitle: "Prenotazione esterna",
    extDesc: "Se un ospite preferisce prenotare fuori da Dimora, il bottone “Prenota su…” in home lo porta alla piattaforma scelta.",
    airbnbListing: "URL annuncio Airbnb",
    bookingListing: "URL annuncio Booking.com",
    vrboListing: "URL annuncio Vrbo",
    defaultLabel: "Piattaforma predefinita del bottone",
    langTitle: "Lingua del pannello",
    langDesc: "La lingua di questo pannello di amministrazione. Il sito pubblico resta multilingua a parte.",
    langNote: "Lingua del pannello aggiornata.",
    langSave: "Salva",
    policyCard: "Regole di prenotazione", policyCardDesc: "Acconto, cancellazione, tassa di soggiorno, orari di check-in/out.",
    stripeCard: "Pagamenti (Stripe)", stripeCardDesc: "Chiavi, modalità test/produzione, sicurezza.",
    themeCard: "Colori", themeCardDesc: "Palette e colori del sito, con anteprima e controllo di contrasto.",
    accessCard: "Accessi amministratore", accessCardDesc: "Gli indirizzi email autorizzati ad accedere al pannello.",
    portalTitle: "Portale",
    portalLinkedTo: "Questo sito è collegato al portale:",
    portalNotLinked: "Questo sito non è collegato a nessun portale (funziona in autonomia).",
    portalHint: "Un sito può appartenere a un solo portale. Per collegarlo, avvia l'associazione dal pannello del portale.",
    portalUnlink: "Scollega", portalUnlinking: "Scollegamento…", portalUnlinked: "Scollegato — il portale si aggiornerà tra 1-2 minuti.", portalUnlinkErr: "Scollegamento fallito.",
  },
  en: {
    title: "Calendar sync",
    desc: "Import bookings from Airbnb, Booking and Vrbo via each platform's iCal URL. Dates booked elsewhere block your calendar so you avoid double bookings.",
    icalUrl: "iCal URL",
    save: "Save URLs", saving: "Saving…", saved: "URLs saved.", saveError: "Error saving.",
    syncNow: "Sync now", syncing: "Syncing…", syncError: "Sync failed.",
    imported: "imported", blocks: "blocked", noneConfigured: "Enter at least one iCal URL and save.",
    conflicts: (n: number) => `⚠ ${n} conflict${n === 1 ? "" : "s"} detected (overbooking) — check the calendar`,
    reverseTitle: "To block on the other platforms",
    reverseItem: (label: string, on: string) => `Block the nights of “${label}” on: ${on}`,
    bookingDisclaimer: "Note: Booking's iCal often doesn't distinguish a reservation from a block, so some conflicts involving Booking may not be detected automatically.",
    fetchError: (p: string) => `Couldn't download the ${p} calendar — previous data was kept.`,
    changed: "Sync complete — the site will update in a few seconds.",
    unchanged: "Sync complete — no changes.",
    demo: "In the demo, sync is not performed.",
    autoSyncNote: "Importing runs automatically every 3 hours; here you can also force it now.",
    lastAutoSync: "Last automatic sync",
    lastAutoSyncNever: "none yet",
    exportTitle: "Export your calendar",
    exportDesc: "Paste each unit's link into the \u201cimport calendar\u201d field of its listing (Airbnb, Booking\u2026): they'll see the nights already taken here and block them.",
    exportCopy: "Copy",
    exportCopied: "Copied \u2713",
    exportSecret: "Secret links: don't share them publicly.",
    extTitle: "External booking",
    extDesc: "If a guest prefers to book outside Dimora, the “Book on…” button on the homepage sends them to the chosen platform.",
    airbnbListing: "Airbnb listing URL",
    bookingListing: "Booking.com listing URL",
    vrboListing: "Vrbo listing URL",
    defaultLabel: "Default platform for the button",
    langTitle: "Panel language",
    langDesc: "The language of this admin panel. The public site stays multilingual separately.",
    langNote: "Panel language updated.",
    langSave: "Save",
    policyCard: "Booking rules", policyCardDesc: "Deposit, cancellation, city tax, check-in/out times.",
    stripeCard: "Payments (Stripe)", stripeCardDesc: "Keys, test/live mode, security.",
    themeCard: "Colors", themeCardDesc: "Site palette and colors, with preview and contrast check.",
    accessCard: "Admin access", accessCardDesc: "The email addresses allowed to sign in to the panel.",
    portalTitle: "Portal",
    portalLinkedTo: "This site is linked to the portal:",
    portalNotLinked: "This site isn't linked to any portal (it works on its own).",
    portalHint: "A site can belong to only one portal. To link it, start the association from the portal's panel.",
    portalUnlink: "Unlink", portalUnlinking: "Unlinking…", portalUnlinked: "Unlinked — the portal will update in 1–2 minutes.", portalUnlinkErr: "Unlink failed.",
  },
  es: {
    title: "Sincronización de calendarios",
    desc: "Importa las reservas de Airbnb, Booking y Vrbo mediante la URL iCal de cada plataforma. Las fechas reservadas en otro sitio bloquean tu calendario para evitar dobles reservas.",
    icalUrl: "URL iCal",
    save: "Guardar URLs", saving: "Guardando…", saved: "URLs guardadas.", saveError: "Error al guardar.",
    syncNow: "Sincronizar ahora", syncing: "Sincronizando…", syncError: "Sincronización fallida.",
    imported: "importadas", blocks: "bloqueadas", noneConfigured: "Introduce al menos una URL iCal y guarda.",
    conflicts: (n: number) => `⚠ ${n} conflicto${n === 1 ? "" : "s"} detectado${n === 1 ? "" : "s"} (overbooking) — revisa el calendario`,
    reverseTitle: "Para bloquear en las otras plataformas",
    reverseItem: (label: string, on: string) => `Bloquea las noches de «${label}» en: ${on}`,
    bookingDisclaimer: "Nota: el iCal de Booking a menudo no distingue una reserva de un bloqueo, por lo que algunos conflictos con Booking podrían no detectarse automáticamente.",
    fetchError: (p: string) => `No se pudo descargar el calendario ${p} — se mantuvieron los datos anteriores.`,
    changed: "Sincronización completa — el sitio se actualizará en unos segundos.",
    unchanged: "Sincronización completa — sin cambios.",
    demo: "En la demo la sincronización no se ejecuta.",
    autoSyncNote: "La importación se ejecuta automáticamente cada 3 horas; aquí también puedes forzarla ahora.",
    lastAutoSync: "Última sincronización automática",
    lastAutoSyncNever: "ninguna todavía",
    exportTitle: "Exporta tu calendario",
    exportDesc: "Pega el enlace de cada unidad en el campo \u201cimportar calendario\u201d de su anuncio (Airbnb, Booking\u2026): verán las noches ya ocupadas aquí y las bloquearán.",
    exportCopy: "Copiar",
    exportCopied: "Copiado \u2713",
    exportSecret: "Enlaces secretos: no los compartas públicamente.",
    extTitle: "Reserva externa",
    extDesc: "Si un huésped prefiere reservar fuera de Dimora, el botón «Reserva en…» de la home lo lleva a la plataforma elegida.",
    airbnbListing: "URL del anuncio de Airbnb",
    bookingListing: "URL del anuncio de Booking.com",
    vrboListing: "URL del anuncio de Vrbo",
    defaultLabel: "Plataforma predeterminada del botón",
    langTitle: "Idioma del panel",
    langDesc: "El idioma de este panel de administración. El sitio público sigue siendo multilingüe.",
    langNote: "Idioma del panel actualizado.",
    langSave: "Guardar",
    policyCard: "Reglas de reserva", policyCardDesc: "Depósito, cancelación, tasa turística, horarios de entrada/salida.",
    stripeCard: "Pagos (Stripe)", stripeCardDesc: "Claves, modo prueba/producción, seguridad.",
    themeCard: "Colores", themeCardDesc: "Paleta y colores del sitio, con vista previa y control de contraste.",
    accessCard: "Accesos de administrador", accessCardDesc: "Las direcciones de correo autorizadas a entrar en el panel.",
    portalTitle: "Portal",
    portalLinkedTo: "Este sitio está vinculado al portal:",
    portalNotLinked: "Este sitio no está vinculado a ningún portal (funciona por su cuenta).",
    portalHint: "Un sitio puede pertenecer a un solo portal. Para vincularlo, inicia la asociación desde el panel del portal.",
    portalUnlink: "Desvincular", portalUnlinking: "Desvinculando…", portalUnlinked: "Desvinculado — el portal se actualizará en 1-2 minutos.", portalUnlinkErr: "Error al desvincular.",
  },
  fr: {
    title: "Synchronisation des calendriers",
    desc: "Importez les réservations d'Airbnb, Booking et Vrbo via l'URL iCal de chaque plateforme. Les dates réservées ailleurs bloquent votre calendrier pour éviter les doubles réservations.",
    icalUrl: "URL iCal",
    save: "Enregistrer les URL", saving: "Enregistrement…", saved: "URL enregistrées.", saveError: "Erreur d'enregistrement.",
    syncNow: "Synchroniser", syncing: "Synchronisation…", syncError: "Échec de la synchronisation.",
    imported: "importées", blocks: "bloquées", noneConfigured: "Saisissez au moins une URL iCal et enregistrez.",
    conflicts: (n: number) => `⚠ ${n} conflit${n === 1 ? "" : "s"} détecté${n === 1 ? "" : "s"} (surréservation) — vérifiez le calendrier`,
    reverseTitle: "À bloquer sur les autres plateformes",
    reverseItem: (label: string, on: string) => `Bloquez les nuits de « ${label} » sur : ${on}`,
    bookingDisclaimer: "Remarque : l'iCal de Booking ne distingue souvent pas une réservation d'un blocage, donc certains conflits impliquant Booking peuvent ne pas être détectés automatiquement.",
    fetchError: (p: string) => `Impossible de télécharger le calendrier ${p} — les données précédentes ont été conservées.`,
    changed: "Synchronisation terminée — le site se mettra à jour dans quelques secondes.",
    unchanged: "Synchronisation terminée — aucun changement.",
    demo: "Dans la démo, la synchronisation n'est pas exécutée.",
    autoSyncNote: "L'import s'exécute automatiquement toutes les 3 heures ; ici vous pouvez aussi le forcer maintenant.",
    lastAutoSync: "Dernière synchronisation automatique",
    lastAutoSyncNever: "aucune pour l'instant",
    exportTitle: "Exportez votre calendrier",
    exportDesc: "Collez le lien de chaque unité dans le champ « importer un calendrier » de son annonce (Airbnb, Booking\u2026) : ils verront les nuits déjà occupées ici et les bloqueront.",
    exportCopy: "Copier",
    exportCopied: "Copié \u2713",
    exportSecret: "Liens secrets : ne les partagez pas publiquement.",
    extTitle: "Réservation externe",
    extDesc: "Si un voyageur préfère réserver hors de Dimora, le bouton « Réserver sur… » de l'accueil l'envoie vers la plateforme choisie.",
    airbnbListing: "URL de l'annonce Airbnb",
    bookingListing: "URL de l'annonce Booking.com",
    vrboListing: "URL de l'annonce Vrbo",
    defaultLabel: "Plateforme par défaut du bouton",
    langTitle: "Langue du panneau",
    langDesc: "La langue de ce panneau d'administration. Le site public reste multilingue séparément.",
    langNote: "Langue du panneau mise à jour.",
    langSave: "Enregistrer",
    policyCard: "Règles de réservation", policyCardDesc: "Acompte, annulation, taxe de séjour, horaires d'arrivée/départ.",
    stripeCard: "Paiements (Stripe)", stripeCardDesc: "Clés, mode test/production, sécurité.",
    themeCard: "Couleurs", themeCardDesc: "Palette et couleurs du site, avec aperçu et contrôle du contraste.",
    accessCard: "Accès administrateur", accessCardDesc: "Les adresses e-mail autorisées à se connecter au panneau.",
    portalTitle: "Portail",
    portalLinkedTo: "Ce site est associé au portail :",
    portalNotLinked: "Ce site n'est associé à aucun portail (il fonctionne seul).",
    portalHint: "Un site ne peut appartenir qu'à un seul portail. Pour l'associer, lancez l'association depuis le panneau du portail.",
    portalUnlink: "Dissocier", portalUnlinking: "Dissociation…", portalUnlinked: "Dissocié — le portail se mettra à jour dans 1 à 2 minutes.", portalUnlinkErr: "Échec de la dissociation.",
  },
} as const;

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function SettingsManager() {
  const { locale, setLocale } = useAdminLanguage();
  const L = LABELS[locale as keyof typeof LABELS] ?? LABELS.en;
  const UL = UNIT_LABELS[locale] ?? UNIT_LABELS.en;

  // Tab OTA: solo unità affittabili (un appartamento "solo camere" non ha OTA proprie).
  // Il TIPO di struttura (intero prenotabile / solo camere) si decide alla creazione
  // (wizard) e non è modificabile qui: cambiarlo a caldo è troppo delicato.
  const UNITS = bookableUnits();
  const [syncUnit, setSyncUnit] = useState(bookableUnits()[0]?.id ?? rootUnitId());
  const [urls, setUrls] = useState<Record<OtaPlatform, string>>({ airbnb: "", booking: "", vrbo: "" });
  const [saveState, setSaveState] = useState<State>("idle");
  const [syncState, setSyncState] = useState<State>("idle");
  const [syncError, setSyncError] = useState("");
  const [result, setResult] = useState<CalendarSyncResult | null>(null);
  const [demoDone, setDemoDone] = useState(false);
  const [ext, setExt] = useState<{ airbnbUrl: string; bookingUrl: string; vrboUrl: string; defaultBookingPlatform: OtaPlatform }>({ airbnbUrl: "", bookingUrl: "", vrboUrl: "", defaultBookingPlatform: "airbnb" });
  const [extSaveState, setExtSaveState] = useState<State>("idle");
  const [adminLoc, setAdminLoc] = useState<AdminLocaleCode>(locale as AdminLocaleCode);
  // Lingua SELEZIONATA nel menu ma non ancora salvata (il salvataggio è esplicito, col
  // pulsante, e fa un redeploy → notifica "in pubblicazione").
  const [pendingLoc, setPendingLoc] = useState<AdminLocaleCode>(locale as AdminLocaleCode);
  const [portalState, setPortalState] = useState<State>("idle");
  const [portalMsg, setPortalMsg] = useState("");
  const [locSaveState, setLocSaveState] = useState<State>("idle");
  const [exportUnits, setExportUnits] = useState<{ unitId: string; label: string; url: string }[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/calendar-export")
      .then((r) => r.json())
      .then((d: { units?: { unitId: string; label: string; url: string }[]; lastSyncAt?: string | null }) => {
        setExportUnits(d.units ?? []);
        setLastSyncAt(d.lastSyncAt ?? null);
      })
      .catch(() => {});
  }, []);

  async function copyExportUrl(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2500);
    } catch {
      /* clipboard non disponibile: l'utente può selezionare il testo a mano */
    }
  }

  // Campi condivisi a livello struttura (annunci esterni, lingua del pannello).
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d: { airbnbUrl?: string; bookingUrl?: string; vrboUrl?: string; defaultBookingPlatform?: OtaPlatform; adminLocale?: AdminLocaleCode }) => {
        setExt({ airbnbUrl: d.airbnbUrl ?? "", bookingUrl: d.bookingUrl ?? "", vrboUrl: d.vrboUrl ?? "", defaultBookingPlatform: d.defaultBookingPlatform ?? "airbnb" });
        if (d.adminLocale) setAdminLoc(d.adminLocale);
      })
      .catch(() => {});
  }, []);

  // URL iCal PER UNITÀ: si ricaricano quando cambia l'unità selezionata.
  useEffect(() => {
    fetch(`/api/admin/settings?unit=${encodeURIComponent(syncUnit)}`)
      .then((r) => r.json())
      .then((d: { calendars?: Record<OtaPlatform, string> }) => {
        setUrls({ airbnb: d.calendars?.airbnb ?? "", booking: d.calendars?.booking ?? "", vrbo: d.calendars?.vrbo ?? "" });
      })
      .catch(() => {});
  }, [syncUnit]);

  async function saveExternal() {
    setExtSaveState("saving");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airbnbUrl: ext.airbnbUrl, bookingUrl: ext.bookingUrl, vrboUrl: ext.vrboUrl, defaultBookingPlatform: ext.defaultBookingPlatform }),
      });
      if (!res.ok) throw new Error();
      setExtSaveState("success");
      setTimeout(() => setExtSaveState("idle"), 3000);
    } catch { setExtSaveState("error"); }
  }

  async function saveLocale() {
    const next = pendingLoc;
    // Effetto IMMEDIATO: aggiorna il context (tutti i tab, questa pagina inclusa) e scrive
    // il cookie → la lingua cambia subito e persiste ai reload, senza aspettare il redeploy.
    setLocale(next);
    setAdminLoc(next);
    setLocSaveState("saving");
    try {
      // Persiste anche il DEFAULT del sito (policies.adminLocale) in background.
      const res = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminLocale: next }),
      });
      if (!res.ok) throw new Error();
      setLocSaveState("success");
      setTimeout(() => setLocSaveState("idle"), 4000);
    } catch { setLocSaveState("error"); }
  }

  const anyUrl = PLATFORMS.some((p) => urls[p].trim());

  async function saveUrls() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit: syncUnit, calendars: urls }),
      });
      if (!res.ok) throw new Error();
      setSaveState("success");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch { setSaveState("error"); }
  }

  async function runSync() {
    setSyncState("saving");
    setSyncError("");
    setResult(null);
    setDemoDone(false);
    try {
      const res = await fetch(`/api/admin/calendar-sync?unit=${encodeURIComponent(syncUnit)}`, { method: "POST" });
      const data = await res.json();
      if (data?.demo) { setDemoDone(true); setSyncState("success"); return; }
      if (!res.ok) throw new Error(data?.error ?? "");
      setResult(data as CalendarSyncResult);
      setSyncState("success");
    } catch (err) {
      setSyncError(err instanceof Error && err.message ? err.message : L.syncError);
      setSyncState("error");
    }
  }

  async function unlinkPortal() {
    setPortalState("saving");
    setPortalMsg("");
    try {
      const res = await fetch("/api/admin/portal-unlink", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPortalState("error");
        setPortalMsg(data.error || L.portalUnlinkErr);
        return;
      }
      setPortalState("success");
      setPortalMsg(L.portalUnlinked);
    } catch {
      setPortalState("error");
      setPortalMsg(L.portalUnlinkErr);
    }
  }

  return (
    <div className="space-y-6">

      {/* Lingua del pannello admin */}
      <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-3">
        <div>
          <h2 className="font-serif-display text-2xl italic text-foreground">{L.langTitle}</h2>
          <p className="mt-1 text-sm text-foreground/60">{L.langDesc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={pendingLoc}
            onChange={(e) => { setPendingLoc(e.target.value as AdminLocaleCode); setLocSaveState("idle"); }}
            disabled={locSaveState === "saving"}
            className="rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold disabled:opacity-50"
          >
            {adminLocaleOrder.map((code) => (
              <option key={code} value={code}>{adminTranslations[code].langName}</option>
            ))}
          </select>
          <button
            onClick={saveLocale}
            disabled={pendingLoc === adminLoc || locSaveState === "saving"}
            className="rounded-full border border-gold bg-gold px-6 py-2 text-xs font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-gold disabled:hover:text-[#faf6ec]"
          >
            {locSaveState === "saving" ? L.saving : L.langSave}
          </button>
        </div>
        {locSaveState === "success" && <p className="text-xs text-green-700">✓ {L.langNote}</p>}
        {locSaveState === "error" && <p className="text-xs text-red-600">{L.saveError}</p>}
      </div>

      {/* Portale: appartenenza (uno solo) + scollega. Un sito senza legame è autonomo. */}
      <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-3">
        <h2 className="font-serif-display text-2xl italic text-foreground">{L.portalTitle}</h2>
        {portalState === "success" ? (
          <p className="text-sm text-green-700">{portalMsg || L.portalUnlinked}</p>
        ) : PORTAL_LINK.url ? (
          <>
            <p className="text-sm text-foreground/70">
              {L.portalLinkedTo}{" "}
              <a href={PORTAL_LINK.url} target="_blank" rel="noopener" className="text-gold hover:underline">
                {PORTAL_LINK.name || PORTAL_LINK.url}
              </a>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={unlinkPortal}
                disabled={portalState === "saving" || DEMO}
                className="rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10 disabled:opacity-50"
              >
                {portalState === "saving" ? L.portalUnlinking : L.portalUnlink}
              </button>
              {portalState === "error" && <span className="text-xs text-red-600">{portalMsg}</span>}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground/60">{L.portalNotLinked}</p>
            <p className="text-xs text-foreground/40">{L.portalHint}</p>
          </>
        )}
      </div>

      <div>
        <h2 className="font-serif-display text-2xl italic text-foreground">{L.title}</h2>
        <p className="mt-1 text-sm text-foreground/60">{L.desc}</p>
      </div>

      {/* Struttura con camere: la sincronizzazione OTA è per unità (ogni inserzione ha i suoi calendari). */}
      {UNITS.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-foreground/50">{UL.unit}</span>
          {UNITS.map((u) => {
            const name = u.name[locale as keyof typeof u.name] || u.name.it || u.id;
            const active = u.id === syncUnit;
            return (
              <button
                key={u.id}
                onClick={() => { setSyncUnit(u.id); setResult(null); setSyncState("idle"); setSaveState("idle"); }}
                className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-widest transition ${
                  active ? "border-gold bg-gold text-[#faf6ec]" : "border-gold/40 text-foreground/70 hover:border-gold"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-4">
        {PLATFORMS.map((p) => (
          <div key={p}>
            <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-foreground/50">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PLATFORM_COLOR[p] }} />
              {PLATFORM_NAME[p]} · {L.icalUrl}
            </label>
            <input
              type="url" value={urls[p]}
              onChange={(e) => { setUrls((u) => ({ ...u, [p]: e.target.value })); setSaveState("idle"); }}
              placeholder={ICAL_PLACEHOLDER[p]}
              className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold font-mono"
            />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={saveUrls} disabled={saveState === "saving"}
            className="rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10 disabled:opacity-50">
            {saveState === "saving" ? L.saving : L.save}
          </button>
          {saveState === "success" && <span className="text-xs text-green-700">{DEMO ? L.demo : L.saved}</span>}
          {saveState === "error" && <span className="text-xs text-red-600">{L.saveError}</span>}
        </div>
      </div>

      <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-4">
        <button onClick={runSync} disabled={syncState === "saving" || !anyUrl}
          className="rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50 disabled:cursor-not-allowed">
          {syncState === "saving" ? L.syncing : L.syncNow}
        </button>
        <p className="text-xs text-foreground/50">{L.autoSyncNote}</p>
        {!DEMO && (
          <p className="text-xs text-foreground/60">
            {L.lastAutoSync}: <span className="text-foreground/80">{lastSyncAt ? new Date(lastSyncAt).toLocaleString(locale) : L.lastAutoSyncNever}</span>
          </p>
        )}
        {!anyUrl && <p className="text-xs text-foreground/50">{L.noneConfigured}</p>}
        {syncState === "error" && <p className="text-sm text-red-600">{syncError}</p>}
        {demoDone && <p className="text-sm text-foreground/70">{L.demo}</p>}

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-green-700">{result.changed ? L.changed : L.unchanged}</p>

            <ul className="space-y-1 text-xs text-foreground/70">
              {result.perPlatform.map((p) => (
                <li key={p.platform} className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PLATFORM_COLOR[p.platform] }} />
                  {PLATFORM_NAME[p.platform]}: {p.reservations} {L.imported} · {p.blocks} {L.blocks}
                </li>
              ))}
            </ul>

            {result.fetchErrors.map((e) => (
              <p key={e.platform} className="text-xs text-amber-700">{L.fetchError(PLATFORM_NAME[e.platform])}</p>
            ))}

            {result.conflicts.length > 0 && (
              <p className="rounded-md border border-red-400/60 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {L.conflicts(result.conflicts.length)}
              </p>
            )}

            {result.reverseGaps.length > 0 && (
              <div className="rounded-md border border-gold/40 bg-background p-3 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gold">{L.reverseTitle}</p>
                <ul className="space-y-1">
                  {result.reverseGaps.map((g, i) => (
                    <li key={i} className="text-xs text-foreground/70">
                      {L.reverseItem(g.label, g.missingOn.map((m) => PLATFORM_NAME[m]).join(", "))}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.bookingDisclaimer && (
              <p className="text-xs text-foreground/50">{L.bookingDisclaimer}</p>
            )}
          </div>
        )}
      </div>

      {/* Export: un feed iCal per unità affittabile (noi → OTA), protetto da token segreto. */}
      <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-3">
        <div>
          <h2 className="font-serif-display text-2xl italic text-foreground">{L.exportTitle}</h2>
          <p className="mt-1 text-sm text-foreground/60">{L.exportDesc}</p>
        </div>
        {exportUnits.length > 0 ? (
          <>
            {exportUnits.map((u) => (
              <div key={u.unitId}>
                {exportUnits.length > 1 && (
                  <label className="text-[11px] uppercase tracking-widest text-foreground/50">{u.label}</label>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <input
                    type="text" readOnly value={u.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded border border-gold/40 bg-background px-3 py-2 text-xs text-foreground/80 outline-none font-mono"
                  />
                  <button onClick={() => copyExportUrl(u.unitId, u.url)}
                    className="rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10">
                    {copiedId === u.unitId ? L.exportCopied : L.exportCopy}
                  </button>
                </div>
              </div>
            ))}
            <p className="text-xs text-foreground/50">{L.exportSecret}</p>
          </>
        ) : (
          <p className="text-xs text-foreground/50">{DEMO ? L.demo : L.noneConfigured}</p>
        )}
      </div>

      <div className="rounded-lg border border-gold/40 bg-card p-5 space-y-4">
        <div>
          <h2 className="font-serif-display text-2xl italic text-foreground">{L.extTitle}</h2>
          <p className="mt-1 text-sm text-foreground/60">{L.extDesc}</p>
        </div>
        <div>
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-foreground/50">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PLATFORM_COLOR.airbnb }} />{L.airbnbListing}
          </label>
          <input type="url" value={ext.airbnbUrl}
            onChange={(e) => { setExt((x) => ({ ...x, airbnbUrl: e.target.value })); setExtSaveState("idle"); }}
            placeholder="https://www.airbnb.com/rooms/…"
            className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold font-mono" />
        </div>
        <div>
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-foreground/50">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PLATFORM_COLOR.booking }} />{L.bookingListing}
          </label>
          <input type="url" value={ext.bookingUrl}
            onChange={(e) => { setExt((x) => ({ ...x, bookingUrl: e.target.value })); setExtSaveState("idle"); }}
            placeholder="https://www.booking.com/hotel/…"
            className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold font-mono" />
        </div>
        <div>
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-foreground/50">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PLATFORM_COLOR.vrbo }} />{L.vrboListing}
          </label>
          <input type="url" value={ext.vrboUrl}
            onChange={(e) => { setExt((x) => ({ ...x, vrboUrl: e.target.value })); setExtSaveState("idle"); }}
            placeholder="https://www.vrbo.com/…"
            className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold font-mono" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-widest text-foreground/50">{L.defaultLabel}</label>
          <select value={ext.defaultBookingPlatform}
            onChange={(e) => { setExt((x) => ({ ...x, defaultBookingPlatform: e.target.value as OtaPlatform })); setExtSaveState("idle"); }}
            className="mt-1 block rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold">
            {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_NAME[p]}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={saveExternal} disabled={extSaveState === "saving"}
            className="rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10 disabled:opacity-50">
            {extSaveState === "saving" ? L.saving : L.save}
          </button>
          {extSaveState === "success" && <span className="text-xs text-green-700">{DEMO ? L.demo : L.saved}</span>}
          {extSaveState === "error" && <span className="text-xs text-red-600">{L.saveError}</span>}
        </div>
      </div>
    </div>
  );
}
