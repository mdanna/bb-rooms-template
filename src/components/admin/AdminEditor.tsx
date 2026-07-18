"use client";

import { useState } from "react";
import type { DayRate, StayRule } from "@/data/availability";
import AdminCalendar from "./AdminCalendar";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import { useDrafts } from "@/components/admin/DraftContext";
import AdminSaveBar from "@/components/admin/AdminSaveBar";

interface Props {
  initialDefaultPrice: number;
  initialOverrides: DayRate[];
  initialStayRules: StayRule[];
  // Struttura con camere: unità di cui si modifica il calendario. Assente → radice.
  unitId?: string;
}

// Etichette locali (lingua del pannello it/en/es/fr, fallback en) per la sezione "Regole
// di soggiorno per date" — stesso schema module-local di AdminCalendar.LABELS, senza
// aggiungere chiavi ai tipi i18n condivisi. Le regole sono PER UNITÀ (calendario dell'unità).
const STAY_LABELS = {
  it: {
    title: "Regole di soggiorno per date",
    desc: "Durata minima/massima delle notti per i CHECK-IN in un intervallo di date, per questa unità. Lascia un campo vuoto per usare il valore di default (Impostazioni).",
    from: "Dal", to: "Al", minStay: "Min notti", maxStay: "Max notti",
    add: "Aggiungi regola", remove: "Rimuovi",
    empty: "Nessuna regola: valgono i valori di default delle Impostazioni.",
  },
  en: {
    title: "Stay rules by date",
    desc: "Minimum/maximum nights for CHECK-IN dates within a range, for this unit. Leave a field empty to use the default value (Settings).",
    from: "From", to: "To", minStay: "Min nights", maxStay: "Max nights",
    add: "Add rule", remove: "Remove",
    empty: "No rules: the default values from Settings apply.",
  },
  es: {
    title: "Reglas de estancia por fechas",
    desc: "Noches mínimas/máximas para los CHECK-IN dentro de un rango de fechas, para esta unidad. Deja un campo vacío para usar el valor por defecto (Ajustes).",
    from: "Del", to: "Al", minStay: "Mín noches", maxStay: "Máx noches",
    add: "Añadir regla", remove: "Quitar",
    empty: "Sin reglas: se aplican los valores por defecto de Ajustes.",
  },
  fr: {
    title: "Règles de séjour par dates",
    desc: "Nuits minimum/maximum pour les CHECK-IN dans une plage de dates, pour cette unité. Laissez un champ vide pour utiliser la valeur par défaut (Réglages).",
    from: "Du", to: "Au", minStay: "Min nuits", maxStay: "Max nuits",
    add: "Ajouter une règle", remove: "Retirer",
    empty: "Aucune règle : les valeurs par défaut des Réglages s'appliquent.",
  },
} as const;

type RangeMode = "price" | "booked" | "direct";

