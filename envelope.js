// Bouwt de strandenvelop (assets/envelop-strand.png) op in losse lagen:
// achtergrond, vier kleppen met een linnen binnenkant, het zegel in twee helften
// en een kaart van de rosé-gouden folie waarlangs het zonlicht loopt.
// De beweging zelf staat in styles.css; deze code knipt alleen de lagen uit.

// Maten in pixels van de originele afbeelding (768 × 1376).
const G = {
  width: 768,
  top: 162, // bovenrand van de envelop
  bottom: 1215, // onderrand van de envelop
  topLeft: [55, 162],
  topRight: [715, 162],
  topTip: [388, 735],
  bottomLeft: [60, 1215],
  bottomRight: [708, 1215],
  bottomTip: [386, 660],
  leftTip: [365, 695],
  rightTip: [409, 700],
  seal: [385, 688, 114], // midden en straal
  // het puntje van de pampaspluim valt over de vouwlijn van de bovenklep; dat stukje gaat mee met de rechterklep
  notch: [[614, 330], [585, 340], [572, 356], [580, 372], [595, 372]],
  foil: [[30, 565, 150, 245], [600, 560, 128, 260]], // schelp en blad: x, y, breedte, hoogte
  linen: [170, 190, 420, 150], // schoon stuk linnen, voor de binnenkant van de kleppen
  letters: [312, 658, 148, 64], // de oorspronkelijke letters M&B op het zegel: x, y, breedte, hoogte
  // M, & en B uit assets/namen.png (La Luxes Script): begin en eind in pixels
  glyphs: { M: [14, 163], amp: [412, 512], B: [556, 685] },
  water: [[380, 20, 388, 130], [480, 1235, 288, 120]], // zee boven en onder de envelop, voor de schittering
};

