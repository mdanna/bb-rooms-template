"use client";

import { useEffect, useState } from "react";
import type { Policies } from "@/lib/policies";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import DeployToast from "@/components/admin/DeployToast";

type SaveState = "idle" | "saving" | "success" | "error";

const POLICY_LABELS = {
  it: {
    cityTax: "Tassa di soggiorno", taxPerPerson: "€ per persona/notte", taxMaxNights: "Max notti",
    booking: "Prenotazione", minAdvance: "Preavviso minimo (giorni)", maxGuests: "Ospiti massimi",
    minNights: "Notti minime", maxNights: "Notti massime",
    times: "Orari", checkin: "Orario check-in", checkout: "Orario check-out",
  },
  en: {
    cityTax: "City tax", taxPerPerson: "€ per person/night", taxMaxNights: "Max nights",
    booking: "Booking", minAdvance: "Min advance (days)", maxGuests: "Max guests",
    minNights: "Min nights", maxNights: "Max nights",
    times: "Times", checkin: "Check-in time", checkout: "Check-out time",
  },
  es: {
    cityTax: "Tasa turística", taxPerPerson: "€ por persona/noche", taxMaxNights: "Máx noches",
    booking: "Reserva", minAdvance: "Antelación mínima (días)", maxGuests: "Huéspedes máx.",
    minNights: "Noches mínimas", maxNights: "Noches máximas",
    times: "Horarios", checkin: "Hora check-in", checkout: "Hora check-out",
  },
  fr: {
    cityTax: "Taxe de séjour", taxPerPerson: "€ par personne/nuit", taxMaxNights: "Max nuits",
    booking: "Réservation", minAdvance: "Délai minimum (jours)", maxGuests: "Voyageurs max.",
    minNights: "Nuits minimum", maxNights: "Nuits maximum",
    times: "Horaires", checkin: "Heure check-in", checkout: "Heure check-out",
  },
} as const;

const REFUND_ORDER = ["flexible", "moderate", "strict"] as const;

// Etichette del selettore livello di rimborso (lingua del pannello: it/en/es/fr).
const REFUND_LABELS: Record<string, {
  section: string;
  intro: string;
  franchise: string;
  franchiseHint: string;
  frozenNote: string;
  levels: Record<(typeof REFUND_ORDER)[number], { name: string; desc: string }>;
}> = {
  it: {
    section: "Politica di rimborso",
    intro: "Livello applicato alle nuove prenotazioni. Viene congelato su ogni prenotazione: cambiarlo non tocca quelle esistenti.",
    franchise: "Franchigia (%)",
    franchiseHint: "Trattenuta sul rimborso pieno del soggiorno in caso di cancellazione dell'ospite. La tassa di soggiorno è sempre rimborsata al 100%.",
    frozenNote: "Se cancella l'host, il soggiorno è rimborsato al 100% senza franchigia.",
    levels: {
      flexible: { name: "Flessibile", desc: "Rimborso completo fino a 24 ore prima del check-in; poi nessun rimborso." },
      moderate: { name: "Moderata", desc: "Rimborso completo fino a 5 giorni prima del check-in; poi nessun rimborso." },
      strict: { name: "Rigida", desc: "Rimborso completo fino a 30 giorni prima; 50% da 30 a 7 giorni; niente sotto i 7 giorni." },
    },
  },
  en: {
    section: "Refund policy",
    intro: "Level applied to new bookings. It is frozen on each booking: changing it does not affect existing ones.",
    franchise: "Fee withheld (%)",
    franchiseHint: "Withheld from a full stay refund when the guest cancels. The city tax is always refunded in full.",
    frozenNote: "If the host cancels, the stay is refunded 100% with no fee.",
    levels: {
      flexible: { name: "Flexible", desc: "Full refund up to 24 hours before check-in; nothing after." },
      moderate: { name: "Moderate", desc: "Full refund up to 5 days before check-in; nothing after." },
      strict: { name: "Strict", desc: "Full refund up to 30 days before; 50% from 30 to 7 days; nothing under 7 days." },
    },
  },
  es: {
    section: "Política de reembolso",
    intro: "Nivel aplicado a las nuevas reservas. Se congela en cada reserva: cambiarlo no afecta a las existentes.",
    franchise: "Retención (%)",
    franchiseHint: "Se retiene del reembolso íntegro de la estancia si el huésped cancela. La tasa turística siempre se reembolsa al 100%.",
    frozenNote: "Si cancela el anfitrión, la estancia se reembolsa al 100% sin retención.",
    levels: {
      flexible: { name: "Flexible", desc: "Reembolso completo hasta 24 horas antes del check-in; después nada." },
      moderate: { name: "Moderada", desc: "Reembolso completo hasta 5 días antes del check-in; después nada." },
      strict: { name: "Estricta", desc: "Reembolso completo hasta 30 días antes; 50% de 30 a 7 días; nada con menos de 7 días." },
    },
  },
  fr: {
    section: "Politique de remboursement",
    intro: "Niveau appliqué aux nouvelles réservations. Il est figé sur chaque réservation : le modifier n'affecte pas les existantes.",
    franchise: "Frais retenus (%)",
    franchiseHint: "Retenus sur le remboursement intégral du séjour en cas d'annulation du voyageur. La taxe de séjour est toujours remboursée à 100%.",
    frozenNote: "Si l'hôte annule, le séjour est remboursé à 100% sans frais.",
    levels: {
      flexible: { name: "Flexible", desc: "Remboursement complet jusqu'à 24 heures avant l'arrivée ; rien ensuite." },
      moderate: { name: "Modérée", desc: "Remboursement complet jusqu'à 5 jours avant l'arrivée ; rien ensuite." },
      strict: { name: "Stricte", desc: "Remboursement complet jusqu'à 30 jours avant ; 50% de 30 à 7 jours ; rien à moins de 7 jours." },
    },
  },
} as const;

