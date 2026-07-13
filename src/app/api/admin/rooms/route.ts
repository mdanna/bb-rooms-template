import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { DEMO_MODE } from "@/lib/demo";
import { requireBotToken, getFile, putFiles, fileExists, type FileOp } from "@/lib/githubContent";
import { availPath, stripContained, occupiedNights } from "@/lib/unitAvailability";
import { pool, ensureSchema } from "@/lib/db";
import type { LocaleCode } from "@/i18n/types";
import type { DayRate, AvailabilityData } from "@/data/availability";
import availDefault from "@/data/defaults/availability.json";

const STRUCTURE_PATH = "src/data/structure.json";
const contentPath = (id: string) => `src/data/content/${id}.json`;

// Forma minimale delle unità in structure.json (qui non serve tutto il modello).
interface RawUnit {
  id: string;
  kind?: "whole" | "room";
  slug?: string;
  name?: Record<string, string>;
  contains?: string[];
  bookable?: boolean;
}
interface RawStructure {
  structureTitle?: Record<string, string>;
  defaultLocale?: string;
  units: RawUnit[];
}

/** Unità radice = quella che nessun'altra contiene (l'appartamento intero). */
function findRoot(units: RawUnit[]): RawUnit | undefined {
  const contained = new Set(units.flatMap((u) => u.contains ?? []));
  return units.find((u) => !contained.has(u.id)) ?? units[0];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Slug/id unico rispetto a id e slug già usati (mai riusato). */
function uniqueId(base: string, taken: Set<string>): string {
  const root = base || "camera";
  if (!taken.has(root)) return root;
  for (let i = 2; i < 1000; i++) {
    const cand = `${root}-${i}`;
    if (!taken.has(cand)) return cand;
  }
  return `${root}-${Date.now()}`;
}

async function readStructure(token: string): Promise<{ raw: RawStructure; sha: string }> {
  const { content } = await getFile(STRUCTURE_PATH, token);
  return { raw: JSON.parse(content) as RawStructure, sha: "" };
}

// ── POST: aggiungi una camera ────────────────────────────────────────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Il nome della camera è obbligatorio." }, { status: 400 });

  try {
    const token = requireBotToken();
    const { raw } = await readStructure(token);
    const units = Array.isArray(raw.units) ? raw.units : [];
    const root = findRoot(units);
    if (!root) return NextResponse.json({ error: "Struttura non valida." }, { status: 400 });

    const defaultLocale = (raw.defaultLocale as LocaleCode) || "it";
    const taken = new Set<string>([...units.map((u) => u.id), ...units.map((u) => u.slug ?? "")]);
    const id = uniqueId(slugify(name), taken);

    // Nuova unità camera + aggancio all'appartamento (contains).
    const newUnit: RawUnit = { id, kind: "room", slug: id, name: { [defaultLocale]: name } };
    const nextUnits = [...units, newUnit].map((u) =>
      u.id === root.id ? { ...u, contains: [...(u.contains ?? []), id] } : u
    );
    const nextStructure: RawStructure = { ...raw, units: nextUnits };

    // File per-unità di partenza: calendario dai default; contenuti = solo il titolo.
    const roomContent = {
      siteTitle: { [defaultLocale]: name },
      heroSubtitle: {},
      storyTitle: {},
      storyParagraphs: [],
      amenities: [],
      heroImage: "",
      galleryImages: [],
      imageOrder: [],
    };

    const ops: FileOp[] = [
      { path: STRUCTURE_PATH, content: JSON.stringify(nextStructure, null, 2) },
      { path: availPath(id), content: JSON.stringify(availDefault, null, 2) },
      { path: contentPath(id), content: JSON.stringify(roomContent, null, 2) },
    ];
    const { commitSha } = await putFiles(ops, `Aggiungi camera "${name}" (${id})`, token);

    return NextResponse.json({ ok: true, commitSha, unit: { id, slug: id, name } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Creazione camera fallita" },
      { status: 502 }
    );
  }
}

// ── PATCH: attiva/disattiva la prenotabilità dell'intero appartamento ────────
// Un flag `bookable` sulla radice: true = l'intero si prenota (la "/" mostra il suo
// flusso); false = solo camere (la "/" elenca le camere). Spegnerlo richiede ≥1 camera
// ed è bloccato se l'intero ha prenotazioni future attive (come la rimozione camere).
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { bookable?: unknown } | null;
  if (typeof body?.bookable !== "boolean") {
    return NextResponse.json({ error: "Valore non valido." }, { status: 400 });
  }
  const bookable = body.bookable;

  try {
    const token = requireBotToken();
    const { raw } = await readStructure(token);
    const units = Array.isArray(raw.units) ? raw.units : [];
    const root = findRoot(units);
    if (!root) return NextResponse.json({ error: "Struttura non valida." }, { status: 400 });

    if (!bookable) {
      const roomCount = units.filter((u) => u.id !== root.id && u.kind === "room").length;
      if (roomCount < 1) {
        return NextResponse.json(
          { error: "Serve almeno una camera per rendere l'intero appartamento non prenotabile." },
          { status: 400 }
        );
      }
      // GUARDIA: niente spegnimento se l'intero ha prenotazioni future attive. Le
      // prenotazioni dell'intero hanno unit_id = radice (o NULL, storiche).
      if (!DEMO_MODE) {
        await ensureSchema(); // crea la tabella bookings se l'istanza non ne ha ancora (nessuna prenotazione)
        const { rows } = await pool.query(
          `SELECT id, first_name, last_name, checkin, checkout, status
             FROM bookings
            WHERE (unit_id = $1 OR unit_id IS NULL) AND status IN ('pending','approved') AND checkout >= CURRENT_DATE
            ORDER BY checkin`,
          [root.id]
        );
        if (rows.length > 0) {
          return NextResponse.json(
            {
              error: "future_bookings",
              message: `L'intero appartamento ha ${rows.length} prenotazion${rows.length === 1 ? "e" : "i"} futur${rows.length === 1 ? "a" : "e"} da gestire prima di disattivarlo.`,
              bookings: rows.map((r) => ({
                id: r.id,
                guest: `${r.first_name} ${r.last_name}`.trim(),
                checkin: r.checkin,
                checkout: r.checkout,
                status: r.status,
              })),
            },
            { status: 409 }
          );
        }
      }
    }

    const nextUnits = units.map((u) => (u.id === root.id ? { ...u, bookable } : u));
    const nextStructure: RawStructure = { ...raw, units: nextUnits };
    const { commitSha } = await putFiles(
      [{ path: STRUCTURE_PATH, content: JSON.stringify(nextStructure, null, 2) }],
      bookable ? "Attiva prenotazione intero appartamento" : "Disattiva prenotazione intero (solo camere)",
      token
    );
    return NextResponse.json({ ok: true, commitSha, bookable });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Operazione fallita" },
      { status: 502 }
    );
  }
}

