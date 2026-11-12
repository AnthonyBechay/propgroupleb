import { prisma } from '@propgroup/db';
import { logger } from './logger.js';

/**
 * A property's pin, taken from the Google Maps link pasted on it.
 *
 * The team sets a location by pasting a link; almost nobody types a latitude.
 * So every time a property is saved its coordinates are read out of that link
 * and stored — the link is the source of truth, and the pin follows it when
 * the link changes. That is what puts a project on the city map and gives the
 * public page a point to centre on.
 */

/** `!3d…!4d…` is the place itself; `@lat,lng` is only where the camera was. */
export function coordsFromMapsUrl(url: string | null | undefined): { lat: number; lng: number } | null {
  if (!url) return null;
  let text = url;
  try { text = decodeURIComponent(url); } catch { /* keep it as typed */ }
  const pins = [...text.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)];
  const hit =
    pins[pins.length - 1] ??
    text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ??
    text.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ??
    text.match(/\/(-?\d+\.\d{3,}),(-?\d+\.\d{3,})/);
  if (!hit) return null;
  const lat = Number(hit[1]);
  const lng = Number(hit[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}

/** Google's own short links — the only addresses this will ever fetch. */
const SHORT_LINK = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i;

/**
 * A short link ("maps.app.goo.gl/…", what the phone app's Share button gives)
 * carries no coordinates; they only appear once it has been followed.
 */
async function resolveShortLink(url: string): Promise<{ lat: number; lng: number } | null> {
  if (!SHORT_LINK.test(url)) return null;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' },
    });
    // Only trust where Google itself sent us.
    if (!/^https:\/\/([a-z0-9-]+\.)*google\.[a-z.]+\//i.test(res.url)) return null;
    return coordsFromMapsUrl(res.url) ?? coordsFromMapsUrl((await res.text()).slice(0, 400_000));
  } catch {
    return null;
  }
}

/**
 * Re-read a saved property's pin from its link. Never throws and is not
 * awaited by the save: a slow Google must not hold up the form.
 */
export async function syncPinFromLink(buildingId: string): Promise<void> {
  try {
    const b = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { locationUrl: true, latitude: true, longitude: true },
    });
    const url = b?.locationUrl?.trim();
    if (!b || !url) return;
    const link = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const at = coordsFromMapsUrl(link) ?? (await resolveShortLink(link));
    if (!at) return;
    if (b.latitude === at.lat && b.longitude === at.lng) return;
    await prisma.building.update({ where: { id: buildingId }, data: { latitude: at.lat, longitude: at.lng } });
  } catch (err) {
    logger.warn('Could not read a pin from the map link', { buildingId, error: (err as Error).message });
  }
}
