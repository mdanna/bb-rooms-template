"use client";

import { useState } from "react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import { allUnits, rootUnitId, getUnit, isBookable, type Unit } from "@/lib/structure";
import type { LocaleCode } from "@/i18n/types";

// Etichette UI nella lingua del pannello.
const LABELS = {
  it: {
    title: "Camere", intro: "Aggiungi o rimuovi le camere di questo appartamento. Ogni camera ha un suo calendario, prezzi, contenuti e pagina pubblica. Le modifiche vanno online in 1–2 minuti.",
    yourRooms: "Le tue camere", whole: "Intero appartamento", noRooms: "Nessuna camera.",
    wholeOn: "Prenotabile per intero", wholeOff: "Solo camere (intero non prenotabile)", makeOnlyRooms: "Rendi solo camere", makeBookable: "Rendi prenotabile", toggling: "Aggiornamento…",
    addTitle: "Aggiungi una camera", namePh: "Nome della camera (es. Camera Verde)", add: "Aggiungi camera", adding: "Creazione…",
    remove: "Rimuovi", removing: "Rimozione…", confirmRemove: (n: string) => `Rimuovere “${n}”? La sua pagina, il calendario e i contenuti verranno eliminati.`,
    publishing: "In pubblicazione — la struttura si aggiornerà tra 1–2 minuti. Ricarica la pagina tra poco per vederla aggiornata.",
    nameRequired: "Scrivi il nome della camera.",
    blockedTitle: "Impossibile rimuovere ora", manageFirst: "Gestisci prima queste prenotazioni (dalla sezione Prenotazioni):",
    genericErr: "Operazione non riuscita.",
  },
  en: {
    title: "Rooms", intro: "Add or remove the rooms of this apartment. Each room has its own calendar, prices, content and public page. Changes go live in 1–2 minutes.",
    yourRooms: "Your rooms", whole: "Whole apartment", noRooms: "No rooms.",
    wholeOn: "Bookable as a whole", wholeOff: "Rooms only (whole not bookable)", makeOnlyRooms: "Switch to rooms only", makeBookable: "Make bookable", toggling: "Updating…",
    addTitle: "Add a room", namePh: "Room name (e.g. Green Room)", add: "Add room", adding: "Creating…",
    remove: "Remove", removing: "Removing…", confirmRemove: (n: string) => `Remove “${n}”? Its page, calendar and content will be deleted.`,
    publishing: "Publishing — the structure will update in 1–2 minutes. Reload the page shortly to see it updated.",
    nameRequired: "Enter the room name.",
    blockedTitle: "Can't remove right now", manageFirst: "Handle these bookings first (from the Bookings section):",
    genericErr: "Operation failed.",
  },
  es: {
    title: "Habitaciones", intro: "Añade o quita las habitaciones de este apartamento. Cada habitación tiene su calendario, precios, contenido y página pública. Los cambios se publican en 1–2 minutos.",
    yourRooms: "Tus habitaciones", whole: "Apartamento entero", noRooms: "Sin habitaciones.",
    wholeOn: "Reservable entero", wholeOff: "Solo habitaciones (entero no reservable)", makeOnlyRooms: "Solo habitaciones", makeBookable: "Hacer reservable", toggling: "Actualizando…",
    addTitle: "Añadir una habitación", namePh: "Nombre de la habitación (p. ej. Habitación Verde)", add: "Añadir habitación", adding: "Creando…",
    remove: "Quitar", removing: "Quitando…", confirmRemove: (n: string) => `¿Quitar “${n}”? Se eliminarán su página, calendario y contenido.`,
    publishing: "Publicando — la estructura se actualizará en 1–2 minutos. Recarga la página en breve para verla actualizada.",
    nameRequired: "Escribe el nombre de la habitación.",
    blockedTitle: "No se puede quitar ahora", manageFirst: "Gestiona antes estas reservas (desde la sección Reservas):",
    genericErr: "La operación falló.",
  },
  fr: {
    title: "Chambres", intro: "Ajoutez ou retirez les chambres de cet appartement. Chaque chambre a son calendrier, ses prix, son contenu et sa page publique. Les modifications sont en ligne en 1–2 minutes.",
    yourRooms: "Vos chambres", whole: "Appartement entier", noRooms: "Aucune chambre.",
    wholeOn: "Réservable en entier", wholeOff: "Chambres uniquement (entier non réservable)", makeOnlyRooms: "Chambres uniquement", makeBookable: "Rendre réservable", toggling: "Mise à jour…",
    addTitle: "Ajouter une chambre", namePh: "Nom de la chambre (ex. Chambre Verte)", add: "Ajouter une chambre", adding: "Création…",
    remove: "Retirer", removing: "Suppression…", confirmRemove: (n: string) => `Retirer « ${n} » ? Sa page, son calendrier et son contenu seront supprimés.`,
    publishing: "Publication — la structure se mettra à jour dans 1–2 minutes. Rechargez la page bientôt pour la voir à jour.",
    nameRequired: "Saisissez le nom de la chambre.",
    blockedTitle: "Impossible de retirer maintenant", manageFirst: "Gérez d'abord ces réservations (depuis la section Réservations) :",
    genericErr: "L'opération a échoué.",
  },
} as const;

