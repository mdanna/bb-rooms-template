"use client";

import { useEffect, useState, useRef } from "react";
import type { SiteContent } from "@/lib/siteContent";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import DeployToast from "@/components/admin/DeployToast";

interface ImageFile {
  name: string;
  sha: string;
  url?: string; // in demo: data URL effimero dell'immagine caricata (non persiste)
}

type UploadState = "idle" | "uploading" | "success" | "error";
type SaveState = "idle" | "saving" | "success" | "error";

const MAX_GALLERY = 12;

export default function ImageManager() {
  const { t } = useAdminLanguage();
  const ti = t.images;
  const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [heroImage, setHeroImage] = useState<string>("");
  const [inGallery, setInGallery] = useState<string[]>([]); // appartenenza alla galleria
  const [order, setOrder] = useState<string[]>([]); // ordine unificato di TUTTE le immagini
  const [fullContent, setFullContent] = useState<SiteContent | null>(null);

  const [selectionDirty, setSelectionDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deploySha, setDeploySha] = useState<string | null>(null);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Immagini appena caricate: committate su GitHub ma non ancora servite (il file
  // compare solo dopo il redeploy Vercel). Restano "in pubblicazione" — con avviso
  // e placeholder — finché il loro <img> non riesce a caricarsi (onLoad).
  const [pending, setPending] = useState<string[]>([]);
  const [tick, setTick] = useState(0); // ticker condiviso: ogni 3s riprova a caricare le immagini in pubblicazione
  const MAX_UPLOAD_TICKS = 60; // ~3 min: oltre, si rinuncia (comparirà al refresh)

  // Lightbox: click sulla miniatura ingrandisce, click sull'ingrandita chiude.
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  // Riconcilia l'ordine unificato coi file realmente presenti: mantiene l'ordine
  // salvato per i file esistenti e appende in fondo i nuovi (es. appena caricati).
  function reconcileOrder(names: string[], stored: string[]) {
    return [...stored.filter((n) => names.includes(n)), ...names.filter((n) => !stored.includes(n))];
  }

  async function loadImages() {
    const res = await fetch("/api/admin/images");
    const data = await res.json() as { files?: ImageFile[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? t.common.error);
    const files = data.files ?? [];
    setImages(files);
    setOrder((prev) => reconcileOrder(files.map((f) => f.name), prev));
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/images").then((r) => r.json() as Promise<{ files?: ImageFile[]; error?: string }>),
      fetch("/api/admin/content").then((r) => r.json() as Promise<SiteContent>),
    ])
      .then(([imgData, contentData]) => {
        if (cancelled) return;
        const files = imgData.files ?? [];
        setImages(files);
        setHeroImage(contentData.heroImage ?? "");
        setInGallery(contentData.galleryImages ?? []);
        // Ordine unificato: usa imageOrder se presente, altrimenti l'ordine dei file
        // (così la copertina resta al suo posto naturale, non viene esiliata in fondo).
        setOrder(reconcileOrder(files.map((f) => f.name), contentData.imageOrder ?? []));
        setFullContent(contentData);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(t.common.error);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mentre ci sono immagini "in pubblicazione", un solo timer (cadenza 3s) fa
  // avanzare il ticker: cambia il query param di quelle immagini → il browser
  // riprova a scaricarle. Quando l'ultima si carica (onLoad) pending si svuota e
  // il timer si ferma. Dopo MAX_UPLOAD_TICKS si rinuncia.
  useEffect(() => {
    if (pending.length === 0) return;
    const id = window.setTimeout(() => {
      if (tick + 1 >= MAX_UPLOAD_TICKS) setPending([]); // rinuncia: comparirà al refresh
      else setTick((n) => n + 1);
    }, 3000);
    return () => window.clearTimeout(id);
  }, [pending.length, tick]);

  function markDirty() {
    setSelectionDirty(true);
    setSaveState("idle");
  }

  function toggleHero(name: string) {
    setHeroImage((prev) => (prev === name ? "" : name));
    markDirty();
  }

  function toggleGallery(name: string) {
    setInGallery((prev) => {
      const has = prev.includes(name);
      if (has) return prev.filter((n) => n !== name);
      if (prev.length >= MAX_GALLERY) return prev;
      return [...prev, name];
    });
    markDirty();
  }

  // Sposta l'immagine nell'ordine unificato (copertina inclusa).
  function move(name: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(name);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    markDirty();
  }

  async function handleSaveSelection() {
    if (!fullContent) return;
    setSaveState("saving");
    try {
      // Galleria pubblica = immagini in galleria, nell'ordine unificato scelto dall'admin.
      const galleryImages = order.filter((n) => inGallery.includes(n));
      const body: SiteContent = { ...fullContent, heroImage, galleryImages, imageOrder: order };
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; commitSha?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      setFullContent(body);
      setSaveState("success");
      if (data.commitSha) setDeploySha(data.commitSha);
      setSelectionDirty(false);
      setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("error");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState("uploading");
    setUploadError("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(t.common.error));
        reader.readAsDataURL(file);
      });
      if (DEMO) {
        // Anteprima effimera: l'immagine appare subito ma non viene salvata
        // (nessuna scrittura su GitHub). Persa al refresh — coerente con la demo.
        const name = images.some((i) => i.name === file.name) ? `${Date.now()}-${file.name}` : file.name;
        setImages((prev) => [...prev, { name, sha: "demo", url: dataUrl }]);
        setOrder((prev) => [...prev, name]);
        setUploadState("success");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setUploadState("idle"), 4000);
        return;
      }
      const base64 = dataUrl.split(",")[1] ?? "";
      const res = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, base64, mimeType: file.type }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      setUploadState("success");
      // Committata su GitHub ma non ancora servita: marcala "in pubblicazione"
      // finché il redeploy non la rende visibile (il suo <img> farà onLoad).
      setPending((p) => (p.includes(file.name) ? p : [...p, file.name]));
      setTick(0);
      await loadImages();
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setUploadState("idle"), 3000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.common.error);
      setUploadState("error");
    }
  }

  function forgetLocally(name: string) {
    setImages((prev) => prev.filter((i) => i.name !== name));
    setOrder((prev) => prev.filter((n) => n !== name));
    if (heroImage === name) setHeroImage("");
    setInGallery((prev) => prev.filter((n) => n !== name));
    setPending((prev) => prev.filter((n) => n !== name));
  }

  async function handleDelete(name: string) {
    if (!confirm(`${ti.delete} "${name}"?`)) return;
    if (DEMO) {
      forgetLocally(name);
      markDirty();
      return;
    }
    setDeletingName(name);
    try {
      const res = await fetch("/api/admin/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; contentUpdated?: boolean; commitSha?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      // Il server ha già rimosso i riferimenti da content.json (hero, galleria, ordine):
      // allinea lo stato locale senza marcare la selezione come "da salvare".
      forgetLocally(name);
      setFullContent((prev) => prev ? {
        ...prev,
        heroImage: prev.heroImage === name ? "" : prev.heroImage,
        galleryImages: prev.galleryImages.filter((n) => n !== name),
        imageOrder: (prev.imageOrder ?? []).filter((n) => n !== name),
      } : prev);
      if (data.commitSha) setDeploySha(data.commitSha);
      await loadImages();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.common.error);
    } finally {
      setDeletingName(null);
    }
  }

  const arrowCls =
    "rounded border border-gold/40 px-1.5 text-xs text-foreground/70 transition hover:bg-gold/15 hover:text-gold disabled:border-gold/10 disabled:text-foreground/20 disabled:hover:bg-transparent disabled:cursor-not-allowed";

  return (
    <div className="space-y-6">
      {/* Carica immagine: prima delle immagini (come il pannello portale) */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadState === "uploading"}
          className="rounded-full border border-gold/40 px-4 py-2 text-xs uppercase tracking-widest text-foreground/70 transition hover:bg-gold/10 disabled:opacity-50"
        >
          {uploadState === "uploading" ? ti.uploading : ti.upload}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        {uploadState === "success" && <span className="text-xs text-green-700">{DEMO ? t.common.demoImage : t.common.success}</span>}
        {uploadState === "error" && <span className="text-xs text-red-600">{uploadError}</span>}
        {!loading && (
          <span className="ml-auto text-xs text-foreground/45">{ti.legend}</span>
        )}
      </div>

      {/* Avviso: immagini appena caricate ancora in pubblicazione (redeploy in corso).
          Sparisce da solo appena l'ultima immagine riesce a caricarsi. */}
      {pending.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-foreground/80">
          <span className="inline-block h-3 w-3 shrink-0 animate-pulse rounded-full bg-gold" aria-hidden />
          {ti.publishing}
        </div>
      )}

      {/* Libreria immagini: un unico ordine, controllato dall'admin. Ogni miniatura ha
          i toggle principale/galleria e le frecce di riordino (copertina inclusa). */}
      {loading ? (
        <p className="text-sm text-foreground/60">{t.common.loading}</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-foreground/50">{ti.noImages}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {order.map((name, idx) => {
            const img = images.find((i) => i.name === name);
            if (!img) return null;
            const isHero = heroImage === name;
            const inGal = inGallery.includes(name);
            const galleryFull = inGallery.length >= MAX_GALLERY && !inGal;
            const isPending = pending.includes(name);
            // Per un'immagine "in pubblicazione" il query param (tick) cambia ogni 3s
            // così il browser riprova a scaricarla finché il deploy non la serve.
            const src = img.url ?? (isPending ? `/images/${name}?v=${tick}` : `/images/${name}`);
            return (
              <div key={name} className={`overflow-hidden rounded-lg border ${isHero || inGal ? "border-gold/50" : "border-gold/20"}`}>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={name}
                    onClick={() => { if (!isPending) setZoomSrc(src); }}
                    className={`h-36 w-full object-cover ${isPending ? "opacity-0" : "cursor-zoom-in"}`}
                    onLoad={() => { if (isPending) setPending((p) => p.filter((n) => n !== name)); }}
                    onError={(e) => {
                      // In pubblicazione: non nascondere, ci riprova il ticker condiviso.
                      if (!isPending) (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {isPending && (
                    <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-gold/10 text-[10px] uppercase tracking-widest text-foreground/40">
                      …
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 bg-card/60 px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleHero(name)}
                      title={ti.hero}
                      className={`rounded border px-1.5 text-base leading-none transition ${isHero ? "border-gold/50 text-yellow-400" : "border-gold/30 text-foreground/50 hover:text-yellow-400"}`}
                    >
                      {isHero ? "★" : "☆"}
                    </button>
                    <button
                      onClick={() => toggleGallery(name)}
                      disabled={galleryFull}
                      title={galleryFull ? `Max ${MAX_GALLERY}` : ti.gallery}
                      className={`rounded border px-1.5 text-sm leading-none transition disabled:opacity-30 ${inGal ? "border-gold/50 text-gold" : "border-gold/30 text-foreground/50 hover:text-gold"}`}
                    >
                      {inGal ? "▦" : "▢"}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(name, -1)} disabled={idx === 0} aria-label={ti.moveLeft} className={arrowCls}>◀</button>
                    <button onClick={() => handleDelete(name)} disabled={deletingName === name} aria-label={ti.delete} className="rounded border border-gold/30 px-1.5 text-xs text-foreground/60 disabled:opacity-40 hover:border-red-400 hover:text-red-600">✕</button>
                    <button onClick={() => move(name, 1)} disabled={idx === order.length - 1} aria-label={ti.moveRight} className={arrowCls}>▶</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Salvataggio della selezione (copertina + galleria + ordine) */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSaveSelection}
          disabled={saveState === "saving" || !selectionDirty}
          className="rounded-full border border-gold bg-gold px-6 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold disabled:opacity-40"
        >
          {saveState === "saving" ? t.contents.saving : t.contents.save}
        </button>
        {saveState === "success" && <span className="text-sm text-green-600">{DEMO ? t.common.demoSaved : t.contents.saved}</span>}
        {saveState === "error" && <span className="text-sm text-red-600">{t.common.error}</span>}
      </div>

      <DeployToast sha={deploySha} onDone={() => setDeploySha(null)} />

      {/* Lightbox */}
      {zoomSrc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setZoomSrc(null)} role="dialog" aria-label={ti.gallery}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomSrc} alt="" className="max-h-[90vh] max-w-[90vw] cursor-zoom-out object-contain" />
        </div>
      )}
    </div>
  );
}
