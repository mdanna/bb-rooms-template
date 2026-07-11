import rawTheme from "@/data/theme.json";

// I 4 colori che pilotano tutta la grafica del sito (mappati a variabili CSS in
// globals.css via @theme). Modificabili dal cliente in /admin/tema.
export interface Theme {
  background: string; // sfondo del sito
  foreground: string; // testo
  gold: string; // accento (bottoni, link, dettagli)
  card: string; // sfondo di riquadri e schede
}

export const DEFAULT_THEME: Theme = {
  background: "#f8f0ea",
  foreground: "#2e1c18",
  gold: "#b8755f",
  card: "#fdf6f1",
};

export const THEME_KEYS: (keyof Theme)[] = ["background", "foreground", "gold", "card"];

const HEX = /^#[0-9a-fA-F]{3,8}$/;
export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v.trim());
}
function clean(v: unknown, fallback: string): string {
  return isHex(v) ? (v as string).trim() : fallback;
}

const rt = rawTheme as Partial<Record<keyof Theme, unknown>>;
export const THEME: Theme = {
  background: clean(rt.background, DEFAULT_THEME.background),
  foreground: clean(rt.foreground, DEFAULT_THEME.foreground),
  gold: clean(rt.gold, DEFAULT_THEME.gold),
  card: clean(rt.card, DEFAULT_THEME.card),
};

// CSS con i valori sanificati, da iniettare in :root. `:root:root` alza la
// specificità così sovrascrive i default di globals.css a prescindere dall'ordine.
export function themeCss(t: Theme = THEME): string {
  return `:root:root{--background:${t.background};--foreground:${t.foreground};--gold:${t.gold};--card:${t.card};}`;
}
