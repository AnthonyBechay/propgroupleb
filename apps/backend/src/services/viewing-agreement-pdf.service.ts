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
  /** How long the no-direct-dealing protection runs. */
  protectionMonths?: number | null;
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const INK = rgb(0.06, 0.09, 0.16);
const BODY = rgb(0.2, 0.25, 0.33);
const MUTED = rgb(0.42, 0.47, 0.55);
const RULE = rgb(0.86, 0.88, 0.91);
const PANEL = rgb(0.965, 0.972, 0.98);
const ACCENT = rgb(0.12, 0.16, 0.23);
const FOOTER_Y = 30;

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

type Color = ReturnType<typeof rgb>;

class Writer {
  page: PDFPage;
  y: number;
  constructor(private doc: PDFDocument, readonly font: PDFFont, readonly bold: PDFFont) {
    this.page = doc.addPage([A4.w, A4.h]);
    this.y = A4.h - MARGIN;
  }

  get width() { return A4.w - MARGIN * 2; }

  ensure(space: number) {
    if (this.y - space < FOOTER_Y + 28) {
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

  /** Height `text` would take, without drawing it. */
  measure(text: string, size: number, bold: boolean, width: number, lead = 1.4) {
    return this.wrap(text, size, bold ? this.bold : this.font, width).length * size * lead;
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: Color; gap?: number; x?: number; width?: number; lead?: number; keep?: boolean } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const x = opts.x ?? MARGIN;
    const lineH = size * (opts.lead ?? 1.4);
    for (const line of this.wrap(text, size, font, opts.width ?? this.width - (x - MARGIN))) {
      if (!opts.keep) this.ensure(lineH);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lineH;
    }
    this.y -= opts.gap ?? 0;
  }

  /** Text drawn at a fixed point, right-aligned to `right` when given. */
  at(text: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: Color; right?: boolean } = {}) {
    const size = opts.size ?? 9;
    const font = opts.bold ? this.bold : this.font;
    const t = safe(text);
    const dx = opts.right ? x - font.widthOfTextAtSize(t, size) : x;
    this.page.drawText(t, { x: dx, y, size, font, color: opts.color ?? INK });
  }

  rule(gap = 10, color: Color = RULE, thickness = 0.6) {
    this.ensure(gap * 2);
    this.y -= gap;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4.w - MARGIN, y: this.y }, thickness, color });
    this.y -= gap;
  }

  box(x: number, top: number, width: number, height: number, fill: Color, border?: Color) {
    this.page.drawRectangle({
      x, y: top - height, width, height, color: fill,
      ...(border ? { borderColor: border, borderWidth: 0.6 } : {}),
    });
  }

  label(text: string, x = MARGIN, opts: { keep?: boolean; gap?: number } = {}) {
    this.text(text.toUpperCase(), { size: 6.8, bold: true, color: MUTED, x, gap: opts.gap ?? 3, keep: opts.keep });
  }

  /** A ticked or empty box with its text beside it. */
  check(checked: boolean, text: string) {
    const size = 9.5;
    const x = MARGIN + 16;
    const h = this.measure(text, size, false, this.width - 16);
    this.ensure(h + 4);
    const top = this.y;
    this.page.drawRectangle({ x: MARGIN, y: top - 10.5, width: 9.5, height: 9.5, borderColor: ACCENT, borderWidth: 0.9 });
    if (checked) {
      this.page.drawLine({ start: { x: MARGIN + 2, y: top - 6 }, end: { x: MARGIN + 4.2, y: top - 8.6 }, thickness: 1.3, color: ACCENT });
      this.page.drawLine({ start: { x: MARGIN + 4.2, y: top - 8.6 }, end: { x: MARGIN + 8, y: top - 2.6 }, thickness: 1.3, color: ACCENT });
    }
    this.text(text, { size, x, color: BODY, keep: true, gap: 5 });
  }
}

