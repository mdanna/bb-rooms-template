"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Sfondo dell'hero (home o camera): una o più foto di copertina.
 * - 1 foto → statica, identica a prima (nessun timer, nessun indicatore).
 * - più foto → carosello a dissolvenza con indicatori cliccabili; avanza da solo solo
 *   se l'utente NON ha richiesto "riduci animazioni" (prefers-reduced-motion).
 * Solo la PRIMA immagine ha `priority` (è l'LCP); le altre restano lazy.
 * Il testo/CTA dell'hero restano fratelli sovrapposti (questo componente è lo sfondo).
 */
export default function HeroBackdrop({
  images,
  intervalSec,
  veilClassName,
}: {
  images: string[];
  intervalSec: number;
  veilClassName: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ms = Math.max(1, intervalSec) * 1000;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), ms);
    return () => clearInterval(id);
  }, [images.length, intervalSec]);

  return (
    <>
      {images.map((src, i) => (
        <Image
          key={src + i}
          src={`/images/${src}`}
          alt=""
          fill
          priority={i === 0}
          className={`object-cover transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className={`absolute inset-0 ${veilClassName}`} />

      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={String(i + 1)}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-5 bg-gold" : "w-2 bg-foreground/30 hover:bg-foreground/50"
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}
