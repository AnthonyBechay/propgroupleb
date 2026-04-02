import express, { type Request, type Response, type Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@propgroup/db';
import { asyncHandler } from '../utils/errors.js';
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
    console.log('[ai-search] Anthropic client initialized');
  }
  return _anthropic;
}

interface SearchFilters {
  country?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  bathrooms?: number;
  status?: string;
  propertyType?: string;
  goal?: string;
  isGoldenVisaEligible?: boolean;
  sortBy?: string;
}

// Regex fallback when AI is unavailable
function parseNaturalLanguageQuery(query: string): SearchFilters {
  const filters: SearchFilters = {};
  const lowerQuery = query.toLowerCase();

  // Countries
  const countries: Record<string, string> = {
    georgia: 'GEORGIA', cyprus: 'CYPRUS', greece: 'GREECE', lebanon: 'LEBANON',
  };
  for (const [key, value] of Object.entries(countries)) {
    if (lowerQuery.includes(key)) { filters.country = value; break; }
  }

  // Cities
  const cities: Record<string, string> = {
    tbilisi: 'Tbilisi', batumi: 'Batumi', kutaisi: 'Kutaisi', gudauri: 'Gudauri', bakuriani: 'Bakuriani',
  };
  for (const [key, value] of Object.entries(cities)) {
    if (lowerQuery.includes(key)) { filters.city = value; if (!filters.country) filters.country = 'GEORGIA'; break; }
  }

  // Property types
  const propertyTypes: Record<string, string> = {
    apartment: 'APARTMENT', villa: 'VILLA', penthouse: 'PENTHOUSE', studio: 'STUDIO',
    townhouse: 'TOWNHOUSE', duplex: 'DUPLEX', commercial: 'COMMERCIAL', office: 'OFFICE', land: 'LAND',
  };
  for (const [key, value] of Object.entries(propertyTypes)) {
    if (lowerQuery.includes(key)) { filters.propertyType = value; break; }
  }

  // Price
  const pricePatterns = [
    { pattern: /(?:under|below|less than|max|maximum|up to)\s*\$?([0-9,]+)\s*k?/i, type: 'max' as const },
    { pattern: /(?:above|over|more than|min|minimum|at least)\s*\$?([0-9,]+)\s*k?/i, type: 'min' as const },
    { pattern: /(?:between|from)\s*\$?([0-9,]+)\s*k?\s*(?:and|to|-)\s*\$?([0-9,]+)\s*k?/i, type: 'range' as const },
    { pattern: /\$([0-9,]+)\s*k?\s*(?:to|-)\s*\$?([0-9,]+)\s*k?/i, type: 'range' as const },
  ];

  for (const { pattern, type } of pricePatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      const hasK = /k\b/i.test(match[0]) || lowerQuery.includes('thousand');
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
  const bedMatch = lowerQuery.match(/(\d+)(?:\s*(?:-|to)\s*(\d+))?\s*(?:bed|bedroom|br|bd)/i);
  if (bedMatch) {
    if (bedMatch[2]) { filters.minBedrooms = parseInt(bedMatch[1]); filters.maxBedrooms = parseInt(bedMatch[2]); }
    else filters.bedrooms = parseInt(bedMatch[1]);
  }

  // Goals
  if (lowerQuery.includes('golden visa') || lowerQuery.includes('residency')) {
    filters.goal = 'GOLDEN_VISA'; filters.isGoldenVisaEligible = true;
  }
  if (lowerQuery.includes('roi') || lowerQuery.includes('highest return') || lowerQuery.includes('best return')) {
    filters.goal = 'HIGH_ROI'; filters.sortBy = 'roi';
  }
  if (lowerQuery.includes('rental') || lowerQuery.includes('passive income') || lowerQuery.includes('yield')) {
    filters.goal = 'PASSIVE_INCOME'; filters.sortBy = 'rentalYield';
  }

  // Status
  if (lowerQuery.includes('off plan') || lowerQuery.includes('off-plan')) filters.status = 'OFF_PLAN';
  else if (lowerQuery.includes('new build')) filters.status = 'NEW_BUILD';
  else if (lowerQuery.includes('resale')) filters.status = 'RESALE';

  return filters;
}

function buildWhereClause(filters: SearchFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {
    visibility: 'PUBLIC',
    availabilityStatus: { not: 'SOLD' },
  };

  if (filters.country) where.country = filters.country;
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const price: Record<string, number> = {};
    if (filters.minPrice !== undefined) price.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) price.lte = filters.maxPrice;
    where.price = price;
  }
  if (filters.bedrooms !== undefined) where.bedrooms = filters.bedrooms;
  else if (filters.minBedrooms !== undefined || filters.maxBedrooms !== undefined) {
    const bedrooms: Record<string, number> = {};
    if (filters.minBedrooms !== undefined) bedrooms.gte = filters.minBedrooms;
    if (filters.maxBedrooms !== undefined) bedrooms.lte = filters.maxBedrooms;
    where.bedrooms = bedrooms;
  }
  if (filters.isGoldenVisaEligible) where.isGoldenVisaEligible = true;
  if (filters.status) where.status = filters.status;
  if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
  if (filters.propertyType) where.propertyType = filters.propertyType;

  return where;
}

