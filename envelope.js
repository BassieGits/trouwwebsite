// Bouwt de envelop uit één afbeelding (assets/envelop.jpg) op in losse lagen:
// papier, bovenflap, zegel, lint en een gloeikaart van het reliëf.
// De beweging zelf staat in styles.css; deze code knipt alleen de lagen uit.

// Maten in pixels van de originele afbeelding (768 × 1376).
const G = {
  width: 768,
  top: 120, // bovenrand van de envelop
  flapSide: 160, // waar de schuine randen van de bovenflap beginnen
  tipY: 700, // punt van de bovenflap (onder het zegel)
  sealX: 384,
  sealY: 692,
  sealR: 124,
  star: [338, 538, 96, 70], // zeester boven op het zegel: x, y, breedte, hoogte
  ribbonTop: 658,
  ribbonBottom: 714,
  bottom: 1306, // onderrand van de envelop
};

export async function buildEnvelope(stage, src) {
  const img = new Image();
  img.src = src;
  await img.decode();

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const k = w / G.width;
  const g = Object.fromEntries(Object.entries(G).map(([key, v]) => [key, Array.isArray(v) ? v.map((n) => n * k) : v * k]));

  stage.style.aspectRatio = `${w} / ${h}`;

  const flapPath = () => {
    const p = new Path2D();
    p.moveTo(0, g.top - 4);
    p.lineTo(w, g.top - 4);
    p.lineTo(w, g.flapSide);
    p.lineTo(g.sealX, g.tipY);
    p.lineTo(0, g.flapSide);
    p.closePath();
    return p;
  };
  const sealPath = () => {
    const p = new Path2D();
    p.arc(g.sealX, g.sealY, g.sealR, 0, Math.PI * 2);
    const [sx, sy, sw, sh] = g.star;
    p.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
    return p;
  };

  const original = canvasFrom(img, w, h);
  const originalData = original.getContext('2d').getImageData(0, 0, w, h);

  /* Papier: lint en zegel weggepoetst, bovenflap eruit geknipt */
  const base = makeCanvas(w, h);
  const bctx = base.getContext('2d');
  const baseData = new ImageData(new Uint8ClampedArray(originalData.data), w, h);
  inpaintBand(baseData, g.ribbonTop, g.ribbonBottom);
  inpaintCircle(baseData, g.sealX, g.sealY, g.sealR + 6 * k);
  bctx.putImageData(baseData, 0, 0);
  bctx.globalCompositeOperation = 'destination-out';
  bctx.fill(flapPath());

  /* Bovenflap */
  const flap = makeCanvas(w, h);
  const fctx = flap.getContext('2d');
  fctx.clip(flapPath());
  fctx.drawImage(img, 0, 0);

  /* Zegel met zeester */
  const seal = makeCanvas(w, h);
  const sctx = seal.getContext('2d');
  sctx.clip(sealPath());
  sctx.drawImage(img, 0, 0);

  /* Lint, links en rechts van het zegel */
  const ribbonLeft = makeCanvas(w, h);
  const ribbonRight = makeCanvas(w, h);
  const ribbonHeight = g.ribbonBottom - g.ribbonTop;
  const leftEnd = g.sealX - g.sealR + 4 * k;
  const rightStart = g.sealX + g.sealR - 4 * k;
  ribbonLeft.getContext('2d').drawImage(img, 0, g.ribbonTop, leftEnd, ribbonHeight, 0, g.ribbonTop, leftEnd, ribbonHeight);
  ribbonRight.getContext('2d').drawImage(img, rightStart, g.ribbonTop, w - rightStart, ribbonHeight, rightStart, g.ribbonTop, w - rightStart, ribbonHeight);

  /* Lichtstroom: het licht vertrekt bij het zegel en loopt langs elke reliëflijn naar buiten */
  const mask = reliefMask(original, originalData, g, k);
  const onFlap = (x, y) => {
    if (y <= g.flapSide) return true;
    if (y >= g.tipY) return false;
    const edge = (g.sealX * (y - g.flapSide)) / (g.tipY - g.flapSide);
    return x > edge && x < w - edge;
  };
  const routes = traceRoutes(mask, w, h, g, onFlap);
  const glowBase = makeCanvas(w, h);
  const glowFlap = makeCanvas(w, h);
  const bloomBase = makeCanvas(Math.round(w / 2), Math.round(h / 2));
  const bloomFlap = makeCanvas(Math.round(w / 2), Math.round(h / 2));

  /* In elkaar zetten */
  const layer = (canvas, className) => {
    canvas.className = `env-layer ${className}`;
    return canvas;
  };
  const flapGroup = stage.querySelector('.env-flap');
  stage.querySelector('.env-base-slot').replaceWith(layer(base, 'env-base'), layer(bloomBase, 'env-bloom'), layer(glowBase, 'env-glow'));
  flapGroup.prepend(
    layer(flap, 'env-flap-front'),
    layer(bloomFlap, 'env-bloom'),
    layer(glowFlap, 'env-glow'),
    layer(seal, 'env-seal'),
  );
  stage.querySelector('.env-ribbon-slot').replaceWith(layer(ribbonLeft, 'env-ribbon env-ribbon-left'), layer(ribbonRight, 'env-ribbon env-ribbon-right'));

  // Plekken van zegel en scharnier doorgeven aan de CSS.
  stage.style.setProperty('--hinge', `${(g.top / h) * 100}%`);
  stage.style.setProperty('--seal-x', `${(g.sealX / w) * 100}%`);
  stage.style.setProperty('--seal-y', `${(g.sealY / h) * 100}%`);
  stage.style.setProperty('--seal-size', `${((g.sealR * 2) / w) * 100}%`);

  const draw = (t) => drawStream(t, routes, w, h, glowBase, glowFlap, bloomBase, bloomFlap);
  let frame = null;
  return {
    // t = seconden sinds het licht aanging
    render: draw,
    start() {
      const t0 = performance.now();
      const tick = () => {
        draw((performance.now() - t0) / 1000);
        frame = requestAnimationFrame(tick);
      };
      tick();
    },
    stop() {
      cancelAnimationFrame(frame);
    },
  };
}

