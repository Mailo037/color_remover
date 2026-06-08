import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputFile = path.join(process.cwd(), 'public', 'favicon.png');
const publicDir = path.join(process.cwd(), 'public');

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 }
];

async function generate() {
  if (!fs.existsSync(inputFile)) {
    console.error('favicon.png not found in public folder');
    process.exit(1);
  }

  for (const { name, size } of sizes) {
    const outputPath = path.join(publicDir, name);
    await sharp(inputFile)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(outputPath);
    console.log(`Generated ${name}`);
  }
}

generate().catch(console.error);
