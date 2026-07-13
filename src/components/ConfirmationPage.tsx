"use client";

import { useEffect, useState } from "react";
import { pickL10n } from "@/lib/l10n";
import { translations, type LocaleCode } from "@/i18n/index";
import { format } from "@/i18n/format";
import { formatDateOnly } from "@/lib/dateOnly";
import { CONTENT } from "@/lib/siteContent";

interface BookingSummary {
  code: string;
  first_name: string;
  last_name: string;
  guests: number;
  checkin: string;
  checkout: string;
  total_price: string | null;
  deposit_amount: string | null;
  balance_due: string | null;
  city_tax: string | null;
  city_tax_online: boolean | null;
  status: "pending" | "approved" | "rejected" | "completed";
  payment_method: string | null;
  paid_at: string | null;
  locale: LocaleCode;
}

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

const METHOD_LABEL: Record<LocaleCode, Record<string, string>> = {
  it: { card: "Carta di credito", paypal: "PayPal" },
  en: { card: "Credit card", paypal: "PayPal" },
  fr: { card: "Carte de crédit", paypal: "PayPal" },
  de: { card: "Kreditkarte", paypal: "PayPal" },
  es: { card: "Tarjeta de crédito", paypal: "PayPal" },
  pt: { card: "Cartão de crédito", paypal: "PayPal" },
  zh: { card: "信用卡", paypal: "PayPal" },
  ja: { card: "クレジットカード", paypal: "PayPal" },
  ko: { card: "신용카드", paypal: "PayPal" },
};

export default function ConfirmationPage({ code }: { code: string }) {
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [error, setError] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams(window.location.search);
        const t = params.get("t") ?? "";
        setToken(t);
        const sessionId = params.get("session_id");
        if (sessionId) {
          // L'ospite torna da Stripe Checkout: verifichiamo subito l'esito invece di
          // aspettare il webhook, che può arrivare con un piccolo ritardo.
          await fetch(`/api/bookings/${code}/confirm-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          }).catch(() => null);
        }
        const res = await fetch(`/api/bookings/${code}?t=${encodeURIComponent(t)}`);
        const data = await res.json();
        if (data.error) setError(true);
        else setBooking(data.booking);
      } catch {
        setError(true);
      }
    }
    load();
  }, [code]);

  const locale: LocaleCode = booking?.locale && translations[booking.locale] ? booking.locale : "it";
  const t = translations[locale];
  const intlLocale = INTL_LOCALE[locale] ?? "it-IT";

  function formatStayDate(value: string) {
    return formatDateOnly(value, intlLocale);
  }

  function formatTimestamp(value: string) {
    return new Date(value).toLocaleDateString(intlLocale);
  }

  function methodLabel(method: string | null) {
    if (!method) return "";
    return (METHOD_LABEL[locale] ?? METHOD_LABEL.it)[method] ?? method;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="text-foreground/70">{t.confirmation.notFound}</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-foreground/60">{t.confirmation.loading}</p>
      </div>
    );
  }

  if (booking.status !== "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="text-foreground/70">{t.confirmation.notCompleted}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <p className="label-gold text-xs">{t.confirmation.eyebrow}</p>
      <h1 className="font-serif-display mt-2 max-w-lg text-3xl italic text-foreground sm:text-4xl">
        {format(t.confirmation.title, { name: booking.first_name })}
      </h1>
      <p className="mt-4 max-w-md text-foreground/80">
        {format(t.confirmation.subtitle, { site: pickL10n(CONTENT.siteTitle, locale) })}
      </p>

      <div className="mt-8 w-full max-w-md rounded-lg border border-gold/40 bg-card p-6 text-left">
        <p className="font-serif-display text-lg italic text-foreground">{booking.code}</p>
        <p className="mt-2 text-sm text-foreground/80">
          {formatStayDate(booking.checkin)} → {formatStayDate(booking.checkout)} ·{" "}
          {format(t.confirmation.guests, { count: booking.guests })}
        </p>
        {(() => {
          const total = Number(booking.total_price ?? 0);
          const deposit = Number(booking.deposit_amount ?? 0);
          const balance = Number(booking.balance_due ?? 0);
          const tax = Number(booking.city_tax ?? 0);
          const taxOnline = booking.city_tax_online === true && tax > 0;
          const hasBalance = balance > 0;
          // Importo alloggio di questa riga: anticipo se c'è ancora un saldo, altrimenti l'intero soggiorno.
          const stayFigure = hasBalance ? deposit : (total || deposit);
          // Totale effettivamente addebitato online ORA: alloggio pagato + tassa (se incassata online
          // come voce separata). NON è "inclusa nel prezzo del soggiorno": è aggiunta sopra.
          const paidOnline = deposit + (taxOnline ? tax : 0);
          return (
            <>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-foreground/70">
                    {hasBalance ? t.confirmation.depositPaid : t.confirmation.totalStayPrice}
                  </dt>
                  <dd className="text-foreground">€{stayFigure.toFixed(2)}</dd>
                </div>
                {taxOnline && (
                  <div className="flex items-center justify-between">
                    <dt className="text-foreground/70">{t.confirmation.cityTaxLine}</dt>
                    <dd className="text-foreground">€{tax.toFixed(2)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-gold/30 pt-1.5">
                  <dt className="font-medium text-foreground">{t.confirmation.totalPaidOnline}</dt>
                  <dd className="font-medium text-green-700">€{paidOnline.toFixed(2)} ✓</dd>
                </div>
              </dl>
              {hasBalance && (
                <p className="mt-3 text-sm text-foreground/80">
                  {format(t.confirmation.balanceDueAtCheckin, { amount: balance.toFixed(2) })}
                </p>
              )}
              {/* Tassa NON incassata online → riscossa al check-in (nota grigia, non entra nel totale). */}
              {tax > 0 && !taxOnline && (
                <p className="mt-1 text-sm text-foreground/60">
                  {format(t.confirmation.cityTaxNote, { amount: tax.toFixed(2) })}
                </p>
              )}
            </>
          );
        })()}
        <p className="mt-1 text-sm text-foreground/80">
          {t.confirmation.method}: {methodLabel(booking.payment_method)}
        </p>
        {booking.paid_at && (
          <p className="mt-1 text-sm text-foreground/60">
            {t.confirmation.paidOn} {formatTimestamp(booking.paid_at)}
          </p>
        )}
        {booking.deposit_amount && (
          <p className="mt-3 text-xs text-foreground/50">{t.confirmation.refundPolicy}</p>
        )}
      </div>

      <a
        href={`/api/bookings/${code}/receipt?t=${encodeURIComponent(token)}`}
        className="mt-8 rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
      >
        {t.confirmation.downloadPdf}
      </a>

      <p className="mt-6 text-xs text-foreground/50">{t.confirmation.emailNotice}</p>
    </div>
  );
}