// Zoekt alle losse lijnen en parels in de gloeikaart en berekent per pixel wanneer het licht er aankomt.
function traceRoutes(mask, w, h, g, onFlap) {
  const alpha = mask.getContext('2d').getImageData(0, 0, w, h).data;
  const on = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) on[i] = alpha[i * 4 + 3] > 70 ? 1 : 0;

  const dist = new Float32Array(w * h).fill(-1);
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  const pixels = [];
  const arrive = [];
  const neighbours = [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1];

  for (let p = 0; p < w * h; p++) {
    if (!on[p] || seen[p]) continue;
    // 1. hele lijn verzamelen en het punt het dichtst bij het zegel zoeken
    let head = 0;
    let tail = 0;
    queue[tail++] = p;
    seen[p] = 1;
    let startPx = p;
    let best = Infinity;
    while (head < tail) {
      const q = queue[head++];
      const x = q % w;
      const y = (q - x) / w;
      const d = Math.hypot(x - g.sealX, y - g.sealY);
      if (d < best) {
        best = d;
        startPx = q;
      }
      for (const n of neighbours) {
        const r = q + n;
        if (r < 0 || r >= w * h || seen[r] || !on[r] || Math.abs((r % w) - x) > 1) continue;
        seen[r] = 1;
        queue[tail++] = r;
      }
    }
    if (tail < 8) continue; // losse korrels overslaan
    // 2. afstand langs de lijn vanaf dat startpunt
    head = 0;
    tail = 0;
    queue[tail++] = startPx;
    dist[startPx] = 0;
    while (head < tail) {
      const q = queue[head++];
      const x = q % w;
      pixels.push(q);
      arrive.push(best * 0.55 + dist[q]);
      for (const n of neighbours) {
        const r = q + n;
        if (r < 0 || r >= w * h || dist[r] >= 0 || !on[r] || Math.abs((r % w) - x) > 1) continue;
        dist[r] = dist[q] + 1;
        queue[tail++] = r;
      }
    }
  }

  let maxArrive = 1;
  for (const a of arrive) if (a > maxArrive) maxArrive = a;
  const duration = 1.8; // seconden tot het licht overal is
  const routes = {
    pixels: Int32Array.from(pixels),
    arrive: Float32Array.from(arrive, (a) => (a / maxArrive) * duration),
    strength: Uint8Array.from(pixels, (q) => alpha[q * 4 + 3]),
    flap: Uint8Array.from(pixels, (q) => (onFlap(q % w, Math.floor(q / w)) ? 1 : 0)),
  };
  return routes;
}

