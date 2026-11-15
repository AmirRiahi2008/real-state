import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = await readFile(new URL('../app/icon.svg', import.meta.url));
const directory = new URL('../public/icons/', import.meta.url);
const background = '#c5edb5';
await mkdir(directory, { recursive: true });
await Promise.all(
  [
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['apple-touch-icon.png', 180],
  ].map(([name, size]) =>
    sharp(source)
      .resize(size, size)
      .flatten({ background })
      .png()
      .toFile(fileURLToPath(new URL(name, directory))),
  ),
);

// Keep the entire mark inside the maskable icon's central safe zone.
await sharp(source)
  .resize(320, 320)
  .flatten({ background })
  .extend({ top: 96, bottom: 96, left: 96, right: 96, background })
  .png()
  .toFile(fileURLToPath(new URL('icon-maskable-512.png', directory)));

// PNG-backed ICO supplies the browser's conventional /favicon.ico request, too.
const faviconPng = await sharp(source).resize(32, 32).png().toBuffer();
const faviconHeader = Buffer.alloc(22);
faviconHeader.writeUInt16LE(1, 2); // ICO type.
faviconHeader.writeUInt16LE(1, 4); // One image.
faviconHeader[6] = 32;
faviconHeader[7] = 32;
faviconHeader.writeUInt16LE(1, 10); // Planes.
faviconHeader.writeUInt16LE(32, 12); // Bits per pixel.
faviconHeader.writeUInt32LE(faviconPng.length, 14);
faviconHeader.writeUInt32LE(22, 18);
await writeFile(
  new URL('../app/favicon.ico', import.meta.url),
  Buffer.concat([faviconHeader, faviconPng]),
);

console.log('Generated the ORIVA browser, install and Apple home-screen icons.');
