import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { pool, ensureSchema, type Booking } from "@/lib/db";
import { formatFriendlyDate, formatFriendlyDateOnly } from "@/lib/emailDates";
import { getMethodLabel } from "@/lib/emailTemplates";
import type { LocaleCode } from "@/i18n/index";
import { verifyAccessToken } from "@/lib/accessToken";
import { CONTENT } from "@/lib/siteContent";
import { THEME } from "@/lib/theme";

// pdf-lib's standard fonts only support Latin (WinAnsi) glyphs, quindi per le lingue
// CJK la ricevuta PDF usa le etichette in inglese invece di rompersi con testo non renderizzabile.
const CJK: LocaleCode[] = ["zh", "ja", "ko"];

type PdfLabels = {
  title: string; subtitle: string;
  locatore: string; immobile: string; cfLocatore: string;
  code: string; guest: string; guests: string;
  checkin: string; checkout: string; total: string;
  cityTax: string;
  method: string; paidOn: string; thanks: string; na: string;
};

const PDF_LABELS: Record<string, PdfLabels> = {
  it: {
    title: CONTENT.siteTitle.it,
    subtitle: "Conferma di prenotazione e ricevuta di pagamento",
    locatore: "Locatore",
    immobile: "Immobile",
    cfLocatore: "P.IVA / C.F.",
    code: "Codice prenotazione",
    guest: "Ospite",
    guests: "Numero ospiti",
    checkin: "Check-in",
    checkout: "Check-out",
    total: "Importo totale",
    cityTax: "Tassa di soggiorno",
    method: "Metodo di pagamento",
    paidOn: "Data pagamento",
    thanks: `Grazie per aver scelto ${CONTENT.siteTitle.it}.`,
    na: "n.d.",
  },
  en: {
    title: CONTENT.siteTitle.en,
    subtitle: "Booking confirmation and payment receipt",
    locatore: "Landlord",
    immobile: "Property",
    cfLocatore: "VAT / Tax ID",
    code: "Booking code",
    guest: "Guest",
    guests: "Number of guests",
    checkin: "Check-in",
    checkout: "Check-out",
    total: "Total amount",
    cityTax: "City tax",
    method: "Payment method",
    paidOn: "Payment date",
    thanks: `Thank you for choosing ${CONTENT.siteTitle.en}.`,
    na: "n/a",
  },
  fr: {
    title: CONTENT.siteTitle.fr,
    subtitle: "Confirmation de réservation et reçu de paiement",
    locatore: "Bailleur",
    immobile: "Bien loué",
    cfLocatore: "TVA / N° fiscal",
    code: "Code de réservation",
    guest: "Hôte",
    guests: "Nombre de voyageurs",
    checkin: "Arrivée",
    checkout: "Départ",
    total: "Montant total",
    cityTax: "Taxe de séjour",
    method: "Méthode de paiement",
    paidOn: "Date de paiement",
    thanks: `Merci d'avoir choisi ${CONTENT.siteTitle.fr}.`,
    na: "n/d",
  },
  de: {
    title: CONTENT.siteTitle.de,
    subtitle: "Buchungsbestätigung und Zahlungsbeleg",
    locatore: "Vermieter",
    immobile: "Mietobjekt",
    cfLocatore: "USt-ID / Steuer-Nr.",
    code: "Buchungscode",
    guest: "Gast",
    guests: "Anzahl der Gäste",
    checkin: "Anreise",
    checkout: "Abreise",
    total: "Gesamtbetrag",
    cityTax: "Kurtaxe",
    method: "Zahlungsmethode",
    paidOn: "Zahlungsdatum",
    thanks: `Vielen Dank, dass Sie sich für ${CONTENT.siteTitle.de} entschieden haben.`,
    na: "k.A.",
  },
  es: {
    title: CONTENT.siteTitle.es,
    subtitle: "Confirmación de reserva y recibo de pago",
    locatore: "Arrendador",
    immobile: "Inmueble",
    cfLocatore: "IVA / NIF",
    code: "Código de reserva",
    guest: "Huésped",
    guests: "Número de huéspedes",
    checkin: "Llegada",
    checkout: "Salida",
    total: "Importe total",
    cityTax: "Tasa turística",
    method: "Método de pago",
    paidOn: "Fecha de pago",
    thanks: `Gracias por elegir ${CONTENT.siteTitle.es}.`,
    na: "n/d",
  },
  pt: {
    title: CONTENT.siteTitle.pt,
    subtitle: "Confirmação de reserva e recibo de pagamento",
    locatore: "Locador",
    immobile: "Imóvel",
    cfLocatore: "NIF / N.º fiscal",
    code: "Código da reserva",
    guest: "Hóspede",
    guests: "Número de hóspedes",
    checkin: "Check-in",
    checkout: "Check-out",
    total: "Valor total",
    cityTax: "Taxa turística",
    method: "Método de pagamento",
    paidOn: "Data do pagamento",
    thanks: `Obrigado por escolher ${CONTENT.siteTitle.pt}.`,
    na: "n/d",
  },
};

