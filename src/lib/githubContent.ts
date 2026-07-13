import { DEMO_MODE } from "@/lib/demo";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "your-github-username";
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "your-repo-name";
const DATA_BRANCH = process.env.GITHUB_DATA_BRANCH ?? "main";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function getFile(path: string, token: string) {
  if (DEMO_MODE) {
    // In demo si legge dal FILESYSTEM del deployment (i JSON di src/data sono nel bundle,
    // committati), non da GitHub: nessuna credenziale. Letto per path → nessuna camera è
    // cablata (l'insieme delle unità resta dinamico). Le scritture restano no-op.
    try {
      const content = readFileSync(join(process.cwd(), path), "utf-8");
      return { content, sha: "demo" };
    } catch {
      return { content: "", sha: "demo" };
    }
  }
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${DATA_BRANCH}`,
    { headers: headers(token), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Impossibile leggere ${path} da GitHub: ${await res.text()}`);
  }
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha as string };
}

export async function putFile(
  path: string,
  content: string,
  sha: string,
  message: string,
  token: string
) {
  // In demo non si scrive nulla su GitHub: successo simulato, nessun commit/redeploy.
  if (DEMO_MODE) return { commitSha: undefined as string | undefined };
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: "PUT",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf-8").toString("base64"),
        sha,
        branch: DATA_BRANCH,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Impossibile salvare ${path} su GitHub: ${await res.text()}`);
  }
  const data = await res.json();
  return { commitSha: data.commit?.sha as string | undefined };
}

/** True se il file esiste sul branch dati (in demo: se è leggibile da filesystem). */
export async function fileExists(path: string, token: string): Promise<boolean> {
  try {
    const { content } = await getFile(path, token);
    return content !== "";
  } catch {
    return false;
  }
}

// Operazione su un file per il commit multi-file: scrittura (content) o eliminazione.
export type FileOp = { path: string; content: string } | { path: string; remove: true };

/**
 * Committa PIÙ file in UN SOLO commit (Git Trees API) → un solo redeploy. Usato per le
 * operazioni "strutturali" (aggiungere/rimuovere una camera tocca structure.json + i file
 * per-unità insieme). In demo è no-op. Restituisce lo sha del commit creato.
 */
export async function putFiles(
  ops: FileOp[],
  message: string,
  token: string
): Promise<{ commitSha: string | undefined }> {
  if (DEMO_MODE || ops.length === 0) return { commitSha: undefined };
  const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
  const jsonHeaders = { ...headers(token), "Content-Type": "application/json" };

  const refRes = await fetch(`${api}/git/ref/heads/${DATA_BRANCH}`, { headers: headers(token), cache: "no-store" });
  if (!refRes.ok) throw new Error(`Impossibile leggere il ref: ${await refRes.text()}`);
  const baseCommitSha = (await refRes.json()).object.sha as string;

  const commitRes = await fetch(`${api}/git/commits/${baseCommitSha}`, { headers: headers(token), cache: "no-store" });
  if (!commitRes.ok) throw new Error(`Impossibile leggere il commit base: ${await commitRes.text()}`);
  const baseTreeSha = (await commitRes.json()).tree.sha as string;

  const tree = ops.map((op) =>
    "remove" in op
      ? { path: op.path, mode: "100644" as const, type: "blob" as const, sha: null }
      : { path: op.path, mode: "100644" as const, type: "blob" as const, content: op.content }
  );
  const treeRes = await fetch(`${api}/git/trees`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  if (!treeRes.ok) throw new Error(`Impossibile creare il tree: ${await treeRes.text()}`);
  const newTreeSha = (await treeRes.json()).sha as string;

  const newCommitRes = await fetch(`${api}/git/commits`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ message, tree: newTreeSha, parents: [baseCommitSha] }),
  });
  if (!newCommitRes.ok) throw new Error(`Impossibile creare il commit: ${await newCommitRes.text()}`);
  const newCommitSha = (await newCommitRes.json()).sha as string;

  const updRes = await fetch(`${api}/git/refs/heads/${DATA_BRANCH}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({ sha: newCommitSha }),
  });
  if (!updRes.ok) throw new Error(`Impossibile aggiornare il ref: ${await updRes.text()}`);
  return { commitSha: newCommitSha };
}

export async function deleteFile(
  path: string,
  sha: string,
  message: string,
  token: string
) {
  if (DEMO_MODE) return;
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: "DELETE",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ message, sha, branch: DATA_BRANCH }),
    }
  );
  if (!res.ok) {
    throw new Error(`Impossibile eliminare ${path} da GitHub: ${await res.text()}`);
  }
}

export function requireBotToken(): string {
  if (DEMO_MODE) return "demo";
  const token = process.env.GITHUB_BOT_TOKEN;
  if (!token) {
    throw new Error("GITHUB_BOT_TOKEN non configurato");
  }
  return token;
}
