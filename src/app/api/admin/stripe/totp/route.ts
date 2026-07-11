import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { getStatus, startEnrollment, confirmEnrollment, resetEnrollment } from "@/lib/totp";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// Fattore di recupero per il reset dell'enrollment (telefono perso):
// passphrase dedicata (env) OPPURE email super-admin (env). Se nessuno dei due è
// configurato, il reset è consentito a qualsiasi admin loggato (documentato).
function canReset(email: string | null | undefined, recovery: unknown): boolean {
  const pass = process.env.STRIPE_ADMIN_RESET_PASSPHRASE;
  const superEmails = (process.env.STRIPE_ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const hasPass = !!pass;
  const hasSuper = superEmails.length > 0;
  if (!hasPass && !hasSuper) return true;
  if (hasPass && typeof recovery === "string" && safeEqual(recovery, pass!)) return true;
  if (hasSuper && email && superEmails.includes(email.toLowerCase())) return true;
  return false;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  return NextResponse.json({ status: await getStatus() });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null) as { action?: string; code?: string; recovery?: string } | null;
  const action = body?.action;

  if (action === "enroll") {
    if ((await getStatus()) === "confirmed") {
      return NextResponse.json({ error: "Authenticator già configurato: esegui prima un reset." }, { status: 409 });
    }
    const { base32, uri } = await startEnrollment();
    const qr = await QRCode.toDataURL(uri);
    return NextResponse.json({ base32, uri, qr });
  }

  if (action === "confirm") {
    const code = String(body?.code ?? "").trim();
    if (!/^\d{6}$/.test(code) || !(await confirmEnrollment(code))) {
      return NextResponse.json({ error: "Codice non valido" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "reset") {
    if (!canReset(session.user?.email, body?.recovery)) {
      return NextResponse.json({ error: "Recupero non autorizzato" }, { status: 403 });
    }
    await resetEnrollment();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
}
