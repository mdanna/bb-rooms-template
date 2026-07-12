import type { LocaleCode } from "@/i18n/index";
import { formatFriendlyDateOnly } from "./emailDates";
import { POLICIES } from "./policies";
import { CONTENT } from "./siteContent";

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
  depositAmount: number | null;
  balanceDue: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  guests?: number;
}

interface PaymentConfirmationParams {
  code: string;
  firstName: string;
  lastName: string;
  checkin: string;
  checkout: string;
  totalPrice: number | null;
  depositAmount: number | null;
  balanceDue: number | null;
  cityTax: number | null;
  cityTaxOnline?: boolean | null;
  guests: number;
  paymentMethod: string;
  confirmationUrl: string;
  manageUrl: string;
}

// Frasi aggiuntive su anticipo/saldo/tassa di soggiorno, riutilizzate sia nell'email di
// approvazione (prima del pagamento) sia in quella di conferma pagamento (dopo).
// La tassa di soggiorno NON è inclusa nel saldo online: viene riscossa separatamente
// al check-in (contanti o carta) e avrà una ricevuta dedicata.
interface DepositStrings {
  depositDue: (totalPrice: number) => string;
  refundPolicy: string;
  balanceBeforeCheckin: (balanceDue: number) => string;
  cityTaxNote: (cityTax: number, guests: number) => string;
  // Variante Opzione A (tassa online): tassa inclusa nel pagamento online come voce separata,
  // NON riscossa al check-in. Popolata in tutte le 9 lingue.
  cityTaxOnlineNote: (cityTax: number, guests: number) => string;
  depositPaidConfirmation: (depositAmount: number) => string;
}

