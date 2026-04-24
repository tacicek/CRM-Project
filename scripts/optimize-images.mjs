#!/usr/bin/env node
/**
 * Image Optimization Script
 * Converts JPG/PNG images to WebP format with optimized sizes
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.join(__dirname, '../src/assets');

// Image configurations with target sizes
const imageConfigs = {
  // Hero image - larger for above-the-fold
  'hero-moving.jpg': [
    { width: 1920, suffix: '' },      // Desktop
    { width: 1280, suffix: '-md' },   // Tablet
    { width: 640, suffix: '-sm' },    // Mobile
  ],
  // Service images - smaller for cards
  'service-entsorgung.jpg': [
    { width: 800, suffix: '' },
    { width: 400, suffix: '-sm' },
  ],
  'service-klavier.jpg': [
    { width: 800, suffix: '' },
    { width: 400, suffix: '-sm' },
  ],
  'service-lagerung.jpg': [
    { width: 800, suffix: '' },
    { width: 400, suffix: '-sm' },
  ],
  'service-raeumung.jpg': [
    { width: 800, suffix: '' },
    { width: 400, suffix: '-sm' },
  ],
  'service-reinigung.jpg': [
    { width: 800, suffix: '' },
    { width: 400, suffix: '-sm' },
  ],
  'service-umzug.jpg': [
    { width: 800, suffix: '' },
    { width: 400, suffix: '-sm' },
  ],
};

// Logo configurations
const logoConfigs = {
  'logo-offerio-main.png': [
    { width: 400, suffix: '' },
    { width: 200, suffix: '-sm' },
  ],
};

async function optimizeImage(filename, configs) {
  const inputPath = path.join(assetsDir, filename);

  if (!fs.existsSync(inputPath)) {
    console.log(`⚠️  Skipping ${filename} - file not found`);
    return;
  }

  const baseName = path.basename(filename, path.extname(filename));

  for (const config of configs) {
    const outputName = `${baseName}${config.suffix}.webp`;
    const outputPath = path.join(assetsDir, outputName);

    try {
      const info = await sharp(inputPath)
        .resize(config.width, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality: 80 })
        .toFile(outputPath);

      const originalSize = fs.statSync(inputPath).size;
      const savings = ((1 - info.size / originalSize) * 100).toFixed(1);

      console.log(`✅ ${outputName}: ${(info.size / 1024).toFixed(1)}KB (${savings}% smaller)`);
    } catch (err) {
      console.error(`❌ Error processing ${filename}:`, err.message);
    }
  }
}

async function main() {
  console.log('🖼️  Starting image optimization...\n');

  // Optimize JPG images
  for (const [filename, configs] of Object.entries(imageConfigs)) {
    await optimizeImage(filename, configs);
  }

  console.log('\n📦 Optimizing logos...\n');

  // Optimize PNG logos
  for (const [filename, configs] of Object.entries(logoConfigs)) {
    await optimizeImage(filename, configs);
  }

  console.log('\n✨ Image optimization complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Update image imports in your components to use .webp files');
  console.log('2. Use <picture> element with fallback for older browsers');
}

main().catch(console.error);

