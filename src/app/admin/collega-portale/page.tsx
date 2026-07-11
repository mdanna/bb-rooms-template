import { auth } from "@/auth";
import AdminLogin from "@/components/admin/AdminLogin";
import PortalLinkConfirm from "@/components/admin/PortalLinkConfirm";
import { DEMO_MODE } from "@/lib/demo";

// Pagina di conferma dell'associazione al portale (lato sito). Ci si arriva dal
// portale (redirect con ?portal=&name=&t=&action=); richiede il login admin di
// QUESTO sito, così solo chi lo controlla può collegarlo/scollegarlo.
export default async function CollegaPortalePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  // Ricostruisci l'URL di QUESTA pagina (col token) come callbackUrl del login: così
  // dopo l'accesso Auth.js riporta qui, alla conferma di collegamento, e non al
  // pannello /admin (da cui l'host doveva tornare indietro a mano).
  const params = new URLSearchParams();
  for (const k of ["portal", "name", "action", "t"]) {
    const v = one(sp[k]);
    if (v) params.set(k, v);
  }
  const callbackUrl = `/admin/collega-portale?${params.toString()}`;

  const session = await auth();
  if (!session) return <AdminLogin demo={DEMO_MODE} callbackUrl={callbackUrl} />;

  return (
    <PortalLinkConfirm
      portal={one(sp.portal)}
      name={one(sp.name)}
      token={one(sp.t)}
      action={one(sp.action) === "unlink" ? "unlink" : "link"}
    />
  );
}
