#!/usr/bin/env node

/**
 * Setup script for PropGroup
 * Installs dependencies and prepares the development environment
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Setting up PropGroup development environment...\n');

// Function to run command
function runCommand(command, options = {}) {
  try {
    execSync(command, { 
      stdio: 'inherit',
      ...options 
    });
    return true;
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    return false;
  }
}

// Function to check if file exists
function fileExists(filePath) {
  return fs.existsSync(path.join(__dirname, '..', filePath));
}

// Main setup steps
async function setup() {
  console.log('Step 1: Installing dependencies...\n');
  if (!runCommand('pnpm install')) {
    console.error('Failed to install dependencies');
    process.exit(1);
  }

  console.log('\nStep 2: Building packages...\n');
  if (!runCommand('node scripts/build.js')) {
    console.error('Failed to build packages');
    console.log('You can try building manually with: pnpm run build:packages');
  }
  
  console.log('\nStep 3: Checking environment...\n');
  
  // Check for .env.local
  if (!fileExists('apps/web/.env.local')) {
    console.log('⚠️  No .env.local file found in apps/web/');
    console.log('   Creating a minimal example — fill in your values:');

    const envExample = `# API URL (backend)
NEXT_PUBLIC_API_URL=http://localhost:3001

# Cloudflare R2 public bucket URL (optional — enables direct R2 image serving)
# NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-<id>.r2.dev

# Site URL (used for canonical links / OG tags)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional features
# RESEND_API_KEY=your-resend-key
# ANTHROPIC_API_KEY=your-anthropic-key
`;

    fs.writeFileSync(
      path.join(__dirname, '..', 'apps', 'web', '.env.local'),
      envExample
    );
    console.log('✅ Created .env.local file');
  } else {
    console.log('✅ .env.local file exists');
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('1. Fill in apps/web/.env.local and apps/backend/.env with your values');
  console.log('2. Run "pnpm run dev" to start the development servers');
  console.log('3. Open http://localhost:3000 in your browser');
  console.log('='.repeat(50) + '\n');
}

// Run setup
setup().catch(console.error);
