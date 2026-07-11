import BookingManagementPage from "@/components/BookingManagementPage";

export default async function GestionePrenotazioneDetail({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { code } = await params;
  const { t } = await searchParams;
  return <BookingManagementPage code={code} token={t ?? ""} />;
}
