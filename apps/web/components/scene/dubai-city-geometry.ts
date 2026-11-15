import * as THREE from 'three';

type CityTextures = {
  glass: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
  asphalt: THREE.CanvasTexture;
  pool: THREE.CanvasTexture;
};

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('A 2D canvas is required to draw the city materials.');
  return { element, context };
}

function texture(element: HTMLCanvasElement, repeat = true) {
  const map = new THREE.CanvasTexture(element);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  map.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 8;
  return map;
}

/** A single facade tile spans 30 metres horizontally and 100 metres vertically. */
export function createCityTextures(): CityTextures {
  const random = seeded(47829);
  const facade = canvas(1024, 2048);
  const emission = canvas(1024, 2048);
  const glass = facade.context;
  const glow = emission.context;
  const mapWidth = facade.element.width;
  const mapHeight = facade.element.height;
  const reflection = glass.createLinearGradient(0, 0, mapWidth, mapHeight);
  reflection.addColorStop(0, '#7e9eae');
  reflection.addColorStop(0.29, '#4b7182');
  reflection.addColorStop(0.57, '#7b949d');
  reflection.addColorStop(1, '#324c60');
  glass.fillStyle = reflection;
  glass.fillRect(0, 0, mapWidth, mapHeight);
  glow.fillStyle = '#000000';
  glow.fillRect(0, 0, mapWidth, mapHeight);

  const columns = 12;
  const rows = 32;
  const width = mapWidth / columns;
  const height = mapHeight / rows;
  type Room = { warm: boolean; brightness: number; blind: number };
  const rooms: (Room | undefined)[] = Array(columns * rows);
  let occupied = 0;
  // Neighbouring panes belong to the same suite, with whole stretches left dark.
  // The tile is about one quarter occupied, rather than a random bright checkerboard.
  for (let attempt = 0; occupied < 92 && attempt < 160; attempt++) {
    const suiteWidth = random() > 0.62 ? 3 : 2;
    const suiteHeight = 1 + Math.floor(random() * 3);
    const left = Math.floor(random() * (columns - suiteWidth + 1));
    const top = Math.floor(random() * (rows - suiteHeight + 1));
    const suite: Room = {
      warm: random() > 0.16,
      brightness: 0.43 + random() * 0.2,
      blind: random() > 0.77 ? 0.23 + random() * 0.22 : 0,
    };
    for (let row = top; row < top + suiteHeight; row++)
      for (let column = left; column < left + suiteWidth; column++) {
        const index = row * columns + column;
        if (!rooms[index]) {
          rooms[index] = suite;
          occupied++;
        }
      }
  }
  for (let row = 0; row < 32; row++) {
    for (let column = 0; column < 12; column++) {
      const x = column * width;
      const y = row * height;
      const tint = Math.floor(20 + random() * 36);
      const room = rooms[row * columns + column];
      glass.fillStyle = `rgba(13,31,46,${0.2 + random() * 0.44})`;
      glass.fillRect(x + width * 0.06, y + height * 0.06, width * 0.88, height * 0.8);
      glass.fillStyle = `rgba(${tint + 65},${tint + 91},${tint + 103},${0.1 + random() * 0.15})`;
      glass.fillRect(x + width * 0.09, y + height * 0.08, width * 0.82, height * 0.76);
      // Closed blinds and broken-up reflections prevent a uniform checkerboard.
      if (random() > 0.78) {
        glass.fillStyle = 'rgba(144,163,166,0.28)';
        glass.fillRect(
          x + width * 0.09,
          y + height * 0.09,
          width * 0.82,
          height * (0.3 + random() * 0.5),
        );
      }
      glass.fillStyle = 'rgba(13,28,37,0.68)';
      glass.fillRect(x, y + height * 0.86, width, height * 0.14);
      glass.fillStyle = 'rgba(161,183,187,0.4)';
      glass.fillRect(x, y, width * 0.025, height);
      glass.fillStyle = 'rgba(189,203,204,0.18)';
      glass.fillRect(x + width * 0.9, y + height * 0.09, width * 0.025, height * 0.75);
      if (room) {
        const brightness = room.brightness * (0.92 + random() * 0.12);
        const rgb = room.warm ? '250,225,186' : '195,217,230';
        const panelX = x + width * 0.105;
        const panelY = y + height * (0.12 + room.blind);
        const panelWidth = width * 0.79;
        const panelHeight = height * (0.7 - room.blind);
        const interior = glow.createLinearGradient(0, panelY, 0, panelY + panelHeight);
        interior.addColorStop(0, `rgba(${rgb},0)`);
        interior.addColorStop(0.12, `rgba(${rgb},${brightness * 0.74})`);
        interior.addColorStop(0.42, `rgba(${rgb},${brightness})`);
        interior.addColorStop(0.85, `rgba(${rgb},${brightness * 0.65})`);
        interior.addColorStop(1, `rgba(${rgb},0)`);
        glow.fillStyle = interior;
        glow.fillRect(panelX, panelY, panelWidth, panelHeight);
        // Feather the sides inside the glazing, retaining dark mullions between rooms.
        const edges = glow.createLinearGradient(panelX, 0, panelX + panelWidth, 0);
        edges.addColorStop(0, '#000000');
        edges.addColorStop(0.1, '#ffffff');
        edges.addColorStop(0.9, '#ffffff');
        edges.addColorStop(1, '#000000');
        glow.globalCompositeOperation = 'multiply';
        glow.fillStyle = edges;
        glow.fillRect(panelX, panelY, panelWidth, panelHeight);
        glow.globalCompositeOperation = 'source-over';
        // Curtains and a lower interior shadow keep the light behind the facade.
        glow.fillStyle = 'rgba(0,0,0,0.22)';
        glow.fillRect(panelX + panelWidth * 0.14, panelY, panelWidth * 0.06, panelHeight);
        glow.fillStyle = 'rgba(0,0,0,0.32)';
        glow.fillRect(panelX, panelY + panelHeight * 0.7, panelWidth, panelHeight * 0.14);
      }
    }
  }
  // A faint broad reflection gives adjacent panes a coherent curtain-wall face.
  const skyStrip = glass.createLinearGradient(0, 0, mapWidth, 0);
  skyStrip.addColorStop(0, 'rgba(180,214,220,0)');
  skyStrip.addColorStop(0.39, 'rgba(194,222,224,0.03)');
  skyStrip.addColorStop(0.47, 'rgba(184,221,227,0.2)');
  skyStrip.addColorStop(0.64, 'rgba(180,214,220,0)');
  glass.fillStyle = skyStrip;
  glass.fillRect(0, 0, mapWidth, mapHeight);

  const road = canvas(128, 128);
  const pixels = road.context.createImageData(128, 128);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const grain = 37 + Math.floor(random() * 15);
    pixels.data[index] = grain;
    pixels.data[index + 1] = grain + 5;
    pixels.data[index + 2] = grain + 8;
    pixels.data[index + 3] = 255;
  }
  road.context.putImageData(pixels, 0, 0);
  road.context.strokeStyle = 'rgba(157,168,176,0.045)';
  road.context.lineWidth = 1;
  for (let index = 0; index < 35; index++) {
    const x = random() * 128;
    const y = random() * 128;
    road.context.beginPath();
    road.context.moveTo(x, y);
    road.context.lineTo(x + random() * 11, y + random() * 6);
    road.context.stroke();
  }

  const halo = canvas(256, 256);
  const light = halo.context.createRadialGradient(128, 128, 0, 128, 128, 128);
  light.addColorStop(0, 'rgba(255,235,201,0.35)');
  light.addColorStop(0.16, 'rgba(250,229,193,0.2)');
  light.addColorStop(0.46, 'rgba(242,217,183,0.07)');
  light.addColorStop(1, 'rgba(238,210,179,0)');
  halo.context.fillStyle = light;
  halo.context.fillRect(0, 0, 256, 256);

  return {
    glass: texture(facade.element),
    glow: texture(emission.element),
    asphalt: texture(road.element),
    pool: texture(halo.element, false),
  };
}