/** `timeZone`: the downloading device's, so dates read as the client lived them. */
export async function renderViewingAgreementPdf(a: AgreementForPdf, timeZone = 'UTC'): Promise<Uint8Array> {
  const zone = safeTimeZone(timeZone);
  const fmt = (d: Date, withTime = true) => fmtDate(d, zone, withTime);
  const office = a.office ?? null;
  const agency = office?.name || 'PropGroup';

  const doc = await PDFDocument.create();
  doc.setTitle(`${safe(agency)} viewing agreement ${a.ref}`);
  doc.setAuthor(safe(agency));
  doc.setSubject(`Viewing agreement signed by ${safe(a.clientName)}`);
  doc.setCreationDate(a.signedAt);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold);
  const right = A4.w - MARGIN;

  // ── Letterhead: logo left, office right, a firm line under both ──
  const top = w.y;
  let bottom = top;
  let hasLogo = false;
  if (a.logoPng) {
    try {
      const logo = await doc.embedPng(a.logoPng);
      const scale = Math.min(180 / logo.width, 56 / logo.height);
      w.page.drawImage(logo, { x: MARGIN, y: top - logo.height * scale, width: logo.width * scale, height: logo.height * scale });
      bottom = top - logo.height * scale;
      hasLogo = true;
    } catch {
      // A logo that will not embed must never stop the client's copy.
    }
  }
  if (!hasLogo) {
    w.at(agency.toUpperCase(), MARGIN, top - 18, { size: 18, bold: true });
    bottom = top - 24;
  }
  {
    let y = top - 9;
    w.at(agency, right, y, { size: 10, bold: true, right: true });
    y -= 14;
    for (const l of office?.address ? w.wrap(office.address, 8.5, font, 210) : []) {
      w.at(l, right, y, { size: 8.5, color: MUTED, right: true });
      y -= 11.5;
    }
    if (office?.phone) {
      w.at(`Tel. ${office.phone}`, right, y, { size: 8.5, color: MUTED, right: true });
      y -= 11.5;
    }
    bottom = Math.min(bottom, y + 4);
  }
  w.y = bottom - 12;
  w.page.drawRectangle({ x: MARGIN, y: w.y - 2, width: w.width, height: 2, color: ACCENT });
  w.y -= 22;

  // ── Title, with the reference and date on the right ──
  const titleTop = w.y;
  w.text('Property viewing agreement', { size: 22, bold: true, gap: 3, width: w.width - 170 });
  w.text(`Between ${agency} and ${a.clientName}`, { size: 10.5, color: MUTED, width: w.width - 170 });
  w.at('REFERENCE', right, titleTop - 7, { size: 6.8, bold: true, color: MUTED, right: true });
  w.at(a.ref, right, titleTop - 20, { size: 11, bold: true, right: true });
  w.at('SIGNED', right, titleTop - 35, { size: 6.8, bold: true, color: MUTED, right: true });
  w.at(fmt(a.signedAt, false), right, titleTop - 47, { size: 9.5, right: true });
  w.y = Math.min(w.y, titleTop - 52) - 14;

  if (a.status === 'VOID') {
    const msg = `VOID${a.voidedAt ? ` since ${fmt(a.voidedAt, false)}` : ''}${a.voidReason ? ` - ${a.voidReason}` : ''}`;
    const h = w.measure(msg, 11, true, w.width - 24) + 14;
    w.box(MARGIN, w.y, w.width, h, rgb(0.99, 0.93, 0.93), rgb(0.9, 0.6, 0.6));
    w.y -= 7;
    w.text(msg, { size: 11, bold: true, color: rgb(0.72, 0.1, 0.1), x: MARGIN + 12, width: w.width - 24, keep: true });
    w.y -= 14;
  }

  // ── Summary card: who, when, what ──
  const pairs: Array<[string, string]> = [['Client', a.clientName], ['Viewing', fmt(a.viewingAt)]];
  if (a.clientPhone) pairs.push(['Phone', a.clientPhone]);
  if (a.clientEmail) pairs.push(['Email', a.clientEmail]);
  if (a.clientIdNumber) pairs.push(['ID / passport', a.clientIdNumber]);
  pairs.push([`${agency} agent`, a.agentName || '-']);
  pairs.push([`${agency}'s fee`, a.feeLabel]);
  if (pairs.length % 2) pairs.push(['', '']);

  const pad = 14;
  const innerW = w.width - pad * 2;
  const colW = innerW / 2;
  const rowH = (i: number) => 11 + Math.max(...pairs.slice(i, i + 2).map(([, v]) => w.measure(v || ' ', 10, true, colW - 12))) + 8;
  const props = [
    ...a.properties.map((p) => ({ ref: p.ref, text: `${p.title}${p.city ? ` - ${p.city}` : ''}` })),
    ...(a.propertyNote ? [{ ref: null as string | null, text: a.propertyNote }] : []),
  ];
  let cardH = pad;
  for (let i = 0; i < pairs.length; i += 2) cardH += rowH(i);
  cardH += 10 + 11;
  for (const p of props) cardH += w.measure(p.text, 10, true, innerW - 62) + 4;
  cardH += pad - 4;
  w.ensure(cardH);
  w.box(MARGIN, w.y, w.width, cardH, PANEL);
  w.y -= pad;
  for (let i = 0; i < pairs.length; i += 2) {
    const rowTop = w.y;
    const h = rowH(i);
    pairs.slice(i, i + 2).forEach(([label, value], c) => {
      if (!label) return;
      w.y = rowTop;
      const x = MARGIN + pad + c * colW;
      w.label(label, x, { keep: true, gap: 2 });
      w.text(value, { size: 10, bold: true, x, width: colW - 12, keep: true });
    });
    w.y = rowTop - h;
  }
  w.page.drawLine({ start: { x: MARGIN + pad, y: w.y }, end: { x: right - pad, y: w.y }, thickness: 0.6, color: RULE });
  w.y -= 10;
  w.label('Properties shown', MARGIN + pad, { keep: true, gap: 2 });
  for (const p of props) {
    const rowTop = w.y;
    if (p.ref) w.at(p.ref, MARGIN + pad, rowTop - 10, { size: 9, bold: true, color: MUTED });
    w.text(p.text, { size: 10, bold: true, x: MARGIN + pad + (p.ref ? 62 : 0), width: innerW - (p.ref ? 62 : 0), keep: true, gap: 4 });
  }
  w.y -= pad - 4;
  w.y -= 18;

  // ── In short: the three things a client must take away ──
  const months = a.protectionMonths || 12;
  const isPercent = /%$/.test(a.feeLabel.trim());
  const points = [
    `For ${months} months, you deal with the owner or developer of these properties only through ${agency}.`,
    `If you buy one of them, ${agency}'s fee is ${a.feeLabel}${isPercent ? ' of the purchase price' : ''}.`,
    'If someone else introduced you to any of them before today, say so below.',
  ];
  const pointsH = 12 + 13 + points.reduce((n, t) => n + w.measure(t, 9.5, false, w.width - 44) + 3, 0) + 9;
  w.ensure(pointsH);
  w.box(MARGIN, w.y, w.width, pointsH, PANEL);
  w.box(MARGIN, w.y, 3, pointsH, ACCENT);
  w.y -= 12;
  w.text('In short', { size: 10, bold: true, x: MARGIN + 16, keep: true, gap: 2 });
  for (const t of points) {
    const rowTop = w.y;
    w.page.drawCircle({ x: MARGIN + 20, y: rowTop - 6.3, size: 1.6, color: ACCENT });
    w.text(t, { size: 9.5, x: MARGIN + 28, width: w.width - 44, color: BODY, keep: true, gap: 3 });
  }
  w.y -= 9 + 16;

  // ── The terms, numbered ──
  w.label('Terms', MARGIN, { gap: 8 });
  for (const block of a.termsText.split(/\n\n/)) {
    const [head, ...rest] = block.split('\n');
    const m = head.match(/^(\d+)\.\s*(.*)$/);
    const num = m ? m[1] : '';
    const title = m ? m[2] : head;
    const body = rest.join('\n');
    // Keep a heading with at least the first lines of its text.
    w.ensure(14 + Math.min(w.measure(body, 9.2, false, w.width - 24, 1.4), 40));
    const rowTop = w.y;
    if (num) w.at(num.padStart(2, '0'), MARGIN, rowTop - 10, { size: 9, bold: true, color: MUTED });
    w.text(title, { size: 10.2, bold: true, x: MARGIN + 24, gap: 1.5 });
    w.text(body, { size: 9.2, x: MARGIN + 24, color: BODY, lead: 1.4, gap: 8 });
  }

  // ── Declarations ──
  // Declarations, signatures and evidence stay on one page together: a
  // signature alone on a last page reads as signed to nothing.
  const sigH = 82;
  w.ensure(48 + 40 + sigH + 52 + 34);
  w.rule(4);
  w.y -= 4;
  w.label('Declarations', MARGIN, { gap: 7 });
  w.check(true, `I, ${a.clientName}, have read and accept this agreement, including ${agency}'s fee of ${a.feeLabel} if I buy.`);
  w.check(
    a.noPriorIntroduction,
    a.noPriorIntroduction
      ? 'No one else introduced me to these properties before today.'
      : `I was introduced to some of these properties before today${a.priorIntroductionNote ? `: ${a.priorIntroductionNote}` : '.'}`,
  );
  w.y -= 10;

  // ── Signatures: the client's on the left, the agency's side on the right ──
  w.ensure(sigH + 70);
  const sigTop = w.y;
  const half = (w.width - 20) / 2;
  w.label('Client signature', MARGIN, { keep: true, gap: 5 });
  const boxTop = w.y;
  w.box(MARGIN, boxTop, half, sigH, rgb(1, 1, 1), RULE);
  try {
    const png = await doc.embedPng(Buffer.from(a.signatureData.replace(/^data:image\/png;base64,/, ''), 'base64'));
    const scale = Math.min((half - 16) / png.width, (sigH - 12) / png.height);
    const sw = png.width * scale;
    const sh = png.height * scale;
    w.page.drawImage(png, { x: MARGIN + (half - sw) / 2, y: boxTop - sigH + (sigH - sh) / 2, width: sw, height: sh });
  } catch {
    w.at('(signature kept in the back office)', MARGIN + 10, boxTop - sigH / 2, { size: 8.5, color: MUTED });
  }
  w.y = boxTop - sigH - 8;
  w.text(a.clientName, { size: 10, bold: true, keep: true });
  w.text(fmt(a.signedAt), { size: 8.5, color: MUTED, keep: true });
  const leftBottom = w.y;

  const rx = MARGIN + half + 20;
  w.y = sigTop;
  w.label(`For ${agency}`, rx, { keep: true, gap: 5 });
  const rTop = w.y;
  w.box(rx, rTop, half, sigH, PANEL);
  w.y = rTop - 14;
  w.text(a.agentName || agency, { size: 10, bold: true, x: rx + 12, width: half - 24, keep: true, gap: 2 });
  w.text('Agent present at the viewing', { size: 8.5, color: MUTED, x: rx + 12, width: half - 24, keep: true, gap: 8 });
  if (office?.address) w.text(office.address, { size: 8.5, color: BODY, x: rx + 12, width: half - 24, keep: true });
  if (office?.phone) w.text(`Tel. ${office.phone}`, { size: 8.5, color: BODY, x: rx + 12, width: half - 24, keep: true });
  w.y = Math.min(leftBottom, rTop - sigH) - 18;

  // ── Evidence ──
  w.ensure(30);
  w.text(
    `Signed electronically on ${fmt(a.signedAt)}${a.signedIp ? ` from IP ${a.signedIp}` : ''}. Terms version ${a.termsVersion}.`,
    { size: 7, color: MUTED },
  );
  w.text(`Document fingerprint (SHA-256): ${a.documentHash}`, { size: 7, color: MUTED });

  // ── Running header (pages 2+) and footer (every page) ──
  const pages = doc.getPages();
  const contact = [agency, office?.phone, office?.address].filter(Boolean).join('  |  ');
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: FOOTER_Y + 12 }, end: { x: right, y: FOOTER_Y + 12 }, thickness: 0.6, color: RULE });
    p.drawText(safe(`${a.ref}  |  page ${i + 1} of ${pages.length}`), { x: MARGIN, y: FOOTER_Y, size: 7, font, color: MUTED });
    let c = safe(contact);
    while (c.length > 4 && font.widthOfTextAtSize(c, 7) > w.width - 140) c = c.slice(0, -2);
    if (c !== safe(contact)) c = `${c.trimEnd()}...`;
    p.drawText(c, { x: right - font.widthOfTextAtSize(c, 7), y: FOOTER_Y, size: 7, font, color: MUTED });
    if (i > 0) {
      p.drawText(safe(`${agency}  |  Property viewing agreement ${a.ref}  |  ${a.clientName}`), { x: MARGIN, y: A4.h - 30, size: 7.5, font, color: MUTED });
    }
  });

  return doc.save();
}
