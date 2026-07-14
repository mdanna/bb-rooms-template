import type { LocaleCode } from "@/i18n/index";
import { type RefundPolicy, refundPolicyOf, franchisePct } from "./refund";

// Testo pubblico (ospite) che descrive la politica di rimborso ATTIVA, a livelli (stile Airbnb).
// Fonte unica condivisa da PaymentPage, ConfirmationPage e BookingManagementPage così la
// dicitura è identica ovunque. Le stringhe rispecchiano i livelli definiti in refund.ts:
//   flexible = pieno fino a 24h prima · moderate = pieno fino a 5 giorni · strict = pieno fino a
//   30 giorni, 50% da 30 a 7 giorni, niente sotto i 7. + grazia 48h, franchigia sul rimborso
//   pieno del soggiorno, tassa di soggiorno sempre 100%.

interface RefundStrings {
  window: Record<RefundPolicy, string>;
  grace: string;
  franchise: (pct: number) => string;
  cityTax: string;
}

const STRINGS: Record<LocaleCode, RefundStrings> = {
  it: {
    window: {
      flexible: "Cancellazione flessibile: rimborso completo del soggiorno fino a 24 ore prima del check-in; dopo, nessun rimborso.",
      moderate: "Cancellazione moderata: rimborso completo del soggiorno fino a 5 giorni prima del check-in; dopo, nessun rimborso.",
      strict: "Cancellazione rigida: rimborso completo fino a 30 giorni prima del check-in; 50% da 30 a 7 giorni prima; nessun rimborso a meno di 7 giorni.",
    },
    grace: "In ogni caso, rimborso completo se annulli entro 48 ore dalla prenotazione e mancano almeno 14 giorni al check-in.",
    franchise: (p) => `Sul rimborso completo del soggiorno viene trattenuta una franchigia del ${p}% per i costi di transazione.`,
    cityTax: "La tassa di soggiorno, se pagata online, è sempre rimborsata per intero.",
  },
  en: {
    window: {
      flexible: "Flexible cancellation: full refund of the stay up to 24 hours before check-in; nothing after that.",
      moderate: "Moderate cancellation: full refund of the stay up to 5 days before check-in; nothing after that.",
      strict: "Strict cancellation: full refund up to 30 days before check-in; 50% from 30 to 7 days before; no refund within 7 days.",
    },
    grace: "In any case, a full refund applies if you cancel within 48 hours of booking and check-in is at least 14 days away.",
    franchise: (p) => `A ${p}% fee is withheld from a full stay refund to cover transaction costs.`,
    cityTax: "The city tax, if paid online, is always refunded in full.",
  },
  fr: {
    window: {
      flexible: "Annulation flexible : remboursement complet du séjour jusqu'à 24 heures avant l'arrivée ; rien ensuite.",
      moderate: "Annulation modérée : remboursement complet du séjour jusqu'à 5 jours avant l'arrivée ; rien ensuite.",
      strict: "Annulation stricte : remboursement complet jusqu'à 30 jours avant l'arrivée ; 50% de 30 à 7 jours avant ; aucun remboursement à moins de 7 jours.",
    },
    grace: "Dans tous les cas, remboursement complet si vous annulez dans les 48 heures suivant la réservation et qu'il reste au moins 14 jours avant l'arrivée.",
    franchise: (p) => `Des frais de ${p}% sont retenus sur le remboursement intégral du séjour pour couvrir les frais de transaction.`,
    cityTax: "La taxe de séjour, si elle est payée en ligne, est toujours intégralement remboursée.",
  },
  de: {
    window: {
      flexible: "Flexible Stornierung: volle Rückerstattung des Aufenthalts bis 24 Stunden vor der Anreise; danach keine.",
      moderate: "Moderate Stornierung: volle Rückerstattung des Aufenthalts bis 5 Tage vor der Anreise; danach keine.",
      strict: "Strikte Stornierung: volle Rückerstattung bis 30 Tage vor der Anreise; 50% von 30 bis 7 Tagen vorher; keine Rückerstattung unter 7 Tagen.",
    },
    grace: "In jedem Fall volle Rückerstattung, wenn Sie innerhalb von 48 Stunden nach der Buchung stornieren und die Anreise mindestens 14 Tage entfernt ist.",
    franchise: (p) => `Von der vollen Rückerstattung des Aufenthalts wird eine Gebühr von ${p}% für Transaktionskosten einbehalten.`,
    cityTax: "Die Kurtaxe wird, sofern online bezahlt, stets vollständig erstattet.",
  },
  es: {
    window: {
      flexible: "Cancelación flexible: reembolso completo de la estancia hasta 24 horas antes del check-in; después, nada.",
      moderate: "Cancelación moderada: reembolso completo de la estancia hasta 5 días antes del check-in; después, nada.",
      strict: "Cancelación estricta: reembolso completo hasta 30 días antes del check-in; 50% de 30 a 7 días antes; sin reembolso con menos de 7 días.",
    },
    grace: "En cualquier caso, reembolso completo si cancelas dentro de las 48 horas siguientes a la reserva y faltan al menos 14 días para el check-in.",
    franchise: (p) => `Del reembolso íntegro de la estancia se retiene un ${p}% para cubrir los costes de transacción.`,
    cityTax: "La tasa turística, si se paga online, siempre se reembolsa por completo.",
  },
  pt: {
    window: {
      flexible: "Cancelamento flexível: reembolso total da estadia até 24 horas antes do check-in; depois, nada.",
      moderate: "Cancelamento moderado: reembolso total da estadia até 5 dias antes do check-in; depois, nada.",
      strict: "Cancelamento rígido: reembolso total até 30 dias antes do check-in; 50% de 30 a 7 dias antes; sem reembolso a menos de 7 dias.",
    },
    grace: "Em qualquer caso, reembolso total se cancelar nas 48 horas seguintes à reserva e faltarem pelo menos 14 dias para o check-in.",
    franchise: (p) => `Do reembolso integral da estadia é retida uma taxa de ${p}% para cobrir os custos de transação.`,
    cityTax: "A taxa turística, se paga online, é sempre reembolsada na totalidade.",
  },
  zh: {
    window: {
      flexible: "灵活取消:入住前24小时以上取消可全额退还住宿费用;之后不予退款。",
      moderate: "中等取消:入住前5天以上取消可全额退还住宿费用;之后不予退款。",
      strict: "严格取消:入住前30天以上可全额退款;入住前30至7天退款50%;入住前7天内不予退款。",
    },
    grace: "无论如何,若在预订后48小时内取消且距入住至少还有14天,均可全额退款。",
    franchise: (p) => `全额退还住宿费用时将扣除${p}%的交易手续费。`,
    cityTax: "城市税如已在线支付,将始终全额退还。",
  },
  ja: {
    window: {
      flexible: "柔軟なキャンセル:チェックインの24時間前まで宿泊料金を全額返金、それ以降は返金なし。",
      moderate: "標準のキャンセル:チェックインの5日前まで宿泊料金を全額返金、それ以降は返金なし。",
      strict: "厳格なキャンセル:チェックインの30日前まで全額返金、30〜7日前は50%返金、7日以内は返金なし。",
    },
    grace: "いずれの場合も、ご予約から48時間以内かつチェックインまで14日以上ある場合は全額返金いたします。",
    franchise: (p) => `宿泊料金の全額返金時には、決済手数料として${p}%を差し引かせていただきます。`,
    cityTax: "宿泊税はオンラインでお支払いの場合、常に全額返金されます。",
  },
  ko: {
    window: {
      flexible: "유연한 취소: 체크인 24시간 전까지 숙박 요금 전액 환불, 이후에는 환불 불가.",
      moderate: "중간 취소: 체크인 5일 전까지 숙박 요금 전액 환불, 이후에는 환불 불가.",
      strict: "엄격한 취소: 체크인 30일 전까지 전액 환불, 30~7일 전 50% 환불, 7일 이내 환불 불가.",
    },
    grace: "어떤 경우든 예약 후 48시간 이내에 취소하고 체크인까지 14일 이상 남았다면 전액 환불됩니다.",
    franchise: (p) => `숙박 요금 전액 환불 시 결제 수수료로 ${p}%가 공제됩니다.`,
    cityTax: "관광세는 온라인으로 결제한 경우 항상 전액 환불됩니다.",
  },
};

/**
 * Frase completa che descrive la politica di rimborso attiva per l'ospite, nella sua lingua.
 * `policy` accetta il livello congelato della prenotazione (string) o un RefundPolicy;
 * un valore non valido ricade sul livello corrente del sito.
 */
export function refundPolicyText(policy: string | null | undefined, locale: LocaleCode): string {
  const s = STRINGS[locale] ?? STRINGS.it;
  const level = refundPolicyOf(policy);
  return `${s.window[level]} ${s.grace} ${s.franchise(franchisePct())} ${s.cityTax}`;
}
