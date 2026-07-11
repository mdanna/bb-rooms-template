import Link from "next/link";
import { translations, type LocaleCode, localeOrder } from "@/i18n/index";

export default async function PayBalanceSuccess({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { code } = await params;
  const { locale: rawLocale } = await searchParams;
  const locale: LocaleCode =
    rawLocale && (localeOrder as string[]).includes(rawLocale)
      ? (rawLocale as LocaleCode)
      : "it";
  const t = translations[locale];
  const pb = t.payBalance;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <h1 className="font-serif-display text-3xl italic text-foreground">{pb.successTitle}</h1>
      <p className="max-w-sm text-sm text-foreground/70">
        {pb.successMsg.replace("{code}", code)}
      </p>
      <Link
        href="/"
        className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
      >
        {pb.backHome}
      </Link>
    </div>
  );
}
