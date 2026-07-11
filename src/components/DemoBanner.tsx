"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Barra fissa in cima all'istanza demo (pubblico + admin). Gated su
// NEXT_PUBLIC_DEMO_MODE (inlinato a build). Inerte nelle istanze reali.
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function DemoBanner() {
  const pathname = usePathname();
  if (!DEMO) return null;
  const onAdmin = pathname?.startsWith("/admin");
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-gold px-4 py-2 text-center text-xs text-[#faf6ec]">
      <span>
        <strong className="font-semibold">Modalità demo</strong> · le modifiche non vengono salvate
      </span>
      {/* Rende il pannello sempre scopribile: chi arriva sul sito pubblico non
          deve indovinare l'URL /admin. Dentro l'admin, il link torna al sito. */}
      <Link
        href={onAdmin ? "/" : "/admin"}
        className="rounded-full bg-[#faf6ec] px-3 py-1 font-medium text-gold transition hover:opacity-90"
      >
        {onAdmin ? "← Vedi il sito pubblico" : "Entra nel pannello di gestione →"}
      </Link>
      <a
        href="https://dimorasuite.com/inizia.html"
        target="_blank"
        rel="noopener"
        className="underline"
      >
        Richiedi il tuo sito
      </a>
    </div>
  );
}
