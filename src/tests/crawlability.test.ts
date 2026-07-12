import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import robots from "@/app/robots";

describe("crawlability — robots", () => {
  it("non blocca Googlebot né Googlebot-Image sulle pagine pubbliche", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const star = rules.find((x) => x.userAgent === "*");
    expect(star).toBeDefined();
    const disallow = ([] as string[]).concat(star!.disallow ?? []);
    // La radice (pagina-struttura) non deve essere bloccata.
    expect(disallow).not.toContain("/");
    // Le immagini (servite da /images/) devono restare scansionabili.
    expect(disallow).not.toContain("/images");
    expect(disallow).not.toContain("/images/");
    // La pagina recensioni pubblica non deve essere bloccata.
    expect(disallow.some((d) => "/recensioni".startsWith(d) && d.length > 1)).toBe(false);
  });

  it("dichiara la sitemap", () => {
    expect(robots().sitemap).toBeTruthy();
  });
});

describe("crawlability — nessun noindex sulle pagine-struttura", () => {
  it("nessuna pagina pubblica in (site) imposta noindex/index:false", () => {
    const siteDir = path.join(process.cwd(), "src/app/(site)");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          const src = fs.readFileSync(p, "utf8");
          if (/noindex/i.test(src) || /index:\s*false/.test(src)) offenders.push(p);
        }
      }
    };
    walk(siteDir);
    expect(offenders).toEqual([]);
  });
});
