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
  console.log('🌱 Starting database seed...\n')

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
      agentBio: 'Experienced real estate agent specializing in Georgian property investments',
      agentCommissionRate: 3.5,
      phone: '+995 555 123456',
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
      investmentGoals: [InvestmentGoal.GOLDEN_VISA, InvestmentGoal.CAPITAL_GROWTH],
      membershipTier: MembershipTier.ELITE,
      membershipStartDate: new Date(),
      membershipEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      country: 'United Kingdom',
      phone: '+44 20 7123 4567',
    },
  })

  console.log('✅ Created 4 users (Super Admin, Agent, Test User, Elite Member)')

  // ============================================
  // 2. CREATE DEVELOPERS (Georgia-focused)
  // ============================================
  console.log('\n🏗️  Creating developers...')

  async function upsertDeveloper(data: { name: string; description: string; website: string; country: Country; logo: string }) {
    const existing = await prisma.developer.findFirst({ where: { name: data.name } })
    if (existing) return existing
    return prisma.developer.create({ data })
  }

  const developers = await Promise.all([
    upsertDeveloper({
      name: 'Alliance Group',
      description: 'Major developer behind Alliance Centropolis in Batumi, partnering with Hyatt Centric and World Trade Center. Known for large-scale multifunctional complexes.',
      website: 'https://alliancegroup.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400',
    }),
    upsertDeveloper({
      name: 'Archi Group',
      description: 'One of Georgia\'s largest developers with 15+ years of experience. Partnered with Wyndham Hotels for the Ramada Encore Batumi project. Known for premium residential and hotel-managed properties.',
      website: 'https://archi.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400',
    }),
    upsertDeveloper({
      name: 'Rotana Hotels',
      description: 'UAE-based luxury hotel group expanding into Georgia with their first property — Rotana Pontus Gonio. Renowned for 5-star hospitality and hotel-managed investment apartments.',
      website: 'https://rotana.com',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400',
    }),
    upsertDeveloper({
      name: 'Royal Tulip Hotels',
      description: 'International hotel brand (Louvre Hotels Group) with two branded residences in Batumi — Royal Tulip Oval and Royal Tulip Cube. Professional rental management with up to 12% annual returns.',
      website: 'https://royaltulipbatumi.com',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400',
    }),
    upsertDeveloper({
      name: 'OKTO Group',
      description: 'Innovative developer behind OKTO Art House in Batumi. Specializes in lifestyle-driven mixed-use developments with art, culture, and modern amenities.',
      website: 'https://okto.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400',
    }),
    upsertDeveloper({
      name: 'Tekto Group',
      description: 'Progressive Georgian developer with projects across the Black Sea coast — including Tekto Franco (Makhinjauri) and Tekto Rakurs (Chakvi). Known for modern architecture and seaside living.',
      website: 'https://tekto.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1560448075-cbc16bb4af8e?w=400',
    }),
    upsertDeveloper({
      name: 'Redco Construction',
      description: 'Leading developer in mountain resort properties, known for premium apartments in New Gudauri ski resort. Offers white frame and turnkey furnished options.',
      website: 'https://redco.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400',
    }),
    upsertDeveloper({
      name: 'Novotel / Accor',
      description: 'Global hospitality brand Accor\'s Novotel Living brand, offering luxury furnished hotel apartments in Batumi with full hotel services and 10-15% projected annual returns.',
      website: 'https://novotel.com',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
    }),
    upsertDeveloper({
      name: 'GreenHill Development',
      description: 'Tbilisi-focused developer creating eco-friendly residential complexes with panoramic views. Known for flexible financing options and modern architectural designs.',
      website: 'https://greenhill.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1448630360428-65456885c650?w=400',
    }),
    upsertDeveloper({
      name: 'BlueSky Development',
      description: 'Batumi-based developer behind BlueSky Tower — a modern mixed-use complex combining a 4-star international hotel with premium residential apartments, 500m from the Black Sea.',
      website: 'https://bluesky.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=400',
    }),
  ])

  console.log(`✅ Created ${developers.length} developers`)

  // ============================================
  // 3. CREATE LOCATION GUIDES
  // ============================================
  console.log('\n📍 Creating location guides...')

  async function upsertLocationGuide(args: { data: { title: string; content: string; country: Country; imageUrl: string } }) {
    const existing = await prisma.locationGuide.findFirst({ where: { title: args.data.title } })
    if (existing) return existing
    return prisma.locationGuide.create(args)
  }

  const locationGuides = await Promise.all([
    upsertLocationGuide({
      data: {
        title: 'Tbilisi Investment Guide 2026',
        content: `Tbilisi, the vibrant capital of Georgia, has emerged as one of Eastern Europe's most promising real estate markets.

**Investment Highlights:**
- Strong GDP growth averaging 5-7% annually
- Liberal foreign ownership laws with no restrictions
- Thriving tech sector attracting international talent
- Affordable property prices with high rental yields
- Safe and business-friendly environment

**Popular Districts:**
- **Vake** - Prestigious residential area with parks and amenities
- **Saburtalo** - Modern developments and university district
- **Old Town** - Historical center with renovation opportunities
- **Vera** - Trendy central neighborhood, popular with expats

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
        title: 'Batumi - Black Sea Riviera Investment',
        content: `Batumi, Georgia's premier seaside resort, offers exceptional value for property investors seeking high rental yields.

**Market Advantages:**
- Booming tourism (5+ million visitors annually)
- Modern beachfront developments
- Casino and entertainment hub
- Year-round rental potential
- Low property prices with high returns

**Investment Opportunities:**
- Beachfront apartments with hotel management
- New Boulevard area developments
- Old Town renovation projects

**Returns:**
- Rental yields: 8-12% annually
- Property prices: $600-$1,800 per sqm
- Strong capital growth potential`,
        country: Country.GEORGIA,
        imageUrl: 'https://images.unsplash.com/photo-1624571395775-253d9666612b?w=1200',
      },
    }),
  ])

  // Add Gudauri location guide
  const gudauriGuide = await upsertLocationGuide({
    data: {
      title: 'Gudauri - Mountain Resort Investment',
      content: `Gudauri is Georgia's premier ski resort, located on the south-facing slopes of the Greater Caucasus mountains at 2,196m altitude.

**Investment Highlights:**
- Year-round tourism: skiing in winter, hiking/paragliding in summer
- Government-backed infrastructure development
- New Gudauri resort village with international-standard facilities
- Growing demand from European and Middle Eastern tourists

**Returns:**
- Rental yields: 8-12% annually (peak season)
- Property prices: $1,000-$2,000 per sqm
- Strong appreciation as resort develops`,
      country: Country.GEORGIA,
      imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200',
    },
  })

  console.log(`✅ Created ${locationGuides.length + 1} location guides`)

  // ============================================
  // 4. CREATE PROPERTIES (from propgrp.com)
  // ============================================
  console.log('\n🏠 Creating 16 properties matching propgrp.com listings...')

  // Developer index: 0=Alliance, 1=Archi, 2=Rotana, 3=Royal Tulip, 4=OKTO, 5=Tekto, 6=Redco, 7=Novotel, 8=GreenHill, 9=BlueSky

  const propertiesData = [
    // ─── 1. Tonino Lamborghini Tower Batumi ───
    {
      title: 'Tonino Lamborghini Tower Batumi',
      shortDescription: 'Italian luxury branded residences on Batumi Island — 66 floors, sea & mountain views',
      description: `Tonino Lamborghini Tower Batumi — Italian Luxury on the Black Sea.

**The Project:**
- 66-floor iconic tower on Batumi Island
- 1,080 branded luxury units
- 11 high-speed elevators
- Studios, 1BR, 2BR, and 3BR apartments available

**Amenities:**
- Premium retail boutiques and luxury stores
- Fine dining restaurants and rooftop bars
- International casino and entertainment areas
- Yacht club and seaside terraces
- Swimming pool, gym, jacuzzi, sauna, spa

**Investment Highlights:**
- Italian luxury brand — strong resale value
- Batumi Island location with panoramic sea, city, and mountain views
- Hotel management program available
- Growing tourism market with year-round demand

Delivery: Q4 2030. A landmark development redefining luxury living on the Black Sea.`,
      propertyType: PropertyType.APARTMENT,
      price: 165000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 45,
      builtYear: null,
      floor: null,
      floors: 66,
      parkingSpaces: 1,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'Batumi Island',
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
        'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['Branded Residence', 'Sea Views', 'Luxury Amenities', 'Yacht Club'],
      developerId: developers[0].id, // Alliance (placeholder for Lamborghini partnership)
      locationGuideId: locationGuides[1].id, // Batumi
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 14.0,
        rentalYield: 8.5,
        capitalGrowth: 5.5,
        annualAppreciation: 8.0,
        minInvestment: 33000,
        maxInvestment: 165000,
        downPaymentPercentage: 20,
        paymentPlan: '20% booking, installments during construction, balance on handover',
        paymentPlanDetails: {
          planType: 'CONSTRUCTION_LINKED',
          summary: '20% booking, installments during construction, balance on completion',
          milestones: [
            { label: 'Booking', percentage: 20, description: 'On reservation' },
            { label: 'During Construction', percentage: 50, description: 'Spread across construction milestones' },
            { label: 'On Handover', percentage: 30, description: 'On key delivery Q4 2030' },
          ],
        },
        installmentYears: 4,
        completionDate: new Date('2030-10-31'),
        handoverDate: new Date('2030-12-31'),
        expectedRentalStart: new Date('2031-01-01'),
        averageRentPerMonth: 1200,
        mortgageAvailable: false,
        serviceFee: 900,
        propertyTax: 0,
      },
    },

    // ─── 2. BlueSky Tower ───
    {
      title: 'BlueSky Tower',
      shortDescription: 'Modern mixed-use tower — 4-star hotel + premium apartments, 500m from Black Sea',
      description: `BlueSky Tower — Smart Returns by Design.

**The Project:**
- Modern mixed-use development in central Batumi
- 4-star international hotel combined with premium residential apartments
- 500 meters from the Black Sea coastline
- Walking distance to stadiums, malls, hospitals, and schools

**Unit Types:**
- Studios, 1-bedroom, and 2-bedroom apartments
- Starting from $55,000

**Amenities:**
- Swimming pool, gym, jacuzzi, sauna
- Restaurant, conference room, parking
- WiFi, laundry, 24/7 security
- BBQ areas and outdoor spaces

Ideal for investors seeking affordable entry into Batumi's growing tourism and hospitality market.`,
      propertyType: PropertyType.APARTMENT,
      price: 55000,
      currency: 'USD',
      bedrooms: 0,
      bathrooms: 1,
      area: 28,
      builtYear: null,
      floor: null,
      floors: 25,
      parkingSpaces: 1,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'City Center',
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
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Hotel Managed', 'Affordable Entry', 'City Center', 'Sea Proximity'],
      developerId: developers[9].id, // BlueSky
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 11.0,
        rentalYield: 8.0,
        capitalGrowth: 3.0,
        annualAppreciation: 5.0,
        minInvestment: 11000,
        maxInvestment: 55000,
        downPaymentPercentage: 20,
        paymentPlan: '20% down, 80% in installments',
        paymentPlanDetails: {
          planType: 'INSTALLMENTS',
          summary: '20% down payment, 80% in monthly installments during construction',
          milestones: [
            { label: 'Down Payment', percentage: 20, description: 'On signing' },
            { label: 'Monthly Installments', percentage: 80, description: 'During construction' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 24,
          installmentAmount: 1833,
        },
        installmentYears: 2,
        completionDate: new Date('2028-06-30'),
        handoverDate: new Date('2028-09-30'),
        expectedRentalStart: new Date('2028-10-01'),
        averageRentPerMonth: 400,
        mortgageAvailable: false,
        serviceFee: 250,
        propertyTax: 0,
      },
    },

    // ─── 3. Rotana Pontus Gonio ───
    {
      title: 'Rotana Pontus Gonio',
      shortDescription: '5-star luxury hotel investment on the Black Sea — projected 12.5% ROI by Cushman & Wakefield',
      description: `Rotana Pontus Gonio — 5-Star Luxury on the Black Sea Coast.

**The Project:**
- First Rotana hotel in Georgia (UAE luxury hotel group)
- First coastline location with wide, clean beaches
- 15 minutes from Batumi center, 10 minutes from Turkey-Georgia border

**Investment Highlights:**
- Projected ROI from 12.5% (Cushman & Wakefield study)
- Professional hotel management by Rotana
- Studios and 1-bedroom units available

**Amenities:**
- Casino and rooftop restaurant
- Swimming pool, gym, spa, jacuzzi, sauna
- Conference facilities, parking
- Full 5-star hotel services

**Location — Gonio:**
- Premium beachfront in the Gonio area
- Quiet luxury away from city noise
- Rapidly developing resort area with strong appreciation potential

Starting from $150,000.`,
      propertyType: PropertyType.APARTMENT,
      price: 150000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 42,
      builtYear: null,
      floor: null,
      floors: 20,
      parkingSpaces: 1,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'Gonio',
      status: PropertyStatus.OFF_PLAN,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.FULLY_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: false,
      hasPool: true,
      hasGym: true,
      hasGarden: true,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: true,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200',
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['5-Star Hotel', '12.5% ROI', 'Beachfront', 'Rotana Managed'],
      developerId: developers[2].id, // Rotana
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 12.5,
        rentalYield: 9.0,
        capitalGrowth: 3.5,
        annualAppreciation: 6.0,
        minInvestment: 30000,
        maxInvestment: 150000,
        downPaymentPercentage: 20,
        paymentPlan: '20% booking, flexible installments, balance on handover',
        paymentPlanDetails: {
          planType: 'CONSTRUCTION_LINKED',
          summary: '20% booking, installments during construction, balance on handover',
          milestones: [
            { label: 'Booking', percentage: 20, description: 'On reservation' },
            { label: 'Construction Phase', percentage: 50, description: 'During construction' },
            { label: 'On Handover', percentage: 30, description: 'On key delivery' },
          ],
        },
        installmentYears: 3,
        completionDate: new Date('2028-12-31'),
        handoverDate: new Date('2029-03-31'),
        expectedRentalStart: new Date('2029-04-01'),
        averageRentPerMonth: 1100,
        mortgageAvailable: false,
        serviceFee: 600,
        propertyTax: 0,
      },
    },

    // ─── 4. Alliance Centropolis (Hyatt Centric) ───
    {
      title: 'Alliance Centropolis — Hyatt Centric',
      shortDescription: 'The most multifunctional complex in the Caucasus — Hyatt Centric + World Trade Center',
      description: `Alliance Centropolis — A City Within a City.

**The Project:**
- 24 integrated spaces combining business, leisure, and entertainment
- Partnership with Hyatt Centric and World Trade Center (WTC)
- Located on Shota Rustaveli Street 52, Batumi's prime boulevard
- Dynamic sea and city views

**Key Features:**
- 10% down payment to get started
- 5-year installment plan available
- Hotel management by Hyatt Centric
- WTC business facilities

**Amenities:**
- Full Hyatt Centric hotel services
- Business center and conference rooms
- Restaurants, retail, entertainment zones
- Pool, gym, spa, parking

Starting from $110,000. The ultimate mixed-use investment in Batumi.`,
      propertyType: PropertyType.APARTMENT,
      price: 110000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 45,
      builtYear: null,
      floor: null,
      floors: 40,
      parkingSpaces: 1,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'Rustaveli Street',
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
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200',
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200',
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['Hyatt Centric', 'WTC Partner', '10% Down', '5-Year Plan'],
      developerId: developers[0].id, // Alliance
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 13.0,
        rentalYield: 8.5,
        capitalGrowth: 4.5,
        annualAppreciation: 7.0,
        minInvestment: 11000,
        maxInvestment: 110000,
        downPaymentPercentage: 10,
        paymentPlan: '10% down payment, 5-year installment plan',
        paymentPlanDetails: {
          planType: 'INSTALLMENTS',
          summary: '10% down payment, remaining 90% over 5-year installment plan',
          milestones: [
            { label: 'Down Payment', percentage: 10, description: 'On reservation' },
            { label: 'Monthly Installments', percentage: 90, description: '5-year payment plan' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 60,
          installmentAmount: 1650,
        },
        installmentYears: 5,
        completionDate: new Date('2028-12-31'),
        handoverDate: new Date('2029-03-31'),
        expectedRentalStart: new Date('2029-04-01'),
        averageRentPerMonth: 800,
        mortgageAvailable: false,
        serviceFee: 500,
        propertyTax: 0,
      },
    },

    // ─── 5. OKTO Art House ───
    {
      title: 'OKTO Art House',
      shortDescription: 'Batumi\'s landmark of art & lifestyle — studios from $45,000 with 0% installments',
      description: `OKTO Art House — Batumi's Landmark of Art & Lifestyle.

**The Project:**
- Mixed-use residential with art and cultural focus
- Studios, 1-bedroom, and 2-bedroom apartments
- Delivery: 2027
- Flexible 0% installment plans up to 40 months

**Amenities:**
- Outdoor swimming pool
- Fitness gym and spa
- Children's art school
- 24/7 lobby service and reception

**Why OKTO Art House:**
- Most affordable entry point in Batumi ($45,000)
- Unique lifestyle concept attracting young professionals and creatives
- Strong short-term rental demand from tourists
- 0% interest payment plans

An ideal first investment in Georgian real estate.`,
      propertyType: PropertyType.APARTMENT,
      price: 45000,
      currency: 'USD',
      bedrooms: 0,
      bathrooms: 1,
      area: 25,
      builtYear: null,
      floor: null,
      floors: 18,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: null,
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
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['0% Installments', 'Art & Lifestyle', 'Affordable', '2027 Delivery'],
      developerId: developers[4].id, // OKTO
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 10.5,
        rentalYield: 7.5,
        capitalGrowth: 3.0,
        annualAppreciation: 5.0,
        minInvestment: 9000,
        maxInvestment: 45000,
        downPaymentPercentage: 20,
        paymentPlan: '0% interest installment plan up to 40 months',
        paymentPlanDetails: {
          planType: 'INSTALLMENTS',
          summary: '20% initial, 80% in 0% interest installments over 40 months',
          milestones: [
            { label: 'Initial Payment', percentage: 20, description: 'On reservation' },
            { label: '0% Installments', percentage: 80, description: 'Monthly over 40 months' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 40,
          installmentAmount: 900,
        },
        installmentYears: 3,
        completionDate: new Date('2027-12-31'),
        handoverDate: new Date('2027-12-31'),
        expectedRentalStart: new Date('2028-01-01'),
        averageRentPerMonth: 350,
        mortgageAvailable: false,
        serviceFee: 200,
        propertyTax: 0,
      },
    },

    // ─── 6. Royal Tulip Oval ───
    {
      title: 'Royal Tulip Oval',
      shortDescription: 'Luxury living by the Black Sea — up to 12% annual return, owner usage 60 days/year',
      description: `Royal Tulip Oval — Luxury Living by the Black Sea.

**The Project:**
- Located on Zhiuli Shartava Avenue, WISH City Area, Batumi
- Studios, 1-bedroom, and 2-bedroom units
- Delivery: December 2027
- Professional rental and maintenance by Royal Tulip

**Investment Returns:**
- Projected annual rental return up to 12%
- Capital growth approximately 15% per year
- Owner usage up to 60 days per year

**Payment Plans:**
- Plan 1: 0% initial, 40% monthly, 60% on completion
- Plan 2: 20% initial, 50% monthly, 30% on completion
- Plan 3: 10% initial, 20% monthly, 70% on completion

**Features:**
- District heating and seismic resistance
- High ceilings and premium finishes
- Full hotel amenities

Starting from $85,000.`,
      propertyType: PropertyType.APARTMENT,
      price: 85000,
      currency: 'USD',
      bedrooms: 0,
      bathrooms: 1,
      area: 30,
      builtYear: null,
      floor: null,
      floors: 30,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'WISH City',
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
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['12% Annual Return', 'Hotel Managed', 'Owner Usage', 'Flexible Plans'],
      developerId: developers[3].id, // Royal Tulip
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 12.0,
        rentalYield: 9.0,
        capitalGrowth: 3.0,
        annualAppreciation: 15.0,
        minInvestment: 0,
        maxInvestment: 85000,
        downPaymentPercentage: 0,
        paymentPlan: 'Multiple flexible plans — 0% to 20% initial, balance on completion',
        paymentPlanDetails: {
          planType: 'CUSTOM',
          summary: 'Three payment plan options with varying down payments',
          milestones: [
            { label: 'Plan 1', percentage: 0, description: '0% initial, 40% monthly, 60% on completion' },
            { label: 'Plan 2', percentage: 20, description: '20% initial, 50% monthly, 30% on completion' },
            { label: 'Plan 3', percentage: 10, description: '10% initial, 20% monthly, 70% on completion' },
          ],
          notes: 'Owner can use the property up to 60 days per year while earning rental income the rest.',
        },
        completionDate: new Date('2027-12-31'),
        handoverDate: new Date('2027-12-31'),
        expectedRentalStart: new Date('2028-01-01'),
        averageRentPerMonth: 700,
        mortgageAvailable: false,
        serviceFee: 350,
        propertyTax: 0,
      },
    },

    // ─── 7. Sunway Suites Batumi ───
    {
      title: 'Sunway Suites Batumi',
      shortDescription: 'Fully furnished seafront studios with 8-10% ROI — ready to move in, limited units',
      description: `Sunway Suites — Batumi Investment, Fully Furnished Studios with ROI.

**The Project:**
- Seafront location in Batumi
- Fully furnished studios and 1-bedroom apartments
- Ready to move in — immediate rental income
- Limited units available

**Investment Returns:**
- 8-10% annual ROI
- Strong year-round demand from tourists
- Hassle-free — turnkey furnished and ready

**Features:**
- Modern furnishings included
- Seafront views
- Compact, efficient layouts (28 sqm studios)

Starting from $48,000. An ideal hands-off investment for immediate returns.`,
      propertyType: PropertyType.STUDIO,
      price: 48000,
      currency: 'USD',
      bedrooms: 0,
      bathrooms: 1,
      area: 28,
      builtYear: 2025,
      floor: null,
      floors: 12,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'Seafront',
      status: PropertyStatus.NEW_BUILD,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.FULLY_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: false,
      hasPool: false,
      hasGym: false,
      hasGarden: false,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: true,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200',
        'https://images.unsplash.com/photo-1560448075-cbc16bb4af8e?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Ready to Move', 'Fully Furnished', '8-10% ROI', 'Seafront'],
      developerId: developers[9].id, // BlueSky (placeholder)
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 9.0,
        rentalYield: 9.0,
        capitalGrowth: 0.0,
        annualAppreciation: 4.0,
        minInvestment: 48000,
        maxInvestment: 48000,
        downPaymentPercentage: 100,
        paymentPlan: 'Full payment — ready to move in',
        paymentPlanDetails: { planType: 'FULL', summary: 'Full payment required — property is ready', milestones: [{ label: 'Full Payment', percentage: 100, description: 'On purchase' }] },
        averageRentPerMonth: 380,
        mortgageAvailable: false,
        serviceFee: 150,
        propertyTax: 0,
      },
    },

    // ─── 8. Archi Ramada Batumi ───
    {
      title: 'Archi Ramada Batumi — Ramada Encore by Wyndham',
      shortDescription: 'Luxury turnkey hotel suites by Wyndham — sea views, 9-10% ROI, delivery Jan 2027',
      description: `Archi Ramada Batumi — Ramada Encore by Wyndham.

**The Project:**
- Luxury turnkey hotel suites by Archi Group
- Managed by Wyndham Hotels (Ramada Encore brand)
- Sea views from premium apartments
- Delivery: January 2027

**Investment Returns:**
- 9-10% projected annual ROI
- Professional hotel management by Wyndham
- Flexible payment plans available

**Features:**
- Fully furnished premium interiors
- Sea-view balconies
- Full Ramada hotel services
- Pool, gym, restaurant, spa

Starting from $90,000. A branded hotel investment with global management.`,
      propertyType: PropertyType.APARTMENT,
      price: 90000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 38,
      builtYear: null,
      floor: null,
      floors: 22,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: null,
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
        'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200',
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['Wyndham Managed', 'Sea Views', '9-10% ROI', 'Flexible Plans'],
      developerId: developers[1].id, // Archi
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 9.5,
        rentalYield: 9.5,
        capitalGrowth: 0.0,
        annualAppreciation: 5.0,
        minInvestment: 18000,
        maxInvestment: 90000,
        downPaymentPercentage: 20,
        paymentPlan: '20% booking, flexible installments to handover',
        paymentPlanDetails: {
          planType: 'CONSTRUCTION_LINKED',
          summary: '20% booking, installments during construction, balance on handover Jan 2027',
          milestones: [
            { label: 'Booking', percentage: 20, description: 'On reservation' },
            { label: 'During Construction', percentage: 50, description: 'Monthly installments' },
            { label: 'On Handover', percentage: 30, description: 'January 2027' },
          ],
        },
        installmentYears: 1,
        completionDate: new Date('2027-01-31'),
        handoverDate: new Date('2027-01-31'),
        expectedRentalStart: new Date('2027-02-01'),
        averageRentPerMonth: 700,
        mortgageAvailable: false,
        serviceFee: 400,
        propertyTax: 0,
      },
    },

    // ─── 9. NEXT Gardens Kvariati ───
    {
      title: 'NEXT Gardens — Kvariati',
      shortDescription: 'Seaside apartments in Kvariati — 20% down, 0% interest, up to 12% ROI',
      description: `NEXT Gardens — Kvariati, Batumi.

**The Project:**
- Premium seaside apartments in the quiet beach town of Kvariati
- Just south of Batumi — pristine coastline and mountain backdrop
- 20% down payment with 0% interest installments

**Investment Returns:**
- Up to 12% projected annual ROI
- Strong summer rental demand
- Peaceful alternative to busy Batumi center

**Features:**
- Modern architecture with sea views
- Garden areas and green spaces
- Swimming pool and fitness center
- Secure parking

Starting from $55,000. A serene seaside investment with strong returns.`,
      propertyType: PropertyType.APARTMENT,
      price: 55000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 35,
      builtYear: null,
      floor: null,
      floors: 10,
      parkingSpaces: 1,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'Kvariati',
      status: PropertyStatus.OFF_PLAN,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: false,
      hasPool: true,
      hasGym: true,
      hasGarden: true,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: true,
      hasCentralAC: true,
      images: [
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['0% Interest', 'Seaside', 'Up to 12% ROI', 'Garden Complex'],
      developerId: developers[5].id, // Tekto (placeholder)
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 12.0,
        rentalYield: 8.5,
        capitalGrowth: 3.5,
        annualAppreciation: 6.0,
        minInvestment: 11000,
        maxInvestment: 55000,
        downPaymentPercentage: 20,
        paymentPlan: '20% down, 0% interest installments',
        paymentPlanDetails: {
          planType: 'INSTALLMENTS',
          summary: '20% down payment, 80% in 0% interest installments',
          milestones: [
            { label: 'Down Payment', percentage: 20, description: 'On reservation' },
            { label: '0% Installments', percentage: 80, description: 'Monthly during construction' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 24,
          installmentAmount: 1833,
        },
        installmentYears: 2,
        completionDate: new Date('2027-12-31'),
        handoverDate: new Date('2028-03-31'),
        expectedRentalStart: new Date('2028-04-01'),
        averageRentPerMonth: 450,
        mortgageAvailable: false,
        serviceFee: 200,
        propertyTax: 0,
      },
    },

    // ─── 10. Royal Tulip Cube ───
    {
      title: 'Royal Tulip Cube',
      shortDescription: '42-floor branded residence — 300m from beach, up to 12% ROI, interest-free plans',
      description: `Royal Tulip Cube — Luxury Investment in Batumi.

**The Project:**
- 42-floor branded residential and hotel tower
- Located on Alley of Heroes, ~300m from beach
- Managed by Royal Tulip (Louvre Hotels Group)
- Interest-free payment options

**Investment Returns:**
- Up to 12% projected annual ROI
- Professional 5-star hotel management
- Owner usage days available

**Amenities:**
- Full 5-star hotel amenities
- Pool, gym, spa, restaurant
- Conference facilities
- Premium retail on lower floors

A premium branded tower with one of Batumi's best locations.`,
      propertyType: PropertyType.APARTMENT,
      price: 95000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 35,
      builtYear: null,
      floor: null,
      floors: 42,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'Alley of Heroes',
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
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200',
        'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Royal Tulip Managed', '12% ROI', '0% Interest', 'Near Beach'],
      developerId: developers[3].id, // Royal Tulip
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 12.0,
        rentalYield: 8.0,
        capitalGrowth: 4.0,
        annualAppreciation: 7.0,
        minInvestment: 19000,
        maxInvestment: 95000,
        downPaymentPercentage: 20,
        paymentPlan: 'Interest-free payment options available',
        paymentPlanDetails: {
          planType: 'INSTALLMENTS',
          summary: '20% down, 80% in interest-free installments during construction',
          milestones: [
            { label: 'Down Payment', percentage: 20, description: 'On reservation' },
            { label: '0% Interest Installments', percentage: 80, description: 'During construction' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 30,
          installmentAmount: 2533,
        },
        installmentYears: 3,
        completionDate: new Date('2028-06-30'),
        handoverDate: new Date('2028-09-30'),
        expectedRentalStart: new Date('2028-10-01'),
        averageRentPerMonth: 650,
        mortgageAvailable: false,
        serviceFee: 400,
        propertyTax: 0,
      },
    },

    // ─── 11. Novotel Living Batumi ───
    {
      title: 'Novotel Living Batumi',
      shortDescription: 'Luxury furnished apartments — sea-view, full hotel services, 10-15% annual ROI',
      description: `Novotel Living Batumi — Live. Invest. Earn.

**The Project:**
- Luxury furnished apartments by Accor's Novotel brand
- Sea-view units with full hotel services included
- Professional management by Novotel/Accor

**Investment Returns:**
- 10-15% projected annual ROI
- Global hotel brand with established booking channels
- Fully furnished — zero setup cost

**Features:**
- Sea-view apartments with premium interiors
- Full Novotel hotel services
- Restaurant, pool, gym, spa
- Conference and event facilities

A premium hotel investment backed by one of the world's largest hospitality groups.`,
      propertyType: PropertyType.APARTMENT,
      price: 120000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 42,
      builtYear: null,
      floor: null,
      floors: 28,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: null,
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
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['Novotel Brand', '10-15% ROI', 'Sea View', 'Hotel Services'],
      developerId: developers[7].id, // Novotel
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 12.5,
        rentalYield: 10.0,
        capitalGrowth: 2.5,
        annualAppreciation: 6.0,
        minInvestment: 24000,
        maxInvestment: 120000,
        downPaymentPercentage: 20,
        paymentPlan: '20% booking, installments during construction',
        paymentPlanDetails: {
          planType: 'CONSTRUCTION_LINKED',
          summary: '20% booking, installments during construction, balance on handover',
          milestones: [
            { label: 'Booking', percentage: 20, description: 'On reservation' },
            { label: 'During Construction', percentage: 50, description: 'Monthly installments' },
            { label: 'On Handover', percentage: 30, description: 'On key delivery' },
          ],
        },
        installmentYears: 2,
        completionDate: new Date('2028-06-30'),
        handoverDate: new Date('2028-09-30'),
        expectedRentalStart: new Date('2028-10-01'),
        averageRentPerMonth: 1000,
        mortgageAvailable: false,
        serviceFee: 500,
        propertyTax: 0,
      },
    },

    // ─── 12. GreenHill Residence Tbilisi ───
    {
      title: 'GreenHill Residence Tbilisi',
      shortDescription: 'Modern eco-friendly apartments in Tbilisi — from 53 sqm, flexible financing',
      description: `GreenHill Residence — Modern Living in Tbilisi.

**The Project:**
- Ecologically pristine residential complex in Tbilisi
- Panoramic city and mountain views
- Units from 53 sqm
- Flexible financing with exclusive discounts and bank settlement options

**Features:**
- Modern architectural design
- Green, eco-friendly environment
- Panoramic views from every unit
- Bank financing available

**Why Tbilisi:**
- Capital city with strongest rental demand
- Growing tech and expat community
- Liberal property ownership laws
- Strong capital appreciation

An ideal entry into Tbilisi's growing residential market.`,
      propertyType: PropertyType.APARTMENT,
      price: 75000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 53,
      builtYear: null,
      floor: null,
      floors: 16,
      parkingSpaces: 1,
      country: Country.GEORGIA,
      city: 'Tbilisi',
      district: null,
      status: PropertyStatus.OFF_PLAN,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.UNFURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: false,
      hasPool: false,
      hasGym: true,
      hasGarden: true,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: true,
      hasCentralAC: false,
      images: [
        'https://images.unsplash.com/photo-1448630360428-65456885c650?w=1200',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Eco-Friendly', 'Panoramic Views', 'Bank Financing', 'Tbilisi Capital'],
      developerId: developers[8].id, // GreenHill
      locationGuideId: locationGuides[0].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 10.0,
        rentalYield: 7.5,
        capitalGrowth: 2.5,
        annualAppreciation: 5.5,
        minInvestment: 15000,
        maxInvestment: 75000,
        downPaymentPercentage: 20,
        paymentPlan: 'Flexible financing with bank settlement options',
        paymentPlanDetails: {
          planType: 'HYBRID',
          summary: '20% down payment, flexible financing through partner banks',
          milestones: [
            { label: 'Down Payment', percentage: 20, description: 'On reservation' },
            { label: 'Bank Financing', percentage: 80, description: 'Through partner bank with competitive rates' },
          ],
        },
        completionDate: new Date('2027-12-31'),
        handoverDate: new Date('2028-03-31'),
        expectedRentalStart: new Date('2028-04-01'),
        averageRentPerMonth: 500,
        mortgageAvailable: true,
        serviceFee: 200,
        propertyTax: 150,
      },
    },

    // ─── 13. Redco Premium Apartments — New Gudauri ───
    {
      title: 'Premium Apartments by Redco — New Gudauri',
      shortDescription: 'Mountain resort apartments from $1,000/sqm — completed, white frame or turnkey',
      description: `Premium Apartments by Redco in New Gudauri, Georgia.

**The Project:**
- Premium apartments in New Gudauri ski resort
- Completed — ready to buy and use immediately
- White frame or turnkey furnished options
- Starting from $1,000/sqm

**Investment Highlights:**
- Georgia's premier ski destination with growing international tourism
- Year-round appeal: skiing in winter, hiking/paragliding in summer
- Strong short-term rental returns during peak seasons
- Government-backed resort infrastructure

**Features:**
- Mountain panoramic views
- Ski-in/ski-out proximity
- Modern architecture and premium finishes
- Flexible payment plans available

New Gudauri is rapidly becoming the Caucasus equivalent of European alpine resorts.`,
      propertyType: PropertyType.APARTMENT,
      price: 65000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 55,
      builtYear: 2024,
      floor: 3,
      floors: 8,
      parkingSpaces: 1,
      country: Country.GEORGIA,
      city: 'Gudauri',
      district: 'New Gudauri',
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
      hasCentralAC: false,
      images: [
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Ski Resort', 'Completed', '$1,000/sqm', 'Mountain Views'],
      developerId: developers[6].id, // Redco
      locationGuideId: gudauriGuide.id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 11.0,
        rentalYield: 9.0,
        capitalGrowth: 2.0,
        annualAppreciation: 8.0,
        minInvestment: 13000,
        maxInvestment: 65000,
        downPaymentPercentage: 20,
        paymentPlan: 'Flexible payment plans available',
        paymentPlanDetails: {
          planType: 'SPLIT',
          summary: '20% down payment, 80% flexible financing',
          milestones: [
            { label: 'Down Payment', percentage: 20, description: 'On purchase' },
            { label: 'Balance', percentage: 80, description: 'Flexible payment options' },
          ],
        },
        averageRentPerMonth: 500,
        mortgageAvailable: true,
        serviceFee: 200,
        propertyTax: 0,
      },
    },

    // ─── 14. Tekto Rakurs — Chakvi ───
    {
      title: 'Tekto Rakurs — Chakvi',
      shortDescription: 'Premium apartments steps from the Black Sea in Chakvi — modern design, flexible payment',
      description: `Tekto Rakurs — Premium Apartments Steps from the Black Sea.

**The Project:**
- Modern unfurnished apartments in Chakvi, Georgia
- Premium Black Sea views
- Flexible payment plans with brochure available on request

**Location — Chakvi:**
- Quiet coastal town between Batumi and Kobuleti
- Clean beaches without the city crowds
- Growing area with strong appreciation potential

**Features:**
- Modern architecture and design
- Premium amenities
- Black Sea proximity
- Payment plans available

Contact us for brochures and detailed pricing.`,
      propertyType: PropertyType.APARTMENT,
      price: 60000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 40,
      builtYear: null,
      floor: null,
      floors: 12,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Chakvi',
      district: null,
      status: PropertyStatus.OFF_PLAN,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.UNFURNISHED,
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
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
        'https://images.unsplash.com/photo-1560448075-cbc16bb4af8e?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Black Sea Views', 'Modern Design', 'Quiet Location', 'Flexible Payment'],
      developerId: developers[5].id, // Tekto
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 10.5,
        rentalYield: 7.5,
        capitalGrowth: 3.0,
        annualAppreciation: 5.0,
        minInvestment: 12000,
        maxInvestment: 60000,
        downPaymentPercentage: 20,
        paymentPlan: 'Flexible payment plans — contact for details',
        paymentPlanDetails: {
          planType: 'INSTALLMENTS',
          summary: '20% down, 80% in installments',
          milestones: [
            { label: 'Down Payment', percentage: 20, description: 'On reservation' },
            { label: 'Installments', percentage: 80, description: 'During construction' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 24,
          installmentAmount: 2000,
        },
        installmentYears: 2,
        completionDate: new Date('2027-12-31'),
        handoverDate: new Date('2028-03-31'),
        expectedRentalStart: new Date('2028-04-01'),
        averageRentPerMonth: 400,
        mortgageAvailable: false,
        serviceFee: 150,
        propertyTax: 0,
      },
    },

    // ─── 15. Tekto Franco — Makhinjauri ───
    {
      title: 'Tekto Franco — Makhinjauri',
      shortDescription: 'Modern seaside living in Makhinjauri resort — from $625/sqm, smart home features',
      description: `Tekto Franco — Modern Apartment Living in Makhinjauri Resort, Georgia.

**The Project:**
- Luxury seaside apartments in Makhinjauri
- Starting from just $625/sqm — exceptional value
- Smart home capabilities in every unit
- Modern design with full resort amenities

**Location — Makhinjauri:**
- Popular resort town adjacent to Batumi
- Clean beaches and relaxed atmosphere
- 10 minutes from Batumi center
- Growing tourism infrastructure

**Features:**
- Smart home integration
- Modern European design
- Full resort amenities
- Flexible payment plans

One of the best value propositions on the Black Sea coast.`,
      propertyType: PropertyType.APARTMENT,
      price: 38000,
      currency: 'USD',
      bedrooms: 0,
      bathrooms: 1,
      area: 32,
      builtYear: null,
      floor: null,
      floors: 14,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'Makhinjauri',
      status: PropertyStatus.OFF_PLAN,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
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
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['$625/sqm', 'Smart Home', 'Seaside Resort', 'Best Value'],
      developerId: developers[5].id, // Tekto
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 11.5,
        rentalYield: 8.0,
        capitalGrowth: 3.5,
        annualAppreciation: 6.0,
        minInvestment: 7600,
        maxInvestment: 38000,
        downPaymentPercentage: 20,
        paymentPlan: '20% down, flexible installments',
        paymentPlanDetails: {
          planType: 'INSTALLMENTS',
          summary: '20% down, 80% in monthly installments',
          milestones: [
            { label: 'Down Payment', percentage: 20, description: 'On reservation' },
            { label: 'Monthly Installments', percentage: 80, description: 'During construction' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 24,
          installmentAmount: 1267,
        },
        installmentYears: 2,
        completionDate: new Date('2027-06-30'),
        handoverDate: new Date('2027-09-30'),
        expectedRentalStart: new Date('2027-10-01'),
        averageRentPerMonth: 300,
        mortgageAvailable: false,
        serviceFee: 100,
        propertyTax: 0,
      },
    },

    // ─── 16. Kobuleti Investment Apartments ───
    {
      title: 'Kobuleti Investment Apartments',
      shortDescription: 'Prime coastal investment with guaranteed sea/mountain views — exclusive 0% installment plan',
      description: `Prime Investment Apartments in Kobuleti, Georgia.

**The Project:**
- Investment apartments in the coastal town of Kobuleti
- Guaranteed sea and mountain views from every unit
- Exclusive 0% installment plan available
- Targeting high-yield coastal investment

**Location — Kobuleti:**
- 20 km north of Batumi along the Black Sea coast
- Long sandy beaches — one of the best on the Georgian coast
- More affordable than Batumi with strong appreciation potential
- Growing tourism infrastructure and international interest

**Investment Highlights:**
- 0% installment plan available
- Sea and mountain views guaranteed
- Strong rental demand during summer season
- Appreciation potential as Kobuleti develops

An affordable coastal entry point with strong upside.`,
      propertyType: PropertyType.APARTMENT,
      price: 42000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 35,
      builtYear: null,
      floor: null,
      floors: 10,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Kobuleti',
      district: null,
      status: PropertyStatus.OFF_PLAN,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: false,
      hasPool: true,
      hasGym: false,
      hasGarden: false,
      hasBalcony: true,
      hasSecurity: true,
      hasElevator: true,
      hasCentralAC: false,
      images: [
        'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1200',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['0% Installments', 'Sea & Mountain Views', 'Coastal Location', 'Affordable'],
      developerId: developers[5].id, // Tekto (placeholder)
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 10.0,
        rentalYield: 8.0,
        capitalGrowth: 2.0,
        annualAppreciation: 5.0,
        minInvestment: 8400,
        maxInvestment: 42000,
        downPaymentPercentage: 20,
        paymentPlan: 'Exclusive 0% installment plan',
        paymentPlanDetails: {
          planType: 'INSTALLMENTS',
          summary: '20% down, 80% in 0% interest installments',
          milestones: [
            { label: 'Down Payment', percentage: 20, description: 'On reservation' },
            { label: '0% Installments', percentage: 80, description: 'Monthly installments' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 24,
          installmentAmount: 1400,
        },
        installmentYears: 2,
        completionDate: new Date('2027-12-31'),
        handoverDate: new Date('2028-03-31'),
        expectedRentalStart: new Date('2028-06-01'),
        averageRentPerMonth: 300,
        mortgageAvailable: false,
        serviceFee: 100,
        propertyTax: 0,
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

  console.log(`✅ Created ${createdProperties.length} apartments with investment data & payment plans`)

  // ============================================
  // 5. CREATE TAGS
  // ============================================
  console.log('\n🏷️  Creating tags...')
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { name: 'Beachfront' },
      update: {},
      create: { name: 'Beachfront', slug: 'beachfront', description: 'Properties with direct beach access', category: 'location', color: '#3B82F6', icon: 'beach' },
    }),
    prisma.tag.upsert({
      where: { name: 'High ROI' },
      update: {},
      create: { name: 'High ROI', slug: 'high-roi', description: 'Properties with exceptional return on investment', category: 'investment_type', color: '#10B981', icon: 'trending-up' },
    }),
    prisma.tag.upsert({
      where: { name: 'New Build' },
      update: {},
      create: { name: 'New Build', slug: 'new-build', description: 'Brand new construction', category: 'feature', color: '#8B5CF6', icon: 'home' },
    }),
    prisma.tag.upsert({
      where: { name: 'Sea View' },
      update: {},
      create: { name: 'Sea View', slug: 'sea-view', description: 'Properties with sea views', category: 'feature', color: '#06B6D4', icon: 'waves' },
    }),
    prisma.tag.upsert({
      where: { name: 'Off-Plan' },
      update: {},
      create: { name: 'Off-Plan', slug: 'off-plan', description: 'Pre-construction investment opportunity', category: 'investment_type', color: '#F59E0B', icon: 'clock' },
    }),
  ])

  // Tag assignments
  const highROITag = tags.find(t => t.slug === 'high-roi')!
  const beachfrontTag = tags.find(t => t.slug === 'beachfront')!
  const newBuildTag = tags.find(t => t.slug === 'new-build')!
  const seaViewTag = tags.find(t => t.slug === 'sea-view')!
  const offPlanTag = tags.find(t => t.slug === 'off-plan')!

  const tagAssignments = [
    // 0: Tonino Lamborghini Tower — Beachfront, Sea View, Off-Plan, High ROI
    { propertyId: createdProperties[0].id, tagId: beachfrontTag.id },
    { propertyId: createdProperties[0].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[0].id, tagId: offPlanTag.id },
    { propertyId: createdProperties[0].id, tagId: highROITag.id },
    // 1: BlueSky Tower — New Build, Off-Plan
    { propertyId: createdProperties[1].id, tagId: newBuildTag.id },
    { propertyId: createdProperties[1].id, tagId: offPlanTag.id },
    // 2: Rotana Pontus Gonio — Beachfront, Sea View, High ROI, Off-Plan
    { propertyId: createdProperties[2].id, tagId: beachfrontTag.id },
    { propertyId: createdProperties[2].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[2].id, tagId: highROITag.id },
    { propertyId: createdProperties[2].id, tagId: offPlanTag.id },
    // 3: Alliance Centropolis Hyatt — Off-Plan, New Build
    { propertyId: createdProperties[3].id, tagId: offPlanTag.id },
    { propertyId: createdProperties[3].id, tagId: newBuildTag.id },
    // 4: OKTO Art House — Off-Plan
    { propertyId: createdProperties[4].id, tagId: offPlanTag.id },
    // 5: Royal Tulip Oval — Off-Plan, Sea View, High ROI
    { propertyId: createdProperties[5].id, tagId: offPlanTag.id },
    { propertyId: createdProperties[5].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[5].id, tagId: highROITag.id },
    // 6: Sunway Suites — Beachfront, Sea View, New Build
    { propertyId: createdProperties[6].id, tagId: beachfrontTag.id },
    { propertyId: createdProperties[6].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[6].id, tagId: newBuildTag.id },
    // 7: Archi Ramada Wyndham — Sea View, Off-Plan, High ROI
    { propertyId: createdProperties[7].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[7].id, tagId: offPlanTag.id },
    { propertyId: createdProperties[7].id, tagId: highROITag.id },
    // 8: NEXT Gardens Kvariati — Beachfront, Sea View, Off-Plan, High ROI
    { propertyId: createdProperties[8].id, tagId: beachfrontTag.id },
    { propertyId: createdProperties[8].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[8].id, tagId: offPlanTag.id },
    { propertyId: createdProperties[8].id, tagId: highROITag.id },
    // 9: Royal Tulip Cube — Off-Plan, Sea View, High ROI
    { propertyId: createdProperties[9].id, tagId: offPlanTag.id },
    { propertyId: createdProperties[9].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[9].id, tagId: highROITag.id },
    // 10: Novotel Living Batumi — Off-Plan, New Build, High ROI
    { propertyId: createdProperties[10].id, tagId: offPlanTag.id },
    { propertyId: createdProperties[10].id, tagId: newBuildTag.id },
    { propertyId: createdProperties[10].id, tagId: highROITag.id },
    // 11: GreenHill Residence Tbilisi — New Build
    { propertyId: createdProperties[11].id, tagId: newBuildTag.id },
    // 12: Redco New Gudauri — New Build
    { propertyId: createdProperties[12].id, tagId: newBuildTag.id },
    // 13: Tekto Rakurs Chakvi — Sea View, Off-Plan
    { propertyId: createdProperties[13].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[13].id, tagId: offPlanTag.id },
    // 14: Tekto Franco Makhinjauri — Sea View, Off-Plan
    { propertyId: createdProperties[14].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[14].id, tagId: offPlanTag.id },
    // 15: Kobuleti Apartments — Sea View, Off-Plan
    { propertyId: createdProperties[15].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[15].id, tagId: offPlanTag.id },
  ]

  for (const ta of tagAssignments) {
    await prisma.propertyTag.create({ data: ta }).catch(() => {}) // skip duplicates
  }

  console.log(`✅ Created ${tags.length} tags with property assignments`)

  // ============================================
  // 6. CREATE AMENITIES
  // ============================================
  console.log('\n✨ Creating property amenities...')
  const amenityData = [
    // 0: Tonino Lamborghini Tower
    { propertyId: createdProperties[0].id, name: 'Concierge Service', category: 'Services', description: '24/7 luxury concierge', icon: 'concierge' },
    { propertyId: createdProperties[0].id, name: 'Swimming Pool', category: 'Recreation', description: 'Infinity pool with sea views', icon: 'pool' },
    { propertyId: createdProperties[0].id, name: 'Spa & Sauna', category: 'Recreation', description: 'Full luxury spa', icon: 'spa' },
    { propertyId: createdProperties[0].id, name: 'Underground Parking', category: 'Parking', description: 'Secure underground parking', icon: 'parking' },
    // 2: Rotana Pontus Gonio
    { propertyId: createdProperties[2].id, name: 'Private Beach', category: 'Outdoor', description: 'Direct beach access', icon: 'beach' },
    { propertyId: createdProperties[2].id, name: 'Spa & Sauna', category: 'Recreation', description: '5-star spa facilities', icon: 'spa' },
    { propertyId: createdProperties[2].id, name: 'Swimming Pool', category: 'Recreation', description: 'Resort-style pools', icon: 'pool' },
    { propertyId: createdProperties[2].id, name: 'Restaurant', category: 'Services', description: 'On-site fine dining', icon: 'restaurant' },
    // 3: Alliance Centropolis Hyatt
    { propertyId: createdProperties[3].id, name: 'Fitness Center', category: 'Recreation', description: 'Hyatt-branded gym', icon: 'fitness' },
    { propertyId: createdProperties[3].id, name: 'Rooftop Terrace', category: 'Common Areas', description: 'Panoramic city views', icon: 'terrace' },
    // 5: Royal Tulip Oval
    { propertyId: createdProperties[5].id, name: 'Concierge Service', category: 'Services', description: 'Hotel-managed concierge', icon: 'concierge' },
    { propertyId: createdProperties[5].id, name: 'Swimming Pool', category: 'Recreation', description: 'Hotel pool', icon: 'pool' },
    // 7: Archi Ramada Wyndham
    { propertyId: createdProperties[7].id, name: 'Swimming Pool', category: 'Recreation', description: 'Ramada resort pool', icon: 'pool' },
    { propertyId: createdProperties[7].id, name: 'Spa & Sauna', category: 'Recreation', description: 'Full spa facilities', icon: 'spa' },
    { propertyId: createdProperties[7].id, name: 'Restaurant', category: 'Services', description: 'Ramada on-site restaurant', icon: 'restaurant' },
    // 10: Novotel Living Batumi
    { propertyId: createdProperties[10].id, name: 'Fitness Center', category: 'Recreation', description: 'Accor-branded gym', icon: 'fitness' },
    { propertyId: createdProperties[10].id, name: 'Restaurant', category: 'Services', description: 'Novotel dining', icon: 'restaurant' },
    // 11: GreenHill Residence Tbilisi
    { propertyId: createdProperties[11].id, name: 'Landscaped Garden', category: 'Outdoor', description: 'Eco-friendly communal garden', icon: 'garden' },
    { propertyId: createdProperties[11].id, name: 'Children Playground', category: 'Recreation', description: 'Modern playground', icon: 'playground' },
    // 12: Redco New Gudauri
    { propertyId: createdProperties[12].id, name: 'Ski Storage', category: 'Services', description: 'Heated ski and gear storage', icon: 'storage' },
    { propertyId: createdProperties[12].id, name: 'Fitness Center', category: 'Recreation', description: 'Residents gym', icon: 'fitness' },
  ]

  for (const am of amenityData) {
    await prisma.propertyAmenity.create({ data: am })
  }

  console.log(`✅ Created ${amenityData.length} amenities`)

  // ============================================
  // 7. USER INTERACTIONS
  // ============================================
  console.log('\n💝 Creating user interactions...')
  await prisma.favoriteProperty.createMany({
    data: [
      { userId: testUser.id, propertyId: createdProperties[0].id },  // Lamborghini Tower
      { userId: testUser.id, propertyId: createdProperties[2].id },  // Rotana Pontus
      { userId: testUser.id, propertyId: createdProperties[12].id }, // Redco Gudauri
      { userId: eliteUser.id, propertyId: createdProperties[0].id }, // Lamborghini Tower
      { userId: eliteUser.id, propertyId: createdProperties[5].id }, // Royal Tulip Oval
      { userId: eliteUser.id, propertyId: createdProperties[10].id }, // Novotel Living
    ],
    skipDuplicates: true,
  })

  await prisma.propertyInquiry.createMany({
    data: [
      {
        userId: testUser.id,
        propertyId: createdProperties[0].id,
        name: 'Test User',
        email: 'user@propgroup.com',
        phone: '+1 555 0123',
        message: 'I am interested in the Tonino Lamborghini Tower. Could you provide more details about the payment plan and available units?',
      },
      {
        userId: eliteUser.id,
        propertyId: createdProperties[2].id,
        name: 'Elite Member',
        email: 'elite@propgroup.com',
        phone: '+44 20 7123 4567',
        message: 'I would like to discuss the Rotana Pontus Gonio project and the 12.5% ROI in detail. Can we arrange a call?',
      },
      {
        userId: testUser.id,
        propertyId: createdProperties[4].id,
        name: 'Test User',
        email: 'user@propgroup.com',
        phone: '+1 555 0123',
        message: 'The OKTO Art House looks very affordable. What are the exact installment terms and when is delivery expected?',
      },
    ],
  })

  console.log('✅ Created favorites and inquiries')

  // ============================================
  // 8. NOTIFICATIONS
  // ============================================
  console.log('\n🔔 Creating notifications...')
  await prisma.notification.createMany({
    data: [
      {
        userId: testUser.id,
        type: 'PROPERTY_UPDATE',
        title: 'New Listing: Tonino Lamborghini Tower',
        message: 'A luxury branded residence just listed on Batumi Island — starting from $165,000',
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
        title: 'High ROI Match: Rotana Pontus Gonio',
        message: '12.5% projected ROI — a 5-star beachfront resort in Gonio matching your investment goals',
        link: `/properties/${createdProperties[2].id}`,
        actionLabel: 'View Property',
        actionUrl: `/properties/${createdProperties[2].id}`,
        relatedEntityType: 'property',
        relatedEntityId: createdProperties[2].id,
        priority: 'normal',
      },
      {
        userId: eliteUser.id,
        type: 'NEW_MATCHING_PROPERTY',
        title: 'Budget-Friendly: OKTO Art House from $45K',
        message: 'New affordable option with 0% installments — great for first-time investors',
        link: `/properties/${createdProperties[4].id}`,
        actionLabel: 'View Property',
        actionUrl: `/properties/${createdProperties[4].id}`,
        relatedEntityType: 'property',
        relatedEntityId: createdProperties[4].id,
        priority: 'normal',
      },
    ],
  })

  console.log('✅ Created notifications')

  // ============================================
  // 9. SITE CONTENT (CMS)
  // ============================================
  console.log('\n📄 Seeding site content...')

  const siteContentData = [
    { key: 'hero_title', section: 'hero', title: 'Hero Title', content: 'Your Gateway to Georgian Real Estate Investment', sortOrder: 1 },
    { key: 'hero_subtitle', section: 'hero', title: 'Hero Subtitle', content: 'Discover high-yield apartments in Tbilisi and Batumi with flexible payment plans', sortOrder: 2 },
    { key: 'hero_cta_text', section: 'hero', title: 'Hero CTA Text', content: 'Explore Properties', sortOrder: 3 },
    { key: 'hero_cta_link', section: 'hero', title: 'Hero CTA Link', content: '/properties', sortOrder: 4 },

    { key: 'about_title', section: 'about', title: 'About Title', content: 'About PropGroup', sortOrder: 1 },
    { key: 'about_intro', section: 'about', title: 'About Introduction', content: 'PropGroup is a leading real estate investment platform connecting investors with premium properties across Georgia.', sortOrder: 2 },
    { key: 'about_mission', section: 'about', title: 'Our Mission', content: 'To make Georgian real estate investment accessible, transparent, and profitable for everyone.', sortOrder: 3 },

    { key: 'features_title', section: 'features', title: 'Features Title', content: 'Why Choose PropGroup', sortOrder: 1 },
    { key: 'feature_1', section: 'features', title: 'Expert Guidance', content: 'Our team of local experts guides you through every step of the investment process.', sortOrder: 2 },
    { key: 'feature_2', section: 'features', title: 'Flexible Payment Plans', content: 'From split payments to post-handover plans — we match your budget.', sortOrder: 3 },
    { key: 'feature_3', section: 'features', title: 'High ROI Properties', content: 'Curated apartments with proven rental yields of 7-12% and strong capital growth.', sortOrder: 4 },

    { key: 'cta_title', section: 'cta', title: 'CTA Title', content: 'Ready to Start Your Investment Journey?', sortOrder: 1 },
    { key: 'cta_subtitle', section: 'cta', title: 'CTA Subtitle', content: 'Browse our curated selection of Georgian apartments or speak with an advisor today.', sortOrder: 2 },
    { key: 'cta_button_text', section: 'cta', title: 'CTA Button Text', content: 'Get Started', sortOrder: 3 },
    { key: 'cta_button_link', section: 'cta', title: 'CTA Button Link', content: '/get-started', sortOrder: 4 },

    { key: 'contact_email', section: 'contact', title: 'Contact Email', content: 'info@propgroup.com', sortOrder: 1 },
    { key: 'contact_phone', section: 'contact', title: 'Contact Phone', content: '+995 32 123 456', sortOrder: 2 },
    { key: 'contact_address', section: 'contact', title: 'Contact Address', content: 'Tbilisi, Georgia', sortOrder: 3 },

    { key: 'footer_tagline', section: 'footer', title: 'Footer Tagline', content: 'Premium Georgian Real Estate Investment Platform', sortOrder: 1 },
    { key: 'footer_copyright', section: 'footer', title: 'Footer Copyright', content: '© 2026 PropGroup. All rights reserved.', sortOrder: 2 },
  ]

  for (const item of siteContentData) {
    await prisma.siteContent.upsert({
      where: { key: item.key },
      update: { ...item },
      create: { ...item },
    })
  }
  console.log(`✅ Created ${siteContentData.length} site content entries`)

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50))
  console.log('🎉 Database seed completed successfully!')
  console.log('='.repeat(50))
  console.log('\n📊 Summary:')
  console.log('   • 4 Users (Super Admin, Agent, Test User, Elite Member)')
  console.log(`   • ${developers.length} Developers (real Georgia-based companies)`)
  console.log(`   • ${locationGuides.length} Location Guides`)
  console.log(`   • ${createdProperties.length} Properties from propgrp.com (real listings)`)
  console.log(`   • ${tags.length} Tags with property assignments`)
  console.log(`   • ${amenityData.length} Amenities`)
  console.log('   • Favorites, Inquiries, Notifications')
  console.log('\n📍 Cities Covered:')
  console.log('   • Batumi (10 properties)')
  console.log('   • Tbilisi (1 property)')
  console.log('   • Gudauri (1 property)')
  console.log('   • Gonio, Kvariati, Chakvi, Makhinjauri, Kobuleti')
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
