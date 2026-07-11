"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { translations, type LocaleCode } from "@/i18n/index";
import { format } from "@/i18n/format";
import { formatDateOnly } from "@/lib/dateOnly";

const INTL_LOCALE: Record<LocaleCode, string> = {
  it: "it-IT", en: "en-US", fr: "fr-FR", de: "de-DE",
  es: "es-ES", pt: "pt-PT", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR",
};

interface BookingData {
  code: string;
  first_name: string;
  last_name: string;
  guests: number;
  checkin: string;
  checkout: string;
  total_price: string | null;
  balance_due: string | null;
  city_tax: string | null;
  city_tax_online: boolean | null;
  balance_paid_at: string | null;
  status: string;
  locale: LocaleCode | null;
}

export default function PayBalancePage({ code, token }: { code: string; token: string }) {
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/bookings/${code}/data?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setBooking(d.booking);
      })
      .catch(() => setError("error"));
  }, [code, token]);

  const locale: LocaleCode = booking?.locale && translations[booking.locale] ? booking.locale : "it";
  const t = translations[locale];
  const pb = t.payBalance;
  const intlLocale = INTL_LOCALE[locale] ?? "it-IT";

  function fmtDate(iso: string) {
    return formatDateOnly(iso, intlLocale);
  }

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch("/api/pay-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, token }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "error");
        setLoading(false);
      }
    } catch {
      setError("error");
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/" className="text-xs uppercase tracking-widest text-gold hover:underline">← Home</Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-foreground/50">{t.payment.loading}</p>
      </div>
    );
  }

  if (booking.balance_paid_at) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="font-serif-display text-2xl italic text-foreground">{pb.alreadyPaidTitle}</h1>
        <p className="text-sm text-foreground/70">{format(pb.alreadyPaidMsg, { code })}</p>
        <Link href="/" className="text-xs uppercase tracking-widest text-gold hover:underline">← Home</Link>
      </div>
    );
  }

  const balanceDue = booking.balance_due ? Number(booking.balance_due) : null;
  const cityTax = booking.city_tax ? Number(booking.city_tax) : null;
  // Opzione A: se la tassa è stata incassata online con l'anticipo, NON va mostrata/ripetuta sul saldo.
  const cityTaxOnline = booking.city_tax_online === true;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md rounded-xl border border-gold/40 bg-card p-8">
        <h1 className="font-serif-display text-2xl italic text-foreground">{pb.title}</h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-foreground/50">{format(pb.bookingCode, { code })}</p>

        <div className="mt-6 space-y-2 text-sm text-foreground/80">
          <div className="flex justify-between">
            <span>{t.manage.labelGuest}</span>
            <span className="font-medium">{booking.first_name} {booking.last_name}</span>
          </div>
          <div className="flex justify-between">
            <span>{t.manage.labelCheckin}</span>
            <span className="font-medium">{fmtDate(booking.checkin)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t.manage.labelCheckout}</span>
            <span className="font-medium">{fmtDate(booking.checkout)}</span>
          </div>
          {booking.total_price && (
            <div className="flex justify-between">
              <span>{t.manage.labelTotalStay}</span>
              <span className="font-medium">€{booking.total_price}</span>
            </div>
          )}
          {cityTax != null && !cityTaxOnline && (
            <div className="flex justify-between text-foreground/60">
              <span>{format(pb.cityTaxLabel, { guests: booking.guests })}</span>
              <span>€{cityTax}</span>
            </div>
          )}
        </div>

        {balanceDue != null && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-gold/40 bg-gold/5 px-4 py-3">
            <span className="text-sm font-semibold uppercase tracking-widest text-foreground">{pb.totalLabel}</span>
            <span className="font-serif-display text-2xl italic text-foreground">€{balanceDue}</span>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={handlePay}
          disabled={loading || !balanceDue}
          className="mt-6 w-full rounded-full border border-gold bg-gold py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? pb.redirecting : format(pb.payButton, { amount: String(balanceDue ?? "…") })}
        </button>
      </div>
    </div>
  );
}