export async function buildEnvelope(stage, src, lettersSrc) {
  const img = new Image();
  img.src = src;
  await img.decode();

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const k = w / G.width;
  const scale = (v) => (Array.isArray(v) ? v.map(scale) : v * k);
  const g = Object.fromEntries(Object.entries(G).map(([key, v]) => [key, key === 'glyphs' ? v : scale(v)]));
  const pct = (x, y) => `${((x / w) * 100).toFixed(3)}% ${((y / h) * 100).toFixed(3)}%`;

  stage.style.aspectRatio = `${w} / ${h}`;
  const scene = stage.querySelector('.env-scene');

  const original = canvasFrom(img, w, h);
  const lettering = new Image();
  lettering.src = lettersSrc;
  await lettering.decode();
  engraveMonogram(original, lettering, g, k);
  const originalData = original.getContext('2d').getImageData(0, 0, w, h);

  /* Kleppen: vlakken van de envelop; onder het zegel aangevuld met linnen */
  const [sx, sy, sr] = g.seal;
  const paperData = new ImageData(new Uint8ClampedArray(originalData.data), w, h);
  fillWithLinen(paperData, originalData, g.linen, sx, sy, sr + 6 * k);
  const paper = makeCanvas(w, h);
  paper.getContext('2d').putImageData(paperData, 0, 0);

  const notch = g.notch;
  const flaps = {
    left: [[0, g.top], g.topLeft, g.leftTip, g.bottomLeft, [0, g.bottom]],
    right: [g.topRight, [w, g.top], [w, g.bottom], g.bottomRight, g.rightTip, ...[...notch].reverse(), g.topRight],
    bottom: [g.bottomLeft, g.bottomTip, g.bottomRight],
    top: [g.topLeft, g.topRight, ...notch, g.topTip],
  };
  const linenTile = linenCanvas(original, g.linen);
  const linenUrl = linenTile.toDataURL('image/jpeg', 0.85);

  for (const [name, points] of Object.entries(flaps)) {
    const group = document.createElement('div');
    group.className = `env-flap env-flap-${name}`;

    const front = makeCanvas(w, h);
    const ctx = front.getContext('2d');
    ctx.clip(pathOf(points));
    ctx.drawImage(paper, 0, 0);
    front.className = 'env-layer env-flap-front';

    // De binnenkant wordt in CSS 180° gedraaid; daarom de vorm vooraf spiegelen.
    const vertical = name === 'top' || name === 'bottom';
    const mirrored = points.map(([x, y]) => (vertical ? [x, h - y] : [w - x, y]));
    const back = document.createElement('div');
    back.className = 'env-layer env-flap-back';
    back.style.clipPath = `polygon(${mirrored.map(([x, y]) => pct(x, y).replace(' ', ' ')).join(', ')})`;
    back.style.backgroundImage = `linear-gradient(${vertical ? '180deg' : '90deg'}, rgba(255, 251, 243, 0.5), rgba(255, 251, 243, 0.15)), url(${linenUrl})`;
    back.style.backgroundSize = `100% 100%, ${((g.linen[2] / w) * 100).toFixed(2)}% auto`;

    group.append(front, back);
    scene.querySelector('.env-flaps').append(group);
  }

  /* Zegel: goud uit de afbeelding geknipt, in twee helften langs een grillige breuk */
  const sealMask = sealCanvas(original, originalData, sx, sy, sr, k);
  const crack = [];
  for (let i = 0; i <= 10; i++) crack.push([sx + (i % 2 ? 7 : -6) * k * (i === 0 || i === 10 ? 0 : 1), sy - sr + (i / 10) * 2 * sr]);
  const halves = ['left', 'right'].map((side) => {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const edge = side === 'left' ? 0 : w;
    const overlap = side === 'left' ? k : -k; // een pixel overlap, anders schemert de breuk al door
    ctx.clip(pathOf([[edge, sy - sr - 10], ...crack.map(([x, y]) => [x + overlap, y]), [edge, sy + sr + 10]]));
    ctx.drawImage(sealMask, 0, 0);
    c.className = `env-layer env-seal-half env-seal-${side}`;
    return c;
  });
  const sealSource = halves.map((c) => {
    const copy = makeCanvas(w, h);
    copy.getContext('2d').drawImage(c, 0, 0);
    return copy;
  });
  scene.querySelector('.env-seal').append(...halves);

  /* Zonlicht langs de folie: het licht vertrekt bij het punt het dichtst bij het zegel */
  const routes = traceRoutes(foilMask(originalData, g, w), w, h, g);
  const glow = makeCanvas(w, h);
  const bloom = makeCanvas(Math.round(w / 2), Math.round(h / 2));
  glow.className = 'env-layer env-glow';
  bloom.className = 'env-layer env-bloom';
  scene.querySelector('.env-glow-slot').replaceWith(bloom, glow);

  /* Achtergrond en schittering op de zee */
  original.className = 'env-layer env-base';
  scene.prepend(original);
  const sea = scene.querySelector('.env-sea');
  const random = seeded(7);
  g.water.forEach(([x, y, ww, hh], area) => {
    const count = area === 0 ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('i');
      spark.style.left = `${((x + random() * ww) / w) * 100}%`;
      spark.style.top = `${((y + random() * hh) / h) * 100}%`;
      spark.style.animationDelay = `${(random() * 4).toFixed(2)}s`;
      spark.style.animationDuration = `${(2.6 + random() * 2.4).toFixed(2)}s`;
      sea.append(spark);
    }
  });

  // Plekken doorgeven aan de CSS.
  stage.style.setProperty('--env-top', `${(g.top / h) * 100}%`);
  stage.style.setProperty('--env-bottom', `${(g.bottom / h) * 100}%`);
  stage.style.setProperty('--seal-x', `${(sx / w) * 100}%`);
  stage.style.setProperty('--seal-y', `${(sy / h) * 100}%`);
  stage.style.setProperty('--seal-size', `${((sr * 2) / w) * 100}%`);

  const draw = (t) => {
    drawStream(t, routes, w, h, glow, bloom);
    drawSealShine(t, halves, sealSource, sx, sy, sr);
  };
  let frame = null;
  return {
    // t = seconden sinds er op het zegel is getikt
    render: draw,
    start() {
      const t0 = performance.now();
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        draw(t);
        if (t < 2.6) frame = requestAnimationFrame(tick);
      };
      tick();
    },
    stop() {
      cancelAnimationFrame(frame);
    },
  };
}

