import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/**
 * The signed viewing agreement as a real PDF — the copy sent to the client.
 *
 * Generated on the server because the browser's print dialog is not available
 * everywhere the back office runs: an iPhone Home Screen app ignores
 * `window.print()` entirely, so "Print / PDF" did nothing on a phone.
 *
 * Fonts are the PDF standard Helvetica (no font files to ship). It covers Latin
 * script only; anything else (an Arabic or Georgian name, say) is replaced so
 * the PDF still generates. The signature image is unaffected.
 */

export interface AgreementForPdf {
  ref: string;
  status: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientIdNumber: string | null;
  properties: Array<{ ref: string | null; title: string; city: string | null }>;
  propertyNote: string | null;
  viewingAt: Date;
  termsVersion: string;
  termsText: string;
  feeLabel: string;
  noPriorIntroduction: boolean;
  priorIntroductionNote: string | null;
  signatureData: string;
  signedAt: Date;
  signedIp: string | null;
  documentHash: string;
  agentName: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  /** The agency's office as printed on it: Settings → Chat assistant → Office. */
  office?: { name: string; address: string; phone: string } | null;
  /** Settings → Branding logo, already a PNG. Null → the name in text. */
  logoPng?: Buffer | null;
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 50;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const RULE = rgb(0.85, 0.87, 0.9);

/** Map to what Helvetica (WinAnsi) can draw; pdf-lib throws on anything else. */
function safe(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/\r/g, '')
    // Keep printable ASCII and Latin-1; anything else becomes "?".
    .replace(/[^\n\x20-\x7E¡-ÿ]/g, '?');
}

/** An IANA zone the runtime knows, else UTC — never a hardcoded market. */
export function safeTimeZone(tz: unknown): string {
  if (typeof tz !== 'string' || !tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function fmtDate(d: Date, zone: string, withTime = true): string {
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } : {}),
    timeZone: zone,
  });
}

class Writer {
  page: PDFPage;
  y: number;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.page = doc.addPage([A4.w, A4.h]);
    this.y = A4.h - MARGIN;
  }

  get width() { return A4.w - MARGIN * 2; }

  ensure(space: number) {
    if (this.y - space < MARGIN + 20) {
      this.page = this.doc.addPage([A4.w, A4.h]);
      this.y = A4.h - MARGIN;
    }
  }

  wrap(text: string, size: number, font: PDFFont, width: number): string[] {
    const lines: string[] = [];
    for (const para of safe(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
        if (line) lines.push(line);
        line = word;
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number; x?: number; width?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const x = opts.x ?? MARGIN;
    const lineH = size * 1.4;
    for (const line of this.wrap(text, size, font, opts.width ?? this.width - (x - MARGIN))) {
      this.ensure(lineH);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lineH;
    }
    this.y -= opts.gap ?? 0;
  }

  rule(gap = 10) {
    this.ensure(gap * 2);
    this.y -= gap;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4.w - MARGIN, y: this.y }, thickness: 0.6, color: RULE });
    this.y -= gap;
  }

  /** Label / value pairs, two per row. */
  fields(pairs: Array<[string, string]>) {
    const colW = this.width / 2;
    for (let i = 0; i < pairs.length; i += 2) {
      const row = pairs.slice(i, i + 2);
      const heights = row.map(([, v]) => this.wrap(v, 10, this.bold, colW - 10).length);
      const h = 12 + Math.max(...heights) * 14 + 6;
      this.ensure(h);
      const top = this.y;
      row.forEach(([label, value], c) => {
        this.y = top;
        this.text(label.toUpperCase(), { size: 7, color: MUTED, x: MARGIN + c * colW, width: colW - 10 });
        this.text(value, { size: 10, bold: true, x: MARGIN + c * colW, width: colW - 10 });
      });
      this.y = top - h;
    }
  }
}