const EDITOR_LABELS = {
  it: {
    basePrice: "Prezzo di base", basePriceDesc: "Usato per qualsiasi data senza un prezzo o uno stato personalizzato.", perNight: "a notte",
    setRange: "Imposta un intervallo di date", setRangeDesc: "Scegli le date, poi indica un prezzo oppure segna l'intervallo come occupato.",
    checkin: "Check-in", checkout: "Check-out", from: "Dal", to: "Al",
    nightsNote: "Si bloccano le notti dal check-in al check-out: il giorno di check-out resta prenotabile.",
    setPrice: "Imposta prezzo", blockDays: "Blocca giorni", directBooking: "Inserisci prenotazione manuale",
    note: "Nota", notePlaceholder: "Nome ospite o riferimento",
    apply: "Applica all'intervallo", dateError: 'La data "Al" deve essere successiva o uguale alla data "Dal".',
    airbnbSync: "Sincronizzazione Airbnb", airbnbDesc: "Importa le prenotazioni dal calendario iCal di Airbnb.",
    icalUrl: "URL iCal Airbnb", saveUrl: "Salva URL", savingUrl: "Salvataggio…", urlSaved: "URL salvato.", urlError: "Errore nel salvataggio dell'URL.",
    syncNow: "Sincronizza ora", syncing: "Sincronizzazione in corso…",
    syncDone: (imported: number, removed: number) => `✓ Sincronizzazione completata — ${imported} notti importate${removed > 0 ? `, ${removed} precedenti rimosse` : ""}.`,
    conflicts: (n: number) => `⚠ ${n} conflitt${n === 1 ? "o" : "i"} rilevat${n === 1 ? "o" : "i"} — gestione manuale richiesta`,
    conflictDesc: "Le notti seguenti sono prenotate sia su Airbnb che tramite l'app.",
    calendar: "Calendario", calendarDesc: "Mostra il prezzo per i giorni liberi e i giorni già occupati.",
    savePublish: "Salva e pubblica", saving: "Salvataggio...", saved: "Salvato! Il sito di produzione si aggiornerà in pochi secondi.",
    conflictWarning: (n: number, first: string, last: string) => `Attenzione: ${n} nott${n === 1 ? "e già occupata" : "i già occupate"} (${first}${n > 1 ? ` … ${last}` : ""}). Elimina prima la prenotazione esistente.`,
  },
  en: {
    basePrice: "Base price", basePriceDesc: "Used for any date without a custom price or status.", perNight: "per night",
    setRange: "Set a date range", setRangeDesc: "Choose dates, then set a price or mark the range as booked.",
    checkin: "Check-in", checkout: "Check-out", from: "From", to: "To",
    nightsNote: "Nights from check-in to check-out are blocked. The check-out day remains bookable.",
    setPrice: "Set price", blockDays: "Block days", directBooking: "Add manual booking",
    note: "Note", notePlaceholder: "Guest name or reference",
    apply: "Apply to range", dateError: '"To" date must be on or after "From" date.',
    airbnbSync: "Airbnb sync", airbnbDesc: "Import bookings from the Airbnb iCal calendar.",
    icalUrl: "Airbnb iCal URL", saveUrl: "Save URL", savingUrl: "Saving…", urlSaved: "URL saved.", urlError: "Error saving URL.",
    syncNow: "Sync now", syncing: "Syncing…",
    syncDone: (imported: number, removed: number) => `✓ Sync complete — ${imported} nights imported${removed > 0 ? `, ${removed} removed` : ""}.`,
    conflicts: (n: number) => `⚠ ${n} conflict${n === 1 ? "" : "s"} detected — manual action required`,
    conflictDesc: "The following nights are booked both on Airbnb and in the app.",
    calendar: "Calendar", calendarDesc: "Shows price for free days and booked days.",
    savePublish: "Save & publish", saving: "Saving...", saved: "Saved! The production site will update in a few seconds.",
    conflictWarning: (n: number, first: string, last: string) => `Warning: ${n} night${n === 1 ? " already booked" : "s already booked"} (${first}${n > 1 ? ` … ${last}` : ""}). Delete the existing booking first.`,
  },
  es: {
    basePrice: "Precio base", basePriceDesc: "Usado para cualquier fecha sin precio o estado personalizado.", perNight: "por noche",
    setRange: "Establecer un rango de fechas", setRangeDesc: "Elige las fechas, luego indica un precio o márcalas como ocupadas.",
    checkin: "Check-in", checkout: "Check-out", from: "Del", to: "Al",
    nightsNote: "Se bloquean las noches desde el check-in al check-out. El día de check-out queda disponible.",
    setPrice: "Establecer precio", blockDays: "Bloquear días", directBooking: "Añadir reserva manual",
    note: "Nota", notePlaceholder: "Nombre del huésped o referencia",
    apply: "Aplicar al rango", dateError: 'La fecha "Al" debe ser igual o posterior a "Del".',
    airbnbSync: "Sincronización Airbnb", airbnbDesc: "Importa reservas del calendario iCal de Airbnb.",
    icalUrl: "URL iCal Airbnb", saveUrl: "Guardar URL", savingUrl: "Guardando…", urlSaved: "URL guardada.", urlError: "Error al guardar la URL.",
    syncNow: "Sincronizar ahora", syncing: "Sincronizando…",
    syncDone: (imported: number, removed: number) => `✓ Sincronización completa — ${imported} noches importadas${removed > 0 ? `, ${removed} eliminadas` : ""}.`,
    conflicts: (n: number) => `⚠ ${n} conflicto${n === 1 ? "" : "s"} detectado${n === 1 ? "" : "s"} — acción manual requerida`,
    conflictDesc: "Las siguientes noches están reservadas tanto en Airbnb como en la app.",
    calendar: "Calendario", calendarDesc: "Muestra el precio para los días libres y los días ocupados.",
    savePublish: "Guardar y publicar", saving: "Guardando...", saved: "¡Guardado! El sitio de producción se actualizará en segundos.",
    conflictWarning: (n: number, first: string, last: string) => `Atención: ${n} noche${n === 1 ? " ya ocupada" : "s ya ocupadas"} (${first}${n > 1 ? ` … ${last}` : ""}). Elimina primero la reserva existente.`,
  },
  fr: {
    basePrice: "Prix de base", basePriceDesc: "Utilisé pour toute date sans prix ou statut personnalisé.", perNight: "par nuit",
    setRange: "Définir une plage de dates", setRangeDesc: "Choisissez les dates, puis indiquez un prix ou marquez la plage comme occupée.",
    checkin: "Check-in", checkout: "Check-out", from: "Du", to: "Au",
    nightsNote: "Les nuits du check-in au check-out sont bloquées. Le jour du check-out reste réservable.",
    setPrice: "Définir le prix", blockDays: "Bloquer des jours", directBooking: "Ajouter une réservation manuelle",
    note: "Note", notePlaceholder: "Nom du voyageur ou référence",
    apply: "Appliquer à la plage", dateError: 'La date "Au" doit être égale ou postérieure à "Du".',
    airbnbSync: "Synchronisation Airbnb", airbnbDesc: "Importe les réservations depuis le calendrier iCal Airbnb.",
    icalUrl: "URL iCal Airbnb", saveUrl: "Enregistrer URL", savingUrl: "Enregistrement…", urlSaved: "URL enregistrée.", urlError: "Erreur lors de l'enregistrement de l'URL.",
    syncNow: "Synchroniser maintenant", syncing: "Synchronisation…",
    syncDone: (imported: number, removed: number) => `✓ Synchronisation terminée — ${imported} nuits importées${removed > 0 ? `, ${removed} supprimées` : ""}.`,
    conflicts: (n: number) => `⚠ ${n} conflit${n === 1 ? "" : "s"} détecté${n === 1 ? "" : "s"} — action manuelle requise`,
    conflictDesc: "Les nuits suivantes sont réservées à la fois sur Airbnb et dans l'app.",
    calendar: "Calendrier", calendarDesc: "Affiche le prix pour les jours libres et les jours réservés.",
    savePublish: "Enregistrer et publier", saving: "Enregistrement...", saved: "Enregistré ! Le site de production sera mis à jour dans quelques secondes.",
    conflictWarning: (n: number, first: string, last: string) => `Attention : ${n} nuit${n === 1 ? " déjà occupée" : "s déjà occupées"} (${first}${n > 1 ? ` … ${last}` : ""}). Supprimez d'abord la réservation existante.`,
  },
} as const;

