import { describe, it, expect } from "vitest";
import { getEmailTemplates } from "@/lib/emailTemplates";
import type { LocaleCode } from "@/i18n/index";

const ALL_LOCALES: LocaleCode[] = ["it", "en", "fr", "de", "es", "pt", "zh", "ja", "ko"];

const APPROVAL_PARAMS = {
  code: "CM-TEST1",
  payUrl: "https://example.com/pay/CM-TEST1?t=tok",
  manageUrl: "https://example.com/gestione-prenotazione/CM-TEST1?t=tok",
  totalPrice: 300,
  depositAmount: 150,
  balanceDue: 150, // totalPrice - depositAmount (city tax excluded)
  cityTax: 24,
  guests: 2,
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
  depositAmount: 200,
  balanceDue: 200, // totalPrice - depositAmount (city tax excluded)
  cityTax: 48,
  guests: 2,
  paymentMethod: "Carta di credito",
  confirmationUrl: "https://example.com/confirmation/CM-TEST3?t=tok",
  manageUrl: "https://example.com/gestione-prenotazione/CM-TEST3?t=tok",
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

      it("approval: body contiene il totale soggiorno", () => {
        const { text } = tpl.approval(APPROVAL_PARAMS);
        expect(text).toContain("300");
      });

      it("approval: body contiene la tassa di soggiorno come voce separata", () => {
        const { text } = tpl.approval(APPROVAL_PARAMS);
        expect(text).toContain("24");
      });

      it("approval: body non contiene righe null o undefined", () => {
        const { text } = tpl.approval(APPROVAL_PARAMS);
        expect(text).not.toContain("null");
        expect(text).not.toContain("undefined");
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
    });
  }
});

describe("emailTemplates — parametri null/facoltativi", () => {
  it("approval: funziona senza prezzi (tutti null)", () => {
    const tpl = getEmailTemplates("it");
    const { text } = tpl.approval({
      ...APPROVAL_PARAMS,
      totalPrice: null,
      depositAmount: null,
      balanceDue: null,
      cityTax: null,
    });
    expect(text).toContain("CM-TEST1");
    expect(text).not.toContain("null");
  });
});
