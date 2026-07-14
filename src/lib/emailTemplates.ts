import type { LocaleCode } from "@/i18n/index";
import { formatFriendlyDateOnly } from "./emailDates";
import { POLICIES } from "./policies";
import { refundPolicyOf, type RefundPolicy } from "./refund";
import { refundPolicyText as sharedRefundPolicyText } from "./refundPolicyText";
import { CONTENT } from "./siteContent";

// Importo pagato online: soggiorno + tassa di soggiorno se incassata online.
function paidAmount(totalPrice: number, cityTax: number | null, cityTaxOnline?: boolean | null): number {
  return totalPrice + (cityTaxOnline && cityTax ? cityTax : 0);
}

const HOST_PHONE = CONTENT.phone;
const HOST_EMAIL = CONTENT.email;

export const METHOD_LABEL: Record<LocaleCode, { card: string; paypal: string }> = {
  it: { card: "Carta di credito", paypal: "PayPal" },
  en: { card: "Credit card", paypal: "PayPal" },
  fr: { card: "Carte de crédit", paypal: "PayPal" },
  de: { card: "Kreditkarte", paypal: "PayPal" },
  es: { card: "Tarjeta de crédito", paypal: "PayPal" },
  pt: { card: "Cartão de crédito", paypal: "PayPal" },
  zh: { card: "信用卡", paypal: "PayPal" },
  ja: { card: "クレジットカード", paypal: "PayPal" },
  ko: { card: "신용카드", paypal: "PayPal" },
};

export function getMethodLabel(locale: LocaleCode, method: "card" | "paypal"): string {
  return (METHOD_LABEL[locale] ?? METHOD_LABEL.it)[method];
}

interface RejectionParams {
  code: string;
  reason: string;
}

interface ApprovalParams {
  code: string;
  payUrl: string;
  manageUrl: string;
  totalPrice: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  guests?: number;
  refundPolicy: string | null;
}

interface PaymentConfirmationParams {
  code: string;
  firstName: string;
  lastName: string;
  checkin: string;
  checkout: string;
  totalPrice: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  guests: number;
  paymentMethod: string;
  refundPolicy: string | null;
  confirmationUrl: string;
  manageUrl: string;
}

// Ricapitolazione check-in: prenotazione confermata SENZA pagamento online (opzione
// "paga al check-in"). L'ospite salda soggiorno + tassa di soggiorno all'arrivo.
interface CheckinRecapParams {
  code: string;
  firstName: string;
  checkin: string;
  checkout: string;
  totalPrice: number | null;
  cityTax: number | null;
  guests: number;
  manageUrl: string;
}

// Frasi aggiuntive su pagamento intero / rimborso / tassa di soggiorno, riutilizzate sia
// nell'email di approvazione (prima del pagamento) sia in quella di conferma pagamento (dopo).
// Nuovo modello: si paga l'INTERO importo del soggiorno; niente più acconto/saldo. La tassa
// di soggiorno può essere incassata online (voce separata) oppure al check-in.
interface DepositStrings {
  // "Per confermare, versa l'intero importo €X."
  payFull: (totalPrice: number) => string;
  // Descrive il LIVELLO di rimborso congelato sulla prenotazione (flexible/moderate/strict)
  // + trattenuta sulla quota soggiorno + tassa di soggiorno sempre rimborsata se online.
  refundPolicyText: (policy: RefundPolicy) => string;
  cityTaxNote: (cityTax: number, guests: number) => string;
  // Variante Opzione A (tassa online): tassa inclusa nel pagamento online come voce separata,
  // NON riscossa al check-in. Popolata in tutte le 9 lingue.
  cityTaxOnlineNote: (cityTax: number, guests: number) => string;
  // "Importo pagato: €X."
  amountPaid: (amount: number) => string;
}

function buildDepositStrings(): Record<LocaleCode, DepositStrings> {
  return {
    it: {
      payFull: (t) => `Per confermare la prenotazione versa l'intero importo di €${t}.`,
      refundPolicyText: (policy) => sharedRefundPolicyText(policy, "it"),
      cityTaxNote: (t, g) => `La tassa di soggiorno (€${t} per ${g} ospiti) verrà riscossa separatamente al check-in e avrà una ricevuta dedicata.`,
      cityTaxOnlineNote: (t, g) => `La tassa di soggiorno (€${t} per ${g} ospiti) è inclusa nel pagamento online come voce separata; non è dovuto alcun importo aggiuntivo al check-in.`,
      amountPaid: (a) => `Importo pagato: €${a}.`,
    },
    en: {
      payFull: (t) => `To confirm your booking, pay the full amount of €${t}.`,
      refundPolicyText: (policy) => sharedRefundPolicyText(policy, "en"),
      cityTaxNote: (t, g) => `The city tax (€${t} for ${g} guests) will be collected separately at check-in and will have its own receipt.`,
      cityTaxOnlineNote: (t, g) => `The city tax (€${t} for ${g} guests) is included in your online payment as a separate item; no additional amount is due at check-in.`,
      amountPaid: (a) => `Amount paid: €${a}.`,
    },
    fr: {
      payFull: (t) => `Pour confirmer votre réservation, réglez le montant total de €${t}.`,
      refundPolicyText: (policy) => sharedRefundPolicyText(policy, "fr"),
      cityTaxNote: (t, g) => `La taxe de séjour (€${t} pour ${g} personnes) sera encaissée séparément à l'arrivée et fera l'objet d'un reçu distinct.`,
      cityTaxOnlineNote: (t, g) => `La taxe de séjour (€${t} pour ${g} personnes) est incluse dans le paiement en ligne en tant qu'article distinct ; aucun montant supplémentaire n'est dû à l'arrivée.`,
      amountPaid: (a) => `Montant payé : €${a}.`,
    },
    de: {
      payFull: (t) => `Um Ihre Buchung zu bestätigen, zahlen Sie den Gesamtbetrag von €${t}.`,
      refundPolicyText: (policy) => sharedRefundPolicyText(policy, "de"),
      cityTaxNote: (t, g) => `Die Kurtaxe (€${t} für ${g} Gäste) wird bei der Anreise separat erhoben und erhält eine eigene Quittung.`,
      cityTaxOnlineNote: (t, g) => `Die Kurtaxe (€${t} für ${g} Gäste) ist als separate Position in der Online-Zahlung enthalten; bei der Anreise ist kein zusätzlicher Betrag fällig.`,
      amountPaid: (a) => `Gezahlter Betrag: €${a}.`,
    },
    es: {
      payFull: (t) => `Para confirmar tu reserva, paga el importe completo de €${t}.`,
      refundPolicyText: (policy) => sharedRefundPolicyText(policy, "es"),
      cityTaxNote: (t, g) => `La tasa turística (€${t} para ${g} huéspedes) se cobrará por separado al hacer el check-in y tendrá su propio recibo.`,
      cityTaxOnlineNote: (t, g) => `La tasa turística (€${t} para ${g} huéspedes) está incluida en el pago online como concepto separado; no se debe pagar ningún importe adicional al hacer el check-in.`,
      amountPaid: (a) => `Importe pagado: €${a}.`,
    },
    pt: {
      payFull: (t) => `Para confirmar a sua reserva, pague o valor total de €${t}.`,
      refundPolicyText: (policy) => sharedRefundPolicyText(policy, "pt"),
      cityTaxNote: (t, g) => `A taxa turística (€${t} para ${g} hóspedes) será cobrada separadamente no check-in e terá um recibo próprio.`,
      cityTaxOnlineNote: (t, g) => `A taxa turística (€${t} para ${g} hóspedes) está incluída no pagamento online como item separado; não é devido qualquer valor adicional no check-in.`,
      amountPaid: (a) => `Valor pago: €${a}.`,
    },
    zh: {
      payFull: (t) => `为确认预订,请支付全额 €${t}。`,
      refundPolicyText: (policy) => sharedRefundPolicyText(policy, "zh"),
      cityTaxNote: (t, g) => `城市税(${g}位客人共 €${t})将在入住时单独收取,并提供单独的收据。`,
      cityTaxOnlineNote: (t, g) => `城市税(${g}位客人共 €${t})已作为单独项目包含在您的在线付款中;入住时无需支付额外费用。`,
      amountPaid: (a) => `已付金额:€${a}。`,
    },
    ja: {
      payFull: (t) => `ご予約を確定するには、全額 €${t} をお支払いください。`,
      refundPolicyText: (policy) => sharedRefundPolicyText(policy, "ja"),
      cityTaxNote: (t, g) => `宿泊税(${g}名様分 €${t})はチェックイン時に別途徴収され、別途領収書が発行されます。`,
      cityTaxOnlineNote: (t, g) => `宿泊税(${g}名様分 €${t})はオンライン決済に別項目として含まれています。チェックイン時の追加のお支払いは不要です。`,
      amountPaid: (a) => `お支払い金額:€${a}。`,
    },
    ko: {
      payFull: (t) => `예약을 확정하려면 전액 €${t}를 결제해 주세요.`,
      refundPolicyText: (policy) => sharedRefundPolicyText(policy, "ko"),
      cityTaxNote: (t, g) => `도시세(${g}명 €${t})는 체크인 시 별도로 징수되며 별도 영수증이 발급됩니다.`,
      cityTaxOnlineNote: (t, g) => `도시세(${g}명 €${t})는 온라인 결제에 별도 항목으로 포함되어 있습니다. 체크인 시 추가로 지불하실 금액은 없습니다.`,
      amountPaid: (a) => `결제 금액: €${a}.`,
    },
  };
}

