import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { GoogleAuth } from 'google-auth-library';

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function callOpenRouterImage(prompt, mime = 'image/png') {
  let key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    try {
      const envText = await fs.promises.readFile(path.join(process.cwd(), '.env'), 'utf-8');
      const match = envText.match(/(^|\n)\s*OPENROUTER_API_KEY\s*=\s*([^\n\r]+)/);
      if (match) key = match[2].trim();
    } catch { }
  }
  if (!key) throw new Error('missing_openrouter_key');
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-3-pro-image-preview';
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const body = { model, messages: [{ role: 'user', content: prompt }], modalities: ['image', 'text'] };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  try { console.log(JSON.stringify({ openrouter_model: model, endpoint: url })); } catch { }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`http_${res.status}:${t}`);
  }
  const json = await res.json();
  let dataUrl = null;
  try {
    dataUrl = json.choices[0].message.images[0].image_url.url;
  } catch { }
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.includes(',')) throw new Error('no_image_data');
  const b64 = dataUrl.split(',').pop();
  return Buffer.from(b64, 'base64');
}

async function callGemini(prompt, mime = 'image/png', temperature = 0.7) {
  let key = process.env.GEMINI_API_KEY;
  if (!key) {
    try {
      const envText = await fs.promises.readFile(path.join(process.cwd(), '.env'), 'utf-8');
      const match = envText.match(/(^|\n)\s*GEMINI_API_KEY\s*=\s*([^\n\r]+)/);
      if (match) key = match[2].trim();
    } catch { }
  }
  if (!key) throw new Error('missing_api_key');
  const preferred = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash-image';
  let bearer = process.env.GOOGLE_AUTH_TOKEN;
  if (!bearer) {
    try {
      const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/generative-language'] });
      const client = await auth.getClient();
      const tok = await client.getAccessToken();
      if (tok) bearer = typeof tok === 'string' ? tok : tok.token;
      if (bearer) console.log(JSON.stringify({ auth_source: 'google-auth-library', token_preview: bearer.slice(0, 8) }));
    } catch { }
  }
  const hasBearer = Boolean(bearer && bearer.length > 0);
  const url = hasBearer
    ? `https://generativelanguage.googleapis.com/v1/${preferred}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/${preferred}:generateContent?key=${key}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { response_mime_type: mime, temperature }
  };
  const headers = hasBearer
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${bearer}` }
    : { 'Content-Type': 'application/json' };
  try { console.log(JSON.stringify({ model: preferred, auth: hasBearer ? 'bearer' : 'api_key', endpoint: url })); } catch { }
  let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!hasBearer && res.status === 401) {
    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    try { console.log(JSON.stringify({ fallback_model: 'models/gemini-1.5-flash', endpoint: fallbackUrl })); } catch { }
    res = await fetch(fallbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`http_${res.status}:${t}`);
  }
  const json = await res.json();
  let b64 = null;
  try {
    b64 = json.candidates[0].content.parts[0].inline_data.data;
  } catch { }
  if (!b64) throw new Error('no_image_data');
  return Buffer.from(b64, 'base64');
}

async function callImage(prompt, mime = 'image/png', temperature = 0.7) {
  const hasOR = Boolean(process.env.OPENROUTER_API_KEY);
  if (hasOR) {
    try { return await callOpenRouterImage(prompt, mime); } catch { }
  }
  try { return await callGemini(prompt, mime, temperature); } catch { }
  throw new Error('image_backend_failed');
}

