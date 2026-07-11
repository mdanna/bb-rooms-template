"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAdminLanguage } from "@/i18n/AdminLanguageContext";
import DeployToast from "@/components/admin/DeployToast";

type Phase = "loading" | "enroll" | "unlocked";
type Mode = "test" | "live";
interface Health {
  mode: Mode;
  liveKeyConfigured: boolean;
  liveKeyValid: boolean;
  webhookLiveConfigured: boolean;
}

const LABELS = {
  it: {
    title: "Configurazione Stripe",
    intro: "Passa tra ambiente di test e produzione. Sezione protetta da Authenticator (TOTP).",
    enrollTitle: "Configura l'Authenticator",
    enrollIntro: "Questa pagina è protetta da un codice a 6 cifre. Registra un'app authenticator una volta sola, seguendo questi passi:",
    enrollStep1: "Se non ce l'hai già, installa sul telefono un'app authenticator: Microsoft Authenticator o Google Authenticator (gratuite, su App Store o Google Play).",
    enrollStep2: "Premi «Genera QR» qui sotto.",
    enrollStep3: "Nell'app scegli «Aggiungi account» → «Altro account» (o «Account personale») e inquadra il QR con la fotocamera. In alternativa inserisci a mano la chiave mostrata.",
    enrollStep4: "Digita nel campo il codice a 6 cifre che appare nell'app e conferma.",
    generate: "Genera QR",
    scan: "Scansiona con l'app authenticator (Aggiungi account → Altro account). In alternativa inserisci la chiave manualmente:",
    confirmCode: "Inserisci il codice a 6 cifre per confermare",
    confirm: "Conferma e attiva",
    lockedTitle: "Sezione bloccata",
    lockedIntro: "Inserisci il codice a 6 cifre dell'authenticator per sbloccare.",
    unlock: "Sblocca",
    currentMode: "Modalità attiva",
    test: "Test",
    live: "Produzione (pagamenti reali)",
    health: "Stato produzione",
    liveKeyConf: "Chiave di produzione presente",
    liveKeyValid: "Chiave di produzione valida",
    webhookLive: "Webhook di produzione configurato",
    yes: "Sì",
    no: "No",
    switchLive: "Attiva pagamenti reali (produzione)",
    switchTest: "Torna in modalità test",
    updating: "aggiornamento…",
    updatingMode: "Modalità in aggiornamento: attendi la fine della pubblicazione. La pagina si aggiornerà da sola (~1–2 min).",
    freshCode: "Codice authenticator (6 cifre)",
    liveExplain: "Stai per attivare i pagamenti reali: da questo momento gli ospiti verranno addebitati davvero sul tuo account Stripe di produzione.",
    ackCheckbox: "Ho capito e voglio attivare i pagamenti reali",
    apply: "Applica",
    reset: "Ho perso il telefono / resetta authenticator",
    resetPrompt: "Passphrase di recupero (se configurata)",
    resetConfirm: "Resetta authenticator",
    liveNotReady: "Configura prima STRIPE_SECRET_KEY_LIVE nelle env di Vercel.",
    genericError: "Si è verificato un errore.",
  },
  en: {
    title: "Stripe configuration",
    intro: "Switch between test and production. Section protected by an Authenticator (TOTP).",
    enrollTitle: "Set up the Authenticator",
    enrollIntro: "This page is protected by a 6-digit code. Enrol an authenticator app once, following these steps:",
    enrollStep1: "If you don't have one yet, install an authenticator app on your phone: Microsoft Authenticator or Google Authenticator (free, on the App Store or Google Play).",
    enrollStep2: "Press “Generate QR” below.",
    enrollStep3: "In the app choose “Add account” → “Other account” (or “Personal account”) and scan the QR with the camera. Or enter the shown key manually.",
    enrollStep4: "Type the 6-digit code shown by the app into the field and confirm.",
    generate: "Generate QR",
    scan: "Scan with your authenticator app (Add account → Other account). Or enter the key manually:",
    confirmCode: "Enter the 6-digit code to confirm",
    confirm: "Confirm and activate",
    lockedTitle: "Section locked",
    lockedIntro: "Enter the 6-digit authenticator code to unlock.",
    unlock: "Unlock",
    currentMode: "Active mode",
    test: "Test",
    live: "Production (real payments)",
    health: "Production status",
    liveKeyConf: "Production key present",
    liveKeyValid: "Production key valid",
    webhookLive: "Production webhook configured",
    yes: "Yes",
    no: "No",
    switchLive: "Enable real payments (production)",
    switchTest: "Back to test mode",
    updating: "updating…",
    updatingMode: "Mode updating: wait for the deployment to finish. The page will refresh on its own (~1–2 min).",
    freshCode: "Authenticator code (6 digits)",
    liveExplain: "You're about to enable real payments: from now on guests will be charged for real on your live Stripe account.",
    ackCheckbox: "I understand and want to enable real payments",
    apply: "Apply",
    reset: "Lost my phone / reset authenticator",
    resetPrompt: "Recovery passphrase (if configured)",
    resetConfirm: "Reset authenticator",
    liveNotReady: "First configure STRIPE_SECRET_KEY_LIVE in the Vercel env.",
    genericError: "Something went wrong.",
  },
  es: {
    title: "Configuración de Stripe",
    intro: "Cambia entre entorno de prueba y producción. Sección protegida con Authenticator (TOTP).",
    enrollTitle: "Configura el Authenticator",
    enrollIntro: "Esta página está protegida con un código de 6 dígitos. Registra una app authenticator una sola vez, siguiendo estos pasos:",
    enrollStep1: "Si aún no la tienes, instala en el teléfono una app authenticator: Microsoft Authenticator o Google Authenticator (gratis, en App Store o Google Play).",
    enrollStep2: "Pulsa «Generar QR» abajo.",
    enrollStep3: "En la app elige «Agregar cuenta» → «Otra cuenta» (o «Cuenta personal») y escanea el QR con la cámara. O introduce la clave mostrada manualmente.",
    enrollStep4: "Escribe en el campo el código de 6 dígitos que muestra la app y confirma.",
    generate: "Generar QR",
    scan: "Escanea con la app authenticator (Agregar cuenta → Otra cuenta). O introduce la clave manualmente:",
    confirmCode: "Introduce el código de 6 dígitos para confirmar",
    confirm: "Confirmar y activar",
    lockedTitle: "Sección bloqueada",
    lockedIntro: "Introduce el código de 6 dígitos del authenticator para desbloquear.",
    unlock: "Desbloquear",
    currentMode: "Modo activo",
    test: "Prueba",
    live: "Producción (pagos reales)",
    health: "Estado de producción",
    liveKeyConf: "Clave de producción presente",
    liveKeyValid: "Clave de producción válida",
    webhookLive: "Webhook de producción configurado",
    yes: "Sí",
    no: "No",
    switchLive: "Activar pagos reales (producción)",
    switchTest: "Volver al modo de prueba",
    updating: "actualizando…",
    updatingMode: "Modo actualizándose: espera a que termine la publicación. La página se actualizará sola (~1–2 min).",
    freshCode: "Código authenticator (6 dígitos)",
    liveExplain: "Estás a punto de activar los pagos reales: a partir de ahora se cobrará de verdad a los huéspedes en tu cuenta de Stripe de producción.",
    ackCheckbox: "Entiendo y quiero activar los pagos reales",
    apply: "Aplicar",
    reset: "Perdí el teléfono / restablecer authenticator",
    resetPrompt: "Frase de recuperación (si está configurada)",
    resetConfirm: "Restablecer authenticator",
    liveNotReady: "Configura primero STRIPE_SECRET_KEY_LIVE en las env de Vercel.",
    genericError: "Ha ocurrido un error.",
  },
  fr: {
    title: "Configuration Stripe",
    intro: "Basculez entre l'environnement de test et de production. Section protégée par un Authenticator (TOTP).",
    enrollTitle: "Configurer l'Authenticator",
    enrollIntro: "Cette page est protégée par un code à 6 chiffres. Enregistrez une app authenticator une seule fois, en suivant ces étapes :",
    enrollStep1: "Si vous n'en avez pas encore, installez une app authenticator sur votre téléphone : Microsoft Authenticator ou Google Authenticator (gratuites, sur l'App Store ou Google Play).",
    enrollStep2: "Appuyez sur « Générer le QR » ci-dessous.",
    enrollStep3: "Dans l'app, choisissez « Ajouter un compte » → « Autre compte » (ou « Compte personnel ») et scannez le QR avec la caméra. Ou saisissez la clé affichée manuellement.",
    enrollStep4: "Saisissez dans le champ le code à 6 chiffres affiché par l'app et confirmez.",
    generate: "Générer le QR",
    scan: "Scannez avec votre app authenticator (Ajouter un compte → Autre compte). Ou saisissez la clé manuellement :",
    confirmCode: "Saisissez le code à 6 chiffres pour confirmer",
    confirm: "Confirmer et activer",
    lockedTitle: "Section verrouillée",
    lockedIntro: "Saisissez le code à 6 chiffres de l'authenticator pour déverrouiller.",
    unlock: "Déverrouiller",
    currentMode: "Mode actif",
    test: "Test",
    live: "Production (paiements réels)",
    health: "État production",
    liveKeyConf: "Clé de production présente",
    liveKeyValid: "Clé de production valide",
    webhookLive: "Webhook de production configuré",
    yes: "Oui",
    no: "Non",
    switchLive: "Activer les paiements réels (production)",
    switchTest: "Revenir en mode test",
    updating: "mise à jour…",
    updatingMode: "Mode en cours de mise à jour : attendez la fin de la publication. La page se rafraîchira toute seule (~1–2 min).",
    freshCode: "Code authenticator (6 chiffres)",
    liveExplain: "Vous êtes sur le point d'activer les paiements réels : désormais les clients seront débités pour de vrai sur votre compte Stripe de production.",
    ackCheckbox: "Je comprends et je veux activer les paiements réels",
    apply: "Appliquer",
    reset: "Téléphone perdu / réinitialiser l'authenticator",
    resetPrompt: "Phrase de récupération (si configurée)",
    resetConfirm: "Réinitialiser l'authenticator",
    liveNotReady: "Configurez d'abord STRIPE_SECRET_KEY_LIVE dans les env Vercel.",
    genericError: "Une erreur s'est produite.",
  },
} as const;

