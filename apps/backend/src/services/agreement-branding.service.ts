import sharp from 'sharp';
import * as contentService from './content.service.js';
import { getChatAiSettings } from './ai-settings.service.js';
import { extractKeyFromUrl, getFileStream } from './upload.service.js';

/**
 * What a viewing agreement carries of the agency itself.
 *
 * - The logo is the one uploaded in Settings → Branding (SiteMedia
 *   `branding.logoUrl`), the same one the property sheets use.
 * - The office name, address and phone are the ones in Settings → Chat
 *   assistant → Office, so there is one place to keep them.
 */

export interface AgreementOffice {
  name: string;
  address: string;
  phone: string;
}

export const LOGO_MEDIA_KEY = 'branding.logoUrl';

export async function getAgreementOffice(): Promise<AgreementOffice> {
  try {
    const { office } = await getChatAiSettings();
    return { name: office.name || 'PropGroup', address: office.address || '', phone: office.phone || '' };
  } catch {
    return { name: 'PropGroup', address: '', phone: '' };
  }
}

/** The stored office on an agreement, read defensively (older rows have none). */
export function officeOfRow(value: unknown): AgreementOffice | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return { name: str(o.name) || 'PropGroup', address: str(o.address), phone: str(o.phone) };
}

export async function getLogoUrl(): Promise<string | null> {
  try {
    const media = await contentService.getMediaByKey(LOGO_MEDIA_KEY);
    return media?.url || null;
  } catch {
    return null;
  }
}

// The logo changes rarely and every PDF needs it; keep the PNG for a few
// minutes rather than reading R2 and running sharp on each download.
let cache: { url: string; png: Buffer | null; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

async function readBytes(url: string): Promise<Buffer | null> {
  const key = extractKeyFromUrl(url);
  if (key) {
    const obj = await getFileStream(key);
    if (!obj.Body) return null;
    const bytes = await (obj.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  if (!/^https:\/\//.test(url)) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/**
 * The branding logo as a PNG pdf-lib can embed (it takes only PNG and JPEG;
 * an uploaded WebP or SVG is converted). Null when none is set or it can't be
 * read — the PDF then prints the name in text, and never fails over a logo.
 */
export async function getLogoPng(): Promise<Buffer | null> {
  const url = await getLogoUrl();
  if (!url) return null;
  if (cache && cache.url === url && Date.now() - cache.at < CACHE_MS) return cache.png;
  let png: Buffer | null = null;
  try {
    const raw = await readBytes(url);
    if (raw) {
      png = await sharp(raw, { failOn: 'none', density: 300 })
        .resize({ height: 160, width: 800, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
    }
  } catch (err) {
    console.warn('[viewing-agreement] logo could not be read:', (err as Error).message);
    png = null;
  }
  cache = { url, png, at: Date.now() };
  return png;
}
