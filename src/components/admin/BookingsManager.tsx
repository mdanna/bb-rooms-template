"use client";

import { useEffect, useState } from "react";
import { formatDateOnly } from "@/lib/dateOnly";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import { allUnits, getUnit, rootUnitId } from "@/lib/structure";
import { CONTENT } from "@/lib/siteContent";
import { waLink } from "@/lib/whatsapp";

// Etichette Blocco 2 (azioni pagamenti) per la lingua del pannello (it/en/es/fr), come WA_LABELS.
const PAY_LABELS: Record<string, {
  checkinToggle: string;
  checkinHint: string;
  refund: (amount: string) => string;
  refunding: string;
  refunded: string;
  refundConfirm: (amount: string) => string;
}> = {
  it: {
    checkinToggle: "Fa pagare al check-in",
    checkinHint: "Nessun pagamento online: la prenotazione è confermata subito e l'ospite salda all'arrivo.",
    refund: (a) => `Rimborsa €${a}`,
    refunding: "Rimborso…",
    refunded: "Rimborsato ✓",
    refundConfirm: (a) => `Confermi il rimborso di €${a} all'ospite tramite Stripe? L'operazione è definitiva.`,
  },
  en: {
    checkinToggle: "Pay at check-in",
    checkinHint: "No online payment: the booking is confirmed right away and the guest settles on arrival.",
    refund: (a) => `Refund €${a}`,
    refunding: "Refunding…",
    refunded: "Refunded ✓",
    refundConfirm: (a) => `Confirm the €${a} refund to the guest via Stripe? This cannot be undone.`,
  },
  es: {
    checkinToggle: "Pagar al llegar",
    checkinHint: "Sin pago online: la reserva se confirma de inmediato y el huésped paga al llegar.",
    refund: (a) => `Reembolsar €${a}`,
    refunding: "Reembolsando…",
    refunded: "Reembolsado ✓",
    refundConfirm: (a) => `¿Confirmas el reembolso de €${a} al huésped por Stripe? Es definitivo.`,
  },
  fr: {
    checkinToggle: "Payer à l'arrivée",
    checkinHint: "Aucun paiement en ligne : la réservation est confirmée aussitôt et le voyageur règle à l'arrivée.",
    refund: (a) => `Rembourser €${a}`,
    refunding: "Remboursement…",
    refunded: "Remboursé ✓",
    refundConfirm: (a) => `Confirmer le remboursement de €${a} au voyageur via Stripe ? Cette action est définitive.`,
  },
};

// Etichette + testo precompilato del pulsante "Scrivi su WhatsApp" (verso l'ospite).
const WA_LABELS: Record<string, { btn: string; text: (n: string, unit: string, ci: string, co: string) => string }> = {
  it: { btn: "Scrivi su WhatsApp", text: (n, u, ci, co) => `Ciao ${n}, ti scrivo riguardo la tua prenotazione${u ? ` (${u})` : ""} a ${CONTENT.siteTitle.it || "la nostra struttura"} dal ${ci} al ${co}.` },
  en: { btn: "Message on WhatsApp", text: (n, u, ci, co) => `Hi ${n}, I'm writing about your booking${u ? ` (${u})` : ""} at ${CONTENT.siteTitle.en || CONTENT.siteTitle.it || "our place"} from ${ci} to ${co}.` },
  es: { btn: "Escribir por WhatsApp", text: (n, u, ci, co) => `Hola ${n}, te escribo sobre tu reserva${u ? ` (${u})` : ""} en ${CONTENT.siteTitle.es || CONTENT.siteTitle.it || "nuestro alojamiento"} del ${ci} al ${co}.` },
  fr: { btn: "Écrire sur WhatsApp", text: (n, u, ci, co) => `Bonjour ${n}, je vous écris au sujet de votre réservation${u ? ` (${u})` : ""} à ${CONTENT.siteTitle.fr || CONTENT.siteTitle.it || "notre établissement"} du ${ci} au ${co}.` },
};

interface Booking {
  id: number;
  code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  guests: number;
  checkin: string;
  checkout: string;
  total_price: string | null;
  deposit_amount: string | null;
  balance_due: string | null;
  city_tax: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  rejection_reason: string | null;
  payment_method: string | null;
  paid_at: string | null;
  balance_paid_at: string | null;
  created_at: string;
  archived: boolean;
  // Struttura con camere: unità prenotata (NULL = unità radice / prenotazioni antecedenti).
  unit_id: string | null;
  // Rimborso semi-automatico: importo calcolato alla cancellazione ed esecuzione (refunded_at).
  refund_due: string | null;
  refunded_at: string | null;
  stripe_payment_intent_id: string | null;
}