function drawRow(
  page: ReturnType<PDFDocument["addPage"]>,
  label: string, value: string, y: number, left: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  dark: ReturnType<typeof rgb>,
) {
  page.drawText(label, { x: left, y, size: 11, font: bold, color: dark });
  page.drawText(value, { x: left + 200, y, size: 11, font, color: dark });
}

// Pagina d'errore HTML curata: la ricevuta è un LINK DIRETTO (email/pagina), quindi
// in caso di errore il browser mostrerebbe JSON grezzo. Meglio una pagina brandizzata.
const ERR_MSG: Record<string, { title: string; body: string; unauthorized: string; back: string; help: string }> = {
  it: { title: "Ricevuta non disponibile", body: "La ricevuta è disponibile solo per le prenotazioni completate. Questa prenotazione potrebbe essere stata annullata o non essere ancora conclusa.", unauthorized: "Questo link non è valido o è scaduto.", back: "Torna al sito", help: "Hai bisogno di aiuto? Scrivici:" },
  en: { title: "Receipt unavailable", body: "The receipt is only available for completed bookings. This booking may have been cancelled or may not be completed yet.", unauthorized: "This link is invalid or has expired.", back: "Back to the website", help: "Need help? Contact us:" },
  es: { title: "Recibo no disponible", body: "El recibo solo está disponible para reservas completadas. Esta reserva puede haber sido cancelada o aún no estar finalizada.", unauthorized: "Este enlace no es válido o ha caducado.", back: "Volver al sitio", help: "¿Necesitas ayuda? Escríbenos:" },
  fr: { title: "Reçu indisponible", body: "Le reçu n'est disponible que pour les réservations terminées. Cette réservation a peut-être été annulée ou n'est pas encore finalisée.", unauthorized: "Ce lien est invalide ou a expiré.", back: "Retour au site", help: "Besoin d'aide ? Écrivez-nous :" },
  de: { title: "Beleg nicht verfügbar", body: "Der Beleg ist nur für abgeschlossene Buchungen verfügbar. Diese Buchung wurde möglicherweise storniert oder ist noch nicht abgeschlossen.", unauthorized: "Dieser Link ist ungültig oder abgelaufen.", back: "Zurück zur Website", help: "Brauchen Sie Hilfe? Schreiben Sie uns:" },
  pt: { title: "Recibo indisponível", body: "O recibo só está disponível para reservas concluídas. Esta reserva pode ter sido cancelada ou ainda não estar concluída.", unauthorized: "Este link é inválido ou expirou.", back: "Voltar ao site", help: "Precisa de ajuda? Escreva-nos:" },
  zh: { title: "收据不可用", body: "收据仅适用于已完成的预订。此预订可能已被取消或尚未完成。", unauthorized: "此链接无效或已过期。", back: "返回网站", help: "需要帮助？请联系我们：" },
  ja: { title: "領収書は利用できません", body: "領収書は完了した予約のみご利用いただけます。この予約はキャンセルされたか、まだ完了していない可能性があります。", unauthorized: "このリンクは無効か、有効期限が切れています。", back: "サイトに戻る", help: "お困りですか？お問い合わせ：" },
  ko: { title: "영수증을 이용할 수 없습니다", body: "영수증은 완료된 예약에만 제공됩니다. 이 예약은 취소되었거나 아직 완료되지 않았을 수 있습니다.", unauthorized: "이 링크는 유효하지 않거나 만료되었습니다.", back: "사이트로 돌아가기", help: "도움이 필요하신가요? 문의:" },
};

