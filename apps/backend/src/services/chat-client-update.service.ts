import { prisma } from '@propgroup/db';
import { logger } from '../utils/logger.js';

/**
 * What the chat assistant learns, written where the team will look for it.
 *
 * Two jobs:
 *
 * 1. **Fill in the client.** Everything used to wait as a suggestion for a
 *    person to accept, and the team was pressing "accept" on every chat just
 *    to get a budget onto a card. Now a detail goes straight onto the client
 *    when that field is empty, or when it only adds (another intent, another
 *    property type). Only a detail that would REPLACE something on file —
 *    a different budget, a different name than one somebody typed — still
 *    waits for a person. Nothing the team entered is overwritten unasked.
 *
 * 2. **File sellers.** An owner or broker offering a property was only a
 *    hand-off and a line of free text. Their offer is now an owner submission
 *    (source CHAT), next to the website form's, with the photos they sent —
 *    so it can be reviewed, visited and approved into a listing like any other.
 */

const sameText = (a: string, b: string) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

export interface ClientPatch {
  intent?: string;
  market?: string;
  area?: string;
  minBeds?: number;
  budgetMax?: number;
  kind?: string;
  isInvestor?: boolean;
  fullName?: string;
}

/**
 * Apply what can be applied without overwriting anything. Returns what is
 * left — the details that would change a value already on file.
 */
export async function applyToLead(
  leadId: string,
  conversationId: string,
  patch: ClientPatch,
  summary: string
): Promise<ClientPatch> {
  const [lead, conversation] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        name: true, type: true, intents: true, market: true, budgetMax: true, minBeds: true,
        unitKinds: true, isInvestor: true, askingFor: true, _count: { select: { opportunities: true } },
      },
    }),
    prisma.conversation.findUnique({ where: { id: conversationId }, select: { displayName: true } }),
  ]);
  if (!lead) return patch;

  const data: Record<string, unknown> = {};
  const changes: string[] = [];
  const left: ClientPatch = {};
  const noDeals = lead._count.opportunities === 0;

  // The name: a client created from a chat is named after their profile
  // ("Bilal", "rimoncharro7"); the name they type replaces that, not one a person entered.
  if (patch.fullName && !sameText(patch.fullName, lead.name)) {
    const placeholder = !lead.name.trim() || (conversation?.displayName && sameText(lead.name, conversation.displayName));
    if (placeholder) { data.name = patch.fullName; changes.push(`Name: ${lead.name || '—'} → ${patch.fullName}`); }
    else left.fullName = patch.fullName;
  }

  // An intent only ever adds. It becomes the primary one while the client has
  // no other on record — every new client is a BUYER by default.
  if (patch.intent && !lead.intents.includes(patch.intent as never)) {
    if (lead.intents.length === 0 && noDeals) {
      data.type = patch.intent;
      data.intents = [patch.intent];
      changes.push(`Looking to: ${patch.intent}`);
    } else {
      data.intents = [...lead.intents, patch.intent];
      changes.push(`Also: ${patch.intent}`);
    }
  }

  // The market is a preference that ranks matches; with no deal yet, the chat is the best word on it.
  if (patch.market && patch.market !== lead.market) {
    if (noDeals) { data.market = patch.market; changes.push(`Market: ${lead.market} → ${patch.market}`); }
    else left.market = patch.market;
  }

  if (patch.budgetMax != null && patch.budgetMax !== lead.budgetMax) {
    if (lead.budgetMax == null) { data.budgetMax = patch.budgetMax; changes.push(`Budget up to: ${patch.budgetMax}`); }
    else left.budgetMax = patch.budgetMax;
  }
  if (patch.minBeds != null && patch.minBeds !== lead.minBeds) {
    if (lead.minBeds == null) { data.minBeds = patch.minBeds; changes.push(`Bedrooms from: ${patch.minBeds}`); }
    else left.minBeds = patch.minBeds;
  }
  if (patch.kind && !lead.unitKinds.includes(patch.kind as never)) {
    data.unitKinds = [...lead.unitKinds, patch.kind];
    changes.push(`Property type: ${patch.kind}`);
  }
  if (patch.isInvestor === true && !lead.isInvestor) { data.isInvestor = true; changes.push('Investor: yes'); }
  else if (patch.isInvestor === false && lead.isInvestor) left.isInvestor = false;

  // Areas on a client are curated; what the client typed goes in the free-text line.
  const asking = [summary, patch.area ? `Area: ${patch.area}` : null].filter(Boolean).join(' · ').slice(0, 200);
  if (asking && !lead.askingFor?.trim()) { data.askingFor = asking; changes.push(`Asking for: ${asking}`); }
  else if (patch.area) left.area = patch.area;

  if (changes.length) {
    await prisma.$transaction([
      prisma.lead.update({ where: { id: leadId }, data }),
      // The trail, same as a person accepting it.
      prisma.leadContact.create({
        data: { leadId, channel: 'NOTE', body: `Updated from chat (assistant)\n${changes.join('\n')}`.slice(0, 4000) },
      }),
    ]);
    logger.info('Client updated from chat', { leadId, conversationId, changes: changes.join('; ') });
  }

  // What it learned stays readable for the assistant's next reply — accepted
  // suggestions are part of what it knows about this chat.
  const applied = Object.fromEntries(Object.entries(patch).filter(([k]) => !(k in left)));
  if (Object.keys(applied).length) {
    const auto = await prisma.leadSuggestion.findFirst({
      where: { conversationId, status: 'ACCEPTED', resolvedBy: null },
      orderBy: { createdAt: 'desc' },
    });
    if (auto) {
      await prisma.leadSuggestion.update({
        where: { id: auto.id },
        data: { patch: { ...(auto.patch as Record<string, unknown>), ...applied } as never, summary: summary || auto.summary, leadId },
      });
    } else {
      await prisma.leadSuggestion.create({
        data: { conversationId, leadId, patch: applied as never, summary: summary || 'From chat', status: 'ACCEPTED', resolvedAt: new Date() },
      });
    }
  }
  return left;
}

