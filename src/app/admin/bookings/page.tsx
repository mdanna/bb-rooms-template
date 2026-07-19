import Link from "next/link";
import { auth, signIn, GOOGLE_ENABLED } from "@/auth";
import BookingsManager from "@/components/admin/BookingsManager";
import AdminShell from "@/components/admin/AdminShell";
import { resolveAdminLocale } from "@/lib/policies";
import { adminTranslations } from "@/i18n/admin";

export default async function AdminBookingsPage() {
  const session = await auth();
  const t = adminTranslations[resolveAdminLocale()];

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <Link
          href="/"
          className="fixed left-6 top-6 text-xs uppercase tracking-widest text-foreground/60 transition hover:text-gold"
        >
          ← {t.login.backToSite}
        </Link>
        <h1 className="font-serif-display text-3xl italic text-foreground">
          {t.bookings.loginTitle}
        </h1>
        <p className="max-w-sm text-sm text-foreground/70">
          {t.bookings.loginSubtitle}
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/admin/bookings" });
          }}
        >
          <button
            type="submit"
            className="rounded-full border border-gold bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-[#faf6ec] transition hover:bg-transparent hover:text-gold"
          >
            {t.login.github}
          </button>
        </form>
        {GOOGLE_ENABLED && (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/admin/bookings" });
            }}
          >
            <button
              type="submit"
              className="rounded-full border border-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-foreground transition hover:bg-gold/10"
            >
              {t.login.google}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <AdminShell userName={session.user?.name ?? session.user?.email} width="max-w-5xl">
        <BookingsManager />
    </AdminShell>
  );
}
