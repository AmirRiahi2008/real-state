import { writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// Public Unsplash stock photographs used as illustration for fictional inventory.
// They are deliberately not described as photographs of an advertised UAE unit.
const photographs = [
  ['property-01', 'photo-1600596542815-ffad4c1539a9'],
  ['property-02', 'photo-1600607687920-4e2a09cf159d'],
  ['property-03', 'photo-1600566753190-17f0baa2a6c3'],
  ['property-04', 'photo-1600585154340-be6161a56a0c'],
  ['property-05', 'photo-1600210492486-724fe5c67fb0'],
  ['property-06', 'photo-1600607687939-ce8a6c25118c'],
  ['property-07', 'photo-1512917774080-9991f1c4c750'],
  ['property-08', 'photo-1613977257363-707ba9348227'],
];
await mkdir(new URL('./', import.meta.url), { recursive: true });
const manifest = [];
for (const [name, photo] of photographs) {
  const url = `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1600&q=85`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Photo download failed: ${name} ${response.status}`);
  const input = Buffer.from(await response.arrayBuffer());
  const { data, info } = await sharp(input, { limitInputPixels: 24000000 })
    .rotate()
    .resize({ width: 1600, height: 1200, fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });
  await writeFile(new URL(`./${name}.webp`, import.meta.url), data);
  manifest.push({
    file: `${name}.webp`,
    source: url,
    license: 'https://unsplash.com/license',
    width: info.width,
    height: info.height,
  });
  console.log(`${name}.webp ${info.width}x${info.height} ${data.length} bytes`);
}
await writeFile(
  new URL('./sources.json', import.meta.url),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
