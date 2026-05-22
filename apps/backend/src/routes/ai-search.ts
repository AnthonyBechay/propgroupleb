import express, { type Request, type Response, type Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@propgroup/db';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/response.js';
import { PROPERTY_LIST_INCLUDE } from '../utils/prisma-includes.js';
import { aiSearchSchema } from '../schemas/index.js';

const router: Router = express.Router();

// Lazy Anthropic client — picks up env var at request time, not module load
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ── Filter interface covering ALL structured property fields ──
interface SearchFilters {
  // Location
  country?: string;
  city?: string;
  district?: string;

  // Price
  minPrice?: number;
  maxPrice?: number;

  // Rooms & size
  bedrooms?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  bathrooms?: number;
  minArea?: number;
  maxArea?: number;

  // Property characteristics
  propertyType?: string;
  status?: string;           // OFF_PLAN, NEW_BUILD, RESALE
  furnishingStatus?: string; // UNFURNISHED, SEMI_FURNISHED, FULLY_FURNISHED
  ownershipType?: string;    // FREEHOLD, LEASEHOLD

  // Amenities (boolean)
  hasPool?: boolean;
  hasGym?: boolean;
  hasGarden?: boolean;
  hasBalcony?: boolean;
  hasSecurity?: boolean;
  hasElevator?: boolean;
  hasCentralAC?: boolean;
  hasParking?: boolean;      // parkingSpaces > 0

  // Investment goals
  goal?: string;
  isGoldenVisaEligible?: boolean;
  minROI?: number;
  minRentalYield?: number;
  maxDownPayment?: number;   // percentage
  mortgageAvailable?: boolean;

  // Featured / special
  featured?: boolean;

  // Sorting
  sortBy?: string; // price_asc, price_desc, roi, rentalYield, newest, area
}

// ── Claude AI filter extraction ──
const CLAUDE_SYSTEM_PROMPT = `You are a property search filter extractor for PropGroup, a Lebanon-focused real estate platform.
Extract structured filters from natural language property queries. Return ONLY a valid JSON object, no explanations.

Available enum values:
- country: LEBANON
- city: Beirut, Jounieh, Byblos, Tripoli, Sidon, Tyre, Zahle
- district: Achrafieh, Hamra, Verdun, Downtown, Gemmayzeh, Mar Mikhael, Ras Beirut
- status: OFF_PLAN, NEW_BUILD, RESALE
- propertyType: APARTMENT, VILLA, PENTHOUSE, STUDIO, TOWNHOUSE, DUPLEX, COMMERCIAL, OFFICE, LAND
- furnishingStatus: UNFURNISHED, SEMI_FURNISHED, FULLY_FURNISHED
- ownershipType: FREEHOLD, LEASEHOLD
- goal: GOLDEN_VISA, HIGH_ROI, PASSIVE_INCOME
- sortBy: price_asc, price_desc, roi, rentalYield, newest, area

Available JSON fields (include ONLY what the query mentions or implies):
{
  "country", "city", "district",
  "minPrice", "maxPrice",
  "bedrooms", "minBedrooms", "maxBedrooms", "bathrooms",
  "minArea", "maxArea",
  "propertyType", "status", "furnishingStatus", "ownershipType",
  "hasPool", "hasGym", "hasGarden", "hasBalcony", "hasSecurity", "hasElevator", "hasCentralAC", "hasParking",
  "goal", "isGoldenVisaEligible", "minROI", "minRentalYield", "maxDownPayment", "mortgageAvailable",
  "featured", "sortBy"
}

Rules:
- Convert "300k" or "$300,000" to 300000
- "ROI > 15%" → minROI: 15
- "yield above 8%" → minRentalYield: 8
- "with pool" or "swimming pool" → hasPool: true
- "furnished" → furnishingStatus: "FULLY_FURNISHED", "unfurnished" → "UNFURNISHED"
- "parking" → hasParking: true
- "cheap" or "affordable" or "budget" → sortBy: "price_asc"
- "luxury" or "premium" or "high-end" → imply higher price range if no price given
- "best deal" or "best value" → sortBy: "roi"
- "new" → status: "NEW_BUILD", "off-plan" or "pre-construction" → status: "OFF_PLAN"
- "ready to move" or "move-in ready" → status: "NEW_BUILD" or "RESALE" (prefer NEW_BUILD)
- "family" → implies minBedrooms: 3
- "investment" → sortBy: "roi"
- "near beach" or "beachfront" or "sea view" → prefer coastal cities like "Jounieh", "Byblos", "Tyre"
- "mortgage" or "bank financing" → mortgageAvailable: true
- If query asks for "best" or "top" properties → featured: true`;

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function parseQueryWithClaude(
  query: string,
  conversationHistory?: ConversationMessage[],
  previousFilters?: Record<string, unknown>,
): Promise<SearchFilters | null> {
  const client = getAnthropic();
  if (!client) return null;

  try {
    // Build messages array with conversation context
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    if (conversationHistory && conversationHistory.length > 0 && previousFilters) {
      // Include conversation context so Claude understands follow-ups
      const contextMsg = `Previous conversation:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}

Previous filters: ${JSON.stringify(previousFilters)}

The user now says: "${query}"

IMPORTANT: You must return a NEW complete JSON filter object that reflects ALL constraints — both from the previous filters AND from this new message.
- "below 100k" or "under 100k" → maxPrice: 100000
- "highest ROI" or "best return" → sortBy: "roi"
- "cheapest" → sortBy: "price_asc"
- "only off-plan" → status: "OFF_PLAN"
- "with pool" → hasPool: true
Do NOT just repeat previous filters unchanged — actually parse the new query for new constraints and merge them.

Return ONLY the JSON object.`;
      messages.push({ role: 'user', content: contextMsg });
    } else {
      messages.push({ role: 'user', content: `Query: "${query}"\n\nReturn ONLY the JSON object.` });
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: CLAUDE_SYSTEM_PROMPT,
      messages,
    });

    const text = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonText);

    // Auto-set sortBy when goal is set but sortBy isn't
    if (parsed.goal === 'HIGH_ROI' && !parsed.sortBy) parsed.sortBy = 'roi';
    if (parsed.goal === 'PASSIVE_INCOME' && !parsed.sortBy) parsed.sortBy = 'rentalYield';

    return parsed;
  } catch (err) {
    logger.error('AI search: Claude parsing failed', err);
    return null;
  }
}

