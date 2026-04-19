export const HEX_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexKey({ q, r }) {
  return `${q},${r}`;
}

export function parseHexKey(key) {
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

export function addHex(a, b) {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function neighbors(hex) {
  return HEX_DIRECTIONS.map((direction) => addHex(hex, direction));
}

export function hexDistance(a, b) {
  return (
    Math.abs(a.q - b.q) +
    Math.abs(a.r - b.r) +
    Math.abs(a.q + a.r - b.q - b.r)
  ) / 2;
}

export function withinBoard(hex, radius) {
  return (
    Math.abs(hex.q) <= radius &&
    Math.abs(hex.r) <= radius &&
    Math.abs(hex.q + hex.r) <= radius
  );
}

export function allBoardHexes(radius) {
  const cells = [];
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) {
      cells.push({ q, r });
    }
  }
  return cells;
}

export function hexesInRange(center, radius) {
  const results = [];
  for (let dq = -radius; dq <= radius; dq += 1) {
    for (
      let dr = Math.max(-radius, -dq - radius);
      dr <= Math.min(radius, -dq + radius);
      dr += 1
    ) {
      results.push({
        q: center.q + dq,
        r: center.r + dr,
      });
    }
  }
  return results;
}

export function axialToPixel(hex, size, originX, originY) {
  const x = size * Math.sqrt(3) * (hex.q + hex.r / 2) + originX;
  const y = size * 1.5 * hex.r + originY;
  return { x, y };
}

function cubeRound({ x, y, z }) {
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

export function pixelToHex(x, y, size, originX, originY) {
  const localX = x - originX;
  const localY = y - originY;
  const q = ((Math.sqrt(3) / 3) * localX - localY / 3) / size;
  const r = ((2 / 3) * localY) / size;
  return cubeRound({ x: q, y: -q - r, z: r });
}

export function hexPolygon(centerX, centerY, size) {
  const points = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    points.push({
      x: centerX + size * Math.cos(angle),
      y: centerY + size * Math.sin(angle),
    });
  }
  return points;
}
