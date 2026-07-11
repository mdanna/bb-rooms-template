"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { translations, type LocaleCode } from "@/i18n/index";
import { format } from "@/i18n/format";
import { formatDateOnly } from "@/lib/dateOnly";

import { CANCEL_FULL_REFUND_DAYS, CANCEL_HALF_REFUND_DAYS, CANCEL_FEE_PERCENT, CANCEL_PARTIAL_REFUND_PCT } from "@/lib/pricing";
import { CONTENT } from "@/lib/siteContent";

const INTL_LOCALE: Record<LocaleCode, string> = {
  it: "it-IT",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  pt: "pt-PT",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
};

function daysUntil(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const checkin = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((checkin.getTime() - today.getTime()) / 86_400_000);
}

interface BookingData {
  code: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  guests: number;
  checkin: string;
  checkout: string;
  total_price: number | null;
  deposit_amount: number | null;
  balance_due: number | null;
  city_tax: number | null;
  city_tax_online: boolean | null;
  paid_at: string | null;
  balance_paid_at: string | null;
  stripe_payment_intent_id: string | null;
  locale: LocaleCode | null;
}

type PageState = "loading" | "invalid" | "ready" | "confirming" | "cancelling" | "cancelled" | "error";

export default function BookingManagementPage({ code, token }: { code: string; token: string }) {
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [cancelResult, setCancelResult] = useState<{
    refundEligible: boolean;
    refundAmount: number | null;
    refundError: string | null;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPageState("invalid");
      return;
    }
    fetch(`/api/bookings/${code}/data?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setPageState("invalid");
          return;
        }
        setBooking(data.booking);
        setPageState("ready");
      })
      .catch(() => setPageState("invalid"));
  }, [code, token]);

  const locale: LocaleCode = booking?.locale && translations[booking.locale] ? booking.locale : "it";
  const t = translations[locale];
  const m = t.manage;
  const intlLocale = INTL_LOCALE[locale] ?? "it-IT";

  function fmtDate(iso: string) {
    return formatDateOnly(iso, intlLocale);
  }

  async function handleCancel() {
    setPageState("cancelling");
    try {
      const res = await fetch(`/api/bookings/${code}/guest-cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "error");
      setCancelResult({
        refundEligible: data.refundEligible,
        refundAmount: data.refundAmount,
        refundError: data.refundError,
      });
      setPageState("cancelled");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "error");
      setPageState("error");
    }
  }

  if (pageState === "loading") {
    return <PageShell title={m.pageTitle}><p className="text-foreground/60">{m.loading}</p></PageShell>;
  }

  if (pageState === "invalid") {
    return (
      <PageShell title={m.pageTitle}>
        <p className="text-foreground/70">
          {m.invalidLinkBefore}{" "}
          <Link href="/gestione-prenotazione" className="text-gold underline">{m.invalidLinkPage}</Link>{" "}
          {m.invalidLinkAfter}
        </p>
      </PageShell>
    );
  }

  if (pageState === "cancelled" && cancelResult) {
    return (
      <PageShell title={m.pageTitle}>
        <div className="rounded-lg border border-gold/40 bg-card p-6 space-y-3">
          <p className="text-lg font-medium text-foreground">{m.cancelledTitle}</p>
          {cancelResult.refundEligible ? (
            <p className="text-sm text-foreground/70">
              {format(m.cancelledRefundMsg, { amount: cancelResult.refundAmount?.toFixed(2) ?? "—" })}
            </p>
          ) : (
            <p className="text-sm text-foreground/70">{m.cancelledNoRefundMsg}</p>
          )}
        </div>
      </PageShell>
    );
  }

  if (pageState === "error") {
    return (
      <PageShell title={m.pageTitle}>
        <p className="text-sm text-red-600">{errorMsg}</p>
      </PageShell>
    );
  }

  if (!booking) return null;

  const isCancellable = ["pending", "approved", "completed"].includes(booking.status);
  const wasPaid = booking.status === "completed";
  const days = daysUntil(booking.checkin);
  const depositNum = Number(booking.deposit_amount ?? 0);
  const balancePaid = !!booking.balance_paid_at && Number(booking.balance_due ?? 0) > 0;
  // Importo alloggio effettivamente incassato (anticipo [+ saldo]) — SENZA tassa di soggiorno.
  const accommodationPaid = balancePaid
    ? depositNum + Number(booking.balance_due ?? 0)
    : depositNum;
  // Opzione A: se city_tax_online la tassa è stata incassata online con l'anticipo → concorre al
  // totale pagato ed è interamente rimborsabile (non dovuta per notti non godute). Vecchie
  // prenotazioni (null/false): tassa mai incassata online → nessun impatto (comportamento invariato).
  const cityTaxOnline = booking.city_tax_online === true;
  const cityTaxNum = Number(booking.city_tax ?? 0);
  const totalPaid = accommodationPaid + (cityTaxOnline ? cityTaxNum : 0);

  const refundReason: "full" | "half" | "none" =
    !wasPaid ? "none"
    : days > CANCEL_FULL_REFUND_DAYS ? "full"
    : days >= CANCEL_HALF_REFUND_DAYS ? "half"
    : "none";
  // La policy di cancellazione (trattenuta / quota parziale) si applica SOLO all'alloggio.
  const fee = refundReason !== "none" ? Math.round(accommodationPaid * CANCEL_FEE_PERCENT) / 100 : 0;
  const grossHalf = Math.round(accommodationPaid * CANCEL_PARTIAL_REFUND_PCT) / 100; // rimborso lordo alloggio (prima della trattenuta)
  const accommodationRefund =
    refundReason === "full" ? accommodationPaid - fee
    : refundReason === "half" ? grossHalf - fee
    : 0;
  // La tassa di soggiorno incassata online viene rimborsata per intero (mai ridotta dalla policy),
  // in TUTTE le finestre — anche "none" — coerentemente col backend (computeRefund/guest-cancel).
  const cityTaxRefund = wasPaid && cityTaxOnline ? cityTaxNum : 0;
  const refundAmount = accommodationRefund + cityTaxRefund;

  const statusLabel: Record<string, string> = {
    pending: m.statusPending,
    approved: m.statusApproved,
    completed: m.statusCompleted,
    cancelled: m.statusCancelled,
    rejected: m.statusRejected,
  };

  return (
    <PageShell title={m.pageTitle}>
      {/* Booking summary */}
      <div className="rounded-lg border border-gold/40 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm text-foreground/60">{booking.code}</span>
          <span className={`text-xs uppercase tracking-widest px-2 py-0.5 rounded-full border ${
            booking.status === "completed" ? "border-green-400/50 text-green-700 bg-green-50" :
            booking.status === "cancelled" ? "border-red-400/50 text-red-700 bg-red-50" :
            "border-gold/40 text-gold bg-gold/5"
          }`}>
            {statusLabel[booking.status] ?? booking.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-foreground/40">{m.labelGuest}</p>
            <p className="mt-0.5 text-foreground">{booking.first_name} {booking.last_name}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-foreground/40">{m.labelGuests}</p>
            <p className="mt-0.5 text-foreground">{booking.guests}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-foreground/40">{m.labelCheckin}</p>
            <p className="mt-0.5 text-foreground">{fmtDate(booking.checkin)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-foreground/40">{m.labelCheckout}</p>
            <p className="mt-0.5 text-foreground">{fmtDate(booking.checkout)}</p>
          </div>
          {booking.total_price && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-foreground/40">{m.labelTotalStay}</p>
              <p className="mt-0.5 text-foreground">€{Number(booking.total_price).toFixed(2)}</p>
            </div>
          )}
          {booking.status === "completed" && (() => {
            const hasBalance = booking.balance_due != null && Number(booking.balance_due) > 0;
            const fullyPaid = balancePaid || !hasBalance;
            if (fullyPaid) {
              // Pagamento completo (intero anticipo o saldo già versato): la tassa, se incassata
              // online, è una voce DISTINTA e ADDIZIONALE → mostrata a parte e sommata nel totale
              // pagato (non "inclusa nel prezzo del soggiorno").
              return (
                <>
                  {cityTaxOnline && cityTaxNum > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-foreground/40">{m.labelCityTax}</p>
                      <p className="mt-0.5 text-foreground">€{cityTaxNum.toFixed(2)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-foreground/40">{m.labelTotalPaid}</p>
                    <p className="mt-0.5 font-medium text-green-700">€{totalPaid.toFixed(2)} ✓</p>
                  </div>
                </>
              );
            }
            // Anticipo versato, saldo ancora dovuto.
            return booking.deposit_amount ? (
              <>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-foreground/40">{m.labelDepositPaid}</p>
                  <p className="mt-0.5 text-foreground">€{depositNum.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-foreground/40">{m.labelBalance}</p>
                  <p className="mt-0.5 font-medium text-amber-600">
                    {format(m.labelBalanceDue, { amount: Number(booking.balance_due).toFixed(2) })}
                  </p>
                </div>
              </>
            ) : null;
          })()}
        </div>

        {booking.status === "approved" && (
          <div className="mt-4">
            <Link
              href={`/pay/${code}?t=${encodeURIComponent(token)}`}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-xs uppercase tracking-widest text-white transition hover:bg-gold/90"
            >
              {m.proceedToPayment}
            </Link>
          </div>
        )}
        {booking.paid_at && (
          <div className="mt-4">
            <a
              href={`/api/bookings/${code}/receipt?t=${encodeURIComponent(token)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10"
            >
              {m.downloadReceipt}
            </a>
          </div>
        )}
      </div>

      {/* Check-in info section (only for paid bookings) */}
      {booking.status === "completed" && (
        <CheckinInfoCard locale={locale} />
      )}

      {/* Balance payment section */}
      {booking.status === "completed" && booking.balance_due != null && Number(booking.balance_due) > 0 && !booking.balance_paid_at && (
        <div className="mt-6 rounded-lg border border-gold/40 bg-card p-6 space-y-4">
          <h2 className="font-serif-display text-lg italic text-foreground">
            {m.balanceSectionTitle}
          </h2>
          <p className="text-sm text-foreground/70">
            {format(m.balanceDueText, { amount: Number(booking.balance_due).toFixed(2) })}
          </p>
          {booking.city_tax != null && Number(booking.city_tax) > 0 && (
            <p className="text-xs text-foreground/50">
              {format(
                cityTaxOnline ? m.balanceCityTaxOnline : m.balanceCityTax,
                { amount: Number(booking.city_tax).toFixed(2) },
              )}
            </p>
          )}
          <Link
            href={`/pay-balance/${code}?t=${encodeURIComponent(token)}`}
            className="inline-flex items-center gap-2 rounded-full border border-gold bg-gold/10 px-6 py-2.5 text-xs uppercase tracking-widest text-gold transition hover:bg-gold/20"
          >
            {m.payBalanceButton}
          </Link>
        </div>
      )}

      {/* Cancellation section */}
      {isCancellable && (
        <div className="mt-6 rounded-lg border border-gold/20 bg-card p-6 space-y-4">
          <h2 className="font-serif-display text-lg italic text-foreground">
            {m.cancelSectionTitle}
          </h2>

          <div className="rounded-md bg-foreground/5 p-4 text-sm text-foreground/70 space-y-2">
            <p className="font-medium text-foreground">{m.cancelPolicyTitle}</p>
            {wasPaid ? (
              refundReason === "full" ? (
                <>
                  <p>
                    {format(m.cancelFullRefundMsg, {
                      days: String(days),
                      threshold: String(CANCEL_FULL_REFUND_DAYS),
                      fee_pct: String(CANCEL_FEE_PERCENT),
                    })}
                  </p>
                  <p>
                    {format(m.cancelFullRefundDetail, {
                      paid: accommodationPaid.toFixed(2),
                      fee_pct: String(CANCEL_FEE_PERCENT),
                      fee: fee.toFixed(2),
                      refund: accommodationRefund.toFixed(2),
                    })}
                  </p>
                  {cityTaxRefund > 0 && (
                    <p>{format(m.cancelCityTaxRefund, { amount: cityTaxRefund.toFixed(2) })}</p>
                  )}
                  <p className="text-foreground/50 text-xs">{m.cancelRefundCredit}</p>
                </>
              ) : refundReason === "half" ? (
                <>
                  <p>
                    {format(m.cancelHalfRefundMsg, {
                      days: String(days),
                      halfThreshold: String(CANCEL_HALF_REFUND_DAYS),
                      fullThreshold: String(CANCEL_FULL_REFUND_DAYS),
                      pct: String(CANCEL_PARTIAL_REFUND_PCT),
                    })}
                  </p>
                  <p>
                    {format(m.cancelHalfRefundDetail, {
                      paid: accommodationPaid.toFixed(2),
                      pct: String(CANCEL_PARTIAL_REFUND_PCT),
                      gross: grossHalf.toFixed(2),
                      fee_pct: String(CANCEL_FEE_PERCENT),
                      fee: fee.toFixed(2),
                      refund: accommodationRefund.toFixed(2),
                    })}
                  </p>
                  {cityTaxRefund > 0 && (
                    <p>{format(m.cancelCityTaxRefund, { amount: cityTaxRefund.toFixed(2) })}</p>
                  )}
                  <p className="text-foreground/50 text-xs">{m.cancelRefundCredit}</p>
                </>
              ) : (
                <>
                  <p>
                    {format(m.cancelNoneMsg, {
                      days: String(days),
                      threshold: String(CANCEL_HALF_REFUND_DAYS),
                    })}
                  </p>
                  {cityTaxRefund > 0 && (
                    <p>{format(m.cancelCityTaxRefund, { amount: cityTaxRefund.toFixed(2) })}</p>
                  )}
                  <p className="text-foreground/50 text-xs">
                    {m.cancelNoneContactBefore}{" "}
                    <a href={`mailto:${CONTENT.email}`} className="text-gold underline">
                      {CONTENT.email}
                    </a>
                    {m.cancelNoneContactAfter}
                  </p>
                </>
              )
            ) : (
              <p>{m.cancelFreeMsg}</p>
            )}
          </div>

          {pageState === "confirming" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{m.cancelConfirmPrompt}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="rounded-full border border-red-400 bg-red-50 px-6 py-2 text-xs uppercase tracking-widest text-red-700 transition hover:bg-red-100"
                >
                  {m.cancelConfirmYes}
                </button>
                <button
                  onClick={() => setPageState("ready")}
                  className="rounded-full border border-gold/30 px-6 py-2 text-xs uppercase tracking-widest text-foreground/60 transition hover:bg-gold/10"
                >
                  {m.cancelConfirmNo}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setPageState("confirming")}
              className="rounded-full border border-red-400/60 px-6 py-2 text-xs uppercase tracking-widest text-red-600 transition hover:bg-red-50"
            >
              {m.cancelButton}
            </button>
          )}
        </div>
      )}
    </PageShell>
  );
}

function CheckinInfoCard({ locale }: { locale: LocaleCode }) {
  const ci = translations[locale].checkinInfo;
  const address = process.env.NEXT_PUBLIC_CHECKIN_ADDRESS;
  // Telefono ed email dal CONTENUTO (modificabili in Contenuti), non dalle env fissate
  // alla creazione: così cambiando "Email contatto"/"Telefono" si aggiorna anche qui.
  const phone = CONTENT.phone || process.env.NEXT_PUBLIC_HOST_PHONE;
  const email = CONTENT.email || process.env.NEXT_PUBLIC_HOST_EMAIL;

  if (!address && !phone && !email) return null;

  return (
    <div className="mt-6 rounded-lg border border-gold/40 bg-card p-6 space-y-4">
      <h2 className="font-serif-display text-lg italic text-foreground">{ci.title}</h2>
      <dl className="space-y-3 text-sm">
        {address && (
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-foreground/40">{ci.addressLabel}</dt>
            <dd className="mt-0.5 text-foreground">{address}</dd>
          </div>
        )}
        {phone && (
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-foreground/40">{ci.phoneLabel}</dt>
            <dd className="mt-0.5">
              <a href={`tel:${phone}`} className="text-gold underline">{phone}</a>
            </dd>
          </div>
        )}
        {email && (
          <div>
            <dt className="text-[11px] uppercase tracking-widest text-foreground/40">{ci.emailLabel}</dt>
            <dd className="mt-0.5">
              <a href={`mailto:${email}`} className="text-gold underline">{email}</a>
            </dd>
          </div>
        )}
      </dl>
      <p className="text-xs text-foreground/50">{ci.note}</p>
    </div>
  );
}

function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-lg">
        <h1 className="font-serif-display text-3xl italic text-foreground mb-8">
          {title}
        </h1>
        {children}
      </div>
    </section>
  );
}