function buildDepositStrings(): Record<LocaleCode, DepositStrings> {
  const p = POLICIES;
  const minPct = Math.round(p.minDepositRate * 100);
  const fee = p.cancelFeePercent;
  const full = p.cancelFullRefundDays;
  const half = p.cancelHalfRefundDays;
  const partial = p.cancelPartialRefundPct;
  const bal = p.balanceDueDays;
  return {
    it: {
      depositDue: (t) => `Per confermare la prenotazione puoi scegliere di versare un anticipo (minimo ${minPct}% di €${t}) o l'intero importo.`,
      refundPolicy: `Policy di cancellazione: rimborso completo (meno ${fee}% di spese) fino a ${full} giorni prima del check-in; rimborso del ${partial}% (meno ${fee}% di spese) da ${half} a ${full} giorni prima; nessun rimborso nelle ultime 48 ore.`,
      balanceBeforeCheckin: (b) => b > 0 ? `Il saldo rimanente di €${b} dovrà essere versato entro ${bal} giorni prima del check-in.` : "",
      cityTaxNote: (t, g) => `La tassa di soggiorno (€${t} per ${g} ospiti) verrà riscossa separatamente al check-in e avrà una ricevuta dedicata.`,
      cityTaxOnlineNote: (t, g) => `La tassa di soggiorno (€${t} per ${g} ospiti) è inclusa nel pagamento online come voce separata; non è dovuto alcun importo aggiuntivo al check-in.`,
      depositPaidConfirmation: (d) => `Anticipo pagato: €${d}.`,
    },
    en: {
      depositDue: (t) => `To confirm your booking, you can choose to pay a deposit (minimum ${minPct}% of €${t}) or the full amount.`,
      refundPolicy: `Cancellation policy: full refund (minus ${fee}% fee) up to ${full} days before check-in; ${partial}% refund (minus ${fee}% fee) from ${half} to ${full} days before; no refund within 48 hours.`,
      balanceBeforeCheckin: (b) => b > 0 ? `The remaining balance of €${b} must be paid no later than ${bal} days before check-in, in cash or by card.` : "",
      cityTaxNote: (t, g) => `The city tax (€${t} for ${g} guests) will be collected separately at check-in and will have its own receipt.`,
      cityTaxOnlineNote: (t, g) => `The city tax (€${t} for ${g} guests) is included in your online payment as a separate item; no additional amount is due at check-in.`,
      depositPaidConfirmation: (d) => `Deposit paid: €${d}.`,
    },
    fr: {
      depositDue: (t) => `Pour confirmer votre réservation, vous pouvez choisir de payer un acompte (minimum ${minPct} % de €${t}) ou la totalité.`,
      refundPolicy: `Politique d'annulation : remboursement complet (moins ${fee} % de frais) jusqu'à ${full} jours avant l'arrivée ; remboursement à ${partial} % (moins ${fee} % de frais) entre ${half} et ${full} jours avant ; aucun remboursement dans les 48 heures.`,
      balanceBeforeCheckin: (b) => b > 0 ? `Le solde restant de €${b} devra être réglé au plus tard ${bal} jours avant l'arrivée, en espèces ou par carte.` : "",
      cityTaxNote: (t, g) => `La taxe de séjour (€${t} pour ${g} personnes) sera encaissée séparément à l'arrivée et fera l'objet d'un reçu distinct.`,
      cityTaxOnlineNote: (t, g) => `La taxe de séjour (€${t} pour ${g} personnes) est incluse dans le paiement en ligne en tant qu'article distinct ; aucun montant supplémentaire n'est dû à l'arrivée.`,
      depositPaidConfirmation: (d) => `Acompte payé : €${d}.`,
    },
    de: {
      depositDue: (t) => `Um Ihre Buchung zu bestätigen, können Sie eine Anzahlung (mind. ${minPct} % von €${t}) oder den Gesamtbetrag leisten.`,
      refundPolicy: `Stornierungsbedingungen: volle Rückerstattung (abzüglich ${fee} % Bearbeitungsgebühr) bis ${full} Tage vor Anreise; ${partial} % Rückerstattung (abzüglich ${fee} % Gebühr) zwischen ${half} und ${full} Tagen vor Anreise; keine Rückerstattung in den letzten 48 Stunden.`,
      balanceBeforeCheckin: (b) => b > 0 ? `Der Restbetrag von €${b} ist spätestens ${bal} Tage vor der Anreise bar oder mit Karte zu zahlen.` : "",
      cityTaxNote: (t, g) => `Die Kurtaxe (€${t} für ${g} Gäste) wird bei der Anreise separat erhoben und erhält eine eigene Quittung.`,
      cityTaxOnlineNote: (t, g) => `Die Kurtaxe (€${t} für ${g} Gäste) ist als separate Position in der Online-Zahlung enthalten; bei der Anreise ist kein zusätzlicher Betrag fällig.`,
      depositPaidConfirmation: (d) => `Anzahlung bezahlt: €${d}.`,
    },
    es: {
      depositDue: (t) => `Para confirmar tu reserva, puedes elegir pagar un depósito (mínimo el ${minPct} % de €${t}) o el importe completo.`,
      refundPolicy: `Política de cancelación: reembolso completo (menos el ${fee} % de gastos de gestión) hasta ${full} días antes del check-in; reembolso del ${partial} % (menos ${fee} % de gastos) entre ${half} y ${full} días antes; sin reembolso en las últimas 48 horas.`,
      balanceBeforeCheckin: (b) => b > 0 ? `El saldo restante de €${b} deberá pagarse en efectivo o con tarjeta como máximo ${bal} días antes del check-in.` : "",
      cityTaxNote: (t, g) => `La tasa turística (€${t} para ${g} huéspedes) se cobrará por separado al hacer el check-in y tendrá su propio recibo.`,
      cityTaxOnlineNote: (t, g) => `La tasa turística (€${t} para ${g} huéspedes) está incluida en el pago online como concepto separado; no se debe pagar ningún importe adicional al hacer el check-in.`,
      depositPaidConfirmation: (d) => `Depósito pagado: €${d}.`,
    },
    pt: {
      depositDue: (t) => `Para confirmar a sua reserva, pode optar por pagar um depósito (mínimo ${minPct} % de €${t}) ou o valor total.`,
      refundPolicy: `Política de cancelamento: reembolso total (menos ${fee} % de taxa) até ${full} dias antes do check-in; reembolso de ${partial} % (menos ${fee} % de taxa) entre ${half} e ${full} dias antes; sem reembolso nas últimas 48 horas.`,
      balanceBeforeCheckin: (b) => b > 0 ? `O saldo restante de €${b} deverá ser pago em dinheiro ou cartão até ${bal} dias antes do check-in.` : "",
      cityTaxNote: (t, g) => `A taxa turística (€${t} para ${g} hóspedes) será cobrada separadamente no check-in e terá um recibo próprio.`,
      cityTaxOnlineNote: (t, g) => `A taxa turística (€${t} para ${g} hóspedes) está incluída no pagamento online como item separado; não é devido qualquer valor adicional no check-in.`,
      depositPaidConfirmation: (d) => `Depósito pago: €${d}.`,
    },
    zh: {
      depositDue: (t) => `为确认预订,您可以选择支付定金(最低 €${t} 的${minPct}%)或全额付款。`,
      refundPolicy: `取消政策:入住前${full}天以上可全额退款(扣除${fee}%手续费);入住前${half}至${full}天退款${partial}%(扣除${fee}%手续费);48小时内取消不予退款。`,
      balanceBeforeCheckin: (b) => b > 0 ? `剩余余额 €${b} 须在入住前${bal}天内以现金或银行卡结清。` : "",
      cityTaxNote: (t, g) => `城市税(${g}位客人共 €${t})将在入住时单独收取,并提供单独的收据。`,
      cityTaxOnlineNote: (t, g) => `城市税(${g}位客人共 €${t})已作为单独项目包含在您的在线付款中;入住时无需支付额外费用。`,
      depositPaidConfirmation: (d) => `已付定金:€${d}。`,
    },
    ja: {
      depositDue: (t) => `ご予約の確定には、€${t} の${minPct}%以上の保証金または全額をお支払いいただけます。`,
      refundPolicy: `キャンセルポリシー:チェックイン${full}日以上前のキャンセルは全額返金(手数料${fee}%差引);${half}〜${full}日前は${partial}%返金(手数料${fee}%差引);48時間以内はご返金不可。`,
      balanceBeforeCheckin: (b) => b > 0 ? `残額 €${b} は、チェックインの${bal}日前までに現金またはカードでお支払いください。` : "",
      cityTaxNote: (t, g) => `宿泊税(${g}名様分 €${t})はチェックイン時に別途徴収され、別途領収書が発行されます。`,
      cityTaxOnlineNote: (t, g) => `宿泊税(${g}名様分 €${t})はオンライン決済に別項目として含まれています。チェックイン時の追加のお支払いは不要です。`,
      depositPaidConfirmation: (d) => `お支払い済みの保証金:€${d}。`,
    },
    ko: {
      depositDue: (t) => `예약을 확정하려면 €${t}의 ${minPct}% 이상 보증금 또는 전액을 결제하실 수 있습니다.`,
      refundPolicy: `취소 정책: 체크인 ${full}일 이전 취소 시 전액 환불(${fee}% 수수료 제외); ${half}~${full}일 전 취소 시 ${partial}% 환불(${fee}% 수수료 제외); 48시간 이내 취소 시 환불 불가.`,
      balanceBeforeCheckin: (b) => b > 0 ? `잔액 €${b}는 체크인 ${bal}일 전까지 현금 또는 카드로 납부해 주세요.` : "",
      cityTaxNote: (t, g) => `도시세(${g}명 €${t})는 체크인 시 별도로 징수되며 별도 영수증이 발급됩니다.`,
      cityTaxOnlineNote: (t, g) => `도시세(${g}명 €${t})는 온라인 결제에 별도 항목으로 포함되어 있습니다. 체크인 시 추가로 지불하실 금액은 없습니다.`,
      depositPaidConfirmation: (d) => `결제된 보증금: €${d}.`,
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
    approval: ({ code, payUrl, manageUrl, totalPrice, balanceDue, cityTax, cityTaxOnline, guests }) => ({
      subject: `Prenotazione ${code} approvata · completa il pagamento`,
      text: [
        "Gentile ospite,",
        "",
        `Buone notizie! La tua richiesta di prenotazione ${code} è stata approvata.`,
        totalPrice ? `Totale soggiorno: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.it.depositDue(totalPrice) : null,
        DEPOSIT_STRINGS.it.refundPolicy,
        balanceDue != null && balanceDue > 0 ? DEPOSIT_STRINGS.it.balanceBeforeCheckin(balanceDue) : null,
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
        p.depositAmount ? DEPOSIT_STRINGS.it.depositPaidConfirmation(p.depositAmount) : null,
        p.balanceDue != null ? DEPOSIT_STRINGS.it.balanceBeforeCheckin(p.balanceDue) : null,
        p.cityTax != null ? cityTaxNoteFor("it", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.it.refundPolicy,
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
    approval: ({ code, payUrl, manageUrl, totalPrice, balanceDue, cityTax, cityTaxOnline, guests }) => ({
      subject: `Booking ${code} approved · complete your payment`,
      text: [
        "Dear guest,",
        "",
        `Good news! Your booking request ${code} has been approved.`,
        totalPrice ? `Total stay price: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.en.depositDue(totalPrice) : null,
        DEPOSIT_STRINGS.en.refundPolicy,
        balanceDue != null && balanceDue > 0 ? DEPOSIT_STRINGS.en.balanceBeforeCheckin(balanceDue) : null,
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
        p.depositAmount ? DEPOSIT_STRINGS.en.depositPaidConfirmation(p.depositAmount) : null,
        p.balanceDue != null ? DEPOSIT_STRINGS.en.balanceBeforeCheckin(p.balanceDue) : null,
        p.cityTax != null ? cityTaxNoteFor("en", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.en.refundPolicy,
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
    approval: ({ code, payUrl, manageUrl, totalPrice, balanceDue, cityTax, cityTaxOnline, guests }) => ({
      subject: `Réservation ${code} approuvée · finalisez le paiement`,
      text: [
        "Cher hôte,",
        "",
        `Bonne nouvelle ! Votre demande de réservation ${code} a été approuvée.`,
        totalPrice ? `Prix total du séjour : €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.fr.depositDue(totalPrice) : null,
        DEPOSIT_STRINGS.fr.refundPolicy,
        balanceDue != null && balanceDue > 0 ? DEPOSIT_STRINGS.fr.balanceBeforeCheckin(balanceDue) : null,
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
        p.depositAmount ? DEPOSIT_STRINGS.fr.depositPaidConfirmation(p.depositAmount) : null,
        p.balanceDue != null ? DEPOSIT_STRINGS.fr.balanceBeforeCheckin(p.balanceDue) : null,
        p.cityTax != null ? cityTaxNoteFor("fr", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.fr.refundPolicy,
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
    approval: ({ code, payUrl, manageUrl, totalPrice, balanceDue, cityTax, cityTaxOnline, guests }) => ({
      subject: `Buchung ${code} genehmigt · Zahlung abschließen`,
      text: [
        "Liebe Gäste,",
        "",
        `Gute Nachrichten! Ihre Buchungsanfrage ${code} wurde genehmigt.`,
        totalPrice ? `Gesamtpreis des Aufenthalts: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.de.depositDue(totalPrice) : null,
        DEPOSIT_STRINGS.de.refundPolicy,
        balanceDue != null && balanceDue > 0 ? DEPOSIT_STRINGS.de.balanceBeforeCheckin(balanceDue) : null,
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
        p.depositAmount ? DEPOSIT_STRINGS.de.depositPaidConfirmation(p.depositAmount) : null,
        p.balanceDue != null ? DEPOSIT_STRINGS.de.balanceBeforeCheckin(p.balanceDue) : null,
        p.cityTax != null ? cityTaxNoteFor("de", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.de.refundPolicy,
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
    approval: ({ code, payUrl, manageUrl, totalPrice, balanceDue, cityTax, cityTaxOnline, guests }) => ({
      subject: `Reserva ${code} aprobada · completa el pago`,
      text: [
        "Estimado huésped,",
        "",
        `¡Buenas noticias! Tu solicitud de reserva ${code} ha sido aprobada.`,
        totalPrice ? `Precio total de la estancia: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.es.depositDue(totalPrice) : null,
        DEPOSIT_STRINGS.es.refundPolicy,
        balanceDue != null && balanceDue > 0 ? DEPOSIT_STRINGS.es.balanceBeforeCheckin(balanceDue) : null,
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
        p.depositAmount ? DEPOSIT_STRINGS.es.depositPaidConfirmation(p.depositAmount) : null,
        p.balanceDue != null ? DEPOSIT_STRINGS.es.balanceBeforeCheckin(p.balanceDue) : null,
        p.cityTax != null ? cityTaxNoteFor("es", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.es.refundPolicy,
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
    approval: ({ code, payUrl, manageUrl, totalPrice, balanceDue, cityTax, cityTaxOnline, guests }) => ({
      subject: `Reserva ${code} aprovada · conclua o pagamento`,
      text: [
        "Prezado hóspede,",
        "",
        `Boas notícias! Sua solicitação de reserva ${code} foi aprovada.`,
        totalPrice ? `Preço total da estadia: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.pt.depositDue(totalPrice) : null,
        DEPOSIT_STRINGS.pt.refundPolicy,
        balanceDue != null && balanceDue > 0 ? DEPOSIT_STRINGS.pt.balanceBeforeCheckin(balanceDue) : null,
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
        p.depositAmount ? DEPOSIT_STRINGS.pt.depositPaidConfirmation(p.depositAmount) : null,
        p.balanceDue != null ? DEPOSIT_STRINGS.pt.balanceBeforeCheckin(p.balanceDue) : null,
        p.cityTax != null ? cityTaxNoteFor("pt", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.pt.refundPolicy,
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
    approval: ({ code, payUrl, manageUrl, totalPrice, balanceDue, cityTax, cityTaxOnline, guests }) => ({
      subject: `预订 ${code} 已批准 · 请完成付款`,
      text: [
        "尊敬的客人,",
        "",
        `好消息!您的预订申请 ${code} 已被批准。`,
        totalPrice ? `住宿总价:€${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.zh.depositDue(totalPrice) : null,
        DEPOSIT_STRINGS.zh.refundPolicy,
        balanceDue != null && balanceDue > 0 ? DEPOSIT_STRINGS.zh.balanceBeforeCheckin(balanceDue) : null,
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
        p.depositAmount ? DEPOSIT_STRINGS.zh.depositPaidConfirmation(p.depositAmount) : null,
        p.balanceDue != null ? DEPOSIT_STRINGS.zh.balanceBeforeCheckin(p.balanceDue) : null,
        p.cityTax != null ? cityTaxNoteFor("zh", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.zh.refundPolicy,
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
    approval: ({ code, payUrl, manageUrl, totalPrice, balanceDue, cityTax, cityTaxOnline, guests }) => ({
      subject: `予約 ${code} が承認されました · お支払いを完了してください`,
      text: [
        "ゲスト様",
        "",
        `朗報です!ご予約リクエスト ${code} が承認されました。`,
        totalPrice ? `宿泊合計金額:€${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.ja.depositDue(totalPrice) : null,
        DEPOSIT_STRINGS.ja.refundPolicy,
        balanceDue != null && balanceDue > 0 ? DEPOSIT_STRINGS.ja.balanceBeforeCheckin(balanceDue) : null,
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
        p.depositAmount ? DEPOSIT_STRINGS.ja.depositPaidConfirmation(p.depositAmount) : null,
        p.balanceDue != null ? DEPOSIT_STRINGS.ja.balanceBeforeCheckin(p.balanceDue) : null,
        p.cityTax != null ? cityTaxNoteFor("ja", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.ja.refundPolicy,
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
    approval: ({ code, payUrl, manageUrl, totalPrice, balanceDue, cityTax, cityTaxOnline, guests }) => ({
      subject: `예약 ${code} 승인됨 · 결제를 완료해 주세요`,
      text: [
        "친애하는 고객님,",
        "",
        `좋은 소식입니다! 예약 요청 ${code}이(가) 승인되었습니다.`,
        totalPrice ? `숙박 총액: €${totalPrice}` : null,
        totalPrice ? DEPOSIT_STRINGS.ko.depositDue(totalPrice) : null,
        DEPOSIT_STRINGS.ko.refundPolicy,
        balanceDue != null && balanceDue > 0 ? DEPOSIT_STRINGS.ko.balanceBeforeCheckin(balanceDue) : null,
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
        p.depositAmount ? DEPOSIT_STRINGS.ko.depositPaidConfirmation(p.depositAmount) : null,
        p.balanceDue != null ? DEPOSIT_STRINGS.ko.balanceBeforeCheckin(p.balanceDue) : null,
        p.cityTax != null ? cityTaxNoteFor("ko", p.cityTax, p.guests, p.cityTaxOnline) : null,
        DEPOSIT_STRINGS.ko.refundPolicy,
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
  cancelRefundEligible: (amount: string, feePercent: number) => string;
  cancelRefundFeeNote: (feePercent: number) => string;
  cancelNoRefundLate: string;
  cancelNoRefundNoDeposit: string;
  cancelFooter: string;
  manageLinkSubject: (code: string) => string;
  manageLinkBody: (firstName: string, code: string) => string;
  manageLinkExpiry: string;
  manageLinkDisclaimer: string;
  reviewRequestSubject: (code: string) => string;
  reviewRequestBody: (firstName: string) => string;
  reviewRequestButton: string;
  balanceReminderSubject: (code: string) => string;
  balanceReminderBody: (firstName: string, code: string, checkin: string) => string;
  balanceReminderAmount: (amount: string) => string;
  balanceReminderNoDue: string;
  balanceReminderFullyPaid: string;
  balanceReminderCityTax: (amount: string) => string;
  balanceReminderButton: string;
  balanceReminderAlternative: string;
  balanceReceiptSubject: (code: string) => string;
  balanceReceiptGreeting: (firstName: string, lastName: string, code: string) => string;
  balanceReceiptCheckin: string;
  balanceReceiptCheckout: string;
  balanceReceiptTotalStay: string;
  balanceReceiptBalancePaid: string;
  balanceReceiptCityTax: (guests: number) => string;
  balanceReceiptButton: string;
  balanceReceiptManageButton: string;
  balanceReceiptClosing: string;
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
    cancelRefundEligible: (amt, fee) => `Riceverai un rimborso di €${amt} sulla carta originale entro 5–10 giorni lavorativi (trattenuta del ${fee}% per spese di gestione).`,
    cancelRefundFeeNote: (fee) => `Trattenuta del ${fee}% per spese di gestione già detratta.`,
    cancelNoRefundLate: "In base alla nostra policy, la cancellazione nelle ultime 48 ore prima del check-in non dà diritto a rimborso.",
    cancelNoRefundNoDeposit: "Non hai ancora versato l'anticipo, quindi non è previsto alcun rimborso.",
    cancelFooter: `Per qualsiasi domanda scrivici a ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Gestione prenotazione · ${c}`,
    manageLinkBody: (fn, c) => `Ciao ${fn},\n\nHai richiesto il link per gestire la tua prenotazione (codice: ${c}).\n\nClicca sul pulsante qui sotto per visualizzare i dettagli e, se vuoi, cancellare la prenotazione.`,
    manageLinkExpiry: "Il link è valido per 30 giorni.",
    manageLinkDisclaimer: "Se non hai richiesto tu questo link, ignoralo — la tua prenotazione non verrà modificata.",
    balanceReminderSubject: (c) => `Promemoria saldo · Prenotazione ${c}`,
    balanceReminderBody: (fn, c, ci) => `Ciao ${fn},\n\nIl tuo check-in per la prenotazione ${c} è previsto tra 5 giorni (${ci}).`,
    balanceReminderAmount: (amt) => `Saldo da pagare: €${amt}`,
    balanceReminderNoDue: "Saldo da versare prima del check-in.",
    balanceReminderFullyPaid: "L'importo è stato completamente saldato: non è previsto alcun pagamento prima del check-in.",
    balanceReminderCityTax: (amt) => `Tassa di soggiorno: €${amt} — riscossa separatamente al check-in.`,
    balanceReminderButton: "Paga il saldo online",
    balanceReminderAlternative: "In alternativa, potrai saldare in contanti o con carta direttamente al check-in.",
    balanceReceiptSubject: (c) => `Ricevuta saldo · Prenotazione ${c}`,
    balanceReceiptGreeting: (fn, ln, c) => `Gentile ${fn} ${ln}, il pagamento del saldo per la prenotazione ${c} è stato completato.`,
    balanceReceiptCheckin: "Check-in",
    balanceReceiptCheckout: "Check-out",
    balanceReceiptTotalStay: "Costo soggiorno totale",
    balanceReceiptBalancePaid: "Saldo pagato online",
    balanceReceiptCityTax: (g) => `Tassa di soggiorno (${g} ospiti)`,
    balanceReceiptButton: "Scarica ricevuta PDF",
    balanceReceiptManageButton: "Gestisci la prenotazione",
    balanceReceiptClosing: `A presto!\n${CONTENT.siteTitle.it}\n${CONTENT.email} · ${CONTENT.phone}`,
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
    cancelRefundEligible: (amt, fee) => `You will receive a refund of €${amt} to your original card within 5–10 business days (${fee}% handling fee already deducted).`,
    cancelRefundFeeNote: (fee) => `${fee}% handling fee already deducted.`,
    cancelNoRefundLate: "According to our policy, cancellations within 48 hours of check-in are not eligible for a refund.",
    cancelNoRefundNoDeposit: "You haven't paid the deposit yet, so no refund is applicable.",
    cancelFooter: `For any questions, write to us at ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Manage your booking · ${c}`,
    manageLinkBody: (fn, c) => `Hello ${fn},\n\nYou requested a link to manage your booking (code: ${c}).\n\nClick the button below to view the details and, if you wish, cancel the booking.`,
    manageLinkExpiry: "The link is valid for 30 days.",
    manageLinkDisclaimer: "If you didn't request this link, ignore it — your booking will not be changed.",
    balanceReminderSubject: (c) => `Balance reminder · Booking ${c}`,
    balanceReminderBody: (fn, c, ci) => `Hello ${fn},\n\nYour check-in for booking ${c} is in 5 days (${ci}).`,
    balanceReminderAmount: (amt) => `Balance due: €${amt}`,
    balanceReminderNoDue: "A balance is due before check-in.",
    balanceReminderFullyPaid: "The full amount has already been paid: no payment is due before check-in.",
    balanceReminderCityTax: (amt) => `City tax: €${amt} — collected separately at check-in.`,
    balanceReminderButton: "Pay the balance online",
    balanceReminderAlternative: "Alternatively, you can pay in cash or by card at check-in.",
    balanceReceiptSubject: (c) => `Balance receipt · Booking ${c}`,
    balanceReceiptGreeting: (fn, ln, c) => `Dear ${fn} ${ln}, the balance payment for booking ${c} has been completed.`,
    balanceReceiptCheckin: "Check-in",
    balanceReceiptCheckout: "Check-out",
    balanceReceiptTotalStay: "Total stay cost",
    balanceReceiptBalancePaid: "Balance paid online",
    balanceReceiptCityTax: (g) => `City tax (${g} guests)`,
    balanceReceiptButton: "Download PDF receipt",
    balanceReceiptManageButton: "Manage your booking",
    balanceReceiptClosing: `See you soon!\n${CONTENT.siteTitle.en}\n${CONTENT.email} · ${CONTENT.phone}`,
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
    cancelRefundEligible: (amt, fee) => `Vous recevrez un remboursement de €${amt} sur votre carte d'origine sous 5 à 10 jours ouvrés (frais de gestion de ${fee} % déjà déduits).`,
    cancelRefundFeeNote: (fee) => `Frais de gestion de ${fee} % déjà déduits.`,
    cancelNoRefundLate: "Conformément à notre politique, les annulations dans les 48 heures précédant l'arrivée ne donnent pas droit à un remboursement.",
    cancelNoRefundNoDeposit: "Vous n'avez pas encore versé l'acompte, aucun remboursement n'est donc prévu.",
    cancelFooter: `Pour toute question, écrivez-nous à ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Gérer votre réservation · ${c}`,
    manageLinkBody: (fn, c) => `Bonjour ${fn},\n\nVous avez demandé le lien pour gérer votre réservation (code : ${c}).\n\nCliquez sur le bouton ci-dessous pour consulter les détails et, si vous le souhaitez, annuler la réservation.`,
    manageLinkExpiry: "Le lien est valable 30 jours.",
    manageLinkDisclaimer: "Si vous n'avez pas demandé ce lien, ignorez-le — votre réservation ne sera pas modifiée.",
    balanceReminderSubject: (c) => `Rappel solde · Réservation ${c}`,
    balanceReminderBody: (fn, c, ci) => `Bonjour ${fn},\n\nVotre arrivée pour la réservation ${c} est dans 5 jours (${ci}).`,
    balanceReminderAmount: (amt) => `Solde à payer : €${amt}`,
    balanceReminderNoDue: "Un solde est à régler avant l'arrivée.",
    balanceReminderFullyPaid: "Le montant a déjà été intégralement réglé : aucun paiement n'est dû avant l'arrivée.",
    balanceReminderCityTax: (amt) => `Taxe de séjour : €${amt} — encaissée séparément à l'arrivée.`,
    balanceReminderButton: "Payer le solde en ligne",
    balanceReminderAlternative: "Vous pourrez également régler en espèces ou par carte directement à l'arrivée.",
    balanceReceiptSubject: (c) => `Reçu du solde · Réservation ${c}`,
    balanceReceiptGreeting: (fn, ln, c) => `Cher/Chère ${fn} ${ln}, le paiement du solde pour la réservation ${c} a bien été effectué.`,
    balanceReceiptCheckin: "Arrivée",
    balanceReceiptCheckout: "Départ",
    balanceReceiptTotalStay: "Coût total du séjour",
    balanceReceiptBalancePaid: "Solde payé en ligne",
    balanceReceiptCityTax: (g) => `Taxe de séjour (${g} personnes)`,
    balanceReceiptButton: "Télécharger le reçu PDF",
    balanceReceiptManageButton: "Gérer votre réservation",
    balanceReceiptClosing: `À très bientôt !\n${CONTENT.siteTitle.fr}\n${CONTENT.email} · ${CONTENT.phone}`,
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
    cancelRefundEligible: (amt, fee) => `Sie erhalten eine Erstattung von €${amt} auf Ihre ursprüngliche Karte innerhalb von 5–10 Werktagen (${fee} % Bearbeitungsgebühr bereits abgezogen).`,
    cancelRefundFeeNote: (fee) => `${fee} % Bearbeitungsgebühr bereits abgezogen.`,
    cancelNoRefundLate: "Gemäß unserer Richtlinie berechtigen Stornierungen innerhalb von 48 Stunden vor dem Check-in nicht zu einer Erstattung.",
    cancelNoRefundNoDeposit: "Sie haben die Anzahlung noch nicht geleistet, daher ist keine Erstattung vorgesehen.",
    cancelFooter: `Bei Fragen schreiben Sie uns unter ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Buchung verwalten · ${c}`,
    manageLinkBody: (fn, c) => `Hallo ${fn},\n\nSie haben den Link zur Verwaltung Ihrer Buchung (Code: ${c}) angefordert.\n\nKlicken Sie auf die Schaltfläche unten, um die Details einzusehen und die Buchung ggf. zu stornieren.`,
    manageLinkExpiry: "Der Link ist 30 Tage lang gültig.",
    manageLinkDisclaimer: "Wenn Sie diesen Link nicht angefordert haben, ignorieren Sie ihn — Ihre Buchung wird nicht verändert.",
    balanceReminderSubject: (c) => `Erinnerung Restbetrag · Buchung ${c}`,
    balanceReminderBody: (fn, c, ci) => `Hallo ${fn},\n\nIhr Check-in für die Buchung ${c} findet in 5 Tagen statt (${ci}).`,
    balanceReminderAmount: (amt) => `Ausstehender Restbetrag: €${amt}`,
    balanceReminderNoDue: "Vor dem Check-in ist ein Restbetrag zu zahlen.",
    balanceReminderFullyPaid: "Der Betrag wurde bereits vollständig bezahlt: Vor dem Check-in ist keine Zahlung fällig.",
    balanceReminderCityTax: (amt) => `Kurtaxe: €${amt} — wird separat beim Check-in erhoben.`,
    balanceReminderButton: "Restbetrag online zahlen",
    balanceReminderAlternative: "Alternativ können Sie direkt beim Check-in bar oder mit Karte zahlen.",
    balanceReceiptSubject: (c) => `Quittung Restbetrag · Buchung ${c}`,
    balanceReceiptGreeting: (fn, ln, c) => `Liebe/r ${fn} ${ln}, die Zahlung des Restbetrags für die Buchung ${c} wurde abgeschlossen.`,
    balanceReceiptCheckin: "Anreise",
    balanceReceiptCheckout: "Abreise",
    balanceReceiptTotalStay: "Gesamtkosten des Aufenthalts",
    balanceReceiptBalancePaid: "Restbetrag online bezahlt",
    balanceReceiptCityTax: (g) => `Kurtaxe (${g} Gäste)`,
    balanceReceiptButton: "PDF-Quittung herunterladen",
    balanceReceiptManageButton: "Buchung verwalten",
    balanceReceiptClosing: `Bis bald!\n${CONTENT.siteTitle.de}\n${CONTENT.email} · ${CONTENT.phone}`,
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
    cancelRefundEligible: (amt, fee) => `Recibirás un reembolso de €${amt} en tu tarjeta original en 5–10 días hábiles (${fee}% de gastos de gestión ya descontados).`,
    cancelRefundFeeNote: (fee) => `${fee}% de gastos de gestión ya descontados.`,
    cancelNoRefundLate: "Según nuestra política, las cancelaciones en las últimas 48 horas antes del check-in no dan derecho a reembolso.",
    cancelNoRefundNoDeposit: "Aún no has pagado la señal, por lo que no corresponde ningún reembolso.",
    cancelFooter: `Para cualquier consulta escríbenos a ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Gestiona tu reserva · ${c}`,
    manageLinkBody: (fn, c) => `Hola ${fn},\n\nHas solicitado el enlace para gestionar tu reserva (código: ${c}).\n\nHaz clic en el botón de abajo para ver los detalles y, si lo deseas, cancelar la reserva.`,
    manageLinkExpiry: "El enlace es válido durante 30 días.",
    manageLinkDisclaimer: "Si no has solicitado este enlace, ignóralo — tu reserva no será modificada.",
    balanceReminderSubject: (c) => `Recordatorio saldo · Reserva ${c}`,
    balanceReminderBody: (fn, c, ci) => `Hola ${fn},\n\nTu check-in para la reserva ${c} es en 5 días (${ci}).`,
    balanceReminderAmount: (amt) => `Saldo pendiente: €${amt}`,
    balanceReminderNoDue: "Hay un saldo pendiente antes del check-in.",
    balanceReminderFullyPaid: "El importe ya ha sido pagado en su totalidad: no se debe realizar ningún pago antes del check-in.",
    balanceReminderCityTax: (amt) => `Tasa turística: €${amt} — cobrada por separado al hacer el check-in.`,
    balanceReminderButton: "Pagar el saldo online",
    balanceReminderAlternative: "Alternativamente, puedes pagar en efectivo o con tarjeta directamente en el check-in.",
    balanceReceiptSubject: (c) => `Recibo de saldo · Reserva ${c}`,
    balanceReceiptGreeting: (fn, ln, c) => `Estimado/a ${fn} ${ln}, el pago del saldo para la reserva ${c} ha sido completado.`,
    balanceReceiptCheckin: "Llegada",
    balanceReceiptCheckout: "Salida",
    balanceReceiptTotalStay: "Coste total de la estancia",
    balanceReceiptBalancePaid: "Saldo pagado online",
    balanceReceiptCityTax: (g) => `Tasa turística (${g} huéspedes)`,
    balanceReceiptButton: "Descargar recibo PDF",
    balanceReceiptManageButton: "Gestionar la reserva",
    balanceReceiptClosing: `¡Hasta pronto!\n${CONTENT.siteTitle.es}\n${CONTENT.email} · ${CONTENT.phone}`,
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
    cancelRefundEligible: (amt, fee) => `Receberá um reembolso de €${amt} no seu cartão original em 5–10 dias úteis (${fee}% de taxa de gestão já deduzida).`,
    cancelRefundFeeNote: (fee) => `Taxa de gestão de ${fee}% já deduzida.`,
    cancelNoRefundLate: "De acordo com a nossa política, cancelamentos nas 48 horas anteriores ao check-in não dão direito a reembolso.",
    cancelNoRefundNoDeposit: "Ainda não pagou o sinal, pelo que não está previsto qualquer reembolso.",
    cancelFooter: `Para qualquer dúvida escreva-nos para ${HOST_EMAIL}.`,
    manageLinkSubject: (c) => `Gerir a sua reserva · ${c}`,
    manageLinkBody: (fn, c) => `Olá ${fn},\n\nSolicitou o link para gerir a sua reserva (código: ${c}).\n\nClique no botão abaixo para ver os detalhes e, se desejar, cancelar a reserva.`,
    manageLinkExpiry: "O link é válido por 30 dias.",
    manageLinkDisclaimer: "Se não solicitou este link, ignore-o — a sua reserva não será alterada.",
    balanceReminderSubject: (c) => `Lembrete de saldo · Reserva ${c}`,
    balanceReminderBody: (fn, c, ci) => `Olá ${fn},\n\nO seu check-in para a reserva ${c} é daqui a 5 dias (${ci}).`,
    balanceReminderAmount: (amt) => `Saldo a pagar: €${amt}`,
    balanceReminderNoDue: "Existe um saldo a pagar antes do check-in.",
    balanceReminderFullyPaid: "O valor já foi integralmente pago: não é devido qualquer pagamento antes do check-in.",
    balanceReminderCityTax: (amt) => `Taxa turística: €${amt} — cobrada separadamente no check-in.`,
    balanceReminderButton: "Pagar o saldo online",
    balanceReminderAlternative: "Em alternativa, pode pagar em dinheiro ou cartão diretamente no check-in.",
    balanceReceiptSubject: (c) => `Recibo de saldo · Reserva ${c}`,
    balanceReceiptGreeting: (fn, ln, c) => `Prezado(a) ${fn} ${ln}, o pagamento do saldo para a reserva ${c} foi concluído.`,
    balanceReceiptCheckin: "Check-in",
    balanceReceiptCheckout: "Check-out",
    balanceReceiptTotalStay: "Custo total da estadia",
    balanceReceiptBalancePaid: "Saldo pago online",
    balanceReceiptCityTax: (g) => `Taxa turística (${g} hóspedes)`,
    balanceReceiptButton: "Descarregar recibo PDF",
    balanceReceiptManageButton: "Gerir a reserva",
    balanceReceiptClosing: `Até breve!\n${CONTENT.siteTitle.pt}\n${CONTENT.email} · ${CONTENT.phone}`,
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
    cancelRefundEligible: (amt, fee) => `您将在5–10个工作日内收到 €${amt} 的退款至原始卡片（已扣除 ${fee}% 手续费）。`,
    cancelRefundFeeNote: (fee) => `已扣除 ${fee}% 手续费。`,
    cancelNoRefundLate: "根据我们的政策，入住前48小时内取消不享有退款。",
    cancelNoRefundNoDeposit: "您尚未支付定金，因此不予退款。",
    cancelFooter: `如有任何疑问，请发送邮件至 ${HOST_EMAIL}。`,
    manageLinkSubject: (c) => `管理您的预订 · ${c}`,
    manageLinkBody: (fn, c) => `您好 ${fn},\n\n您申请了管理预订的链接（代码：${c}）。\n\n请点击下方按钮查看详情，如需取消预订请点击相应选项。`,
    manageLinkExpiry: "该链接有效期为30天。",
    manageLinkDisclaimer: "若您未申请此链接，请忽略——您的预订不会被更改。",
    balanceReminderSubject: (c) => `余款提醒 · 预订 ${c}`,
    balanceReminderBody: (fn, c, ci) => `您好 ${fn},\n\n您的预订 ${c} 入住日期还有5天（${ci}）。`,
    balanceReminderAmount: (amt) => `待付余款：€${amt}`,
    balanceReminderNoDue: "入住前需支付余款。",
    balanceReminderFullyPaid: "款项已全额支付：入住前无需再付款。",
    balanceReminderCityTax: (amt) => `城市税：€${amt} — 入住时单独收取。`,
    balanceReminderButton: "在线支付余款",
    balanceReminderAlternative: "您也可以在入住时以现金或银行卡直接付款。",
    balanceReceiptSubject: (c) => `余款收据 · 预订 ${c}`,
    balanceReceiptGreeting: (fn, ln, c) => `亲爱的 ${fn} ${ln}，预订 ${c} 的余款已支付完成。`,
    balanceReceiptCheckin: "入住日期",
    balanceReceiptCheckout: "退房日期",
    balanceReceiptTotalStay: "住宿总费用",
    balanceReceiptBalancePaid: "在线支付余款",
    balanceReceiptCityTax: (g) => `城市税（${g}位客人）`,
    balanceReceiptButton: "下载PDF收据",
    balanceReceiptManageButton: "管理预订",
    balanceReceiptClosing: `期待与您相见！\n${CONTENT.siteTitle.zh}\n${CONTENT.email} · ${CONTENT.phone}`,
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
    cancelRefundEligible: (amt, fee) => `€${amt} のご返金を5〜10営業日以内に元のカードにお振り込みします（${fee}%の手数料は既に差引済みです）。`,
    cancelRefundFeeNote: (fee) => `${fee}%の手数料は既に差引済みです。`,
    cancelNoRefundLate: "ポリシーにより、チェックイン48時間以内のキャンセルは返金対象外です。",
    cancelNoRefundNoDeposit: "デポジットをまだお支払いいただいていないため、返金は発生しません。",
    cancelFooter: `ご質問は ${HOST_EMAIL} までご連絡ください。`,
    manageLinkSubject: (c) => `ご予約の管理 · ${c}`,
    manageLinkBody: (fn, c) => `${fn}様\n\nご予約（コード：${c}）の管理リンクをリクエストいただきました。\n\n下のボタンをクリックして詳細をご確認いただき、必要であればキャンセルも可能です。`,
    manageLinkExpiry: "リンクの有効期限は30日間です。",
    manageLinkDisclaimer: "このリンクをリクエストしていない場合は無視してください。ご予約は変更されません。",
    balanceReminderSubject: (c) => `残額リマインダー · 予約 ${c}`,
    balanceReminderBody: (fn, c, ci) => `${fn}様\n\n予約 ${c} のチェックインまで5日です（${ci}）。`,
    balanceReminderAmount: (amt) => `残額：€${amt}`,
    balanceReminderNoDue: "チェックイン前に残額のお支払いが必要です。",
    balanceReminderFullyPaid: "料金は全額お支払い済みです。チェックイン前のお支払いは不要です。",
    balanceReminderCityTax: (amt) => `宿泊税：€${amt} — チェックイン時に別途徴収。`,
    balanceReminderButton: "残額をオンラインで支払う",
    balanceReminderAlternative: "チェックイン時に現金またはカードでのお支払いも可能です。",
    balanceReceiptSubject: (c) => `残額領収書 · 予約 ${c}`,
    balanceReceiptGreeting: (fn, ln, c) => `${fn} ${ln}様、予約 ${c} の残額のお支払いが完了しました。`,
    balanceReceiptCheckin: "チェックイン",
    balanceReceiptCheckout: "チェックアウト",
    balanceReceiptTotalStay: "宿泊合計費用",
    balanceReceiptBalancePaid: "オンラインで支払った残額",
    balanceReceiptCityTax: (g) => `宿泊税（${g}名）`,
    balanceReceiptButton: "PDF領収書をダウンロード",
    balanceReceiptManageButton: "予約を管理する",
    balanceReceiptClosing: `お会いできることを楽しみにしております！\n${CONTENT.siteTitle.ja}\n${CONTENT.email} · ${CONTENT.phone}`,
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
    cancelRefundEligible: (amt, fee) => `€${amt}가 5~10 영업일 이내에 원래 카드로 환불됩니다(${fee}% 수수료 이미 차감).`,
    cancelRefundFeeNote: (fee) => `${fee}% 수수료가 이미 차감되었습니다.`,
    cancelNoRefundLate: "정책에 따라 체크인 48시간 이내 취소는 환불이 불가합니다.",
    cancelNoRefundNoDeposit: "아직 보증금을 결제하지 않으셨으므로 환불은 발생하지 않습니다.",
    cancelFooter: `문의 사항은 ${HOST_EMAIL}로 연락해 주세요.`,
    manageLinkSubject: (c) => `예약 관리 · ${c}`,
    manageLinkBody: (fn, c) => `안녕하세요 ${fn}님,\n\n예약(코드: ${c}) 관리 링크를 요청하셨습니다.\n\n아래 버튼을 클릭하여 세부 정보를 확인하고 원하시면 취소하실 수 있습니다.`,
    manageLinkExpiry: "링크는 30일 동안 유효합니다.",
    manageLinkDisclaimer: "이 링크를 요청하지 않으셨다면 무시하세요 — 예약은 변경되지 않습니다.",
    balanceReminderSubject: (c) => `잔액 알림 · 예약 ${c}`,
    balanceReminderBody: (fn, c, ci) => `안녕하세요 ${fn}님,\n\n예약 ${c}의 체크인까지 5일 남았습니다(${ci}).`,
    balanceReminderAmount: (amt) => `납부할 잔액: €${amt}`,
    balanceReminderNoDue: "체크인 전에 잔액을 납부해야 합니다.",
    balanceReminderFullyPaid: "금액이 전액 결제되었습니다: 체크인 전 추가 결제가 필요하지 않습니다.",
    balanceReminderCityTax: (amt) => `관광세: €${amt} — 체크인 시 별도 징수.`,
    balanceReminderButton: "온라인으로 잔액 결제",
    balanceReminderAlternative: "또는 체크인 시 현금이나 카드로 직접 결제하실 수 있습니다.",
    balanceReceiptSubject: (c) => `잔액 영수증 · 예약 ${c}`,
    balanceReceiptGreeting: (fn, ln, c) => `${fn} ${ln}님, 예약 ${c}의 잔액 결제가 완료되었습니다.`,
    balanceReceiptCheckin: "체크인",
    balanceReceiptCheckout: "체크아웃",
    balanceReceiptTotalStay: "총 숙박 비용",
    balanceReceiptBalancePaid: "온라인 결제 잔액",
    balanceReceiptCityTax: (g) => `관광세(${g}명)`,
    balanceReceiptButton: "PDF 영수증 다운로드",
    balanceReceiptManageButton: "예약 관리",
    balanceReceiptClosing: `곧 뵙겠습니다!\n${CONTENT.siteTitle.ko}\n${CONTENT.email} · ${CONTENT.phone}`,
  },
};

export function getExtraEmailStrings(locale: LocaleCode): ExtraStrings {
  return EXTRA[locale] ?? EXTRA.it;
}

export { HOST_EMAIL };
