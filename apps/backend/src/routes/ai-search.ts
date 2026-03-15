import express, { type Request, type Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@propgroup/db';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { PROPERTY_LIST_INCLUDE } from '../utils/prisma-includes.js';
import { aiSearchSchema } from '../schemas/index.js';

const router = express.Router();

// Initialize Google Gemini AI
const genAI = process.env.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
  : null;

interface SearchFilters {
  country?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  bathrooms?: number;
  status?: string;
  goal?: string;
  isGoldenVisaEligible?: boolean;
  sortBy?: string;
  propertyType?: string;
}

// Natural language query parser (fallback when Gemini is unavailable)
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

  // Price
  const pricePatterns = [
    { pattern: /(?:under|below|less than|max|maximum)\s*\$?([0-9,]+)k?/i, type: 'max' as const },
    { pattern: /(?:above|over|more than|min|minimum)\s*\$?([0-9,]+)k?/i, type: 'min' as const },
    { pattern: /between\s*\$?([0-9,]+)k?\s*(?:and|to|-)\s*\$?([0-9,]+)k?/i, type: 'range' as const },
  ];

  for (const { pattern, type } of pricePatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      const hasK = lowerQuery.includes('k') || lowerQuery.includes('thousand');
      if (type === 'range') {
        let min = parseInt(match[1].replace(/,/g, '')), max = parseInt(match[2].replace(/,/g, ''));
        if (hasK) { min *= 1000; max *= 1000; }
        filters.minPrice = min; filters.maxPrice = max;
      } else {
        let price = parseInt(match[1].replace(/,/g, ''));
        if (hasK) price *= 1000;
        if (type === 'max') filters.maxPrice = price; else filters.minPrice = price;
      }
      break;
    }
  }

  // Bedrooms
  const bedMatch = lowerQuery.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:bed|bedroom|br)/i);
  if (bedMatch) {
    if (bedMatch[2]) { filters.minBedrooms = parseInt(bedMatch[1]); filters.maxBedrooms = parseInt(bedMatch[2]); }
    else filters.bedrooms = parseInt(bedMatch[1]);
  }

  // Goals
  if (lowerQuery.includes('golden visa') || lowerQuery.includes('residency')) {
    filters.goal = 'GOLDEN_VISA'; filters.isGoldenVisaEligible = true;
  }
  if (lowerQuery.includes('roi') || lowerQuery.includes('highest return')) {
    filters.goal = 'HIGH_ROI'; filters.sortBy = 'roi';
  }
  if (lowerQuery.includes('rental') || lowerQuery.includes('passive income')) {
    filters.goal = 'PASSIVE_INCOME'; filters.sortBy = 'rentalYield';
  }

  // Status
  if (lowerQuery.includes('off plan') || lowerQuery.includes('off-plan')) filters.status = 'OFF_PLAN';
  else if (lowerQuery.includes('new build')) filters.status = 'NEW_BUILD';
  else if (lowerQuery.includes('resale')) filters.status = 'RESALE';

  return filters;
}

function buildWhereClause(filters: SearchFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};

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

  return where;
}

function buildOrderBy(filters: SearchFilters) {
  const orderBy: Record<string, unknown>[] = [];
  if (filters.sortBy === 'roi') orderBy.push({ investmentData: { expectedROI: 'desc' } });
  else if (filters.sortBy === 'rentalYield') orderBy.push({ investmentData: { rentalYield: 'desc' } });
  orderBy.push({ createdAt: 'desc' });
  return orderBy;
}

async function parseQueryWithGemini(query: string): Promise<SearchFilters | null> {
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `You are a property search filter parser. Extract search criteria from the user's natural language query and return ONLY a valid JSON object (no markdown, no code blocks, just raw JSON).

Available countries: GEORGIA, CYPRUS, GREECE, LEBANON
Available property statuses: OFF_PLAN, NEW_BUILD, RESALE

User query: "${query}"

Return a JSON object with these possible fields (only include fields mentioned in the query):
{ "country": "COUNTRY_CODE", "minPrice": number, "maxPrice": number, "bedrooms": number, "minBedrooms": number, "maxBedrooms": number, "bathrooms": number, "status": "STATUS", "goal": "GOLDEN_VISA|HIGH_ROI|PASSIVE_INCOME", "isGoldenVisaEligible": boolean, "sortBy": "price|roi|rentalYield" }

For prices like "300k", convert to 300000. Return ONLY the JSON object.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function generateFallbackSummary(filters: SearchFilters, count: number): string {
  if (count === 0) return "I couldn't find any properties matching your criteria. Try adjusting your requirements.";

  const parts = [`I found ${count} ${count === 1 ? 'property' : 'properties'} matching your search`];
  const criteria: string[] = [];

  if (filters.bedrooms) criteria.push(`${filters.bedrooms} bedroom${filters.bedrooms > 1 ? 's' : ''}`);
  if (filters.country) criteria.push(`in ${filters.country.charAt(0) + filters.country.slice(1).toLowerCase()}`);
  if (filters.maxPrice) criteria.push(`under $${filters.maxPrice.toLocaleString()}`);
  else if (filters.minPrice) criteria.push(`above $${filters.minPrice.toLocaleString()}`);
  if (filters.goal === 'GOLDEN_VISA') criteria.push('eligible for Golden Visa programs');

  if (criteria.length > 0) parts.push(`with: ${criteria.join(', ')}`);
  return `${parts.join(' ')}.`;
}

async function generateAISummary(query: string, filters: SearchFilters, count: number): Promise<string> {
  if (!genAI) return generateFallbackSummary(filters, count);

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `You are a friendly real estate assistant. Generate a concise response (2-3 sentences max) about property search results.
User searched for: "${query}"
Filters: ${JSON.stringify(filters)}
Properties found: ${count}
Keep it brief and friendly. No emojis.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return generateFallbackSummary(filters, count);
  }
}

// POST /api/ai-search - AI-powered property search
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { query } = aiSearchSchema.parse(req.body);

    let filters = await parseQueryWithGemini(query);
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
      aiPowered: genAI !== null,
    });
  })
);

// GET /api/ai-search/suggestions
router.get(
  '/suggestions',
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, [
      { text: '3-bedroom apartment in Cyprus under $300k', category: 'Popular', icon: 'home' },
      { text: 'Properties with highest ROI in Greece', category: 'Investment', icon: 'trending-up' },
      { text: 'Golden Visa eligible properties', category: 'Residency', icon: 'shield' },
      { text: 'New build properties in Georgia', category: 'Status', icon: 'building' },
      { text: 'Apartments with good rental yield', category: 'Income', icon: 'dollar-sign' },
      { text: 'Luxury villas between $500k and $1M', category: 'Luxury', icon: 'star' },
    ]);
  })
);

export default router;
