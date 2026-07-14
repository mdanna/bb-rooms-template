import { Resend } from "resend";
import { PRIMARY_LANG } from "@/lib/l10n";
import type { LocaleCode } from "@/i18n/index";
import { getEmailTemplates, getExtraEmailStrings } from "./emailTemplates";
import { generateAccessToken, generateManagementToken } from "./accessToken";
import {
  buildHtml, title, para, smallPara, divider, bold, dataTable,
  button, linkButton, infoBox,
} from "./emailHtml";

import { CONTENT, HOST_WHATSAPP } from "./siteContent";
import { franchisePct, type RefundQuote, type RefundPolicy } from "./refund";
import { chargedAmount } from "./pricing";
import { unitLabel } from "./structure";
import { waLink } from "./whatsapp";

const resend = new Resend(process.env.RESEND_API_KEY);

// Etichetta localizzata di "che cosa si sta prenotando" (appartamento intero o quale
// camera). Presente in TUTTE le email (host in italiano, ospite nella sua lingua) per
// una struttura con camere; vuota per un sito a unità singola.
const ACCOMMODATION_LABEL: Record<LocaleCode, string> = {
  it: "Alloggio", en: "Accommodation", fr: "Logement", de: "Unterkunft",
  es: "Alojamiento", pt: "Alojamento", zh: "住宿", ja: "宿泊施設", ko: "숙소",
};

// Riga HTML "Alloggio: <unità>" (vuota se non c'è un'unità da indicare).
function accHtml(unit: string, locale: LocaleCode): string {
  return unit ? smallPara(`${bold(ACCOMMODATION_LABEL[locale] ?? ACCOMMODATION_LABEL.en)}: ${unit}`) : "";
}
// Riga testo equivalente (per la parte plain-text delle email).
function accText(unit: string, locale: LocaleCode): string {
  return unit ? `${ACCOMMODATION_LABEL[locale] ?? ACCOMMODATION_LABEL.en}: ${unit}` : "";
}

// Modello D — mittente UNICO dell'operatore (un dominio verificato in Resend,
// uguale per tutta la flotta), così non serve verificare il dominio di ogni
// cliente né un account Resend per cliente. Se MAIL_FROM_ADDRESS è impostata, le
// email partono da quell'indirizzo col NOME della struttura come display name e il
// contatto della struttura come Reply-To (stile Airbnb), e il nome della struttura
// è aggiunto anche all'OGGETTO (l'indirizzo non è del cliente → serve per capire a
// quale struttura si riferisce). Se NON è impostata: comportamento storico
// (mittente = bookingEmail della struttura), così le istanze esistenti non cambiano.
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS?.trim();
const MODEL_D = !!MAIL_FROM_ADDRESS;
const FROM = `${CONTENT.siteTitle[PRIMARY_LANG] || CONTENT.siteTitle.it} <${MAIL_FROM_ADDRESS || CONTENT.bookingEmail}>`;
const HOST_EMAIL = CONTENT.email;
const HOST_PHONE = CONTENT.phone;
// Suffisso "· WhatsApp" per le righe contatto delle email (se il numero è configurato).
const HOST_WA = waLink(HOST_WHATSAPP);
const WA_SUFFIX = HOST_WA ? ` · <a href="${HOST_WA}" style="color:#128C7E;">WhatsApp</a>` : "";

async function send(payload: { to: string; subject: string; text: string; html?: string; replyTo?: string }) {
  const { replyTo, subject, ...rest } = payload;
  const finalSubject = MODEL_D ? `${CONTENT.siteTitle[PRIMARY_LANG] || CONTENT.siteTitle.it} · ${subject}` : subject;
  const result = await resend.emails.send({
    from: FROM,
    ...(replyTo ? { replyTo } : {}),
    subject: finalSubject,
    ...rest,
  });
  if (result.error) {
    throw new Error(result.error.message ?? "Invio email fallito");
  }
}