interface BlockedBooking { id: number; guest: string; checkin: string; checkout: string; status: string }

function roomName(u: Unit, locale: LocaleCode): string {
  return u.name[locale] || u.name.it || Object.values(u.name).find(Boolean) || u.id;
}

export default function RoomsManager() {
  const { locale } = useAdminLanguage();
  const L = LABELS[locale as keyof typeof LABELS] ?? LABELS.en;

  // Stato iniziale dalla struttura DEPLOYATA (STRUCTURE). Dopo un'azione aggiorniamo la
  // lista in modo ottimistico e mostriamo l'avviso "in pubblicazione".
  const root = rootUnitId();
  const rootUnit = getUnit(root);
  const initialRooms = allUnits().filter((u) => u.id !== root && u.kind === "room");

  const [rooms, setRooms] = useState<{ id: string; name: string; slug: string }[]>(
    initialRooms.map((u) => ({ id: u.id, name: roomName(u, locale as LocaleCode), slug: u.slug }))
  );
  const [wholeBookable, setWholeBookable] = useState(rootUnit ? isBookable(rootUnit) : true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"add" | "whole" | string | null>(null);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState<{ msg: string; bookings: BlockedBooking[] } | null>(null);

  const box = "rounded-lg border border-gold/40 bg-card p-6";
  const input = "flex-1 rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold";
  const btnGold = "rounded-full border border-gold bg-gold px-5 py-2 text-xs font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-40";

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBlocked(null);
    const n = name.trim();
    if (!n) { setError(L.nameRequired); return; }
    setBusy("add");
    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || L.genericErr); return; }
      setRooms((r) => [...r, { id: data.unit.id, name: n, slug: data.unit.slug }]);
      setName("");
      setPublished(true);
    } catch {
      setError(L.genericErr);
    } finally {
      setBusy(null);
    }
  }

  async function toggleWhole() {
    setError(""); setBlocked(null);
    const next = !wholeBookable;
    setBusy("whole");
    try {
      const res = await fetch("/api/admin/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookable: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.error === "future_bookings") {
        setBlocked({ msg: data.message, bookings: data.bookings ?? [] });
        return;
      }
      if (!res.ok) { setError(data.error || L.genericErr); return; }
      setWholeBookable(next);
      setPublished(true);
    } catch {
      setError(L.genericErr);
    } finally {
      setBusy(null);
    }
  }

  async function removeRoom(id: string, label: string) {
    setError(""); setBlocked(null);
    if (!confirm(L.confirmRemove(label))) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/rooms?unit=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.error === "future_bookings") {
        setBlocked({ msg: data.message, bookings: data.bookings ?? [] });
        return;
      }
      if (!res.ok) { setError(data.error || L.genericErr); return; }
      setRooms((r) => r.filter((x) => x.id !== id));
      setPublished(true);
    } catch {
      setError(L.genericErr);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl italic text-foreground">{L.title}</h1>
        <p className="mt-2 text-sm text-foreground/60">{L.intro}</p>
      </div>

      {published && (
        <div className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-foreground/80">
          <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-gold align-middle" aria-hidden />
          {L.publishing}
        </div>
      )}
      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {blocked && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">{L.blockedTitle}</p>
          <p className="mt-1">{blocked.msg}</p>
          <p className="mt-2 text-red-700/80">{L.manageFirst}</p>
          <ul className="mt-1 space-y-1">
            {blocked.bookings.map((b) => (
              <li key={b.id}>· {b.guest || `#${b.id}`} — {b.checkin} → {b.checkout} ({b.status})</li>
            ))}
          </ul>
        </div>
      )}

      {/* Lista camere */}
      <div className={box}>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground/50">{L.yourRooms}</h2>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-gold/15 pb-3">
          <div>
            <p className="text-sm text-foreground">★ {L.whole}</p>
            <p className="text-xs text-foreground/40">{wholeBookable ? L.wholeOn : L.wholeOff}</p>
          </div>
          <button
            onClick={toggleWhole}
            disabled={busy === "whole"}
            className="rounded-full border border-gold/40 px-4 py-1.5 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10 disabled:opacity-40"
          >
            {busy === "whole" ? L.toggling : wholeBookable ? L.makeOnlyRooms : L.makeBookable}
          </button>
        </div>
        {rooms.length === 0 ? (
          <p className="text-sm text-foreground/50">{L.noRooms}</p>
        ) : (
          <ul className="divide-y divide-gold/15">
            {rooms.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm text-foreground">{r.name}</p>
                  <p className="text-xs text-foreground/40">/camera/{r.slug}</p>
                </div>
                <button
                  onClick={() => removeRoom(r.id, r.name)}
                  disabled={busy === r.id}
                  className="rounded-full border border-gold/40 px-4 py-1.5 text-xs uppercase tracking-widest text-foreground/70 transition hover:border-red-400 hover:text-red-600 disabled:opacity-40"
                >
                  {busy === r.id ? L.removing : L.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Aggiungi camera */}
      <form onSubmit={addRoom} className={box}>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground/50">{L.addTitle}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={L.namePh}
            className={input}
          />
          <button type="submit" disabled={busy === "add"} className={btnGold}>
            {busy === "add" ? L.adding : `+ ${L.add}`}
          </button>
        </div>
      </form>
    </div>
  );
}
