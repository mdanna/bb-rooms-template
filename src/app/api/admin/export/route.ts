import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(values: unknown[]): string {
  return values.map(escapeCsv).join(",");
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");

  await ensureSchema();

  const conditions: string[] = [];
  const params: string[] = [];

  if (from) {
    params.push(from);
    conditions.push(`checkin >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`checkout <= $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query<Booking>(
    `SELECT * FROM bookings ${where} ORDER BY checkin ASC`,
    params
  );

  // Modello a pagamento intero: niente più acconto/saldo. Le colonne rilevanti sono
  // ora la policy di rimborso congelata, l'eventuale rimborso dovuto e la data di rimborso.
  const headers = [
    "Codice", "Nome", "Cognome", "Email", "Telefono", "Ospiti",
    "Check-in", "Check-out", "Stato", "Prezzo totale", "Tassa soggiorno",
    "Metodo pagamento", "Policy rimborso", "Rimborso dovuto",
    "Pagato il", "Rimborsato il", "Lingua", "Creato il",
  ];

  const lines = [
    row(headers),
    ...result.rows.map((b) =>
      row([
        b.code,
        b.first_name,
        b.last_name,
        b.email,
        b.phone,
        b.guests,
        typeof b.checkin === "object" ? (b.checkin as Date).toISOString().slice(0, 10) : String(b.checkin).slice(0, 10),
        typeof b.checkout === "object" ? (b.checkout as Date).toISOString().slice(0, 10) : String(b.checkout).slice(0, 10),
        b.status,
        b.total_price != null ? Number(b.total_price).toFixed(2) : "",
        b.city_tax != null ? Number(b.city_tax).toFixed(2) : "",
        b.payment_method ?? "",
        b.refund_policy ?? "",
        b.refund_due != null ? Number(b.refund_due).toFixed(2) : "",
        b.paid_at ? new Date(b.paid_at).toISOString().slice(0, 10) : "",
        b.refunded_at ? new Date(b.refunded_at).toISOString().slice(0, 10) : "",
        b.locale,
        new Date(b.created_at).toISOString().slice(0, 10),
      ])
    ),
  ];

  const csv = lines.join("\r\n");
  const filename = `prenotazioni-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
