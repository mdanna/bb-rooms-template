"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { MapBookmark } from "@/lib/siteContent";

interface Marker {
  lat: number;
  lon: number;
  label: string;
  color: string;
}

interface Props {
  markers?: Marker[];
  bookmarks?: MapBookmark[];
  centerLat?: number;
  centerLng?: number;
}

export default function AreaMap({ markers, bookmarks, centerLat, centerLng }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  // Build a unified list of markers from either prop
  const allMarkers: Marker[] = markers
    ? markers
    : (bookmarks ?? []).map((b, i) => ({
        lat: b.lat,
        lon: b.lng,
        label: b.label,
        color: i === 0 ? "#dc2626" : "#7C3AED",
      }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const firstLat = centerLat ?? allMarkers[0]?.lat ?? 41.909069;
      const firstLon = centerLng ?? allMarkers[0]?.lon ?? 12.4599;
      const center: [number, number] = [firstLat, firstLon];
      const map = L.map(containerRef.current).setView(center, 16);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      allMarkers.forEach((m) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${m.color};width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        // Tooltip su hover (non permanente): l'etichetta compare passandoci sopra,
        // senza ingombrare la mappa. L'elenco completo dei segnalibri è nella legenda
        // sotto la mappa (una voce per segnalibro, con la sua etichetta assegnata).
        L.marker([m.lat, m.lon], { icon }).addTo(map).bindTooltip(m.label, {
          permanent: false,
          direction: "top",
        });
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="relative isolate z-0 h-[40rem] w-full" />;
}
