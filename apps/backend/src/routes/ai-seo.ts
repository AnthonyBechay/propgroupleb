import express, { type Request, type Response, type Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// Lazy Anthropic client — picks up env at request time (matches ai-search.ts).
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const SEO_MODEL = 'claude-haiku-4-5-20251001';

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

function buildingFacts(b: Record<string, unknown>): string {
  const loc = [b.neighborhood, b.city, b.caza, MOHAFAZAT_LABELS[b.mohafazat as string] ?? b.mohafazat]
    .filter(Boolean).join(', ');
  const amenities = AMENITY_LABELS.filter(([k]) => b[k]).map(([, label]) => label);
  return [
    `Name: ${b.title}`,
    loc && `Location: ${loc}, Lebanon`,
    b.kind && `Kind: ${String(b.kind).toLowerCase()}`,
    b.status && `Status: ${String(b.status).replace(/_/g, ' ').toLowerCase()}`,
    b.totalFloors && `Floors: ${b.totalFloors}`,
    b.builtYear && `Built: ${b.builtYear}`,
    amenities.length && `Amenities: ${amenities.join(', ')}`,
    Array.isArray(b.highlightedFeatures) && b.highlightedFeatures.length &&
      `Highlights: ${(b.highlightedFeatures as string[]).join(', ')}`,
    b.description && `Existing description: ${String(b.description).slice(0, 600)}`,
  ].filter(Boolean).join('\n');
}

function unitFacts(u: Record<string, unknown>, b: Record<string, unknown>): string {
  const loc = [b.neighborhood, b.city, b.caza, MOHAFAZAT_LABELS[b.mohafazat as string] ?? b.mohafazat]
    .filter(Boolean).join(', ');
  return [
    `Building: ${b.title}`,
    loc && `Location: ${loc}, Lebanon`,
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

    const client = getAnthropic();
    if (!client) {
      sendError(res, 503, 'AI is not configured (missing ANTHROPIC_API_KEY).');
      return;
    }

    let facts: string;
    let instructions: string;

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
      instructions = `Write SEO metadata for this real-estate BUILDING/PROJECT page on a Lebanese property platform.
Return ONLY JSON with exactly these keys:
{
  "metaTitle": "<=60 chars, compelling, include the location and 'Lebanon'",
  "metaDescription": "<=155 chars, persuasive search snippet with location, type and a key selling point",
  "shortDescription": "<=120 chars, a punchy one-liner for listing cards"
}`;
    } else {
      if (!id) { sendError(res, 400, 'Unit id is required'); return; }
      const u = await prisma.unit.findUnique({ where: { id }, include: { building: true } });
      if (!u) { sendError(res, 404, 'Unit not found'); return; }
      if (!u.building) { sendError(res, 400, 'Unit has no building'); return; }
      facts = unitFacts(u as unknown as Record<string, unknown>, u.building as unknown as Record<string, unknown>);
      instructions = `Write SEO + marketing copy for this individual real-estate UNIT listing on a Lebanese property platform.
Return ONLY JSON with exactly these keys:
{
  "headline": "<=70 chars, scannable listing headline with type, beds and location",
  "description": "2-3 sentences (<=320 chars), warm and specific, highlighting the best features",
  "highlights": ["3 to 5 very short selling points, each <=4 words"],
  "metaTitle": "<=60 chars including location and 'Lebanon'",
  "metaDescription": "<=155 chars persuasive search snippet"
}`;
    }

    const prompt = `${instructions}

Facts:
${facts}

Rules: be accurate to the facts (never invent amenities, prices or sizes), write natural English, no emojis, no quotes around values, no markdown. Return JSON only.`;

    try {
      const message = await client.messages.create({
        model: SEO_MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = message.content
        .filter((c): c is Anthropic.TextBlock => c.type === 'text')
        .map((c) => c.text)
        .join('');
      const parsed = parseJsonReply(text);
      if (!parsed) { sendError(res, 502, 'AI returned an unparseable response. Try again.'); return; }

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
      logger.error('AI SEO generation failed', err);
      sendError(res, 502, 'AI generation failed. Please try again.');
    }
  })
);

export default router;
