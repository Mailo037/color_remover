import fs from 'node:fs/promises';
import path from 'node:path';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const sourceIcon = path.join(process.cwd(), 'public', 'favicon.png');
const outputDir = path.join(process.cwd(), 'build');
const outputIcon = path.join(outputDir, 'icon.ico');
const iconSizes = [16, 24, 32, 48, 64, 128, 256];

await fs.mkdir(outputDir, { recursive: true });

const pngPaths = await Promise.all(iconSizes.map(async (size) => {
  const iconPath = path.join(outputDir, `icon-${size}.png`);

  await sharp(sourceIcon)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(iconPath);

  return iconPath;
}));

const iconBuffer = await pngToIco(pngPaths);
await fs.writeFile(outputIcon, iconBuffer);

await Promise.all(pngPaths.map((iconPath) => fs.rm(iconPath, { force: true })));

console.log(`Generated ${path.relative(process.cwd(), outputIcon)}`);
