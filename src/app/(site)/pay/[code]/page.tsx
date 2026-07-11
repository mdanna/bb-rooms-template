import PaymentPage from "@/components/PaymentPage";

export default async function Pay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PaymentPage code={code} />;
}
