"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "@/i18n/format";
import { getDayRate, makeDayRateFn, type DayRate } from "@/data/availability";

function makeHasBookedNightBetween(getRate: (d: Date) => DayRate) {
  return function hasBookedNightBetween(checkinStr: string, checkoutStr: string): boolean {
    const [y1, m1, d1] = checkinStr.split("-").map(Number);
    const [y2, m2, d2] = checkoutStr.split("-").map(Number);
    const cur = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    while (cur < end) {
      if (getRate(cur).status === "booked") return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  };
}

import { CONTENT } from "@/lib/siteContent";
import { POLICIES } from "@/lib/policies";
const HOST_EMAIL = CONTENT.email;

interface Props {
  checkin: string;
  checkout: string;
  totalPrice: number;
  // Struttura con camere: unità prenotata. Assente → unità radice.
  unitId?: string;
}

type SubmitState = "idle" | "sending" | "success" | "error";

export default function BookingForm({ checkin, checkout, totalPrice, unitId }: Props) {
  const { t, locale } = useLanguage();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(Math.min(2, POLICIES.maxGuests));
  const [message, setMessage] = useState("");
  const [checkinDate, setCheckinDate] = useState(checkin);
  const [checkoutDate, setCheckoutDate] = useState(checkout);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [bookingCode, setBookingCode] = useState("");

  const [hasBookedNightBetween, setHasBookedNightBetween] = useState(
    () => makeHasBookedNightBetween(getDayRate)
  );
  useEffect(() => {
    fetch(`/api/availability${unitId ? `?unit=${encodeURIComponent(unitId)}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.overrides && typeof data.defaultPrice === "number") {
          const getRate = makeDayRateFn(data.defaultPrice, data.overrides as DayRate[]);
          setHasBookedNightBetween(() => makeHasBookedNightBetween(getRate));
        }
      })
      .catch(() => {});
  }, [unitId]);

  useEffect(() => {
    // Sincronizza i campi data modificabili quando l'ospite seleziona un intervallo sul
    // calendario sovrastante: è un sync intenzionale da una prop esterna, non uno stato
    // derivabile durante il render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckinDate(checkin);
    setCheckoutDate(checkout);
    if (checkin && checkout) {
      const el = document.getElementById("prenotazione-form");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [checkin, checkout]);

  const nightsCount = useMemo(() => {
    if (!checkinDate || !checkoutDate || checkinDate >= checkoutDate) return 0;
    const d1 = new Date(checkinDate), d2 = new Date(checkoutDate);
    return Math.round((d2.getTime() - d1.getTime()) / 86400000);
  }, [checkinDate, checkoutDate]);

  const tooManyNights = nightsCount > POLICIES.maxNights;

  const datesInvalid = useMemo(() => {
    if (!checkinDate || !checkoutDate || checkinDate >= checkoutDate) return false;
    return hasBookedNightBetween(checkinDate, checkoutDate);
  }, [checkinDate, checkoutDate, hasBookedNightBetween]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (datesInvalid || tooManyNights) return;
    setSubmitState("sending");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          guests,
          checkin: checkinDate,
          checkout: checkoutDate,
          totalPrice: (checkin && checkout && checkinDate === checkin && checkoutDate === checkout) ? totalPrice : null,
          message,
          locale,
          ...(unitId ? { unitId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore");
      setBookingCode(data.code);
      setSubmitState("success");
    } catch {
      setSubmitState("error");
    }
  }

  if (submitState === "success") {
    return (
      <div
        id="prenotazione-form"
        className="mx-auto mt-12 max-w-xl rounded-lg border border-gold/40 bg-card p-8 text-center"
      >
        <h3 className="font-serif-display text-2xl italic text-foreground">{t.form.title}</h3>
        <p className="mt-4 text-foreground/80">{format(t.form.success, { code: bookingCode })}</p>
      </div>
    );
  }

  return (
    <form
      id="prenotazione-form"
      onSubmit={handleSubmit}
      className="mx-auto mt-12 max-w-xl rounded-lg border border-gold/40 bg-card p-8"
    >
      <h3 className="font-serif-display text-2xl italic text-foreground">{t.form.title}</h3>
      {checkin && checkout ? (
        <p className="mt-2 text-sm text-foreground/70">
          {format(t.form.helpWithDates, {
            checkin: new Date(checkin).toLocaleDateString(),
            checkout: new Date(checkout).toLocaleDateString(),
            total: totalPrice,
          })}
        </p>
      ) : (
        <p className="mt-2 text-sm text-foreground/70">{t.form.helpNoDates}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-widest text-foreground/60">
            {t.form.firstName}
          </label>
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-foreground/60">
            {t.form.lastName}
          </label>
          <input
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-foreground/60">
            {t.form.email}
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-foreground/60">
            {t.form.phone}
          </label>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-foreground/60">
            {t.form.checkinLabel}
          </label>
          <input
            required
            type="date"
            value={checkinDate}
            onChange={(e) => setCheckinDate(e.target.value)}
            className={`mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold ${
              datesInvalid ? "border-red-500" : "border-gold/40"
            }`}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-foreground/60">
            {t.form.checkoutLabel}
          </label>
          <input
            required
            type="date"
            value={checkoutDate}
            onChange={(e) => setCheckoutDate(e.target.value)}
            className={`mt-1 w-full rounded border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold ${
              datesInvalid ? "border-red-500" : "border-gold/40"
            }`}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-foreground/60">
            {t.form.guests} <span className="normal-case text-foreground/40">(max {POLICIES.maxGuests})</span>
          </label>
          <input
            required
            type="number"
            min={1}
            max={POLICIES.maxGuests}
            value={guests}
            onChange={(e) =>
              setGuests(Math.min(Math.max(1, Number(e.target.value) || 1), POLICIES.maxGuests))
            }
            className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
          />
        </div>
      </div>

      {datesInvalid && (
        <p className="mt-2 text-xs text-red-600">{t.form.datesUnavailable}</p>
      )}
      {tooManyNights && (
        <p className="mt-2 text-xs text-red-600">
          Il soggiorno non può superare {POLICIES.maxNights} notti. Seleziona un periodo più breve.
        </p>
      )}

      <div className="mt-4">
        <label className="text-xs uppercase tracking-widest text-foreground/60">
          {t.form.message}
        </label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold"
          placeholder={t.form.messagePlaceholder}
        />
      </div>

      <button
        type="submit"
        disabled={submitState === "sending" || datesInvalid || tooManyNights}
        className="mt-6 w-full rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitState === "sending" ? t.form.sending : t.form.submit}
      </button>
      {submitState === "error" && (
        <p className="mt-3 text-center text-xs text-red-600">{t.form.error}</p>
      )}
      <p className="mt-3 text-center text-xs text-foreground/50">
        {format(t.form.note, { email: HOST_EMAIL })}
      </p>
      <p className="mt-2 text-center text-xs text-foreground/40">
        Inviando questo modulo accetti la nostra{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
          informativa sulla privacy
        </a>
        .
      </p>
    </form>
  );
}