function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(toLocalISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function AdminEditor(props: Props) {
  const { hydrated } = useDrafts();
  // Rimonta quando le bozze sono idratate da sessionStorage (dopo un refresh) o cambia
  // unità → l'editor interno rilegge la bozza giusta invece dei dati del server.
  return <AdminEditorInner key={`${props.unitId ?? "default"}-${hydrated}`} {...props} />;
}

function AdminEditorInner({ initialDefaultPrice, initialOverrides, initialStayRules, unitId }: Props) {
  const { locale } = useAdminLanguage();
  const L = EDITOR_LABELS[locale] ?? EDITOR_LABELS.en;
  const SL = STAY_LABELS[locale] ?? STAY_LABELS.en;

  // Bozza: se c'è una modifica non pubblicata per questa unità, riparti da lì.
  const { getDraft, setDraft } = useDrafts();
  const draftKey = `calendar:${unitId ?? "default"}`;
  const draft = getDraft<{ defaultPrice: number; overrides: DayRate[]; stayRules?: StayRule[] }>(draftKey);

  const [defaultPrice, setDefaultPrice] = useState(draft?.defaultPrice ?? initialDefaultPrice);
  const [overrides, setOverrides] = useState<DayRate[]>(draft?.overrides ?? initialOverrides);
  const [stayRules, setStayRules] = useState<StayRule[]>(draft?.stayRules ?? initialStayRules);
  const today = toLocalISODate(new Date());
  const [rangeStart, setRangeStart] = useState(today);
  const [rangeEnd, setRangeEnd] = useState(today);
  const [rangeMode, setRangeMode] = useState<RangeMode>("price");
  const [rangePrice, setRangePrice] = useState(initialDefaultPrice);
  const [airbnbNote, setAirbnbNote] = useState("");
  const [rangeError, setRangeError] = useState("");

  function deleteRun(dates: string[]) {
    setOverrides((prev) => prev.filter((o) => !dates.includes(o.date)));
  }

  function editNote(dates: string[], note: string) {
    setOverrides((prev) => prev.map((o) => dates.includes(o.date) ? { ...o, note: note.trim() || undefined } : o));
  }

  function toggleDay(date: string) {
    setOverrides((prev) => {
      const existing = prev.find((o) => o.date === date);
      if (existing?.status === "booked" && (existing.source === "blocked" || !existing.source)) {
        return prev.filter((o) => o.date !== date);
      }
      if (existing?.status === "booked") return prev;
      const price = existing?.price ?? defaultPrice;
      const next = prev.filter((o) => o.date !== date);
      next.push({ date, price, status: "booked", source: "blocked" });
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  function applyRange() {
    if (rangeEnd < rangeStart) return;
    setRangeError("");
    if (rangeMode === "booked" || rangeMode === "direct") {
      const allDates = enumerateDates(rangeStart, rangeEnd);
      const nights = allDates.length > 1 ? allDates.slice(0, -1) : allDates;
      const conflicts = overrides.filter((o) => o.status === "booked" && nights.includes(o.date));
      if (conflicts.length > 0) {
        setRangeError(L.conflictWarning(conflicts.length, conflicts[0].date, conflicts[conflicts.length - 1].date));
        return;
      }
      const source = rangeMode === "direct" ? "direct" : "blocked";
      const note = rangeMode === "direct" && airbnbNote.trim() ? airbnbNote.trim() : undefined;
      setOverrides((prev) => {
        const next = prev.filter((o) => !nights.includes(o.date));
        for (const date of nights) next.push({ date, price: defaultPrice, status: "booked", source, ...(note ? { note } : {}) });
        return next.sort((a, b) => a.date.localeCompare(b.date));
      });
      return;
    }
    const dates = enumerateDates(rangeStart, rangeEnd);
    setOverrides((prev) => {
      const next = prev.filter((o) => !dates.includes(o.date));
      for (const date of dates) {
        const existing = prev.find((o) => o.date === date);
        if (rangePrice === defaultPrice && !existing) continue;
        next.push({ date, price: rangePrice, status: existing?.status ?? "available", ...(existing?.source ? { source: existing.source } : {}), ...(existing?.note ? { note: existing.note } : {}) });
      }
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  // Regole di soggiorno per date (min/max notti per intervallo di check-in) di questa unità.
  function addStayRule() {
    setStayRules((prev) => [...prev, { from: today, to: today }]);
  }
  function updateStayRule(i: number, patch: Partial<StayRule>) {
    setStayRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeStayRule(i: number) {
    setStayRules((prev) => prev.filter((_, idx) => idx !== i));
  }

  // "Salva" mette solo in BOZZA (istantaneo, niente deploy). La pubblicazione di TUTTE
  // le bozze avviene con "Pubblica" (barra Salva/Pubblica in cima e in fondo).
  function saveToDraft() {
    setDraft(draftKey, { defaultPrice, overrides, stayRules });
  }

  return (
    <div className="mt-10">
      <div className="space-y-10">
        <AdminSaveBar onSave={saveToDraft} />
        <section>
          <h2 className="font-serif-display text-xl italic text-foreground">{L.basePrice}</h2>
          <p className="mt-1 text-sm text-foreground/60">{L.basePriceDesc}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-foreground/70">€</span>
            <input
              type="number" min={1} value={defaultPrice}
              onChange={(e) => setDefaultPrice(Number(e.target.value))}
              className="w-32 rounded border border-gold/40 bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
            />
            <span className="text-sm text-foreground/60">{L.perNight}</span>
          </div>
        </section>

        <section className="rounded-lg border border-gold/40 bg-card p-5">
          <h2 className="font-serif-display text-xl italic text-foreground">{L.setRange}</h2>
          <p className="mt-1 text-sm text-foreground/60">{L.setRangeDesc}</p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-foreground/60">
                {rangeMode === "booked" || rangeMode === "direct" ? L.checkin : L.from}
              </span>
              <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)}
                className="rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-foreground/60">
                {rangeMode === "booked" || rangeMode === "direct" ? L.checkout : L.to}
              </span>
              <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)}
                className="rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold" />
            </div>
          </div>
          {(rangeMode === "booked" || rangeMode === "direct") && (
            <p className="mt-2 text-xs text-foreground/50">{L.nightsNote}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input type="radio" name="rangeMode" checked={rangeMode === "price"} onChange={() => setRangeMode("price")} />
              {L.setPrice}
            </label>
            {rangeMode === "price" && (
              <div className="flex items-center gap-1">
                <span className="text-foreground/70">€</span>
                <input type="number" min={1} value={rangePrice} onChange={(e) => setRangePrice(Number(e.target.value))}
                  className="w-24 rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold" />
                <span className="text-sm text-foreground/60">{L.perNight}</span>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input type="radio" name="rangeMode" checked={rangeMode === "booked"} onChange={() => setRangeMode("booked")} />
              {L.blockDays}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input type="radio" name="rangeMode" checked={rangeMode === "direct"} onChange={() => setRangeMode("direct")} />
              {L.directBooking}
            </label>
          </div>
          {rangeMode === "direct" && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-foreground/60">{L.note}</span>
              <input type="text" placeholder={L.notePlaceholder} value={airbnbNote}
                onChange={(e) => setAirbnbNote(e.target.value)}
                className="flex-1 rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold" />
            </div>
          )}
          <button onClick={applyRange} disabled={rangeEnd < rangeStart}
            className="mt-4 rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50">
            {L.apply}
          </button>
          {rangeEnd < rangeStart && <p className="mt-2 text-xs text-red-600">{L.dateError}</p>}
          {rangeError && <p className="mt-2 text-xs text-red-600">{rangeError}</p>}
        </section>

        <section className="rounded-lg border border-gold/40 bg-card p-5">
          <h2 className="font-serif-display text-xl italic text-foreground">{SL.title}</h2>
          <p className="mt-1 text-sm text-foreground/60">{SL.desc}</p>
          <div className="mt-4 space-y-3">
            {stayRules.length === 0 && <p className="text-xs text-foreground/50">{SL.empty}</p>}
            {stayRules.map((r, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="uppercase tracking-widest text-foreground/60">{SL.from}</span>
                  <input type="date" value={r.from}
                    onChange={(e) => updateStayRule(i, { from: e.target.value })}
                    className="rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold" />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="uppercase tracking-widest text-foreground/60">{SL.to}</span>
                  <input type="date" value={r.to}
                    onChange={(e) => updateStayRule(i, { to: e.target.value })}
                    className="rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold" />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="uppercase tracking-widest text-foreground/60">{SL.minStay}</span>
                  <input type="number" min={1} value={r.minStay ?? ""}
                    onChange={(e) => updateStayRule(i, { minStay: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="w-24 rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold" />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="uppercase tracking-widest text-foreground/60">{SL.maxStay}</span>
                  <input type="number" min={1} value={r.maxStay ?? ""}
                    onChange={(e) => updateStayRule(i, { maxStay: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="w-24 rounded border border-gold/40 bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold" />
                </label>
                <button onClick={() => removeStayRule(i)}
                  className="rounded-full border border-red-400/60 px-3 py-1.5 text-xs uppercase tracking-widest text-red-600 transition hover:bg-red-50">
                  {SL.remove}
                </button>
              </div>
            ))}
          </div>
          <button onClick={addStayRule}
            className="mt-4 rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold">
            {SL.add}
          </button>
        </section>

        <section>
          <h2 className="font-serif-display text-xl italic text-foreground">{L.calendar}</h2>
          <div className="mt-4 rounded-lg border border-gold/40 bg-card p-5">
            <AdminCalendar defaultPrice={defaultPrice} overrides={overrides} onToggleDay={toggleDay} onDeleteRun={deleteRun} onEditNote={editNote} />
          </div>
        </section>

        <AdminSaveBar onSave={saveToDraft} />
      </div>
    </div>
  );
}