const KIND_LABEL: Record<string, string> = {
  APARTMENT: 'Apartment', STUDIO: 'Studio', DUPLEX: 'Duplex', PENTHOUSE: 'Penthouse', VILLA: 'Villa',
  TOWNHOUSE: 'Townhouse', SHOP: 'Shop', OFFICE: 'Office', SHOWROOM: 'Showroom', WAREHOUSE: 'Warehouse',
  RESTAURANT: 'Restaurant', CLINIC: 'Clinic', WHOLE_BUILDING: 'Building', LAND_PARCEL: 'Land', STORAGE: 'Storage', PARKING: 'Parking',
};
export const OFFER_KINDS = Object.keys(KIND_LABEL);

export interface PropertyOffer {
  deal?: string;
  kind?: string;
  location?: string;
  areaSqm?: number;
  price?: number;
  pricePerSqm?: number;
  bedrooms?: number;
  floor?: number;
  details?: string;
}

const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : undefined);

/** File (or update) the owner submission for a property offered in this chat. */
export async function savePropertyOffer(
  conversationId: string,
  leadId: string | null,
  raw: Record<string, unknown>
): Promise<{ submissionId: string } | null> {
  const offer: PropertyOffer = {
    deal: raw.deal === 'RENT' ? 'RENT' : 'SALE',
    kind: typeof raw.kind === 'string' && OFFER_KINDS.includes(raw.kind) ? raw.kind : undefined,
    location: typeof raw.location === 'string' ? raw.location.trim().slice(0, 80) || undefined : undefined,
    areaSqm: num(raw.areaSqm, 10_000_000),
    price: num(raw.price, 10_000_000_000),
    pricePerSqm: num(raw.pricePerSqm, 1_000_000),
    bedrooms: typeof raw.bedrooms === 'number' && raw.bedrooms >= 0 && raw.bedrooms <= 30 ? Math.round(raw.bedrooms) : undefined,
    floor: typeof raw.floor === 'number' && raw.floor >= -5 && raw.floor <= 200 ? Math.round(raw.floor) : undefined,
    details: typeof raw.details === 'string' ? raw.details.trim().slice(0, 2000) || undefined : undefined,
  };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      channel: true, externalId: true, displayName: true,
      lead: { select: { name: true, phone: true, whatsapp: true } },
      messages: {
        where: { direction: 'IN', type: 'image', mediaUrl: { not: null } },
        orderBy: { createdAt: 'asc' },
        take: 12,
        select: { mediaUrl: true },
      },
    },
  });
  if (!conversation) return null;

  const existing = await prisma.propertySubmission.findUnique({ where: { conversationId } });
  // Once somebody is reviewing it, the chat no longer rewrites it.
  if (existing && existing.status !== 'PENDING') return { submissionId: existing.id };

  const kind = offer.kind ?? existing?.unitKind ?? 'APARTMENT';
  const intent = offer.deal === 'RENT' ? 'FOR_RENT' : 'FOR_SALE';
  const location = offer.location ?? existing?.city ?? null;
  const areaSqm = offer.areaSqm ?? existing?.areaSqm ?? null;
  // A price per m² is how land is quoted; the submission holds the total.
  const price = offer.price ?? (offer.pricePerSqm && areaSqm ? offer.pricePerSqm * areaSqm : null) ?? existing?.price ?? null;
  const perSqm = offer.pricePerSqm
    ? `Asking ${offer.pricePerSqm.toLocaleString('en-US')} USD per m².`
    : existing?.extraDetails?.match(/^Asking .+ per m²\.$/m)?.[0] ?? null;
  const phone =
    conversation.lead?.phone || conversation.lead?.whatsapp ||
    (conversation.channel === 'WHATSAPP' ? `+${conversation.externalId.replace(/\D/g, '')}` : `Instagram: ${conversation.displayName ?? conversation.externalId}`);
  const images = [...new Set([...(existing?.images ?? []), ...conversation.messages.map((m) => m.mediaUrl as string)])].slice(0, 12);

  const data = {
    sellerName: conversation.lead?.name || conversation.displayName || 'Chat seller',
    sellerPhone: phone,
    preferredContact: 'whatsapp',
    title: `${KIND_LABEL[kind] ?? 'Property'} for ${intent === 'FOR_RENT' ? 'rent' : 'sale'}${location ? ` — ${location}` : ''}`.slice(0, 150),
    description: offer.details ?? existing?.description ?? null,
    extraDetails: [perSqm, `Offered in a ${conversation.channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'} chat — see the inbox for everything they sent.`]
      .filter(Boolean).join('\n'),
    unitKind: kind as never,
    intent: intent as never,
    bedrooms: offer.bedrooms ?? existing?.bedrooms ?? null,
    floor: offer.floor ?? existing?.floor ?? null,
    areaSqm,
    price,
    city: location,
    images,
    source: 'CHAT',
    leadId,
  };

  const saved = existing
    ? await prisma.propertySubmission.update({ where: { id: existing.id }, data })
    : await prisma.propertySubmission.create({ data: { ...data, conversationId } });
  if (!existing) logger.info('Owner submission filed from chat', { conversationId, submissionId: saved.id, title: saved.title });
  return { submissionId: saved.id };
}
