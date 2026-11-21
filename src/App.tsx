import { GoogleGenAI } from '@google/genai';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Gavel,
  ImagePlus,
  Layers,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

type Category = 'Comics' | 'Cards' | 'Toys';
type TabFilter = 'All' | Category;
type StatusFilter = 'All' | 'Vault' | 'Auction' | 'Sold';

interface BidEntry {
  id: string;
  bidder: string;
  amount: number;
  timestamp: string;
}

interface AuctionConfig {
  active: boolean;
  startingBid: number;
  reservePrice?: number;
  endsAt: string;
  bids: BidEntry[];
}

interface CollectibleItem {
  id: string;
  category: Category;
  title: string;
  series: string;
  number: string;
  year: string;
  publisher: string;
  condition: string;
  grade: string;
  paid: number;
  estValue: number;
  photo: string;
  notes?: string;
  status: 'Active' | 'Sold';
  soldPrice?: number;
  soldAt?: string;
  auction?: AuctionConfig;
  createdAt: string;
}

interface MarketplaceLink {
  name: string;
  highlight?: boolean;
  note?: string;
  buildUrl: (query: string) => string;
}

const STORAGE_KEY = 'cardcore_collectors_vault_v1';
const BUILD_VERSION = 'v2026.11.20.6';

const MARKETPLACES_BY_CATEGORY: Record<Category, MarketplaceLink[]> = {
  Comics: [
    {
      name: 'eBay Sold',
      highlight: true,
      buildUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1`,
    },
    {
      name: 'eBay',
      buildUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
    },
    {
      name: 'MyComicShop',
      buildUrl: (q) => `https://www.mycomicshop.com/search?q=${encodeURIComponent(q)}`,
    },
    {
      name: 'Heritage',
      buildUrl: (q) => `https://www.ha.com/c/search-results.zx?Ntt=${encodeURIComponent(q)}`,
    },
    {
      name: 'Whatnot',
      buildUrl: (q) => `https://www.whatnot.com/search?query=${encodeURIComponent(q)}`,
    },
    {
      name: 'Mercari',
      buildUrl: (q) => `https://www.mercari.com/search/?keyword=${encodeURIComponent(q)}`,
    },
  ],
  Cards: [
    {
      name: 'eBay Sold',
      highlight: true,
      buildUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1`,
    },
    {
      name: 'TCGplayer',
      buildUrl: (q) => `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(q)}&view=grid`,
    },
    {
      name: 'PriceCharting',
      buildUrl: (q) => `https://www.pricecharting.com/search-products?q=${encodeURIComponent(q)}&type=prices`,
    },
    {
      name: 'eBay',
      buildUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
    },
    {
      name: 'COMC',
      buildUrl: (q) => `https://www.comc.com/Cards/Search?q=${encodeURIComponent(q)}`,
    },
    {
      name: 'Whatnot',
      buildUrl: (q) => `https://www.whatnot.com/search?query=${encodeURIComponent(q)}`,
    },
    {
      name: 'Mercari',
      buildUrl: (q) => `https://www.mercari.com/search/?keyword=${encodeURIComponent(q)}`,
    },
    {
      name: 'CollX',
      note: 'Scan in app',
      buildUrl: () => 'https://collx.app/',
    },
  ],
  Toys: [
    {
      name: 'eBay Sold',
      highlight: true,
      buildUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1`,
    },
    {
      name: 'eBay',
      buildUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
    },
    {
      name: 'Mercari',
      buildUrl: (q) => `https://www.mercari.com/search/?keyword=${encodeURIComponent(q)}`,
    },
    {
      name: 'Whatnot',
      buildUrl: (q) => `https://www.whatnot.com/search?query=${encodeURIComponent(q)}`,
    },
    {
      name: 'Amazon',
      buildUrl: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
    },
    {
      name: 'ToyWiz',
      buildUrl: (q) => `https://toywiz.com/search.php?search_query=${encodeURIComponent(q)}`,
    },
  ],
};

const TOP_HUB_MARKETPLACES: Array<{
  name: string;
  note?: string;
  homeUrl: string;
  searchUrl: (q: string) => string;
}> = [
  {
    name: 'eBay',
    homeUrl: 'https://www.ebay.com/b/Collectibles/1/bn_1858810',
    searchUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
  },
  {
    name: 'Whatnot',
    homeUrl: 'https://www.whatnot.com/',
    searchUrl: (q) => `https://www.whatnot.com/search?query=${encodeURIComponent(q)}`,
  },
  {
    name: 'Mercari',
    homeUrl: 'https://www.mercari.com/',
    searchUrl: (q) => `https://www.mercari.com/search/?keyword=${encodeURIComponent(q)}`,
  },
  {
    name: 'TCGplayer',
    homeUrl: 'https://www.tcgplayer.com/',
    searchUrl: (q) => `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(q)}&view=grid`,
  },
  {
    name: 'MyComicShop',
    homeUrl: 'https://www.mycomicshop.com/',
    searchUrl: (q) => `https://www.mycomicshop.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'Heritage',
    homeUrl: 'https://comics.ha.com/',
    searchUrl: (q) => `https://www.ha.com/c/search-results.zx?Ntt=${encodeURIComponent(q)}`,
  },
  {
    name: 'PriceCharting',
    homeUrl: 'https://www.pricecharting.com/',
    searchUrl: (q) => `https://www.pricecharting.com/search-products?q=${encodeURIComponent(q)}&type=prices`,
  },
  {
    name: 'COMC',
    homeUrl: 'https://www.comc.com/',
    searchUrl: (q) => `https://www.comc.com/Cards/Search?q=${encodeURIComponent(q)}`,
  },
  {
    name: 'CollX',
    note: 'Scan cards — instant value',
    homeUrl: 'https://collx.app/',
    searchUrl: () => 'https://collx.app/',
  },
];

function createSampleItems(): CollectibleItem[] {
  const now = Date.now();
  return [
    {
      id: 'sample-comic-1',
      category: 'Comics',
      title: 'The Sentinel',
      series: 'Bronze Age Key Issue',
      number: '#1',
      year: '1982',
      publisher: 'DC Comics',
      condition: 'Near Mint/Mint',
      grade: 'CGC 9.6',
      paid: 185,
      estValue: 440,
      photo: '/src/assets/images/sample_comic_slab_1795231033404.jpg',
      notes: 'First appearance of Dr. Malice. White pages archival slab.',
      status: 'Active',
      createdAt: new Date(now - 86400000 * 14).toISOString(),
      auction: {
        active: true,
        startingBid: 350,
        reservePrice: 420,
        endsAt: new Date(now + 1000 * 60 * 60 * 41 + 1000 * 60 * 24).toISOString(),
        bids: [
          {
            id: 'bid-101',
            bidder: 'bronze_vault',
            amount: 350,
            timestamp: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
          },
          {
            id: 'bid-102',
            bidder: 'keyissue_nyc',
            amount: 390,
            timestamp: new Date(now - 1000 * 60 * 48).toISOString(),
          },
        ],
      },
    },
    {
      id: 'sample-card-2',
      category: 'Cards',
      title: 'Auragor, The Golden Sky-Serpent',
      series: 'Mythic Arcana Foil',
      number: '#001',
      year: '2024',
      publisher: 'Mythic Arcana',
      condition: 'Gem Mint',
      grade: 'PSA 10',
      paid: 120,
      estValue: 310,
      photo: '/src/assets/images/sample_card_slab_1795231033635.jpg',
      notes: 'Holoprism secret rare serial #001, clean centering.',
      status: 'Active',
      createdAt: new Date(now - 86400000 * 9).toISOString(),
      auction: {
        active: true,
        startingBid: 240,
        reservePrice: 290,
        endsAt: new Date(now + 1000 * 60 * 60 * 17 + 1000 * 60 * 12).toISOString(),
        bids: [
          {
            id: 'bid-201',
            bidder: 'holo_collects',
            amount: 240,
            timestamp: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
          },
          {
            id: 'bid-202',
            bidder: 'dragon_slab',
            amount: 265,
            timestamp: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
          },
          {
            id: 'bid-203',
            bidder: 'apex_pulls',
            amount: 295,
            timestamp: new Date(now - 1000 * 60 * 22).toISOString(),
          },
        ],
      },
    },
    {
      id: 'sample-toy-3',
      category: 'Toys',
      title: 'Stargaard Die-Cast Mecha Robot',
      series: '1980s Collector Edition',
      number: '#01',
      year: '1984',
      publisher: 'Takara Vault',
      condition: 'Mint in Acrylic Case',
      grade: 'AFA 8.5',
      paid: 260,
      estValue: 520,
      photo: '/src/assets/images/sample_toy_figure_1795231032922.jpg',
      notes: 'Complete die-cast chassis with chrome rifle and display pedestal.',
      status: 'Active',
      createdAt: new Date(now - 86400000 * 4).toISOString(),
    },
  ];
}

function buildItemSearchQuery(item: CollectibleItem): string {
  const parts = [item.title, item.number, item.series, item.year, item.publisher]
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(part);
    }
  }
  return unique.join(' ');
}