// ── Regex fallback when AI is unavailable ──
function parseNaturalLanguageQuery(query: string): SearchFilters {
  const filters: SearchFilters = {};
  const q = query.toLowerCase();

  // Countries
  if (q.includes('lebanon')) filters.country = 'LEBANON';

  // Cities
  const cities: Record<string, string> = {
    beirut: 'Beirut',
    jounieh: 'Jounieh',
    jbeil: 'Byblos',
    byblos: 'Byblos',
    tripoli: 'Tripoli',
    saida: 'Sidon',
    sidon: 'Sidon',
    tyre: 'Tyre',
    sour: 'Tyre',
    zahle: 'Zahle',
  };
  for (const [key, value] of Object.entries(cities)) {
    if (q.includes(key)) { filters.city = value; if (!filters.country) filters.country = 'LEBANON'; break; }
  }

  // Districts
  const districts: Record<string, string> = {
    achrafieh: 'Achrafieh',
    ashrafieh: 'Achrafieh',
    hamra: 'Hamra',
    verdun: 'Verdun',
    downtown: 'Downtown',
    'beirut downtown': 'Downtown',
    gemmayzeh: 'Gemmayzeh',
    gemmayseh: 'Gemmayzeh',
    'mar mikhael': 'Mar Mikhael',
    'ras beirut': 'Ras Beirut',
  };
  for (const [key, value] of Object.entries(districts)) {
    if (q.includes(key)) { filters.district = value; break; }
  }

  // Beach / sea
  if (q.includes('beach') || q.includes('sea view') || q.includes('beachfront')) {
    if (!filters.city) filters.city = 'Jounieh';
    if (!filters.country) filters.country = 'LEBANON';
  }

  // Property types
  const types: Record<string, string> = {
    apartment: 'APARTMENT', villa: 'VILLA', penthouse: 'PENTHOUSE', studio: 'STUDIO',
    townhouse: 'TOWNHOUSE', duplex: 'DUPLEX', commercial: 'COMMERCIAL', office: 'OFFICE', land: 'LAND',
  };
  for (const [key, value] of Object.entries(types)) {
    if (q.includes(key)) { filters.propertyType = value; break; }
  }

  // Price
  const pricePatterns = [
    { pattern: /(?:between|from)\s*\$?([0-9,]+)\s*k?\s*(?:and|to|-)\s*\$?([0-9,]+)\s*k?/i, type: 'range' as const },
    { pattern: /\$([0-9,]+)\s*k?\s*(?:to|-)\s*\$?([0-9,]+)\s*k?/i, type: 'range' as const },
    { pattern: /(?:under|below|less than|max|maximum|up to)\s*\$?([0-9,]+)\s*k?/i, type: 'max' as const },
    { pattern: /(?:above|over|more than|min|minimum|at least)\s*\$?([0-9,]+)\s*k?/i, type: 'min' as const },
  ];
  for (const { pattern, type } of pricePatterns) {
    const match = q.match(pattern);
    if (match) {
      const hasK = /k\b/i.test(match[0]) || q.includes('thousand');
      if (type === 'range') {
        let min = parseInt(match[1].replace(/,/g, '')), max = parseInt(match[2].replace(/,/g, ''));
        if (hasK || min < 1000) { min *= 1000; max *= 1000; }
        filters.minPrice = min; filters.maxPrice = max;
      } else {
        let price = parseInt(match[1].replace(/,/g, ''));
        if (hasK || price < 1000) price *= 1000;
        if (type === 'max') filters.maxPrice = price; else filters.minPrice = price;
      }
      break;
    }
  }

  // Bedrooms
  const bedMatch = q.match(/(\d+)(?:\s*(?:-|to)\s*(\d+))?\s*(?:bed|bedroom|br|bd)/i);
  if (bedMatch) {
    if (bedMatch[2]) { filters.minBedrooms = parseInt(bedMatch[1]); filters.maxBedrooms = parseInt(bedMatch[2]); }
    else filters.bedrooms = parseInt(bedMatch[1]);
  }
  if (q.includes('family') && !filters.bedrooms && !filters.minBedrooms) filters.minBedrooms = 3;

  // Bathrooms
  const bathMatch = q.match(/(\d+)\s*(?:bath|bathroom)/i);
  if (bathMatch) filters.bathrooms = parseInt(bathMatch[1]);

  // Area
  const areaMatch = q.match(/(?:above|over|more than|at least|min)\s*(\d+)\s*(?:sqm|sq\.?\s*m|square\s*met)/i);
  if (areaMatch) filters.minArea = parseInt(areaMatch[1]);
  const areaMaxMatch = q.match(/(?:under|below|less than|max|up to)\s*(\d+)\s*(?:sqm|sq\.?\s*m|square\s*met)/i);
  if (areaMaxMatch) filters.maxArea = parseInt(areaMaxMatch[1]);

  // Status
  if (q.includes('off plan') || q.includes('off-plan') || q.includes('pre-construction')) filters.status = 'OFF_PLAN';
  else if (q.includes('new build') || q.includes('newly built')) filters.status = 'NEW_BUILD';
  else if (q.includes('resale') || q.includes('second hand')) filters.status = 'RESALE';

  // Furnishing
  if (q.includes('unfurnished')) filters.furnishingStatus = 'UNFURNISHED';
  else if (q.includes('semi furnished') || q.includes('semi-furnished')) filters.furnishingStatus = 'SEMI_FURNISHED';
  else if (q.includes('furnished') || q.includes('move-in ready') || q.includes('ready to move')) filters.furnishingStatus = 'FULLY_FURNISHED';

  // Amenities
  if (q.includes('pool') || q.includes('swimming')) filters.hasPool = true;
  if (q.includes('gym') || q.includes('fitness')) filters.hasGym = true;
  if (q.includes('garden') || q.includes('yard')) filters.hasGarden = true;
  if (q.includes('balcony') || q.includes('terrace')) filters.hasBalcony = true;
  if (q.includes('security') || q.includes('secure') || q.includes('gated')) filters.hasSecurity = true;
  if (q.includes('elevator') || q.includes('lift')) filters.hasElevator = true;
  if (q.includes('ac') || q.includes('air condition') || q.includes('central cooling')) filters.hasCentralAC = true;
  if (q.includes('parking') || q.includes('garage')) filters.hasParking = true;

  // Investment goals
  if (q.includes('golden visa') || q.includes('residency')) {
    filters.goal = 'GOLDEN_VISA'; filters.isGoldenVisaEligible = true;
  }
  if (q.includes('roi') || q.includes('highest return') || q.includes('best return') || q.includes('best investment')) {
    filters.goal = 'HIGH_ROI'; filters.sortBy = 'roi';
    const roiMatch = q.match(/roi\s*(?:>|above|over|more than|at least)\s*(\d+(?:\.\d+)?)\s*%?/);
    if (roiMatch) filters.minROI = parseFloat(roiMatch[1]);
  }
  if (q.includes('rental') || q.includes('passive income') || q.includes('yield')) {
    filters.goal = 'PASSIVE_INCOME'; filters.sortBy = 'rentalYield';
    const yieldMatch = q.match(/(?:yield|rental)\s*(?:>|above|over|more than|at least)\s*(\d+(?:\.\d+)?)\s*%?/);
    if (yieldMatch) filters.minRentalYield = parseFloat(yieldMatch[1]);
  }

  // Mortgage
  if (q.includes('mortgage') || q.includes('bank financ') || q.includes('loan')) filters.mortgageAvailable = true;

  // Sorting
  if (q.includes('cheap') || q.includes('affordable') || q.includes('budget') || q.includes('lowest price')) {
    filters.sortBy = 'price_asc';
  }
  if (q.includes('featured') || q.includes('top pick') || q.includes('recommended')) filters.featured = true;

  return filters;
}

