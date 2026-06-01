import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { auth } from "@/lib/auth";

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

interface ImageResult {
  id: string;
  urls: { regular: string; small: string; thumb: string };
  alt: string;
  credit: string;
  creditLink: string;
  source: "unsplash" | "pexels" | "fallback";
}

// Curated fallback images when no API key is configured
const FALLBACK_IMAGES: ImageResult[] = [
  { id: "f1", urls: { regular: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=960&h=540&fit=crop", small: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop", thumb: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&h=150&fit=crop" }, alt: "Modern office", credit: "Unsplash", creditLink: "https://unsplash.com", source: "fallback" },
  { id: "f2", urls: { regular: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=960&h=540&fit=crop", small: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop", thumb: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&h=150&fit=crop" }, alt: "Team collaboration", credit: "Unsplash", creditLink: "https://unsplash.com", source: "fallback" },
  { id: "f3", urls: { regular: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=960&h=540&fit=crop", small: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop", thumb: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=200&h=150&fit=crop" }, alt: "Technology abstract", credit: "Unsplash", creditLink: "https://unsplash.com", source: "fallback" },
  { id: "f4", urls: { regular: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=960&h=540&fit=crop", small: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=300&fit=crop", thumb: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=200&h=150&fit=crop" }, alt: "Startup workspace", credit: "Unsplash", creditLink: "https://unsplash.com", source: "fallback" },
  { id: "f5", urls: { regular: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=960&h=540&fit=crop", small: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop", thumb: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=150&fit=crop" }, alt: "Nature landscape", credit: "Unsplash", creditLink: "https://unsplash.com", source: "fallback" },
  { id: "f6", urls: { regular: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=960&h=540&fit=crop", small: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=300&fit=crop", thumb: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=200&h=150&fit=crop" }, alt: "People working on laptops", credit: "Unsplash", creditLink: "https://unsplash.com", source: "fallback" },
];

async function searchUnsplash(q: string, page: string): Promise<ImageResult[]> {
  if (!UNSPLASH_ACCESS_KEY) return [];
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&page=${page}&per_page=9&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
      signal: AbortSignal.timeout(5000), // never hang on a slow provider
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((photo: any) => ({
      id: `unsplash-${photo.id}`,
      urls: {
        regular: photo.urls.regular,
        small: photo.urls.small,
        thumb: photo.urls.thumb,
      },
      alt: photo.alt_description || photo.description || q,
      credit: photo.user?.name || "Unsplash",
      creditLink: photo.user?.links?.html || "https://unsplash.com",
      source: "unsplash" as const,
    }));
  } catch {
    return [];
  }
}

async function searchPexels(q: string, page: string): Promise<ImageResult[]> {
  if (!PEXELS_API_KEY) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&page=${page}&per_page=9&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY },
      signal: AbortSignal.timeout(5000), // never hang on a slow provider
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []).map((photo: any) => ({
      id: `pexels-${photo.id}`,
      urls: {
        regular: photo.src.landscape || photo.src.large,
        small: photo.src.medium,
        thumb: photo.src.tiny,
      },
      alt: photo.alt || q,
      credit: photo.photographer || "Pexels",
      creditLink: photo.photographer_url || "https://pexels.com",
      source: "pexels" as const,
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // User-based rate limiting (30 req/min)
  const rateLimit = checkRateLimit(`${session.user.id}:unsplash`, 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const q = req.nextUrl.searchParams.get("q") || "";
  const page = req.nextUrl.searchParams.get("page") || "1";

  if (!q.trim()) {
    return NextResponse.json({ results: FALLBACK_IMAGES });
  }

  // Fetch from both Unsplash and Pexels in parallel
  const [unsplashResults, pexelsResults] = await Promise.all([
    searchUnsplash(q, page),
    searchPexels(q, page),
  ]);

  // Interleave results: unsplash, pexels, unsplash, pexels...
  const combined: ImageResult[] = [];
  const maxLen = Math.max(unsplashResults.length, pexelsResults.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < unsplashResults.length) combined.push(unsplashResults[i]);
    if (i < pexelsResults.length) combined.push(pexelsResults[i]);
  }

  // If no API results, return fallbacks
  if (combined.length === 0) {
    const keywords = q.toLowerCase().split(/\s+/).slice(0, 3).join(",");
    const sourceResults: ImageResult[] = Array.from({ length: 6 }, (_, i) => ({
      id: `source-${i}`,
      urls: {
        regular: `https://images.unsplash.com/photo-1497366216548-37526070297c?w=960&h=540&fit=crop`,
        small: `https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop`,
        thumb: `https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&h=150&fit=crop`,
      },
      alt: keywords,
      credit: "Unsplash",
      creditLink: "https://unsplash.com",
      source: "fallback" as const,
    }));
    return NextResponse.json({ results: sourceResults });
  }

  return NextResponse.json({ results: combined });
}
