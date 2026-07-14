"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { translations, type LocaleCode } from "@/i18n/index";
import { format } from "@/i18n/format";
import { formatDateOnly } from "@/lib/dateOnly";
import { POLICIES } from "@/lib/policies";
import { refundPolicyText } from "@/lib/refundPolicyText";

interface BookingSummary {
  code: string;
  first_name: string;
  last_name: string;
  guests: number;
  checkin: string;
  checkout: string;
  total_price: string | null;
  city_tax: string | null;
  city_tax_online: boolean | null;
  status: "pending" | "approved" | "rejected" | "completed";
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

export default function PaymentPage({ code }: { code: string }) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(t);
    fetch(`/api/bookings/${code}?t=${encodeURIComponent(t)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setBooking(data.booking);
          if (data.booking.status === "completed") {
            router.replace(`/confirmation/${code}?t=${encodeURIComponent(t)}`);
          }
        }
      })
      .catch(() => setError("error"));
  }, [code, router]);

  const locale: LocaleCode = booking?.locale && translations[booking.locale] ? booking.locale : "it";
  const t = translations[locale];
  const intlLocale = INTL_LOCALE[locale] ?? "it-IT";

  function formatDate(value: string) {
    return formatDateOnly(value, intlLocale);
  }

  const totalPrice = booking?.total_price ? Number(booking.total_price) : 0;
  const cityTax = booking?.city_tax ? Number(booking.city_tax) : 0;
  // Se city_tax_online la tassa è incassata ORA insieme al soggiorno (voce separata Stripe);
  // altrimenti (null/false) è riscossa al check-in e non compare nel pagamento online.
  const cityTaxOnline = booking?.city_tax_online === true && cityTax > 0;
  // Modello a pagamento intero: si versa online l'intero importo del soggiorno.
  const dueNowTotal = totalPrice + (cityTaxOnline ? cityTax : 0);

  async function goToCheckout() {
    setRedirecting(true);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${code}/checkout?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "error");
      window.location.href = data.url;
    } catch {
      setError("error");
      setRedirecting(false);
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-foreground/70">{t.payment.notFound}</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-foreground/60">{t.payment.loading}</p>
      </div>
    );
  }

  if (booking.status !== "approved") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <p className="text-foreground/70">{t.payment.notApproved}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-lg">
        <p className="label-gold text-xs">{t.payment.eyebrow}</p>
        <h1 className="font-serif-display mt-2 text-3xl italic text-foreground">
          {t.payment.title}
        </h1>

        {/* Booking summary */}
        <div className="mt-6 rounded-lg border border-gold/40 bg-card p-6">
          <p className="font-serif-display text-lg italic text-foreground">{booking.code}</p>
          <p className="mt-2 text-sm text-foreground/80">
            {booking.first_name} {booking.last_name}
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            {formatDate(booking.checkin)} → {formatDate(booking.checkout)} ·{" "}
            {format(t.payment.guests, { count: booking.guests })}
          </p>
          {totalPrice > 0 && (
            <p className="mt-3 text-sm text-foreground/70">
              {t.payment.totalStayPrice}:{" "}
              <strong className="text-foreground">€{totalPrice.toFixed(2)}</strong>
            </p>
          )}
        </div>

        {/* Riepilogo pagamento — importo intero del soggiorno */}
        {totalPrice > 0 && (
          <div className="mt-4 rounded-lg border border-gold/40 bg-card p-6 space-y-4">
            {/* Payment breakdown */}
            <div className="rounded-md bg-foreground/5 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground/70">{t.payment.totalStayPrice}</span>
                <span className={cityTaxOnline ? "text-foreground/70" : "font-semibold text-gold"}>
                  €{totalPrice.toFixed(2)}
                </span>
              </div>
              {cityTaxOnline && (
                <>
                  <div className="flex justify-between text-foreground/70">
                    <span>{t.payment.cityTaxLineItem}</span>
                    <span>€{cityTax.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-foreground/10 pt-1.5 flex justify-between">
                    <span className="text-foreground/70">{t.payment.totalDueNow}</span>
                    <span className="font-semibold text-gold">€{dueNowTotal.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {cityTax > 0 && (
              <p className="text-xs text-foreground/50">
                {format(
                  cityTaxOnline ? t.payment.cityTaxOnlineNote : t.payment.cityTaxNote,
                  { amount: cityTax.toFixed(2) },
                )}
              </p>
            )}
            <p className="text-xs text-foreground/50">{refundPolicyText(POLICIES.refundPolicy, locale)}</p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{t.form.error}</p>}

        <button
          onClick={goToCheckout}
          disabled={redirecting}
          className="mt-6 w-full rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {redirecting ? t.payment.processing : t.payment.confirmButton}
        </button>
        <p className="mt-3 text-center text-xs text-foreground/50">{t.payment.secureNote}</p>
      </div>
    </div>
  );
}
