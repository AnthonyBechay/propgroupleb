/**
 * Script to reset admin password
 * Run with: node apps/backend/src/scripts/reset-admin-password.js
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    console.log('🔐 Resetting admin password...');
    
    const email = 'admin@propgroup.com';
    const password = 'admin123';
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ Password hashed');
    
    // Find or create admin user
    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
        emailVerifiedAt: new Date(),
        provider: 'local',
      },
      create: {
        email,
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        emailVerifiedAt: new Date(),
        provider: 'local',
      },
    });
    
    console.log('✅ Admin user updated/created:', admin.email);
    
    // Verify the password works
    const testPassword = await bcrypt.compare(password, admin.password);
    console.log('✅ Password verification test:', testPassword ? 'PASSED' : 'FAILED');
    
    if (testPassword) {
      console.log('✅ Admin password reset successful!');
      console.log('📧 Email:', email);
      console.log('🔑 Password:', password);
    } else {
      console.error('❌ Password verification failed!');
    }
    
  } catch (error) {
    console.error('❌ Error resetting admin password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();

