"use client";

import { useEffect, useState } from "react";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import DeployToast from "@/components/admin/DeployToast";

type Theme = { background: string; foreground: string; gold: string; card: string };
type SaveState = "idle" | "saving" | "success" | "error";
type Key = keyof Theme;

const HEX6 = /^#[0-9a-fA-F]{6}$/;

const PRESETS: { name: string; t: Theme }[] = [
  { name: "Terracotta boutique", t: { background: "#f8f0ea", foreground: "#2e1c18", gold: "#b8755f", card: "#fdf6f1" } },
  { name: "Oro classico", t: { background: "#faf7ef", foreground: "#33302a", gold: "#b0913f", card: "#fffdf7" } },
  { name: "Blu mare", t: { background: "#f2f6fa", foreground: "#1b2a3a", gold: "#35708f", card: "#ffffff" } },
  { name: "Verde salvia", t: { background: "#f2f6f1", foreground: "#223029", gold: "#5f8a5a", card: "#ffffff" } },
  { name: "Bordeaux", t: { background: "#f9f3f1", foreground: "#2c1b1e", gold: "#8f3b52", card: "#fffaf8" } },
  { name: "Lavanda", t: { background: "#f6f4fa", foreground: "#2b2536", gold: "#7c5ca6", card: "#ffffff" } },
  { name: "Petrolio", t: { background: "#eef4f4", foreground: "#16292a", gold: "#1f6f78", card: "#ffffff" } },
  { name: "Rame", t: { background: "#fbf4ee", foreground: "#2d2018", gold: "#bf6a3a", card: "#fffaf5" } },
];