function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  return `$${abs.toLocaleString('en-US', {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedCurrency(val: number): string {
  const sign = val > 0 ? '+' : val < 0 ? '-' : '';
  return `${sign}${formatCurrency(val)}`;
}

function formatCountdown(endsAtIso: string, nowMs: number): { label: string; expired: boolean } {
  const diff = new Date(endsAtIso).getTime() - nowMs;
  if (Number.isNaN(diff) || diff <= 0) {
    return { label: 'Ended', expired: true };
  }
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) {
    return { label: `${days}d ${pad(hours)}h ${pad(mins)}m`, expired: false };
  }
  return { label: `${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`, expired: false };
}

function getHighBid(auction?: AuctionConfig): number {
  if (!auction || auction.bids.length === 0) return 0;
  return auction.bids.reduce((max, b) => (b.amount > max ? b.amount : max), 0);
}

function escapeCsvCell(value: string | number | undefined): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 900;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function loadStoredItems(): CollectibleItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSampleItems();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    if (Array.isArray(parsed)) {
      return [];
    }
  } catch {
    // Fallback to sample items if localStorage is unreadable
  }
  return createSampleItems();
}

// --- Automatic identify & price (Gemini vision + Google Search) ---
// AI Studio injects GEMINI_API_KEY from the user's Secrets at build time via
// the `define` in vite.config.ts. The key is read here (and from
// VITE_GEMINI_API_KEY as a fallback) so the app never hardcodes a secret.
// It is read inside try/catch because `process` does not exist in the
// browser bundle — the vite define replaces the process.env read with the
// injected key string at build time, and the catch covers a build where the
// define did not apply.
function readGeminiKey(): string {
  try {
    const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
    if (viteKey) return String(viteKey);
  } catch {
    // import.meta.env is not available outside a Vite build — ignore.
  }
  try {
    // Replaced at build time by vite.config.ts define with the injected key.
    const injected = (process as any).env.GEMINI_API_KEY as string | undefined;
    if (injected) return String(injected);
  } catch {
    // `process` is not defined in the browser without the define — ignore.
  }
  return '';
}

const GEMINI_KEY = readGeminiKey();
const GEMINI_MODEL = 'gemini-2.5-flash';

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

function normalizeSiteName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractResponseText(resp: unknown): string {
  if (!resp || typeof resp !== 'object') return '';
  const direct = (resp as { text?: unknown }).text;
  if (typeof direct === 'string' && direct.trim()) return direct;
  const candidates = (resp as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> })
    .candidates ?? [];
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

export default function App() {
  const [items, setItems] = useState<CollectibleItem[]>(() => loadStoredItems());
  const [activeTab, setActiveTab] = useState<TabFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [hubQuery, setHubQuery] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState<{ message: string; tone: 'gold' | 'error' } | null>(null);

  // Add / Edit Item sheet state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState<Category>('Comics');
  const [formTitle, setFormTitle] = useState('');
  const [formSeries, setFormSeries] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formPublisher, setFormPublisher] = useState('');
  const [formCondition, setFormCondition] = useState('Near Mint');
  const [formGrade, setFormGrade] = useState('');
  const [formPaid, setFormPaid] = useState('');
  const [formEstValue, setFormEstValue] = useState('');
  const [formPhoto, setFormPhoto] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formEnableAuction, setFormEnableAuction] = useState(false);
  const [formStartingBid, setFormStartingBid] = useState('');
  const [formReservePrice, setFormReservePrice] = useState('');
  const [formAuctionHours, setFormAuctionHours] = useState('72');
  const [formError, setFormError] = useState('');

  // Snap & Price state (photo -> Lens identify -> sold-price average -> save)
  const [snapOpen, setSnapOpen] = useState(false);
  const [snapCategory, setSnapCategory] = useState<Category>('Comics');
  const [snapTitle, setSnapTitle] = useState('');
  const [snapPhoto, setSnapPhoto] = useState('');
  const [snapPrices, setSnapPrices] = useState<Record<string, string>>({});
  const [snapError, setSnapError] = useState('');
  const [snapChecking, setSnapChecking] = useState(false);
  const [snapAutoNote, setSnapAutoNote] = useState('');
  const snapCheckRunRef = useRef(0);
  const snapInputRef = useRef<HTMLInputElement | null>(null);

  // Live low / high / average from the sold prices typed in Snap & Price
  const snapSummary = useMemo(() => {
    const vals = Object.values(snapPrices)
      .map((v) => Number(v) || 0)
      .filter((v) => v > 0);
    if (vals.length === 0) return { count: 0, low: 0, high: 0, avg: 0 };
    const low = Math.min(...vals);
    const high = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { count: vals.length, low, high, avg };
  }, [snapPrices]);

  // Auction / Bid Drawer state
  const [auctionItemId, setAuctionItemId] = useState<string | null>(null);
  const [bidderHandle, setBidderHandle] = useState('');
  const [bidAmountInput, setBidAmountInput] = useState('');
  const [bidError, setBidError] = useState('');

  // Mark Sold prompt state
  const [soldPromptId, setSoldPromptId] = useState<string | null>(null);
  const [soldPriceInput, setSoldPriceInput] = useState('');

  // Confirmations without window.confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmResetSamples, setConfirmResetSamples] = useState(false);

  // Broken image fallback tracking
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      setToast({
        message: 'Storage limit reached. Try exporting a JSON backup or using smaller photos.',
        tone: 'error',
      });
    }
  }, [items]);

  // Live 1-second tick for auction countdowns
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showToast = (message: string, tone: 'gold' | 'error' = 'gold') => {
    setToast({ message, tone });
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (activeTab !== 'All' && item.category !== activeTab) return false;
      if (statusFilter === 'Vault' && (item.status === 'Sold' || item.auction?.active)) return false;
      if (statusFilter === 'Auction' && (item.status === 'Sold' || !item.auction?.active)) return false;
      if (statusFilter === 'Sold' && item.status !== 'Sold') return false;
      if (!q) return true;
      const haystack = [
        item.title,
        item.series,
        item.number,
        item.year,
        item.publisher,
        item.condition,
        item.grade,
        item.category,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, activeTab, statusFilter, searchQuery]);

  // Totals across active tab (or overall if All)
  const totals = useMemo(() => {
    const scope = activeTab === 'All' ? items : items.filter((i) => i.category === activeTab);
    let totalPaid = 0;
    let totalEst = 0;
    let activeCount = 0;
    let soldCount = 0;
    let auctionCount = 0;
    let soldRealized = 0;

    for (const item of scope) {
      totalPaid += Number(item.paid) || 0;
      if (item.status === 'Sold') {
        soldCount += 1;
        const saleVal = Number(item.soldPrice ?? item.estValue) || 0;
        totalEst += saleVal;
        soldRealized += saleVal;
      } else {
        activeCount += 1;
        totalEst += Number(item.estValue) || 0;
        if (item.auction?.active) {
          auctionCount += 1;
        }
      }
    }

    const net = totalEst - totalPaid;
    const pct = totalPaid > 0 ? (net / totalPaid) * 100 : 0;

    return {
      count: scope.length,
      activeCount,
      soldCount,
      auctionCount,
      soldRealized,
      totalPaid,
      totalEst,
      net,
      pct,
    };
  }, [items, activeTab]);

  const categoryCounts = useMemo(() => {
    return {
      All: items.length,
      Comics: items.filter((i) => i.category === 'Comics').length,
      Cards: items.filter((i) => i.category === 'Cards').length,
      Toys: items.filter((i) => i.category === 'Toys').length,
    };
  }, [items]);

  const auctionModalItem = useMemo(
    () => items.find((i) => i.id === auctionItemId) ?? null,
    [items, auctionItemId],
  );

  // Open Add / Edit Modal
  const openAddModal = () => {
    setEditingId(null);
    setFormCategory(activeTab === 'All' ? 'Comics' : activeTab);
    setFormTitle('');
    setFormSeries('');
    setFormNumber('');
    setFormYear('');
    setFormPublisher('');
    setFormCondition('Near Mint');
    setFormGrade('');
    setFormPaid('');
    setFormEstValue('');
    setFormPhoto('');
    setFormNotes('');
    setFormEnableAuction(false);
    setFormStartingBid('');
    setFormReservePrice('');
    setFormAuctionHours('72');
    setFormError('');
    setEditorOpen(true);
  };

  const openEditModal = (item: CollectibleItem) => {
    setEditingId(item.id);
    setFormCategory(item.category);
    setFormTitle(item.title);
    setFormSeries(item.series);
    setFormNumber(item.number);
    setFormYear(item.year);
    setFormPublisher(item.publisher);
    setFormCondition(item.condition);
    setFormGrade(item.grade);
    setFormPaid(String(item.paid));
    setFormEstValue(String(item.estValue));
    setFormPhoto(item.photo);
    setFormNotes(item.notes ?? '');
    setFormEnableAuction(Boolean(item.auction?.active));
    setFormStartingBid(item.auction ? String(item.auction.startingBid) : '');
    setFormReservePrice(
      item.auction?.reservePrice !== undefined ? String(item.auction.reservePrice) : '',
    );
    if (item.auction?.endsAt) {
      const remHours = Math.max(
        1,
        Math.round((new Date(item.auction.endsAt).getTime() - Date.now()) / 3600000),
      );
      setFormAuctionHours(String(remHours));
    } else {
      setFormAuctionHours('72');
    }
    setFormError('');
    setEditorOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      setFormPhoto(dataUrl);
      setFormError('');
    } catch {
      setFormError('Could not process that image file. Try a JPG, PNG, or WEBP photo.');
    }
  };

  // Identifies the snapped item with Gemini vision, then uses Gemini with
  // Google Search grounding to find RECENT SOLD prices on the sites for this
  // category and fills the title + per-site price rows in automatically.
  // The user never searches — they only check what it filled in. Missing
  // key or failed call never crashes: it shows why and manual entry keeps
  // working exactly as before.
  const runAutoPriceCheck = async (dataUrl: string, category: Category) => {
    const runId = ++snapCheckRunRef.current;
    if (!GEMINI_KEY) {
      setSnapError(
        'Automatic price check needs a Gemini key — add GEMINI_API_KEY in AI Studio → Secrets, then rebuild. You can still type the sold prices in below, or use Lens / CollX.',
      );
      return;
    }
    setSnapChecking(true);
    setSnapError('');
    setSnapAutoNote('');
    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
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
      const resp = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: prompt },
        ],
        config: { tools: [{ googleSearch: {} }] },
      });
      if (runId !== snapCheckRunRef.current) return;
      const parsed = parseGeminiPriceJson(extractResponseText(resp));
      const knownSites = MARKETPLACES_BY_CATEGORY[category].map((s) => s.name);
      const nextPrices: Record<string, string> = {};
      let matched = 0;
      for (const row of parsed?.prices ?? []) {
        const value = Number(row?.value);
        if (!row?.site || !Number.isFinite(value) || value <= 0) continue;
        const match = knownSites.find((name) => {
          const a = normalizeSiteName(name);
          const b = normalizeSiteName(String(row.site));
          return a === b || b.includes(a) || a.includes(b);
        });
        if (!match) continue;
        nextPrices[match] = String(Math.round(value * 100) / 100);
        matched += 1;
      }
      if (matched === 0) {
        throw new Error('Gemini did not return any sold prices for this item.');
      }
      setSnapPrices(nextPrices);
      if (parsed?.title && !snapTitle.trim()) {
        setSnapTitle(parsed.title.trim());
      }
      const noteBits = [
        `✨ Auto-priced from ${matched} ${matched === 1 ? 'site' : 'sites'}`,
        parsed?.confidence ? `· confidence: ${parsed.confidence}` : '',
        parsed?.details ? `· ${parsed.details}` : '',
        parsed?.note ? `· ${parsed.note}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      setSnapAutoNote(noteBits);
    } catch (err) {
      if (runId !== snapCheckRunRef.current) return;
      const reason =
        err instanceof Error && err.message ? err.message : 'the price check failed';
      setSnapError(
        `Couldn't check prices automatically — ${reason}. You can still type the sold prices in below, or add the Gemini key in AI Studio → Secrets → GEMINI_API_KEY.`,
      );
    } finally {
      if (runId === snapCheckRunRef.current) setSnapChecking(false);
    }
  };

  const handleSnapPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      setSnapPhoto(dataUrl);
      // Fresh photo = fresh item: clear the old name/prices so the auto
      // check fills them in for this item, not the last one.
      setSnapTitle('');
      setSnapPrices({});
      setSnapAutoNote('');
      setSnapError('');
      // Automatically identify it and check sold prices — no searching.
      await runAutoPriceCheck(dataUrl, snapCategory);
    } catch {
      setSnapError('Could not process that image file. Try a JPG, PNG, or WEBP photo.');
    }
  };

  const downloadSnapPhoto = () => {
    if (!snapPhoto) {
      showToast('Take a photo first.', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = snapPhoto;
    link.download = 'snap-for-lens.jpg';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const shareToLens = async () => {
    if (!snapPhoto) {
      showToast('Take a photo first.', 'error');
      return;
    }
    try {
      const res = await fetch(snapPhoto);
      const blob = await res.blob();
      const file = new File([blob], 'snap-for-lens.jpg', { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Identify this item' });
        return;
      }
      throw new Error('share not supported');
    } catch {
      // Lens cannot read a photo straight from a web page, so save it and
      // open Lens upload — pick the saved photo there and Lens names it.
      downloadSnapPhoto();
      showToast('Sharing is not available here, so the photo was saved. Open Lens and pick it to upload.');
      window.open('https://lens.google.com/upload', '_blank');
    }
  };

  const saveSnapItem = (how: 'keep' | 'sale') => {
    const title = snapTitle.trim();
    if (!title) {
      setSnapError('Type what it is first — use Google Lens if you don’t know the name.');
      return;
    }
    const keep = how === 'keep';
    const estNum = Math.round(snapSummary.avg * 100) / 100;
    const nextItem: CollectibleItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: snapCategory,
      title,
      series: '',
      number: '',
      year: '',
      publisher: '',
      condition: 'Near Mint',
      grade: '',
      paid: 0,
      estValue: estNum,
      photo: snapPhoto,
      notes: 'Priced from photo — Snap & Price',
      status: 'Active',
      auction: keep
        ? undefined
        : {
            active: true,
            startingBid: 0.99,
            reservePrice: undefined,
            endsAt: new Date(Date.now() + 72 * 3600000).toISOString(),
            bids: [],
          },
      createdAt: new Date().toISOString(),
    };
    // Same add path as a normally added item: prepended to the list, so the
    // existing localStorage effect persists it and totals pick it up.
    setItems((prev) => [nextItem, ...prev]);
    setSnapOpen(false);
    setSnapPrices({});
    setSnapAutoNote('');
    setSnapError('');
    showToast(
      keep
        ? `Put "${title}" in your collection · Est. value ${formatCurrency(estNum)}`
        : `Listed "${title}" for sale · Est. value ${formatCurrency(estNum)}`,
    );
  };

  const priceItem = (item: CollectibleItem) => {
    setSnapCategory(item.category);
    setSnapTitle(buildItemSearchQuery(item));
    setSnapPhoto(item.photo);
    setSnapPrices({});
    setSnapError('');
    setSnapOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Please enter an item title.');
      return;
    }

    const paidNum = Math.max(0, Number(formPaid) || 0);
    const estNum = Math.max(0, Number(formEstValue) || 0);
    const startBidNum = Math.max(1, Number(formStartingBid) || Math.round(estNum * 0.8) || 10);
    const reserveNum = formReservePrice.trim() ? Math.max(0, Number(formReservePrice) || 0) : undefined;
    const hoursNum = Math.max(1, Number(formAuctionHours) || 72);

    const existing = editingId ? items.find((i) => i.id === editingId) : undefined;

    let auctionObj: AuctionConfig | undefined = existing?.auction;
    if (formEnableAuction) {
      auctionObj = {
        active: true,
        startingBid: startBidNum,
        reservePrice: reserveNum,
        endsAt:
          existing?.auction?.active && existing.auction.endsAt
            ? existing.auction.endsAt
            : new Date(Date.now() + hoursNum * 3600000).toISOString(),
        bids: existing?.auction?.bids ?? [],
      };
    } else if (existing?.auction) {
      auctionObj = { ...existing.auction, active: false };
    }

    const nextItem: CollectibleItem = {
      id: editingId ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: formCategory,
      title: formTitle.trim(),
      series: formSeries.trim(),
      number: formNumber.trim(),
      year: formYear.trim(),
      publisher: formPublisher.trim(),
      condition: formCondition.trim() || 'Raw',
      grade: formGrade.trim(),
      paid: paidNum,
      estValue: estNum,
      photo: formPhoto.trim(),
      notes: formNotes.trim() || undefined,
      status: existing?.status ?? 'Active',
      soldPrice: existing?.soldPrice,
      soldAt: existing?.soldAt,
      auction: auctionObj,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    if (editingId) {
      setItems((prev) => prev.map((it) => (it.id === editingId ? nextItem : it)));
      showToast(`Updated "${nextItem.title}"`);
    } else {
      setItems((prev) => [nextItem, ...prev]);
      showToast(`Added "${nextItem.title}" to ${nextItem.category}`);
    }

    setEditorOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    const target = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setConfirmDeleteId(null);
    if (target) {
      showToast(`Removed "${target.title}"`);
    }
  };

  // Start Auction quickly on an item that doesn't have one yet
  const openAuctionDrawer = (item: CollectibleItem) => {
    setAuctionItemId(item.id);
    setBidderHandle('');
    setBidError('');
    const currentHigh = getHighBid(item.auction);
    const minNext = item.auction
      ? currentHigh > 0
        ? currentHigh + 5
        : item.auction.startingBid
      : Math.max(10, Math.round(item.estValue * 0.75) || 25);
    setBidAmountInput(String(minNext));
  };

  const handleQuickStartAuction = (
    itemId: string,
    startingBid: number,
    reservePrice: number | undefined,
    hours: number,
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          status: 'Active',
          auction: {
            active: true,
            startingBid: Math.max(1, startingBid),
            reservePrice: reservePrice && reservePrice > 0 ? reservePrice : undefined,
            endsAt: new Date(Date.now() + Math.max(1, hours) * 3600000).toISOString(),
            bids: item.auction?.bids ?? [],
          },
        };
      }),
    );
    showToast('Auction timer started');
  };

  const handleAddBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auctionModalItem || !auctionModalItem.auction) return;
    const amount = Number(bidAmountInput);
    const high = getHighBid(auctionModalItem.auction);
    const minRequired = high > 0 ? high + 1 : auctionModalItem.auction.startingBid;

    if (Number.isNaN(amount) || amount < minRequired) {
      setBidError(`Bid must be at least ${formatCurrency(minRequired)}.`);
      return;
    }

    const newBid: BidEntry = {
      id: `bid-${Date.now()}`,
      bidder: bidderHandle.trim() || 'collector_bidder',
      amount,
      timestamp: new Date().toISOString(),
    };

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== auctionModalItem.id || !it.auction) return it;
        return {
          ...it,
          auction: {
            ...it.auction,
            bids: [newBid, ...it.auction.bids],
          },
        };
      }),
    );
    setBidderHandle('');
    setBidAmountInput(String(amount + 5));
    setBidError('');
    showToast(`Logged ${formatCurrency(amount)} bid`);
  };

  const handleStopAuction = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId || !it.auction) return it;
        return {
          ...it,
          auction: {
            ...it.auction,
            active: false,
          },
        };
      }),
    );
    showToast('Auction paused');
  };

  const openMarkSoldPrompt = (item: CollectibleItem) => {
    const highBid = getHighBid(item.auction);
    const suggested = highBid > 0 ? highBid : item.estValue || item.paid;
    setSoldPromptId(item.id);
    setSoldPriceInput(String(suggested));
  };

  const handleConfirmMarkSold = (itemId: string) => {
    const finalPrice = Math.max(0, Number(soldPriceInput) || 0);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          status: 'Sold',
          soldPrice: finalPrice,
          soldAt: new Date().toISOString(),
          auction: it.auction ? { ...it.auction, active: false } : undefined,
        };
      }),
    );
    setSoldPromptId(null);
    if (auctionItemId === itemId) setAuctionItemId(null);
    showToast(`Marked sold at ${formatCurrency(finalPrice)}`);
  };

  const handleReopenItem = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          status: 'Active',
          soldPrice: undefined,
          soldAt: undefined,
        };
      }),
    );
    showToast('Returned item to vault');
  };

  // JSON Backup / Restore & CSV Export
  const handleExportJson = () => {
    const payload = {
      app: 'Cardcore Collectors',
      build: BUILD_VERSION,
      exportedAt: new Date().toISOString(),
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cardcore-collectors-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${items.length} items to JSON`);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedList: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
          ? parsed.items
          : [];

      if (importedList.length === 0) {
        showToast('Backup file did not contain any valid items.', 'error');
        return;
      }

      const normalized: CollectibleItem[] = importedList
        .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === 'object'))
        .map((raw, idx) => {
          const cat: Category =
            raw.category === 'Comics' || raw.category === 'Cards' || raw.category === 'Toys'
              ? raw.category
              : 'Cards';
          return {
            id: typeof raw.id === 'string' && raw.id ? raw.id : `restored-${Date.now()}-${idx}`,
            category: cat,
            title: String(raw.title ?? 'Untitled Collectible'),
            series: String(raw.series ?? ''),
            number: String(raw.number ?? ''),
            year: String(raw.year ?? ''),
            publisher: String(raw.publisher ?? ''),
            condition: String(raw.condition ?? 'Near Mint'),
            grade: String(raw.grade ?? ''),
            paid: Number(raw.paid) || 0,
            estValue: Number(raw.estValue) || 0,
            photo: String(raw.photo ?? ''),
            notes: raw.notes ? String(raw.notes) : undefined,
            status: raw.status === 'Sold' ? 'Sold' : 'Active',
            soldPrice: raw.soldPrice !== undefined ? Number(raw.soldPrice) : undefined,
            soldAt: raw.soldAt ? String(raw.soldAt) : undefined,
            auction:
              raw.auction && typeof raw.auction === 'object'
                ? (raw.auction as AuctionConfig)
                : undefined,
            createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
          };
        });

      setItems(normalized);
      showToast(`Restored ${normalized.length} items from JSON backup`);
    } catch {
      showToast('Invalid JSON backup file.', 'error');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Category',
      'Title',
      'Series/Set/Line',
      'Issue/Card #',
      'Year',
      'Publisher/Brand',
      'Condition',
      'Grade',
      'Paid ($)',
      'Est. Value ($)',
      'Status',
      'Sold Price ($)',
      'Auction Active',
      'Starting Bid ($)',
      'Reserve Price ($)',
      'High Bid ($)',
      'Bid Count',
      'Auction Ends At',
    ];
    const rows = items.map((item) => {
      const highBid = getHighBid(item.auction);
      return [
        item.id,
        item.category,
        item.title,
        item.series,
        item.number,
        item.year,
        item.publisher,
        item.condition,
        item.grade,
        item.paid,
        item.estValue,
        item.status,
        item.soldPrice ?? '',
        item.auction?.active ? 'Yes' : 'No',
        item.auction?.startingBid ?? '',
        item.auction?.reservePrice ?? '',
        highBid > 0 ? highBid : '',
        item.auction?.bids.length ?? 0,
        item.auction?.endsAt ?? '',
      ]
        .map(escapeCsvCell)
        .join(',');
    });

    const csvContent = [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cardcore-collectors-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${items.length} rows to CSV`);
  };

  const handleResetSamples = () => {
    setItems(createSampleItems());
    setBrokenImages({});
    setConfirmResetSamples(false);
    showToast('Restored 3 sample collectibles');
  };

  const gainPositive = totals.net >= 0;

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F1EA] flex flex-col">
      {/* Compact Sticky Top Bar (3-zone contract, <= 56px height) */}
      <header className="sticky top-0 z-30 h-14 bg-[#09090B]/92 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-semibold tracking-tight text-[#F4F1EA] whitespace-nowrap shrink-0 flex items-center gap-2.5"
          >
            <span className="w-7 h-7 rounded-lg bg-[#D4AF37] text-[#09090B] font-mono text-xs font-bold flex items-center justify-center">
              CC
            </span>
            <span>Cardcore Collectors</span>
          </a>

          <nav
            aria-label="Category tabs"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {(['All', 'Comics', 'Cards', 'Toys'] as TabFilter[]).map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`py-1.5 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    active
                      ? 'text-[#E5C158] border-[#D4AF37]'
                      : 'text-[#A19D94] border-transparent hover:text-[#F4F1EA]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={openAddModal}
              className="min-h-[40px] sm:min-h-[40px] px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] active:scale-[0.98] text-[#09090B] font-semibold text-sm flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Item</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="top" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-12 space-y-6">
        {/* Non-blocking status toast */}
        {toast && (
          <div
            role="status"
            className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center justify-between gap-3 ${
              toast.tone === 'error'
                ? 'bg-[#261416] border-red-500/30 text-red-200'
                : 'bg-[#181611] border-[#D4AF37]/40 text-[#F6E29D]'
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="p-1 text-current/70 hover:text-current cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Totals Bar at Top */}
        <section aria-label="Collection totals">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4 sm:p-5">
              <div className="text-xs font-medium text-[#A19D94]">
                {activeTab === 'All' ? 'Total Vault' : `${activeTab} Vault`}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-semibold text-[#F4F1EA] tabular-nums">
                {totals.count} {totals.count === 1 ? 'item' : 'items'}
              </div>
              <div className="mt-1 text-xs text-[#8E8A81] tabular-nums">
                {totals.activeCount} active · {totals.auctionCount} auction · {totals.soldCount} sold
              </div>
            </div>

            <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4 sm:p-5">
              <div className="text-xs font-medium text-[#A19D94]">Total Paid</div>
              <div className="mt-1.5 font-mono text-2xl font-semibold text-[#F4F1EA] tabular-nums">
                {formatCurrency(totals.totalPaid)}
              </div>
              <div className="mt-1 text-xs text-[#8E8A81]">Cost basis across vault</div>
            </div>

            <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4 sm:p-5">
              <div className="text-xs font-medium text-[#A19D94]">Est. Value</div>
              <div className="mt-1.5 font-mono text-2xl font-semibold text-[#E5C158] tabular-nums">
                {formatCurrency(totals.totalEst)}
              </div>
              <div className="mt-1 text-xs text-[#8E8A81] tabular-nums">
                {totals.soldCount > 0
                  ? `${formatCurrency(totals.soldRealized)} realized`
                  : 'Current market appraisal'}
              </div>
            </div>

            <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4 sm:p-5">
              <div className="text-xs font-medium text-[#A19D94]">Net Gain / Loss</div>
              <div
                className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums flex items-center gap-1.5 ${
                  gainPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {gainPositive ? (
                  <ArrowUpRight className="w-5 h-5 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 shrink-0" />
                )}
                <span>{formatSignedCurrency(totals.net)}</span>
              </div>
              <div className="mt-1 text-xs text-[#8E8A81] tabular-nums">
                {gainPositive ? 'Gain' : 'Loss'} ({totals.pct >= 0 ? '+' : ''}
                {totals.pct.toFixed(1)}%)
              </div>
            </div>
          </div>
        </section>

        {/* Top Marketplace Hub */}
        <section
          aria-label="Top marketplace hub"
          className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F4F1EA]">
                Marketplace Hub
              </h2>
              <p className="text-xs text-[#8E8A81]">
                Search directly across live collector marketplaces. Bidding and checkout open on each site.
              </p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#8E8A81] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={hubQuery}
                onChange={(e) => setHubQuery(e.target.value)}
                placeholder="Pre-fill marketplace search..."
                aria-label="Pre-fill top marketplace search"
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {TOP_HUB_MARKETPLACES.map((site) => {
              const trimmed = hubQuery.trim();
              const href = trimmed ? site.searchUrl(trimmed) : site.homeUrl;
              return (
                <a
                  key={site.name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#18181E] hover:bg-[#222019] border border-white/[0.08] hover:border-[#D4AF37]/50 text-xs font-medium text-[#E8E4DA] hover:text-[#F6E29D] flex items-center justify-between gap-1.5 transition-colors whitespace-nowrap"
                >
                  <span className="flex flex-col min-w-0 leading-tight">
                    <span className="truncate">{site.name}</span>
                    {site.note && (
                      <span className="text-[10px] text-[#8E8A81] truncate">{site.note}</span>
                    )}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                </a>
              );
            })}
          </div>
        </section>

        {/* Snap & Price */}
        <section
          aria-label="Snap and price"
          className="bg-[#121216] border border-[#D4AF37]/40 rounded-2xl p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#F4F1EA]">
                📸 Snap &amp; Price
              </h2>
              <p className="text-xs text-[#8E8A81] leading-relaxed">
                1. Take a clear photo of the front — the app identifies it and checks sold
                prices on the sites for you, no searching needed. 2. Check the name and prices
                it filled in, fix anything that looks wrong. 3. If it could not check a price,
                use Lens or CollX below, or tap a site and type the sold price in — the app
                averages them and that becomes your value.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSnapOpen((v) => !v)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#09090B] text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors shrink-0"
            >
              <ImagePlus className="w-4 h-4" />
              <span>{snapOpen ? 'Hide Snap & Price' : '📸 Snap it — check price'}</span>
            </button>
          </div>

          {snapOpen && (
            <div className="space-y-3.5 pt-1">
              {snapError && (
                <div className="px-3.5 py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                  {snapError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#A19D94] mb-1.5">
                  Photo — camera or gallery
                </label>
                <label className="min-h-[44px] px-4 py-2 rounded-xl bg-[#18181E] hover:bg-[#222019] border border-white/[0.1] text-xs font-medium text-[#F4F1EA] flex items-center gap-2 cursor-pointer w-fit">
                  <ImagePlus className="w-4 h-4 text-[#D4AF37]" />
                  <span>Take / Choose Photo</span>
                  <input
                    ref={snapInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleSnapPhotoUpload}
                    className="hidden"
                  />
                </label>
                {snapPhoto && (
                  <img
                    src={snapPhoto}
                    alt="Snapped item for price check"
                    className="mt-3 max-h-64 rounded-xl border border-white/[0.08] object-contain"
                  />
                )}
                {snapChecking && (
                  <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-[#1C1912] border border-[#D4AF37]/50 text-xs text-[#F6E29D] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D4AF37] animate-pulse shrink-0" />
                    <span>
                      ✨ Checking prices… identifying this item and searching sold prices —
                      takes a few seconds.
                    </span>
                  </div>
                )}
                {snapPhoto && !snapChecking && (
                  <button
                    type="button"
                    onClick={() => runAutoPriceCheck(snapPhoto, snapCategory)}
                    className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#09090B] text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>↻ Check prices again</span>
                  </button>
                )}
                {snapAutoNote && !snapChecking && (
                  <p className="mt-2 text-[11px] text-[#A8C686] leading-relaxed">
                    {snapAutoNote}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={shareToLens}
                className="w-full min-h-[48px] px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#09090B] text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>🔍 Identify with Lens — share this photo</span>
              </button>
              {snapCategory === 'Cards' && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        'https://play.google.com/store/apps/details?id=app.collx.android',
                        '_blank',
                      )
                    }
                    className="w-full min-h-[48px] px-4 rounded-xl bg-[#18181E] hover:bg-[#222019] border border-[#D4AF37]/50 text-sm font-semibold text-[#F6E29D] flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <span aria-hidden="true">📷</span>
                    <span>Scan with CollX</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#D4AF37]" />
                  </button>
                  <p className="text-[11px] text-[#8E8A81] leading-relaxed">
                    CollX scans sports + Pokemon/Magic/Yu-Gi-Oh cards and gives the average
                    value — scan it there, then type the name + price back here.
                  </p>
                </>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadSnapPhoto}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#18181E] hover:bg-[#222019] border border-white/[0.08] text-xs font-medium text-[#E8E4DA] cursor-pointer"
                >
                  Download photo
                </button>
                <button
                  type="button"
                  onClick={() => window.open('https://lens.google.com/upload', '_blank')}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#18181E] hover:bg-[#222019] border border-white/[0.08] text-xs font-medium text-[#E8E4DA] flex items-center gap-1.5 cursor-pointer"
                >
                  Open Lens <ExternalLink className="w-3.5 h-3.5 text-[#D4AF37]" />
                </button>
                <button
                  type="button"
                  onClick={() => window.open('https://www.bing.com/visualsearch', '_blank')}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#18181E] hover:bg-[#222019] border border-white/[0.08] text-xs font-medium text-[#E8E4DA] flex items-center gap-1.5 cursor-pointer"
                >
                  Bing Visual <ExternalLink className="w-3.5 h-3.5 text-[#D4AF37]" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    showToast('In the eBay app, tap the camera icon in the search bar, then take a photo of your item — eBay will find matching listings.')
                  }
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#18181E] hover:bg-[#222019] border border-white/[0.08] text-xs font-medium text-[#E8E4DA] cursor-pointer"
                >
                  eBay Camera — how?
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A19D94] mb-1.5">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Comics', 'Cards', 'Toys'] as Category[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSnapCategory(cat);
                        setSnapPrices({});
                      }}
                      className={`min-h-[44px] rounded-xl text-sm font-medium border cursor-pointer transition-colors ${
                        snapCategory === cat
                          ? 'bg-[#D4AF37] border-[#D4AF37] text-[#09090B] font-semibold'
                          : 'bg-[#09090B] border-white/[0.1] text-[#A19D94] hover:text-[#F4F1EA]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="snap-title"
                  className="block text-xs font-medium text-[#A19D94] mb-1.5"
                >
                  What is it? (filled in automatically, or type it yourself)
                </label>
                <input
                  id="snap-title"
                  type="text"
                  value={snapTitle}
                  onChange={(e) => setSnapTitle(e.target.value)}
                  placeholder="e.g. Amazing Spider-Man #300, 1988"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <div className="text-xs font-medium text-[#A19D94] mb-1.5">
                  Step 2 — price it on each site
                  {snapTitle.trim() ? ` for “${snapTitle.trim()}”` : ' — type the name above first'}
                  :
                </div>
                <div className="divide-y divide-white/[0.06] rounded-xl bg-[#09090B] border border-white/[0.08] overflow-hidden">
                  {MARKETPLACES_BY_CATEGORY[snapCategory].map((site) => (
                    <div key={site.name} className="px-3.5 py-2.5 flex items-center gap-2">
                      <span className="flex-1 text-sm font-medium text-[#F4F1EA] min-w-0 truncate">
                        {site.name}
                        {site.name === 'eBay Sold' && (
                          <span className="text-[#8E8A81] font-normal"> — use this one most</span>
                        )}
                        {site.name === 'CollX' && (
                          <span className="text-[#8E8A81] font-normal"> — scan in app</span>
                        )}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={snapPrices[site.name] ?? ''}
                        onChange={(e) =>
                          setSnapPrices((prev) => ({ ...prev, [site.name]: e.target.value }))
                        }
                        placeholder="$ ?"
                        aria-label={`Sold price on ${site.name}`}
                        className="w-24 min-h-[40px] px-2.5 rounded-lg bg-[#121216] border border-white/[0.1] font-mono text-sm text-[#F4F1EA] text-right focus:outline-none focus:border-[#D4AF37]"
                      />
                      <a
                        href={site.buildUrl(snapTitle.trim())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] px-3 py-2 rounded-lg bg-[#D4AF37] text-[#09090B] text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
                      >
                        Check <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-[#8E8A81]">
                  Tip: on eBay tap “Sold listings” — that is the real price. Ignore asking
                  prices that never sold. Prices filled in automatically can be tapped and
                  changed.
                </p>
              </div>

              <div className="bg-[#18181E] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm leading-relaxed">
                {snapSummary.count === 0 ? (
                  <span className="text-[#A19D94]">
                    No prices typed yet — tap a site above, check sold prices, type one in.
                  </span>
                ) : (
                  <span>
                    From{' '}
                    <span className="font-semibold text-[#F4F1EA]">
                      {snapSummary.count} {snapSummary.count === 1 ? 'site' : 'sites'}
                    </span>
                    : low{' '}
                    <span className="font-semibold text-[#E5C158]">
                      {formatCurrency(snapSummary.low)}
                    </span>{' '}
                    · high{' '}
                    <span className="font-semibold text-[#E5C158]">
                      {formatCurrency(snapSummary.high)}
                    </span>{' '}
                    · average{' '}
                    <span className="font-semibold text-[#E5C158]">
                      {formatCurrency(snapSummary.avg)}
                    </span>{' '}
                    — that average becomes your est. value when you save it.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => saveSnapItem('keep')}
                  className="min-h-[48px] px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#09090B] text-sm font-semibold cursor-pointer transition-colors"
                >
                  📚 Put in my collection
                </button>
                <button
                  type="button"
                  onClick={() => saveSnapItem('sale')}
                  className="min-h-[48px] px-4 rounded-xl bg-[#1C1912] hover:bg-[#262116] border border-[#D4AF37]/40 text-sm font-semibold text-[#F6E29D] cursor-pointer transition-colors"
                >
                  💰 List it for sale
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Controls Bar: Mobile/Desktop Tabs, Search, Status Filter, Backup/Export */}
        <section className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Category Segmented Tabs */}
            <div
              role="tablist"
              aria-label="Filter collection by category"
              className="grid grid-cols-4 sm:inline-flex items-center gap-1 p-1 rounded-xl bg-[#121216] border border-white/[0.08]"
            >
              {(['All', 'Comics', 'Cards', 'Toys'] as TabFilter[]).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`min-h-[40px] px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#D4AF37] text-[#09090B] font-semibold'
                        : 'text-[#A19D94] hover:text-[#F4F1EA]'
                    }`}
                  >
                    {tab} ({categoryCounts[tab]})
                  </button>
                );
              })}
            </div>

            {/* Search + Status Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 lg:max-w-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8E8A81] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter vault by title, set, grade, year..."
                  aria-label="Filter vault items"
                  className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-[#121216] border border-white/[0.08] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121216] border border-white/[0.08] overflow-x-auto no-scrollbar">
                {(['All', 'Vault', 'Auction', 'Sold'] as StatusFilter[]).map((st) => {
                  const active = statusFilter === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#26231B] text-[#E5C158] border border-[#D4AF37]/30'
                          : 'text-[#A19D94] hover:text-[#F4F1EA]'
                      }`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Backup & Export Utility Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-xs text-[#8E8A81]">
              Showing <span className="font-mono text-[#F4F1EA] tabular-nums">{filteredItems.length}</span> of{' '}
              <span className="font-mono text-[#F4F1EA] tabular-nums">{items.length}</span> collectibles
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#121216] hover:bg-[#18181E] border border-white/[0.08] text-xs font-medium text-[#E8E4DA] flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#121216] hover:bg-[#18181E] border border-white/[0.08] text-xs font-medium text-[#E8E4DA] flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>JSON Backup</span>
              </button>

              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#121216] hover:bg-[#18181E] border border-white/[0.08] text-xs font-medium text-[#E8E4DA] flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Restore JSON</span>
              </button>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportJson}
                className="hidden"
              />

              {confirmResetSamples ? (
                <div className="flex items-center gap-1.5 bg-[#181611] border border-[#D4AF37]/40 rounded-xl px-2.5 py-1">
                  <span className="text-xs text-[#F6E29D]">Restore 3 samples?</span>
                  <button
                    type="button"
                    onClick={handleResetSamples}
                    className="px-2.5 py-1 rounded-lg bg-[#D4AF37] text-[#09090B] text-xs font-semibold cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetSamples(false)}
                    className="px-2 py-1 text-xs text-[#A19D94] hover:text-[#F4F1EA] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResetSamples(true)}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-transparent hover:bg-[#121216] border border-white/[0.06] text-xs font-medium text-[#A19D94] hover:text-[#F4F1EA] flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Samples</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Collection Grid */}
        {filteredItems.length === 0 ? (
          <div className="bg-[#121216] border border-white/[0.08] rounded-2xl p-10 text-center space-y-3">
            <Layers className="w-8 h-8 text-[#D4AF37] mx-auto" />
            <h3 className="font-display text-lg font-semibold text-[#F4F1EA]">
              No matching items in this view
            </h3>
            <p className="text-sm text-[#8E8A81] max-w-md mx-auto">
              Add a new comic, trading card, or collectible toy, or clear your current filters.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={openAddModal}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#D4AF37] text-[#09090B] text-sm font-semibold cursor-pointer"
              >
                Add Item
              </button>
              {(searchQuery || statusFilter !== 'All' || activeTab !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('All');
                    setStatusFilter('All');
                    setSearchQuery('');
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#18181E] border border-white/[0.08] text-sm text-[#F4F1EA] cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <section
            aria-label="Collection items"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
          >
            {filteredItems.map((item) => {
              const query = buildItemSearchQuery(item);
              const marketplaces = MARKETPLACES_BY_CATEGORY[item.category];
              const isSold = item.status === 'Sold';
              const effectiveValue = isSold ? item.soldPrice ?? item.estValue : item.estValue;
              const diff = effectiveValue - item.paid;
              const diffPct = item.paid > 0 ? (diff / item.paid) * 100 : 0;
              const auction = item.auction;
              const highBid = getHighBid(auction);
              const countdown = auction?.active ? formatCountdown(auction.endsAt, nowMs) : null;
              const reserveMet =
                auction?.reservePrice !== undefined
                  ? highBid >= auction.reservePrice
                  : true;
              const showFallbackImg = !item.photo || brokenImages[item.id];

              return (
                <article
                  key={item.id}
                  className="bg-[#121216] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col"
                >
                  {/* Item Photo */}
                  <div className="relative aspect-[4/5] bg-[#0D0D11] overflow-hidden border-b border-white/[0.06]">
                    {showFallbackImg ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#16151B] via-[#0F0F13] to-[#1D1910]">
                        <Sparkles className="w-8 h-8 text-[#D4AF37]/70 mb-2" />
                        <div className="text-xs font-medium text-[#A19D94]">{item.category}</div>
                        <div className="mt-1 font-display text-base font-semibold text-[#F4F1EA] line-clamp-2">
                          {item.title}
                        </div>
                      </div>
                    ) : (
                      <img
                        src={item.photo}
                        alt={`${item.title} ${item.number}`.trim()}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({
                            ...prev,
                            [item.id]: true,
                          }))
                        }
                        className="w-full h-full object-cover object-center"
                      />
                    )}

                    {/* Clean Sold Overlay Scrim only when sold */}
                    {isSold && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-10 flex items-end justify-between">
                        <span className="font-mono text-xs font-semibold tracking-wide text-emerald-300">
                          SOLD · {formatCurrency(item.soldPrice ?? item.estValue)}
                        </span>
                        {item.soldAt && (
                          <span className="font-mono text-[11px] text-[#C8C3B8]">
                            {new Date(item.soldAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4">
                    {/* Unboxed Metadata Kicker & Title */}
                    <div>
                      <div className="text-xs text-[#A19D94] flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="text-[#E5C158] font-medium">{item.category}</span>
                        {item.year && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{item.year}</span>
                          </>
                        )}
                        {item.publisher && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.publisher}</span>
                          </>
                        )}
                      </div>

                      <h3 className="mt-1 font-display text-lg font-semibold text-[#F4F1EA] leading-snug">
                        {item.title}
                        {item.number ? ` ${item.number}` : ''}
                      </h3>

                      <div className="mt-1 text-xs text-[#8E8A81] flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        {item.series && <span>{item.series}</span>}
                        {item.series && (item.condition || item.grade) && (
                          <span aria-hidden="true">·</span>
                        )}
                        {item.condition && <span>{item.condition}</span>}
                        {item.grade && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[#F4F1EA] font-medium">
                              {item.grade}
                            </span>
                          </>
                        )}
                      </div>

                      {item.notes && (
                        <p className="mt-2 text-xs text-[#9D988E] leading-relaxed line-clamp-2">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    {/* Paid vs Est Value Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.07]">
                      <div>
                        <div className="text-[11px] text-[#8E8A81]">Paid</div>
                        <div className="mt-0.5 font-mono text-sm font-medium text-[#F4F1EA] tabular-nums">
                          {formatCurrency(item.paid)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8E8A81]">
                          {isSold ? 'Sold Price' : 'Est. Value'}
                        </div>
                        <div className="mt-0.5 font-mono text-sm font-semibold text-[#E5C158] tabular-nums">
                          {formatCurrency(effectiveValue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8E8A81]">Spread</div>
                        <div
                          className={`mt-0.5 font-mono text-sm font-medium tabular-nums ${
                            diff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatSignedCurrency(diff)}
                          {item.paid > 0 && (
                            <span className="text-[11px] opacity-80 ml-1">
                              ({diffPct >= 0 ? '+' : ''}
                              {Math.round(diffPct)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Per-Item Auction Block */}
                    <div className="pt-3 border-t border-white/[0.07] space-y-2.5">
                      {isSold ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-emerald-300 flex items-center gap-1.5 font-medium">
                            <PackageCheck className="w-4 h-4 shrink-0" />
                            <span>Sold · {formatCurrency(item.soldPrice ?? item.estValue)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReopenItem(item.id)}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#18181E] hover:bg-[#23232C] border border-white/[0.08] text-xs font-medium text-[#E8E4DA] cursor-pointer"
                          >
                            Reopen
                          </button>
                        </div>
                      ) : auction?.active ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 font-medium text-[#E5C158]">
                              <Gavel className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {highBid > 0
                                  ? `High Bid ${formatCurrency(highBid)}`
                                  : `Start ${formatCurrency(auction.startingBid)}`}
                              </span>
                              <span className="text-[#8E8A81] font-normal">
                                · {auction.bids.length} {auction.bids.length === 1 ? 'bid' : 'bids'}
                              </span>
                            </div>
                            {countdown && (
                              <div
                                className={`font-mono tabular-nums flex items-center gap-1 ${
                                  countdown.expired ? 'text-amber-300' : 'text-[#F4F1EA]'
                                }`}
                              >
                                <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                                <span>{countdown.label}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#8E8A81]">
                            <span>
                              Start {formatCurrency(auction.startingBid)}
                              {auction.reservePrice !== undefined
                                ? ` · Reserve ${formatCurrency(auction.reservePrice)} (${
                                    reserveMet ? 'Met' : 'Not Met'
                                  })`
                                : ' · No Reserve'}
                            </span>
                          </div>

                          {soldPromptId === item.id ? (
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={soldPriceInput}
                                onChange={(e) => setSoldPriceInput(e.target.value)}
                                aria-label="Final sold price"
                                className="w-28 min-h-[40px] px-2.5 rounded-lg bg-[#09090B] border border-[#D4AF37]/50 font-mono text-xs text-[#F4F1EA]"
                              />
                              <button
                                type="button"
                                onClick={() => handleConfirmMarkSold(item.id)}
                                className="min-h-[40px] px-3 rounded-lg bg-[#D4AF37] text-[#09090B] text-xs font-semibold cursor-pointer"
                              >
                                Confirm Sale
                              </button>
                              <button
                                type="button"
                                onClick={() => setSoldPromptId(null)}
                                className="min-h-[40px] px-2 text-xs text-[#A19D94] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => openAuctionDrawer(item)}
                                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1C1912] hover:bg-[#262116] border border-[#D4AF37]/40 text-xs font-semibold text-[#F6E29D] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <Gavel className="w-3.5 h-3.5" />
                                <span>Bids & History</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openMarkSoldPrompt(item)}
                                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#18181E] hover:bg-[#22222A] border border-white/[0.1] text-xs font-medium text-[#F4F1EA] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Mark Sold</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : soldPromptId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={soldPriceInput}
                            onChange={(e) => setSoldPriceInput(e.target.value)}
                            aria-label="Final sold price"
                            className="w-28 min-h-[40px] px-2.5 rounded-lg bg-[#09090B] border border-[#D4AF37]/50 font-mono text-xs text-[#F4F1EA]"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmMarkSold(item.id)}
                            className="min-h-[40px] px-3 rounded-lg bg-[#D4AF37] text-[#09090B] text-xs font-semibold cursor-pointer"
                          >
                            Confirm Sale
                          </button>
                          <button
                            type="button"
                            onClick={() => setSoldPromptId(null)}
                            className="min-h-[40px] px-2 text-xs text-[#A19D94] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => openAuctionDrawer(item)}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-[#18181E] hover:bg-[#222019] border border-white/[0.08] hover:border-[#D4AF37]/40 text-xs font-medium text-[#E8E4DA] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Gavel className="w-3.5 h-3.5 text-[#D4AF37]" />
                            <span>Start Auction</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openMarkSoldPrompt(item)}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-[#18181E] hover:bg-[#22222A] border border-white/[0.08] text-xs font-medium text-[#E8E4DA] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Tag className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Mark Sold</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sell / Price Check Marketplace Links */}
                    <div className="pt-3 border-t border-white/[0.07] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#F4F1EA]">
                          Sell & Price Check
                        </span>
                        <span className="text-[11px] text-[#8E8A81] truncate max-w-[170px]">
                          {query}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {marketplaces.map((mp) => (
                          <a
                            key={mp.name}
                            href={mp.buildUrl(query)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs font-medium flex items-center justify-between gap-1 transition-colors whitespace-nowrap ${
                              mp.highlight
                                ? 'bg-[#1D1A11] hover:bg-[#282315] border-[#D4AF37]/45 text-[#F6E29D]'
                                : 'bg-[#0D0D11] hover:bg-[#191920] border-white/[0.08] text-[#D8D4CB] hover:text-[#F4F1EA]'
                            }`}
                          >
                            <span className="truncate">{mp.name}</span>
                            <ExternalLink className="w-3 h-3 text-[#D4AF37] shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-3 border-t border-white/[0.07] mt-auto flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-[#A19D94] hover:text-[#F4F1EA] hover:bg-white/[0.04] flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Item</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => priceItem(item)}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-[#A19D94] hover:text-[#F4F1EA] hover:bg-white/[0.04] flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <span aria-hidden="true">📸</span>
                        <span>Price</span>
                      </button>

                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="min-h-[36px] px-3 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[36px] px-2 py-1 text-xs text-[#A19D94] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label={`Delete ${item.title}`}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-[#8E8A81] hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/[0.06] bg-[#09090B] py-5 px-4 sm:px-6 mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#7B776F]">
          <div>
            Cardcore Collectors · Build {BUILD_VERSION} · Local Browser Vault (No Sign-In)
          </div>
          <div>Bidding & checkout open directly on each linked marketplace</div>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Tab Bar (Thumb-Zone Ergonomics) */}
      <nav
        aria-label="Mobile category navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#09090B]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-4 items-center px-2"
      >
        {(['All', 'Comics', 'Cards', 'Toys'] as TabFilter[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-full flex flex-col items-center justify-center gap-0.5 text-xs font-medium cursor-pointer ${
                active ? 'text-[#E5C158]' : 'text-[#8E8A81]'
              }`}
            >
              <span>{tab}</span>
              <span className="font-mono text-[10px] tabular-nums opacity-80">
                {categoryCounts[tab]}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Add / Edit Item Bottom Sheet / Modal */}
      {editorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Edit collectible item' : 'Add collectible item'}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-xl max-h-[92vh] bg-[#121216] border border-white/[0.1] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden">
            {/* Mobile Drag Handle */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1.5 rounded-full bg-white/20" />
            </div>

            <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#F4F1EA]">
                {editingId ? 'Edit Collectible' : 'Add Collectible'}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                aria-label="Close modal"
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#A19D94] hover:text-[#F4F1EA] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="flex-1 overflow-y-auto p-5 space-y-4">
              {formError && (
                <div className="px-3.5 py-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                  {formError}
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-[#A19D94] mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Comics', 'Cards', 'Toys'] as Category[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`min-h-[44px] rounded-xl text-sm font-medium border cursor-pointer transition-colors ${
                        formCategory === cat
                          ? 'bg-[#D4AF37] border-[#D4AF37] text-[#09090B] font-semibold'
                          : 'bg-[#09090B] border-white/[0.1] text-[#A19D94] hover:text-[#F4F1EA]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo Upload + URL */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#A19D94]">Photo</label>
                <div className="flex items-center gap-3">
                  <label className="min-h-[44px] px-4 py-2 rounded-xl bg-[#18181E] hover:bg-[#222019] border border-white/[0.1] text-xs font-medium text-[#F4F1EA] flex items-center gap-2 cursor-pointer shrink-0">
                    <ImagePlus className="w-4 h-4 text-[#D4AF37]" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="url"
                    value={formPhoto.startsWith('data:') ? '' : formPhoto}
                    onChange={(e) => setFormPhoto(e.target.value)}
                    placeholder={
                      formPhoto.startsWith('data:')
                        ? 'Uploaded photo attached'
                        : 'Or paste image URL...'
                    }
                    className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                  />
                  {formPhoto && (
                    <button
                      type="button"
                      onClick={() => setFormPhoto('')}
                      className="min-h-[44px] px-3 rounded-xl bg-[#18181E] border border-white/[0.08] text-xs text-[#A19D94] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label htmlFor="item-title" className="block text-xs font-medium text-[#A19D94] mb-1.5">
                  Title *
                </label>
                <input
                  id="item-title"
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Amazing Spider-Man, Charizard Holo, Optimus Prime"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Series/Set/Line & Issue/Card # */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-series" className="block text-xs font-medium text-[#A19D94] mb-1.5">
                    Series / Set / Line
                  </label>
                  <input
                    id="item-series"
                    type="text"
                    value={formSeries}
                    onChange={(e) => setFormSeries(e.target.value)}
                    placeholder="e.g. Base Set, G1, Volume 1"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label htmlFor="item-number" className="block text-xs font-medium text-[#A19D94] mb-1.5">
                    Issue / Card Number
                  </label>
                  <input
                    id="item-number"
                    type="text"
                    value={formNumber}
                    onChange={(e) => setFormNumber(e.target.value)}
                    placeholder="e.g. #300, #4/102"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Year & Publisher/Brand */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-year" className="block text-xs font-medium text-[#A19D94] mb-1.5">
                    Year
                  </label>
                  <input
                    id="item-year"
                    type="text"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    placeholder="e.g. 1999"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label htmlFor="item-publisher" className="block text-xs font-medium text-[#A19D94] mb-1.5">
                    Publisher / Brand
                  </label>
                  <input
                    id="item-publisher"
                    type="text"
                    value={formPublisher}
                    onChange={(e) => setFormPublisher(e.target.value)}
                    placeholder="e.g. Marvel, Topps, Hasbro"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Condition & Grade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-condition" className="block text-xs font-medium text-[#A19D94] mb-1.5">
                    Condition
                  </label>
                  <input
                    id="item-condition"
                    type="text"
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    placeholder="e.g. Near Mint, Sealed"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label htmlFor="item-grade" className="block text-xs font-medium text-[#A19D94] mb-1.5">
                    CGC / PSA / Grade
                  </label>
                  <input
                    id="item-grade"
                    type="text"
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value)}
                    placeholder="e.g. CGC 9.8, PSA 10, Raw"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Paid & Est Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-paid" className="block text-xs font-medium text-[#A19D94] mb-1.5">
                    Paid ($)
                  </label>
                  <input
                    id="item-paid"
                    type="number"
                    min="0"
                    step="any"
                    value={formPaid}
                    onChange={(e) => setFormPaid(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] font-mono text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label htmlFor="item-est" className="block text-xs font-medium text-[#A19D94] mb-1.5">
                    Est. Value ($)
                  </label>
                  <input
                    id="item-est"
                    type="number"
                    min="0"
                    step="any"
                    value={formEstValue}
                    onChange={(e) => setFormEstValue(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090B] border border-white/[0.1] font-mono text-sm text-[#E5C158] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="item-notes" className="block text-xs font-medium text-[#A19D94] mb-1.5">
                  Notes
                </label>
                <textarea
                  id="item-notes"
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Key variant, cert number, provenance..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Optional Auction Configuration */}
              <div className="pt-2 border-t border-white/[0.08] space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer min-h-[44px]">
                  <span className="text-sm font-medium text-[#F4F1EA]">
                    Run Per-Item Auction Tracker
                  </span>
                  <input
                    type="checkbox"
                    checked={formEnableAuction}
                    onChange={(e) => setFormEnableAuction(e.target.checked)}
                    className="w-5 h-5 accent-[#D4AF37] cursor-pointer"
                  />
                </label>

                {formEnableAuction && (
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-[#A19D94] mb-1">
                        Starting Bid ($)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={formStartingBid}
                        onChange={(e) => setFormStartingBid(e.target.value)}
                        placeholder="100"
                        className="w-full min-h-[42px] px-3 rounded-xl bg-[#09090B] border border-white/[0.1] font-mono text-xs text-[#F4F1EA]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#A19D94] mb-1">
                        Reserve (Optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={formReservePrice}
                        onChange={(e) => setFormReservePrice(e.target.value)}
                        placeholder="None"
                        className="w-full min-h-[42px] px-3 rounded-xl bg-[#09090B] border border-white/[0.1] font-mono text-xs text-[#F4F1EA]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#A19D94] mb-1">
                        Duration (Hours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={formAuctionHours}
                        onChange={(e) => setFormAuctionHours(e.target.value)}
                        placeholder="72"
                        className="w-full min-h-[42px] px-3 rounded-xl bg-[#09090B] border border-white/[0.1] font-mono text-xs text-[#F4F1EA]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky Form Footer */}
              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="min-h-[48px] px-5 rounded-xl bg-[#18181E] border border-white/[0.1] text-sm font-medium text-[#E8E4DA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[48px] px-5 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#09090B] text-sm font-semibold cursor-pointer transition-colors"
                >
                  {editingId ? 'Save Changes' : 'Add to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Per-Item Auction & Bid History Bottom Sheet / Modal */}
      {auctionModalItem && (
        <AuctionSheet
          item={auctionModalItem}
          nowMs={nowMs}
          bidderHandle={bidderHandle}
          setBidderHandle={setBidderHandle}
          bidAmountInput={bidAmountInput}
          setBidAmountInput={setBidAmountInput}
          bidError={bidError}
          onClose={() => setAuctionItemId(null)}
          onStartAuction={handleQuickStartAuction}
          onAddBid={handleAddBid}
          onStopAuction={handleStopAuction}
          onMarkSold={() => openMarkSoldPrompt(auctionModalItem)}
        />
      )}
    </div>
  );
}

interface AuctionSheetProps {
  item: CollectibleItem;
  nowMs: number;
  bidderHandle: string;
  setBidderHandle: (val: string) => void;
  bidAmountInput: string;
  setBidAmountInput: (val: string) => void;
  bidError: string;
  onClose: () => void;
  onStartAuction: (
    itemId: string,
    startingBid: number,
    reservePrice: number | undefined,
    hours: number,
  ) => void;
  onAddBid: (e: React.FormEvent) => void;
  onStopAuction: (itemId: string) => void;
  onMarkSold: () => void;
}

function AuctionSheet({
  item,
  nowMs,
  bidderHandle,
  setBidderHandle,
  bidAmountInput,
  setBidAmountInput,
  bidError,
  onClose,
  onStartAuction,
  onAddBid,
  onStopAuction,
  onMarkSold,
}: AuctionSheetProps) {
  const [startBid, setStartBid] = useState(() =>
    String(item.auction?.startingBid ?? (Math.max(10, Math.round(item.estValue * 0.75)) || 25)),
  );
  const [reserve, setReserve] = useState(() =>
    item.auction?.reservePrice !== undefined ? String(item.auction.reservePrice) : '',
  );
  const [hours, setHours] = useState('72');

  const auction = item.auction;
  const highBid = getHighBid(auction);
  const countdown = auction?.active ? formatCountdown(auction.endsAt, nowMs) : null;
  const reserveMet =
    auction?.reservePrice !== undefined ? highBid >= auction.reservePrice : true;
  const searchQ = buildItemSearchQuery(item);
  const marketplaces = MARKETPLACES_BY_CATEGORY[item.category].slice(0, 4);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Auction tracker for ${item.title}`}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] bg-[#121216] border border-white/[0.1] rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-white/20" />
        </div>

        <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-[#F4F1EA] truncate">
              {item.title} {item.number}
            </h2>
            <p className="text-xs text-[#8E8A81] truncate">
              {item.category} · {item.grade || item.condition}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close auction sheet"
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#A19D94] hover:text-[#F4F1EA] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!auction?.active ? (
            <div className="space-y-4">
              <div className="text-sm text-[#D8D4CB]">
                Configure a per-item auction timer and reserve tracker. Live bidding and checkout
                happen on your chosen marketplace site.
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs text-[#A19D94] mb-1.5">Starting Bid ($)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={startBid}
                    onChange={(e) => setStartBid(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#09090B] border border-white/[0.1] font-mono text-sm text-[#F4F1EA]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A19D94] mb-1.5">Reserve ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={reserve}
                    onChange={(e) => setReserve(e.target.value)}
                    placeholder="Optional"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#09090B] border border-white/[0.1] font-mono text-sm text-[#F4F1EA]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A19D94] mb-1.5">Duration</label>
                  <select
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="w-full min-h-[44px] px-2.5 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA]"
                  >
                    <option value="24">24 Hours</option>
                    <option value="48">48 Hours</option>
                    <option value="72">3 Days</option>
                    <option value="168">7 Days</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onStartAuction(
                    item.id,
                    Number(startBid) || 10,
                    reserve.trim() ? Number(reserve) : undefined,
                    Number(hours) || 72,
                  )
                }
                className="w-full min-h-[48px] rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#09090B] font-semibold text-sm cursor-pointer transition-colors"
              >
                Launch Auction Countdown
              </button>
            </div>
          ) : (
            <>
              {/* Live Auction Status */}
              <div className="grid grid-cols-3 gap-2.5 bg-[#09090B] border border-white/[0.08] rounded-xl p-3.5">
                <div>
                  <div className="text-[11px] text-[#8E8A81]">
                    {highBid > 0 ? 'Current Bid' : 'Starting Bid'}
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-semibold text-[#E5C158] tabular-nums">
                    {formatCurrency(highBid > 0 ? highBid : auction.startingBid)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#8E8A81]">Reserve</div>
                  <div
                    className={`mt-0.5 font-mono text-sm font-medium tabular-nums ${
                      auction.reservePrice === undefined
                        ? 'text-[#D8D4CB]'
                        : reserveMet
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                    }`}
                  >
                    {auction.reservePrice !== undefined
                      ? `${formatCurrency(auction.reservePrice)} · ${reserveMet ? 'Met' : 'Unmet'}`
                      : 'No Reserve'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#8E8A81]">Time Left</div>
                  <div className="mt-0.5 font-mono text-sm font-medium text-[#F4F1EA] tabular-nums">
                    {countdown?.label}
                  </div>
                </div>
              </div>

              {/* Log a Bid */}
              <form onSubmit={onAddBid} className="space-y-2.5">
                <div className="text-xs font-medium text-[#A19D94]">Log Bid / Offer</div>
                {bidError && (
                  <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-500/30 rounded-lg px-3 py-2">
                    {bidError}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={bidderHandle}
                    onChange={(e) => setBidderHandle(e.target.value)}
                    placeholder="Bidder handle (optional)"
                    className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#09090B] border border-white/[0.1] text-sm text-[#F4F1EA] placeholder:text-[#6E6A63]"
                  />
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={bidAmountInput}
                    onChange={(e) => setBidAmountInput(e.target.value)}
                    placeholder="Amount"
                    className="w-full sm:w-28 min-h-[44px] px-3 rounded-xl bg-[#09090B] border border-white/[0.1] font-mono text-sm text-[#F4F1EA]"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-[#09090B] text-sm font-semibold whitespace-nowrap cursor-pointer"
                  >
                    Log Bid
                  </button>
                </div>
              </form>

              {/* Bid History */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#A19D94]">
                    Bid History ({auction.bids.length})
                  </span>
                  <span className="text-[#8E8A81]">
                    Start {formatCurrency(auction.startingBid)}
                  </span>
                </div>

                {auction.bids.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#09090B] border border-white/[0.06] text-xs text-[#8E8A81] text-center">
                    No bids logged yet.
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06] rounded-xl bg-[#09090B] border border-white/[0.08] overflow-hidden">
                    {auction.bids.map((b, idx) => (
                      <div
                        key={b.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-medium text-[#F4F1EA]">@{b.bidder}</span>
                          {idx === 0 && (
                            <span className="ml-2 text-[#E5C158] font-medium">High Bid</span>
                          )}
                          <div className="text-[11px] text-[#7B776F]">
                            {new Date(b.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="font-mono text-sm font-semibold text-[#F4F1EA] tabular-nums">
                          {formatCurrency(b.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onMarkSold}
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#D4AF37] text-[#09090B] text-sm font-semibold cursor-pointer"
                >
                  Mark Sold
                </button>
                <button
                  type="button"
                  onClick={() => onStopAuction(item.id)}
                  className="min-h-[44px] px-4 rounded-xl bg-[#18181E] border border-white/[0.1] text-xs font-medium text-[#E8E4DA] cursor-pointer"
                >
                  Pause Auction
                </button>
              </div>
            </>
          )}

          {/* Direct Marketplace Links */}
          <div className="pt-3 border-t border-white/[0.08] space-y-2">
            <div className="text-xs text-[#8E8A81]">
              List or verify live bids directly on external marketplaces:
            </div>
            <div className="grid grid-cols-2 gap-2">
              {marketplaces.map((mp) => (
                <a
                  key={mp.name}
                  href={mp.buildUrl(searchQ)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[42px] px-3 rounded-xl bg-[#18181E] hover:bg-[#222019] border border-white/[0.08] text-xs font-medium text-[#E8E4DA] flex items-center justify-between gap-1.5"
                >
                  <span>{mp.name}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#D4AF37]" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
