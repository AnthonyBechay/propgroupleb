import { PrismaClient } from '@prisma/client'
import {
  Country,
  PropertyStatus,
  InvestmentGoal,
  Role,
  PropertyType,
  FurnishingStatus,
  OwnershipType,
  PropertyVisibility,
  PropertyAvailabilityStatus,
  MembershipTier,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting comprehensive database seed...\n')

  // ============================================
  // 1. CREATE ADMIN AND TEST USERS
  // ============================================
  console.log('👥 Creating users...')
  const hashedAdminPassword = await bcrypt.hash('Admin123!', 12)
  const hashedUserPassword = await bcrypt.hash('User123!', 12)

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@propgroup.com' },
    update: {},
    create: {
      email: 'admin@propgroup.com',
      password: hashedAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      provider: 'local',
      isActive: true,
      emailVerifiedAt: new Date(),
      membershipTier: MembershipTier.PREMIUM,
      preferredCurrency: 'USD',
      preferredLanguage: 'en',
    },
  })

  const agent = await prisma.user.upsert({
    where: { email: 'agent@propgroup.com' },
    update: {},
    create: {
      email: 'agent@propgroup.com',
      password: hashedUserPassword,
      firstName: 'John',
      lastName: 'Broker',
      role: Role.AGENT,
      provider: 'local',
      isActive: true,
      emailVerifiedAt: new Date(),
      membershipTier: MembershipTier.ELITE,
      agentLicenseNumber: 'AG-2024-001',
      agentCompany: 'PropGroup Real Estate',
      agentBio: 'Experienced real estate agent specializing in international property investments',
      agentCommissionRate: 3.5,
      phone: '+357 99 123456',
    },
  })

  const testUser = await prisma.user.upsert({
    where: { email: 'user@propgroup.com' },
    update: {},
    create: {
      email: 'user@propgroup.com',
      password: hashedUserPassword,
      firstName: 'Test',
      lastName: 'User',
      role: Role.USER,
      provider: 'local',
      isActive: true,
      emailVerifiedAt: new Date(),
      investmentGoals: [InvestmentGoal.HIGH_ROI, InvestmentGoal.CAPITAL_GROWTH],
      membershipTier: MembershipTier.FREE,
      country: 'United States',
      phone: '+1 555 0123',
    },
  })

  const eliteUser = await prisma.user.upsert({
    where: { email: 'elite@propgroup.com' },
    update: {},
    create: {
      email: 'elite@propgroup.com',
      password: hashedUserPassword,
      firstName: 'Elite',
      lastName: 'Member',
      role: Role.USER,
      provider: 'local',
      isActive: true,
      emailVerifiedAt: new Date(),
      investmentGoals: [InvestmentGoal.GOLDEN_VISA],
      membershipTier: MembershipTier.ELITE,
      membershipStartDate: new Date(),
      membershipEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      country: 'United Kingdom',
      phone: '+44 20 7123 4567',
    },
  })

  console.log(`✅ Created 4 users (Super Admin, Agent, Test User, Elite Member)`)

  // ============================================
  // 2. CREATE DEVELOPERS
  // ============================================
  console.log('\n🏗️  Creating developers...')

  // Helper: find existing developer by name or create new one
  async function upsertDeveloper(data: { name: string; description: string; website: string; country: Country; logo: string }) {
    const existing = await prisma.developer.findFirst({ where: { name: data.name } })
    if (existing) return existing
    return prisma.developer.create({ data })
  }

  const developers = await Promise.all([
    upsertDeveloper({
      name: 'Archi Development',
      description:
        'Leading developer in Georgia with over 15 years of experience in premium residential and commercial projects. Known for innovative architectural designs and sustainable building practices.',
      website: 'https://archidevelopment.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400',
    }),
    upsertDeveloper({
      name: 'Cyprus Elite Properties',
      description:
        'Premium real estate development company in Cyprus, specializing in luxury beachfront villas and Golden Visa eligible properties with world-class amenities.',
      website: 'https://cypruselite.com',
      country: Country.CYPRUS,
      logo: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400',
    }),
    upsertDeveloper({
      name: 'Athens Modern Living',
      description:
        'Contemporary urban development specialist in Athens, creating modern residential spaces that blend Greek heritage with cutting-edge design and technology.',
      website: 'https://athensmodern.gr',
      country: Country.GREECE,
      logo: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=400',
    }),
    upsertDeveloper({
      name: 'Batumi Beach Developments',
      description:
        'Beachfront property specialist in Batumi, Georgia. Expert in high-yield investment properties with stunning sea views and modern amenities.',
      website: 'https://batumibeach.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400',
    }),
    upsertDeveloper({
      name: 'Beirut Urban Estates',
      description:
        'Prestigious developer in Lebanon, creating luxury residential and commercial properties in prime locations throughout Beirut and coastal areas.',
      website: 'https://beiruturban.com',
      country: Country.LEBANON,
      logo: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=400',
    }),
  ])

  console.log(`✅ Created ${developers.length} developers`)

  // ============================================
  // 3. CREATE LOCATION GUIDES
  // ============================================
  console.log('\n📍 Creating location guides...')

  // Helper: find existing location guide by title or create new one
  async function upsertLocationGuide(args: { data: { title: string; content: string; country: Country; imageUrl: string } }) {
    const existing = await prisma.locationGuide.findFirst({ where: { title: args.data.title } })
    if (existing) return existing
    return prisma.locationGuide.create(args)
  }

  const locationGuides = await Promise.all([
    upsertLocationGuide({
      data: {
        title: 'Tbilisi Investment Guide 2025',
        content: `Tbilisi, the vibrant capital of Georgia, has emerged as one of Eastern Europe's most promising real estate markets. The city offers:

**Investment Highlights:**
- Strong GDP growth averaging 5-7% annually
- Liberal foreign ownership laws with no restrictions
- Thriving tech sector attracting international talent
- Rich cultural heritage and growing tourism industry
- Affordable property prices with high rental yields
- Safe and business-friendly environment

**Popular Districts:**
- **Vake** - Prestigious residential area with parks and amenities
- **Saburtalo** - Modern developments and university district
- **Old Town** - Historical center with renovation opportunities
- **Didi Dighomi** - New developments with contemporary architecture

**Investment Returns:**
- Average rental yields: 7-9% annually
- Capital appreciation: 5-8% per year
- Property prices: $800-$2,500 per sqm`,
        country: Country.GEORGIA,
        imageUrl: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=1200',
      },
    }),
    upsertLocationGuide({
      data: {
        title: 'Cyprus Golden Visa & Property Investment Guide',
        content: `Cyprus offers one of Europe's most attractive Golden Visa programs combined with excellent property investment opportunities.

**Golden Visa Benefits:**
- €300,000 minimum investment in new property
- Visa-free travel to Schengen countries
- Permanent residency for entire family
- No stay requirements
- Path to citizenship after 7 years

**Investment Hotspots:**
- **Limassol** - Business hub, marina developments, luxury properties
- **Paphos** - UNESCO heritage sites, retirement destination
- **Larnaca** - Growing city with new marina and airport expansion

**Market Overview:**
- Strong rental demand from expats and tourists
- Rental yields: 4-6% annually
- Property prices stabilized and showing growth
- English widely spoken
- Excellent healthcare and education
- 340 days of sunshine per year`,
        country: Country.CYPRUS,
        imageUrl: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1200',
      },
    }),
    upsertLocationGuide({
      data: {
        title: 'Athens Real Estate Investment Overview',
        content: `Athens is experiencing a renaissance, with property prices recovering strongly and offering excellent investment potential.

**Why Invest in Athens:**
- Greece's Golden Visa (€250,000 minimum - changing to €400,000 in 2024)
- Historic low property prices compared to EU capitals
- Strong tourism growth (30+ million visitors annually)
- Airbnb and short-term rental opportunities
- Major infrastructure improvements
- Growing startup and digital nomad scene

**Prime Areas:**
- **Kolonaki** - Upscale neighborhood, luxury properties
- **Plaka** - Historic center, high tourist demand
- **Glyfada** - Coastal suburb, modern developments
- **Kifisia** - Elite northern suburb

**Investment Metrics:**
- Rental yields: 5-7% (short-term rentals can reach 8-10%)
- Capital appreciation: 4-6% annually
- Property prices: €1,500-€4,500 per sqm`,
        country: Country.GREECE,
        imageUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=1200',
      },
    }),
    upsertLocationGuide({
      data: {
        title: 'Batumi - Black Sea Riviera Investment',
        content: `Batumi, Georgia's premier seaside resort, offers exceptional value for property investors seeking high rental yields.

**Market Advantages:**
- Booming tourism (5+ million visitors annually)
- Modern beachfront developments
- Casino and entertainment hub
- Year-round rental potential
- Low property prices with high returns

**Investment Opportunities:**
- Beachfront apartments
- Hotel-managed condos
- New development projects
- Commercial properties in tourist zones

**Returns:**
- Rental yields: 8-12% annually
- Property prices: $600-$1,800 per sqm
- Strong capital growth potential`,
        country: Country.GEORGIA,
        imageUrl: 'https://images.unsplash.com/photo-1624571395775-253d9666612b?w=1200',
      },
    }),
    upsertLocationGuide({
      data: {
        title: 'Lebanon Property Market Guide',
        content: `Lebanon offers unique opportunities for investors familiar with emerging markets and seeking high-risk, high-reward investments.

**Market Characteristics:**
- Premium locations in Beirut and coastal areas
- Strong Lebanese diaspora demand
- Architectural heritage and modern developments
- Mediterranean lifestyle

**Investment Considerations:**
- Comprehensive due diligence recommended
- Focus on prime locations
- Dollar-denominated transactions common
- Strong local expertise essential

**Popular Areas:**
- Beirut Central District
- Achrafieh
- Jounieh
- Byblos coastal area`,
        country: Country.LEBANON,
        imageUrl: 'https://images.unsplash.com/photo-1580837119756-563d608dd119?w=1200',
      },
    }),
  ])

  console.log(`✅ Created ${locationGuides.length} location guides`)

  // ============================================
  // 4. CREATE PROPERTIES WITH INVESTMENT DATA
  // ============================================
  console.log('\n🏠 Creating properties with investment data...')

  const propertiesData = [
    // GEORGIA PROPERTIES
    {
      title: 'Luxury Apartment in Vake District',
      shortDescription: 'Modern 2-bedroom in Tbilisi\'s most prestigious neighborhood',
      description: `Stunning 2-bedroom apartment in the heart of Vake, Tbilisi's most desirable residential area. This newly built property features:

- Panoramic city and mountain views
- High-quality German fixtures and fittings
- Smart home system integration
- Underground parking space
- 24/7 security and concierge
- Walking distance to Vake Park
- Surrounded by cafes, restaurants, and shops
- Excellent public transport connections

Perfect for both residential living and investment purposes with strong rental demand from expats and professionals.`,
      propertyType: PropertyType.APARTMENT,
      price: 185000,
      currency: 'USD',
      bedrooms: 2,
      bathrooms: 2,
      area: 95,
      builtYear: 2024,
      floor: 8,
      floors: 12,
      parkingSpaces: 1,
      country: Country.GEORGIA,
      city: 'Tbilisi',
      district: 'Vake',
      status: PropertyStatus.NEW_BUILD,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: false,
      hasPool: false,
      hasGym: true,
      hasGarden: false,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: true,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['High ROI', 'City Center', 'Ready to Move', 'Payment Plan Available'],
      developerId: developers[0].id,
      locationGuideId: locationGuides[0].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 12.5,
        rentalYield: 7.8,
        capitalGrowth: 4.7,
        annualAppreciation: 6.0,
        minInvestment: 50000,
        maxInvestment: 185000,
        downPaymentPercentage: 30,
        paymentPlan: '30% down payment, 70% on completion with flexible installment options available',
        installmentYears: 2,
        completionDate: new Date('2025-12-31'),
        handoverDate: new Date('2026-01-31'),
        expectedRentalStart: new Date('2026-02-01'),
        averageRentPerMonth: 1200,
        mortgageAvailable: true,
        serviceFee: 800,
        propertyTax: 350,
      },
    },
    {
      title: 'Beachfront Studio in Batumi',
      shortDescription: 'Investment studio with sea views and hotel management',
      description: `Prime beachfront studio apartment in Batumi's new development zone. This property offers:

- Direct sea views from floor-to-ceiling windows
- Part of 5-star hotel complex
- Hotel management program available
- Access to pool, spa, and restaurant
- 50 meters from beach
- Guaranteed rental income option
- Modern furnishings included
- Perfect for Airbnb rental

Ideal investment opportunity with minimal management required and strong tourism-driven rental demand year-round.`,
      propertyType: PropertyType.STUDIO,
      price: 65000,
      currency: 'USD',
      bedrooms: 0,
      bathrooms: 1,
      area: 35,
      builtYear: null,
      floor: 12,
      floors: 20,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'New Boulevard',
      status: PropertyStatus.OFF_PLAN,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.FULLY_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: false,
      hasPool: true,
      hasGym: true,
      hasGarden: false,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: true,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200',
        'https://images.unsplash.com/photo-1560448075-cbc16bb4af8e?w=1200',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['Beachfront', 'High Rental Yield', 'Hotel Management', 'Off-Plan Discount'],
      developerId: developers[3].id,
      locationGuideId: locationGuides[3].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 15.5,
        rentalYield: 9.2,
        capitalGrowth: 6.3,
        annualAppreciation: 7.5,
        minInvestment: 20000,
        maxInvestment: 65000,
        downPaymentPercentage: 20,
        paymentPlan: '20% down payment, flexible installments until completion',
        installmentYears: 3,
        completionDate: new Date('2027-03-31'),
        handoverDate: new Date('2027-04-30'),
        expectedRentalStart: new Date('2027-05-01'),
        averageRentPerMonth: 500,
        mortgageAvailable: false,
        serviceFee: 420,
        propertyTax: 0,
      },
    },
    // CYPRUS PROPERTIES
    {
      title: 'Seafront Villa in Limassol',
      shortDescription: 'Luxurious 4-bedroom villa with private pool - Golden Visa eligible',
      description: `Exceptional 4-bedroom seafront villa in prestigious Limassol location. This stunning property features:

**Property Features:**
- 280 sqm of luxury living space
- Private infinity pool overlooking Mediterranean
- Direct beach access
- High-end Italian kitchen with Miele appliances
- Master suite with walk-in closet and spa bathroom
- Smart home automation system
- Private garden with BBQ area
- Double garage
- Maid's quarters

**Location Benefits:**
- 5 minutes to Limassol Marina
- Walking distance to 5-star hotels and restaurants
- International schools nearby
- Excellent infrastructure

**Golden Visa Eligible** - €300,000+ investment qualifies for Cyprus permanent residency.`,
      propertyType: PropertyType.VILLA,
      price: 850000,
      currency: 'EUR',
      bedrooms: 4,
      bathrooms: 3,
      area: 280,
      builtYear: null,
      floors: 2,
      parkingSpaces: 2,
      country: Country.CYPRUS,
      city: 'Limassol',
      district: 'Agios Tychonas',
      status: PropertyStatus.NEW_BUILD,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.UNFURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: true,
      hasPool: true,
      hasGym: false,
      hasGarden: true,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: false,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
      ],
      videoUrl: 'https://www.youtube.com/watch?v=example',
      featured: true,
      featuredUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['Golden Visa', 'Beachfront', 'Private Pool', 'Luxury Finishes'],
      developerId: developers[1].id,
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 10.2,
        rentalYield: 5.5,
        capitalGrowth: 4.7,
        annualAppreciation: 5.2,
        minInvestment: 250000,
        maxInvestment: 850000,
        downPaymentPercentage: 40,
        paymentPlan: '40% down payment, 60% on completion with flexible payment terms',
        completionDate: new Date('2026-06-30'),
        handoverDate: new Date('2026-07-31'),
        expectedRentalStart: new Date('2026-09-01'),
        averageRentPerMonth: 3900,
        mortgageAvailable: true,
        serviceFee: 1200,
        propertyTax: 0,
        isGoldenVisaEligible: true,
        goldenVisaMinAmount: 300000,
      },
    },
    {
      title: 'Paphos Garden Residence',
      shortDescription: 'Modern 2-bedroom apartment with communal pool',
      description: `Beautiful 2-bedroom apartment in a peaceful residential complex in Paphos. Features include:

- Spacious open-plan living area
- Large covered veranda with garden views
- Modern fitted kitchen
- En-suite master bedroom
- Communal swimming pool and gardens
- Covered parking
- Storage room
- Walking distance to amenities
- 10 minutes to beach

Excellent for permanent residence or holiday rental. Golden Visa eligible property.`,
      propertyType: PropertyType.APARTMENT,
      price: 325000,
      currency: 'EUR',
      bedrooms: 2,
      bathrooms: 2,
      area: 98,
      builtYear: null,
      floor: 2,
      floors: 3,
      parkingSpaces: 1,
      country: Country.CYPRUS,
      city: 'Paphos',
      district: 'Kato Paphos',
      status: PropertyStatus.NEW_BUILD,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: true,
      hasPool: true,
      hasGym: false,
      hasGarden: true,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: true,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200',
        'https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Golden Visa', 'New Build', 'Communal Pool', 'Near Beach'],
      developerId: developers[1].id,
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 11.3,
        rentalYield: 6.8,
        capitalGrowth: 4.5,
        annualAppreciation: 4.8,
        minInvestment: 100000,
        maxInvestment: 325000,
        downPaymentPercentage: 35,
        paymentPlan: '35% down payment, balance on completion',
        completionDate: new Date('2025-09-30'),
        handoverDate: new Date('2025-10-31'),
        expectedRentalStart: new Date('2025-11-01'),
        averageRentPerMonth: 1850,
        mortgageAvailable: true,
        serviceFee: 650,
        propertyTax: 0,
        isGoldenVisaEligible: true,
        goldenVisaMinAmount: 300000,
      },
    },
    // GREECE PROPERTIES
    {
      title: 'Athens Central Penthouse',
      shortDescription: 'Renovated 3-bedroom penthouse near Acropolis',
      description: `Exceptional 3-bedroom penthouse in the historic center of Athens with Acropolis views.

**Property Highlights:**
- Recently renovated to highest standards
- Large private terrace (60 sqm)
- Stunning Acropolis and city views
- High ceilings with period features
- Luxury bathroom with marble finishes
- Designer kitchen with premium appliances
- Air conditioning throughout
- Storage room

**Location:**
- Walking distance to Acropolis Museum
- Plaka and Monastiraki neighborhoods nearby
- Excellent public transport connections
- Surrounded by cafes, restaurants, galleries

**Investment Opportunity:**
- Golden Visa eligible
- High rental demand from tourists
- Strong Airbnb potential
- Capital appreciation area`,
      propertyType: PropertyType.PENTHOUSE,
      price: 420000,
      currency: 'EUR',
      bedrooms: 3,
      bathrooms: 2,
      area: 120,
      builtYear: 1970,
      floor: 5,
      floors: 5,
      parkingSpaces: 0,
      country: Country.GREECE,
      city: 'Athens',
      district: 'Plaka',
      status: PropertyStatus.RESALE,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.FULLY_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: true,
      hasPool: false,
      hasGym: false,
      hasGarden: false,
      hasBalcony: true,
      hasSecurity: false,
      hasElevator: true,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200',
        'https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=1200',
        'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['Golden Visa', 'Acropolis View', 'Historic Center', 'High Rental Potential'],
      developerId: developers[2].id,
      locationGuideId: locationGuides[2].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 9.8,
        rentalYield: 6.2,
        capitalGrowth: 3.6,
        annualAppreciation: 4.5,
        minInvestment: 100000,
        maxInvestment: 420000,
        paymentPlan: 'Full payment or mortgage financing available through Greek banks',
        mortgageAvailable: true,
        serviceFee: 480,
        propertyTax: 850,
        averageRentPerMonth: 2200,
        isGoldenVisaEligible: true,
        goldenVisaMinAmount: 400000,
      },
    },
    {
      title: 'Mykonos Luxury Villa',
      shortDescription: 'Traditional Cycladic villa with infinity pool and sea views',
      description: `Breathtaking 5-bedroom villa in Mykonos combining traditional architecture with luxury amenities.

**Villa Features:**
- Traditional Cycladic architecture
- Infinity pool with panoramic sea views
- 320 sqm of elegant living space
- 5 en-suite bedrooms
- Outdoor dining and lounge areas
- Modern kitchen with professional appliances
- Wine cellar
- Staff quarters
- Landscaped gardens
- Sunset views

**Location:**
- 5 minutes to Mykonos Town
- Private and secluded setting
- Easy access to beaches
- Walking distance to restaurants

**Investment Highlights:**
- Exceptional rental income potential
- Peak season rates €2,000+ per night
- Strong international demand
- Golden Visa eligible
- Premium Mykonos location`,
      propertyType: PropertyType.VILLA,
      price: 1200000,
      currency: 'EUR',
      bedrooms: 5,
      bathrooms: 4,
      area: 320,
      builtYear: 2015,
      floors: 2,
      parkingSpaces: 3,
      country: Country.GREECE,
      city: 'Mykonos',
      district: 'Agios Ioannis',
      status: PropertyStatus.RESALE,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.ELITE_ONLY,
      furnishingStatus: FurnishingStatus.FULLY_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: true,
      hasPool: true,
      hasGym: false,
      hasGarden: true,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: false,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
        'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200',
        'https://images.unsplash.com/photo-1613977257592-4871e5fcd7c4?w=1200',
      ],
      virtualTourUrl: 'https://my.matterport.com/show/?m=example',
      featured: true,
      featuredUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['Golden Visa', 'Luxury Villa', 'Sea Views', 'High ROI'],
      developerId: developers[2].id,
      locationGuideId: locationGuides[2].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 8.5,
        rentalYield: 4.8,
        capitalGrowth: 3.7,
        annualAppreciation: 4.2,
        minInvestment: 400000,
        maxInvestment: 1200000,
        paymentPlan: 'Negotiable payment terms available',
        mortgageAvailable: true,
        serviceFee: 3200,
        propertyTax: 2800,
        averageRentPerMonth: 4800,
        isGoldenVisaEligible: true,
        goldenVisaMinAmount: 400000,
      },
    },
    // LEBANON PROPERTY
    {
      title: 'Beirut Modern Apartment',
      shortDescription: 'Contemporary 3-bedroom in prestigious Achrafieh',
      description: `Modern 3-bedroom apartment in one of Beirut's most prestigious neighborhoods.

**Property Features:**
- Contemporary design with quality finishes
- Open-plan living and dining area
- Modern fitted kitchen
- Master bedroom with en-suite
- 2 bathrooms
- Large balconies
- Parking space
- Storage room
- Generator and water backup systems

**Location - Achrafieh:**
- Prime Beirut location
- Excellent infrastructure
- Close to international schools
- Shopping and dining nearby
- Well-established community

**Note:** Comprehensive due diligence and local legal advice recommended for all Lebanon investments.`,
      propertyType: PropertyType.APARTMENT,
      price: 380000,
      currency: 'USD',
      bedrooms: 3,
      bathrooms: 2,
      area: 180,
      builtYear: 2018,
      floor: 4,
      floors: 8,
      parkingSpaces: 1,
      country: Country.LEBANON,
      city: 'Beirut',
      district: 'Achrafieh',
      status: PropertyStatus.RESALE,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: false,
      hasPool: false,
      hasGym: true,
      hasGarden: false,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: true,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=1200',
        'https://images.unsplash.com/photo-1574643156929-51fa098b0394?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Prime Location', 'Modern Design', 'Secure Building'],
      developerId: developers[4].id,
      locationGuideId: locationGuides[4].id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 7.5,
        rentalYield: 4.5,
        capitalGrowth: 3.0,
        annualAppreciation: 3.5,
        minInvestment: 380000,
        maxInvestment: 380000,
        paymentPlan: 'Full payment or negotiable terms',
        mortgageAvailable: false,
        serviceFee: 1200,
        propertyTax: 600,
        averageRentPerMonth: 1400,
      },
    },
    // More diverse properties
    {
      title: 'Tbilisi City Center Duplex',
      shortDescription: 'Spacious 3-bedroom duplex with terrace',
      description: `Unique duplex apartment in the heart of Tbilisi offering exceptional space and modern living.

- 150 sqm across two levels
- Private terrace with city views
- High-quality finishes throughout
- Modern kitchen with island
- 3 large bedrooms
- 2.5 bathrooms
- Underfloor heating
- Smart home features
- Secure parking

Perfect for families or as a premium rental property.`,
      propertyType: PropertyType.DUPLEX,
      price: 245000,
      currency: 'USD',
      bedrooms: 3,
      bathrooms: 3,
      area: 150,
      builtYear: 2023,
      floor: 9,
      floors: 10,
      parkingSpaces: 1,
      country: Country.GEORGIA,
      city: 'Tbilisi',
      district: 'Vera',
      status: PropertyStatus.NEW_BUILD,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.UNFURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: false,
      hasPool: false,
      hasGym: true,
      hasGarden: false,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: true,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200',
        'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Duplex', 'City Center', 'Terrace', 'Modern'],
      developerId: developers[0].id,
      locationGuideId: locationGuides[0].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 11.0,
        rentalYield: 7.0,
        capitalGrowth: 4.0,
        annualAppreciation: 5.5,
        minInvestment: 75000,
        maxInvestment: 245000,
        downPaymentPercentage: 30,
        paymentPlan: '30% down, balance over 18 months',
        installmentYears: 2,
        completionDate: new Date('2025-06-30'),
        averageRentPerMonth: 1400,
        mortgageAvailable: true,
        serviceFee: 950,
      },
    },
    {
      title: 'Larnaca Marina Townhouse',
      shortDescription: 'Waterfront townhouse in exclusive marina development',
      description: `Exclusive townhouse in Larnaca's premium marina development. Golden Visa eligible.

**Features:**
- 3 levels of luxury living
- Private dock access
- Contemporary architecture
- Open-plan living areas
- 3 en-suite bedrooms
- Roof terrace with sea views
- Private garage
- Access to marina amenities

**Marina Living:**
- Restaurants and cafes on doorstep
- Yacht berths available
- Concierge services
- 24/7 security
- Beach access`,
      propertyType: PropertyType.TOWNHOUSE,
      price: 675000,
      currency: 'EUR',
      bedrooms: 3,
      bathrooms: 3,
      area: 195,
      builtYear: null,
      floors: 3,
      parkingSpaces: 2,
      country: Country.CYPRUS,
      city: 'Larnaca',
      district: 'Marina',
      status: PropertyStatus.NEW_BUILD,
      availabilityStatus: PropertyAvailabilityStatus.RESERVED,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.UNFURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: true,
      hasPool: true,
      hasGym: true,
      hasGarden: true,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: false,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=1200',
        'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['Golden Visa', 'Marina Living', 'Waterfront', 'Exclusive'],
      developerId: developers[1].id,
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      reservedUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      investmentData: {
        expectedROI: 9.5,
        rentalYield: 5.2,
        capitalGrowth: 4.3,
        annualAppreciation: 4.8,
        minInvestment: 200000,
        maxInvestment: 675000,
        downPaymentPercentage: 35,
        paymentPlan: '35% down, balance on completion',
        completionDate: new Date('2026-12-31'),
        averageRentPerMonth: 2900,
        mortgageAvailable: true,
        serviceFee: 1800,
        isGoldenVisaEligible: true,
        goldenVisaMinAmount: 300000,
      },
    },
  ]

  const createdProperties = []
  for (const propertyData of propertiesData) {
    const { investmentData, ...propertyInfo } = propertyData

    const property = await prisma.property.create({
      data: propertyInfo,
    })

    await prisma.propertyInvestmentData.create({
      data: {
        ...investmentData,
        propertyId: property.id,
      },
    })

    createdProperties.push(property)
  }

  console.log(`✅ Created ${createdProperties.length} properties with investment data`)

  // ============================================
  // 5. CREATE TAGS AND PROPERTY TAGS
  // ============================================
  console.log('\n🏷️  Creating tags...')
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { name: 'Beachfront' },
      update: {},
      create: {
        name: 'Beachfront',
        slug: 'beachfront',
        description: 'Properties with direct beach access',
        category: 'location',
        color: '#3B82F6',
        icon: 'beach',
      },
    }),
    prisma.tag.upsert({
      where: { name: 'Golden Visa' },
      update: {},
      create: {
        name: 'Golden Visa',
        slug: 'golden-visa',
        description: 'Eligible for Golden Visa programs',
        category: 'investment_type',
        color: '#F59E0B',
        icon: 'visa',
      },
    }),
    prisma.tag.upsert({
      where: { name: 'High ROI' },
      update: {},
      create: {
        name: 'High ROI',
        slug: 'high-roi',
        description: 'Properties with exceptional return on investment',
        category: 'investment_type',
        color: '#10B981',
        icon: 'trending-up',
      },
    }),
    prisma.tag.upsert({
      where: { name: 'New Build' },
      update: {},
      create: {
        name: 'New Build',
        slug: 'new-build',
        description: 'Brand new construction',
        category: 'feature',
        color: '#8B5CF6',
        icon: 'home',
      },
    }),
    prisma.tag.upsert({
      where: { name: 'Sea View' },
      update: {},
      create: {
        name: 'Sea View',
        slug: 'sea-view',
        description: 'Properties with sea views',
        category: 'feature',
        color: '#06B6D4',
        icon: 'waves',
      },
    }),
  ])

  // Add tags to properties
  const goldenVisaTag = tags.find(t => t.slug === 'golden-visa')
  const beachfrontTag = tags.find(t => t.slug === 'beachfront')
  const highROITag = tags.find(t => t.slug === 'high-roi')
  const newBuildTag = tags.find(t => t.slug === 'new-build')

  await Promise.all(
    createdProperties
      .filter(p => p.isGoldenVisaEligible)
      .map(p =>
        prisma.propertyTag.create({
          data: { propertyId: p.id, tagId: goldenVisaTag!.id },
        })
      )
  )

  console.log(`✅ Created ${tags.length} tags`)

  // ============================================
  // 6. CREATE PROPERTY AMENITIES
  // ============================================
  console.log('\n✨ Creating property amenities...')
  const firstProperty = createdProperties[0]
  const amenities = await Promise.all([
    prisma.propertyAmenity.create({
      data: {
        propertyId: firstProperty.id,
        name: 'Concierge Service',
        category: 'Services',
        description: '24/7 professional concierge service',
        icon: 'concierge',
      },
    }),
    prisma.propertyAmenity.create({
      data: {
        propertyId: firstProperty.id,
        name: 'Underground Parking',
        category: 'Parking',
        description: 'Secure underground parking space',
        icon: 'parking',
      },
    }),
    prisma.propertyAmenity.create({
      data: {
        propertyId: firstProperty.id,
        name: 'Fitness Center',
        category: 'Recreation',
        description: 'Fully equipped modern gym',
        icon: 'fitness',
      },
    }),
  ])

  console.log(`✅ Created ${amenities.length} amenities for sample property`)

  // ============================================
  // 7. CREATE USER INTERACTIONS
  // ============================================
  console.log('\n💝 Creating user favorites...')
  const favorites = await prisma.favoriteProperty.createMany({
    data: [
      { userId: testUser.id, propertyId: createdProperties[0].id },
      { userId: testUser.id, propertyId: createdProperties[2].id },
      { userId: eliteUser.id, propertyId: createdProperties[5].id },
      { userId: eliteUser.id, propertyId: createdProperties[2].id },
    ],
    skipDuplicates: true,
  })

  console.log('✅ Created favorite properties')

  console.log('\n📧 Creating property inquiries...')
  const inquiries = await prisma.propertyInquiry.createMany({
    data: [
      {
        userId: testUser.id,
        propertyId: createdProperties[0].id,
        name: 'Test User',
        email: 'user@propgroup.com',
        phone: '+1 555 0123',
        message:
          'I am very interested in this property. Could you provide more details about the payment plan and completion timeline?',
      },
      {
        userId: eliteUser.id,
        propertyId: createdProperties[2].id,
        name: 'Elite Member',
        email: 'elite@propgroup.com',
        phone: '+44 20 7123 4567',
        message:
          'I would like to schedule a viewing and discuss the Golden Visa process. Please contact me at your earliest convenience.',
      },
    ],
  })

  console.log('✅ Created property inquiries')


  // ============================================
  // 10. CREATE NOTIFICATIONS
  // ============================================
  console.log('\n🔔 Creating sample notifications...')
  await prisma.notification.createMany({
    data: [
      {
        userId: testUser.id,
        type: 'PROPERTY_UPDATE',
        title: 'Price Drop Alert',
        message: 'A property in your favorites has reduced its price by 5%',
        link: `/properties/${createdProperties[0].id}`,
        actionLabel: 'View Property',
        actionUrl: `/properties/${createdProperties[0].id}`,
        relatedEntityType: 'property',
        relatedEntityId: createdProperties[0].id,
        priority: 'high',
      },
      {
        userId: testUser.id,
        type: 'NEW_MATCHING_PROPERTY',
        title: 'New Property Match',
        message: 'We found a new property matching your investment goals',
        link: `/properties/${createdProperties[1].id}`,
        actionLabel: 'View Property',
        actionUrl: `/properties/${createdProperties[1].id}`,
        relatedEntityType: 'property',
        relatedEntityId: createdProperties[1].id,
        priority: 'normal',
      },
    ],
  })

  console.log('✅ Created sample notifications')


  // ============================================
  // SEED CMS SITE CONTENT
  // ============================================
  console.log('Seeding site content...')

  const siteContentData = [
    // Hero Section
    { key: 'hero_title', section: 'hero', title: 'Hero Title', content: 'Your Gateway to Premium Real Estate Investment', sortOrder: 1 },
    { key: 'hero_subtitle', section: 'hero', title: 'Hero Subtitle', content: 'Discover high-yield properties across Cyprus, Greece, Georgia, and Lebanon', sortOrder: 2 },
    { key: 'hero_cta_text', section: 'hero', title: 'Hero CTA Text', content: 'Explore Properties', sortOrder: 3 },
    { key: 'hero_cta_link', section: 'hero', title: 'Hero CTA Link', content: '/properties', sortOrder: 4 },

    // About Section
    { key: 'about_title', section: 'about', title: 'About Title', content: 'About PropGroup', sortOrder: 1 },
    { key: 'about_intro', section: 'about', title: 'About Introduction', content: 'PropGroup is a leading real estate investment platform connecting investors with premium properties across the Mediterranean and Eastern Europe.', sortOrder: 2 },
    { key: 'about_mission', section: 'about', title: 'Our Mission', content: 'To make international real estate investment accessible, transparent, and profitable for everyone.', sortOrder: 3 },

    // Features Section
    { key: 'features_title', section: 'features', title: 'Features Title', content: 'Why Choose PropGroup', sortOrder: 1 },
    { key: 'feature_1', section: 'features', title: 'Expert Guidance', content: 'Our team of local experts guides you through every step of the investment process.', sortOrder: 2 },
    { key: 'feature_2', section: 'features', title: 'Golden Visa Programs', content: 'Access residency-by-investment programs in Cyprus and Greece.', sortOrder: 3 },
    { key: 'feature_3', section: 'features', title: 'High ROI Properties', content: 'Curated properties with proven rental yields and capital growth potential.', sortOrder: 4 },

    // CTA Section
    { key: 'cta_title', section: 'cta', title: 'CTA Title', content: 'Ready to Start Your Investment Journey?', sortOrder: 1 },
    { key: 'cta_subtitle', section: 'cta', title: 'CTA Subtitle', content: 'Browse our curated selection of properties or speak with an investment advisor today.', sortOrder: 2 },
    { key: 'cta_button_text', section: 'cta', title: 'CTA Button Text', content: 'Get Started', sortOrder: 3 },
    { key: 'cta_button_link', section: 'cta', title: 'CTA Button Link', content: '/properties', sortOrder: 4 },

    // Contact Section
    { key: 'contact_email', section: 'contact', title: 'Contact Email', content: 'info@propgroup.com', sortOrder: 1 },
    { key: 'contact_phone', section: 'contact', title: 'Contact Phone', content: '+357 25 123 456', sortOrder: 2 },
    { key: 'contact_address', section: 'contact', title: 'Contact Address', content: 'Limassol, Cyprus', sortOrder: 3 },

    // Footer
    { key: 'footer_tagline', section: 'footer', title: 'Footer Tagline', content: 'Premium Real Estate Investment Platform', sortOrder: 1 },
    { key: 'footer_copyright', section: 'footer', title: 'Footer Copyright', content: '© 2025 PropGroup. All rights reserved.', sortOrder: 2 },
  ]

  for (const item of siteContentData) {
    await prisma.siteContent.upsert({
      where: { key: item.key },
      update: { ...item },
      create: { ...item },
    })
  }
  console.log(`Created ${siteContentData.length} site content entries`)

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50))
  console.log('🎉 Database seed completed successfully!')
  console.log('='.repeat(50))
  console.log('\n📊 Summary:')
  console.log(`   • ${4} Users created`)
  console.log(`   • ${developers.length} Developers`)
  console.log(`   • ${locationGuides.length} Location Guides`)
  console.log(`   • ${createdProperties.length} Properties with Investment Data`)
  console.log(`   • ${tags.length} Tags`)
  console.log(`   • Multiple amenities and interactions`)
  console.log('\n👤 Login Credentials:')
  console.log('   ┌─────────────────────────────────────────┐')
  console.log('   │ Super Admin:                            │')
  console.log('   │ Email: admin@propgroup.com              │')
  console.log('   │ Password: Admin123!                     │')
  console.log('   ├─────────────────────────────────────────┤')
  console.log('   │ Agent:                                  │')
  console.log('   │ Email: agent@propgroup.com              │')
  console.log('   │ Password: User123!                      │')
  console.log('   ├─────────────────────────────────────────┤')
  console.log('   │ Test User:                              │')
  console.log('   │ Email: user@propgroup.com               │')
  console.log('   │ Password: User123!                      │')
  console.log('   ├─────────────────────────────────────────┤')
  console.log('   │ Elite Member:                           │')
  console.log('   │ Email: elite@propgroup.com              │')
  console.log('   │ Password: User123!                      │')
  console.log('   └─────────────────────────────────────────┘')
  console.log('\n⚠️  IMPORTANT: Change all passwords after first login!')
  console.log('')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
