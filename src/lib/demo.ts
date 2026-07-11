import { NextResponse } from "next/server";
import type { Booking } from "@/lib/db";

// Modalità demo: istanza pubblica "prova dal vivo" (demo.dimorasuite.com).
// In demo NON si scrive nulla (né GitHub né DB): le scritture sono no-op con
// successo simulato, e le letture di prenotazioni/dashboard usano dati finti.
// Il flag lato server è DEMO_MODE; lato client NEXT_PUBLIC_DEMO_MODE.
export const DEMO_MODE = process.env.DEMO_MODE === "true";

// Risposta di successo simulata per le route di scrittura in demo (niente persistenza).
export function demoWriteBlocked(extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: true, demo: true, ...extra });
}

// Prenotazioni finte per la demo (Villa dei Tigli).
export const DEMO_BOOKINGS = ([
  { id: 1, code: "VT-8F2A", first_name: "Marco", last_name: "Rossi", email: "marco.rossi@example.com", phone: "+39 340 1234567",
    guests: 2, checkin: "2026-07-18", checkout: "2026-07-21", total_price: 360, deposit_amount: 180, balance_due: 180, city_tax: 24,
    message: "Arriviamo in tarda serata, possibile?", status: "approved", payment_method: null, paid_at: null,
    created_at: "2026-07-03T09:12:00Z", archived: false, locale: "it", deposit_rate: 0.5, balance_paid_at: null },
  { id: 2, code: "VT-1C7B", first_name: "Claire", last_name: "Dubois", email: "claire.dubois@example.com", phone: "+33 6 12 34 56 78",
    guests: 2, checkin: "2026-08-02", checkout: "2026-08-05", total_price: 420, deposit_amount: 210, balance_due: 210, city_tax: 24,
    message: null, status: "approved", payment_method: null, paid_at: null,
    created_at: "2026-06-28T14:40:00Z", archived: false, locale: "fr", deposit_rate: 0.5, balance_paid_at: null },
  { id: 3, code: "VT-4E9D", first_name: "Anna", last_name: "Bianchi", email: "anna.bianchi@example.com", phone: "+39 331 9876543",
    guests: 3, checkin: "2026-06-20", checkout: "2026-06-24", total_price: 520, deposit_amount: 260, balance_due: 0, city_tax: 36,
    message: null, status: "completed", payment_method: "card", paid_at: "2026-06-01T10:00:00Z",
    created_at: "2026-05-30T11:05:00Z", archived: false, locale: "it", deposit_rate: 0.5, balance_paid_at: "2026-06-18T08:00:00Z" },
  { id: 4, code: "VT-6A3F", first_name: "Thomas", last_name: "Weber", email: "thomas.weber@example.com", phone: "+49 151 2345678",
    guests: 2, checkin: "2026-09-10", checkout: "2026-09-13", total_price: 390, deposit_amount: 195, balance_due: 195, city_tax: 24,
    message: "Viaggio di nozze — camera con vista se possibile.", status: "pending", payment_method: null, paid_at: null,
    created_at: "2026-07-02T18:22:00Z", archived: false, locale: "de", deposit_rate: 0.5, balance_paid_at: null },
] as unknown) as Booking[];

// Dashboard finto (per trimestre).
export const DEMO_QUARTERS = [
  { year: 2026, quarter: 3, bookings: 9, revenue: 3480, city_tax: 216 },
  { year: 2026, quarter: 2, bookings: 14, revenue: 5120, city_tax: 336 },
  { year: 2026, quarter: 1, bookings: 6, revenue: 1980, city_tax: 132 },
];
