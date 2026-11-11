import express, { type Request, type Response, type Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { AI_MODEL, aiFailureMessage, checkAiAccess, createText, isAiEnabled } from '../config/ai.js';
import { logger } from '../utils/logger.js';
import { countryLabel } from '../utils/market.js';
import { sendSuccess, sendError } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

/** Replies by prompt hash. In memory on purpose: it is a saving, not a record. */
const seoCache = new Map<string, { text: string; at: number }>();
const SEO_CACHE_MS = 24 * 60 * 60 * 1000;



// ── GET /status — is AI actually usable here? ────────────────────────────────
//
// Costs nothing: it reads model metadata rather than generating anything. Use
// it to tell a disabled switch, a rejected key and an unavailable model apart
// without spending a cent on a generation that will fail.
router.get(
  '/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const check = await checkAiAccess();
    sendSuccess(res, {
      enabled: process.env.AI_ENABLED === 'true',
      hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
      model: AI_MODEL,
      ok: check.ok,
      detail: check.detail,
    });
  })
);

const generateSchema = z.object({
  type: z.enum(['building', 'unit']),
  id: z.string().min(1).optional(),
  // For the create flow (no saved id yet): generate from posted form attributes.
  attributes: z.record(z.unknown()).optional(),
});

const MOHAFAZAT_LABELS: Record<string, string> = {
  BEIRUT: 'Beirut', MOUNT_LEBANON: 'Mount Lebanon', NORTH: 'North Lebanon',
  SOUTH: 'South Lebanon', BEKAA: 'Bekaa', NABATIEH: 'Nabatieh',
  AKKAR: 'Akkar', BAALBEK_HERMEL: 'Baalbek-Hermel',
};

/** Strip ```json fences / prose and parse the first JSON object in a model reply. */
function parseJsonReply(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clamp(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max).trim() : s;
}

const AMENITY_LABELS: Array<[string, string]> = [
  ['hasGenerator', 'backup generator'], ['hasElevator', 'elevator'], ['hasPool', 'pool'],
  ['hasGym', 'gym'], ['hasConcierge', 'concierge'], ['hasSecurity', '24/7 security'],
  ['hasGarden', 'garden'], ['hasRooftop', 'rooftop'], ['hasSolarPower', 'solar power'],
];

/**
 * "District, City, Country". The country used to be the literal word
 * "Lebanon" here, so a project abroad was described to the model as being in
 * Lebanon two lines under an instruction to write for its real country.
 * No country on the record → none is stated, rather than a guess.
 */
function locationLine(b: Record<string, unknown>): string {
  const country = countryLabel(b.country);
  return [b.neighborhood, b.city, b.caza, MOHAFAZAT_LABELS[b.mohafazat as string] ?? b.mohafazat, country]
    .filter(Boolean)
    // "Batumi, Batumi" when the district and the city are the same word.
    .filter((part, i, all) => all.indexOf(part) === i)
    .join(', ');
}

function buildingFacts(b: Record<string, unknown>): string {
  const loc = locationLine(b);
  const amenities = AMENITY_LABELS.filter(([k]) => b[k]).map(([, label]) => label);
  return [
    `Name: ${b.title}`,
    loc && `Location: ${loc}`,
    b.kind && `Kind: ${String(b.kind).toLowerCase()}`,
    b.status && `Status: ${String(b.status).replace(/_/g, ' ').toLowerCase()}`,
    b.totalFloors && `Floors: ${b.totalFloors}`,
    b.builtYear && `Built: ${b.builtYear}`,
    b.distanceToSea != null && `Distance to the sea: ${b.distanceToSea} m`,
    amenities.length && `Amenities: ${amenities.join(', ')}`,
    Array.isArray(b.highlightedFeatures) && b.highlightedFeatures.length &&
      `Highlights: ${(b.highlightedFeatures as string[]).join(', ')}`,
    b.description && `Existing description: ${String(b.description).replace(/\s+/g, ' ').slice(0, 400)}`,
  ].filter(Boolean).join('\n');
}