async function writeTextures(name, prompt, resolution = 1024, options = {}) {
  const opts = options || {};
  const outDir = path.join('public', 'materials', name);
  await ensureDir(outDir);
  const basePrompt = `${prompt}. tileable seamless base color (albedo), ${resolution}x${resolution}, neutral lighting, flat lay, consistent scale.`;
  let baseBuffer = null;
  // Skip AI for planet earth to ensure seamless procedural generation
  const isEarth = (name.toLowerCase().includes('planet') && name.toLowerCase().includes('earth')) || prompt.toLowerCase().includes('earth');
  const useAI = opts.forceAi || !isEarth;
  if (useAI) {
    try { baseBuffer = await callImage(basePrompt, 'image/png', 0.5); } catch (err) {
      if (opts.noProceduralFallback) throw err;
    }
  }
  if (!baseBuffer) baseBuffer = await generateProceduralBase(name, prompt, resolution);
  // Even AI outputs can have slight edge mismatches; force-seamless before deriving other maps.
  baseBuffer = await fixSeamPng(baseBuffer);
  const roughBuffer = await generateProceduralRough(baseBuffer, resolution);
  const metalBuffer = await generateProceduralMetal(name, resolution);
  const normalBuffer = await generateNormalFromBase(baseBuffer, resolution);
  const basePath = path.join(outDir, 'baseColor.png');
  await fs.promises.writeFile(basePath, baseBuffer);
  const roughPath = path.join(outDir, 'roughness.png');
  await sharp(roughBuffer).resize(resolution, resolution).greyscale().toFile(roughPath);
  const metalPath = path.join(outDir, 'metallic.png');
  await sharp(metalBuffer).resize(resolution, resolution).toFile(metalPath);
  const normalPath = path.join(outDir, 'normal.png');
  await fs.promises.writeFile(normalPath, normalBuffer);
  let cloudsAlphaPath = null;
  if (isEarth) {
    cloudsAlphaPath = path.join(outDir, 'cloudsAlpha.png');
    const cl = await generateCloudsAlpha(resolution);
    await fs.promises.writeFile(cloudsAlphaPath, cl);
  }
  let emissivePath = null;
  if (options.emissiveColor) {
    const c = options.emissiveColor;
    const hex = c.startsWith('#') ? c.slice(1) : c;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    emissivePath = path.join(outDir, 'emissive.png');
    const grid = await generateGridEmissive({ width: resolution, height: resolution, r, g, b });
    await fs.promises.writeFile(emissivePath, grid);
  }
  return { baseColor: basePath, roughness: roughPath, metallic: metalPath, normal: normalPath, emissive: emissivePath, cloudsAlpha: cloudsAlphaPath };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function hash(n) { n = Math.sin(n) * 43758.5453; return n - Math.floor(n); }
function fixHorizontalSeam(buf, width, height, channels, border = 4) {
  // Force the left/right edges to agree so equirect wrapping doesn't show a seam.
  const b = Math.max(1, Math.min(border, Math.floor(width / 4)));
  for (let y = 0; y < height; y++) {
    for (let c = 0; c < channels; c++) {
      const idxL = (y * width + 0) * channels + c;
      const idxR = (y * width + (width - 1)) * channels + c;
      const avg = (buf[idxL] + buf[idxR]) >> 1;
      buf[idxL] = avg;
      buf[idxR] = avg;
      for (let i = 1; i < b; i++) {
        const t = i / b;
        const idxLi = (y * width + i) * channels + c;
        const idxRi = (y * width + (width - 1 - i)) * channels + c;
        buf[idxLi] = Math.round(lerp(buf[idxLi], avg, t));
        buf[idxRi] = Math.round(lerp(buf[idxRi], avg, t));
      }
    }
  }
}
async function fixSeamPng(buffer) {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const targetChannels = Math.min(meta.channels || 3, 3); // Drop alpha if present
  const pipeline = targetChannels === 3 && meta.channels === 4 && img.removeAlpha ? img.removeAlpha() : img;
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const copy = Buffer.from(data);
  fixHorizontalSeam(copy, info.width, info.height, info.channels, 6);
  return sharp(copy, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
}
function valueNoise(x, y, sx, sy, wrapW = 0) {
  let x0 = Math.floor(x / sx) * sx; const y0 = Math.floor(y / sy) * sy;
  let x1 = (x0 + sx); const y1 = (y0 + sy);

  // Wrap x coordinates for seamless horizontal tiling
  if (wrapW > 0) {
    x0 = ((x0 % wrapW) + wrapW) % wrapW;
    x1 = ((x1 % wrapW) + wrapW) % wrapW;
  }

  const tx = (x - Math.floor(x / sx) * sx) / sx; const ty = (y - y0) / sy;
  const h00 = hash(x0 * 12.9898 + y0 * 78.233);
  const h10 = hash(x1 * 12.9898 + y0 * 78.233);
  const h01 = hash(x0 * 12.9898 + y1 * 78.233);
  const h11 = hash(x1 * 12.9898 + y1 * 78.233);
  const a = lerp(h00, h10, tx);
  const b = lerp(h01, h11, tx);
  return lerp(a, b, ty);
}
function palette(prompt) {
  const s = (prompt || '').toLowerCase();
  if (s.includes('desert')) return [[200, 170, 120], [240, 200, 150]];
  if (s.includes('lava') || s.includes('volcan')) return [[150, 30, 20], [240, 80, 30]];
  if (s.includes('forest')) return [[40, 80, 50], [80, 140, 90]];
  if (s.includes('ice') || s.includes('snow')) return [[160, 200, 230], [200, 230, 255]];
  if (s.includes('green')) return [[40, 100, 60], [100, 180, 120]];
  if (s.includes('red')) return [[120, 40, 30], [200, 70, 60]];
  return [[60, 90, 140], [100, 140, 200]];
}
async function generateProceduralBase(name, prompt, resolution) {
  const lower = (name + ' ' + prompt).toLowerCase();
  if (lower.includes('planet') && lower.includes('earth')) return generateEarthBase(resolution);
  if (lower.includes('brushed')) return generateBrushedBase(resolution);
  if (lower.includes('polymer') || lower.includes('leather')) return generatePolymerBase(resolution);
  if (lower.includes('canopy') || lower.includes('glass')) return generateGlassBase(resolution);
  return generatePaintedBase(resolution);
}


async function generateEarthBase(resolution) {
  const width = resolution; const height = resolution; const channels = 3;
  const buf = Buffer.alloc(width * height * channels);
  const oceanDeep = [40, 85, 150];
  const oceanShallow = [70, 120, 185];
  const landLow = [60, 100, 70];
  const landMid = [110, 120, 80];
  const landHigh = [160, 150, 130];
  const ice = [215, 235, 245];
  const sx = Math.max(8, Math.floor(resolution / 16));
  const sy = Math.max(8, Math.floor(resolution / 16));
  const fbm = (x, y, ox, oy, oct = 5) => {
    let v = 0; let a = 0.5; let fx = 1; let fy = 1;
    for (let i = 0; i < oct; i++) {
      v += valueNoise(x * fx + ox, y * fy + oy, sx / fx, sy / fy, width) * a;
      a *= 0.5; fx *= 2; fy *= 2;
    }
    return v;
  };
  const warpAmp = Math.max(4, Math.floor(Math.min(sx, sy) * 0.75));
  for (let y = 0; y < height; y++) {
    const lat = (y / height) * 2 - 1;
    const latIce = Math.max(0, Math.abs(lat) - 0.72) * 5;
    for (let x = 0; x < width; x++) {
      const wx = fbm(x, y, 123.4, 567.8, 3);
      const wy = fbm(x, y, 911.7, 311.2, 3);
      const hx = x + (wx - 0.5) * warpAmp;
      const hy = y + (wy - 0.5) * warpAmp;
      const h1 = fbm(hx, hy, 37.1, 91.7, 5);
      const h2 = fbm(hx, hy, 97.8, 73.2, 4);
      const heightN = clamp(h1 * 0.65 + h2 * 0.35, 0, 1);
      const waterLevel = 0.52;
      const coastWidth = 0.04;
      const nearCoast = clamp((heightN - (waterLevel - coastWidth)) / (coastWidth * 2), 0, 1);
      let r = 0, g = 0, b = 0;
      if (latIce > 0.35) {
        r = ice[0]; g = ice[1]; b = ice[2];
      } else if (heightN < waterLevel) {
        const d = clamp((waterLevel - heightN) / waterLevel, 0, 1);
        r = Math.round(lerp(oceanShallow[0], oceanDeep[0], d));
        g = Math.round(lerp(oceanShallow[1], oceanDeep[1], d));
        b = Math.round(lerp(oceanShallow[2], oceanDeep[2], d));
        const coastMix = nearCoast * 0.35;
        r = Math.round(lerp(r, oceanShallow[0], coastMix));
        g = Math.round(lerp(g, oceanShallow[1], coastMix));
        b = Math.round(lerp(b, oceanShallow[2], coastMix));
      } else {
        const t = clamp((heightN - waterLevel) / (1 - waterLevel), 0, 1);
        const arid = clamp(1 - Math.abs(lat) * 1.25, 0, 1);
        const lowR = Math.round(lerp(landLow[0], landMid[0], arid));
        const lowG = Math.round(lerp(landLow[1], landMid[1], arid));
        const lowB = Math.round(lerp(landLow[2], landMid[2], arid));
        const highR = landHigh[0];
        const highG = landHigh[1];
        const highB = landHigh[2];
        r = Math.round(lerp(lowR, highR, t));
        g = Math.round(lerp(lowG, highG, t));
        b = Math.round(lerp(lowB, highB, t));
        const coastTint = clamp(1 - t, 0, 1) * nearCoast * 0.25;
        r = Math.round(lerp(r, lowR, coastTint));
        g = Math.round(lerp(g, lowG, coastTint));
        b = Math.round(lerp(b, lowB, coastTint));
      }
      const i = (y * width + x) * channels;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }
  }
  fixHorizontalSeam(buf, width, height, channels, 6);
  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}
async function generateCloudsAlpha(resolution) {
  const width = resolution; const height = resolution; const channels = 1;
  const buf = Buffer.alloc(width * height * channels);
  const sx = Math.max(6, Math.floor(resolution / 14));
  const sy = Math.max(6, Math.floor(resolution / 14));
  const fbm = (x, y, ox, oy, oct = 4) => {
    let v = 0; let a = 0.5; let fx = 1; let fy = 1;
    for (let i = 0; i < oct; i++) {
      v += valueNoise(x * fx + ox, y * fy + oy, sx / fx, sy / fy, width) * a;
      a *= 0.5; fx *= 2; fy *= 2;
    }
    return v;
  };
  const warpAmp = Math.max(3, Math.floor(Math.min(sx, sy) * 0.6));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const wx = fbm(x, y, 13.4, 51.7, 3);
      const wy = fbm(x, y, 97.2, 73.9, 3);
      const hx = x + (wx - 0.5) * warpAmp;
      const hy = y + (wy - 0.5) * warpAmp;
      const c1 = fbm(hx, hy, 31.1, 71.3, 4);
      const c2 = fbm(hx, hy, 91.7, 17.9, 3);
      const v = clamp(c1 * 0.6 + c2 * 0.4 - 0.58, 0, 1);
      buf[(y * width + x) * channels] = Math.round(lerp(0, 255, v));
    }
  }
  fixHorizontalSeam(buf, width, height, channels, 6);
  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}
