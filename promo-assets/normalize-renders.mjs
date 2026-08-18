import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const renderedDir = path.resolve('promo-assets/rendered');
const entries = (await fs.readdir(renderedDir)).filter((name) => name.endsWith('.png'));

for (const name of entries) {
  const filePath = path.join(renderedDir, name);
  const source = await fs.readFile(filePath);
  const normalized = await sharp(source)
    .resize(1920, 1080, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.writeFile(filePath, normalized);
}
