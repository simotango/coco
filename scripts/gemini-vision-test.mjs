import 'dotenv/config';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

function guessMime(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function main() {
  const [image1PathArg, image2PathArg] = process.argv.slice(2);
  const image1Path = image1PathArg || path.join(process.cwd(), 'asset', '45.jpg');
  const image2Path = image2PathArg || path.join(process.cwd(), 'asset', 'images.jpg');

  // Upload first image
  const uploadedFile = await ai.files.upload({
    file: image1Path,
    config: { mimeType: guessMime(image1Path) },
  });

  // Inline second image as base64
  const base64Image2File = fs.readFileSync(image2Path, { encoding: 'base64' });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: createUserContent([
      'What is different between these two images? Then infer any concrete-related insights (e.g., equipment, site conditions).',
      createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
      {
        inlineData: {
          mimeType: guessMime(image2Path),
          data: base64Image2File,
        },
      },
    ]),
  });

  const text = typeof response.text === 'function' ? await response.text() : response.text;
  console.log(text);
}

await main();