// ── Build Prisma where clause from filters ──
// Note: Building model doesn't have bedrooms/bathrooms/area/propertyType/furnishingStatus/ownershipType —
// those live on Unit. Filters that don't map to Building are silently ignored here;
// a full listing-search endpoint handles unit-level filtering.
function buildWhereClause(filters: SearchFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {
    visibility: 'PUBLIC',
  };

  // Location
  if (filters.country) where.country = filters.country;
  if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
  if (filters.district) where.neighborhood = { contains: filters.district, mode: 'insensitive' };

  // Building-level amenities
  if (filters.hasPool) where.hasPool = true;
  if (filters.hasGym) where.hasGym = true;
  if (filters.hasGarden) where.hasGarden = true;
  if (filters.hasSecurity) where.hasSecurity = true;
  if (filters.hasElevator) where.hasElevator = true;
  if (filters.hasParking) where.parkingSpaces = { gte: 1 };

  // Status maps to Building.status (OFF_PLAN, NEW_BUILD, RESALE)
  if (filters.status) where.status = filters.status;

  // Featured
  if (filters.featured) {
    where.featured = true;
    where.featuredUntil = { gte: new Date() };
  }

  // Investment data filters (ROI, yield, mortgage, down payment)
  const investmentFilter: Record<string, unknown> = {};
  if (filters.minROI) investmentFilter.expectedROI = { gte: filters.minROI };
  if (filters.minRentalYield) investmentFilter.rentalYield = { gte: filters.minRentalYield };
  if (filters.mortgageAvailable) investmentFilter.mortgageAvailable = true;
  if (filters.maxDownPayment) investmentFilter.downPaymentPercentage = { lte: filters.maxDownPayment };
  if (Object.keys(investmentFilter).length > 0) where.investmentData = investmentFilter;

  return where;
}