// Notifica all'host: sempre in italiano, è uso interno.
export async function sendHostNotification(params: {
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guests: number;
  checkin: string | Date;
  checkout: string | Date;
  totalPrice: number | null;
  message: string | null;
  unitId?: string;
}) {
  const { code, firstName, lastName, email, phone, guests, checkin, checkout, totalPrice, message } =
    params;
  const unit = unitLabel(params.unitId, "it");
  const rows: [string, string][] = [
    ["Codice", code],
    ...(unit ? [["Alloggio", unit] as [string, string]] : []),
    ["Ospite", `${firstName} ${lastName}`],
    ["Email", email],
    ["Telefono", phone],
    ["Ospiti", String(guests)],
    ["Check-in", fmtDate(checkin)],
    ["Check-out", fmtDate(checkout)],
    ...(totalPrice ? [["Totale stimato", `€${totalPrice}`] as [string, string]] : []),
  ];
  await send({
    to: HOST_EMAIL,
    replyTo: email,
    subject: `Nuova richiesta di prenotazione · ${code}`,
    text: [
      `Codice: ${code}`, unit ? `Alloggio: ${unit}` : null, `Ospite: ${firstName} ${lastName}`, `Email: ${email}`,
      `Telefono: ${phone}`, `Ospiti: ${guests}`,
      `Check-in: ${fmtDate(checkin)}`, `Check-out: ${fmtDate(checkout)}`,
      totalPrice ? `Totale stimato: €${totalPrice}` : null,
      message ? `Messaggio: ${message}` : null,
      "", `Gestisci questa richiesta su: ${siteUrl()}/admin/bookings`,
    ].filter(Boolean).join("\n"),
    html: buildHtml(
      title("Nuova richiesta di prenotazione") +
      dataTable(rows) +
      (message ? divider() + smallPara("MESSAGGIO") + para(`"${message}"`, true) : "") +
      divider() +
      button("Gestisci la richiesta", `${siteUrl()}/admin/bookings`)
    ),
  });
}