// ── DELETE: rimuovi una camera ───────────────────────────────────────────────
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const url = new URL(request.url);
  const unitId = url.searchParams.get("unit")?.trim() ?? "";
  if (!unitId) return NextResponse.json({ error: "Camera non specificata." }, { status: 400 });

  try {
    const token = requireBotToken();
    const { raw } = await readStructure(token);
    const units = Array.isArray(raw.units) ? raw.units : [];
    const root = findRoot(units);
    const target = units.find((u) => u.id === unitId);

    if (!root) return NextResponse.json({ error: "Struttura non valida." }, { status: 400 });
    if (!target) return NextResponse.json({ error: "Camera non trovata." }, { status: 404 });
    if (target.id === root.id) {
      return NextResponse.json({ error: "Non si può rimuovere l'appartamento intero." }, { status: 400 });
    }
    if (target.kind === "whole" || (target.contains?.length ?? 0) > 0) {
      return NextResponse.json({ error: "Si possono rimuovere solo le camere." }, { status: 400 });
    }
    // Un contenitore (appartamento non prenotabile) deve mantenere almeno una camera.
    const roomsAfter = units.filter((u) => u.id !== unitId && u.id !== root.id).length;
    if (root.bookable === false && roomsAfter < 1) {
      return NextResponse.json(
        { error: "Deve restare almeno una camera: questo appartamento non è prenotabile per intero." },
        { status: 400 }
      );
    }

    // GUARDIA: niente rimozione se la camera ha prenotazioni FUTURE attive (in attesa o
    // confermate). Coerente con la regola niente rimborsi automatici: l'operatore le
    // gestisce prima. Le prenotazioni passate restano nello storico.
    if (!DEMO_MODE) {
      await ensureSchema(); // crea la tabella bookings se l'istanza non ne ha ancora (nessuna prenotazione)
      const { rows } = await pool.query(
        `SELECT id, first_name, last_name, checkin, checkout, status
           FROM bookings
          WHERE unit_id = $1 AND status IN ('pending','approved') AND checkout >= CURRENT_DATE
          ORDER BY checkin`,
        [unitId]
      );
      if (rows.length > 0) {
        return NextResponse.json(
          {
            error: "future_bookings",
            message: `La camera ha ${rows.length} prenotazion${rows.length === 1 ? "e" : "i"} futur${rows.length === 1 ? "a" : "e"} da gestire prima di rimuoverla.`,
            bookings: rows.map((r) => ({
              id: r.id,
              guest: `${r.first_name} ${r.last_name}`.trim(),
              checkin: r.checkin,
              checkout: r.checkout,
              status: r.status,
            })),
          },
          { status: 409 }
        );
      }
    }

    // Struttura senza la camera: togli l'unità e il riferimento in contains dell'appartamento.
    const nextUnits = units
      .filter((u) => u.id !== unitId)
      .map((u) =>
        u.id === root.id ? { ...u, contains: (u.contains ?? []).filter((c) => c !== unitId) } : u
      );
    const nextStructure: RawStructure = { ...raw, units: nextUnits };

    const ops: FileOp[] = [{ path: STRUCTURE_PATH, content: JSON.stringify(nextStructure, null, 2) }];

    // Ricalcola il layer "contained" dell'appartamento dalle camere RIMASTE (STRUCTURE
    // statica è stale dopo questa modifica, quindi lo facciamo qui esplicitamente). Solo
    // la radice cambia: le camere non dipendono dalle sorelle.
    const remainingRoomIds = (root.contains ?? []).filter((c) => c !== unitId);
    const rootAvailRaw = await getFile(availPath(root.id), token);
    const rootAvail = JSON.parse(rootAvailRaw.content) as AvailabilityData;
    const rootOwn = stripContained(rootAvail.overrides ?? []);
    const rootOccupied = occupiedNights(rootOwn);
    const contained = new Set<string>();
    for (const rid of remainingRoomIds) {
      try {
        const { content } = await getFile(availPath(rid), token);
        const av = JSON.parse(content) as AvailabilityData;
        for (const n of occupiedNights(stripContained(av.overrides ?? []))) {
          if (!rootOccupied.has(n)) contained.add(n);
        }
      } catch { /* camera senza file: ignora */ }
    }
    const dp = rootAvail.defaultPrice;
    const containedEntries: DayRate[] = [...contained]
      .sort()
      .map((date) => ({ date, price: dp, status: "booked" as const, source: "contained" as const }));
    const nextRootOverrides = [...rootOwn, ...containedEntries].sort((a, b) => a.date.localeCompare(b.date));
    if (JSON.stringify(nextRootOverrides) !== JSON.stringify(rootAvail.overrides ?? [])) {
      ops.push({
        path: availPath(root.id),
        content: JSON.stringify({ defaultPrice: dp, overrides: nextRootOverrides }, null, 2),
      });
    }

    // Elimina i file per-unità della camera (solo se esistono).
    for (const p of [availPath(unitId), contentPath(unitId)]) {
      if (await fileExists(p, token)) ops.push({ path: p, remove: true });
    }

    const { commitSha } = await putFiles(ops, `Rimuovi camera ${unitId}`, token);
    return NextResponse.json({ ok: true, commitSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rimozione camera fallita" },
      { status: 502 }
    );
  }
}