// ── Build Prisma orderBy from filters ──
function buildOrderBy(filters: SearchFilters) {
  const orderBy: Record<string, unknown>[] = [];

  switch (filters.sortBy) {
    case 'roi':
      orderBy.push({ investmentData: { expectedROI: 'desc' } });
      break;
    case 'rentalYield':
      orderBy.push({ investmentData: { rentalYield: 'desc' } });
      break;
    case 'newest':
      orderBy.push({ createdAt: 'desc' });
      break;
    // price_asc / price_desc / area don't map to Building fields — fall through to createdAt
    default:
      break;
  }

  // Always add a secondary sort for consistency
  if (filters.sortBy !== 'newest') orderBy.push({ createdAt: 'desc' });

  return orderBy;
}

// ── Summaries ──
function generateFallbackSummary(filters: SearchFilters, count: number): string {
  if (count === 0) return "I couldn't find any properties matching your criteria. Try broadening your search or removing some filters.";

  const criteria: string[] = [];

  if (filters.bedrooms) criteria.push(`${filters.bedrooms}-bedroom`);
  else if (filters.minBedrooms && filters.maxBedrooms) criteria.push(`${filters.minBedrooms}-${filters.maxBedrooms} bedroom`);
  else if (filters.minBedrooms) criteria.push(`${filters.minBedrooms}+ bedroom`);

  if (filters.propertyType) criteria.push(filters.propertyType.toLowerCase().replace('_', ' '));

  if (filters.district && filters.city) criteria.push(`in ${filters.district}, ${filters.city}`);
  else if (filters.city) criteria.push(`in ${filters.city}`);
  else if (filters.country) criteria.push(`in ${filters.country.charAt(0) + filters.country.slice(1).toLowerCase()}`);

  if (filters.minPrice && filters.maxPrice) criteria.push(`between $${filters.minPrice.toLocaleString()} and $${filters.maxPrice.toLocaleString()}`);
  else if (filters.maxPrice) criteria.push(`under $${filters.maxPrice.toLocaleString()}`);
  else if (filters.minPrice) criteria.push(`above $${filters.minPrice.toLocaleString()}`);

  if (filters.status) criteria.push(filters.status.toLowerCase().replace('_', '-'));
  if (filters.furnishingStatus) criteria.push(filters.furnishingStatus.toLowerCase().replace(/_/g, ' '));

  // Amenities
  const amenities: string[] = [];
  if (filters.hasPool) amenities.push('pool');
  if (filters.hasGym) amenities.push('gym');
  if (filters.hasGarden) amenities.push('garden');
  if (filters.hasBalcony) amenities.push('balcony');
  if (filters.hasParking) amenities.push('parking');
  if (filters.hasSecurity) amenities.push('security');
  if (amenities.length > 0) criteria.push(`with ${amenities.join(', ')}`);

  // Investment
  if (filters.goal === 'GOLDEN_VISA') criteria.push('eligible for Golden Visa');
  if (filters.goal === 'HIGH_ROI') criteria.push(filters.minROI ? `ROI above ${filters.minROI}%` : 'high ROI');
  if (filters.goal === 'PASSIVE_INCOME') criteria.push('strong rental income');
  if (filters.minRentalYield) criteria.push(`rental yield above ${filters.minRentalYield}%`);
  if (filters.mortgageAvailable) criteria.push('mortgage available');

  const label = count === 1 ? 'property' : 'properties';
  return criteria.length > 0
    ? `I found ${count} ${label} matching: ${criteria.join(', ')}.`
    : `I found ${count} ${label} that match your search.`;
}