function pickLocale(request: Request): string {
  const code = (request.headers.get("accept-language") ?? "").split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return code && code in ERR_MSG ? code : "it";
}

function errorPage(locale: string, kind: "unavailable" | "unauthorized", status: number): NextResponse {
  const m = ERR_MSG[locale] ?? ERR_MSG.it;
  const message = kind === "unauthorized" ? m.unauthorized : m.body;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "/";
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c));
  const brand = CONTENT.siteTitle[locale as LocaleCode] || CONTENT.siteTitle.it;
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.title)}</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:${THEME.background};color:${THEME.foreground};padding:2rem;text-align:center}
  .card{max-width:30rem;width:100%;background:${THEME.card};border:1px solid ${THEME.gold}55;border-radius:14px;padding:2.6rem 2rem;box-shadow:0 24px 60px -20px rgba(0,0,0,.18)}
  .brand{font-size:.68rem;letter-spacing:.28em;text-transform:uppercase;color:${THEME.gold};margin-bottom:1rem}
  .mark{display:inline-flex;align-items:center;justify-content:center;width:3rem;height:3rem;border-radius:999px;border:1.5px solid ${THEME.gold};color:${THEME.gold};font-size:1.4rem;margin-bottom:.6rem}
  h1{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:1.55rem;font-weight:600;margin:.2rem 0 .8rem;line-height:1.3}
  p{opacity:.75;line-height:1.6;font-size:.98rem;margin:0 0 1.5rem}
  a.btn{display:inline-block;background:${THEME.gold};color:${THEME.background};text-decoration:none;border-radius:999px;padding:.72rem 1.9rem;font-size:.82rem;letter-spacing:.05em;text-transform:uppercase;transition:opacity .2s}
  a.btn:hover{opacity:.88}
  .help{margin:1.6rem 0 0;font-size:.8rem;opacity:.6}.help a{color:${THEME.gold}}
</style></head><body><div class="card">
  <div class="brand">${esc(brand)}</div>
  <div class="mark">✕</div>
  <h1>${esc(m.title)}</h1>
  <p>${esc(message)}</p>
  <a class="btn" href="${esc(siteUrl)}">${esc(m.back)}</a>
  <p class="help">${esc(m.help)} <a href="mailto:${esc(CONTENT.email)}">${esc(CONTENT.email)}</a></p>
