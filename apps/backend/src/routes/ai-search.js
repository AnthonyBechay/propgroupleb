import express from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// Initialize Google Gemini AI
const genAI = process.env.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
  : null;

// Validation schema for AI search
const aiSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  context: z.object({
    userId: z.string().optional(),
    previousSearches: z.array(z.string()).optional()
  }).optional()
});

// Natural language query parser
function parseNaturalLanguageQuery(query) {
  const filters = {};
  const lowerQuery = query.toLowerCase();

  // Extract countries
  const countries = {
    'georgia': 'GEORGIA',
    'cyprus': 'CYPRUS',
    'greece': 'GREECE',
    'lebanon': 'LEBANON'
  };

  for (const [key, value] of Object.entries(countries)) {
    if (lowerQuery.includes(key)) {
      filters.country = value;
      break;
    }
  }

  // Extract price range
  const pricePatterns = [
    { pattern: /(?:under|below|less than|max|maximum)\s*\$?([0-9,]+)k?/i, type: 'max' },
    { pattern: /(?:above|over|more than|min|minimum)\s*\$?([0-9,]+)k?/i, type: 'min' },
    { pattern: /between\s*\$?([0-9,]+)k?\s*(?:and|to|-)\s*\$?([0-9,]+)k?/i, type: 'range' }
  ];

  for (const { pattern, type } of pricePatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      if (type === 'range') {
        let min = parseInt(match[1].replace(/,/g, ''));
        let max = parseInt(match[2].replace(/,/g, ''));
        if (lowerQuery.includes('k') || lowerQuery.includes('thousand')) {
          min *= 1000;
          max *= 1000;
        }
        filters.minPrice = min;
        filters.maxPrice = max;
      } else if (type === 'max') {
        let price = parseInt(match[1].replace(/,/g, ''));
        if (lowerQuery.includes('k') || lowerQuery.includes('thousand')) {
          price *= 1000;
        }
        filters.maxPrice = price;
      } else if (type === 'min') {
        let price = parseInt(match[1].replace(/,/g, ''));
        if (lowerQuery.includes('k') || lowerQuery.includes('thousand')) {
          price *= 1000;
        }
        filters.minPrice = price;
      }
      break;
    }
  }

  // Extract bedrooms
  const bedroomMatch = lowerQuery.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:bed|bedroom|br)/i);
  if (bedroomMatch) {
    if (bedroomMatch[2]) {
      // Range: "2-3 bedroom"
      filters.minBedrooms = parseInt(bedroomMatch[1]);
      filters.maxBedrooms = parseInt(bedroomMatch[2]);
    } else {
      filters.bedrooms = parseInt(bedroomMatch[1]);
    }
  }

  // Extract bathrooms
  const bathroomMatch = lowerQuery.match(/(\d+)\s*(?:bath|bathroom)/i);
  if (bathroomMatch) {
    filters.bathrooms = parseInt(bathroomMatch[1]);
  }

  // Extract goals
  if (lowerQuery.includes('golden visa') || lowerQuery.includes('residency') || lowerQuery.includes('citizenship')) {
    filters.goal = 'GOLDEN_VISA';
    filters.isGoldenVisaEligible = true;
  }
  if (lowerQuery.includes('roi') || lowerQuery.includes('return on investment') || lowerQuery.includes('highest return')) {
    filters.goal = 'HIGH_ROI';
    filters.sortBy = 'roi';
  }
  if (lowerQuery.includes('rental') || lowerQuery.includes('passive income') || lowerQuery.includes('rental yield')) {
    filters.goal = 'PASSIVE_INCOME';
    filters.sortBy = 'rentalYield';
  }

  // Extract status
  if (lowerQuery.includes('off plan') || lowerQuery.includes('off-plan')) {
    filters.status = 'OFF_PLAN';
  } else if (lowerQuery.includes('new build') || lowerQuery.includes('new-build') || lowerQuery.includes('newly built')) {
    filters.status = 'NEW_BUILD';
  } else if (lowerQuery.includes('resale') || lowerQuery.includes('existing')) {
    filters.status = 'RESALE';
  }

  // Extract property type (if we had that field)
  const propertyTypes = ['apartment', 'villa', 'house', 'condo', 'penthouse'];
  for (const type of propertyTypes) {
    if (lowerQuery.includes(type)) {
      filters.propertyType = type;
      break;
    }
  }

  return filters;
}