function buildOrderBy(filters: SearchFilters) {
  const orderBy: Record<string, unknown>[] = [];
  if (filters.sortBy === 'roi') orderBy.push({ investmentData: { expectedROI: 'desc' } });
  else if (filters.sortBy === 'rentalYield') orderBy.push({ investmentData: { rentalYield: 'desc' } });
  orderBy.push({ createdAt: 'desc' });
  return orderBy;
}

async function parseQueryWithClaude(query: string): Promise<SearchFilters | null> {
  const client = getAnthropic();
  if (!client) return null;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Extract property search filters from this query. Return ONLY a JSON object, no other text.

Available values:
- country: GEORGIA, CYPRUS, GREECE, LEBANON
- city: Tbilisi, Batumi, Kutaisi, Gudauri, Bakuriani (if a Georgian city is mentioned, also set country to GEORGIA)
- status: OFF_PLAN, NEW_BUILD, RESALE
- propertyType: APARTMENT, VILLA, PENTHOUSE, STUDIO, TOWNHOUSE, DUPLEX, COMMERCIAL, OFFICE, LAND
- goal: GOLDEN_VISA, HIGH_ROI, PASSIVE_INCOME
- sortBy: price, roi, rentalYield

Query: "${query}"

JSON fields (only include what's mentioned): { "country", "city", "minPrice", "maxPrice", "bedrooms", "minBedrooms", "maxBedrooms", "bathrooms", "status", "propertyType", "goal", "isGoldenVisaEligible", "sortBy" }
Convert prices like "300k" to 300000. Return ONLY the JSON.`,
      }],
    });

    const text = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonText);
  } catch (err) {
    console.error('[ai-search] Claude parsing failed:', err);
    return null;
  }
}

function generateFallbackSummary(filters: SearchFilters, count: number): string {
  if (count === 0) return "I couldn't find any properties matching your criteria. Try broadening your search.";

  const parts = [`I found ${count} ${count === 1 ? 'property' : 'properties'}`];
  const criteria: string[] = [];

  if (filters.bedrooms) criteria.push(`${filters.bedrooms} bedroom${filters.bedrooms > 1 ? 's' : ''}`);
  if (filters.minBedrooms && filters.maxBedrooms) criteria.push(`${filters.minBedrooms}-${filters.maxBedrooms} bedrooms`);
  if (filters.propertyType) criteria.push(filters.propertyType.toLowerCase().replace('_', ' '));
  if (filters.city) criteria.push(`in ${filters.city}`);
  else if (filters.country) criteria.push(`in ${filters.country.charAt(0) + filters.country.slice(1).toLowerCase()}`);
  if (filters.maxPrice) criteria.push(`under $${filters.maxPrice.toLocaleString()}`);
  else if (filters.minPrice) criteria.push(`above $${filters.minPrice.toLocaleString()}`);
  if (filters.status) criteria.push(filters.status.toLowerCase().replace('_', ' '));
  if (filters.goal === 'GOLDEN_VISA') criteria.push('eligible for Golden Visa');

  if (criteria.length > 0) parts[0] += ` matching: ${criteria.join(', ')}`;
  return `${parts.join(' ')}.`;
}

async function generateAISummary(query: string, filters: SearchFilters, count: number): Promise<string> {
  const client = getAnthropic();
  if (!client) return generateFallbackSummary(filters, count);

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `You are a friendly real estate assistant for PropGroup (Georgia-focused investment platform). Write a 1-2 sentence response about search results. Be concise and helpful. No emojis.

Search: "${query}"
Filters applied: ${JSON.stringify(filters)}
Results found: ${count}`,
      }],
    });

    return (message.content[0] as { type: string; text: string }).text.trim();
  } catch (err) {
    console.error('[ai-search] Claude summary failed:', err);
    return generateFallbackSummary(filters, count);
  }
}

// POST /api/ai-search
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { query } = aiSearchSchema.parse(req.body);

    let filters = await parseQueryWithClaude(query);
    const aiPowered = filters !== null;
    if (!filters) filters = parseNaturalLanguageQuery(query);

    const where = buildWhereClause(filters);
    const orderBy = buildOrderBy(filters);

    const properties = await prisma.property.findMany({
      where,
      include: PROPERTY_LIST_INCLUDE,
      orderBy,
      take: 50,
    });

    const summary = await generateAISummary(query, filters, properties.length);

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
      { text: '2-bedroom apartment in Batumi under $100k', category: 'Popular', icon: 'home' },
      { text: 'Properties with highest ROI in Tbilisi', category: 'Investment', icon: 'trending-up' },
      { text: 'Off-plan projects in Batumi with payment plans', category: 'New Build', icon: 'building' },
      { text: 'Golden Visa eligible properties in Georgia', category: 'Residency', icon: 'shield' },
      { text: 'Apartments with high rental yield near the Black Sea', category: 'Income', icon: 'dollar-sign' },
      { text: 'Luxury villas in Tbilisi under $500k', category: 'Luxury', icon: 'star' },
    ]);
  })
);

export default router;