export default function PolicyEditor() {
  const { t, locale } = useAdminLanguage();
  const tp = t.policy;
  const lbl = POLICY_LABELS[locale] ?? POLICY_LABELS.en;
  const rl = REFUND_LABELS[locale] ?? REFUND_LABELS.en;
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
        body: JSON.stringify(policies),
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
  // gestiti dalla pagina Impostazioni). Il selettore del livello di rimborso (flexible/
  // moderate/strict) + franchigia arriva in un blocco UI successivo.
  type PolicyFieldKey = Exclude<keyof Policies, "calendars" | "airbnbIcalUrl" | "unitCalendars">;

  function field(label: string, key: PolicyFieldKey, type: "number" | "text" = "number") {
    return (
      <label key={key} className="flex flex-col gap-1 text-sm">
        <span className="text-foreground/70">{label}</span>
        <input
          type={type}
          value={policies?.[key] ?? ""}
          onChange={(e) =>
            setPolicies((p) => {
              if (!p) return p;
              const raw = type === "number" ? Number(e.target.value) : e.target.value;
              return { ...p, [key]: raw };
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

        {groupLabel(lbl.booking)}
        {field(lbl.minAdvance, "minAdvanceBookingDays")}
        {field(lbl.maxGuests, "maxGuests")}
        {field(lbl.minNights, "minNights")}
        {field(lbl.maxNights, "maxNights")}

        {groupLabel(lbl.times)}
        {field(lbl.checkin, "checkinTime", "text")}
        {field(lbl.checkout, "checkoutTime", "text")}
      </div>

      {/* Politica di rimborso a 3 livelli (stile Airbnb) — congelata su ogni prenotazione. */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-foreground/40">{rl.section}</p>
        <p className="text-xs text-foreground/55">{rl.intro}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {REFUND_ORDER.map((level) => {
            const active = policies.refundPolicy === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setPolicies((p) => (p ? { ...p, refundPolicy: level } : p))}
                className={`rounded-lg border p-4 text-left transition ${
                  active
                    ? "border-gold bg-gold/10 ring-1 ring-gold"
                    : "border-gold/30 bg-background hover:border-gold/60"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${active ? "bg-gold" : "border border-foreground/30"}`} />
                  {rl.levels[level].name}
                </span>
                <span className="mt-1.5 block text-xs leading-snug text-foreground/60">
                  {rl.levels[level].desc}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground/70">{rl.franchise}</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={policies.franchiseRefundPct ?? ""}
              onChange={(e) =>
                setPolicies((p) => (p ? { ...p, franchiseRefundPct: Number(e.target.value) } : p))
              }
              className="rounded border border-gold/40 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </label>
        </div>
        <p className="text-xs text-foreground/50">{rl.franchiseHint}</p>
        <p className="text-xs text-foreground/50">{rl.frozenNote}</p>
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