function drawStream(t, routes, w, h, glowBase, glowFlap, bloomBase, bloomFlap) {
  const base = glowBase.getContext('2d');
  const flap = glowFlap.getContext('2d');
  const baseImg = base.createImageData(w, h);
  const flapImg = flap.createImageData(w, h);
  const { pixels, arrive, strength, flap: onFlap } = routes;
  for (let i = 0; i < pixels.length; i++) {
    const age = t - arrive[i];
    if (age < 0) continue;
    // felle kop die langs de lijn loopt, daarna een gloeiend spoor en steeds nieuwe lichtpulsen
    const headGlow = Math.exp(-((age / 0.12) ** 2));
    const steady = Math.min(1, age * 6) * (0.22 + 0.6 * Math.exp(-age * 2.2));
    const phase = (age % 1.4) / 0.13;
    const pulse = age > 0.5 ? 0.7 * Math.exp(-(phase * phase)) : 0;
    const a = Math.min(1, 1.3 * headGlow + (steady + pulse) * Math.min(1, (strength[i] / 255) * 2));
    const white = Math.min(1, headGlow + pulse * 0.7);
    const data = onFlap[i] ? flapImg.data : baseImg.data;
    const j = pixels[i] * 4;
    data[j] = 255;
    data[j + 1] = 188 + 66 * white;
    data[j + 2] = 96 + 150 * white;
    data[j + 3] = a * 255;
  }
  base.putImageData(baseImg, 0, 0);
  flap.putImageData(flapImg, 0, 0);
  for (const [bloom, glow] of [[bloomBase, glowBase], [bloomFlap, glowFlap]]) {
    const ctx = bloom.getContext('2d');
    ctx.clearRect(0, 0, bloom.width, bloom.height);
    ctx.drawImage(glow, 0, 0, bloom.width, bloom.height);
  }
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

function canvasFrom(img, w, h) {
  const c = makeCanvas(w, h);
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

// Vult een horizontale strook met papier van direct erboven en eronder, in elkaar overvloeiend,
// zodat de reliëflijnen doorlopen in plaats van een egale veeg te vormen.
function inpaintBand(image, top, bottom) {
  const { data, width } = image;
  const t = Math.round(top) - 3;
  const b = Math.round(bottom) + 3;
  const span = b - t + 1;
  const source = new Uint8ClampedArray(data);
  for (let y = t; y <= b; y++) {
    const f = (y - t) / (b - t);
    const above = (y - span) * width * 4;
    const below = (y + span) * width * 4;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const o = x * 4;
      for (let c = 0; c < 3; c++) data[i + c] = source[above + o + c] * (1 - f) + source[below + o + c] * f;
    }
  }
}

// Vult een cirkel met de papierkleur eromheen, met een zachte overgang naar de rand.
function inpaintCircle(image, cx, cy, r) {
  const { data, width, height } = image;
  const ring = [0, 0, 0];
  let count = 0;
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    for (let d = r + 22; d < r + 40; d += 3) {
      const x = Math.round(cx + Math.cos(a) * d);
      const y = Math.round(cy + Math.sin(a) * d);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = (y * width + x) * 4;
      ring[0] += data[i];
      ring[1] += data[i + 1];
      ring[2] += data[i + 2];
      count++;
    }
  }
  // de rand rond het zegel bevat schaduw; iets lichter maken zodat de vlek niet opvalt
  const paper = ring.map((v) => Math.min(255, (v / count) * 1.03));
  const noise = grain(31);
  const feather = 10;
  for (let y = Math.floor(cy - r - feather); y <= Math.ceil(cy + r + feather); y++) {
    for (let x = Math.floor(cx - r - feather); x <= Math.ceil(cx + r + feather); x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const d = Math.hypot(x - cx, y - cy);
      const wgt = Math.min(1, Math.max(0, (r + feather - d) / (feather * 2)));
      if (wgt <= 0) continue;
      const n = noise();
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = data[i + c] * (1 - wgt) + (paper[c] + n) * wgt;
    }
  }
}

// Lichte papierkorrel: herhaalbare ruis van een paar tinten.
function grain(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 6;
}

function reliefMask(original, originalData, g, k) {
  const { width: w, height: h } = original;
  const sharp = originalData.data;
  const lum = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) lum[p] = 0.3 * sharp[p * 4] + 0.59 * sharp[p * 4 + 1] + 0.11 * sharp[p * 4 + 2];
  // zelf vervagen (twee keer een kastfilter); het canvas-filter van de browser werkt niet in elke Safari
  const r = Math.max(1, Math.round(4 * k));
  const soft = boxBlur(boxBlur(lum, w, h, r), w, h, r);

  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const d = img.data;
  const ribbonPad = 6 * k;
  for (let y = 0; y < h; y++) {
    if (y < g.top + 6 * k || y > g.bottom) continue;
    if (y > g.ribbonTop - ribbonPad && y < g.ribbonBottom + ribbonPad) continue;
    for (let x = 0; x < w; x++) {
      if (Math.hypot(x - g.sealX, y - g.sealY) < g.sealR + 8 * k) continue;
      const p = y * w + x;
      const diff = Math.abs(lum[p] - soft[p]);
      const i = p * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.min(255, Math.max(0, (diff - 9) * 20));
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

// Kastfilter: eerst horizontaal, dan verticaal, met een lopende som.
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / size;
      sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / size;
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}
