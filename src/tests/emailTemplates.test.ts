import { describe, it, expect } from "vitest";
import { getEmailTemplates, getExtraEmailStrings } from "@/lib/emailTemplates";
import type { LocaleCode } from "@/i18n/index";

const ALL_LOCALES: LocaleCode[] = ["it", "en", "fr", "de", "es", "pt", "zh", "ja", "ko"];

const APPROVAL_PARAMS = {
  code: "CM-TEST1",
  payUrl: "https://example.com/pay/CM-TEST1?t=tok",
  manageUrl: "https://example.com/gestione-prenotazione/CM-TEST1?t=tok",
  totalPrice: 300,
  cityTax: 24,
  guests: 2,
  refundPolicy: "moderate" as string | null,
};

const REJECTION_PARAMS = {
  code: "CM-TEST2",
  reason: "Date non disponibili",
};

const PAYMENT_PARAMS = {
  code: "CM-TEST3",
  firstName: "Mario",
  lastName: "Rossi",
  checkin: "2025-08-10",
  checkout: "2025-08-14",
  totalPrice: 400,
  cityTax: 48,
  cityTaxOnline: true,
  guests: 2,
  paymentMethod: "Carta di credito",
  refundPolicy: "strict" as string | null,
  confirmationUrl: "https://example.com/confirmation/CM-TEST3?t=tok",
  manageUrl: "https://example.com/gestione-prenotazione/CM-TEST3?t=tok",
};

const CHECKIN_RECAP_PARAMS = {
  code: "CM-TEST4",
  firstName: "Anna",
  checkin: "2025-09-01",
  checkout: "2025-09-05",
  totalPrice: 500,
  cityTax: 40,
  guests: 3,
  manageUrl: "https://example.com/gestione-prenotazione/CM-TEST4?t=tok",
};

describe("emailTemplates — tutte le 9 lingue", () => {
  for (const locale of ALL_LOCALES) {
    describe(`locale: ${locale}`, () => {
      const tpl = getEmailTemplates(locale);

      it("approval: subject contiene il codice prenotazione", () => {
        const { subject } = tpl.approval(APPROVAL_PARAMS);
        expect(subject).toContain("CM-TEST1");
      });

      it("approval: body contiene il payUrl", () => {
        const { text } = tpl.approval(APPROVAL_PARAMS);
        expect(text).toContain(APPROVAL_PARAMS.payUrl);
      });

      it("approval: body contiene il manageUrl", () => {
        const { text } = tpl.approval(APPROVAL_PARAMS);
        expect(text).toContain(APPROVAL_PARAMS.manageUrl);
      });

      it("approval: body contiene il totale soggiorno (pagamento intero)", () => {
        const { text } = tpl.approval(APPROVAL_PARAMS);
        expect(text).toContain("300");
      });

      it("approval: body contiene la tassa di soggiorno come voce separata", () => {
        const { text } = tpl.approval(APPROVAL_PARAMS);
        expect(text).toContain("24");
      });

      it("approval: body menziona la politica di rimborso (franchigia 3,5%)", () => {
        const { text } = tpl.approval(APPROVAL_PARAMS);
        expect(text).toContain("3.5");
      });

      it("approval: body non contiene righe null o undefined", () => {
        const { text } = tpl.approval(APPROVAL_PARAMS);
        expect(text).not.toMatch(/\bnull\b/);
        expect(text).not.toMatch(/\bundefined\b/);
      });

      it("rejection: subject contiene il codice prenotazione", () => {
        const { subject } = tpl.rejection(REJECTION_PARAMS);
        expect(subject).toContain("CM-TEST2");
      });

      it("rejection: body contiene il motivo", () => {
        const { text } = tpl.rejection(REJECTION_PARAMS);
        expect(text).toContain("Date non disponibili");
      });

      it("paymentConfirmation: subject contiene il codice", () => {
        const { subject } = tpl.paymentConfirmation(PAYMENT_PARAMS);
        expect(subject).toContain("CM-TEST3");
      });

      it("paymentConfirmation: body contiene il nome ospite", () => {
        const { text } = tpl.paymentConfirmation(PAYMENT_PARAMS);
        expect(text).toContain("Mario");
      });

      it("paymentConfirmation: body contiene il confirmationUrl", () => {
        const { text } = tpl.paymentConfirmation(PAYMENT_PARAMS);
        expect(text).toContain(PAYMENT_PARAMS.confirmationUrl);
      });

      it("paymentConfirmation: body contiene l'importo pagato (soggiorno + tassa online)", () => {
        const { text } = tpl.paymentConfirmation(PAYMENT_PARAMS);
        // totalPrice 400 + cityTax 48 (online) = 448
        expect(text).toContain("448");
      });

      it("paymentConfirmation: body non contiene righe null o undefined", () => {
        const { text } = tpl.paymentConfirmation(PAYMENT_PARAMS);
        expect(text).not.toMatch(/\bnull\b/);
        expect(text).not.toMatch(/\bundefined\b/);
      });

      it("checkinRecap: subject contiene il codice", () => {
        const { subject } = tpl.checkinRecap(CHECKIN_RECAP_PARAMS);
        expect(subject).toContain("CM-TEST4");
      });

      it("checkinRecap: body contiene il nome, le date e il manageUrl", () => {
        const { text } = tpl.checkinRecap(CHECKIN_RECAP_PARAMS);
        expect(text).toContain("Anna");
        expect(text).toContain(CHECKIN_RECAP_PARAMS.manageUrl);
      });

      it("checkinRecap: body contiene il totale da saldare al check-in (soggiorno + tassa)", () => {
        const { text } = tpl.checkinRecap(CHECKIN_RECAP_PARAMS);
        // 500 + 40 = 540
        expect(text).toContain("540");
      });

      it("checkinRecap: body non contiene righe null o undefined", () => {
        const { text } = tpl.checkinRecap(CHECKIN_RECAP_PARAMS);
        expect(text).not.toMatch(/\bnull\b/);
        expect(text).not.toMatch(/\bundefined\b/);
      });
    });
  }
});

