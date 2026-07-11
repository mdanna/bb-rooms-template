import PayBalancePage from "@/components/PayBalancePage";

export default async function PayBalance({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { code } = await params;
  const { t } = await searchParams;
  return <PayBalancePage code={code} token={t ?? ""} />;
}
