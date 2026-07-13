"use client";

import Image from "next/image";
import { pickL10n } from "@/lib/l10n";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { CONTENT } from "@/lib/siteContent";

function Diamond() {
  return <div className="divider-diamond text-gold">◆</div>;
}

export default function GalleryGrid({ photos }: { photos: string[] }) {
  const { t, locale } = useLanguage();
  // Rete di sicurezza a runtime: nel caso normale l'elenco è già filtrato a
  // build-time (le immagini eliminate non arrivano qui), ma se un file
  // risultasse comunque non caricabile lo togliamo invece di lasciare il box.
  const [broken, setBroken] = useState<string[]>([]);
  const visible = photos.filter((src) => !broken.includes(src));

  // Lightbox: clic su una foto la ingrandisce, clic sull'ingrandita o Esc chiude.
  const [zoomed, setZoomed] = useState<string | null>(null);
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomed(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoomed]);

  return (
    <section className="px-6 py-16">
      <h1 className="font-serif-display mb-2 text-center text-3xl italic text-foreground">
        {t.gallery.title}
      </h1>
      <div className="mx-auto mb-10 max-w-xs">
        <Diamond />
      </div>
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => setZoomed(src)}
            className="relative aspect-square cursor-zoom-in overflow-hidden rounded-md border border-gold/40 transition hover:opacity-90"
          >
            <Image
              src={src}
              alt={pickL10n(CONTENT.siteTitle, locale)}
              fill
              className="object-cover"
              onError={() => setBroken((b) => (b.includes(src) ? b : [...b, src]))}
            />
          </button>
        ))}
      </div>

      {/* Lightbox: clic ovunque (immagine o sfondo) o Esc chiude */}
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomed(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomed}
            alt={pickL10n(CONTENT.siteTitle, locale)}
            className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </section>
  );
}