// Notifica all'host quando arriva una nuova recensione da moderare: sempre in
// italiano, è uso interno. Non include l'email dell'autore nel corpo pubblico —
// resta un dato privato in admin.
export async function sendReviewNotification(params: {
  author: string;
  rating: number;
  body: string;
  verified: boolean;
  stayMonth?: string | null;
}) {
  const { author, rating, body, verified, stayMonth } = params;
  const rows: [string, string][] = [
    ["Autore", author],
    ["Voto", `${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating}/5)`],
    ...(stayMonth ? [["Soggiorno", stayMonth] as [string, string]] : []),
    ["Soggiorno verificato", verified ? "Sì" : "No"],
  ];
  await send({
    to: HOST_EMAIL,
    subject: `Nuova recensione da moderare · ${author}`,
    text: [
      `Autore: ${author}`,
      `Voto: ${rating}/5`,
      stayMonth ? `Soggiorno: ${stayMonth}` : null,
      `Verificata: ${verified ? "sì" : "no"}`,
      "",
      `"${body}"`,
      "",
      `Modera su: ${siteUrl()}/admin/recensioni`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: buildHtml(
      title("Nuova recensione da moderare") +
        dataTable(rows) +
        divider() +
        smallPara("TESTO") +
        para(`"${body}"`, true) +
        divider() +
        button("Modera la recensione", `${siteUrl()}/admin/recensioni`),
    ),
  });
}

// Notifica all'host quando un pagamento va a buon fine: sempre in italiano, è uso interno
// (testo diverso dalla conferma che riceve l'ospite).
export async function sendHostPaymentNotification(params: {
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  guests: number;
  checkin: string | Date;
  checkout: string | Date;
  totalPrice: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  paymentMethod: string;
  unitId?: string;
}) {
  const {
    code,
    firstName,
    lastName,
    email,
    guests,
    checkin,
    checkout,
    totalPrice,
    cityTax,
    cityTaxOnline,
    paymentMethod,
  } = params;
  // Modello nuovo: l'ospite paga l'INTERO importo del soggiorno online. La tassa di soggiorno,
  // se incassata online, è una voce separata già pagata; altrimenti si riscuote al check-in.
  const cityTaxLabel = cityTaxOnline
    ? "Tassa di soggiorno (inclusa nel pagamento)"
    : "Tassa di soggiorno (al check-in)";
  const paidTotal = totalPrice != null ? chargedAmount(totalPrice, cityTax ?? 0, !!cityTaxOnline) : null;
  const unit = unitLabel(params.unitId, "it");
  const rows: [string, string, ("normal"|"green"|"amber"|"gold")?][] = [
    ...(unit ? [["Alloggio", unit] as [string, string]] : []),
    ["Ospite", `${firstName} ${lastName}`],
    ["Email", email],
    ["Ospiti", String(guests)],
    ["Check-in", fmtDate(checkin)],
    ["Check-out", fmtDate(checkout)],
    ...(totalPrice != null ? [["Totale soggiorno", `€${totalPrice}`] as [string,string]] : []),
    ...(cityTax != null ? [[cityTaxLabel, `€${cityTax}`] as [string,string]] : []),
    ...(paidTotal != null ? [["Incassato online", `€${paidTotal}`, "green"] as [string, string, "green"]] : []),
    ["Metodo di pagamento", paymentMethod],
  ];
  await send({
    to: HOST_EMAIL,
    replyTo: email,
    subject: `Pagamento ricevuto · Prenotazione ${code}`,
    text: [
      `La prenotazione ${code} è stata pagata per intero.`,
      "", unit ? `Alloggio: ${unit}` : null, `Ospite: ${firstName} ${lastName}`, `Email: ${email}`,
      `Ospiti: ${guests}`, `Check-in: ${fmtDate(checkin)}`, `Check-out: ${fmtDate(checkout)}`,
      totalPrice != null ? `Totale soggiorno: €${totalPrice}` : null,
      cityTax != null ? (cityTaxOnline ? `Tassa di soggiorno inclusa nel pagamento online: €${cityTax}` : `Tassa di soggiorno da riscuotere al check-in: €${cityTax}`) : null,
      paidTotal != null ? `Incassato online: €${paidTotal}` : null,
      `Metodo di pagamento: ${paymentMethod}`,
      "", `Dettagli su: ${siteUrl()}/admin/bookings`,
    ].filter(Boolean).join("\n"),
    html: buildHtml(
      title("Pagamento ricevuto") +
      para(`La prenotazione ${bold(code)} è stata pagata per intero.`, true) +
      dataTable(rows) +
      divider() +
      button("Visualizza in admin", `${siteUrl()}/admin/bookings`)
    ),
  });
}

// Le seguenti email sono dirette al cliente: usano la lingua scelta in fase di richiesta.

export async function sendRejectionEmail(params: {
  to: string;
  code: string;
  reason: string;
  locale: LocaleCode;
  unitId?: string;
}) {
  const unit = unitLabel(params.unitId, params.locale);
  const { subject, text } = getEmailTemplates(params.locale).rejection({
    code: params.code,
    reason: params.reason,
  });
  const html = buildHtml(
    title("Prenotazione non disponibile") +
    accHtml(unit, params.locale) +
    para(`Gentile ospite,`) +
    para(`Siamo spiacenti di comunicarti che la tua richiesta di prenotazione (${bold(params.code)}) non può essere confermata.`) +
    (params.reason ? infoBox(smallPara(`${bold("Motivo:")} ${params.reason}`)) : "") +
    para("Se desideri verificare altre date, siamo a tua disposizione.", true) +
    divider() +
    smallPara(`<a href="mailto:${HOST_EMAIL}" style="color:#b8755f;">${HOST_EMAIL}</a> · ${HOST_PHONE}${WA_SUFFIX}`)
  );
  const finalText = (unit ? accText(unit, params.locale) + "\n\n" : "") + text;
  await send({ to: params.to, subject, text: finalText, html, replyTo: HOST_EMAIL });
}

export async function sendApprovalEmail(params: {
  to: string;
  code: string;
  unitId?: string;
  locale: LocaleCode;
  totalPrice: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  guests?: number;
  refundPolicy: string | null;
}) {
  const unit = unitLabel(params.unitId, params.locale);
  const payUrl = `${siteUrl()}/pay/${params.code}?t=${encodeURIComponent(generateAccessToken(params.code))}`;
  const manageUrl = `${siteUrl()}/gestione-prenotazione/${params.code}?t=${encodeURIComponent(generateAccessToken(params.code))}`;
  const { subject, text } = getEmailTemplates(params.locale).approval({
    code: params.code, payUrl, manageUrl,
    totalPrice: params.totalPrice, cityTax: params.cityTax,
    cityTaxOnline: params.cityTaxOnline, guests: params.guests,
    refundPolicy: params.refundPolicy,
  });
  // Modello nuovo: online = tassa già inclusa nel pagamento (voce separata); altrimenti al check-in.
  const cityTaxLabel = params.cityTaxOnline
    ? "Tassa di soggiorno (inclusa nel pagamento)"
    : "Tassa di soggiorno (al check-in)";
  const priceRows: [string, string][] = [
    ...(params.totalPrice != null ? [["Totale soggiorno", `€${params.totalPrice}`] as [string,string]] : []),
    ...(params.cityTax != null ? [[cityTaxLabel, `€${params.cityTax}`] as [string,string]] : []),
  ];
  const html = buildHtml(
    title("Prenotazione confermata") +
    accHtml(unit, params.locale) +
    para(`La tua richiesta ${bold(params.code)} è stata approvata.`) +
    (priceRows.length ? dataTable(priceRows) : "") +
    para(`Per confermare la prenotazione, versa l'intero importo nella pagina di pagamento.`, true) +
    button("Procedi al pagamento", payUrl) +
    linkButton("Gestisci la prenotazione", manageUrl)
  );
  const finalText = (unit ? accText(unit, params.locale) + "\n\n" : "") + text;
  await send({ to: params.to, subject, text: finalText, html, replyTo: HOST_EMAIL });
}

// Ricapitolazione check-in: prenotazione confermata SENZA pagamento online (opzione host
// "paga al check-in"). L'ospite riceve l'importo (soggiorno + tassa) da saldare all'arrivo.
export async function sendCheckinRecapEmail(params: {
  to: string;
  code: string;
  unitId?: string;
  locale: LocaleCode;
  firstName: string;
  checkin: string | Date;
  checkout: string | Date;
  totalPrice: number | null;
  cityTax: number | null;
  guests: number;
}) {
  const unit = unitLabel(params.unitId, params.locale);
  const manageUrl = `${siteUrl()}/gestione-prenotazione/${params.code}?t=${encodeURIComponent(generateAccessToken(params.code))}`;
  const { subject, text } = getEmailTemplates(params.locale).checkinRecap({
    code: params.code, firstName: params.firstName,
    checkin: fmtDate(params.checkin), checkout: fmtDate(params.checkout),
    totalPrice: params.totalPrice, cityTax: params.cityTax,
    guests: params.guests, manageUrl,
  });
  const totalAtCheckin = params.totalPrice != null ? params.totalPrice + (params.cityTax ?? 0) : null;
  const rows: [string, string][] = [
    ["Check-in", fmtDate(params.checkin)],
    ["Check-out", fmtDate(params.checkout)],
    ["Ospiti", String(params.guests)],
    ...(params.totalPrice != null ? [["Soggiorno (al check-in)", `€${params.totalPrice}`] as [string,string]] : []),
    ...(params.cityTax != null && params.cityTax > 0 ? [["Tassa di soggiorno (al check-in)", `€${params.cityTax}`] as [string,string]] : []),
    ...(totalAtCheckin != null ? [["Totale da saldare al check-in", `€${totalAtCheckin}`] as [string,string]] : []),
  ];
  const html = buildHtml(
    title("Prenotazione confermata") +
    accHtml(unit, params.locale) +
    para(`Ciao ${bold(params.firstName)}, la tua prenotazione ${bold(params.code)} è confermata. Non è previsto alcun pagamento online: salderai l'importo direttamente al check-in.`) +
    dataTable(rows) +
    linkButton("Gestisci la prenotazione", manageUrl) +
    divider() +
    smallPara("Check-in a partire dalle ore 14:00 · Check-out entro le ore 10:00") +
    smallPara("Ti chiediamo di comunicarci l'orario previsto di arrivo rispondendo a questa email.")
  );
  const finalText = (unit ? accText(unit, params.locale) + "\n\n" : "") + text;
  await send({ to: params.to, subject, text: finalText, html, replyTo: HOST_EMAIL });
}

export async function sendPaymentConfirmationEmail(params: {
  to: string;
  code: string;
  unitId?: string;
  firstName: string;
  lastName: string;
  checkin: string | Date;
  checkout: string | Date;
  totalPrice: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  guests: number;
  paymentMethod: string;
  refundPolicy: string | null;
  locale: LocaleCode;
}) {
  const unit = unitLabel(params.unitId, params.locale);
  const token = generateAccessToken(params.code);
  const confirmationUrl = `${siteUrl()}/confirmation/${params.code}?t=${encodeURIComponent(token)}`;
  const manageUrl = `${siteUrl()}/gestione-prenotazione/${params.code}?t=${encodeURIComponent(token)}`;
  const { subject, text } = getEmailTemplates(params.locale).paymentConfirmation({
    code: params.code, firstName: params.firstName, lastName: params.lastName,
    checkin: fmtDate(params.checkin), checkout: fmtDate(params.checkout),
    totalPrice: params.totalPrice, cityTax: params.cityTax,
    cityTaxOnline: params.cityTaxOnline,
    guests: params.guests, paymentMethod: params.paymentMethod,
    refundPolicy: params.refundPolicy,
    confirmationUrl, manageUrl,
  });
  // Modello nuovo: si paga l'INTERO importo del soggiorno; la tassa di soggiorno online è una
  // voce separata già inclusa nell'incasso, altrimenti resta da riscuotere al check-in.
  const cityTaxLabel = params.cityTaxOnline
    ? "Tassa di soggiorno (inclusa nel pagamento)"
    : "Tassa di soggiorno (al check-in)";
  const paidTotal = params.totalPrice != null
    ? chargedAmount(params.totalPrice, params.cityTax ?? 0, !!params.cityTaxOnline)
    : null;
  const rows: [string, string][] = [
    ["Check-in", fmtDate(params.checkin)],
    ["Check-out", fmtDate(params.checkout)],
    ["Ospiti", String(params.guests)],
    ...(params.totalPrice != null ? [["Totale soggiorno", `€${params.totalPrice}`] as [string,string]] : []),
    ...(params.cityTax != null ? [[cityTaxLabel, `€${params.cityTax}`] as [string,string]] : []),
    ...(paidTotal != null ? [["Totale pagato", `€${paidTotal}`] as [string,string]] : []),
    ["Metodo di pagamento", params.paymentMethod],
  ];
  const html = buildHtml(
    title("Pagamento confermato") +
    accHtml(unit, params.locale) +
    para(`Ciao ${bold(params.firstName)}, il tuo pagamento è stato ricevuto con successo.`) +
    dataTable(rows) +
    button("Visualizza conferma e ricevuta", confirmationUrl) +
    linkButton("Gestisci la prenotazione", manageUrl) +
    divider() +
    smallPara("Check-in a partire dalle ore 14:00 · Check-out entro le ore 10:00") +
    smallPara("Ti chiediamo di comunicarci l'orario previsto di arrivo rispondendo a questa email.")
  );
  const finalText = (unit ? accText(unit, params.locale) + "\n\n" : "") + text;
  await send({ to: params.to, subject, text: finalText, html, replyTo: HOST_EMAIL });
}

export async function sendBookingRequestAutoReply(params: {
  to: string;
  code: string;
  firstName: string;
  checkin: string | Date;
  checkout: string | Date;
  locale: LocaleCode;
  unitId?: string;
}) {
  const { to, code, firstName, checkin, checkout, locale } = params;
  const unit = unitLabel(params.unitId, locale);
  const s = getExtraEmailStrings(locale);
  const ci = fmtDate(checkin);
  const co = fmtDate(checkout);
  const bodyText = s.autoReplyBody(firstName, code, ci, co);
  // Converti testo in HTML: doppio a-capo → paragrafo, singolo → <br>
  const bodyHtml = bodyText
    .split(/\n\n+/)
    .map((block) => para(block.replace(/\n/g, "<br />")))
    .join("");
  const html = buildHtml(
    title(s.autoReplySubject(code)) +
    accHtml(unit, locale) +
    bodyHtml +
    divider() +
    smallPara(`<a href="mailto:${HOST_EMAIL}" style="color:#b8755f;">${HOST_EMAIL}</a> · ${HOST_PHONE}${WA_SUFFIX}`)
  );
  await send({
    to, replyTo: HOST_EMAIL,
    subject: s.autoReplySubject(code),
    text: (unit ? accText(unit, locale) + "\n\n" : "") + s.autoReplyBody(firstName, code, ci, co) + "\n\n" + s.autoReplyFooter,
    html,
  });
}

export async function sendGuestCancellationEmail(params: {
  to: string;
  code: string;
  unitId?: string;
  firstName: string;
  checkin: string | Date;
  checkout: string | Date;
  wasPaid: boolean;
  quote: RefundQuote;
  policy: RefundPolicy;
  locale: LocaleCode;
}) {
  const { to, code, firstName, checkin, checkout, quote, locale } = params;
  const unit = unitLabel(params.unitId, locale);
  const s = getExtraEmailStrings(locale);
  const ci = fmtDate(checkin);
  const co = fmtDate(checkout);
  const fee = franchisePct();
  // Esito sulla quota SOGGIORNO: pieno (con franchigia già detratta) / parziale 50% / nulla.
  const stayLine =
    quote.kind === "full" ? s.cancelRefundFull(quote.stayRefund.toFixed(2), fee)
    : quote.kind === "partial" ? s.cancelRefundPartial(quote.stayRefund.toFixed(2))
    : s.cancelNoRefund;
  // La tassa di soggiorno incassata online è sempre rimborsata a parte al 100%.
  const cityTaxLine = quote.cityTaxRefund > 0 ? s.cancelCityTaxRefund(quote.cityTaxRefund.toFixed(2)) : null;
  const refundHtml = infoBox(
    para(stayLine) +
    (cityTaxLine ? smallPara(cityTaxLine) : "")
  );
  const html = buildHtml(
    title(s.cancelSubject(code)) +
    accHtml(unit, locale) +
    para(s.cancelBody(firstName, code, ci, co).replace(/\n/g, "<br>")) +
    refundHtml +
    divider() +
    smallPara(`<a href="mailto:${HOST_EMAIL}" style="color:#b8755f;">${HOST_EMAIL}</a>`)
  );
  await send({
    to, replyTo: HOST_EMAIL,
    subject: s.cancelSubject(code),
    text: [unit ? accText(unit, locale) : null, unit ? "" : null, s.cancelBody(firstName, code, ci, co), "", stayLine, cityTaxLine, "", s.cancelFooter, "", s.houseName].filter((l) => l !== null).join("\n"),
    html,
  });
}

export async function sendHostCancellationNotification(params: {
  code: string;
  unitId?: string;
  firstName: string;
  lastName: string;
  email: string;
  checkin: string | Date;
  checkout: string | Date;
  wasPaid: boolean;
  byHost: boolean;
  quote: RefundQuote;
  stripePaymentIntentId: string | null;
}) {
  const { code, firstName, lastName, email, checkin, checkout, wasPaid, byHost, quote, stripePaymentIntentId } = params;
  const unit = unitLabel(params.unitId, "it");
  const refundEligible = quote.amount > 0;
  // Dettaglio del rimborso da eseguire a mano su Stripe: quota soggiorno (dopo livello/franchigia)
  // + tassa di soggiorno (sempre 100% se incassata online).
  const refundRows: [string, string][] = [
    ...(quote.stayRefund > 0 ? [["Rimborso soggiorno", `€${quote.stayRefund.toFixed(2)}`] as [string,string]] : []),
    ...(quote.franchise > 0 ? [["Franchigia trattenuta", `€${quote.franchise.toFixed(2)}`] as [string,string]] : []),
    ...(quote.cityTaxRefund > 0 ? [["Rimborso tassa di soggiorno", `€${quote.cityTaxRefund.toFixed(2)}`] as [string,string]] : []),
    ["Totale da rimborsare", `€${quote.amount.toFixed(2)}`],
    ...(stripePaymentIntentId ? [["Payment Intent", stripePaymentIntentId] as [string,string]] : []),
  ];
  const noRefundNote = wasPaid
    ? "Nessun rimborso dovuto secondo la politica di cancellazione della prenotazione."
    : "Nessun rimborso dovuto (nulla è stato incassato online).";
  const refundTextLines = refundEligible
    ? [
        `Rimborso da effettuare manualmente su Stripe:`,
        quote.stayRefund > 0 ? `  Rimborso soggiorno: €${quote.stayRefund.toFixed(2)}` : null,
        quote.franchise > 0 ? `  Franchigia trattenuta: €${quote.franchise.toFixed(2)}` : null,
        quote.cityTaxRefund > 0 ? `  Rimborso tassa di soggiorno: €${quote.cityTaxRefund.toFixed(2)}` : null,
        `  Totale da rimborsare: €${quote.amount.toFixed(2)}`,
        stripePaymentIntentId ? `  Payment Intent: ${stripePaymentIntentId}` : `  (cerca il pagamento su Stripe per codice prenotazione)`,
        ``,
        `Come rimborsare: Stripe Dashboard → Pagamenti → cerca ${code} → Rimborsa → inserisci €${quote.amount.toFixed(2)}`,
      ].filter((l) => l !== null)
    : [noRefundNote];
  const refundBox = refundEligible
    ? infoBox(
        para(`${bold("Rimborso da effettuare manualmente su Stripe")}`) +
        dataTable(refundRows) +
        smallPara(`Stripe Dashboard → Pagamenti → cerca ${bold(code)} → Rimborsa → inserisci ${bold(`€${quote.amount.toFixed(2)}`)}`)
      )
    : infoBox(smallPara(noRefundNote));
  const cancelledBy = byHost ? "dalla struttura" : "dall'ospite";
  const html = buildHtml(
    title(`Prenotazione annullata ${cancelledBy}`) +
    dataTable([...(unit ? [["Alloggio", unit] as [string, string]] : []), ["Ospite", `${firstName} ${lastName}`], ["Email", email], ["Check-in", fmtDate(checkin)], ["Check-out", fmtDate(checkout)]]) +
    refundBox +
    divider() +
    button("Vai all'admin", `${siteUrl()}/admin/bookings`)
  );
  await send({
    to: HOST_EMAIL, replyTo: email,
    subject: `Prenotazione annullata ${cancelledBy} · ${code}`,
    text: [`La prenotazione ${code} (${firstName} ${lastName}) è stata annullata ${cancelledBy}.`, "", unit ? `Alloggio: ${unit}` : null, `Email: ${email}`, `Check-in: ${fmtDate(checkin)}`, `Check-out: ${fmtDate(checkout)}`, "", ...refundTextLines, "", `Dettagli su: ${siteUrl()}/admin/bookings`].filter((l) => l !== null).join("\n"),
    html,
  });
}

// Alert all'host quando Stripe incassa un pagamento (anticipo o saldo) per una prenotazione
// che nel frattempo risulta ANNULLATA (race di cancellazione o sessione di checkout "stale").
// Il denaro è stato catturato ma non è associato a nessuna prenotazione attiva: l'host valuta
// un rimborso manuale. Nessun rimborso automatico (scelta operatore).
export async function sendHostOrphanPaymentAlert(params: {
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  amount: number | null;
  paymentIntentId: string | null;
}) {
  const { code, firstName, lastName, email, amount, paymentIntentId } = params;
  const amountStr = amount != null ? `€${amount.toFixed(2)}` : "(vedi Stripe)";
  const html = buildHtml(
    title("⚠️ Pagamento su prenotazione ANNULLATA") +
    para(`È arrivato un pagamento per la prenotazione ${bold(code)}, che risulta ${bold("annullata")}. Stripe ha incassato l'importo ma non è associato a nessuna prenotazione attiva: valuta un rimborso manuale.`) +
    dataTable([
      ["Ospite", `${firstName} ${lastName}`],
      ["Email", email],
      ["Importo incassato", amountStr],
      ...(paymentIntentId ? [["Payment Intent", paymentIntentId] as [string, string]] : []),
    ]) +
    infoBox(smallPara(`Per rimborsare: Stripe Dashboard → Pagamenti → cerca ${bold(paymentIntentId ?? code)} → Rimborsa.`)) +
    divider() +
    button("Vai all'admin", `${siteUrl()}/admin/bookings`)
  );
  await send({
    to: HOST_EMAIL,
    replyTo: email,
    subject: `⚠️ Pagamento su prenotazione annullata · ${code}`,
    text: [
      `Pagamento ricevuto per la prenotazione ANNULLATA ${code}.`,
      "",
      `Ospite: ${firstName} ${lastName}`,
      `Email: ${email}`,
      `Importo incassato: ${amountStr}`,
      paymentIntentId ? `Payment Intent: ${paymentIntentId}` : `(cerca su Stripe per codice ${code})`,
      "",
      `Valuta un rimborso manuale: Stripe Dashboard → Pagamenti → Rimborsa.`,
      "",
      `Admin: ${siteUrl()}/admin/bookings`,
    ].join("\n"),
    html,
  });
}

export async function sendManagementLinkEmail(params: {
  to: string;
  code: string;
  firstName: string;
  locale: LocaleCode;
  unitId?: string;
}) {
  const { to, code, firstName, locale } = params;
  const unit = unitLabel(params.unitId, locale);
  const s = getExtraEmailStrings(locale);
  const token = generateManagementToken(code);
  const manageUrl = `${siteUrl()}/gestione-prenotazione/${code}?t=${encodeURIComponent(token)}`;
  const html = buildHtml(
    title(s.manageLinkSubject(code)) +
    accHtml(unit, locale) +
    para(s.manageLinkBody(firstName, code).replace(/\n/g, "<br>")) +
    button(s.manageLinkExpiry, manageUrl) +
    divider() +
    smallPara(s.manageLinkExpiry) +
    smallPara(s.manageLinkDisclaimer)
  );
  await send({
    to, replyTo: HOST_EMAIL,
    subject: s.manageLinkSubject(code),
    text: [unit ? accText(unit, locale) : null, unit ? "" : null, s.manageLinkBody(firstName, code), "", manageUrl, "", s.manageLinkExpiry, "", s.manageLinkDisclaimer, "", s.houseName, `${HOST_EMAIL} · ${HOST_PHONE}`].filter((l) => l !== null).join("\n"),
    html,
  });
}

// Email post-soggiorno che invita l'ospite a lasciare una recensione. Il link porta a
// /recensioni/scrivi con codice + token firmato: la pagina precompila il codice prenotazione
// e l'API marca la recensione come "soggiorno verificato" senza richiedere di nuovo l'email.
export async function sendReviewRequestEmail(params: {
  to: string;
  code: string;
  firstName: string;
  reviewUrl: string;
  locale: LocaleCode;
}) {
  const { to, code, firstName, reviewUrl, locale } = params;
  const s = getExtraEmailStrings(locale);
  const html = buildHtml(
    title(s.reviewRequestSubject(code)) +
    para(s.reviewRequestBody(firstName).replace(/\n/g, "<br>")) +
    button(s.reviewRequestButton, reviewUrl) +
    divider() +
    smallPara(`<a href="mailto:${HOST_EMAIL}" style="color:#b8755f;">${HOST_EMAIL}</a> · ${HOST_PHONE}${WA_SUFFIX}`)
  );
  await send({
    to,
    replyTo: HOST_EMAIL,
    subject: s.reviewRequestSubject(code),
    text: [s.reviewRequestBody(firstName), "", reviewUrl, "", s.houseName, `${HOST_EMAIL} · ${HOST_PHONE}`].join("\n"),
    html,
  });
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
}

function fmtDate(d: string | Date): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  // pg may return ISO strings with time component — keep only the date part
  return String(d).slice(0, 10);
}
