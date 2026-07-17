"use client";

import { useEffect, useMemo, useState } from "react";
import { getDayRate, makeDayRateFn, toISODate, type DayRate } from "@/data/availability";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "@/i18n/format";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface Props {
  onRequestBooking: (checkin: string, checkout: string, totalPrice: number) => void;
  onClear?: () => void;
  minAdvanceDays?: number;
  // Struttura con camere: unità di cui mostrare la disponibilità (appartamento intero
  // o singola camera). Assente → unità radice (retro-compatibile con il sito a unità singola).
  unitId?: string;
}

export default function AvailabilityCalendar({ onRequestBooking, onClear, minAdvanceDays = 2, unitId }: Props) {
  const { t } = useLanguage();
  const today = startOfDay(new Date());
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [range, setRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  // Fetch fresh availability data from GitHub (bypasses the static build-time bundle).
  const [liveGetDayRate, setLiveGetDayRate] = useState<((d: Date) => DayRate) | null>(null);
  useEffect(() => {
    fetch(`/api/availability${unitId ? `?unit=${encodeURIComponent(unitId)}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.overrides && typeof data.defaultPrice === "number") {
          setLiveGetDayRate(() => makeDayRateFn(data.defaultPrice, data.overrides as DayRate[]));
        }
      })
      .catch(() => { /* fallback to static data */ });
  }, [unitId]);

  const getRate = liveGetDayRate ?? getDayRate;

  const grid = useMemo(
    () => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const minCheckin = new Date(today);
  minCheckin.setDate(minCheckin.getDate() + minAdvanceDays);

  function isPast(d: Date) {
    return startOfDay(d) < today;
  }

  function isTooSoon(d: Date) {
    return startOfDay(d) < minCheckin;
  }

  // Returns the size of the "gap" between two booked blocks around a free period starting at `start`.
  // Used to allow 2-night bookings when the gap between two bookings is exactly 2 nights.
  function gapSize(start: Date): number {
    let count = 0;
    const cur = new Date(start);
    while (getRate(cur).status !== "booked") {
      count++;
      cur.setDate(cur.getDate() + 1);
      if (count > 10) return count; // no relevant gap
    }
    return count;
  }

  function isSelected(d: Date) {
    if (!range.start) return false;
    const end = range.end ?? range.start;
    const [a, b] = end < range.start ? [end, range.start] : [range.start, end];
    return d >= a && d <= b;
  }

  // Le notti occupate sono [checkin, checkout): il giorno di check-out di un soggiorno è
  // libero per il check-in del successivo, quindi non basta is "booked" sul singolo giorno
  // per decidere se è selezionabile come fine-intervallo — vanno controllate solo le notti
  // realmente comprese tra inizio e fine (estremo finale escluso).
  function hasBookedNightBetween(start: Date, end: Date) {
    const cur = new Date(start);
    while (cur < end) {
      if (getRate(cur).status === "booked") return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  }

  function minNights(start: Date): number {
    // Allow 2 nights only when the available gap is exactly 2 (squeezed between two bookings)
    return gapSize(start) === 2 ? 2 : 3;
  }

  function handleDayClick(d: Date) {
    if (isPast(d) || isTooSoon(d)) return;

    const pickingEnd = range.start && !range.end;

    if (pickingEnd && range.start) {
      const nightCount = Math.round((d.getTime() - range.start.getTime()) / 86_400_000);
      const min = minNights(range.start);
      if (d > range.start && nightCount >= min && !hasBookedNightBetween(range.start, d)) {
        setRange({ start: range.start, end: d });
      } else if (d < range.start && getRate(d).status !== "booked") {
        setRange({ start: d, end: range.start });
      }
      return;
    }

    if (getRate(d).status === "booked") return;
    setRange({ start: d, end: null });
  }

  const nights = useMemo(() => {
    if (!range.start || !range.end) return [];
    const list: Date[] = [];
    const cur = new Date(range.start);
    while (cur < range.end) {
      list.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  }, [range]);

  const totalPrice = nights.reduce((sum, d) => sum + getRate(d).price, 0);

  function changeMonth(delta: number) {
    setViewDate((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <button
          onClick={() => changeMonth(-1)}
          className="rounded-full border border-gold/40 px-3 py-1 text-gold transition hover:bg-gold/10"
          aria-label={t.booking.prevMonth}
        >
          ‹
        </button>
        <p className="font-serif-display text-xl italic text-foreground">
          {t.booking.months[viewDate.getMonth()]} {viewDate.getFullYear()}
        </p>
        <button
          onClick={() => changeMonth(1)}
          className="rounded-full border border-gold/40 px-3 py-1 text-gold transition hover:bg-gold/10"
          aria-label={t.booking.nextMonth}
        >
          ›
        </button>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-widest text-foreground/50">
        {t.booking.weekdays.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          if (!d) return <div key={i} />;
          const rate = getRate(d);
          const past = isPast(d);
          const tooSoon = !past && isTooSoon(d);
          const booked = rate.status === "booked";
          const selected = isSelected(d);

          const prevDay = new Date(d);
          prevDay.setDate(prevDay.getDate() - 1);
          // Le bande mezza-giornata (check-in pomeriggio / check-out mattina) hanno senso solo
          // sui giorni mostrati come prenotabili: un giorno passato o troppo a ridosso è reso
          // interamente disabilitato, SENZA banda — altrimenti il giorno di check-in di una
          // prenotazione già iniziata resterebbe con la banda a destra invece che spento come
          // i giorni successivi.
          const isCheckoutDay = !past && !tooSoon && !booked && getRate(prevDay).status === "booked";
          const isCheckinDay = !past && !tooSoon && booked && getRate(prevDay).status !== "booked";

          const nightsFromStart = range.start
            ? Math.round((d.getTime() - range.start.getTime()) / 86_400_000)
            : 0;
          const meetsMinNights = range.start ? nightsFromStart >= minNights(range.start) : false;

          const selectableAsCheckout =
            booked &&
            range.start &&
            !range.end &&
            d > range.start &&
            meetsMinNights &&
            !hasBookedNightBetween(range.start, d);

          // Gli estremi dell'intervallo selezionato occupano solo metà giornata (check-in il
          // pomeriggio, check-out la mattina): evidenziamo solo il triangolo pertinente, non
          // l'intera cella, per non far credere che l'intera giornata sia "presa".
          const isRangeStart = !!range.start && toISODate(d) === toISODate(range.start);
          const isRangeEnd = !!range.end && toISODate(d) === toISODate(range.end);
          const isMiddleSelected = selected && !isRangeStart && !isRangeEnd;

          return (
            <button
              key={toISODate(d)}
              disabled={past || tooSoon || (booked && !selectableAsCheckout)}
              onClick={() => handleDayClick(d)}
              title={
                isCheckoutDay
                  ? "Giorno di check-out: prenotabile"
                  : selectableAsCheckout
                    ? "Selezionabile come data di check-out"
                    : isCheckinDay
                      ? "Giorno di check-in: occupato"
                      : undefined
              }
              className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-md border text-xs transition ${
                past || tooSoon
                  ? "border-transparent text-foreground/20"
                  : isMiddleSelected
                    ? "border-gold bg-gold text-[#faf6ec]"
                    : isRangeStart || isRangeEnd
                      ? "border-gold text-foreground"
                      : selectableAsCheckout
                        ? "border-gold/30 text-foreground hover:border-gold"
                        : isCheckinDay
                          ? "border-gold/20 text-foreground/30 line-through"
                          : booked
                            ? "border-transparent bg-foreground/5 text-foreground/30 line-through"
                            : "border-gold/30 text-foreground hover:border-gold"
              }`}
            >
              {isCheckoutDay && (
                <span className="absolute inset-y-0 left-0 w-[42%] bg-foreground/5" />
              )}
              {isCheckinDay && (
                <span className="absolute inset-y-0 right-0 w-[42%] bg-foreground/5" />
              )}
              {isRangeStart && !isMiddleSelected && (
                <span className="absolute inset-y-0 right-0 w-[42%] bg-gold" />
              )}
              {isRangeEnd && !isMiddleSelected && (
                <span className="absolute inset-y-0 left-0 w-[42%] bg-gold" />
              )}
              <span className="relative">{d.getDate()}</span>
              {!past && !booked && (
                <span className={`relative text-[10px] ${isMiddleSelected ? "text-[#faf6ec]/90" : "text-gold"}`}>
                  €{rate.price}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        {range.start && (
          <p className="text-sm text-foreground/80">
            {range.end
              ? `${nights.length} ${
                  nights.length === 1 ? t.booking.nightSingular : t.booking.nightPlural
                } · ${range.start.toLocaleDateString()} → ${range.end.toLocaleDateString()} · ${
                  t.booking.totalEstimate
                } €${totalPrice} ${t.booking.plusCityTax}`
              : format(t.booking.selectCheckout, { date: range.start.toLocaleDateString() })}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setRange({ start: null, end: null });
              onClear?.();
            }}
            className="rounded-full border border-gold/40 px-5 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10"
          >
            {t.booking.clearSelection}
          </button>
          <button
            disabled={!range.start || !range.end}
            onClick={() =>
              range.start &&
              range.end &&
              onRequestBooking(toISODate(range.start), toISODate(range.end), totalPrice)
            }
            className="rounded-full border border-gold bg-gold px-5 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-gold disabled:hover:text-[#faf6ec]"
          >
            {t.booking.requestDates}
          </button>
        </div>
      </div>
    </div>
  );
}