describe("emailTemplates — parametri null/facoltativi", () => {
  it("approval: funziona senza prezzi (tutti null)", () => {
    const tpl = getEmailTemplates("it");
    const { text } = tpl.approval({
      ...APPROVAL_PARAMS,
      totalPrice: null,
      cityTax: null,
    });
    expect(text).toContain("CM-TEST1");
    expect(text).not.toMatch(/\bnull\b/);
  });

  it("approval: refundPolicy null usa la policy corrente senza rompere", () => {
    const tpl = getEmailTemplates("it");
    const { text } = tpl.approval({ ...APPROVAL_PARAMS, refundPolicy: null });
    expect(text).toContain("CM-TEST1");
    expect(text).not.toMatch(/\bnull\b/);
    expect(text).not.toMatch(/\bundefined\b/);
  });

  it("checkinRecap: funziona senza prezzi (tutti null)", () => {
    const tpl = getEmailTemplates("it");
    const { text } = tpl.checkinRecap({ ...CHECKIN_RECAP_PARAMS, totalPrice: null, cityTax: null });
    expect(text).toContain("CM-TEST4");
    expect(text).not.toMatch(/\bnull\b/);
    expect(text).not.toMatch(/\bundefined\b/);
  });
});

describe("extra email strings — cancellazione (full / partial / none)", () => {
  for (const locale of ALL_LOCALES) {
    const s = getExtraEmailStrings(locale);

    it(`${locale}: cancelRefundFull descrive rimborso pieno con franchigia`, () => {
      const line = s.cancelRefundFull("120.00", 3.5);
      expect(line).toContain("120.00");
      expect(line).toContain("3.5");
    });

    it(`${locale}: cancelRefundPartial descrive rimborso 50%`, () => {
      const line = s.cancelRefundPartial("75.00");
      expect(line).toContain("75.00");
    });

    it(`${locale}: cancelNoRefund è una stringa non vuota`, () => {
      expect(typeof s.cancelNoRefund).toBe("string");
      expect(s.cancelNoRefund.length).toBeGreaterThan(0);
    });

    it(`${locale}: cancelCityTaxRefund menziona l'importo della tassa`, () => {
      const line = s.cancelCityTaxRefund("40.00");
      expect(line).toContain("40.00");
    });
  }
});