// Build Prisma where clause from filters
function buildWhereClause(filters) {
  const where = {};

  if (filters.country) {
    where.country = filters.country;
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {};
    if (filters.minPrice !== undefined) {
      where.price.gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      where.price.lte = filters.maxPrice;
    }
  }

  if (filters.bedrooms !== undefined) {
    where.bedrooms = filters.bedrooms;
  } else if (filters.minBedrooms !== undefined || filters.maxBedrooms !== undefined) {
    where.bedrooms = {};
    if (filters.minBedrooms !== undefined) {
      where.bedrooms.gte = filters.minBedrooms;
    }
    if (filters.maxBedrooms !== undefined) {
      where.bedrooms.lte = filters.maxBedrooms;
    }
  }

  if (filters.bathrooms !== undefined) {
    where.bathrooms = { gte: filters.bathrooms };
  }

  if (filters.isGoldenVisaEligible) {
    where.isGoldenVisaEligible = true;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

// Build order by clause
function buildOrderBy(filters) {
  const orderBy = [];

  if (filters.sortBy === 'roi') {
    orderBy.push({
      investmentData: {
        expectedROI: 'desc'
      }
    });
  } else if (filters.sortBy === 'rentalYield') {
    orderBy.push({
      investmentData: {
        rentalYield: 'desc'
      }
    });
  }

  // Default sort by creation date
  orderBy.push({ createdAt: 'desc' });

  return orderBy;
}

// Use Google Gemini AI to parse natural language query
async function parseQueryWithGemini(query) {
  if (!genAI) {
    console.log('Gemini API not configured, using fallback parser');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are a property search filter parser. Extract search criteria from the user's natural language query and return ONLY a valid JSON object (no markdown, no code blocks, just raw JSON).

Available countries: GEORGIA, CYPRUS, GREECE, LEBANON
Available property statuses: OFF_PLAN, NEW_BUILD, RESALE
Available goals: GOLDEN_VISA, HIGH_ROI, PASSIVE_INCOME

User query: "${query}"

Return a JSON object with these possible fields (only include fields that are mentioned in the query):
{
  "country": "COUNTRY_CODE",
  "minPrice": number,
  "maxPrice": number,
  "bedrooms": number,
  "minBedrooms": number,
  "maxBedrooms": number,
  "bathrooms": number,
  "status": "STATUS",
  "goal": "GOAL",
  "isGoldenVisaEligible": boolean,
  "sortBy": "price" | "roi" | "rentalYield",
  "propertyType": "apartment" | "villa" | "house" | "condo" | "penthouse"
}

Important:
- For prices like "300k" or "$300k", convert to 300000
- For "under X" or "below X", use maxPrice
- For "above X" or "over X", use minPrice
- For "between X and Y", use both minPrice and maxPrice
- For bedroom ranges like "2-3 bedroom", use minBedrooms and maxBedrooms
- If golden visa or residency is mentioned, set isGoldenVisaEligible to true and goal to GOLDEN_VISA
- If ROI or investment return is mentioned, set goal to HIGH_ROI and sortBy to roi
- If rental or passive income is mentioned, set goal to PASSIVE_INCOME and sortBy to rentalYield

Return ONLY the JSON object, nothing else.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // Remove markdown code blocks if present
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const filters = JSON.parse(jsonText);
    console.log('Gemini parsed filters:', filters);
    return filters;
  } catch (error) {
    console.error('Gemini parsing error:', error);
    return null;
  }
}

// POST /api/ai-search - AI-powered property search
router.post('/', async (req, res) => {
  try {
    const { query, context } = aiSearchSchema.parse(req.body);

    // Try to parse with Gemini AI first, fallback to regex-based parsing
    let filters = await parseQueryWithGemini(query);

    if (!filters) {
      console.log('Using fallback regex parser');
      filters = parseNaturalLanguageQuery(query);
    }

    // Build Prisma query
    const where = buildWhereClause(filters);
    const orderBy = buildOrderBy(filters);

    // Fetch matching properties
    const properties = await prisma.property.findMany({
      where,
      include: {
        developer: true,
        locationGuide: true,
        investmentData: true,
        _count: {
          select: {
            favoriteProperties: true,
            propertyInquiries: true
          }
        }
      },
      orderBy,
      take: 50 // Limit results
    });

    // Generate AI response summary
    const summary = await generateAISummary(query, filters, properties.length);

    res.json({
      success: true,
      data: {
        query,
        filters,
        summary,
        properties,
        count: properties.length,
        aiPowered: genAI !== null
      }
    });

  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid search query',
        details: error.errors
      });
    }

    console.error('AI search error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process AI search'
    });
  }
});