</div></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const token = new URL(request.url).searchParams.get("t");
  if (!verifyAccessToken(code, token)) {
    return errorPage(pickLocale(request), "unauthorized", 401);
  }

  await ensureSchema();

  const result = await pool.query<Booking>(
    `SELECT * FROM bookings WHERE code = $1`,
    [code]
  );
  const booking = result.rows[0];
  if (!booking || booking.status !== "completed") {
    // La ricevuta esiste solo per prenotazioni completate: una annullata/in altro
    // stato mostra la pagina d'errore curata (nella lingua della prenotazione se nota).
    const loc = booking?.locale && booking.locale in ERR_MSG ? booking.locale : pickLocale(request);
    return errorPage(loc, "unavailable", 404);
  }

  const bookingLocale = (booking.locale as LocaleCode) ?? "it";
  const pdfLocale = CJK.includes(bookingLocale) ? "en" : bookingLocale;
  const rawLabels = PDF_LABELS[pdfLocale] ?? PDF_LABELS.it;

  const L = rawLabels;
  const dateLocale: LocaleCode = CJK.includes(bookingLocale) ? "en" : bookingLocale;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.72, 0.57, 0.25);
  const dark = rgb(0.12, 0.16, 0.27);
  const gray = rgb(0.45, 0.45, 0.45);

  let y = 780;
  const left = 60;
  const pageWidth = 595;

  // ── Intestazione ──────────────────────────────────────────────────────────
  page.drawText(L.title, { x: left, y, size: 20, font: bold, color: dark });
  y -= 22;
  page.drawText(L.subtitle, { x: left, y, size: 12, font, color: gold });
  y -= 32;

  // Linea separatrice
  page.drawLine({ start: { x: left, y }, end: { x: pageWidth - left, y }, thickness: 0.5, color: gold });
  y -= 18;

  // ── Dati locatore ─────────────────────────────────────────────────────────
  page.drawText(L.locatore.toUpperCase(), { x: left, y, size: 8, font: bold, color: gray });
  y -= 14;
  page.drawText(CONTENT.hostName, { x: left, y, size: 11, font: bold, color: dark });
  y -= 14;
  if (CONTENT.address) {
    page.drawText(CONTENT.address, { x: left, y, size: 10, font, color: dark });
    y -= 14;
  }
  if (CONTENT.vatNumber) {
    page.drawText(`${L.cfLocatore}: ${CONTENT.vatNumber}`, { x: left, y, size: 10, font, color: dark });
    y -= 14;
  }
  page.drawText(CONTENT.email, { x: left, y, size: 10, font, color: dark });
  y -= 20;

  // ── Dati immobile ─────────────────────────────────────────────────────────
  page.drawText(L.immobile.toUpperCase(), { x: left, y, size: 8, font: bold, color: gray });
  y -= 14;
  page.drawText(CONTENT.siteTitle.it, { x: left, y, size: 11, font: bold, color: dark });
  y -= 14;
  page.drawText(CONTENT.address, { x: left, y, size: 10, font, color: dark });
  y -= 14;
  page.drawText(`CIN: ${CONTENT.cin}`, { x: left, y, size: 10, font, color: dark });
  y -= 24;

  // Linea separatrice
  page.drawLine({ start: { x: left, y }, end: { x: pageWidth - left, y }, thickness: 0.5, color: gold });
  y -= 20;

  // ── Dati prenotazione ─────────────────────────────────────────────────────
  const method =
    booking.payment_method === "card" || booking.payment_method === "paypal"
      ? getMethodLabel(bookingLocale, booking.payment_method)
      : (booking.payment_method ?? L.na);

  // Opzione A: quando la tassa di soggiorno è stata incassata online (voce separata dell'anticipo)
  // la ricevuta deve elencarla esplicitamente. Per le prenotazioni con flag false/null la tassa è
  // riscossa al check-in con ricevuta dedicata, quindi qui non compare (comportamento storico).
  const showCityTax = booking.city_tax_online === true && Number(booking.city_tax) > 0;

  const rows: [string, string][] = [
    [L.code, booking.code],
    [L.guest, `${booking.first_name} ${booking.last_name}`],
    [L.guests, String(booking.guests)],
    [L.checkin, formatFriendlyDateOnly(booking.checkin, dateLocale)],
    [L.checkout, formatFriendlyDateOnly(booking.checkout, dateLocale)],
    [L.total, booking.total_price ? `€ ${booking.total_price}` : L.na],
    ...(showCityTax ? [[L.cityTax, `€ ${booking.city_tax}`] as [string, string]] : []),
    [L.method, method],
    [L.paidOn, booking.paid_at ? formatFriendlyDate(booking.paid_at, dateLocale) : L.na],
  ];

  for (const [label, value] of rows) {
    drawRow(page, label, value, y, left, font, bold, dark);
    y -= 24;
  }

  // ── Chiusura ──────────────────────────────────────────────────────────────
  y -= 14;
  page.drawLine({ start: { x: left, y }, end: { x: pageWidth - left, y }, thickness: 0.5, color: gold });
  y -= 16;
  page.drawText(L.thanks, { x: left, y, size: 11, font, color: dark });
  y -= 14;
  page.drawText(`${CONTENT.city}, Italia · ${CONTENT.phone}`, { x: left, y, size: 9, font, color: gray });

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="conferma-${booking.code}.pdf"`,
    },
  });
}
