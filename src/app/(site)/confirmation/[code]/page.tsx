import ConfirmationPage from "@/components/ConfirmationPage";

export default async function Confirmation({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ConfirmationPage code={code} />;
}
