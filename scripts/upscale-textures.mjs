import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { GoogleAuth } from 'google-auth-library';

const TRUE_TEXTURES_DIR = path.join('public', 'models', 'true');
const OUTPUT_DIR = path.join('public', 'models', 'true_upscaled');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function callOpenRouterImageWithImage(prompt, imageBase64, imageMime = 'image/jpeg') {
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
  const body = {
    model,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${imageMime};base64,${imageBase64}`
          }
        },
        {
          type: 'text',
          text: prompt
        }
      ]
    }],
    modalities: ['image', 'text']
  };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  console.log(JSON.stringify({ openrouter_model: model, endpoint: url }));
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

async function callGeminiWithImage(prompt, imageBase64, imageMime = 'image/jpeg', temperature = 0.5) {
  let key = process.env.GEMINI_API_KEY;
  if (!key) {
    try {
      const envText = await fs.promises.readFile(path.join(process.cwd(), '.env'), 'utf-8');
      const match = envText.match(/(^|\n)\s*GEMINI_API_KEY\s*=\s*([^\n\r]+)/);
      if (match) key = match[2].trim();
    } catch { }
  }
  if (!key) throw new Error('missing_api_key');
  
  const preferred = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
  let bearer = process.env.GOOGLE_AUTH_TOKEN;
  if (!bearer) {
    try {
      const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/generative-language'] });
      const client = await auth.getClient();
      const tok = await client.getAccessToken();
      if (tok) bearer = typeof tok === 'string' ? tok : tok.token;
    } catch { }
  }
  
  const hasBearer = Boolean(bearer && bearer.length > 0);
  const url = hasBearer
    ? `https://generativelanguage.googleapis.com/v1beta/models/${preferred}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${preferred}:generateContent?key=${key}`;
  
  const body = {
    contents: [{
      role: 'user',
      parts: [
        {
          inline_data: {
            mime_type: imageMime,
            data: imageBase64
          }
        },
        { text: prompt }
      ]
    }],
    generationConfig: {
      response_modalities: ['image', 'text'],
      temperature
    }
  };
  
  const headers = hasBearer
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${bearer}` }
    : { 'Content-Type': 'application/json' };
  
  console.log(JSON.stringify({ model: preferred, auth: hasBearer ? 'bearer' : 'api_key' }));
  
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`http_${res.status}:${t}`);
  }
  
  const json = await res.json();
  let b64 = null;
  try {
    // Look for inline_data in the response
    for (const part of json.candidates[0].content.parts) {
      if (part.inline_data && part.inline_data.data) {
        b64 = part.inline_data.data;
        break;
      }
    }
  } catch { }
  if (!b64) throw new Error('no_image_data');
  return Buffer.from(b64, 'base64');
}

async function upscaleTexture(inputPath, outputPath, targetResolution = 1024) {
  console.log(`\nProcessing: ${inputPath}`);
  
  // Read the original image
  const originalBuffer = await fs.promises.readFile(inputPath);
  const metadata = await sharp(originalBuffer).metadata();
  console.log(`  Original size: ${metadata.width}x${metadata.height}`);
  
  // Convert to PNG and resize to a reasonable size for the API (if too small, upscale first with sharp)
  const prepBuffer = await sharp(originalBuffer)
    .resize(512, 512, { fit: 'fill' })
    .png()
    .toBuffer();
  
  const imageBase64 = prepBuffer.toString('base64');
  
  const prompt = `You are an expert texture artist. Take this game texture and create an enhanced, upscaled version.

REQUIREMENTS:
- Output a ${targetResolution}x${targetResolution} pixel image
- Enhance details and add realistic surface variations
- Maintain the original color palette and overall appearance
- Make the texture tileable/seamless if it appears to be designed that way
- Add subtle surface details like scratches, wear, and material imperfections
- Improve the resolution and sharpness while keeping the original artistic intent
- This is for a space game (spaceships, stations, metal panels, etc.)

Return ONLY the enhanced texture image, no text.`;

  let enhancedBuffer = null;
  
  // Try OpenRouter first (more reliable), then Gemini as fallback
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  
  if (hasOpenRouter) {
    try {
      console.log('  Calling AI (OpenRouter)...');
      enhancedBuffer = await callOpenRouterImageWithImage(prompt, imageBase64, 'image/png');
      console.log('  ✓ AI upscale succeeded');
    } catch (err) {
      console.log(`  ✗ OpenRouter failed: ${err.message}`);
    }
  }
  
  if (!enhancedBuffer && hasGemini) {
    try {
      console.log('  Trying Gemini API fallback...');
      enhancedBuffer = await callGeminiWithImage(prompt, imageBase64, 'image/png', 0.4);
      console.log('  ✓ Gemini succeeded');
    } catch (err) {
      console.log(`  ✗ Gemini failed: ${err.message}`);
    }
  }
  
  if (!enhancedBuffer) {
    // Fallback: Just do a sharp upscale with sharpening
    console.log('  Falling back to sharp upscale...');
    enhancedBuffer = await sharp(originalBuffer)
      .resize(targetResolution, targetResolution, { fit: 'fill', kernel: 'lanczos3' })
      .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.7 })
      .modulate({ saturation: 1.1 })
      .png()
      .toBuffer();
    console.log('  ✓ Sharp upscale completed');
  }
  
  // Ensure output is the target resolution
  const finalBuffer = await sharp(enhancedBuffer)
    .resize(targetResolution, targetResolution, { fit: 'fill' })
    .png()
    .toBuffer();
  
  await fs.promises.writeFile(outputPath, finalBuffer);
  console.log(`  ✓ Saved: ${outputPath}`);
  
  return outputPath;
}

async function run() {
  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 10;
  const targetRes = parseInt(args[1]) || 1024;
  const startIndex = parseInt(args[2]) || 0;
  
  console.log(`Upscaling ${count} textures (starting at index ${startIndex}) to ${targetRes}x${targetRes}`);
  console.log('='.repeat(50));
  
  await ensureDir(OUTPUT_DIR);
  
  // Get the texture files and sort them numerically
  const files = await fs.promises.readdir(TRUE_TEXTURES_DIR);
  const jpgFiles = files
    .filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''));
      const numB = parseInt(b.replace(/\D/g, ''));
      return numA - numB;
    });
  
  console.log(`Found ${jpgFiles.length} texture files`);
  
  const toProcess = jpgFiles.slice(startIndex, startIndex + count);
  const results = [];
  
  for (const file of toProcess) {
    const inputPath = path.join(TRUE_TEXTURES_DIR, file);
    const baseName = path.basename(file, path.extname(file));
    const outputPath = path.join(OUTPUT_DIR, `${baseName}.png`);
    
    try {
      await upscaleTexture(inputPath, outputPath, targetRes);
      results.push({ file, status: 'success', output: outputPath });
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      results.push({ file, status: 'error', error: err.message });
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY:');
  console.log(`  Processed: ${results.length}`);
  console.log(`  Success: ${results.filter(r => r.status === 'success').length}`);
  console.log(`  Failed: ${results.filter(r => r.status === 'error').length}`);
  console.log(`  Output directory: ${OUTPUT_DIR}`);
}

run().catch((e) => {
  console.error('Fatal error:', String(e));
  process.exit(1);
});
