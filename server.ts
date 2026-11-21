import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

type Category = 'Comics' | 'Cards' | 'Toys';

interface GeminiPriceRow {
  site: string;
  value: number;
  url?: string;
}

interface GeminiPriceResult {
  title?: string;
  details?: string;
  prices?: GeminiPriceRow[];
  low?: number;
  high?: number;
  average?: number;
  confidence?: string;
  note?: string;
}

const GEMINI_MODEL = 'gemini-4-hydrogen';
const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set(['Comics', 'Cards', 'Toys']);
const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractResponseText(resp: unknown): string {
  if (!resp || typeof resp !== 'object') return '';
  const direct = (resp as { text?: unknown }).text;
  if (typeof direct === 'string' && direct.trim()) return direct;
  const candidates =
    (
      resp as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
      }
    ).candidates ?? [];
  return candidates
    .flatMap((c) => c.content?.parts ?? [])
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
}

function parseGeminiPriceJson(raw: string): GeminiPriceResult | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence?.[1]) cleaned = fence[1];
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  try {
    const parsed = JSON.parse(cleaned) as GeminiPriceResult;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeHttpUrl(rawUrl: unknown): string | undefined {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return undefined;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function parseImagePayload(dataUrl: string): { mimeType: string; base64: string } | null {
  const trimmed = dataUrl.trim();
  const dataUriMatch = trimmed.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (dataUriMatch) {
    const mimeType = dataUriMatch[1].toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return null;
    return { mimeType, base64: dataUriMatch[2] };
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return { mimeType: 'image/jpeg', base64: trimmed };
  }
  return null;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  app.post('/api/price-check', async (req: Request, res: Response) => {
    const body = req.body as { imageDataUrl?: unknown; category?: unknown } | undefined;

    const categoryRaw = typeof body?.category === 'string' ? body.category : '';
    if (!ALLOWED_CATEGORIES.has(categoryRaw)) {
      res.status(400).json({ error: 'Invalid collectible category.' });
      return;
    }
    const category = categoryRaw as Category;

    if (
      typeof body?.imageDataUrl !== 'string' ||
      body.imageDataUrl.length === 0 ||
      body.imageDataUrl.length > 8_000_000
    ) {
      res.status(400).json({ error: 'Please provide a valid collectible photo.' });
      return;
    }

    const parsedImage = parseImagePayload(body.imageDataUrl);
    if (!parsedImage) {
      res.status(400).json({
        error: 'Unsupported image format. Please upload a JPG, PNG, or WEBP photo.',
      });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Automatic price check needs a Gemini key — add GEMINI_API_KEY in Settings > Secrets. You can still type the sold prices in below, or use Lens / CollX.',
      });
      return;
    }

    const sitesForCategory =
      category === 'Cards'
        ? 'eBay Sold, TCGplayer, PriceCharting, COMC, CollX'
        : category === 'Comics'
          ? 'eBay Sold, MyComicShop, Heritage'
          : 'eBay Sold, Mercari';

    const prompt =
      `You are pricing a collectible from a photo. Identify the exact item: full title, series/set, year, and issue number or card number if visible.\n` +
      `Category: ${category}.\n` +
      `Price sources to use, in this order: ${sitesForCategory}.\n` +
      `Search the web for RECENT SOLD / completed listings for this exact item — not asking prices, not unsold listings. For each source where you actually found a sold price, give the sold price in US dollars and a link to the sold listing or search results page.\n` +
      `Return STRICT JSON ONLY, no markdown fences, no extra text:\n` +
      `{"title": "exact item name, e.g. Amazing Spider-Man #300, 1988", "details": "series/set, year, issue or card number", "prices": [{"site": "eBay Sold", "value": 12.50, "url": "https://..."}], "low": 0, "high": 0, "average": 0, "confidence": "high | medium | low", "note": "one short line, e.g. which prices are sold vs asking, or what you could not find"}\n` +
      `Rules: only include a site if you found a real sold price for it. If you could not find sold prices for a site, leave it out and say so in "note". NEVER invent a price — a missing price is better than a fake one. Prices must be numbers in US dollars.`;

    try {
      const resp = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: parsedImage.mimeType,
                data: parsedImage.base64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const parsed = parseGeminiPriceJson(extractResponseText(resp));
      if (!parsed) {
        res.status(422).json({
          error: 'Gemini did not return any sold prices for this item.',
        });
        return;
      }

      const sanitizedPrices: GeminiPriceRow[] = (parsed.prices ?? [])
        .filter((row) => row && typeof row.site === 'string' && Number.isFinite(Number(row.value)) && Number(row.value) > 0)
        .map((row) => ({
          site: row.site.trim(),
          value: Math.round(Number(row.value) * 100) / 100,
          url: sanitizeHttpUrl(row.url),
        }));

      res.json({
        title: typeof parsed.title === 'string' ? parsed.title.trim() : undefined,
        details: typeof parsed.details === 'string' ? parsed.details.trim() : undefined,
        prices: sanitizedPrices,
        confidence: typeof parsed.confidence === 'string' ? parsed.confidence.trim() : undefined,
        note: typeof parsed.note === 'string' ? parsed.note.trim() : undefined,
      });
    } catch (err: unknown) {
      const status =
        typeof (err as { status?: unknown })?.status === 'number'
          ? (err as { status: number }).status
          : 500;
      const rawMessage =
        err instanceof Error && err.message ? err.message : 'Failed to analyze collectible photo.';
      const safeStatus = status >= 400 && status < 600 ? status : 500;

      if (safeStatus === 403 || safeStatus === 401 || rawMessage.includes('API_KEY_INVALID')) {
        res.status(safeStatus).json({
          error: 'Invalid or unauthorized Gemini API key. Check GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }
      if (safeStatus === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
        res.status(429).json({
          error: 'Gemini API rate limit reached. Please wait a moment and try again.',
        });
        return;
      }

      res.status(safeStatus).json({ error: rawMessage });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexPath = path.join(distDir, 'index.html');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