async function generatePaintedBase(resolution) {
  const [c1, c2] = [[70, 70, 75], [85, 85, 90]];
  const width = resolution; const height = resolution; const channels = 3;
  const buf = Buffer.alloc(width * height * channels);
  const sx = Math.max(6, Math.floor(resolution / 24));
  const sy = Math.max(6, Math.floor(resolution / 24));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const f1 = valueNoise(x, y, sx, sy);
      const f2 = valueNoise(x + sx * 0.5, y + sy * 0.5, sx, sy);
      const n = clamp(f1 * 0.7 + f2 * 0.3, 0, 1);
      const mix = clamp(lerp(0.3, 0.7, n), 0, 1);
      const r = Math.round(lerp(c1[0], c2[0], mix));
      const g = Math.round(lerp(c1[1], c2[1], mix));
      const b = Math.round(lerp(c1[2], c2[2], mix));
      const i = (y * width + x) * channels; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }
  }
  fixHorizontalSeam(buf, width, height, channels, 4);
  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}
async function generateBrushedBase(resolution) {
  const width = resolution; const height = resolution; const channels = 3;
  const buf = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const line = Math.sin(x * 0.08) * 0.5 + 0.5;
      const noise = valueNoise(x, y, 4, Math.max(8, Math.floor(resolution / 32)));
      const v = clamp(line * 0.6 + noise * 0.4, 0, 1);
      const base = Math.round(lerp(95, 140, v));
      const i = (y * width + x) * channels; buf[i] = base; buf[i + 1] = base; buf[i + 2] = base;
    }
  }
  fixHorizontalSeam(buf, width, height, channels, 4);
  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}
