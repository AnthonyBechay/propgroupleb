#!/usr/bin/env node

/**
 * Clean script for PropGroup
 * Removes node_modules, build artifacts, and temporary files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 Cleaning PropGroup project...\n');

// Directories to clean
const dirsToClean = [
  // Root
  'node_modules',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.cache',
  
  // Apps
  'apps/web/node_modules',
  'apps/web/.next',
  'apps/web/dist',
  'apps/web/build',
  'apps/backend/node_modules',
  'apps/backend/dist',

  // Packages
  'packages/db/node_modules',
  'packages/db/dist',
  'packages/config/node_modules',
  'packages/config/dist',
];

// Files to clean
const filesToClean = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'apps/web/package-lock.json',
  'apps/backend/package-lock.json',
  'packages/db/package-lock.json',
  'packages/config/package-lock.json',
];

// Function to remove directory
function removeDir(dirPath) {
  const fullPath = path.join(__dirname, '..', dirPath);
  if (fs.existsSync(fullPath)) {
    try {
      if (process.platform === 'win32') {
        execSync(`rmdir /s /q "${fullPath}"`, { stdio: 'ignore' });
      } else {
        execSync(`rm -rf "${fullPath}"`, { stdio: 'ignore' });
      }
      console.log(`✅ Removed: ${dirPath}`);
    } catch (error) {
      console.log(`⚠️  Could not remove: ${dirPath}`);
    }
  }
}

// Function to remove file
function removeFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      console.log(`✅ Removed: ${filePath}`);
    } catch (error) {
      console.log(`⚠️  Could not remove: ${filePath}`);
    }
  }
}

// Clean directories
console.log('Cleaning directories...\n');
dirsToClean.forEach(removeDir);

// Clean files
console.log('\nCleaning files...\n');
filesToClean.forEach(removeFile);

console.log('\n✨ Cleanup complete!\n');
console.log('Run "pnpm install" to reinstall dependencies');