// Nome dell'unità prenotata, o "" per un sito a unità singola (nessuna etichetta da mostrare).
function unitLabel(unitId: string | null, locale: string): string {
  if (allUnits().length <= 1) return "";
  const u = getUnit(unitId ?? rootUnitId()) ?? getUnit(rootUnitId());
  if (!u) return "";
  // Unità intera: il nome è il titolo dell'appartamento (siteTitle), non "Intero appartamento".
  if (u.id === rootUnitId()) {
    const title = CONTENT.siteTitle[locale as keyof typeof CONTENT.siteTitle] || CONTENT.siteTitle.it;
    if (title) return title;
  }
  return u.name[locale as keyof typeof u.name] || u.name.it || u.id;
}

// Fasi derivate dalle DATE per una prenotazione pagata (status "completed"): futura
// (Confermata) → check-in non ancora arrivato, annullabile+rimborsabile; in corso →
// ospiti in casa, nessuna azione; passata (Completata) → check-out superato, archiviabile.
// Non è uno stato nel DB: si calcola alla lettura (niente cron, sempre esatto).
type DisplayStatus = Booking["status"] | "confirmed" | "inProgress";

const DISPLAY_COLOR: Record<DisplayStatus, string> = {
  pending: "text-gold",
  approved: "text-blue-700",
  confirmed: "text-green-700",
  inProgress: "text-[#a87f36]",
  completed: "text-foreground/50",
  rejected: "text-red-600",
  cancelled: "text-foreground/40",
};

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
function isPast(checkout: string) {
  return new Date(checkout) < startOfToday();
}
function isFuture(checkin: string) {
  return new Date(checkin) > startOfToday();
}
function displayStatus(b: Booking): DisplayStatus {
  if (b.status !== "completed") return b.status;
  if (isFuture(b.checkin)) return "confirmed";
  if (isPast(b.checkout)) return "completed";
  return "inProgress";
}

