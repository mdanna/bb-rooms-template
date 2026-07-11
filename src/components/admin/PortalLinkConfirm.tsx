"use client";

import { useState } from "react";

// Pagina di conferma dell'associazione al portale, lato SITO. L'host arriva qui
// dal portale (redirect) e conferma autenticato come admin di QUESTO sito.
export default function PortalLinkConfirm({
  portal,
  name,
  token,
  action,
}: {
  portal: string;
  name: string;
  token: string;
  action: "link" | "unlink";
}) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const valid = /^https?:\/\//i.test(portal) && token.length > 0;
  const brand = name || "portale";

  async function go() {
    setState("working");
    try {
      const res = await fetch("/api/admin/portal-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal, name, token, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMsg(data.error || "Operazione fallita.");
        return;
      }
      setState("done");
      if (action === "link") {
        setMsg(
          data.portalOk
            ? "Collegato! Il portale ora ti mostra e il tuo sito avrà il link di ritorno tra 1-2 minuti."
            : `Il tuo sito è aggiornato, ma il portale non ha risposto (${data.portalErr}). Riprova l'associazione dal portale.`,
        );
      } else {
        setMsg(
          data.portalOk
            ? "Scollegato. Il link di ritorno sparirà tra 1-2 minuti."
            : `Il tuo sito è aggiornato, ma il portale non ha risposto (${data.portalErr}).`,
        );
      }
    } catch {
      setState("error");
      setMsg("Errore di rete. Riprova.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Portale</p>

      {!valid ? (
        <>
          <h1 className="font-serif-display text-3xl italic text-foreground">Link non valido</h1>
          <p className="max-w-md text-sm text-foreground/70">
            Questo link di associazione non è valido o è scaduto. Riparti dal portale.
          </p>
        </>
      ) : state === "done" ? (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold text-3xl text-[#faf6ec]">
            ✓
          </div>
          <h1 className="font-serif-display text-3xl italic text-foreground">Fatto</h1>
          <p className="max-w-md text-sm text-foreground/70">{msg}</p>
          <a
            href={`${portal.replace(/\/+$/, "")}/admin`}
            className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
          >
            Torna al portale →
          </a>
        </>
      ) : (
        <>
          <h1 className="font-serif-display text-3xl italic text-foreground">
            {action === "link" ? "Collega al portale" : "Scollega dal portale"}
          </h1>
          <p className="max-w-md text-sm text-foreground/70">
            {action === "link" ? (
              <>
                Vuoi collegare <b>questo sito</b> al portale <b>{brand}</b>? Comparirà nella
                sua vetrina e nel footer del tuo sito verrà mostrato un link di ritorno al portale.
              </>
            ) : (
              <>
                Vuoi scollegare <b>questo sito</b> dal portale <b>{brand}</b>? Sparirà dalla
                sua vetrina e il link di ritorno verrà rimosso dal tuo sito.
              </>
            )}
          </p>
          <div className="text-xs text-foreground/40">{portal}</div>

          {state === "error" && (
            <div className="max-w-md rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-700">
              {msg}
            </div>
          )}

          <div className="flex items-center gap-3">
            <a
              href="/admin"
              className="rounded-full border border-foreground/30 px-6 py-3 text-sm uppercase tracking-widest text-foreground/70 transition hover:border-gold hover:text-gold"
            >
              Annulla
            </a>
            <button
              type="button"
              onClick={go}
              disabled={state === "working"}
              className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-50"
            >
              {state === "working" ? "Attendi…" : action === "link" ? "Conferma collegamento" : "Conferma scollegamento"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