async function generatePolymerBase(resolution) {
  const width = resolution; const height = resolution; const channels = 3;
  const buf = Buffer.alloc(width * height * channels);
  const sx = Math.max(10, Math.floor(resolution / 20));
  const sy = Math.max(10, Math.floor(resolution / 20));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n = valueNoise(x, y, sx, sy);
      const v = Math.round(lerp(60, 90, n));
      const i = (y * width + x) * channels; buf[i] = v; buf[i + 1] = v + 10; buf[i + 2] = v;
    }
  }
  fixHorizontalSeam(buf, width, height, channels, 4);
  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}
async function generateGlassBase(resolution) {
  const width = resolution; const height = resolution; const channels = 3;
  const buf = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.round(lerp(160, 180, valueNoise(x, y, 16, 16)));
      const i = (y * width + x) * channels; buf[i] = 150; buf[i + 1] = v; buf[i + 2] = 200;
    }
  }
  fixHorizontalSeam(buf, width, height, channels, 4);
  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}
async function generateProceduralRough(baseBuffer, resolution) {
  return sharp(baseBuffer).resize(resolution, resolution).greyscale().modulate({ brightness: 0.95, saturation: 0.0 }).png().toBuffer();
}
async function generateProceduralMetal(name, resolution) {
  const n = name.toLowerCase();
  const v = n.includes('brushed') ? 40 : n.includes('canopy') ? 0 : n.includes('polymer') ? 0 : 10;
  return sharp({ create: { width: resolution, height: resolution, channels: 3, background: { r: v, g: v, b: v } } }).png().toBuffer();
}
async function generateNormalFromBase(baseBuffer, resolution) {
  const img = await sharp(baseBuffer).resize(resolution, resolution).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = img.info.width; const h = img.info.height; const src = img.data; const out = Buffer.alloc(w * h * 3);
  const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const s = (x, y) => src[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let gx = 0; let gy = 0; let idx = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const v = s(x + i, y + j);
          gx += v * kx[idx]; gy += v * ky[idx]; idx++;
        }
      }
      const nx = -gx / 255.0; const ny = -gy / 255.0; const nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const rx = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      const ry = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      const rz = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      const i3 = (y * w + x) * 3; out[i3] = rx; out[i3 + 1] = ry; out[i3 + 2] = rz;
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}
async function generateGridEmissive({ width, height, r, g, b }) {
  const channels = 3; const buf = Buffer.alloc(width * height * channels);
  const step = Math.max(8, Math.floor(width / 16));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const on = x % step === 0 || y % step === 0;
      const i = (y * width + x) * channels;
      buf[i] = on ? r : Math.round(r * 0.2);
      buf[i + 1] = on ? g : Math.round(g * 0.2);
      buf[i + 2] = on ? b : Math.round(b * 0.2);
    }
  }
  return sharp(buf, { raw: { width, height, channels } }).png().toBuffer();
}

async function run() {
  const specPath = process.argv[2];
  if (!specPath) throw new Error('missing_spec');
  const text = await fs.promises.readFile(specPath, 'utf-8');
  const spec = JSON.parse(text);
  const name = spec.name ?? 'material';
  const prompt = spec.prompt ?? 'painted metal panel with subtle wear';
  const isEarthLike = name.toLowerCase().includes('planet') || prompt.toLowerCase().includes('earth');
  const resolution = spec.resolution ?? (isEarthLike ? 2048 : 1024);
  const files = await writeTextures(name, prompt, resolution, {
    emissiveColor: spec.emissiveColor,
    forceAi: spec.forceAi,
    noProceduralFallback: spec.noProceduralFallback
  });
  console.log(JSON.stringify({ name, files }, null, 2));
}

run().catch((e) => { console.error(String(e)); process.exit(1); });