export default function BookingsManager() {
  const { t, locale } = useAdminLanguage();
  const tb = t.bookings;
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [customPrices, setCustomPrices] = useState<Record<number, string>>({});
  const [checkinIds, setCheckinIds] = useState<Record<number, boolean>>({});
  const pl = PAY_LABELS[locale] ?? PAY_LABELS.en;
  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  function patchBooking(id: number, changes: Partial<Booking>) {
    setBookings((bs) => (bs ? bs.map((b) => (b.id === id ? { ...b, ...changes } : b)) : bs));
  }

  const dateLocale = locale === "it" ? "it-IT" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "en-GB";

  function formatStayDate(value: string) {
    return formatDateOnly(value, dateLocale);
  }

  function formatTimestamp(value: string) {
    return new Date(value).toLocaleDateString(dateLocale);
  }

  function methodLabel(method: string | null) {
    if (method === "card") return tb.card;
    if (method === "paypal") return "PayPal";
    if (method === "cash") return tb.cash;
    if (method === "transfer") return tb.transfer;
    return method ?? "";
  }

  async function load() {
    try {
      const [bookingsRes, availRes] = await Promise.all([
        fetch("/api/admin/bookings"),
        fetch("/api/availability"),
      ]);
      const data = await bookingsRes.json();
      if (!bookingsRes.ok) throw new Error(data.error ?? tb.error);
      setBookings(data.bookings);

      const avail = availRes.ok ? await availRes.json() : null;
      const defaultPrice: number = avail?.defaultPrice ?? 0;
      const overridesMap = new Map<string, number>(
        (avail?.overrides ?? []).map((o: { date: string; price: number }) => [o.date, o.price])
      );
      function nightPrice(isoDate: string): number {
        return overridesMap.get(isoDate) ?? defaultPrice;
      }
      function computeTotal(checkin: string, checkout: string): number {
        const [y1, m1, d1] = checkin.slice(0, 10).split("-").map(Number);
        const [y2, m2, d2] = checkout.slice(0, 10).split("-").map(Number);
        const cur = new Date(y1!, (m1 ?? 1) - 1, d1 ?? 1);
        const end = new Date(y2!, (m2 ?? 1) - 1, d2 ?? 1);
        let total = 0;
        while (cur < end) {
          const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
          total += nightPrice(iso);
          cur.setDate(cur.getDate() + 1);
        }
        return total;
      }

      const init: Record<number, string> = {};
      for (const b of data.bookings as Booking[]) {
        if (b.status !== "pending") continue;
        const price = b.total_price
          ? Number(b.total_price)
          : b.checkin && b.checkout ? computeTotal(b.checkin, b.checkout) : 0;
        if (price > 0) init[b.id] = String(price);
      }
      setCustomPrices((prev) => ({ ...init, ...prev }));
    } catch (err) {
      setError(err instanceof Error ? err.message : tb.error);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approve(id: number) {
    setBusyId(id);
    setError("");
    const rawPrice = customPrices[id];
    const customPrice = rawPrice && !isNaN(Number(rawPrice)) && Number(rawPrice) > 0
      ? Number(rawPrice)
      : null;
    const payAtCheckin = !!checkinIds[id];
    if (DEMO) { patchBooking(id, { status: payAtCheckin ? "completed" : "approved", ...(payAtCheckin ? { payment_method: "checkin" } : {}), ...(customPrice ? { total_price: String(customPrice) } : {}) }); setBusyId(null); return; }
    try {
      const res = await fetch(`/api/admin/bookings/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPrice, payAtCheckin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusyId(null);
    }
  }

  // Rimborso semi-automatico: esegue davvero il rimborso su Stripe per l'importo già
  // calcolato alla cancellazione (refund_due). Idempotente lato server via refunded_at.
  async function refund(id: number, amount: string) {
    if (!window.confirm(pl.refundConfirm(Number(amount).toFixed(2)))) return;
    setBusyId(id);
    setError("");
    if (DEMO) { patchBooking(id, { refunded_at: new Date().toISOString() }); setBusyId(null); return; }
    try {
      const res = await fetch(`/api/admin/bookings/${id}/refund`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    if (!reason.trim()) return;
    setBusyId(id);
    setError("");
    if (DEMO) { patchBooking(id, { status: "rejected" }); setRejectingId(null); setReason(""); setBusyId(null); return; }
    try {
      const res = await fetch(`/api/admin/bookings/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      setRejectingId(null);
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: number) {
    if (!window.confirm(tb.confirmCancel)) return;
    setBusyId(id);
    setError("");
    if (DEMO) { patchBooking(id, { status: "cancelled" }); setBusyId(null); return; }
    try {
      const res = await fetch(`/api/admin/bookings/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteBooking(id: number) {
    if (!window.confirm(tb.confirmCancel)) return;
    setBusyId(id);
    setError("");
    if (DEMO) { setBookings((bs) => (bs ? bs.filter((b) => b.id !== id) : bs)); setBusyId(null); return; }
    try {
      const res = await fetch(`/api/admin/bookings/${id}/delete`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusyId(null);
    }
  }

  async function setArchived(id: number, archived: boolean) {
    setBusyId(id);
    setError("");
    if (DEMO) { patchBooking(id, { archived }); setBusyId(null); return; }
    try {
      const res = await fetch(`/api/admin/bookings/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusyId(null);
    }
  }

  if (bookings === null) {
    return <p className="mt-10 text-sm text-foreground/60">{t.common.loading}</p>;
  }

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const visibleBookings = bookings.filter((b) => (showArchived ? b.archived : !b.archived));
  const archivedCount = bookings.filter((b) => b.archived).length;

  return (
    <div className="mt-10 space-y-4">
      {pendingCount > 0 && (
        <p className="rounded-md border border-gold bg-gold/10 px-4 py-2 text-sm font-semibold text-foreground">
          {pendingCount} {pendingCount === 1 ? tb.noBookings : `${pendingCount} ${tb.title}`}
        </p>
      )}
      <div className="flex items-center justify-between">
        <h2 className="font-serif-display text-lg italic text-foreground">
          {showArchived ? tb.titleArchived : tb.title}
        </h2>
        <div className="flex items-center gap-3">
          <a
            href="/api/admin/export"
            download
            className="rounded-full border border-gold/40 px-4 py-1.5 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10"
          >
            ↓ Excel
          </a>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="rounded-full border border-gold/40 px-4 py-1.5 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10"
          >
            {showArchived ? `← ${tb.title}` : `${tb.viewArchived} (${archivedCount}) →`}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {visibleBookings.length === 0 && (
        <p className="text-sm text-foreground/60">{tb.noBookings}</p>
      )}
      {visibleBookings.map((b) => {
        const ds = displayStatus(b);
        const isCurrent = ds === "inProgress";
        return (
        <div key={b.id} className={`rounded-lg border p-5 ${b.status === "cancelled" ? "border-red-300 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/20" : isCurrent ? "border-l-4 border-gold/40 border-l-[#a87f36] bg-gold/5" : "border-gold/40 bg-card"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-serif-display text-lg italic text-foreground">
                {b.code} · {b.first_name} {b.last_name}
              </p>
              {unitLabel(b.unit_id, locale) && (
                <span className="mt-1 inline-block rounded-full border border-gold/40 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-foreground/70">
                  {unitLabel(b.unit_id, locale)}
                </span>
              )}
              <p className="mt-1 text-sm text-foreground/70">
                {formatStayDate(b.checkin)} → {formatStayDate(b.checkout)} · {b.guests} {tb.guests}
                {b.total_price ? ` · €${b.total_price}` : ""}
              </p>
              <p className="mt-1 text-xs text-foreground/50">
                {b.email} · {b.phone}
              </p>
              {waLink(b.phone) && (
                <a
                  href={waLink(
                    b.phone,
                    (WA_LABELS[locale] ?? WA_LABELS.en).text(
                      b.first_name,
                      unitLabel(b.unit_id, locale),
                      formatStayDate(b.checkin),
                      formatStayDate(b.checkout),
                    ),
                  )}
                  target="_blank"
                  rel="noopener"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#25D366]/50 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-[#128C7E] transition hover:bg-[#25D366]/10"
                >
                  <span aria-hidden>✆</span> {(WA_LABELS[locale] ?? WA_LABELS.en).btn}
                </a>
              )}
              {b.message && (
                <p className="mt-2 text-sm italic text-foreground/70">&ldquo;{b.message}&rdquo;</p>
              )}
              {b.status === "rejected" && b.rejection_reason && (
                <p className="mt-2 text-sm text-red-600">{b.rejection_reason}</p>
              )}

              {b.status === "approved" && b.total_price != null && (
                <div className="mt-3 rounded-md border border-gold/30 bg-background px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-foreground/60">{tb.price}</span>
                    <span className="font-medium text-foreground">€{b.total_price}</span>
                  </div>
                </div>
              )}
              {b.status === "completed" && (
                <div className="mt-3 rounded-md border border-gold/30 bg-background px-4 py-3 text-sm space-y-1">
                  {/* Nuovo modello: importo intero pagato in un'unica soluzione (o "paga al
                      check-in" → nulla incassato online). Mostriamo la cifra del soggiorno. */}
                  <div className="flex justify-between">
                    <span className="text-foreground/60">
                      {tb.price} <span className="ml-1 text-green-700 font-semibold">✓</span>
                    </span>
                    <span className="font-semibold text-green-700">€{b.total_price ?? "—"}</span>
                  </div>
                  {b.city_tax != null && Number(b.city_tax) > 0 && (
                    <div className="flex justify-between text-foreground/50 text-xs pt-0.5">
                      <span>{tb.cityTax}</span>
                      <span>€{b.city_tax}</span>
                    </div>
                  )}
                  {b.paid_at && (
                    <p className="text-xs text-foreground/50 pt-0.5">
                      {methodLabel(b.payment_method)} · {tb.paidAt} {formatTimestamp(b.paid_at)}
                    </p>
                  )}
                </div>
              )}
            </div>
            <span className={`text-xs font-semibold uppercase tracking-widest ${DISPLAY_COLOR[ds]}`}>
              {tb.statusLabels[ds]}
            </span>
          </div>

          {b.status === "pending" && !showArchived && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs uppercase tracking-widest text-foreground/50 whitespace-nowrap">
                  {tb.customPrice}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground/50">€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={b.total_price ? String(Number(b.total_price)) : "—"}
                    value={customPrices[b.id] ?? ""}
                    onChange={(e) =>
                      setCustomPrices((prev) => ({ ...prev, [b.id]: e.target.value }))
                    }
                    className="w-32 rounded border border-gold/40 bg-background py-1.5 pl-7 pr-3 text-sm text-foreground outline-none focus:border-gold"
                  />
                </div>
                {customPrices[b.id] && (
                  <button
                    onClick={() => setCustomPrices((prev) => { const n = { ...prev }; delete n[b.id]; return n; })}
                    className="text-xs text-foreground/40 hover:text-foreground/70"
                  >
                    ✕
                  </button>
                )}
                <span className="text-xs text-foreground/40">
                  {customPrices[b.id] && !isNaN(Number(customPrices[b.id])) && Number(customPrices[b.id]) > 0
                    ? `${tb.price}: €${Number(customPrices[b.id]).toFixed(2)}`
                    : ""}
                </span>
              </div>
              <label className="flex items-start gap-2 text-xs text-foreground/70" title={pl.checkinHint}>
                <input
                  type="checkbox"
                  checked={!!checkinIds[b.id]}
                  onChange={(e) => setCheckinIds((prev) => ({ ...prev, [b.id]: e.target.checked }))}
                  className="mt-0.5 accent-gold"
                />
                <span>
                  <span className="uppercase tracking-widest">{pl.checkinToggle}</span>
                  <span className="block text-[11px] normal-case tracking-normal text-foreground/45">{pl.checkinHint}</span>
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => approve(b.id)}
                  disabled={busyId === b.id}
                  className="rounded-full border border-gold bg-gold px-5 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50"
                >
                  {busyId === b.id ? tb.approving : tb.approve}
                </button>
                {rejectingId === b.id ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={tb.rejectionReason}
                      className="min-w-[200px] flex-1 rounded border border-gold/40 bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-gold"
                    />
                    <button
                      onClick={() => reject(b.id)}
                      disabled={busyId === b.id || !reason.trim()}
                      className="rounded-full border border-red-600 px-4 py-1.5 text-xs uppercase tracking-widest text-red-600 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                    >
                      {tb.confirmReject}
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setReason(""); }}
                      className="text-xs uppercase tracking-widest text-foreground/50"
                    >
                      {t.common.cancel}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRejectingId(b.id)}
                    disabled={busyId === b.id}
                    className="rounded-full border border-red-600/60 px-5 py-2 text-xs uppercase tracking-widest text-red-600 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                  >
                    {tb.reject}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Rimborso semi-automatico: solo prenotazioni annullate con un incasso online e un
                rimborso dovuto non ancora eseguito. Se già rimborsato, mostra lo stato. */}
            {b.status === "cancelled" && b.refunded_at && (
              <span className="rounded-full border border-green-600/40 bg-green-50 px-4 py-1.5 text-xs uppercase tracking-widest text-green-700 dark:bg-green-950/30">
                {pl.refunded}
              </span>
            )}
            {b.status === "cancelled" && !b.refunded_at && b.stripe_payment_intent_id &&
              b.refund_due != null && Number(b.refund_due) > 0 && (
                <button
                  onClick={() => refund(b.id, b.refund_due!)}
                  disabled={busyId === b.id}
                  className="rounded-full border border-gold bg-gold px-5 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50"
                >
                  {busyId === b.id ? pl.refunding : pl.refund(Number(b.refund_due).toFixed(2))}
                </button>
              )}
            {(b.status === "cancelled" || b.status === "rejected") && (
              <button
                onClick={() => deleteBooking(b.id)}
                disabled={busyId === b.id}
                className="rounded-full border border-red-400/60 px-5 py-2 text-xs uppercase tracking-widest text-red-600 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
              >
                {t.common.confirm}
              </button>
            )}
            {!showArchived && (b.status === "approved" || ds === "confirmed") && (
              <button
                onClick={() => cancel(b.id)}
                disabled={busyId === b.id}
                className="rounded-full border border-foreground/30 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:border-red-600 hover:text-red-600 disabled:opacity-50"
              >
                {busyId === b.id ? tb.cancelling : tb.cancel}
              </button>
            )}
            {!showArchived &&
              (b.status === "completed" || b.status === "rejected" || b.status === "cancelled") &&
              isPast(b.checkout) && (
                <button
                  onClick={() => setArchived(b.id, true)}
                  disabled={busyId === b.id}
                  className="rounded-full border border-foreground/30 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-foreground/10 disabled:opacity-50"
                >
                  {busyId === b.id ? tb.archiving : tb.archive}
                </button>
              )}
            {showArchived && (
              <button
                onClick={() => setArchived(b.id, false)}
                disabled={busyId === b.id}
                className="rounded-full border border-foreground/30 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-foreground/10 disabled:opacity-50"
              >
                {tb.unarchive}
              </button>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}
