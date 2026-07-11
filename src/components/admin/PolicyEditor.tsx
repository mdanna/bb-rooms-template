"use client";

import { useEffect, useState } from "react";
import type { Policies } from "@/lib/policies";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import DeployToast from "@/components/admin/DeployToast";

type SaveState = "idle" | "saving" | "success" | "error";

const POLICY_LABELS = {
  it: {
    cityTax: "Tassa di soggiorno", taxPerPerson: "€ per persona/notte", taxMaxNights: "Max notti",
    depositBalance: "Deposito e saldo", deposit: "Deposito (%)", balanceDays: "Giorni per saldo",
    reminder1: "1° promemoria saldo", reminder2: "2° promemoria saldo",
    cancellation: "Cancellazione", fullRefund: "Rimborso completo (giorni)", halfRefund: "Rimborso parziale (giorni)",
    partialPct: "Rimborso parziale (%)", feePct: "Spese di cancellazione (%)",
    booking: "Prenotazione", minAdvance: "Preavviso minimo (giorni)", maxGuests: "Ospiti massimi",
    minNights: "Notti minime", maxNights: "Notti massime",
    times: "Orari", checkin: "Orario check-in", checkout: "Orario check-out",
  },
  en: {
    cityTax: "City tax", taxPerPerson: "€ per person/night", taxMaxNights: "Max nights",
    depositBalance: "Deposit & balance", deposit: "Deposit (%)", balanceDays: "Days for balance",
    reminder1: "1st balance reminder", reminder2: "2nd balance reminder",
    cancellation: "Cancellation", fullRefund: "Full refund (days)", halfRefund: "Partial refund (days)",
    partialPct: "Partial refund (%)", feePct: "Cancellation fee (%)",
    booking: "Booking", minAdvance: "Min advance (days)", maxGuests: "Max guests",
    minNights: "Min nights", maxNights: "Max nights",
    times: "Times", checkin: "Check-in time", checkout: "Check-out time",
  },
  es: {
    cityTax: "Tasa turística", taxPerPerson: "€ por persona/noche", taxMaxNights: "Máx noches",
    depositBalance: "Depósito y saldo", deposit: "Depósito (%)", balanceDays: "Días para saldo",
    reminder1: "1er recordatorio saldo", reminder2: "2do recordatorio saldo",
    cancellation: "Cancelación", fullRefund: "Reembolso completo (días)", halfRefund: "Reembolso parcial (días)",
    partialPct: "Reembolso parcial (%)", feePct: "Gastos de cancelación (%)",
    booking: "Reserva", minAdvance: "Antelación mínima (días)", maxGuests: "Huéspedes máx.",
    minNights: "Noches mínimas", maxNights: "Noches máximas",
    times: "Horarios", checkin: "Hora check-in", checkout: "Hora check-out",
  },
  fr: {
    cityTax: "Taxe de séjour", taxPerPerson: "€ par personne/nuit", taxMaxNights: "Max nuits",
    depositBalance: "Acompte et solde", deposit: "Acompte (%)", balanceDays: "Jours pour solde",
    reminder1: "1er rappel solde", reminder2: "2e rappel solde",
    cancellation: "Annulation", fullRefund: "Remboursement complet (jours)", halfRefund: "Remboursement partiel (jours)",
    partialPct: "Remboursement partiel (%)", feePct: "Frais d'annulation (%)",
    booking: "Réservation", minAdvance: "Délai minimum (jours)", maxGuests: "Voyageurs max.",
    minNights: "Nuits minimum", maxNights: "Nuits maximum",
    times: "Horaires", checkin: "Heure check-in", checkout: "Heure check-out",
  },
} as const;

export default function PolicyEditor() {
  const { t, locale } = useAdminLanguage();
  const tp = t.policy;
  const lbl = POLICY_LABELS[locale] ?? POLICY_LABELS.en;
  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const [policies, setPolicies] = useState<Policies | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deploySha, setDeploySha] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/policies")
      .then((r) => r.json())
      .then(setPolicies)
      .catch(() => setError(t.common.error));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!policies) return;
    setSaveState("saving");
    setError("");
    try {
      const res = await fetch("/api/admin/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...policies, defaultDepositRate: policies.minDepositRate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      setSaveState("success");
      if (data.commitSha) setDeploySha(data.commitSha);
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error);
      setSaveState("error");
    }
  }

  // Solo i campi policy scalari sono editabili qui (esclusi calendars/airbnbIcalUrl,
  // gestiti dalla pagina Impostazioni).
  type PolicyFieldKey = Exclude<keyof Policies, "calendars" | "airbnbIcalUrl" | "unitCalendars">;
  const percentFields = new Set<PolicyFieldKey>(["minDepositRate"]);

  function field(label: string, key: PolicyFieldKey, type: "number" | "text" = "number") {
    const isPercent = percentFields.has(key);
    const displayValue = isPercent && policies ? Math.round((policies[key] as number) * 100) : (policies?.[key] ?? "");
    return (
      <label key={key} className="flex flex-col gap-1 text-sm">
        <span className="text-foreground/70">{label}</span>
        <input
          type={type}
          value={displayValue}
          onChange={(e) =>
            setPolicies((p) => {
              if (!p) return p;
              const raw = type === "number" ? Number(e.target.value) : e.target.value;
              return { ...p, [key]: isPercent ? (raw as number) / 100 : raw };
            })
          }
          className="rounded border border-gold/40 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
        />
      </label>
    );
  }

  function groupLabel(text: string) {
    return (
      <p className="col-span-full text-xs font-medium uppercase tracking-widest text-foreground/40 pt-2">
        {text}
      </p>
    );
  }

  if (!policies) {
    return <p className="text-sm text-foreground/60">{error || t.common.loading}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 items-end">
        {groupLabel(lbl.cityTax)}
        {field(lbl.taxPerPerson, "cityTaxPerPersonPerNight")}
        {field(lbl.taxMaxNights, "cityTaxMaxNights")}

        {groupLabel(lbl.depositBalance)}
        {field(lbl.deposit, "minDepositRate")}
        {field(lbl.balanceDays, "balanceDueDays")}
        {field(lbl.reminder1, "balanceReminderDaysFirst")}
        {field(lbl.reminder2, "balanceReminderDaysSecond")}

        {groupLabel(lbl.cancellation)}
        {field(lbl.fullRefund, "cancelFullRefundDays")}
        {field(lbl.halfRefund, "cancelHalfRefundDays")}
        {field(lbl.partialPct, "cancelPartialRefundPct")}
        {field(lbl.feePct, "cancelFeePercent")}

        {groupLabel(lbl.booking)}
        {field(lbl.minAdvance, "minAdvanceBookingDays")}
        {field(lbl.maxGuests, "maxGuests")}
        {field(lbl.minNights, "minNights")}
        {field(lbl.maxNights, "maxNights")}

        {groupLabel(lbl.times)}
        {field(lbl.checkin, "checkinTime", "text")}
        {field(lbl.checkout, "checkoutTime", "text")}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50"
        >
          {saveState === "saving" ? tp.saving : tp.save}
        </button>
        {saveState === "success" && <span className="text-sm text-green-600">{DEMO ? t.common.demoSaved : tp.saved}</span>}
        {saveState === "error" && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <DeployToast sha={deploySha} onDone={() => setDeploySha(null)} />
    </div>
  );
}