// Generate AI-powered search summary using Gemini
async function generateAISummary(query, filters, count) {
  if (!genAI) {
    return generateSearchSummary(query, filters, count);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are a friendly real estate assistant. Generate a concise, natural response (2-3 sentences max) about property search results.

User searched for: "${query}"
Filters applied: ${JSON.stringify(filters)}
Properties found: ${count}

Generate a helpful, conversational response that:
1. Confirms what they're looking for
2. States how many properties were found
3. If count is 0, suggests they adjust their criteria
4. If count > 0, encourages them to explore the results

Keep it brief and friendly. Don't use emojis.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Gemini summary generation error:', error);
    return generateSearchSummary(query, filters, count);
  }
}

// Fallback: Generate human-readable search summary (when Gemini is not available)
function generateSearchSummary(query, filters, count) {
  const parts = [];

  if (count === 0) {
    return "I couldn't find any properties matching your criteria. Try adjusting your requirements.";
  }

  parts.push(`I found ${count} ${count === 1 ? 'property' : 'properties'} matching your search`);

  const criteria = [];

  if (filters.bedrooms) {
    criteria.push(`${filters.bedrooms} bedroom${filters.bedrooms > 1 ? 's' : ''}`);
  } else if (filters.minBedrooms || filters.maxBedrooms) {
    const range = [];
    if (filters.minBedrooms) range.push(`${filters.minBedrooms}+`);
    if (filters.maxBedrooms) range.push(`up to ${filters.maxBedrooms}`);
    criteria.push(`${range.join(' ')} bedrooms`);
  }

  if (filters.country) {
    criteria.push(`in ${filters.country.charAt(0) + filters.country.slice(1).toLowerCase()}`);
  }

  if (filters.minPrice && filters.maxPrice) {
    criteria.push(`between $${filters.minPrice.toLocaleString()} and $${filters.maxPrice.toLocaleString()}`);
  } else if (filters.maxPrice) {
    criteria.push(`under $${filters.maxPrice.toLocaleString()}`);
  } else if (filters.minPrice) {
    criteria.push(`above $${filters.minPrice.toLocaleString()}`);
  }

  if (filters.goal === 'GOLDEN_VISA') {
    criteria.push('eligible for Golden Visa programs');
  }

  if (filters.status) {
    const statusText = filters.status.replace('_', ' ').toLowerCase();
    criteria.push(`(${statusText})`);
  }

  if (criteria.length > 0) {
    parts.push('with the following criteria:');
    parts.push(criteria.join(', '));
  }

  return parts.join(' ') + '.';
}

// GET /api/ai-search/suggestions - Get search suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const suggestions = [
      {
        text: "3-bedroom apartment in Cyprus under $300k",
        category: "Popular",
        icon: "home"
      },
      {
        text: "Properties with highest ROI in Greece",
        category: "Investment",
        icon: "trending-up"
      },
      {
        text: "Golden Visa eligible properties",
        category: "Residency",
        icon: "shield"
      },
      {
        text: "New build properties in Georgia",
        category: "Status",
        icon: "building"
      },
      {
        text: "Apartments with good rental yield",
        category: "Income",
        icon: "dollar-sign"
      },
      {
        text: "Luxury villas between $500k and $1M",
        category: "Luxury",
        icon: "star"
      }
    ];

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch suggestions'
    });
  }
});

export default router;