async function generateAISummary(
  query: string,
  filters: SearchFilters,
  count: number,
  properties: any[],
  conversationHistory?: ConversationMessage[],
): Promise<string> {
  const client = getAnthropic();
  if (!client) return generateFallbackSummary(filters, count);

  try {
    // Build a brief building summary so AI can reference actual results
    const propertySnippets = properties.slice(0, 6).map((p: any, i: number) => {
      const roi = p.investmentData?.expectedROI;
      const yield_ = p.investmentData?.rentalYield;
      return `${i + 1}. ${p.title} — ${p.city || ''}${roi ? `, ROI ${roi}%` : ''}${yield_ ? `, yield ${yield_}%` : ''}`;
    }).join('\n');

    const isFollowUp = conversationHistory && conversationHistory.length > 0;
    const conversationContext = isFollowUp
      ? `\nPrevious conversation:\n${conversationHistory!.map(m => `${m.role}: ${m.content}`).join('\n')}\n`
      : '';

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are a helpful real estate assistant for PropGroup (Lebanon-focused real estate platform).
${isFollowUp ? 'This is a follow-up question in an ongoing conversation.' : 'This is a new search.'}
Write a concise, helpful response (2-3 sentences). Be specific about what was found. Reference actual property names or details when relevant. No emojis. No markdown.
If 0 results, suggest broadening the search or trying different criteria.
If the user asked a question about the results (e.g. "which has a pool?", "tell me about the cheapest one"), answer it directly.
${conversationContext}
User query: "${query}"
Filters applied: ${JSON.stringify(filters)}
Results found: ${count}
${count > 0 ? `Top results:\n${propertySnippets}` : ''}`,
      }],
    });

    return (message.content[0] as { type: string; text: string }).text.trim();
  } catch (err) {
    logger.error('AI search: Claude summary failed', err);
    return generateFallbackSummary(filters, count);
  }
}

// ── Routes ──

// POST /api/ai-search
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { query, conversationHistory, previousFilters } = aiSearchSchema.parse(req.body);

    let filters = await parseQueryWithClaude(query, conversationHistory, previousFilters as Record<string, unknown> | undefined);
    const aiPowered = filters !== null;
    if (!filters) filters = parseNaturalLanguageQuery(query);

    const where = buildWhereClause(filters);
    const orderBy = buildOrderBy(filters);

    const properties = await prisma.building.findMany({
      where,
      include: PROPERTY_LIST_INCLUDE,
      orderBy,
      take: 50,
    });

    const summary = await generateAISummary(query, filters, properties.length, properties, conversationHistory);

    sendSuccess(res, {
      query,
      filters,
      summary,
      properties,
      count: properties.length,
      aiPowered,
    });
  })
);

// GET /api/ai-search/suggestions
router.get(
  '/suggestions',
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, [
      { text: '2-bedroom apartment in Beirut under $150k', category: 'Popular', icon: 'home' },
      { text: 'High ROI properties above 10%', category: 'Investment', icon: 'trending-up' },
      { text: 'Off-plan projects with payment plans', category: 'New Build', icon: 'building' },
      { text: 'Sea view apartments in Jounieh', category: 'Lifestyle', icon: 'shield' },
      { text: 'Furnished apartment with parking in Achrafieh', category: 'Lifestyle', icon: 'dollar-sign' },
      { text: 'Family home near schools with parking', category: 'Family', icon: 'star' },
    ]);
  })
);

export default router;
