import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireBotToken } from "@/lib/githubContent";

const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "your-github-username";
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "your-repo-name";

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// Strategia primaria: GitHub Deployments API (richiede permesso "Deployments"
// sul bot token; rileva anche i fallimenti di build).
async function checkViaDeployments(sha: string, token: string): Promise<string | null> {
  const depRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/deployments?sha=${sha}&per_page=5`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!depRes.ok) return null; // token senza permesso Deployments → fallback

  const deployments = (await depRes.json()) as { id: number; environment: string }[];
  if (deployments.length === 0) return "waiting";

  const dep = deployments.find((d) => /production/i.test(d.environment)) ?? deployments[0];
  const stRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/deployments/${dep.id}/statuses?per_page=1`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!stRes.ok) return null;

  const statuses = (await stRes.json()) as { state: string }[];
  const state = statuses[0]?.state ?? "pending";
  if (state === "success") return "ready";
  if (state === "error" || state === "failure") return "error";
  return "building";
}

// Fallback: confronta lo SHA del deployment live (/api/version del sito
// pubblico) con il commit salvato. Richiede solo il permesso "Contents"
// (per la compare API). Non rileva i fallimenti di build.
async function checkViaLiveVersion(sha: string, token: string): Promise<string> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null);
  if (!siteUrl) return "building";

  const vRes = await fetch(`${siteUrl.replace(/\/$/, "")}/api/version`, { cache: "no-store" });
  if (!vRes.ok) return "building";
  const { sha: liveSha } = (await vRes.json()) as { sha?: string | null };
  if (!liveSha) return "building";

  if (liveSha === sha) return "ready";

  // liveSha diverso: il commit salvato è già incluso nel deployment live?
  // (succede se un altro commit è stato deployato subito dopo il nostro)
  const cmpRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/compare/${liveSha}...${sha}`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!cmpRes.ok) return "building";
  const { status } = (await cmpRes.json()) as { status?: string };
  // "behind"/"identical" = il commit salvato è antenato (o uguale) del live → è online
  return status === "behind" || status === "identical" ? "ready" : "building";
}

// GET /api/admin/deploy-status?sha=<commit sha>
// Returns: { state: "waiting" | "building" | "ready" | "error" }
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const sha = new URL(request.url).searchParams.get("sha");
  if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
    return NextResponse.json({ error: "SHA non valido" }, { status: 400 });
  }

  const token = requireBotToken();

  try {
    const viaDeployments = await checkViaDeployments(sha, token);
    if (viaDeployments) return NextResponse.json({ state: viaDeployments });

    const viaVersion = await checkViaLiveVersion(sha, token);
    return NextResponse.json({ state: viaVersion });
  } catch {
    return NextResponse.json({ state: "building" });
  }
}
