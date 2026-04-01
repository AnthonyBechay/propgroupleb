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
      name: 'Archi Development',
      description:
        'Leading developer in Georgia with over 15 years of experience in premium residential projects across Tbilisi. Known for innovative architectural designs and sustainable building practices.',
      website: 'https://archidevelopment.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400',
    }),
    upsertDeveloper({
      name: 'Batumi Beach Developments',
      description:
        'Beachfront property specialist in Batumi, Georgia. Expert in high-yield investment properties with stunning Black Sea views and modern amenities.',
      website: 'https://batumibeach.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400',
    }),
    upsertDeveloper({
      name: 'Tbilisi Premium Living',
      description:
        'Boutique developer focused on upscale residential projects in Tbilisi\'s most desirable neighborhoods. Premium finishes and smart-home integration in every unit.',
      website: 'https://tbilisipremium.ge',
      country: Country.GEORGIA,
      logo: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400',
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

  console.log(`✅ Created ${locationGuides.length} location guides`)

  // ============================================
  // 4. CREATE 6 APARTMENTS WITH INVESTMENT DATA
  // ============================================
  console.log('\n🏠 Creating 6 apartments with diverse features and payment plans...')

  const propertiesData = [
    // ─── PROPERTY 1: FEATURED — Luxury Vake apartment, Split payment ───
    {
      title: 'Luxury Apartment in Vake District',
      shortDescription: 'Modern 2-bedroom in Tbilisi\'s most prestigious neighborhood',
      description: `Stunning 2-bedroom apartment in the heart of Vake, Tbilisi's most desirable residential area.

**Features:**
- Panoramic city and mountain views
- High-quality German fixtures and fittings
- Smart home system integration
- Underground parking space
- 24/7 security and concierge
- Walking distance to Vake Park

Perfect for both residential living and investment purposes with strong rental demand from expats and professionals.`,
      propertyType: PropertyType.APARTMENT,
      price: 185000,
      currency: 'USD',
      bedrooms: 2,
      bathrooms: 2,
      area: 95,
      builtYear: 2025,
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
      featuredUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['High ROI', 'City Center', 'Ready to Move', 'Payment Plan'],
      developerId: developers[0].id,
      locationGuideId: locationGuides[0].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 12.5,
        rentalYield: 7.8,
        capitalGrowth: 4.7,
        annualAppreciation: 6.0,
        minInvestment: 55500,
        maxInvestment: 185000,
        downPaymentPercentage: 30,
        paymentPlan: '30% down payment, 70% on completion',
        paymentPlanDetails: {
          planType: 'SPLIT',
          summary: '30% down payment, 70% on completion',
          milestones: [
            { label: 'Down Payment', percentage: 30, description: 'On booking / contract signing' },
            { label: 'On Completion', percentage: 70, description: 'On key handover' },
          ],
        },
        installmentYears: 0,
        completionDate: new Date('2026-06-30'),
        handoverDate: new Date('2026-07-31'),
        expectedRentalStart: new Date('2026-08-01'),
        averageRentPerMonth: 1200,
        mortgageAvailable: true,
        serviceFee: 800,
        propertyTax: 350,
      },
    },

    // ─── PROPERTY 2: FEATURED — Off-plan Batumi beachfront, Construction-Linked ───
    {
      title: 'Beachfront Apartment in New Boulevard',
      shortDescription: 'Off-plan 1-bedroom with Black Sea views and hotel management',
      description: `Prime beachfront apartment in Batumi's booming New Boulevard area, part of a 5-star hotel complex.

**Property Highlights:**
- Direct Black Sea views from floor-to-ceiling windows
- Part of hotel management program — hassle-free rental income
- Access to pool, spa, and restaurant
- 50 meters from the beach
- Modern furnishings included

**Investment Benefits:**
- Guaranteed rental income option via hotel operator
- Strong tourism-driven demand year-round
- Off-plan pricing — buy below market value

Ideal for hands-off investors seeking strong returns in Georgia's top resort city.`,
      propertyType: PropertyType.APARTMENT,
      price: 78000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 48,
      builtYear: null,
      floor: 14,
      floors: 22,
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
      highlightedFeatures: ['Beachfront', 'Hotel Management', 'Off-Plan Discount', 'High Yield'],
      developerId: developers[1].id,
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 15.5,
        rentalYield: 9.2,
        capitalGrowth: 6.3,
        annualAppreciation: 7.5,
        minInvestment: 15600,
        maxInvestment: 78000,
        downPaymentPercentage: 20,
        paymentPlan: '20% booking, 30% during construction, 50% on handover',
        paymentPlanDetails: {
          planType: 'CONSTRUCTION_LINKED',
          summary: '20% booking, 30% during construction milestones, 50% on handover',
          milestones: [
            { label: 'Booking', percentage: 20, description: 'On reservation' },
            { label: 'Foundation Complete', percentage: 15, description: 'When foundation is laid' },
            { label: 'Structure Complete', percentage: 15, description: 'When building structure is done' },
            { label: 'On Handover', percentage: 50, description: 'On key handover' },
          ],
        },
        installmentYears: 3,
        completionDate: new Date('2028-09-30'),
        handoverDate: new Date('2028-10-31'),
        expectedRentalStart: new Date('2028-11-01'),
        averageRentPerMonth: 600,
        mortgageAvailable: false,
        serviceFee: 420,
        propertyTax: 0,
      },
    },

    // ─── PROPERTY 3: FEATURED — Premium Saburtalo, Hybrid payment ───
    {
      title: 'Premium Saburtalo Residence',
      shortDescription: 'Spacious 3-bedroom near universities with mountain views',
      description: `Elegant 3-bedroom apartment in the thriving Saburtalo district, one of Tbilisi's fastest-growing areas.

**Property Features:**
- 120 sqm of open-plan living
- Floor-to-ceiling windows with Caucasus mountain views
- Italian marble bathrooms
- Bosch integrated kitchen appliances
- Underfloor heating throughout
- Two covered balconies
- Secure underground parking

**Location:**
- Walking distance to Tbilisi State University
- Medical University and international schools nearby
- Metro station 5 minutes walk
- Shopping centers and restaurants within reach

Strong rental demand from students, faculty, and medical professionals.`,
      propertyType: PropertyType.APARTMENT,
      price: 210000,
      currency: 'USD',
      bedrooms: 3,
      bathrooms: 2,
      area: 120,
      builtYear: null,
      floor: 6,
      floors: 16,
      parkingSpaces: 1,
      country: Country.GEORGIA,
      city: 'Tbilisi',
      district: 'Saburtalo',
      status: PropertyStatus.OFF_PLAN,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.UNFURNISHED,
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
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200',
        'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200',
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200',
      ],
      featured: true,
      featuredUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      highlightedFeatures: ['Mountain Views', 'Near Metro', 'Off-Plan Price', 'Payment Plan'],
      developerId: developers[2].id,
      locationGuideId: locationGuides[0].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 11.0,
        rentalYield: 7.0,
        capitalGrowth: 4.0,
        annualAppreciation: 5.5,
        minInvestment: 21000,
        maxInvestment: 210000,
        downPaymentPercentage: 10,
        paymentPlan: '10% down, monthly payments to 50%, bulk 50% on completion',
        paymentPlanDetails: {
          planType: 'HYBRID',
          summary: '10% initial payment, monthly installments until 50%, then 50% bulk on completion',
          milestones: [
            { label: 'Initial Payment', percentage: 10, description: 'On booking' },
            { label: 'Monthly Installments', percentage: 40, description: 'Monthly payments during construction' },
            { label: 'Bulk Payment', percentage: 50, description: 'On handover / completion' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 24,
          installmentAmount: 3500,
        },
        installmentYears: 2,
        completionDate: new Date('2028-03-31'),
        handoverDate: new Date('2028-04-30'),
        expectedRentalStart: new Date('2028-06-01'),
        averageRentPerMonth: 1250,
        mortgageAvailable: true,
        serviceFee: 950,
        propertyTax: 280,
      },
    },

    // ─── PROPERTY 4: NOT FEATURED — Compact Vera studio, Monthly Installments ───
    {
      title: 'Cozy Apartment in Vera',
      shortDescription: 'Renovated 1-bedroom in trendy central Vera district',
      description: `Charming renovated 1-bedroom apartment in Vera, one of Tbilisi's most sought-after central neighborhoods.

**Features:**
- Newly renovated with modern finishes
- Original high ceilings preserved
- Exposed brick accent walls
- Compact but efficient kitchen
- Walk-in rain shower
- Wooden floors throughout

**Neighborhood:**
- Cafes, galleries, and boutiques on your doorstep
- Tbilisi's trendiest restaurants within walking distance
- Rustaveli Avenue 10 minutes walk
- Freedom Square and Old Town nearby

Perfect for Airbnb short-term rental — Vera is the #1 neighborhood for tourists and digital nomads.`,
      propertyType: PropertyType.APARTMENT,
      price: 92000,
      currency: 'USD',
      bedrooms: 1,
      bathrooms: 1,
      area: 52,
      builtYear: 2024,
      floor: 3,
      floors: 5,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Tbilisi',
      district: 'Vera',
      status: PropertyStatus.RESALE,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.FULLY_FURNISHED,
      ownershipType: OwnershipType.FREEHOLD,
      isGoldenVisaEligible: false,
      hasPool: false,
      hasGym: false,
      hasGarden: false,
      hasBalcony: true,
      hasSecurity: false,
      hasElevator: false,
      hasCentralAC: false,
      images: [
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200',
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Trendy Location', 'Fully Furnished', 'Airbnb Ready', 'High Demand'],
      developerId: developers[0].id,
      locationGuideId: locationGuides[0].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 14.2,
        rentalYield: 10.5,
        capitalGrowth: 3.7,
        annualAppreciation: 4.8,
        minInvestment: 18400,
        maxInvestment: 92000,
        downPaymentPercentage: 20,
        paymentPlan: '20% down payment, balance in 12 monthly installments',
        paymentPlanDetails: {
          planType: 'INSTALLMENTS',
          summary: '20% down payment, remaining 80% in 12 equal monthly installments',
          milestones: [
            { label: 'Down Payment', percentage: 20, description: 'On signing purchase agreement' },
            { label: 'Monthly Installments', percentage: 80, description: '12 equal monthly payments' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 12,
          installmentAmount: 6133,
        },
        averageRentPerMonth: 800,
        mortgageAvailable: false,
        serviceFee: 0,
        propertyTax: 180,
      },
    },

    // ─── PROPERTY 5: NOT FEATURED — Batumi Old Town, Post-Handover Plan ───
    {
      title: 'Batumi Old Town Apartment',
      shortDescription: 'Character 2-bedroom near Piazza Square with sea glimpses',
      description: `Beautiful 2-bedroom apartment in the heart of Batumi's historic Old Town, steps from famous Piazza Square.

**Property Features:**
- Blend of historic architecture and modern interiors
- 75 sqm with efficient European layout
- Renovated kitchen and bathrooms
- Sea glimpses from the living room
- Original ornamental balcony
- High ceilings and large windows

**Old Town Living:**
- Piazza Square cafes and nightlife steps away
- Batumi Boulevard and beach 5 minutes walk
- Casino district nearby
- Local markets and restaurants
- Rich cultural atmosphere

Year-round rental potential from both tourists and long-term tenants.`,
      propertyType: PropertyType.APARTMENT,
      price: 115000,
      currency: 'USD',
      bedrooms: 2,
      bathrooms: 1,
      area: 75,
      builtYear: 2023,
      floor: 4,
      floors: 6,
      parkingSpaces: 0,
      country: Country.GEORGIA,
      city: 'Batumi',
      district: 'Old Town',
      status: PropertyStatus.NEW_BUILD,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
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
        'https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=1200',
        'https://images.unsplash.com/photo-1574643156929-51fa098b0394?w=1200',
        'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Old Town', 'Sea Glimpses', 'Year-Round Rental', 'Post-Handover Plan'],
      developerId: developers[1].id,
      locationGuideId: locationGuides[1].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 13.0,
        rentalYield: 8.8,
        capitalGrowth: 4.2,
        annualAppreciation: 5.0,
        minInvestment: 34500,
        maxInvestment: 115000,
        downPaymentPercentage: 30,
        paymentPlan: '30% during construction, 70% post-handover over 2 years',
        paymentPlanDetails: {
          planType: 'POST_HANDOVER',
          summary: '30% before handover, 70% in monthly installments over 24 months after receiving keys',
          milestones: [
            { label: 'During Construction', percentage: 30, description: 'Spread across construction milestones' },
            { label: 'Post-Handover Payments', percentage: 70, description: 'Monthly installments after key handover' },
          ],
          installmentFrequency: 'monthly',
          totalInstallments: 24,
          postHandoverMonths: 24,
          postHandoverPercentage: 70,
          installmentAmount: 3354,
        },
        completionDate: new Date('2026-12-31'),
        handoverDate: new Date('2027-01-31'),
        expectedRentalStart: new Date('2027-02-01'),
        averageRentPerMonth: 850,
        mortgageAvailable: false,
        serviceFee: 300,
        propertyTax: 0,
      },
    },

    // ─── PROPERTY 6: NOT FEATURED — Didi Dighomi family apartment, Custom plan ───
    {
      title: 'Family Apartment in Didi Dighomi',
      shortDescription: 'Spacious 4-bedroom in Tbilisi\'s modern suburban district',
      description: `Generous 4-bedroom apartment in Didi Dighomi, Tbilisi's rapidly developing modern suburb — perfect for families.

**Property Features:**
- 155 sqm across a single level
- Spacious living/dining area
- Separate kitchen with pantry
- Master bedroom with en-suite and walk-in closet
- 3 additional bedrooms, 2 full bathrooms
- Storage room and laundry area
- Two underground parking spaces

**Didi Dighomi Benefits:**
- New international school nearby
- Large green parks and playgrounds
- Modern shopping mall 5 minutes drive
- Excellent road connections to city center (15 min)
- Quiet, family-friendly environment
- Rapidly appreciating area

Long-term rental appeal to diplomatic and corporate families relocating to Tbilisi.`,
      propertyType: PropertyType.APARTMENT,
      price: 275000,
      currency: 'USD',
      bedrooms: 4,
      bathrooms: 3,
      area: 155,
      builtYear: null,
      floor: 5,
      floors: 14,
      parkingSpaces: 2,
      country: Country.GEORGIA,
      city: 'Tbilisi',
      district: 'Didi Dighomi',
      status: PropertyStatus.OFF_PLAN,
      availabilityStatus: PropertyAvailabilityStatus.AVAILABLE,
      visibility: PropertyVisibility.PUBLIC,
      furnishingStatus: FurnishingStatus.UNFURNISHED,
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
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
        'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1200',
      ],
      featured: false,
      highlightedFeatures: ['Family Friendly', 'Two Parking', 'Modern Complex', 'Flexible Payment'],
      developerId: developers[2].id,
      locationGuideId: locationGuides[0].id,
      agentId: agent.id,
      publishedAt: new Date(),
      investmentData: {
        expectedROI: 9.8,
        rentalYield: 6.2,
        capitalGrowth: 3.6,
        annualAppreciation: 5.0,
        minInvestment: 27500,
        maxInvestment: 275000,
        downPaymentPercentage: 10,
        paymentPlan: '10% booking, 15% on foundation, 25% quarterly, 50% on handover',
        paymentPlanDetails: {
          planType: 'CUSTOM',
          summary: '10% booking, 15% on foundation, 25% in quarterly installments during construction, 50% on handover',
          milestones: [
            { label: 'Booking Fee', percentage: 10, description: 'On signing reservation agreement' },
            { label: 'Foundation Milestone', percentage: 15, description: 'When foundation is completed', dueDate: '2026-09-01' },
            { label: 'Quarterly Installments', percentage: 25, description: '5 quarterly payments of 5% each during construction' },
            { label: 'On Handover', percentage: 50, description: 'Final payment on key handover', dueDate: '2028-06-01' },
          ],
          installmentFrequency: 'quarterly',
          totalInstallments: 5,
          installmentAmount: 13750,
          notes: 'Quarterly installments cover the 25% portion only. Developer may offer early payment discount of 2%.',
        },
        installmentYears: 2,
        completionDate: new Date('2028-06-30'),
        handoverDate: new Date('2028-07-31'),
        expectedRentalStart: new Date('2028-09-01'),
        averageRentPerMonth: 1800,
        mortgageAvailable: true,
        serviceFee: 1100,
        propertyTax: 400,
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
    // Prop 0 (Vake): High ROI, New Build
    { propertyId: createdProperties[0].id, tagId: highROITag.id },
    { propertyId: createdProperties[0].id, tagId: newBuildTag.id },
    // Prop 1 (Batumi Beachfront): Beachfront, Sea View, Off-Plan, High ROI
    { propertyId: createdProperties[1].id, tagId: beachfrontTag.id },
    { propertyId: createdProperties[1].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[1].id, tagId: offPlanTag.id },
    { propertyId: createdProperties[1].id, tagId: highROITag.id },
    // Prop 2 (Saburtalo): Off-Plan, New Build
    { propertyId: createdProperties[2].id, tagId: offPlanTag.id },
    { propertyId: createdProperties[2].id, tagId: newBuildTag.id },
    // Prop 3 (Vera): High ROI
    { propertyId: createdProperties[3].id, tagId: highROITag.id },
    // Prop 4 (Batumi Old Town): Sea View, New Build
    { propertyId: createdProperties[4].id, tagId: seaViewTag.id },
    { propertyId: createdProperties[4].id, tagId: newBuildTag.id },
    // Prop 5 (Didi Dighomi): Off-Plan
    { propertyId: createdProperties[5].id, tagId: offPlanTag.id },
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
    { propertyId: createdProperties[0].id, name: 'Concierge Service', category: 'Services', description: '24/7 professional concierge', icon: 'concierge' },
    { propertyId: createdProperties[0].id, name: 'Underground Parking', category: 'Parking', description: 'Secure underground parking space', icon: 'parking' },
    { propertyId: createdProperties[0].id, name: 'Fitness Center', category: 'Recreation', description: 'Fully equipped modern gym', icon: 'fitness' },
    { propertyId: createdProperties[1].id, name: 'Swimming Pool', category: 'Recreation', description: 'Outdoor infinity pool with sea views', icon: 'pool' },
    { propertyId: createdProperties[1].id, name: 'Spa & Sauna', category: 'Recreation', description: 'Full spa with steam room', icon: 'spa' },
    { propertyId: createdProperties[2].id, name: 'Children Playground', category: 'Recreation', description: 'Modern playground in courtyard', icon: 'playground' },
    { propertyId: createdProperties[2].id, name: 'Rooftop Terrace', category: 'Common Areas', description: 'Shared rooftop with BBQ area', icon: 'terrace' },
    { propertyId: createdProperties[5].id, name: 'Landscaped Garden', category: 'Outdoor', description: 'Large communal garden with seating', icon: 'garden' },
    { propertyId: createdProperties[5].id, name: 'Fitness Center', category: 'Recreation', description: 'Residents-only gym', icon: 'fitness' },
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
      { userId: testUser.id, propertyId: createdProperties[0].id },
      { userId: testUser.id, propertyId: createdProperties[3].id },
      { userId: eliteUser.id, propertyId: createdProperties[1].id },
      { userId: eliteUser.id, propertyId: createdProperties[2].id },
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
        message: 'I am interested in the Vake apartment. Could you provide more details about the payment plan and when I can schedule a viewing?',
      },
      {
        userId: eliteUser.id,
        propertyId: createdProperties[2].id,
        name: 'Elite Member',
        email: 'elite@propgroup.com',
        phone: '+44 20 7123 4567',
        message: 'I would like to discuss the Saburtalo residence and the hybrid payment plan in detail. Can we arrange a call?',
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
        message: 'We found a new apartment in Batumi matching your investment goals',
        link: `/properties/${createdProperties[1].id}`,
        actionLabel: 'View Property',
        actionUrl: `/properties/${createdProperties[1].id}`,
        relatedEntityType: 'property',
        relatedEntityId: createdProperties[1].id,
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
  console.log(`   • ${developers.length} Developers (Georgia-focused)`)
  console.log(`   • ${locationGuides.length} Location Guides`)
  console.log(`   • ${createdProperties.length} Apartments with structured payment plans`)
  console.log(`   • 3 Featured / 3 Non-featured`)
  console.log(`   • ${tags.length} Tags with property assignments`)
  console.log(`   • ${amenityData.length} Amenities`)
  console.log('   • Favorites, Inquiries, Notifications')
  console.log('\n📋 Payment Plan Types Seeded:')
  console.log('   • Split (30/70)')
  console.log('   • Construction-Linked (20/15/15/50)')
  console.log('   • Hybrid (10% + monthly to 50% + bulk)')
  console.log('   • Monthly Installments (20% down + 12 payments)')
  console.log('   • Post-Handover (30% + 70% over 24 months)')
  console.log('   • Custom (10/15/25 quarterly/50)')
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