function unitFacts(u: Record<string, unknown>, b: Record<string, unknown>): string {
  const loc = locationLine(b);
  return [
    `Building: ${b.title}`,
    loc && `Location: ${loc}`,
    u.name && `Unit name: ${u.name}`,
    u.unitNumber && `Unit number: ${u.unitNumber}`,
    u.kind && `Type: ${String(u.kind).toLowerCase()}`,
    u.bedrooms != null && `Bedrooms: ${u.bedrooms}`,
    u.bathrooms != null && `Bathrooms: ${u.bathrooms}`,
    u.areaSqm != null && `Area: ${u.areaSqm} m²`,
    u.floor != null && `Floor: ${u.floor}`,
    Array.isArray(u.views) && u.views.length && `Views: ${(u.views as string[]).join(', ')}`,
    Array.isArray(u.features) && u.features.length && `Features: ${(u.features as string[]).join(', ')}`,
  ].filter(Boolean).join('\n');
}

// ── POST /generate — AI-generate SEO copy for a building or unit ──────────────
//
// Returns SUGGESTED fields (does not save). The admin reviews and saves via the
// normal building / listing forms. Buildings get meta + a short description;
// units get listing marketing copy (headline/description/highlights) which is
// what the public listing page surfaces for search.
router.post(
  '/generate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { type, id, attributes } = generateSchema.parse(req.body);

    if (!isAiEnabled()) {
      sendError(res, 503, 'AI is disabled. Set AI_ENABLED=true and ANTHROPIC_API_KEY to enable.');
      return;
    }

    let facts: string;
    let instructions: string;

    /**
     * Market wording, derived from the record's own country.
     *
     * This used to be hardcoded to Lebanon — every prompt said "a Lebanese
     * property platform" and instructed the model to put "Lebanon" in the meta
     * title. Since the back-office merge this API also serves the Georgian
     * catalogue, where that produced wrong copy, so the feature was unusable
     * for it (all 18 Georgian buildings still have null metaTitle).
     */
    const marketFor = (country?: unknown): { platform: string; place: string } => {
      // Whatever country is on the record; there is no list to keep up.
      const place = countryLabel(country);
      // No country on the record: omit the country cue rather than guess.
      return { platform: place ? `a property platform for ${place}` : 'an international property platform', place };
    };

    if (type === 'building') {
      // Either a saved building (id) or live form attributes (create flow).
      let b: Record<string, unknown> | null = null;
      if (id) {
        b = (await prisma.building.findUnique({ where: { id } })) as unknown as Record<string, unknown> | null;
        if (!b) { sendError(res, 404, 'Building not found'); return; }
      } else if (attributes && Object.keys(attributes).length > 0) {
        b = attributes;
      } else {
        sendError(res, 400, 'Provide an id or attributes to generate from'); return;
      }
      facts = buildingFacts(b);
      const market = marketFor((b as Record<string, unknown>)?.country);
      instructions = `Write SEO metadata for this real-estate BUILDING/PROJECT page on ${market.platform}.
Return ONLY JSON with exactly these keys:
{
  "metaTitle": "<=60 chars, compelling, include the location${market.place ? ` and '${market.place}'` : ''}",
  "metaDescription": "<=155 chars: a plain factual sentence an AI answer could quote (what it is, where, one concrete fact), then one selling point",
  "shortDescription": "<=120 chars, a punchy one-liner for listing cards"
}`;
    } else {
      if (!id) { sendError(res, 400, 'Unit id is required'); return; }
      const u = await prisma.unit.findUnique({ where: { id }, include: { building: true } });
      if (!u) { sendError(res, 404, 'Unit not found'); return; }
      if (!u.building) { sendError(res, 400, 'Unit has no building'); return; }
      facts = unitFacts(u as unknown as Record<string, unknown>, u.building as unknown as Record<string, unknown>);
      const market = marketFor((u.building as Record<string, unknown>)?.country);
      instructions = `Write SEO + marketing copy for this individual real-estate UNIT listing on ${market.platform}.
Return ONLY JSON with exactly these keys:
{
  "headline": "<=70 chars, scannable listing headline with type, beds and location",
  "description": "2-3 sentences (<=320 chars), warm and specific, highlighting the best features",
  "highlights": ["3 to 5 very short selling points, each <=4 words"],
  "metaTitle": "<=60 chars including location${market.place ? ` and '${market.place}'` : ''}",
  "metaDescription": "<=155 chars: a plain factual sentence an AI answer could quote (type, beds, size, where), then one selling point"
}`;
    }

    const prompt = `${instructions}

Facts:
${facts}

Rules: be accurate to the facts (never invent amenities, prices or sizes), write natural English, no emojis, no quotes around values, no markdown. Return JSON only.`;

    const startedAt = Date.now();
    try {
      // Routed through config/ai.ts, which pins the model to the cheap-tier
      // allowlist, caps output tokens, logs per-call cost, and refuses to run
      // unless AI_ENABLED=true. There is deliberately no way to pass a model.
      // The same facts give the same copy: a second press of "Auto-write" on
      // an unchanged record is answered from memory and costs nothing.
      const cacheKey = crypto.createHash('sha256').update(prompt).digest('hex');
      const cached = seoCache.get(cacheKey);
      let text: string;
      if (cached && Date.now() - cached.at < SEO_CACHE_MS && req.query.fresh !== '1') {
        text = cached.text;
      } else {
        const reply = await createText({
          // Starting the reply at "{" means no ```json fence and no preamble to
          // pay for, and nothing for the parser to strip.
          messages: [{ role: 'user', content: prompt }, { role: 'assistant', content: '{' }],
          // What the JSON can actually need: three short fields for a
          // building (~110 tokens), five for a unit (~220). The ceiling was 600
          // for both, which only ever paid for a reply that had gone wrong.
          maxTokens: type === 'building' ? 220 : 360,
        });
        text = reply.trimStart().startsWith('{') ? reply : `{${reply}`;
      }
      const parsed = parseJsonReply(text);
      if (!parsed) { sendError(res, 502, 'AI returned an unparseable response. Try again.'); return; }
      // Only a reply that parsed is worth keeping.
      if (seoCache.size >= 200) seoCache.delete(seoCache.keys().next().value as string);
      seoCache.set(cacheKey, { text, at: Date.now() });

      let result: Record<string, unknown>;
      if (type === 'building') {
        result = {
          metaTitle: clamp(parsed.metaTitle, 60),
          metaDescription: clamp(parsed.metaDescription, 155),
          shortDescription: clamp(parsed.shortDescription, 120),
        };
      } else {
        const highlights = Array.isArray(parsed.highlights)
          ? (parsed.highlights as unknown[])
              .map((h) => clamp(h, 40))
              .filter((h): h is string => !!h)
              .slice(0, 5)
          : [];
        result = {
          headline: clamp(parsed.headline, 70),
          description: clamp(parsed.description, 320),
          highlights,
          metaTitle: clamp(parsed.metaTitle, 60),
          metaDescription: clamp(parsed.metaDescription, 155),
        };
      }

      await logAdminAction('AI_GENERATE_SEO', type, id ?? 'draft', { type }, authReq);
      sendSuccess(res, result, 'SEO suggestions generated');
    } catch (err) {
      // Say what actually went wrong. The generic message meant every failure —
      // a bad key, an unavailable model, a timeout — looked identical in the
      // admin, and the browser's CORS complaint on a gateway 502 hid it further.
      // Timing matters here: a failure at ~20s is the network, not the model.
      logger.error(`AI SEO generation failed after ${Date.now() - startedAt}ms`, err);
      sendError(res, 502, `AI generation failed. ${aiFailureMessage(err)}`);
    }
  })
);

export default router;