// Vervangt de letters op het zegel door M&B in La Luxes, als in het goud gedrukt.
function engraveMonogram(canvas, lettering, g, k) {
  const ctx = canvas.getContext('2d');
  const [lx, ly, lw, lh] = g.letters;

  // 1. oude letters weg: elke kolom vloeit over van het goud erboven naar het goud eronder
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width } = image;
  const top = Math.round(ly);
  const bottom = Math.round(ly + lh);
  const feather = 6 * k;
  for (let x = Math.round(lx - feather); x <= lx + lw + feather; x++) {
    const edge = Math.min(1, Math.min(x - (lx - feather), lx + lw + feather - x) / feather);
    for (let y = top; y <= bottom; y++) {
      const f = (y - top) / (bottom - top);
      const i = (y * width + x) * 4;
      const a = (top * width + x) * 4;
      const b = (bottom * width + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = data[i + c] * (1 - edge) + (data[a + c] * (1 - f) + data[b + c] * f) * edge;
    }
  }
  ctx.putImageData(image, 0, 0);

  // 2. M, & en B uit de namen knippen en tot één monogram samenvoegen
  const parts = [g.glyphs.M, g.glyphs.amp, g.glyphs.B];
  const overlap = 18;
  const glyphW = parts.reduce((sum, [a, b]) => sum + (b - a), 0) - overlap * (parts.length - 1);
  const mono = makeCanvas(glyphW + 8, lettering.height);
  const mctx = mono.getContext('2d');
  let cursor = 4;
  for (const [a, b] of parts) {
    mctx.drawImage(lettering, a, 0, b - a, lettering.height, cursor, 0, b - a, lettering.height);
    cursor += b - a - overlap;
  }

  // 3. in drie lagen op het zegel: schaduw, goud en een lichte rand bovenaan
  const targetW = 150 * k;
  const scale = targetW / mono.width;
  const dw = mono.width * scale;
  const dh = mono.height * scale;
  const [sx, sy] = g.seal;
  const dx = sx - dw / 2;
  const dy = sy - dh / 2 + 4 * k;
  const tint = (color) => {
    const c = makeCanvas(mono.width, mono.height);
    const tctx = c.getContext('2d');
    tctx.drawImage(mono, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, c.width, c.height);
    return c;
  };
  const shadow = tint('rgba(92, 60, 18, 0.75)');
  const body = tint('#a87a2c');
  const light = tint('rgba(255, 241, 196, 0.9)');
  const stamp = (layer, ox, oy) => {
    // de lijnen zijn dun op dit formaat; een paar keer licht verschoven stempelen maakt ze voller
    for (const [ax, ay] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) ctx.drawImage(layer, dx + (ox + ax) * k, dy + (oy + ay) * k, dw, dh);
  };
  ctx.save();
  ctx.shadowColor = 'rgba(90, 60, 20, 0.35)';
  ctx.shadowBlur = 2 * k;
  stamp(shadow, 0.9, 1.2);
  ctx.restore();
  stamp(light, -0.7, -0.7);
  stamp(body, 0, 0);
}

