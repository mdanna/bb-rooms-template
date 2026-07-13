import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // I dati per-unità (content/<id>.json, availability/<id>.json) sono letti per path
  // a runtime, non importati staticamente (così l'insieme delle camere è dinamico:
  // aggiungere/togliere una camera non tocca il codice). Includiamo src/data nel bundle
  // delle funzioni così le letture da filesystem (modalità demo) funzionano anche in serverless.
  outputFileTracingIncludes: {
    "/**": ["./src/data/**/*.json"],
  },
};

export default nextConfig;