const DEPOSIT_STRINGS = buildDepositStrings();

// Sceglie la frase sulla tassa di soggiorno in base al flag Opzione A: se la tassa è stata
// incassata online (voce separata dell'anticipo) usa la nota "inclusa nel pagamento online",
// altrimenti la nota classica "riscossa al check-in" (prenotazioni con flag false/null).
function cityTaxNoteFor(
  locale: LocaleCode,
  cityTax: number,
  guests: number,
  online: boolean | null | undefined,
): string {
  const s = DEPOSIT_STRINGS[locale] ?? DEPOSIT_STRINGS.it;
  return online ? s.cityTaxOnlineNote(cityTax, guests) : s.cityTaxNote(cityTax, guests);
}

interface EmailContent {
  subject: string;
  text: string;
}

type Templates = {
  rejection: (p: RejectionParams) => EmailContent;
  approval: (p: ApprovalParams) => EmailContent;
  paymentConfirmation: (p: PaymentConfirmationParams) => EmailContent;
  checkinRecap: (p: CheckinRecapParams) => EmailContent;
};

const templates: Record<LocaleCode, Templates> = {
  it: {
    rejection: ({ code, reason }) => ({
      subject: `La tua richiesta di prenotazione ${code} non è stata accettata`,
      text: [
        "Gentile ospite,",
        "",
        `Purtroppo non possiamo confermare la richiesta di prenotazione ${code}.`,
        "",
        `Motivo: ${reason}`,
        "",
        "Per qualsiasi domanda puoi contattarci rispondendo a questa email.",
        "",
        CONTENT.siteTitle.it,
      ].join("\n"),
    }),
    approval: ({ code, payUrl, manageUrl, totalPrice, cityTax, cityTaxOnline, guests, refundPolicy }) => ({
      subject: `Prenotazione ${code} approvata · completa il pagamento`,
      text: [
        "Gentile ospite,",
        "",
        `Buone notizie! La tua richiesta di prenotazione ${code} è stata approvata.`,
        totalPrice ? `Totale soggiorno: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.it.payFull(totalPrice) : null,
        DEPOSIT_STRINGS.it.refundPolicyText(refundPolicyOf(refundPolicy)),
        cityTax != null && guests ? cityTaxNoteFor("it", cityTax, guests, cityTaxOnline) : null,
        "",
        `Per confermare la prenotazione, completa il pagamento qui: ${payUrl}`,
        `Potrai gestire o cancellare la prenotazione qui: ${manageUrl}`,
        "",
        CONTENT.siteTitle.it,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    paymentConfirmation: (p) => ({
      subject: `Pagamento confermato · Prenotazione ${p.code}`,
      text: [
        `Gentile ${p.firstName} ${p.lastName},`,
        "",
        `Il pagamento per la prenotazione ${p.code} è stato completato con successo.`,
        `Check-in: ${formatFriendlyDateOnly(p.checkin, "it")}`,
        `Check-out: ${formatFriendlyDateOnly(p.checkout, "it")}`,
        p.totalPrice ? `Totale soggiorno: €${p.totalPrice}` : null,
        p.totalPrice != null ? DEPOSIT_STRINGS.it.amountPaid(paidAmount(p.totalPrice, p.cityTax, p.cityTaxOnline)) : null,
        p.cityTax != null ? cityTaxNoteFor("it", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.it.refundPolicyText(refundPolicyOf(p.refundPolicy)),
        `Metodo di pagamento: ${p.paymentMethod}`,
        "",
        `Il check-in è possibile a partire dalle ore ${POLICIES.checkinTime}, mentre il check-out deve essere effettuato entro le ore ${POLICIES.checkoutTime}.`,
        `Ti ricordiamo di contattarci al ${HOST_PHONE} o rispondendo a questa email per comunicarci l'orario previsto di arrivo e di partenza.`,
        "",
        `Puoi scaricare la conferma e la ricevuta qui: ${p.confirmationUrl}`,
        `Per gestire o cancellare la prenotazione: ${p.manageUrl}`,
        "",
        "Ti aspettiamo!",
        CONTENT.siteTitle.it,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    checkinRecap: (p) => ({
      subject: `Prenotazione confermata · ${p.code}`,
      text: [
        `Gentile ${p.firstName},`,
        "",
        `La tua prenotazione ${p.code} è confermata. Non è previsto alcun pagamento online: salderai l'importo direttamente al check-in.`,
        `Check-in: ${formatFriendlyDateOnly(p.checkin, "it")}`,
        `Check-out: ${formatFriendlyDateOnly(p.checkout, "it")}`,
        p.totalPrice != null ? `Soggiorno da saldare al check-in: €${p.totalPrice}` : null,
        p.cityTax != null && p.cityTax > 0 ? `Tassa di soggiorno (${p.guests} ospiti): €${p.cityTax}` : null,
        p.totalPrice != null ? `Totale da saldare al check-in: €${p.totalPrice + (p.cityTax ?? 0)}` : null,
        "",
        `Per gestire o cancellare la prenotazione: ${p.manageUrl}`,
        "",
        "Ti aspettiamo!",
        CONTENT.siteTitle.it,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  },
  en: {
    rejection: ({ code, reason }) => ({
      subject: `Your booking request ${code} was not accepted`,
      text: [
        "Dear guest,",
        "",
        `Unfortunately we cannot confirm booking request ${code}.`,
        "",
        `Reason: ${reason}`,
        "",
        "For any questions, you can reach us by replying to this email.",
        "",
        CONTENT.siteTitle.en,
      ].join("\n"),
    }),
    approval: ({ code, payUrl, manageUrl, totalPrice, cityTax, cityTaxOnline, guests, refundPolicy }) => ({
      subject: `Booking ${code} approved · complete your payment`,
      text: [
        "Dear guest,",
        "",
        `Good news! Your booking request ${code} has been approved.`,
        totalPrice ? `Total stay price: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.en.payFull(totalPrice) : null,
        DEPOSIT_STRINGS.en.refundPolicyText(refundPolicyOf(refundPolicy)),
        cityTax != null && guests ? cityTaxNoteFor("en", cityTax, guests, cityTaxOnline) : null,
        "",
        `To confirm your booking, complete the payment here: ${payUrl}`,
        `You can manage or cancel your booking here: ${manageUrl}`,
        "",
        CONTENT.siteTitle.en,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    paymentConfirmation: (p) => ({
      subject: `Payment confirmed · Booking ${p.code}`,
      text: [
        `Dear ${p.firstName} ${p.lastName},`,
        "",
        `The payment for booking ${p.code} has been completed successfully.`,
        `Check-in: ${formatFriendlyDateOnly(p.checkin, "en")}`,
        `Check-out: ${formatFriendlyDateOnly(p.checkout, "en")}`,
        p.totalPrice ? `Total stay price: €${p.totalPrice}` : null,
        p.totalPrice != null ? DEPOSIT_STRINGS.en.amountPaid(paidAmount(p.totalPrice, p.cityTax, p.cityTaxOnline)) : null,
        p.cityTax != null ? cityTaxNoteFor("en", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.en.refundPolicyText(refundPolicyOf(p.refundPolicy)),
        `Payment method: ${p.paymentMethod}`,
        "",
        `Check-in is available from ${POLICIES.checkinTime}, and check-out must be completed by ${POLICIES.checkoutTime}.`,
        `Please contact us at ${HOST_PHONE} or by replying to this email to let us know your expected arrival and departure times.`,
        "",
        `You can download the confirmation and receipt here: ${p.confirmationUrl}`,
        `To manage or cancel your booking: ${p.manageUrl}`,
        "",
        "We look forward to welcoming you!",
        CONTENT.siteTitle.en,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    checkinRecap: (p) => ({
      subject: `Booking confirmed · ${p.code}`,
      text: [
        `Dear ${p.firstName},`,
        "",
        `Your booking ${p.code} is confirmed. No online payment is required: you will settle the amount directly at check-in.`,
        `Check-in: ${formatFriendlyDateOnly(p.checkin, "en")}`,
        `Check-out: ${formatFriendlyDateOnly(p.checkout, "en")}`,
        p.totalPrice != null ? `Stay to settle at check-in: €${p.totalPrice}` : null,
        p.cityTax != null && p.cityTax > 0 ? `City tax (${p.guests} guests): €${p.cityTax}` : null,
        p.totalPrice != null ? `Total to settle at check-in: €${p.totalPrice + (p.cityTax ?? 0)}` : null,
        "",
        `To manage or cancel your booking: ${p.manageUrl}`,
        "",
        "We look forward to welcoming you!",
        CONTENT.siteTitle.en,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  },
  fr: {
    rejection: ({ code, reason }) => ({
      subject: `Votre demande de réservation ${code} n'a pas été acceptée`,
      text: [
        "Cher hôte,",
        "",
        `Nous ne pouvons malheureusement pas confirmer la demande de réservation ${code}.`,
        "",
        `Motif : ${reason}`,
        "",
        "Pour toute question, vous pouvez nous contacter en répondant à cet e-mail.",
        "",
        CONTENT.siteTitle.fr,
      ].join("\n"),
    }),
    approval: ({ code, payUrl, manageUrl, totalPrice, cityTax, cityTaxOnline, guests, refundPolicy }) => ({
      subject: `Réservation ${code} approuvée · finalisez le paiement`,
      text: [
        "Cher hôte,",
        "",
        `Bonne nouvelle ! Votre demande de réservation ${code} a été approuvée.`,
        totalPrice ? `Prix total du séjour : €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.fr.payFull(totalPrice) : null,
        DEPOSIT_STRINGS.fr.refundPolicyText(refundPolicyOf(refundPolicy)),
        cityTax != null && guests ? cityTaxNoteFor("fr", cityTax, guests, cityTaxOnline) : null,
        "",
        `Pour confirmer votre réservation, finalisez le paiement ici : ${payUrl}`,
        `Vous pouvez gérer ou annuler votre réservation ici : ${manageUrl}`,
        "",
        CONTENT.siteTitle.fr,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    paymentConfirmation: (p) => ({
      subject: `Paiement confirmé · Réservation ${p.code}`,
      text: [
        `Cher/Chère ${p.firstName} ${p.lastName},`,
        "",
        `Le paiement pour la réservation ${p.code} a bien été effectué.`,
        `Arrivée : ${formatFriendlyDateOnly(p.checkin, "fr")}`,
        `Départ : ${formatFriendlyDateOnly(p.checkout, "fr")}`,
        p.totalPrice ? `Prix total du séjour : €${p.totalPrice}` : null,
        p.totalPrice != null ? DEPOSIT_STRINGS.fr.amountPaid(paidAmount(p.totalPrice, p.cityTax, p.cityTaxOnline)) : null,
        p.cityTax != null ? cityTaxNoteFor("fr", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.fr.refundPolicyText(refundPolicyOf(p.refundPolicy)),
        `Méthode de paiement : ${p.paymentMethod}`,
        "",
        `L'arrivée est possible à partir de ${POLICIES.checkinTime}, et le départ doit avoir lieu avant ${POLICIES.checkoutTime}.`,
        `N'oubliez pas de nous contacter au ${HOST_PHONE} ou en répondant à cet e-mail pour nous communiquer votre heure d'arrivée et de départ prévue.`,
        "",
        `Vous pouvez télécharger la confirmation et le reçu ici : ${p.confirmationUrl}`,
        `Pour gérer ou annuler votre réservation : ${p.manageUrl}`,
        "",
        "Au plaisir de vous accueillir !",
        CONTENT.siteTitle.fr,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    checkinRecap: (p) => ({
      subject: `Réservation confirmée · ${p.code}`,
      text: [
        `Cher/Chère ${p.firstName},`,
        "",
        `Votre réservation ${p.code} est confirmée. Aucun paiement en ligne n'est requis : vous réglerez le montant directement à l'arrivée.`,
        `Arrivée : ${formatFriendlyDateOnly(p.checkin, "fr")}`,
        `Départ : ${formatFriendlyDateOnly(p.checkout, "fr")}`,
        p.totalPrice != null ? `Séjour à régler à l'arrivée : €${p.totalPrice}` : null,
        p.cityTax != null && p.cityTax > 0 ? `Taxe de séjour (${p.guests} personnes) : €${p.cityTax}` : null,
        p.totalPrice != null ? `Total à régler à l'arrivée : €${p.totalPrice + (p.cityTax ?? 0)}` : null,
        "",
        `Pour gérer ou annuler votre réservation : ${p.manageUrl}`,
        "",
        "Au plaisir de vous accueillir !",
        CONTENT.siteTitle.fr,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  },
  de: {
    rejection: ({ code, reason }) => ({
      subject: `Ihre Buchungsanfrage ${code} wurde nicht angenommen`,
      text: [
        "Liebe Gäste,",
        "",
        `Leider können wir die Buchungsanfrage ${code} nicht bestätigen.`,
        "",
        `Grund: ${reason}`,
        "",
        "Bei Fragen erreichen Sie uns durch Antworten auf diese E-Mail.",
        "",
        CONTENT.siteTitle.de,
      ].join("\n"),
    }),
    approval: ({ code, payUrl, manageUrl, totalPrice, cityTax, cityTaxOnline, guests, refundPolicy }) => ({
      subject: `Buchung ${code} genehmigt · Zahlung abschließen`,
      text: [
        "Liebe Gäste,",
        "",
        `Gute Nachrichten! Ihre Buchungsanfrage ${code} wurde genehmigt.`,
        totalPrice ? `Gesamtpreis des Aufenthalts: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.de.payFull(totalPrice) : null,
        DEPOSIT_STRINGS.de.refundPolicyText(refundPolicyOf(refundPolicy)),
        cityTax != null && guests ? cityTaxNoteFor("de", cityTax, guests, cityTaxOnline) : null,
        "",
        `Um Ihre Buchung zu bestätigen, schließen Sie die Zahlung hier ab: ${payUrl}`,
        `Sie können Ihre Buchung hier verwalten oder stornieren: ${manageUrl}`,
        "",
        CONTENT.siteTitle.de,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    paymentConfirmation: (p) => ({
      subject: `Zahlung bestätigt · Buchung ${p.code}`,
      text: [
        `Liebe/r ${p.firstName} ${p.lastName},`,
        "",
        `Die Zahlung für die Buchung ${p.code} wurde erfolgreich abgeschlossen.`,
        `Anreise: ${formatFriendlyDateOnly(p.checkin, "de")}`,
        `Abreise: ${formatFriendlyDateOnly(p.checkout, "de")}`,
        p.totalPrice ? `Gesamtpreis des Aufenthalts: €${p.totalPrice}` : null,
        p.totalPrice != null ? DEPOSIT_STRINGS.de.amountPaid(paidAmount(p.totalPrice, p.cityTax, p.cityTaxOnline)) : null,
        p.cityTax != null ? cityTaxNoteFor("de", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.de.refundPolicyText(refundPolicyOf(p.refundPolicy)),
        `Zahlungsmethode: ${p.paymentMethod}`,
        "",
        `Check-in ist ab ${POLICIES.checkinTime} Uhr möglich, Check-out muss bis ${POLICIES.checkoutTime} Uhr erfolgen.`,
        `Bitte kontaktieren Sie uns unter ${HOST_PHONE} oder durch Antworten auf diese E-Mail, um uns Ihre voraussichtliche Ankunfts- und Abreisezeit mitzuteilen.`,
        "",
        `Sie können die Bestätigung und Quittung hier herunterladen: ${p.confirmationUrl}`,
        `Buchung verwalten oder stornieren: ${p.manageUrl}`,
        "",
        "Wir freuen uns auf Sie!",
        CONTENT.siteTitle.de,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    checkinRecap: (p) => ({
      subject: `Buchung bestätigt · ${p.code}`,
      text: [
        `Liebe/r ${p.firstName},`,
        "",
        `Ihre Buchung ${p.code} ist bestätigt. Es ist keine Online-Zahlung erforderlich: Sie begleichen den Betrag direkt bei der Anreise.`,
        `Anreise: ${formatFriendlyDateOnly(p.checkin, "de")}`,
        `Abreise: ${formatFriendlyDateOnly(p.checkout, "de")}`,
        p.totalPrice != null ? `Bei Anreise zu zahlender Aufenthalt: €${p.totalPrice}` : null,
        p.cityTax != null && p.cityTax > 0 ? `Kurtaxe (${p.guests} Gäste): €${p.cityTax}` : null,
        p.totalPrice != null ? `Bei Anreise insgesamt zu zahlen: €${p.totalPrice + (p.cityTax ?? 0)}` : null,
        "",
        `Buchung verwalten oder stornieren: ${p.manageUrl}`,
        "",
        "Wir freuen uns auf Sie!",
        CONTENT.siteTitle.de,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  },
  es: {
    rejection: ({ code, reason }) => ({
      subject: `Tu solicitud de reserva ${code} no ha sido aceptada`,
      text: [
        "Estimado huésped,",
        "",
        `Lamentablemente no podemos confirmar la solicitud de reserva ${code}.`,
        "",
        `Motivo: ${reason}`,
        "",
        "Para cualquier pregunta, puedes contactarnos respondiendo a este correo.",
        "",
        CONTENT.siteTitle.es,
      ].join("\n"),
    }),
    approval: ({ code, payUrl, manageUrl, totalPrice, cityTax, cityTaxOnline, guests, refundPolicy }) => ({
      subject: `Reserva ${code} aprobada · completa el pago`,
      text: [
        "Estimado huésped,",
        "",
        `¡Buenas noticias! Tu solicitud de reserva ${code} ha sido aprobada.`,
        totalPrice ? `Precio total de la estancia: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.es.payFull(totalPrice) : null,
        DEPOSIT_STRINGS.es.refundPolicyText(refundPolicyOf(refundPolicy)),
        cityTax != null && guests ? cityTaxNoteFor("es", cityTax, guests, cityTaxOnline) : null,
        "",
        `Para confirmar tu reserva, completa el pago aquí: ${payUrl}`,
        `Puedes gestionar o cancelar tu reserva aquí: ${manageUrl}`,
        "",
        CONTENT.siteTitle.es,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    paymentConfirmation: (p) => ({
      subject: `Pago confirmado · Reserva ${p.code}`,
      text: [
        `Estimado/a ${p.firstName} ${p.lastName},`,
        "",
        `El pago para la reserva ${p.code} se ha completado correctamente.`,
        `Llegada: ${formatFriendlyDateOnly(p.checkin, "es")}`,
        `Salida: ${formatFriendlyDateOnly(p.checkout, "es")}`,
        p.totalPrice ? `Precio total de la estancia: €${p.totalPrice}` : null,
        p.totalPrice != null ? DEPOSIT_STRINGS.es.amountPaid(paidAmount(p.totalPrice, p.cityTax, p.cityTaxOnline)) : null,
        p.cityTax != null ? cityTaxNoteFor("es", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.es.refundPolicyText(refundPolicyOf(p.refundPolicy)),
        `Método de pago: ${p.paymentMethod}`,
        "",
        `La entrada es posible a partir de las ${POLICIES.checkinTime}, y la salida debe realizarse antes de las ${POLICIES.checkoutTime}.`,
        `Recuerda contactarnos al ${HOST_PHONE} o respondiendo a este correo para indicarnos tu hora prevista de llegada y salida.`,
        "",
        `Puedes descargar la confirmación y el recibo aquí: ${p.confirmationUrl}`,
        `Para gestionar o cancelar tu reserva: ${p.manageUrl}`,
        "",
        "¡Te esperamos!",
        CONTENT.siteTitle.es,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    checkinRecap: (p) => ({
      subject: `Reserva confirmada · ${p.code}`,
      text: [
        `Estimado/a ${p.firstName},`,
        "",
        `Tu reserva ${p.code} está confirmada. No se requiere ningún pago online: abonarás el importe directamente en el check-in.`,
        `Llegada: ${formatFriendlyDateOnly(p.checkin, "es")}`,
        `Salida: ${formatFriendlyDateOnly(p.checkout, "es")}`,
        p.totalPrice != null ? `Estancia a abonar en el check-in: €${p.totalPrice}` : null,
        p.cityTax != null && p.cityTax > 0 ? `Tasa turística (${p.guests} huéspedes): €${p.cityTax}` : null,
        p.totalPrice != null ? `Total a abonar en el check-in: €${p.totalPrice + (p.cityTax ?? 0)}` : null,
        "",
        `Para gestionar o cancelar tu reserva: ${p.manageUrl}`,
        "",
        "¡Te esperamos!",
        CONTENT.siteTitle.es,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  },
  pt: {
    rejection: ({ code, reason }) => ({
      subject: `Sua solicitação de reserva ${code} não foi aceita`,
      text: [
        "Prezado hóspede,",
        "",
        `Infelizmente não podemos confirmar a solicitação de reserva ${code}.`,
        "",
        `Motivo: ${reason}`,
        "",
        "Para qualquer dúvida, você pode nos contatar respondendo a este e-mail.",
        "",
        CONTENT.siteTitle.pt,
      ].join("\n"),
    }),
    approval: ({ code, payUrl, manageUrl, totalPrice, cityTax, cityTaxOnline, guests, refundPolicy }) => ({
      subject: `Reserva ${code} aprovada · conclua o pagamento`,
      text: [
        "Prezado hóspede,",
        "",
        `Boas notícias! Sua solicitação de reserva ${code} foi aprovada.`,
        totalPrice ? `Preço total da estadia: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.pt.payFull(totalPrice) : null,
        DEPOSIT_STRINGS.pt.refundPolicyText(refundPolicyOf(refundPolicy)),
        cityTax != null && guests ? cityTaxNoteFor("pt", cityTax, guests, cityTaxOnline) : null,
        "",
        `Para confirmar sua reserva, conclua o pagamento aqui: ${payUrl}`,
        `Você pode gerenciar ou cancelar sua reserva aqui: ${manageUrl}`,
        "",
        CONTENT.siteTitle.pt,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    paymentConfirmation: (p) => ({
      subject: `Pagamento confirmado · Reserva ${p.code}`,
      text: [
        `Prezado(a) ${p.firstName} ${p.lastName},`,
        "",
        `O pagamento da reserva ${p.code} foi concluído com sucesso.`,
        `Check-in: ${formatFriendlyDateOnly(p.checkin, "pt")}`,
        `Check-out: ${formatFriendlyDateOnly(p.checkout, "pt")}`,
        p.totalPrice ? `Preço total da estadia: €${p.totalPrice}` : null,
        p.totalPrice != null ? DEPOSIT_STRINGS.pt.amountPaid(paidAmount(p.totalPrice, p.cityTax, p.cityTaxOnline)) : null,
        p.cityTax != null ? cityTaxNoteFor("pt", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.pt.refundPolicyText(refundPolicyOf(p.refundPolicy)),
        `Método de pagamento: ${p.paymentMethod}`,
        "",
        `O check-in é possível a partir das ${POLICIES.checkinTime}, e o check-out deve ser feito até às ${POLICIES.checkoutTime}.`,
        `Lembre-se de nos contatar pelo ${HOST_PHONE} ou respondendo a este e-mail para informar seu horário previsto de chegada e partida.`,
        "",
        `Você pode baixar a confirmação e o recibo aqui: ${p.confirmationUrl}`,
        `Para gerir ou cancelar a sua reserva: ${p.manageUrl}`,
        "",
        "Esperamos por você!",
        CONTENT.siteTitle.pt,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    checkinRecap: (p) => ({
      subject: `Reserva confirmada · ${p.code}`,
      text: [
        `Prezado(a) ${p.firstName},`,
        "",
        `A sua reserva ${p.code} está confirmada. Não é necessário qualquer pagamento online: pagará o valor diretamente no check-in.`,
        `Check-in: ${formatFriendlyDateOnly(p.checkin, "pt")}`,
        `Check-out: ${formatFriendlyDateOnly(p.checkout, "pt")}`,
        p.totalPrice != null ? `Estadia a pagar no check-in: €${p.totalPrice}` : null,
        p.cityTax != null && p.cityTax > 0 ? `Taxa turística (${p.guests} hóspedes): €${p.cityTax}` : null,
        p.totalPrice != null ? `Total a pagar no check-in: €${p.totalPrice + (p.cityTax ?? 0)}` : null,
        "",
        `Para gerir ou cancelar a sua reserva: ${p.manageUrl}`,
        "",
        "Esperamos por você!",
        CONTENT.siteTitle.pt,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  },
  zh: {
    rejection: ({ code, reason }) => ({
      subject: `您的预订申请 ${code} 未被接受`,
      text: [
        "尊敬的客人,",
        "",
        `很遗憾,我们无法确认预订申请 ${code}。`,
        "",
        `原因:${reason}`,
        "",
        "如有任何问题,请直接回复此邮件与我们联系。",
        "",
        CONTENT.siteTitle.zh,
      ].join("\n"),
    }),
    approval: ({ code, payUrl, manageUrl, totalPrice, cityTax, cityTaxOnline, guests, refundPolicy }) => ({
      subject: `预订 ${code} 已批准 · 请完成付款`,
      text: [
        "尊敬的客人,",
        "",
        `好消息!您的预订申请 ${code} 已被批准。`,
        totalPrice ? `住宿总价:€${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.zh.payFull(totalPrice) : null,
        DEPOSIT_STRINGS.zh.refundPolicyText(refundPolicyOf(refundPolicy)),
        cityTax != null && guests ? cityTaxNoteFor("zh", cityTax, guests, cityTaxOnline) : null,
        "",
        `请在此完成付款以确认预订:${payUrl}`,
        `您可以在此管理或取消预订:${manageUrl}`,
        "",
        CONTENT.siteTitle.zh,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    paymentConfirmation: (p) => ({
      subject: `付款已确认 · 预订 ${p.code}`,
      text: [
        `亲爱的 ${p.firstName} ${p.lastName},`,
        "",
        `预订 ${p.code} 的付款已成功完成。`,
        `入住日期:${formatFriendlyDateOnly(p.checkin, "zh")}`,
        `退房日期:${formatFriendlyDateOnly(p.checkout, "zh")}`,
        p.totalPrice ? `住宿总价:€${p.totalPrice}` : null,
        p.totalPrice != null ? DEPOSIT_STRINGS.zh.amountPaid(paidAmount(p.totalPrice, p.cityTax, p.cityTaxOnline)) : null,
        p.cityTax != null ? cityTaxNoteFor("zh", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.zh.refundPolicyText(refundPolicyOf(p.refundPolicy)),
        `支付方式:${p.paymentMethod}`,
        "",
        `入住时间为${POLICIES.checkinTime}起,退房时间须在${POLICIES.checkoutTime}前。`,
        `请通过电话 ${HOST_PHONE} 或直接回复此邮件告知我们您预计的到达和离开时间。`,
        "",
        `您可以在此下载确认单和收据:${p.confirmationUrl}`,
        `管理或取消预订:${p.manageUrl}`,
        "",
        "期待您的到来!",
        CONTENT.siteTitle.zh,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    checkinRecap: (p) => ({
      subject: `预订已确认 · ${p.code}`,
      text: [
        `亲爱的 ${p.firstName},`,
        "",
        `您的预订 ${p.code} 已确认。无需在线付款:您将在入住时直接结算款项。`,
        `入住日期:${formatFriendlyDateOnly(p.checkin, "zh")}`,
        `退房日期:${formatFriendlyDateOnly(p.checkout, "zh")}`,
        p.totalPrice != null ? `入住时结算住宿费用:€${p.totalPrice}` : null,
        p.cityTax != null && p.cityTax > 0 ? `城市税(${p.guests}位客人):€${p.cityTax}` : null,
        p.totalPrice != null ? `入住时应结算总额:€${p.totalPrice + (p.cityTax ?? 0)}` : null,
        "",
        `管理或取消预订:${p.manageUrl}`,
        "",
        "期待您的到来!",
        CONTENT.siteTitle.zh,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  },
  ja: {
    rejection: ({ code, reason }) => ({
      subject: `ご予約リクエスト ${code} は承認されませんでした`,
      text: [
        "ゲスト様",
        "",
        `誠に申し訳ございませんが、ご予約リクエスト ${code} を確定できません。`,
        "",
        `理由:${reason}`,
        "",
        "ご質問がございましたら、このメールにご返信ください。",
        "",
        CONTENT.siteTitle.ja,
      ].join("\n"),
    }),
    approval: ({ code, payUrl, manageUrl, totalPrice, cityTax, cityTaxOnline, guests, refundPolicy }) => ({
      subject: `予約 ${code} が承認されました · お支払いを完了してください`,
      text: [
        "ゲスト様",
        "",
        `朗報です!ご予約リクエスト ${code} が承認されました。`,
        totalPrice ? `宿泊合計金額:€${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.ja.payFull(totalPrice) : null,
        DEPOSIT_STRINGS.ja.refundPolicyText(refundPolicyOf(refundPolicy)),
        cityTax != null && guests ? cityTaxNoteFor("ja", cityTax, guests, cityTaxOnline) : null,
        "",
        `ご予約を確定するには、こちらからお支払いを完了してください:${payUrl}`,
        `こちらからご予約の管理またはキャンセルができます:${manageUrl}`,
        "",
        CONTENT.siteTitle.ja,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    paymentConfirmation: (p) => ({
      subject: `お支払い確認 · 予約 ${p.code}`,
      text: [
        `${p.firstName} ${p.lastName}様`,
        "",
        `ご予約 ${p.code} のお支払いが正常に完了しました。`,
        `チェックイン:${formatFriendlyDateOnly(p.checkin, "ja")}`,
        `チェックアウト:${formatFriendlyDateOnly(p.checkout, "ja")}`,
        p.totalPrice ? `宿泊合計金額:€${p.totalPrice}` : null,
        p.totalPrice != null ? DEPOSIT_STRINGS.ja.amountPaid(paidAmount(p.totalPrice, p.cityTax, p.cityTaxOnline)) : null,
        p.cityTax != null ? cityTaxNoteFor("ja", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.ja.refundPolicyText(refundPolicyOf(p.refundPolicy)),
        `お支払い方法:${p.paymentMethod}`,
        "",
        `チェックインは${POLICIES.checkinTime}から、チェックアウトは${POLICIES.checkoutTime}までにお願いいたします。`,
        `到着予定時刻と出発予定時刻を、${HOST_PHONE} へのお電話、またはこのメールへのご返信にてお知らせください。`,
        "",
        `確認書と領収書はこちらからダウンロードいただけます:${p.confirmationUrl}`,
        `ご予約の管理またはキャンセルはこちら:${p.manageUrl}`,
        "",
        "お会いできることを楽しみにしております!",
        CONTENT.siteTitle.ja,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    checkinRecap: (p) => ({
      subject: `ご予約が確定しました · ${p.code}`,
      text: [
        `${p.firstName}様`,
        "",
        `ご予約 ${p.code} が確定しました。オンラインでのお支払いは不要です。料金はチェックイン時に直接お支払いください。`,
        `チェックイン:${formatFriendlyDateOnly(p.checkin, "ja")}`,
        `チェックアウト:${formatFriendlyDateOnly(p.checkout, "ja")}`,
        p.totalPrice != null ? `チェックイン時にお支払いいただく宿泊料金:€${p.totalPrice}` : null,
        p.cityTax != null && p.cityTax > 0 ? `宿泊税(${p.guests}名):€${p.cityTax}` : null,
        p.totalPrice != null ? `チェックイン時のお支払い合計:€${p.totalPrice + (p.cityTax ?? 0)}` : null,
        "",
        `ご予約の管理またはキャンセルはこちら:${p.manageUrl}`,
        "",
        "お会いできることを楽しみにしております!",
        CONTENT.siteTitle.ja,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  },
  ko: {
    rejection: ({ code, reason }) => ({
      subject: `예약 요청 ${code}이(가) 승인되지 않았습니다`,
      text: [
        "친애하는 고객님,",
        "",
        `안타깝게도 예약 요청 ${code}을(를) 확정할 수 없습니다.`,
        "",
        `사유: ${reason}`,
        "",
        "문의 사항이 있으시면 이 이메일에 답장해 주세요.",
        "",
        CONTENT.siteTitle.ko,
      ].join("\n"),
    }),
    approval: ({ code, payUrl, manageUrl, totalPrice, cityTax, cityTaxOnline, guests, refundPolicy }) => ({
      subject: `예약 ${code} 승인됨 · 결제를 완료해 주세요`,
      text: [
        "친애하는 고객님,",
        "",
        `좋은 소식입니다! 예약 요청 ${code}이(가) 승인되었습니다.`,
        totalPrice ? `숙박 총액: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.ko.payFull(totalPrice) : null,
        DEPOSIT_STRINGS.ko.refundPolicyText(refundPolicyOf(refundPolicy)),
        cityTax != null && guests ? cityTaxNoteFor("ko", cityTax, guests, cityTaxOnline) : null,
        "",
        `예약을 확정하려면 여기에서 결제를 완료해 주세요: ${payUrl}`,
        `여기에서 예약을 관리하거나 취소할 수 있습니다: ${manageUrl}`,
        "",
        CONTENT.siteTitle.ko,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    paymentConfirmation: (p) => ({
      subject: `결제 확인 · 예약 ${p.code}`,
      text: [
        `${p.firstName} ${p.lastName}님,`,
        "",
        `예약 ${p.code}의 결제가 성공적으로 완료되었습니다.`,
        `체크인: ${formatFriendlyDateOnly(p.checkin, "ko")}`,
        `체크아웃: ${formatFriendlyDateOnly(p.checkout, "ko")}`,
        p.totalPrice ? `숙박 총액: €${p.totalPrice}` : null,
        p.totalPrice != null ? DEPOSIT_STRINGS.ko.amountPaid(paidAmount(p.totalPrice, p.cityTax, p.cityTaxOnline)) : null,
        p.cityTax != null ? cityTaxNoteFor("ko", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.ko.refundPolicyText(refundPolicyOf(p.refundPolicy)),
        `결제 방법: ${p.paymentMethod}`,
        "",
        `체크인은 ${POLICIES.checkinTime}부터 가능하며, 체크아웃은 ${POLICIES.checkoutTime}까지 완료해 주셔야 합니다.`,
        `${HOST_PHONE}로 전화하시거나 이 이메일에 답장하여 예상 도착 및 출발 시간을 알려주시기 바랍니다.`,
        "",
        `확인서와 영수증은 여기에서 다운로드하실 수 있습니다: ${p.confirmationUrl}`,
        `예약 관리 또는 취소: ${p.manageUrl}`,
        "",
        "뵙기를 기대하겠습니다!",
        CONTENT.siteTitle.ko,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
    checkinRecap: (p) => ({
      subject: `예약이 확정되었습니다 · ${p.code}`,
      text: [
        `${p.firstName}님,`,
        "",
        `예약 ${p.code}이(가) 확정되었습니다. 온라인 결제는 필요하지 않습니다: 체크인 시 직접 금액을 결제하시면 됩니다.`,
        `체크인: ${formatFriendlyDateOnly(p.checkin, "ko")}`,
        `체크아웃: ${formatFriendlyDateOnly(p.checkout, "ko")}`,
        p.totalPrice != null ? `체크인 시 결제할 숙박 요금: €${p.totalPrice}` : null,
        p.cityTax != null && p.cityTax > 0 ? `관광세(${p.guests}명): €${p.cityTax}` : null,
        p.totalPrice != null ? `체크인 시 결제할 총액: €${p.totalPrice + (p.cityTax ?? 0)}` : null,
        "",
        `예약 관리 또는 취소: ${p.manageUrl}`,
        "",
        "뵙기를 기대하겠습니다!",
        CONTENT.siteTitle.ko,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  },
};

export function getEmailTemplates(locale: LocaleCode): Templates {
  return templates[locale] ?? templates.it;
}

// ---------------------------------------------------------------------------
// Extra guest email strings (auto-reply, cancellation, manage-link, balance)
// ---------------------------------------------------------------------------

interface ExtraStrings {
  houseName: string;
  autoReplySubject: (code: string) => string;
  autoReplyBody: (firstName: string, code: string, checkin: string, checkout: string) => string;
  autoReplyFooter: string;
  cancelSubject: (code: string) => string;
  cancelBody: (firstName: string, code: string, checkin: string, checkout: string) => string;
  // Rimborso PIENO della quota soggiorno (con franchigia già detratta).
  cancelRefundFull: (stayRefund: string, feePercent: number) => string;
  // Rimborso PARZIALE 50% della quota soggiorno.
  cancelRefundPartial: (stayRefund: string) => string;
  // Nessun rimborso dovuto (livello/tempistiche o nulla incassato).
  cancelNoRefund: string;
  // Tassa di soggiorno pagata online: rimborsata a parte sempre al 100%.
  cancelCityTaxRefund: (amount: string) => string;
  cancelFooter: string;
  manageLinkSubject: (code: string) => string;
  manageLinkBody: (firstName: string, code: string) => string;
  manageLinkExpiry: string;
  manageLinkDisclaimer: string;
  reviewRequestSubject: (code: string) => string;
  reviewRequestBody: (firstName: string) => string;
  reviewRequestButton: string;
}

const EXTRA: Record<LocaleCode, ExtraStrings> = {
  it: {
    houseName: CONTENT.siteTitle.it,
    reviewRequestSubject: (c) => `La tua recensione · Prenotazione ${c}`,
    reviewRequestBody: (fn) => `Ciao ${fn},\n\nsperiamo che il tuo soggiorno sia stato piacevole. Ti va di raccontare la tua esperienza in una breve recensione? Ti basta un minuto.`,
    reviewRequestButton: "Lascia una recensione",
    autoReplySubject: (c) => `Richiesta ricevuta · ${c}`,
    autoReplyBody: (fn, c, ci, co) => `Ciao ${fn},\n\nAbbiamo ricevuto la tua richiesta di prenotazione (codice: ${c}) per il periodo dal ${ci} al ${co} presso ${CONTENT.siteTitle.it}, ${CONTENT.address}.\n\nEntro 24 ore ti contatteremo per confermare la disponibilità e inviarti il link per il pagamento dell'anticipo.\n\nInformazioni utili:\n• Check-in: dalle ${POLICIES.checkinTime}\n• Check-out: entro le ${POLICIES.checkoutTime}\n• Indirizzo: ${CONTENT.address}\n\nPer qualsiasi domanda puoi scriverci a ${HOST_EMAIL} o chiamarci al ${HOST_PHONE}.\n\nA presto!`,
    autoReplyFooter: `${CONTENT.siteTitle.it}\n${CONTENT.locationDisplay}`,
    cancelSubject: (c) => `Prenotazione annullata · ${c}`,
    cancelBody: (fn, c, ci, co) => `Ciao ${fn},\n\nLa tua prenotazione ${c} (check-in: ${ci}, check-out: ${co}) è stata annullata.`,
    cancelRefundFull: (amt, fee) => `Riceverai un rimborso di €${amt} sulla carta originale entro 5–10 giorni lavorativi (trattenuta del ${fee}% sul rimborso del soggiorno già detratta).`,
    cancelRefundPartial: (amt) => `Riceverai un rimborso parziale del 50% pari a €${amt} sulla carta originale entro 5–10 giorni lavorativi.`,
    cancelNoRefund: "In base alla politica di cancellazione della tua prenotazione, non è previsto alcun rimborso.",
    cancelCityTaxRefund: (amt) => `La tassa di soggiorno di €${amt}, pagata online, ti verrà rimborsata per intero separatamente.`,
    cancelFooter: `Per qualsiasi domanda scrivici a ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Gestione prenotazione · ${c}`,
    manageLinkBody: (fn, c) => `Ciao ${fn},\n\nHai richiesto il link per gestire la tua prenotazione (codice: ${c}).\n\nClicca sul pulsante qui sotto per visualizzare i dettagli e, se vuoi, cancellare la prenotazione.`,
    manageLinkExpiry: "Il link è valido per 30 giorni.",
    manageLinkDisclaimer: "Se non hai richiesto tu questo link, ignoralo — la tua prenotazione non verrà modificata.",
  },
  en: {
    houseName: CONTENT.siteTitle.en,
    reviewRequestSubject: (c) => `Your review · Booking ${c}`,
    reviewRequestBody: (fn) => `Hi ${fn},\n\nwe hope you enjoyed your stay. Would you share your experience in a short review? It only takes a minute.`,
    reviewRequestButton: "Leave a review",
    autoReplySubject: (c) => `Request received · ${c}`,
    autoReplyBody: (fn, c, ci, co) => `Hello ${fn},\n\nWe have received your booking request (code: ${c}) for the period ${ci} – ${co} at ${CONTENT.siteTitle.en}, ${CONTENT.address}.\n\nWe will get back to you within 24 hours to confirm availability and send you the link to pay the deposit.\n\nUseful information:\n• Check-in: from ${POLICIES.checkinTime}\n• Check-out: by ${POLICIES.checkoutTime}\n• Address: ${CONTENT.address}\n\nIf you have any questions, feel free to write to us at ${HOST_EMAIL} or call us at ${HOST_PHONE}.\n\nSee you soon!`,
    autoReplyFooter: `${CONTENT.siteTitle.en}\n${CONTENT.locationDisplay}`,
    cancelSubject: (c) => `Booking cancelled · ${c}`,
    cancelBody: (fn, c, ci, co) => `Hello ${fn},\n\nYour booking ${c} (check-in: ${ci}, check-out: ${co}) has been cancelled.`,
    cancelRefundFull: (amt, fee) => `You will receive a refund of €${amt} to your original card within 5–10 business days (${fee}% fee on the stay refund already deducted).`,
    cancelRefundPartial: (amt) => `You will receive a partial 50% refund of €${amt} to your original card within 5–10 business days.`,
    cancelNoRefund: "Under your booking's cancellation policy, no refund is due.",
    cancelCityTaxRefund: (amt) => `The city tax of €${amt}, paid online, will be fully refunded to you separately.`,
    cancelFooter: `For any questions, write to us at ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Manage your booking · ${c}`,
    manageLinkBody: (fn, c) => `Hello ${fn},\n\nYou requested a link to manage your booking (code: ${c}).\n\nClick the button below to view the details and, if you wish, cancel the booking.`,
    manageLinkExpiry: "The link is valid for 30 days.",
    manageLinkDisclaimer: "If you didn't request this link, ignore it — your booking will not be changed.",
  },
  fr: {
    houseName: CONTENT.siteTitle.fr,
    reviewRequestSubject: (c) => `Votre avis · Réservation ${c}`,
    reviewRequestBody: (fn) => `Bonjour ${fn},\n\nnous espérons que votre séjour s'est bien passé. Souhaitez-vous partager votre expérience en quelques lignes ? Cela ne prend qu'une minute.`,
    reviewRequestButton: "Laisser un avis",
    autoReplySubject: (c) => `Demande reçue · ${c}`,
    autoReplyBody: (fn, c, ci, co) => `Bonjour ${fn},\n\nNous avons bien reçu votre demande de réservation (code : ${c}) pour la période du ${ci} au ${co} à ${CONTENT.siteTitle.fr}, ${CONTENT.address}.\n\nNous vous répondrons dans les 24 heures pour confirmer la disponibilité et vous envoyer le lien de paiement de l'acompte.\n\nInformations utiles :\n• Arrivée : à partir de ${POLICIES.checkinTime}\n• Départ : avant ${POLICIES.checkoutTime}\n• Adresse : ${CONTENT.address}\n\nPour toute question, n'hésitez pas à nous écrire à ${HOST_EMAIL} ou à nous appeler au ${HOST_PHONE}.\n\nÀ très bientôt !`,
    autoReplyFooter: `${CONTENT.siteTitle.fr}\n${CONTENT.locationDisplay}`,
    cancelSubject: (c) => `Réservation annulée · ${c}`,
    cancelBody: (fn, c, ci, co) => `Bonjour ${fn},\n\nVotre réservation ${c} (arrivée : ${ci}, départ : ${co}) a été annulée.`,
    cancelRefundFull: (amt, fee) => `Vous recevrez un remboursement de €${amt} sur votre carte d'origine sous 5 à 10 jours ouvrés (frais de ${fee} % sur le remboursement du séjour déjà déduits).`,
    cancelRefundPartial: (amt) => `Vous recevrez un remboursement partiel de 50 % de €${amt} sur votre carte d'origine sous 5 à 10 jours ouvrés.`,
    cancelNoRefund: "Selon la politique d'annulation de votre réservation, aucun remboursement n'est dû.",
    cancelCityTaxRefund: (amt) => `La taxe de séjour de €${amt}, payée en ligne, vous sera intégralement remboursée séparément.`,
    cancelFooter: `Pour toute question, écrivez-nous à ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Gérer votre réservation · ${c}`,
    manageLinkBody: (fn, c) => `Bonjour ${fn},\n\nVous avez demandé le lien pour gérer votre réservation (code : ${c}).\n\nCliquez sur le bouton ci-dessous pour consulter les détails et, si vous le souhaitez, annuler la réservation.`,
    manageLinkExpiry: "Le lien est valable 30 jours.",
    manageLinkDisclaimer: "Si vous n'avez pas demandé ce lien, ignorez-le — votre réservation ne sera pas modifiée.",
  },
  de: {
    houseName: CONTENT.siteTitle.de,
    reviewRequestSubject: (c) => `Ihre Bewertung · Buchung ${c}`,
    reviewRequestBody: (fn) => `Hallo ${fn},\n\nwir hoffen, Ihr Aufenthalt hat Ihnen gefallen. Möchten Sie Ihre Erfahrung in einer kurzen Bewertung teilen? Es dauert nur eine Minute.`,
    reviewRequestButton: "Bewertung abgeben",
    autoReplySubject: (c) => `Anfrage erhalten · ${c}`,
    autoReplyBody: (fn, c, ci, co) => `Hallo ${fn},\n\nWir haben Ihre Buchungsanfrage (Code: ${c}) für den Zeitraum vom ${ci} bis ${co} in ${CONTENT.siteTitle.de}, ${CONTENT.address} erhalten.\n\nWir werden innerhalb von 24 Stunden antworten, um die Verfügbarkeit zu bestätigen und Ihnen den Link zur Anzahlungszahlung zu senden.\n\nNützliche Informationen:\n• Check-in: ab ${POLICIES.checkinTime} Uhr\n• Check-out: bis ${POLICIES.checkoutTime} Uhr\n• Adresse: ${CONTENT.address}\n\nBei Fragen können Sie uns gerne unter ${HOST_EMAIL} schreiben oder uns unter ${HOST_PHONE} anrufen.\n\nBis bald!`,
    autoReplyFooter: `${CONTENT.siteTitle.de}\n${CONTENT.locationDisplay}`,
    cancelSubject: (c) => `Buchung storniert · ${c}`,
    cancelBody: (fn, c, ci, co) => `Hallo ${fn},\n\nIhre Buchung ${c} (Check-in: ${ci}, Check-out: ${co}) wurde storniert.`,
    cancelRefundFull: (amt, fee) => `Sie erhalten eine Erstattung von €${amt} auf Ihre ursprüngliche Karte innerhalb von 5–10 Werktagen (${fee} % Gebühr auf die Aufenthaltserstattung bereits abgezogen).`,
    cancelRefundPartial: (amt) => `Sie erhalten eine anteilige Erstattung von 50 % in Höhe von €${amt} auf Ihre ursprüngliche Karte innerhalb von 5–10 Werktagen.`,
    cancelNoRefund: "Gemäß den Stornierungsbedingungen Ihrer Buchung ist keine Erstattung fällig.",
    cancelCityTaxRefund: (amt) => `Die online bezahlte Kurtaxe von €${amt} wird Ihnen separat vollständig erstattet.`,
    cancelFooter: `Bei Fragen schreiben Sie uns unter ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Buchung verwalten · ${c}`,
    manageLinkBody: (fn, c) => `Hallo ${fn},\n\nSie haben den Link zur Verwaltung Ihrer Buchung (Code: ${c}) angefordert.\n\nKlicken Sie auf die Schaltfläche unten, um die Details einzusehen und die Buchung ggf. zu stornieren.`,
    manageLinkExpiry: "Der Link ist 30 Tage lang gültig.",
    manageLinkDisclaimer: "Wenn Sie diesen Link nicht angefordert haben, ignorieren Sie ihn — Ihre Buchung wird nicht verändert.",
  },
  es: {
    houseName: CONTENT.siteTitle.es,
    reviewRequestSubject: (c) => `Tu reseña · Reserva ${c}`,
    reviewRequestBody: (fn) => `Hola ${fn},\n\nesperamos que hayas disfrutado tu estancia. ¿Te gustaría compartir tu experiencia en una breve reseña? Solo te llevará un minuto.`,
    reviewRequestButton: "Dejar una reseña",
    autoReplySubject: (c) => `Solicitud recibida · ${c}`,
    autoReplyBody: (fn, c, ci, co) => `Hola ${fn},\n\nHemos recibido tu solicitud de reserva (código: ${c}) para el período del ${ci} al ${co} en ${CONTENT.siteTitle.es}, ${CONTENT.address}.\n\nTe responderemos en 24 horas para confirmar la disponibilidad y enviarte el enlace de pago del depósito.\n\nInformación útil:\n• Check-in: a partir de las ${POLICIES.checkinTime}\n• Check-out: antes de las ${POLICIES.checkoutTime}\n• Dirección: ${CONTENT.address}\n\nSi tienes alguna pregunta no dudes en escribirnos a ${HOST_EMAIL} o llamarnos al ${HOST_PHONE}.\n\n¡Hasta pronto!`,
    autoReplyFooter: `${CONTENT.siteTitle.es}\n${CONTENT.locationDisplay}`,
    cancelSubject: (c) => `Reserva cancelada · ${c}`,
    cancelBody: (fn, c, ci, co) => `Hola ${fn},\n\nTu reserva ${c} (llegada: ${ci}, salida: ${co}) ha sido cancelada.`,
    cancelRefundFull: (amt, fee) => `Recibirás un reembolso de €${amt} en tu tarjeta original en 5–10 días hábiles (${fee}% de comisión sobre el reembolso de la estancia ya descontado).`,
    cancelRefundPartial: (amt) => `Recibirás un reembolso parcial del 50% de €${amt} en tu tarjeta original en 5–10 días hábiles.`,
    cancelNoRefund: "Según la política de cancelación de tu reserva, no corresponde ningún reembolso.",
    cancelCityTaxRefund: (amt) => `La tasa turística de €${amt}, pagada online, se te reembolsará íntegramente por separado.`,
    cancelFooter: `Para cualquier consulta escríbenos a ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Gestiona tu reserva · ${c}`,
    manageLinkBody: (fn, c) => `Hola ${fn},\n\nHas solicitado el enlace para gestionar tu reserva (código: ${c}).\n\nHaz clic en el botón de abajo para ver los detalles y, si lo deseas, cancelar la reserva.`,
    manageLinkExpiry: "El enlace es válido durante 30 días.",
    manageLinkDisclaimer: "Si no has solicitado este enlace, ignóralo — tu reserva no será modificada.",
  },
  pt: {
    houseName: CONTENT.siteTitle.pt,
    reviewRequestSubject: (c) => `A sua avaliação · Reserva ${c}`,
    reviewRequestBody: (fn) => `Olá ${fn},\n\nesperamos que a sua estadia tenha sido agradável. Gostaria de partilhar a sua experiência numa breve avaliação? Demora apenas um minuto.`,
    reviewRequestButton: "Deixar uma avaliação",
    autoReplySubject: (c) => `Pedido recebido · ${c}`,
    autoReplyBody: (fn, c, ci, co) => `Olá ${fn},\n\nRecebemos o seu pedido de reserva (código: ${c}) para o período de ${ci} a ${co} em ${CONTENT.siteTitle.pt}, ${CONTENT.address}.\n\nResponderemos em 24 horas para confirmar a disponibilidade e enviar-lhe o link de pagamento do sinal.\n\nInformações úteis:\n• Check-in: a partir das ${POLICIES.checkinTime}\n• Check-out: até às ${POLICIES.checkoutTime}\n• Morada: ${CONTENT.address}\n\nPara qualquer questão não hesite em escrever-nos para ${HOST_EMAIL} ou ligar para ${HOST_PHONE}.\n\nAté breve!`,
    autoReplyFooter: `${CONTENT.siteTitle.pt}\n${CONTENT.locationDisplay}`,
    cancelSubject: (c) => `Reserva cancelada · ${c}`,
    cancelBody: (fn, c, ci, co) => `Olá ${fn},\n\nA sua reserva ${c} (check-in: ${ci}, check-out: ${co}) foi cancelada.`,
    cancelRefundFull: (amt, fee) => `Receberá um reembolso de €${amt} no seu cartão original em 5–10 dias úteis (taxa de ${fee}% sobre o reembolso da estadia já deduzida).`,
    cancelRefundPartial: (amt) => `Receberá um reembolso parcial de 50% de €${amt} no seu cartão original em 5–10 dias úteis.`,
    cancelNoRefund: "De acordo com a política de cancelamento da sua reserva, não é devido qualquer reembolso.",
    cancelCityTaxRefund: (amt) => `A taxa turística de €${amt}, paga online, ser-lhe-á integralmente reembolsada separadamente.`,
    cancelFooter: `Para qualquer dúvida escreva-nos para ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Gerir a sua reserva · ${c}`,
    manageLinkBody: (fn, c) => `Olá ${fn},\n\nSolicitou o link para gerir a sua reserva (código: ${c}).\n\nClique no botão abaixo para ver os detalhes e, se desejar, cancelar a reserva.`,
    manageLinkExpiry: "O link é válido por 30 dias.",
    manageLinkDisclaimer: "Se não solicitou este link, ignore-o — a sua reserva não será alterada.",
  },
  zh: {
    houseName: CONTENT.siteTitle.zh,
    reviewRequestSubject: (c) => `您的评价 · 预订 ${c}`,
    reviewRequestBody: (fn) => `您好 ${fn}，\n\n希望您入住愉快。愿意用简短的评价分享您的体验吗？只需一分钟。`,
    reviewRequestButton: "留下评价",
    autoReplySubject: (c) => `预订申请已收到 · ${c}`,
    autoReplyBody: (fn, c, ci, co) => `您好 ${fn},\n\n我们已收到您的预订申请（代码：${c}），入住期间为 ${ci} 至 ${co}，地点：${CONTENT.siteTitle.zh}，${CONTENT.address}。\n\n我们将在24小时内回复以确认是否有空，并向您发送定金支付链接。\n\n实用信息：\n• 入住时间：${POLICIES.checkinTime} 起\n• 退房时间：${POLICIES.checkoutTime} 前\n• 地址：${CONTENT.address}\n\n如有任何疑问，请随时发送邮件至 ${HOST_EMAIL} 或致电 ${HOST_PHONE}。\n\n期待您的到来！`,
    autoReplyFooter: `${CONTENT.siteTitle.zh}\n${CONTENT.locationDisplay}`,
    cancelSubject: (c) => `预订已取消 · ${c}`,
    cancelBody: (fn, c, ci, co) => `您好 ${fn},\n\n您的预订 ${c}（入住：${ci}，退房：${co}）已被取消。`,
    cancelRefundFull: (amt, fee) => `您将在5–10个工作日内收到 €${amt} 的退款至原始卡片（已扣除住宿退款的 ${fee}% 手续费）。`,
    cancelRefundPartial: (amt) => `您将在5–10个工作日内收到50%的部分退款 €${amt} 至原始卡片。`,
    cancelNoRefund: "根据您预订的取消政策，不予退款。",
    cancelCityTaxRefund: (amt) => `已在线支付的城市税 €${amt} 将单独全额退还给您。`,
    cancelFooter: `如有任何疑问，请发送邮件至 ${HOST_EMAIL}。`,
    manageLinkSubject: (c) => `管理您的预订 · ${c}`,
    manageLinkBody: (fn, c) => `您好 ${fn},\n\n您申请了管理预订的链接（代码：${c}）。\n\n请点击下方按钮查看详情，如需取消预订请点击相应选项。`,
    manageLinkExpiry: "该链接有效期为30天。",
    manageLinkDisclaimer: "若您未申请此链接，请忽略——您的预订不会被更改。",
  },
  ja: {
    houseName: CONTENT.siteTitle.ja,
    reviewRequestSubject: (c) => `ご感想をお聞かせください · 予約 ${c}`,
    reviewRequestBody: (fn) => `${fn}様\n\nご滞在はいかがでしたか。よろしければ短いレビューでご感想をお聞かせください。1分ほどで完了します。`,
    reviewRequestButton: "レビューを書く",
    autoReplySubject: (c) => `ご予約リクエストを受け付けました · ${c}`,
    autoReplyBody: (fn, c, ci, co) => `${fn}様\n\nご予約リクエスト（コード：${c}）を受け付けました。ご滞在期間：${ci}〜${co}、${CONTENT.siteTitle.ja}（${CONTENT.address}）。\n\n24時間以内に空室状況をご確認のうえ、ご連絡と手付金のお支払いリンクをお送りいたします。\n\nご参考情報：\n• チェックイン：${POLICIES.checkinTime}以降\n• チェックアウト：${POLICIES.checkoutTime}まで\n• 住所：${CONTENT.address}\n\nご質問がございましたら ${HOST_EMAIL} にメールいただくか、${HOST_PHONE} までお電話ください。\n\nお会いできることを楽しみにしております！`,
    autoReplyFooter: `${CONTENT.siteTitle.ja}\n${CONTENT.locationDisplay}`,
    cancelSubject: (c) => `ご予約がキャンセルされました · ${c}`,
    cancelBody: (fn, c, ci, co) => `${fn}様\n\nご予約 ${c}（チェックイン：${ci}、チェックアウト：${co}）がキャンセルされました。`,
    cancelRefundFull: (amt, fee) => `€${amt} のご返金を5〜10営業日以内に元のカードにお振り込みします（宿泊料金の返金にかかる${fee}%の手数料は差引済みです）。`,
    cancelRefundPartial: (amt) => `50%の一部返金として €${amt} を5〜10営業日以内に元のカードにお振り込みします。`,
    cancelNoRefund: "ご予約のキャンセルポリシーにより、返金はございません。",
    cancelCityTaxRefund: (amt) => `オンラインで支払われた宿泊税 €${amt} は、別途全額返金されます。`,
    cancelFooter: `ご質問は ${HOST_EMAIL} までご連絡ください。`,
    manageLinkSubject: (c) => `ご予約の管理 · ${c}`,
    manageLinkBody: (fn, c) => `${fn}様\n\nご予約（コード：${c}）の管理リンクをリクエストいただきました。\n\n下のボタンをクリックして詳細をご確認いただき、必要であればキャンセルも可能です。`,
    manageLinkExpiry: "リンクの有効期限は30日間です。",
    manageLinkDisclaimer: "このリンクをリクエストしていない場合は無視してください。ご予約は変更されません。",
  },
  ko: {
    houseName: CONTENT.siteTitle.ko,
    reviewRequestSubject: (c) => `리뷰를 남겨주세요 · 예약 ${c}`,
    reviewRequestBody: (fn) => `안녕하세요 ${fn}님,\n\n즐거운 숙박이 되셨기를 바랍니다. 짧은 리뷰로 경험을 공유해 주시겠어요? 1분이면 충분합니다.`,
    reviewRequestButton: "리뷰 남기기",
    autoReplySubject: (c) => `예약 요청을 받았습니다 · ${c}`,
    autoReplyBody: (fn, c, ci, co) => `안녕하세요 ${fn}님,\n\n예약 요청(코드: ${c})을 받았습니다. 체크인: ${ci}, 체크아웃: ${co}, 숙소: ${CONTENT.siteTitle.ko}(${CONTENT.address}).\n\n24시간 이내에 가능 여부를 확인하여 예약금 결제 링크와 함께 답변 드리겠습니다.\n\n안내 정보:\n• 체크인: ${POLICIES.checkinTime}부터\n• 체크아웃: ${POLICIES.checkoutTime}까지\n• 주소: ${CONTENT.address}\n\n문의 사항이 있으시면 ${HOST_EMAIL}로 이메일을 보내시거나 ${HOST_PHONE}으로 전화해 주세요.\n\n곧 뵙겠습니다!`,
    autoReplyFooter: `${CONTENT.siteTitle.ko}\n${CONTENT.locationDisplay}`,
    cancelSubject: (c) => `예약이 취소되었습니다 · ${c}`,
    cancelBody: (fn, c, ci, co) => `안녕하세요 ${fn}님,\n\n예약 ${c}(체크인: ${ci}, 체크아웃: ${co})이 취소되었습니다.`,
    cancelRefundFull: (amt, fee) => `€${amt}가 5~10 영업일 이내에 원래 카드로 환불됩니다(숙박 환불에 대한 ${fee}% 수수료 차감 완료).`,
    cancelRefundPartial: (amt) => `50% 부분 환불 €${amt}가 5~10 영업일 이내에 원래 카드로 환불됩니다.`,
    cancelNoRefund: "예약의 취소 정책에 따라 환불이 발생하지 않습니다.",
    cancelCityTaxRefund: (amt) => `온라인으로 결제한 관광세 €${amt}는 별도로 전액 환불됩니다.`,
    cancelFooter: `문의 사항은 ${HOST_EMAIL}로 연락해 주세요.`,
    manageLinkSubject: (c) => `예약 관리 · ${c}`,
    manageLinkBody: (fn, c) => `안녕하세요 ${fn}님,\n\n예약(코드: ${c}) 관리 링크를 요청하셨습니다.\n\n아래 버튼을 클릭하여 세부 정보를 확인하고 원하시면 취소하실 수 있습니다.`,
    manageLinkExpiry: "링크는 30일 동안 유효합니다.",
    manageLinkDisclaimer: "이 링크를 요청하지 않으셨다면 무시하세요 — 예약은 변경되지 않습니다.",
  },
};

export function getExtraEmailStrings(locale: LocaleCode): ExtraStrings {
  return EXTRA[locale] ?? EXTRA.it;
}

export { HOST_EMAIL };
