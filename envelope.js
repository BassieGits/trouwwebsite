// Bouwt de strandenvelop (assets/envelop-strand.png) op in losse lagen:
// achtergrond, vier kleppen met een linnen binnenkant, het zegel in twee helften
// en een kaart van het blinddruk-reliëf (schelp en blad) waarlangs het zonlicht loopt.
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
  seal: [383, 686, 117], // midden en straal
  // het puntje van de pampaspluim valt over de vouwlijn van de bovenklep; dat stukje gaat mee met de rechterklep
  notch: [[614, 330], [585, 340], [572, 356], [580, 372], [595, 372]],
  foil: [[30, 565, 150, 245], [600, 560, 128, 260]], // schelp en blad: x, y, breedte, hoogte
  linen: [170, 190, 420, 150], // schoon stuk linnen, voor de binnenkant van de kleppen
  water: [[380, 20, 388, 130], [480, 1235, 288, 120]], // zee boven en onder de envelop, voor de schittering
};

export async function buildEnvelope(stage, src) {
  const img = new Image();
  img.src = src;
  await img.decode();

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const k = w / G.width;
  const scale = (v) => (Array.isArray(v) ? v.map(scale) : v * k);
  const g = Object.fromEntries(Object.entries(G).map(([key, v]) => [key, scale(v)]));
  const pct = (x, y) => `${((x / w) * 100).toFixed(3)}% ${((y / h) * 100).toFixed(3)}%`;

  stage.style.aspectRatio = `${w} / ${h}`;
  const scene = stage.querySelector('.env-scene');

  const original = canvasFrom(img, w, h);
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
  // Heel papier onder de kleppen, zodat de kniplijnen tussen de kleppen niet doorschemeren zolang ze dicht zijn.
  const under = makeCanvas(w, h);
  under.getContext('2d').drawImage(paper, 0, 0);
  under.className = 'env-layer env-paper';
  scene.querySelector('.env-flaps').append(under);
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
    back.style.clipPath = `polygon(${mirrored.map(([x, y]) => pct(x, y)).join(', ')})`;
    back.style.backgroundImage = `linear-gradient(${vertical ? '180deg' : '90deg'}, rgba(255, 251, 243, 0.5), rgba(255, 251, 243, 0.15)), url(${linenUrl})`;
    back.style.backgroundSize = `100% 100%, ${((g.linen[2] / w) * 100).toFixed(2)}% auto`;

    group.append(front, back);
    scene.querySelector('.env-flaps').append(group);
  }

  /* Zegel: uit de afbeelding geknipt, in twee helften langs een grillige breuk */
  const sealMask = sealCanvas(original, sx, sy, sr, k);
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

  /* Zonlicht langs het reliëf: het licht vertrekt bij het punt het dichtst bij het zegel */
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

// Het zegel: een cirkel met een zachte rand (ivoor op wit linnen is niet op kleur te scheiden).
function sealCanvas(original, cx, cy, r, k) {
  const { width: w, height: h } = original;
  const out = makeCanvas(w, h);
  const ctx = out.getContext('2d');
  const soft = ctx.createRadialGradient(cx, cy, r - 3 * k, cx, cy, r);
  soft.addColorStop(0, '#000');
  soft.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = soft;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(original, 0, 0);
  return out;
}

// De lijnen van schelp en blad zijn blind in het papier gedrukt: ze vallen op doordat ze
// lichter of donkerder zijn dan het papier vlak eromheen (hoogdoorlaat van de helderheid).
function foilMask(originalData, g, w) {
  const s = originalData.data;
  const h = s.length / 4 / w;
  const lum = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) lum[p] = 0.3 * s[p * 4] + 0.59 * s[p * 4 + 1] + 0.11 * s[p * 4 + 2];
  const r = Math.max(2, Math.round((5 * w) / 768));
  const blurred = boxBlur(boxBlur(lum, w, h, r), w, h, r);
  const on = new Uint8Array(w * h);
  const strength = new Uint8Array(w * h);
  for (const [bx, by, bw, bh] of g.foil) {
    for (let y = Math.round(by); y < by + bh; y++) {
      for (let x = Math.round(bx); x < bx + bw; x++) {
        const p = y * w + x;
        const a = Math.min(1, Math.max(0, (Math.abs(lum[p] - blurred[p]) - FOIL_THRESHOLD) / 6));
        if (a > 0.25) {
          on[p] = 1;
          strength[p] = a * 255;
        }
      }
    }
  }
  return { on, strength };
}
const FOIL_THRESHOLD = 7;

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

// Zoekt alle losse lijnen in de reliëfkaart en berekent per pixel wanneer het licht er aankomt.
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
