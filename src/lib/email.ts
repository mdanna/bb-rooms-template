import { Resend } from "resend";
import type { LocaleCode } from "@/i18n/index";
import { getEmailTemplates, getExtraEmailStrings } from "./emailTemplates";
import { generateAccessToken, generateManagementToken } from "./accessToken";
import {
  buildHtml, title, para, smallPara, divider, bold, dataTable,
  button, linkButton, infoBox,
} from "./emailHtml";

import { CONTENT } from "./siteContent";
import { POLICIES, } from "./policies";
import { MIN_DEPOSIT_RATE } from "./pricing";

const resend = new Resend(process.env.RESEND_API_KEY);

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
const FROM = `${CONTENT.siteTitle.it} <${MAIL_FROM_ADDRESS || CONTENT.bookingEmail}>`;
const HOST_EMAIL = CONTENT.email;
const HOST_PHONE = CONTENT.phone;

async function send(payload: { to: string; subject: string; text: string; html?: string; replyTo?: string }) {
  const { replyTo, subject, ...rest } = payload;
  const finalSubject = MODEL_D ? `${CONTENT.siteTitle.it} · ${subject}` : subject;
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
}) {
  const { code, firstName, lastName, email, phone, guests, checkin, checkout, totalPrice, message } =
    params;
  const rows: [string, string][] = [
    ["Codice", code],
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
      `Codice: ${code}`, `Ospite: ${firstName} ${lastName}`, `Email: ${email}`,
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
  depositAmount: number | null;
  balanceDue: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  paymentMethod: string;
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
    depositAmount,
    balanceDue,
    cityTax,
    cityTaxOnline,
    paymentMethod,
  } = params;
  // Opzione A: se la tassa è stata incassata online (voce separata dell'anticipo) la mostriamo
  // come già pagata; altrimenti resta da riscuotere al check-in (comportamento storico).
  const cityTaxLabel = cityTaxOnline
    ? "Tassa di soggiorno (inclusa nel pagamento)"
    : "Tassa di soggiorno (al check-in)";
  const balanceRow: [string, string, "amber"?][] = balanceDue != null && balanceDue > 0
    ? [["Saldo da incassare (entro 2 gg dal check-in)", `€${balanceDue}`, "amber"]]
    : balanceDue === 0 ? [["Pagamento", "Completo ✓"]] : [];
  const rows: [string, string, ("normal"|"green"|"amber"|"gold")?][] = [
    ["Ospite", `${firstName} ${lastName}`],
    ["Email", email],
    ["Ospiti", String(guests)],
    ["Check-in", fmtDate(checkin)],
    ["Check-out", fmtDate(checkout)],
    ...(totalPrice ? [["Totale soggiorno", `€${totalPrice}`] as [string,string]] : []),
    ...(depositAmount ? [["Anticipo incassato", `€${depositAmount}`] as [string,string]] : []),
    ...balanceRow,
    ...(cityTax != null ? [[cityTaxLabel, `€${cityTax}`] as [string,string]] : []),
    ["Metodo di pagamento", paymentMethod],
  ];
  await send({
    to: HOST_EMAIL,
    replyTo: email,
    subject: `Pagamento anticipo ricevuto · Prenotazione ${code}`,
    text: [
      `L'anticipo per la prenotazione ${code} è stata pagata.`,
      "", `Ospite: ${firstName} ${lastName}`, `Email: ${email}`,
      `Ospiti: ${guests}`, `Check-in: ${fmtDate(checkin)}`, `Check-out: ${fmtDate(checkout)}`,
      totalPrice ? `Totale soggiorno: €${totalPrice}` : null,
      depositAmount ? `Anticipo incassato ora: €${depositAmount}` : null,
      balanceDue != null && balanceDue > 0 ? `Saldo da incassare entro ${POLICIES.balanceDueDays} giorni dal check-in: €${balanceDue}` : balanceDue === 0 ? `Pagamento completo — nessun saldo residuo` : null,
      cityTax != null ? (cityTaxOnline ? `Tassa di soggiorno inclusa nel pagamento online: €${cityTax}` : `Tassa di soggiorno da riscuotere al check-in: €${cityTax}`) : null,
      `Metodo di pagamento: ${paymentMethod}`,
      "", `Dettagli su: ${siteUrl()}/admin/bookings`,
    ].filter(Boolean).join("\n"),
    html: buildHtml(
      title("Pagamento anticipo ricevuto") +
      para(`La prenotazione ${bold(code)} è stata pagata.`, true) +
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
}) {
  const { subject, text } = getEmailTemplates(params.locale).rejection({
    code: params.code,
    reason: params.reason,
  });
  const html = buildHtml(
    title("Prenotazione non disponibile") +
    para(`Gentile ospite,`) +
    para(`Siamo spiacenti di comunicarti che la tua richiesta di prenotazione (${bold(params.code)}) non può essere confermata.`) +
    (params.reason ? infoBox(smallPara(`${bold("Motivo:")} ${params.reason}`)) : "") +
    para("Se desideri verificare altre date, siamo a tua disposizione.", true) +
    divider() +
    smallPara(`<a href="mailto:${HOST_EMAIL}" style="color:#b8755f;">${HOST_EMAIL}</a> · ${HOST_PHONE}`)
  );
  await send({ to: params.to, subject, text, html, replyTo: HOST_EMAIL });
}

export async function sendApprovalEmail(params: {
  to: string;
  code: string;
  locale: LocaleCode;
  totalPrice: number | null;
  depositAmount: number | null;
  balanceDue: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  guests?: number;
}) {
  const payUrl = `${siteUrl()}/pay/${params.code}?t=${encodeURIComponent(generateAccessToken(params.code))}`;
  const manageUrl = `${siteUrl()}/gestione-prenotazione/${params.code}?t=${encodeURIComponent(generateAccessToken(params.code))}`;
  const { subject, text } = getEmailTemplates(params.locale).approval({
    code: params.code, payUrl, manageUrl,
    totalPrice: params.totalPrice, depositAmount: params.depositAmount,
    balanceDue: params.balanceDue, cityTax: params.cityTax,
    cityTaxOnline: params.cityTaxOnline, guests: params.guests,
  });
  // Opzione A: online = tassa già inclusa nel pagamento (voce separata); altrimenti al check-in.
  const cityTaxLabel = params.cityTaxOnline
    ? "Tassa di soggiorno (inclusa nel pagamento)"
    : "Tassa di soggiorno (al check-in)";
  const priceRows: [string, string][] = [
    ...(params.totalPrice != null ? [["Totale soggiorno", `€${params.totalPrice}`] as [string,string]] : []),
    ...(params.cityTax != null ? [[cityTaxLabel, `€${params.cityTax}`] as [string,string]] : []),
  ];
  const html = buildHtml(
    title("Prenotazione confermata") +
    para(`La tua richiesta ${bold(params.code)} è stata approvata.`) +
    (priceRows.length ? dataTable(priceRows) : "") +
    para(`Scegli l'importo dell'anticipo (minimo ${Math.round(MIN_DEPOSIT_RATE * 100)}%) nella pagina di pagamento.`, true) +
    button("Procedi al pagamento", payUrl) +
    linkButton("Gestisci la prenotazione", manageUrl)
  );
  await send({ to: params.to, subject, text, html, replyTo: HOST_EMAIL });
}

export async function sendPaymentConfirmationEmail(params: {
  to: string;
  code: string;
  firstName: string;
  lastName: string;
  checkin: string | Date;
  checkout: string | Date;
  totalPrice: number | null;
  depositAmount: number | null;
  balanceDue: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  guests: number;
  paymentMethod: string;
  locale: LocaleCode;
}) {
  const token = generateAccessToken(params.code);
  const confirmationUrl = `${siteUrl()}/confirmation/${params.code}?t=${encodeURIComponent(token)}`;
  const manageUrl = `${siteUrl()}/gestione-prenotazione/${params.code}?t=${encodeURIComponent(token)}`;
  const { subject, text } = getEmailTemplates(params.locale).paymentConfirmation({
    code: params.code, firstName: params.firstName, lastName: params.lastName,
    checkin: fmtDate(params.checkin), checkout: fmtDate(params.checkout),
    totalPrice: params.totalPrice, depositAmount: params.depositAmount,
    balanceDue: params.balanceDue, cityTax: params.cityTax,
    cityTaxOnline: params.cityTaxOnline,
    guests: params.guests, paymentMethod: params.paymentMethod,
    confirmationUrl, manageUrl,
  });
  const isFullPayment = !params.balanceDue || Number(params.balanceDue) === 0;
  // Opzione A: online = tassa già inclusa nel pagamento (voce separata); altrimenti al check-in.
  const cityTaxLabel = params.cityTaxOnline
    ? "Tassa di soggiorno (inclusa nel pagamento)"
    : "Tassa di soggiorno (al check-in)";
  const rows: [string, string][] = [
    ["Check-in", fmtDate(params.checkin)],
    ["Check-out", fmtDate(params.checkout)],
    ["Ospiti", String(params.guests)],
    ...(params.totalPrice != null ? [["Totale soggiorno", `€${params.totalPrice}`] as [string,string]] : []),
    [isFullPayment ? "Totale pagato" : "Anticipo pagato", `€${params.depositAmount}`],
    ...(params.balanceDue && Number(params.balanceDue) > 0 ? [["Saldo (entro 2 gg dal check-in)", `€${params.balanceDue}`] as [string,string]] : []),
    ...(params.cityTax != null ? [[cityTaxLabel, `€${params.cityTax}`] as [string,string]] : []),
    ["Metodo di pagamento", params.paymentMethod],
  ];
  const html = buildHtml(
    title("Pagamento confermato") +
    para(`Ciao ${bold(params.firstName)}, il tuo pagamento è stato ricevuto con successo.`) +
    dataTable(rows) +
    button("Visualizza conferma e ricevuta", confirmationUrl) +
    linkButton("Gestisci la prenotazione", manageUrl) +
    divider() +
    smallPara("Check-in a partire dalle ore 14:00 · Check-out entro le ore 10:00") +
    smallPara("Ti chiediamo di comunicarci l'orario previsto di arrivo rispondendo a questa email.")
  );
  await send({ to: params.to, subject, text, html, replyTo: HOST_EMAIL });
}

export async function sendBookingRequestAutoReply(params: {
  to: string;
  code: string;
  firstName: string;
  checkin: string | Date;
  checkout: string | Date;
  locale: LocaleCode;
}) {
  const { to, code, firstName, checkin, checkout, locale } = params;
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
    bodyHtml +
    divider() +
    smallPara(`<a href="mailto:${HOST_EMAIL}" style="color:#b8755f;">${HOST_EMAIL}</a> · ${HOST_PHONE}`)
  );
  await send({
    to, replyTo: HOST_EMAIL,
    subject: s.autoReplySubject(code),
    text: s.autoReplyBody(firstName, code, ci, co) + "\n\n" + s.autoReplyFooter,
    html,
  });
}

export async function sendGuestCancellationEmail(params: {
  to: string;
  code: string;
  firstName: string;
  checkin: string | Date;
  checkout: string | Date;
  wasPaid: boolean;
  refundEligible: boolean;
  refundAmount: number;
  feePercent: number;
  locale: LocaleCode;
}) {
  const { to, code, firstName, checkin, checkout, wasPaid, refundEligible, refundAmount, feePercent, locale } = params;
  const s = getExtraEmailStrings(locale);
  const ci = fmtDate(checkin);
  const co = fmtDate(checkout);
  const refundLine = refundEligible
    ? s.cancelRefundEligible(refundAmount.toFixed(2), feePercent)
    : wasPaid ? s.cancelNoRefundLate : s.cancelNoRefundNoDeposit;
  const refundHtml = refundEligible
    ? infoBox(
        para(`${bold(`€${refundAmount.toFixed(2)}`)}`) +
        smallPara(s.cancelRefundFeeNote(feePercent))
      )
    : infoBox(smallPara(wasPaid ? s.cancelNoRefundLate : s.cancelNoRefundNoDeposit));
  const html = buildHtml(
    title(s.cancelSubject(code)) +
    para(s.cancelBody(firstName, code, ci, co).replace(/\n/g, "<br>")) +
    refundHtml +
    divider() +
    smallPara(`<a href="mailto:${HOST_EMAIL}" style="color:#b8755f;">${HOST_EMAIL}</a>`)
  );
  await send({
    to, replyTo: HOST_EMAIL,
    subject: s.cancelSubject(code),
    text: [s.cancelBody(firstName, code, ci, co), "", refundLine, "", s.cancelFooter, "", s.houseName].join("\n"),
    html,
  });
}

export async function sendHostCancellationNotification(params: {
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  checkin: string | Date;
  checkout: string | Date;
  wasPaid: boolean;
  refundEligible: boolean;
  depositAmount: number;
  refundAmount: number;
  feePercent: number;
  stripePaymentIntentId: string | null;
}) {
  const { code, firstName, lastName, email, checkin, checkout, wasPaid, refundEligible,
    depositAmount, refundAmount, feePercent, stripePaymentIntentId } = params;
  const refundTextLines = refundEligible
    ? [`Rimborso da effettuare manualmente su Stripe:`, `  Importo pagato: €${depositAmount.toFixed(2)}`, `  Trattenuta ${feePercent}%: €${(depositAmount - refundAmount).toFixed(2)}`, `  Importo da rimborsare: €${refundAmount.toFixed(2)}`, stripePaymentIntentId ? `  Payment Intent: ${stripePaymentIntentId}` : `  (cerca il pagamento su Stripe per codice prenotazione)`, ``, `Come rimborsare: Stripe Dashboard → Pagamenti → cerca ${code} → Rimborsa → inserisci €${refundAmount.toFixed(2)}`]
    : wasPaid ? [`Nessun rimborso dovuto (cancellazione nelle ultime 48 ore).`] : [`Nessun rimborso dovuto (anticipo non ancora versata).`];
  const refundBox = refundEligible
    ? infoBox(
        para(`${bold("Rimborso da effettuare manualmente su Stripe")}`) +
        dataTable([
          ["Importo pagato", `€${depositAmount.toFixed(2)}`],
          [`Trattenuta ${feePercent}%`, `€${(depositAmount - refundAmount).toFixed(2)}`],
          ["Da rimborsare", `€${refundAmount.toFixed(2)}`],
          ...(stripePaymentIntentId ? [["Payment Intent", stripePaymentIntentId] as [string,string]] : []),
        ]) +
        smallPara(`Stripe Dashboard → Pagamenti → cerca ${bold(code)} → Rimborsa → inserisci ${bold(`€${refundAmount.toFixed(2)}`)}`)
      )
    : infoBox(smallPara(wasPaid ? "Nessun rimborso dovuto (cancellazione nelle ultime 48 ore)." : "Nessun rimborso dovuto (anticipo non ancora versata)."));
  const html = buildHtml(
    title("Prenotazione annullata dall'ospite") +
    dataTable([["Ospite", `${firstName} ${lastName}`], ["Email", email], ["Check-in", fmtDate(checkin)], ["Check-out", fmtDate(checkout)]]) +
    refundBox +
    divider() +
    button("Vai all'admin", `${siteUrl()}/admin/bookings`)
  );
  await send({
    to: HOST_EMAIL, replyTo: email,
    subject: `Prenotazione annullata dall'ospite · ${code}`,
    text: [`L'ospite ${firstName} ${lastName} ha annullato la prenotazione ${code}.`, "", `Email: ${email}`, `Check-in: ${fmtDate(checkin)}`, `Check-out: ${fmtDate(checkout)}`, "", ...refundTextLines, "", `Dettagli su: ${siteUrl()}/admin/bookings`].join("\n"),
    html,
  });
}

export async function sendManagementLinkEmail(params: {
  to: string;
  code: string;
  firstName: string;
  locale: LocaleCode;
}) {
  const { to, code, firstName, locale } = params;
  const s = getExtraEmailStrings(locale);
  const token = generateManagementToken(code);
  const manageUrl = `${siteUrl()}/gestione-prenotazione/${code}?t=${encodeURIComponent(token)}`;
  const html = buildHtml(
    title(s.manageLinkSubject(code)) +
    para(s.manageLinkBody(firstName, code).replace(/\n/g, "<br>")) +
    button(s.manageLinkExpiry, manageUrl) +
    divider() +
    smallPara(s.manageLinkExpiry) +
    smallPara(s.manageLinkDisclaimer)
  );
  await send({
    to, replyTo: HOST_EMAIL,
    subject: s.manageLinkSubject(code),
    text: [s.manageLinkBody(firstName, code), "", manageUrl, "", s.manageLinkExpiry, "", s.manageLinkDisclaimer, "", s.houseName, `${HOST_EMAIL} · ${HOST_PHONE}`].join("\n"),
    html,
  });
}

export async function sendBalanceReminderEmail(params: {
  to: string;
  code: string;
  firstName: string;
  checkin: string | Date;
  checkout: string | Date;
  balanceDue: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  payBalanceUrl: string;
  locale: LocaleCode;
}) {
  const { to, code, firstName, checkin, checkout, balanceDue, cityTax, cityTaxOnline, payBalanceUrl, locale } = params;
  const s = getExtraEmailStrings(locale);
  const ci = fmtDate(checkin);
  const co = fmtDate(checkout);
  const balanceStr = balanceDue != null && balanceDue > 0 ? `€${balanceDue}` : null;
  // Opzione A: se la tassa è già stata incassata online (con l'acconto) NON va ricordata nel
  // promemoria del saldo — comparirebbe come "da riscuotere al check-in", cosa ormai errata.
  const showCityTax = cityTax != null && cityTax > 0 && !cityTaxOnline;
  const html = buildHtml(
    title(s.balanceReminderSubject(code)) +
    para(s.balanceReminderBody(firstName, code, ci)) +
    infoBox(
      para(balanceStr ? s.balanceReminderAmount(balanceStr) : s.balanceReminderNoDue) +
      (showCityTax ? smallPara(s.balanceReminderCityTax(String(cityTax))) : "")
    ) +
    button(s.balanceReminderButton, payBalanceUrl) +
    divider() +
    smallPara(s.balanceReminderAlternative) +
    smallPara(`<a href="mailto:${HOST_EMAIL}" style="color:#b8755f;">${HOST_EMAIL}</a> · +39 335 7573294`)
  );
  const textLines = [
    s.balanceReminderBody(firstName, code, ci), "",
    balanceStr ? s.balanceReminderAmount(balanceStr) : s.balanceReminderNoDue, "",
    payBalanceUrl, "",
    s.balanceReminderAlternative,
    showCityTax ? s.balanceReminderCityTax(String(cityTax)) : null,
    "", `${HOST_EMAIL} · +39 335 7573294`, "",
    s.houseName,
    `Check-in: ${ci} · Check-out: ${co}`,
  ];
  await send({
    to, replyTo: HOST_EMAIL,
    subject: s.balanceReminderSubject(code),
    text: textLines.filter(Boolean).join("\n"),
    html,
  });
}

export async function sendBalanceReceiptEmail(params: {
  to: string;
  code: string;
  firstName: string;
  lastName: string;
  checkin: string | Date;
  checkout: string | Date;
  totalPrice: number | null;
  balanceDue: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  guests: number;
  locale: LocaleCode;
}) {
  const { to, code, firstName, lastName, checkin, checkout, totalPrice, balanceDue, cityTax, cityTaxOnline, guests, locale } = params;
  const s = getExtraEmailStrings(locale);
  const token = generateAccessToken(code);
  const receiptUrl = `${siteUrl()}/api/bookings/${code}/receipt?t=${encodeURIComponent(token)}`;
  const manageUrl = `${siteUrl()}/gestione-prenotazione/${code}?t=${encodeURIComponent(token)}`;
  // Opzione A: la tassa di soggiorno online è stata incassata con l'acconto, NON con il saldo,
  // quindi non va ripetuta nella ricevuta del saldo. Per le prenotazioni vecchie resta invariata.
  const showCityTax = cityTax != null && !cityTaxOnline;
  const rows: [string, string][] = [
    [s.balanceReceiptCheckin, fmtDate(checkin)],
    [s.balanceReceiptCheckout, fmtDate(checkout)],
    ...(totalPrice != null ? [[s.balanceReceiptTotalStay, `€${totalPrice}`] as [string,string]] : []),
    ...(balanceDue != null ? [[s.balanceReceiptBalancePaid, `€${balanceDue}`] as [string,string]] : []),
    ...(showCityTax ? [[s.balanceReceiptCityTax(guests), `€${cityTax}`] as [string,string]] : []),
  ];
  const html = buildHtml(
    title(s.balanceReceiptSubject(code)) +
    para(s.balanceReceiptGreeting(firstName, lastName, code)) +
    dataTable(rows) +
    button(s.balanceReceiptButton, receiptUrl) +
    linkButton(s.balanceReceiptManageButton, manageUrl)
  );
  const textLines = [
    s.balanceReceiptGreeting(firstName, lastName, code), "",
    totalPrice ? `  ${s.balanceReceiptTotalStay}: €${totalPrice}` : null,
    balanceDue != null ? `  ${s.balanceReceiptBalancePaid}: €${balanceDue}` : null,
    showCityTax ? `  ${s.balanceReceiptCityTax(guests)}: €${cityTax}` : null,
    "", `${s.balanceReceiptCheckin}: ${fmtDate(checkin)}`,
    `${s.balanceReceiptCheckout}: ${fmtDate(checkout)}`,
    "", `${s.balanceReceiptButton}: ${receiptUrl}`,
    `${s.balanceReceiptManageButton}: ${manageUrl}`,
    "", s.balanceReceiptClosing,
  ];
  await send({
    to, replyTo: HOST_EMAIL,
    subject: s.balanceReceiptSubject(code),
    text: textLines.filter(Boolean).join("\n"),
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