/** `timeZone`: the downloading device's, so dates read as the client lived them. */
export async function renderViewingAgreementPdf(a: AgreementForPdf, timeZone = 'UTC'): Promise<Uint8Array> {
  const zone = safeTimeZone(timeZone);
  const fmt = (d: Date, withTime = true) => fmtDate(d, zone, withTime);
  const doc = await PDFDocument.create();
  doc.setTitle(`PropGroup viewing agreement ${a.ref}`);
  doc.setAuthor(safe(a.office?.name || 'PropGroup'));
  doc.setSubject(`Viewing agreement signed by ${safe(a.clientName)}`);
  doc.setCreationDate(a.signedAt);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold);

  // Letterhead: the logo on the left, the office on the right.
  const office = a.office ?? null;
  const top = w.y;
  let logoBottom = top;
  if (a.logoPng) {
    try {
      const logo = await doc.embedPng(a.logoPng);
      const scale = Math.min(160 / logo.width, 46 / logo.height, 1);
      const lw = logo.width * scale;
      const lh = logo.height * scale;
      w.page.drawImage(logo, { x: MARGIN, y: top - lh, width: lw, height: lh });
      logoBottom = top - lh;
    } catch {
      // A logo that will not embed must never stop the client's copy.
    }
  }
  const hasLogo = logoBottom !== top;
  if (!hasLogo) {
    w.page.drawText(safe((office?.name || 'PropGroup').toUpperCase()), { x: MARGIN, y: top - 14, size: 14, font: bold, color: INK });
    logoBottom = top - 18;
  }
  if (office) {
    const lines: Array<{ text: string; bold?: boolean }> = [];
    // Without a logo the name is already on the left.
    if (office.name && hasLogo) lines.push({ text: office.name, bold: true });
    for (const l of w.wrap(office.address, 8.5, font, 200)) if (l) lines.push({ text: l });
    if (office.phone) lines.push({ text: `Tel. ${office.phone}` });
    let y = top;
    for (const l of lines) {
      const f = l.bold ? bold : font;
      const t = safe(l.text);
      w.page.drawText(t, { x: A4.w - MARGIN - f.widthOfTextAtSize(t, 8.5), y: y - 8.5, size: 8.5, font: f, color: l.bold ? INK : MUTED });
      y -= 12;
    }
    logoBottom = Math.min(logoBottom, y);
  }
  w.y = logoBottom - 16;

  w.text('Property viewing agreement', { size: 20, bold: true, gap: 2 });
  w.text(`Reference ${a.ref}`, { size: 10, color: MUTED, gap: 6 });

  if (a.status === 'VOID') {
    w.text(`VOID${a.voidedAt ? ` since ${fmt(a.voidedAt, false)}` : ''}${a.voidReason ? ` - ${a.voidReason}` : ''}`, {
      size: 11, bold: true, color: rgb(0.75, 0.1, 0.1), gap: 6,
    });
  }

  w.rule(6);
  const pairs: Array<[string, string]> = [
    ['Client', a.clientName],
    ['Viewing', fmt(a.viewingAt)],
  ];
  if (a.clientPhone) pairs.push(['Phone', a.clientPhone]);
  if (a.clientEmail) pairs.push(['Email', a.clientEmail]);
  if (a.clientIdNumber) pairs.push(['ID / passport', a.clientIdNumber]);
  pairs.push(['PropGroup agent', a.agentName || '-']);
  pairs.push(["PropGroup's fee", a.feeLabel]);
  w.fields(pairs);

  w.text('PROPERTIES SHOWN', { size: 7, color: MUTED });
  for (const p of a.properties) {
    w.text(`${p.ref ? `${p.ref}  ` : ''}${p.title}${p.city ? ` - ${p.city}` : ''}`, { size: 10, bold: true });
  }
  if (a.propertyNote) w.text(a.propertyNote, { size: 10, bold: true });
  w.rule(8);

  for (const block of a.termsText.split(/\n\n/)) {
    const [title, ...rest] = block.split('\n');
    w.ensure(40);
    w.text(title, { size: 10, bold: true, gap: 1 });
    w.text(rest.join('\n'), { size: 9.5, color: rgb(0.2, 0.25, 0.33), gap: 7 });
  }
  w.rule(6);

  w.text(`[x] The client read and accepted this agreement, including PropGroup's fee of ${a.feeLabel}.`, { size: 9.5 });
  w.text(
    a.noPriorIntroduction
      ? '[x] The client declared that no one else introduced them to these properties before.'
      : `[ ] The client declared an earlier introduction${a.priorIntroductionNote ? `: ${a.priorIntroductionNote}` : '.'}`,
    { size: 9.5, gap: 10 },
  );

  // Signature block
  w.ensure(150);
  w.text('CLIENT SIGNATURE', { size: 7, color: MUTED, gap: 4 });
  const b64 = a.signatureData.replace(/^data:image\/png;base64,/, '');
  try {
    const png = await doc.embedPng(Buffer.from(b64, 'base64'));
    const maxW = 240;
    const maxH = 90;
    const scale = Math.min(maxW / png.width, maxH / png.height);
    const sw = png.width * scale;
    const sh = png.height * scale;
    w.page.drawRectangle({ x: MARGIN, y: w.y - maxH - 8, width: maxW + 8, height: maxH + 8, borderColor: RULE, borderWidth: 0.6 });
    w.page.drawImage(png, { x: MARGIN + 4, y: w.y - 4 - sh, width: sw, height: sh });
    w.y -= maxH + 14;
  } catch {
    w.text('(signature image could not be embedded - see the record in the back office)', { size: 9, color: MUTED });
  }
  w.text(a.clientName, { size: 10, bold: true });
  w.text(`Signed ${fmt(a.signedAt)}`, { size: 9, color: MUTED, gap: 10 });

  w.text(`Terms version ${a.termsVersion}${a.signedIp ? ` - signed from IP ${a.signedIp}` : ''}`, { size: 7, color: MUTED });
  w.text(`Document fingerprint (SHA-256): ${a.documentHash}`, { size: 7, color: MUTED });

  // Page numbers
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(safe(`${a.ref} - page ${i + 1} of ${pages.length}`), { x: MARGIN, y: 28, size: 7, font, color: MUTED });
    const contact = safe([office?.name, office?.phone].filter(Boolean).join(' - '));
    if (contact) p.drawText(contact, { x: A4.w - MARGIN - font.widthOfTextAtSize(contact, 7), y: 28, size: 7, font, color: MUTED });
  });

  return doc.save();
}
