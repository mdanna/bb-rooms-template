import { describe, it, expect } from "vitest";
import { generateAccessToken, verifyAccessToken } from "@/lib/accessToken";

describe("generateAccessToken / verifyAccessToken", () => {
  it("genera un token valido per il codice dato", () => {
    const token = generateAccessToken("CM-ABCD12");
    expect(verifyAccessToken("CM-ABCD12", token)).toBe(true);
  });

  it("rigetta un token per un codice diverso", () => {
    const token = generateAccessToken("CM-ABCD12");
    expect(verifyAccessToken("CM-XXYYZZ", token)).toBe(false);
  });

  it("rigetta null", () => {
    expect(verifyAccessToken("CM-ABCD12", null)).toBe(false);
  });

  it("rigetta stringa vuota", () => {
    expect(verifyAccessToken("CM-ABCD12", "")).toBe(false);
  });

  it("rigetta token malformato (senza punto separatore)", () => {
    expect(verifyAccessToken("CM-ABCD12", "invalidtoken")).toBe(false);
  });

  it("rigetta token scaduto", async () => {
    const { createHmac } = await import("crypto");
    const pastExp = Date.now() - 1000;
    const sig = createHmac("sha256", process.env.AUTH_SECRET!)
      .update(`CM-ABCD12:${pastExp}`)
      .digest("base64url");
    const expiredToken = `${pastExp}.${sig}`;
    expect(verifyAccessToken("CM-ABCD12", expiredToken)).toBe(false);
  });

  it("rigetta un token con firma falsificata", () => {
    const token = generateAccessToken("CM-ABCD12");
    const [exp] = token.split(".");
    const tampered = `${exp}.fakesignatureXXXXXXXXXXXXXXXXXXXXXXXXXXXX`;
    expect(verifyAccessToken("CM-ABCD12", tampered)).toBe(false);
  });

  it("genera token diversi per codici diversi", () => {
    const t1 = generateAccessToken("CM-AAAA11");
    const t2 = generateAccessToken("CM-BBBB22");
    expect(t1).not.toBe(t2);
  });
});
