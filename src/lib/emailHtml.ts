// HTML email layout matching the app's visual identity.
// All emails use inline styles for maximum email-client compatibility.

import { CONTENT } from "./siteContent";

const BG = "#f8f0ea";
const CARD = "#fdf6f1";
const GOLD = "#b8755f";
const FG = "#2e1c18";
const FG_MUTED = "#7a5c54";
const FG_FAINT = "#b09088";
const BORDER = "#e8d5cc";
const GREEN = "#4a7c59";
const AMBER = "#b07d2e";

function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital@0;1&family=Inter:wght@400;500&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Inter,Arial,sans-serif;color:${FG};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr><td style="padding-bottom:24px;text-align:center;">
          <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:22px;color:${GOLD};letter-spacing:0.02em;">
            ${CONTENT.siteTitle.it}
          </p>
          <p style="margin:4px 0 0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:${FG_FAINT};">
            ${CONTENT.locationDisplay}
          </p>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:${CARD};border:1px solid ${BORDER};border-radius:12px;padding:36px 32px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:${FG_FAINT};">
            <a href="mailto:${CONTENT.email}" style="color:${FG_FAINT};text-decoration:none;">${CONTENT.email}</a>
            &nbsp;·&nbsp;
            <a href="tel:${CONTENT.phone.replace(/\s/g, '')}" style="color:${FG_FAINT};text-decoration:none;">${CONTENT.phone}</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Primitives ──────────────────────────────────────────────────────────────

export function title(text: string): string {
  return `<h1 style="margin:0 0 20px;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:26px;font-weight:400;color:${FG};">${text}</h1>`;
}

export function para(text: string, muted = false): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${muted ? FG_MUTED : FG};">${text}</p>`;
}

export function smallPara(text: string): string {
  return `<p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${FG_MUTED};">${text}</p>`;
}

export function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:20px 0;"/>`;
}

export function label(text: string): string {
  return `<span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${FG_FAINT};">${text}</span>`;
}

export function bold(text: string): string {
  return `<strong style="font-weight:500;color:${FG};">${text}</strong>`;
}

// ── Data table (label / value rows) ──────────────────────────────────────

export function dataTable(rows: Array<[string, string, ("normal" | "green" | "amber" | "gold")?]>): string {
  const cells = rows.map(([l, v, color]) => {
    const valueColor = color === "green" ? GREEN : color === "amber" ? AMBER : color === "gold" ? GOLD : FG;
    return `<tr>
      <td style="padding:8px 0;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${FG_FAINT};width:50%;">${l}</td>
      <td style="padding:8px 0;font-size:15px;color:${valueColor};font-weight:500;text-align:right;">${v}</td>
    </tr>`;
  }).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};margin:16px 0;">${cells}</table>`;
}

// ── CTA button ──────────────────────────────────────────────────────────────

export function button(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr><td style="background:${GOLD};border-radius:100px;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#fff;text-decoration:none;font-family:Inter,Arial,sans-serif;font-weight:500;">${text}</a>
    </td></tr>
  </table>`;
}

export function linkButton(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:8px 0;">
    <tr><td style="border:1px solid ${BORDER};border-radius:100px;">
      <a href="${href}" style="display:inline-block;padding:10px 24px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:${FG_MUTED};text-decoration:none;font-family:Inter,Arial,sans-serif;">${text}</a>
    </td></tr>
  </table>`;
}

// ── Info box (policy, notes) ─────────────────────────────────────────────

export function infoBox(content: string): string {
  return `<div style="background:${BG};border:1px solid ${BORDER};border-radius:8px;padding:16px 20px;margin:16px 0;">${content}</div>`;
}

// ── Page builder ──────────────────────────────────────────────────────────

export function buildHtml(content: string): string {
  return wrap(content);
}

// Export color constants for use in email.ts
export { FG_MUTED, FG_FAINT, GREEN, AMBER, GOLD, BORDER };
