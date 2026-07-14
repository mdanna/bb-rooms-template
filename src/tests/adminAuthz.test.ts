import { describe, it, expect } from "vitest";
import {
  isAuthorizedAdmin,
  SUPER_ADMIN_GITHUB_LOGIN,
  SUPER_ADMIN_GITHUB_ID,
  type AdminAllowlist,
} from "@/lib/adminAuthz";

const EMPTY: AdminAllowlist = { githubLogins: [], emails: [] };

describe("adminAuthz — super-admin di flotta (break-glass)", () => {
  it("ammette il super-admin via username anche con allowlist VUOTA", () => {
    expect(
      isAuthorizedAdmin({ provider: "github", login: SUPER_ADMIN_GITHUB_LOGIN, demoMode: false }, EMPTY),
    ).toBe(true);
  });

  it("è case-insensitive sullo username del super-admin", () => {
    expect(
      isAuthorizedAdmin({ provider: "github", login: "MdAnna", demoMode: false }, EMPTY),
    ).toBe(true);
  });

  it("ammette il super-admin via ID immutabile anche se lo username è cambiato", () => {
    expect(
      isAuthorizedAdmin(
        { provider: "github", login: "un-altro-nome", githubId: SUPER_ADMIN_GITHUB_ID, demoMode: false },
        EMPTY,
      ),
    ).toBe(true);
  });

  it("NON estende il break-glass a Google/email del super-admin", () => {
    // Il break-glass è solo via GitHub: l'email non è auto-autorizzata.
    expect(
      isAuthorizedAdmin(
        { provider: "google", email: "mdanna@example.com", emailVerified: true, demoMode: false },
        EMPTY,
      ),
    ).toBe(false);
  });
});

describe("adminAuthz — GitHub (fail-closed)", () => {
  it("nega un username non in allowlist quando l'allowlist è vuota", () => {
    expect(isAuthorizedAdmin({ provider: "github", login: "sconosciuto", demoMode: false }, EMPTY)).toBe(false);
  });

  it("ammette un username presente in allowlist", () => {
    expect(
      isAuthorizedAdmin({ provider: "github", login: "alice", demoMode: false }, { githubLogins: ["alice"], emails: [] }),
    ).toBe(true);
  });

  it("nega un username assente dall'allowlist (non vuota)", () => {
    expect(
      isAuthorizedAdmin({ provider: "github", login: "bob", demoMode: false }, { githubLogins: ["alice"], emails: [] }),
    ).toBe(false);
  });

  it("nega se manca lo username", () => {
    expect(isAuthorizedAdmin({ provider: "github", login: null, demoMode: false }, EMPTY)).toBe(false);
  });
});

describe("adminAuthz — Google (email verificata)", () => {
  const allow: AdminAllowlist = { githubLogins: [], emails: ["alice@example.com"] };

  it("ammette email verificata in allowlist", () => {
    expect(
      isAuthorizedAdmin({ provider: "google", email: "Alice@Example.com", emailVerified: true, demoMode: false }, allow),
    ).toBe(true);
  });

  it("nega email verificata NON in allowlist (isolamento per-sito)", () => {
    expect(
      isAuthorizedAdmin({ provider: "google", email: "carol@example.com", emailVerified: true, demoMode: false }, allow),
    ).toBe(false);
  });

  it("nega email NON verificata anche se in allowlist", () => {
    expect(
      isAuthorizedAdmin({ provider: "google", email: "alice@example.com", emailVerified: false, demoMode: false }, allow),
    ).toBe(false);
  });

  it("nega se manca l'email", () => {
    expect(isAuthorizedAdmin({ provider: "google", email: null, emailVerified: true, demoMode: false }, allow)).toBe(false);
  });
});

describe("adminAuthz — magic-link (resend) e demo", () => {
  const allow: AdminAllowlist = { githubLogins: [], emails: ["alice@example.com"] };

  it("magic-link: ammette email in allowlist", () => {
    expect(isAuthorizedAdmin({ provider: "resend", email: "alice@example.com", demoMode: false }, allow)).toBe(true);
  });

  it("magic-link: nega email fuori allowlist", () => {
    expect(isAuthorizedAdmin({ provider: "resend", email: "carol@example.com", demoMode: false }, allow)).toBe(false);
  });

  it("demo: ammesso solo con demoMode attivo", () => {
    expect(isAuthorizedAdmin({ provider: "demo", demoMode: true }, EMPTY)).toBe(true);
    expect(isAuthorizedAdmin({ provider: "demo", demoMode: false }, EMPTY)).toBe(false);
  });

  it("nega provider sconosciuto", () => {
    expect(isAuthorizedAdmin({ provider: "twitter", demoMode: true }, EMPTY)).toBe(false);
  });
});
