import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFile, putFile, requireBotToken } from "@/lib/githubContent";
import { POLICIES, type Policies } from "@/lib/policies";

const FILE_PATH = "src/data/policies.json";

function isValidPolicies(body: unknown): body is Policies {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.cityTaxPerPersonPerNight === "number" &&
    typeof b.cityTaxMaxNights === "number" &&
    typeof b.defaultDepositRate === "number" &&
    typeof b.minDepositRate === "number" &&
    typeof b.balanceDueDays === "number" &&
    typeof b.cancelFullRefundDays === "number" &&
    typeof b.cancelHalfRefundDays === "number" &&
    typeof b.cancelPartialRefundPct === "number" &&
    typeof b.cancelFeePercent === "number" &&
    typeof b.minAdvanceBookingDays === "number" &&
    typeof b.minNights === "number" &&
    typeof b.maxNights === "number" &&
    typeof b.maxGuests === "number" &&
    typeof b.balanceReminderDaysFirst === "number" &&
    typeof b.balanceReminderDaysSecond === "number" &&
    typeof b.checkinTime === "string" &&
    typeof b.checkoutTime === "string"
  );
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  try {
    const token = process.env.GITHUB_BOT_TOKEN ?? "";
    const { content } = await getFile(FILE_PATH, token);
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json(POLICIES);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!isValidPolicies(body)) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  try {
    const token = requireBotToken();
    let sha: string;
    let current: Policies = POLICIES;
    try {
      const { content: cur, sha: fileSha } = await getFile(FILE_PATH, token);
      sha = fileSha;
      current = JSON.parse(cur);
    } catch {
      sha = "";
    }
    // Merge sui campi correnti: preserva `calendars` (gestito dalla pagina Impostazioni)
    // e ogni altro campo non-policy presente nel file.
    const updated: Policies = { ...current, ...body };
    const content = JSON.stringify(updated, null, 2) + "\n";
    const { commitSha } = await putFile(FILE_PATH, content, sha, "Update policies", token);
    return NextResponse.json({ ok: true, commitSha });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Salvataggio fallito" },
      { status: 502 }
    );
  }
}
