import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONTENT } from "@/lib/siteContent";
import GalleryGrid from "@/components/GalleryGrid";

// Statica: il filtro sui file esistenti deve girare a build-time (quando
// public/images è sul filesystem), non a runtime — su Vercel gli asset di
// public/ non stanno sul filesystem della function, quindi un fs.existsSync
// runtime li nasconderebbe tutti. force-static garantisce il prerender.
export const dynamic = "force-static";

const IMAGES_DIR = join(process.cwd(), "public", "images");

export default function GalleriaPage() {
  // Scarta i riferimenti a immagini eliminate dall'admin ma ancora presenti in
  // content.json (la delete non ripulisce la selezione): così il riquadro vuoto
  // non arriva mai al client — niente placeholder, niente flash.
  const photos = CONTENT.galleryImages
    .filter((name) => existsSync(join(IMAGES_DIR, name)))
    .map((name) => `/images/${name}`);

  return <GalleryGrid photos={photos} />;
}
