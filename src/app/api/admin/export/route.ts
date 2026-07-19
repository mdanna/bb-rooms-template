import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool, ensureSchema, type Booking } from "@/lib/db";

// Export in formato Excel (SpreadsheetML 2003, XML): un vero foglio Excel con celle
// tipizzate (numeri come numeri), senza dipendenze esterne. Excel lo apre come foglio
// di calcolo; alcune versioni chiedono una conferma di formato all'apertura.

function xmlEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type CellValue = { v: string | number | null; num?: boolean };

function cell(c: CellValue): string {
  if (c.v === null || c.v === undefined || c.v === "") return "<Cell/>";
  const type = c.num ? "Number" : "String";
  return `<Cell><Data ss:Type="${type}">${xmlEscape(c.v)}</Data></Cell>`;
}

function rowXml(cells: CellValue[]): string {
  return `<Row>${cells.map(cell).join("")}</Row>`;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function dateOnly(value: unknown): string {
  if (!value) return "";
  return typeof value === "object" ? (value as Date).toISOString().slice(0, 10) : String(value).slice(0, 10);
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

  // Modello a pagamento intero: le colonne rilevanti sono la policy di rimborso congelata,
  // l'eventuale rimborso dovuto e la data di rimborso. Prezzi/tasse/ospiti come numeri.
  const headers = [
    "Codice", "Nome", "Cognome", "Email", "Telefono", "Ospiti",
    "Check-in", "Check-out", "Stato", "Prezzo totale", "Tassa soggiorno",
    "Metodo pagamento", "Policy rimborso", "Rimborso dovuto",
    "Pagato il", "Rimborsato il", "Lingua", "Creato il",
  ];

  const headerRow = rowXml(headers.map((h) => ({ v: h })));
  const dataRows = result.rows
    .map((b) =>
      rowXml([
        { v: b.code },
        { v: b.first_name },
        { v: b.last_name },
        { v: b.email },
        { v: b.phone },
        { v: numOrNull(b.guests), num: true },
        { v: dateOnly(b.checkin) },
        { v: dateOnly(b.checkout) },
        { v: b.status },
        { v: numOrNull(b.total_price), num: true },
        { v: numOrNull(b.city_tax), num: true },
        { v: b.payment_method ?? "" },
        { v: b.refund_policy ?? "" },
        { v: numOrNull(b.refund_due), num: true },
        { v: dateOnly(b.paid_at) },
        { v: dateOnly(b.refunded_at) },
        { v: b.locale },
        { v: dateOnly(b.created_at) },
      ])
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Prenotazioni">
  <Table>
   ${headerRow}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const filename = `prenotazioni-${new Date().toISOString().slice(0, 10)}.xls`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