function toRgb(h: string): [number, number, number] {
  let s = h.replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(h: string): number {
  const a = toRgb(h).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrast(a: string, b: string): number {
  const L1 = lum(a), L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

const LABELS = {
  it: {
    title: "Colori del sito", intro: "Scegli una palette pronta o personalizza i 4 colori. L'anteprima si aggiorna in tempo reale; salvando, il sito si ricolora.",
    presets: "Palette pronte", customize: "Personalizza",
    fields: { background: ["Sfondo", "Il colore di fondo di tutte le pagine"], foreground: ["Testo", "I testi principali (e, con trasparenza, quelli secondari)"], gold: ["Accento", "Bottoni, link, etichette, dettagli e bordi decorativi"], card: ["Riquadri", "Lo sfondo di card e schede"] },
    preview: "Anteprima", pvEyebrow: "La tua struttura", pvTitle: "Un soggiorno indimenticabile", pvText: "Testo di esempio per vedere la leggibilità sullo sfondo.", pvCard: "Contenuto in una scheda", pvBtn: "Prenota ora",
    contrast: "Leggibilità", cTextBg: "Testo su sfondo", cTextCard: "Testo su riquadro",
    good: "ottima", ok: "sufficiente", low: "bassa", warn: "Contrasto basso: il testo potrebbe risultare poco leggibile.",
    save: "Salva", saving: "Salvataggio…", saved: "Salvato", error: "Errore",
  },
  en: {
    title: "Site colors", intro: "Pick a ready palette or customize the 4 colors. The preview updates live; on save the site re-themes.",
    presets: "Ready palettes", customize: "Customize",
    fields: { background: ["Background", "The page background of the whole site"], foreground: ["Text", "Main text (and, with opacity, secondary text)"], gold: ["Accent", "Buttons, links, labels, details and decorative borders"], card: ["Cards", "The background of cards and panels"] },
    preview: "Preview", pvEyebrow: "Your property", pvTitle: "An unforgettable stay", pvText: "Sample text to check readability against the background.", pvCard: "Content inside a card", pvBtn: "Book now",
    contrast: "Readability", cTextBg: "Text on background", cTextCard: "Text on card",
    good: "great", ok: "sufficient", low: "low", warn: "Low contrast: text may be hard to read.",
    save: "Save", saving: "Saving…", saved: "Saved", error: "Error",
  },
  es: {
    title: "Colores del sitio", intro: "Elige una paleta lista o personaliza los 4 colores. La vista previa se actualiza en vivo; al guardar el sitio cambia de color.",
    presets: "Paletas listas", customize: "Personalizar",
    fields: { background: ["Fondo", "El fondo de todas las páginas"], foreground: ["Texto", "Los textos principales (y, con transparencia, los secundarios)"], gold: ["Acento", "Botones, enlaces, etiquetas, detalles y bordes"], card: ["Tarjetas", "El fondo de tarjetas y paneles"] },
    preview: "Vista previa", pvEyebrow: "Tu alojamiento", pvTitle: "Una estancia inolvidable", pvText: "Texto de ejemplo para comprobar la legibilidad sobre el fondo.", pvCard: "Contenido en una tarjeta", pvBtn: "Reservar",
    contrast: "Legibilidad", cTextBg: "Texto sobre fondo", cTextCard: "Texto sobre tarjeta",
    good: "óptima", ok: "suficiente", low: "baja", warn: "Contraste bajo: el texto podría ser poco legible.",
    save: "Guardar", saving: "Guardando…", saved: "Guardado", error: "Error",
  },
  fr: {
    title: "Couleurs du site", intro: "Choisissez une palette prête ou personnalisez les 4 couleurs. L'aperçu se met à jour en direct ; à l'enregistrement, le site change de couleurs.",
    presets: "Palettes prêtes", customize: "Personnaliser",
    fields: { background: ["Fond", "Le fond de toutes les pages"], foreground: ["Texte", "Les textes principaux (et, en transparence, les secondaires)"], gold: ["Accent", "Boutons, liens, étiquettes, détails et bordures"], card: ["Cartes", "Le fond des cartes et panneaux"] },
    preview: "Aperçu", pvEyebrow: "Votre établissement", pvTitle: "Un séjour inoubliable", pvText: "Texte d'exemple pour vérifier la lisibilité sur le fond.", pvCard: "Contenu dans une carte", pvBtn: "Réserver",
    contrast: "Lisibilité", cTextBg: "Texte sur fond", cTextCard: "Texte sur carte",
    good: "excellente", ok: "suffisante", low: "faible", warn: "Contraste faible : le texte pourrait être peu lisible.",
    save: "Enregistrer", saving: "Enregistrement…", saved: "Enregistré", error: "Erreur",
  },
} as const;

export default function ThemeEditor() {
  const { t, locale } = useAdminLanguage();
  const L = LABELS[locale] ?? LABELS.en;
  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const [theme, setTheme] = useState<Theme | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deploySha, setDeploySha] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/theme")
      .then((r) => r.json())
      .then((d: Theme) => setTheme(d))
      .catch(() => setError(L.error));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setColor(k: Key, v: string) {
    setTheme((t) => (t ? { ...t, [k]: v } : t));
    setSaveState("idle");
  }
  function applyPreset(t: Theme) {
    setTheme({ ...t });
    setSaveState("idle");
  }

  async function save() {
    if (!theme) return;
    setSaveState("saving"); setError("");
    try {
      const res = await fetch("/api/admin/theme", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      });
      const d = (await res.json()) as { error?: string; commitSha?: string };
      if (!res.ok) throw new Error(d.error ?? L.error);
      setSaveState("success");
      if (d.commitSha) setDeploySha(d.commitSha);
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : L.error);
      setSaveState("error");
    }
  }

  if (!theme) {
    return <p className="text-sm text-foreground/50">{error || "…"}</p>;
  }

  const cBg = contrast(theme.foreground, theme.background);
  const cCard = contrast(theme.foreground, theme.card);
  const lowContrast = cBg < 4.5 || cCard < 4.5;
  const rating = (c: number) => (c >= 7 ? L.good : c >= 4.5 ? L.ok : L.low);
  const ratingColor = (c: number) => (c >= 4.5 ? "text-green-700" : "text-red-600");

  const isPresetActive = (t: Theme) =>
    (["background", "foreground", "gold", "card"] as Key[]).every((k) => t[k].toLowerCase() === theme[k].toLowerCase());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-xl italic text-foreground">{L.title}</h1>
        <p className="mt-1 text-sm text-foreground/60">{L.intro}</p>
      </div>

      {/* Palette pronte */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/50">{L.presets}</h2>
        <div className="flex flex-wrap gap-3">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => applyPreset(p.t)}
              className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${isPresetActive(p.t) ? "border-gold text-gold" : "border-gold/30 text-foreground/70 hover:border-gold/60"}`}>
              <span className="flex">
                {(["background", "gold", "foreground"] as Key[]).map((k) => (
                  <span key={k} className="h-3.5 w-3.5 rounded-full border border-black/10 -ml-1 first:ml-0" style={{ background: p.t[k] }} />
                ))}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personalizza */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/50">{L.customize}</h2>
          {(["background", "foreground", "gold", "card"] as Key[]).map((k) => (
            <div key={k} className="flex items-start gap-3">
              <input type="color" value={HEX6.test(theme[k]) ? theme[k] : "#000000"}
                onChange={(e) => setColor(k, e.target.value)}
                className="mt-0.5 h-9 w-9 shrink-0 cursor-pointer rounded border border-gold/30 bg-transparent p-0"
                aria-label={L.fields[k][0]} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{L.fields[k][0]}</span>
                  <input type="text" value={theme[k]} onChange={(e) => setColor(k, e.target.value)}
                    className="w-24 rounded border border-gold/30 bg-background px-2 py-0.5 font-mono text-xs uppercase" />
                </div>
                <p className="mt-0.5 text-xs text-foreground/55">{L.fields[k][1]}</p>
              </div>
            </div>
          ))}

          {/* Contrasto */}
          <div className="rounded border border-gold/20 p-3 text-xs">
            <h3 className="mb-1 font-bold uppercase tracking-widest text-foreground/50">{L.contrast}</h3>
            <div className="flex justify-between"><span className="text-foreground/70">{L.cTextBg}</span><span className={ratingColor(cBg)}>{rating(cBg)} ({cBg.toFixed(1)})</span></div>
            <div className="flex justify-between"><span className="text-foreground/70">{L.cTextCard}</span><span className={ratingColor(cCard)}>{rating(cCard)} ({cCard.toFixed(1)})</span></div>
            {lowContrast && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-red-700">{L.warn}</p>}
          </div>
        </div>

        {/* Anteprima */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/50">{L.preview}</h2>
          <div className="overflow-hidden rounded-lg border border-gold/30" style={{ background: theme.background }}>
            <div className="space-y-3 p-6" style={{ color: theme.foreground }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: theme.gold }}>{L.pvEyebrow}</div>
              <div className="font-serif-display text-2xl italic">{L.pvTitle}</div>
              <p className="text-sm" style={{ opacity: 0.7 }}>{L.pvText}</p>
              <div className="rounded-md p-4 text-sm" style={{ background: theme.card, border: `1px solid ${theme.gold}44` }}>
                {L.pvCard}
              </div>
              <button className="rounded-full px-5 py-2 text-xs font-medium uppercase tracking-widest" style={{ background: theme.gold, color: "#faf6ec" }}>
                {L.pvBtn}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={saveState === "saving"}
          className="rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50">
          {saveState === "saving" ? L.saving : L.save}
        </button>
        {saveState === "success" && <span className="text-sm text-green-600">{DEMO ? t.common.demoSaved : L.saved}</span>}
        {saveState === "error" && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <DeployToast sha={deploySha} onDone={() => setDeploySha(null)} />
    </div>
  );
}