export default function StripeSettings() {
  const { locale } = useAdminLanguage();
  const L = LABELS[locale] ?? LABELS.en;

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // enrollment
  const [enrollData, setEnrollData] = useState<{ qr: string; base32: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  // health + toggle
  const [health, setHealth] = useState<Health | null>(null);
  const [actionCode, setActionCode] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [deploySha, setDeploySha] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  // reset
  const [showReset, setShowReset] = useState(false);
  const [recovery, setRecovery] = useState("");

  useEffect(() => {
    fetch("/api/admin/stripe/totp")
      .then((r) => r.json())
      .then((d: { status?: string }) => {
        // Registrato → vai direttamente alla vista (nessun codice per guardare).
        // Il TOTP verrà chiesto una sola volta, allo switch.
        if (d.status === "confirmed") loadHealth();
        else setPhase("enroll");
      })
      .catch(() => setPhase("enroll"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHealth() {
    const res = await fetch("/api/admin/stripe");
    if (!res.ok) return false;
    setHealth((await res.json()) as Health);
    setPhase("unlocked");
    return true;
  }

  async function generate() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/stripe/totp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enroll" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setEnrollData({ qr: d.qr, base32: d.base32 });
    } catch (e) { setError(e instanceof Error ? e.message : L.genericError); }
    finally { setBusy(false); }
  }

  async function doConfirm() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/stripe/totp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code: confirmCode.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      await loadHealth();
    } catch (e) { setError(e instanceof Error ? e.message : L.genericError); }
    finally { setBusy(false); }
  }

  async function applyMode(target: Mode) {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/stripe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: target, code: actionCode.trim(), acknowledge }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setActionCode(""); setAcknowledge(false);
      // La modalità cambia solo a redeploy completato: mostriamo "in aggiornamento"
      // e lasciamo che il DeployToast, a fine pubblicazione, rilegga lo stato reale.
      if (d.commitSha) { setDeploySha(d.commitSha); setSwitching(true); }
    } catch (e) { setError(e instanceof Error ? e.message : L.genericError); }
    finally { setBusy(false); }
  }

  async function doReset() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/stripe/totp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", recovery }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShowReset(false); setRecovery(""); setEnrollData(null);
      setPhase("enroll");
    } catch (e) { setError(e instanceof Error ? e.message : L.genericError); }
    finally { setBusy(false); }
  }

  const inputCls = "w-full rounded border border-gold/40 bg-background px-3 py-2 text-sm";
  const btnCls = "rounded-full bg-gold px-5 py-2 text-xs uppercase tracking-widest text-[#faf6ec] transition hover:opacity-90 disabled:opacity-50";
  const codeCls = `${inputCls} font-mono tracking-[0.3em]`;

  return (
    <div className="rounded-lg border border-gold/40 bg-card p-6 space-y-5">
      <div>
        <h1 className="font-serif-display text-xl italic text-foreground">{L.title}</h1>
        <p className="mt-1 text-sm text-foreground/60">{L.intro}</p>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {phase === "loading" && <p className="text-sm text-foreground/50">…</p>}

      {/* ENROLLMENT */}
      {phase === "enroll" && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/50">{L.enrollTitle}</h2>
          <p className="text-sm text-foreground/70">{L.enrollIntro}</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground/70 marker:font-bold marker:text-gold">
            <li>{L.enrollStep1}</li>
            <li>{L.enrollStep2}</li>
            <li>{L.enrollStep3}</li>
            <li>{L.enrollStep4}</li>
          </ol>
          {!enrollData ? (
            <button onClick={generate} disabled={busy} className={btnCls}>{L.generate}</button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-foreground/70">{L.scan}</p>
              <div className="flex flex-col items-center gap-3">
                <Image src={enrollData.qr} alt="QR" width={200} height={200} unoptimized className="rounded border border-gold/30" />
                <code className="select-all break-all rounded bg-foreground/5 px-3 py-1 text-xs">{enrollData.base32}</code>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-foreground/60">{L.confirmCode}</span>
                <input inputMode="numeric" maxLength={6} value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))} className={codeCls} />
              </label>
              <button onClick={doConfirm} disabled={busy || confirmCode.length !== 6} className={btnCls}>{L.confirm}</button>
            </div>
          )}
        </div>
      )}

      {/* UNLOCKED: health + toggle */}
      {phase === "unlocked" && health && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground/60">{L.currentMode}:</span>
            {switching ? (
              <span className="animate-pulse rounded-full bg-foreground/10 px-3 py-1 text-xs font-bold text-foreground/70">⏳ {L.updating}</span>
            ) : (
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${health.mode === "live" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                {health.mode === "live" ? `🔴 ${L.live}` : `🧪 ${L.test}`}
              </span>
            )}
          </div>

          <div className="space-y-1 rounded border border-gold/20 p-3 text-sm">
            <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-foreground/50">{L.health}</h3>
            <HealthRow ok={health.liveKeyConfigured} label={L.liveKeyConf} yes={L.yes} no={L.no} />
            <HealthRow ok={health.liveKeyValid} label={L.liveKeyValid} yes={L.yes} no={L.no} />
            <HealthRow ok={health.webhookLiveConfigured} label={L.webhookLive} yes={L.yes} no={L.no} />
          </div>

          <div className="space-y-3 rounded border border-gold/20 p-3">
            {switching ? (
              <p className="text-xs text-foreground/70">{L.updatingMode}</p>
            ) : (
            <>
            <input inputMode="numeric" maxLength={6} value={actionCode}
              onChange={(e) => setActionCode(e.target.value.replace(/\D/g, ""))}
              className={codeCls} placeholder={L.freshCode} />

            {health.mode === "test" ? (
              <div className="space-y-3">
                {!health.liveKeyValid && <p className="text-xs text-amber-700">{L.liveNotReady}</p>}
                <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-800">{L.liveExplain}</p>
                <label className="flex items-start gap-2 text-xs text-foreground/80">
                  <input type="checkbox" checked={acknowledge} onChange={(e) => setAcknowledge(e.target.checked)} className="mt-0.5 accent-red-600" />
                  <span>{L.ackCheckbox}</span>
                </label>
                <button onClick={() => applyMode("live")} disabled={busy || actionCode.length !== 6 || !health.liveKeyValid || !acknowledge}
                  className="rounded-full bg-red-600 px-5 py-2 text-xs uppercase tracking-widest text-white transition hover:bg-red-700 disabled:opacity-50">
                  {L.switchLive}
                </button>
              </div>
            ) : (
              <button onClick={() => applyMode("test")} disabled={busy || actionCode.length !== 6} className={btnCls}>
                {L.switchTest}
              </button>
            )}
            </>
            )}
          </div>

          {/* Reset authenticator (telefono perso) */}
          <div>
            <button onClick={() => setShowReset((v) => !v)} className="block text-xs text-foreground/40 underline">{L.reset}</button>
            {showReset && (
              <div className="mt-2 space-y-2 rounded border border-red-200 bg-red-50 p-3">
                <input value={recovery} onChange={(e) => setRecovery(e.target.value)} className={inputCls} placeholder={L.resetPrompt} />
                <button onClick={doReset} disabled={busy} className="rounded-full border border-red-400 px-4 py-1.5 text-xs text-red-700">{L.resetConfirm}</button>
              </div>
            )}
          </div>
        </div>
      )}

      <DeployToast sha={deploySha} onDone={() => { setDeploySha(null); setSwitching(false); loadHealth(); }} />
    </div>
  );
}

function HealthRow({ ok, label, yes, no }: { ok: boolean; label: string; yes: string; no: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-foreground/70">{label}</span>
      <span className={ok ? "text-green-700" : "text-foreground/40"}>{ok ? `✓ ${yes}` : `— ${no}`}</span>
    </div>
  );
}
