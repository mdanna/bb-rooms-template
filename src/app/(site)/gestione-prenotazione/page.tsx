"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "@/i18n/format";

type State = "idle" | "sending" | "sent" | "error";

export default function GestionePrenotazionePage() {
  const { t } = useLanguage();
  const mlp = t.manageLinkPage;
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setState("sending");
    setError("");

    try {
      const res = await fetch(`/api/bookings/${trimmed}/management-link`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "error");
      }
      setState("sent");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "error");
    }
  }

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif-display text-3xl italic text-foreground">
          {mlp.title}
        </h1>
        <p className="mt-4 text-foreground/70">
          {format(mlp.description, { example: "ABC123" })}
        </p>

        {state === "sent" ? (
          <div className="mt-8 rounded-lg border border-gold/40 bg-card p-6">
            <p className="text-foreground">{mlp.sent}</p>
            <p className="mt-2 text-sm text-foreground/60">
              {mlp.spamNote}{" "}
              <button
                onClick={() => { setState("idle"); setCode(""); }}
                className="text-gold underline"
              >
                {mlp.retry}
              </button>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-foreground/60">
                {mlp.codeLabel}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={mlp.codePlaceholder}
                required
                className="mt-1 w-full rounded border border-gold/40 bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-gold"
              />
            </div>

            {state === "error" && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={state === "sending" || !code.trim()}
              className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === "sending" ? mlp.sending : mlp.submitButton}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
