import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create super admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@propgroup.com' },
    update: {
      // Update password and ensure user is active and verified
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerifiedAt: new Date(),
      provider: 'local'
    },
    create: {
      email: 'admin@propgroup.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerifiedAt: new Date(),
      provider: 'local'
    }
  });

  console.log('✅ Super admin created:', superAdmin.email);

  // Create sample developers
  const developers = await Promise.all([
    prisma.developer.upsert({
      where: { name: 'Luxury Developments Ltd' },
      update: {},
      create: {
        name: 'Luxury Developments Ltd',
        description: 'Premium real estate developer specializing in luxury properties',
        website: 'https://luxurydev.com',
        country: 'CYPRUS'
      }
    }),
    prisma.developer.upsert({
      where: { name: 'Mediterranean Properties' },
      update: {},
      create: {
        name: 'Mediterranean Properties',
        description: 'Leading developer in Mediterranean real estate',
        website: 'https://medprop.com',
        country: 'GREECE'
      }
    }),
    prisma.developer.upsert({
      where: { name: 'Tbilisi Builders' },
      update: {},
      create: {
        name: 'Tbilisi Builders',
        description: 'Modern residential and commercial developments in Georgia',
        website: 'https://tbilisibuilders.ge',
        country: 'GEORGIA'
      }
    })
  ]);

  console.log('✅ Developers created:', developers.length);

  // Create sample location guides
  const locationGuides = await Promise.all([
    prisma.locationGuide.upsert({
      where: { title: 'Cyprus Investment Guide' },
      update: {},
      create: {
        title: 'Cyprus Investment Guide',
        content: 'Complete guide to investing in Cyprus real estate, including Golden Visa program details and market insights.',
        country: 'CYPRUS',
        imageUrl: 'https://example.com/cyprus-guide.jpg'
      }
    }),
    prisma.locationGuide.upsert({
      where: { title: 'Greece Property Market' },
      update: {},
      create: {
        title: 'Greece Property Market',
        content: 'Everything you need to know about the Greek real estate market, from Athens to the islands.',
        country: 'GREECE',
        imageUrl: 'https://example.com/greece-guide.jpg'
      }
    }),
    prisma.locationGuide.upsert({
      where: { title: 'Georgia Real Estate' },
      update: {},
      create: {
        title: 'Georgia Real Estate',
        content: 'Investment opportunities in Georgia, including Tbilisi and Batumi markets.',
        country: 'GEORGIA',
        imageUrl: 'https://example.com/georgia-guide.jpg'
      }
    })
  ]);

  console.log('✅ Location guides created:', locationGuides.length);

  // Create sample properties
  const properties = await Promise.all([
    prisma.property.upsert({
      where: { title: 'Luxury Penthouse in Limassol' },
      update: {},
      create: {
        title: 'Luxury Penthouse in Limassol',
        description: 'Stunning 3-bedroom penthouse with panoramic sea views in the heart of Limassol. Features modern amenities and premium finishes.',
        price: 850000,
        currency: 'EUR',
        propertyType: 'PENTHOUSE',
        bedrooms: 3,
        bathrooms: 2,
        area: 120,
        country: 'CYPRUS',
        city: 'Limassol',
        status: 'NEW_BUILD',
        availabilityStatus: 'AVAILABLE',
        visibility: 'PUBLIC',
        isGoldenVisaEligible: true,
        featured: true,
        images: [
          'https://example.com/penthouse1.jpg',
          'https://example.com/penthouse2.jpg'
        ],
        developerId: developers[0].id,
        locationGuideId: locationGuides[0].id,
        publishedAt: new Date()
      }
    }),
    prisma.property.upsert({
      where: { title: 'Villa in Mykonos' },
      update: {},
      create: {
        title: 'Villa in Mykonos',
        description: 'Beautiful traditional villa with private pool, perfect for vacation rental or permanent residence.',
        price: 1200000,
        currency: 'EUR',
        propertyType: 'VILLA',
        bedrooms: 4,
        bathrooms: 3,
        area: 200,
        country: 'GREECE',
        city: 'Mykonos',
        status: 'RESALE',
        availabilityStatus: 'AVAILABLE',
        visibility: 'PUBLIC',
        isGoldenVisaEligible: true,
        hasPool: true,
        featured: true,
        images: [
          'https://example.com/villa1.jpg',
          'https://example.com/villa2.jpg'
        ],
        developerId: developers[1].id,
        locationGuideId: locationGuides[1].id,
        publishedAt: new Date()
      }
    }),
    prisma.property.upsert({
      where: { title: 'Modern Apartment in Tbilisi' },
      update: {},
      create: {
        title: 'Modern Apartment in Tbilisi',
        description: 'Contemporary 2-bedroom apartment in the historic center of Tbilisi. Great investment opportunity with high rental potential.',
        price: 95000,
        currency: 'USD',
        propertyType: 'APARTMENT',
        bedrooms: 2,
        bathrooms: 1,
        area: 75,
        country: 'GEORGIA',
        city: 'Tbilisi',
        status: 'OFF_PLAN',
        availabilityStatus: 'AVAILABLE',
        visibility: 'PUBLIC',
        isGoldenVisaEligible: false,
        featured: true,
        images: [
          'https://example.com/apartment1.jpg',
          'https://example.com/apartment2.jpg'
        ],
        developerId: developers[2].id,
        locationGuideId: locationGuides[2].id,
        publishedAt: new Date()
      }
    })
  ]);

  console.log('✅ Properties created:', properties.length);

  // Create investment data for properties
  await Promise.all([
    prisma.propertyInvestmentData.upsert({
      where: { propertyId: properties[0].id },
      update: {},
      create: {
        propertyId: properties[0].id,
        expectedROI: 6.5,
        rentalYield: 4.2,
        capitalGrowth: 8.0,
        isGoldenVisaEligible: true,
        minInvestment: 300000,
        maxInvestment: 850000,
        paymentPlan: '20% down, 80% on completion',
        completionDate: new Date('2024-12-31')
      }
    }),
    prisma.propertyInvestmentData.upsert({
      where: { propertyId: properties[1].id },
      update: {},
      create: {
        propertyId: properties[1].id,
        expectedROI: 5.8,
        rentalYield: 3.5,
        capitalGrowth: 6.5,
        isGoldenVisaEligible: true,
        minInvestment: 600000,
        maxInvestment: 1200000,
        paymentPlan: '30% down, 70% on completion',
        completionDate: new Date('2024-06-30')
      }
    }),
    prisma.propertyInvestmentData.upsert({
      where: { propertyId: properties[2].id },
      update: {},
      create: {
        propertyId: properties[2].id,
        expectedROI: 8.2,
        rentalYield: 5.5,
        capitalGrowth: 12.0,
        isGoldenVisaEligible: false,
        minInvestment: 50000,
        maxInvestment: 95000,
        paymentPlan: '10% down, 90% on completion',
        completionDate: new Date('2025-03-31')
      }
    })
  ]);

  console.log('✅ Investment data created');

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