function pathOf(points) {
  const p = new Path2D();
  points.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

// Vult een cirkel met linnen uit een schoon stuk van de envelop, met een zachte overgang.
function fillWithLinen(image, source, [lx, ly, lw, lh], cx, cy, r) {
  const { data, width, height } = image;
  const src = source.data;
  const feather = 12;
  const x0 = Math.floor(cx - r - feather);
  const y0 = Math.floor(cy - r - feather);
  for (let y = y0; y <= cy + r + feather; y++) {
    for (let x = x0; x <= cx + r + feather; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const wgt = Math.min(1, Math.max(0, (r + feather - Math.hypot(x - cx, y - cy)) / (feather * 2)));
      if (wgt <= 0) continue;
      const tx = Math.round(lx) + ((x - x0) % Math.round(lw));
      const ty = Math.round(ly) + ((y - y0) % Math.round(lh));
      const i = (y * width + x) * 4;
      const j = (ty * width + tx) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = data[i + c] * (1 - wgt) + src[j + c] * wgt;
    }
  }
}

// Een tegel linnen die naadloos herhaalt (gespiegeld), iets lichter voor de binnenkant.
function linenCanvas(original, [lx, ly, lw, lh]) {
  const tw = Math.round(lw);
  const th = Math.round(lh);
  const c = makeCanvas(tw * 2, th * 2);
  const ctx = c.getContext('2d');
  for (const [fx, fy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    ctx.save();
    ctx.translate(fx < 0 ? tw * 2 : 0, fy < 0 ? th * 2 : 0);
    ctx.scale(fx, fy);
    ctx.drawImage(original, lx, ly, tw, th, 0, 0, tw, th);
    ctx.restore();
  }
  return c;
}

// Het gouden zegel: alles binnen de cirkel dat duidelijk goud is, met een zachte rand.
function sealCanvas(original, originalData, cx, cy, r, k) {
  const { width: w, height: h } = original;
  const out = makeCanvas(w, h);
  const ctx = out.getContext('2d');
  const image = ctx.createImageData(w, h);
  const d = image.data;
  const s = originalData.data;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > r) continue;
      const i = (y * w + x) * 4;
      const warm = s[i] - s[i + 2];
      let a = Math.min(1, Math.max(0, (warm - 52) / 22));
      if (dist < r - 30 * k) a = 1; // het midden met de letters altijd meenemen
      a *= Math.min(1, (r - dist) / 3);
      d[i] = s[i];
      d[i + 1] = s[i + 1];
      d[i + 2] = s[i + 2];
      d[i + 3] = a * 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

// De rosé-gouden lijntjes van schelp en blad: warmer en donkerder dan het linnen eromheen.
function foilMask(originalData, g, w) {
  const s = originalData.data;
  const on = new Uint8Array(s.length / 4);
  const strength = new Uint8Array(s.length / 4);
  for (const [bx, by, bw, bh] of g.foil) {
    for (let y = Math.round(by); y < by + bh; y++) {
      for (let x = Math.round(bx); x < bx + bw; x++) {
        const p = y * w + x;
        const i = p * 4;
        const warm = s[i] - s[i + 2];
        const lum = 0.3 * s[i] + 0.59 * s[i + 1] + 0.11 * s[i + 2];
        const a = Math.min(1, Math.max(0, (warm - 52) / 25)) * Math.min(1, Math.max(0, (196 - lum) / 20));
        if (a > 0.3) {
          on[p] = 1;
          strength[p] = a * 255;
        }
      }
    }
  }
  return { on, strength };
}

// Zoekt alle losse lijnen in de foliekaart en berekent per pixel wanneer het licht er aankomt.
function traceRoutes({ on, strength }, w, h, g) {
  const [sx, sy] = g.seal;
  const dist = new Float32Array(w * h).fill(-1);
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  const pixels = [];
  const arrive = [];
  const neighbours = [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1];

  for (let p = 0; p < w * h; p++) {
    if (!on[p] || seen[p]) continue;
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
      const d = Math.hypot(x - sx, y - sy);
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
    if (tail < 12) continue; // losse korrels overslaan
    head = 0;
    tail = 0;
    queue[tail++] = startPx;
    dist[startPx] = 0;
    while (head < tail) {
      const q = queue[head++];
      const x = q % w;
      pixels.push(q);
      arrive.push(best * 0.25 + dist[q]);
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
  const duration = 1.3; // seconden tot het licht overal is
  return {
    pixels: Int32Array.from(pixels),
    arrive: Float32Array.from(arrive, (a) => 0.15 + (a / maxArrive) * duration),
    strength: Uint8Array.from(pixels, (q) => strength[q]),
  };
}

function drawStream(t, routes, w, h, glow, bloom) {
  const ctx = glow.getContext('2d');
  const image = ctx.createImageData(w, h);
  const data = image.data;
  const { pixels, arrive, strength } = routes;
  for (let i = 0; i < pixels.length; i++) {
    const age = t - arrive[i];
    if (age < 0) continue;
    // een warme lichtkop loopt langs de lijn en laat een zacht uitdovend spoor achter
    const headGlow = Math.exp(-((age / 0.14) ** 2));
    const trail = Math.min(1, age * 6) * 0.55 * Math.exp(-age * 1.6);
    const a = Math.min(1, 1.6 * headGlow + trail * Math.min(1, (strength[i] / 255) * 1.8));
    const j = pixels[i] * 4;
    data[j] = 255;
    data[j + 1] = 196 + 50 * headGlow;
    data[j + 2] = 150 + 90 * headGlow;
    data[j + 3] = a * 255;
  }
  ctx.putImageData(image, 0, 0);
  const b = bloom.getContext('2d');
  b.clearRect(0, 0, bloom.width, bloom.height);
  b.drawImage(glow, 0, 0, bloom.width, bloom.height);
}

// Een glans die schuin over het zegel en de letters M&B trekt.
function drawSealShine(t, halves, sources, sx, sy, sr) {
  const p = (t - 0.55) / 0.75;
  halves.forEach((canvas, i) => {
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(sources[i], 0, 0);
    if (p <= 0 || p >= 1) return;
    const x = sx - sr * 1.6 + p * sr * 3.2;
    const band = ctx.createLinearGradient(x - sr * 0.45, sy - sr, x + sr * 0.45, sy + sr);
    band.addColorStop(0, 'rgba(255, 248, 225, 0)');
    band.addColorStop(0.5, 'rgba(255, 250, 232, 0.75)');
    band.addColorStop(1, 'rgba(255, 248, 225, 0)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = band;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  });
}

function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
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
