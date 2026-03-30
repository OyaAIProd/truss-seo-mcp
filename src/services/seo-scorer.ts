/**
 * SEO scoring engine — analyzes parsed HTML and produces actionable scores and issues.
 */

import type { ParsedPage } from './html-parser.js';
import { classifyLink } from './html-parser.js';
import type { SeoIssue, SeoSuggestion, PageMetadata } from '../types.js';

interface ScoreResult {
  score: number;
  issues: SeoIssue[];
  suggestions: SeoSuggestion[];
  metadata: PageMetadata;
}

export function scorePage(parsed: ParsedPage, url: string, loadTimeMs: number): ScoreResult {
  const issues: SeoIssue[] = [];
  const suggestions: SeoSuggestion[] = [];
  let score = 100;

  // ── Title ─────────────────────────────────────────────────────────
  if (!parsed.title) {
    issues.push({ severity: 'critical', category: 'title', message: 'Missing <title> tag' });
    score -= 15;
  } else {
    const titleLen = parsed.title.length;
    if (titleLen < 30) {
      issues.push({
        severity: 'warning',
        category: 'title',
        message: `Title too short (${titleLen} chars). Aim for 50-60 characters.`,
        element: parsed.title,
      });
      score -= 5;
    } else if (titleLen > 60) {
      issues.push({
        severity: 'warning',
        category: 'title',
        message: `Title too long (${titleLen} chars). Google truncates at ~60 characters.`,
        element: parsed.title,
      });
      score -= 3;
    }
  }

  // ── Meta Description ──────────────────────────────────────────────
  if (!parsed.metaDescription) {
    issues.push({
      severity: 'critical',
      category: 'meta_description',
      message: 'Missing meta description',
    });
    score -= 10;
  } else {
    const descLen = parsed.metaDescription.length;
    if (descLen < 120) {
      issues.push({
        severity: 'warning',
        category: 'meta_description',
        message: `Meta description too short (${descLen} chars). Aim for 150-160 characters.`,
        element: parsed.metaDescription,
      });
      score -= 3;
    } else if (descLen > 160) {
      issues.push({
        severity: 'warning',
        category: 'meta_description',
        message: `Meta description too long (${descLen} chars). Google truncates at ~160 characters.`,
        element: parsed.metaDescription,
      });
      score -= 2;
    }
  }

  // ── Headings ──────────────────────────────────────────────────────
  if (parsed.h1.length === 0) {
    issues.push({ severity: 'critical', category: 'headings', message: 'Missing H1 heading' });
    score -= 10;
  } else if (parsed.h1.length > 1) {
    issues.push({
      severity: 'warning',
      category: 'headings',
      message: `Multiple H1 tags found (${parsed.h1.length}). Use only one H1 per page.`,
    });
    score -= 5;
  }

  if (parsed.h2.length === 0) {
    suggestions.push({
      priority: 'medium',
      category: 'headings',
      message: 'Add H2 subheadings to improve content structure and scannability.',
    });
    score -= 2;
  }

  // ── Images ────────────────────────────────────────────────────────
  const imagesWithoutAlt = parsed.images.filter((img) => !img.alt || img.alt.trim() === '');
  if (imagesWithoutAlt.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'images',
      message: `${imagesWithoutAlt.length} image(s) missing alt text`,
    });
    score -= Math.min(10, imagesWithoutAlt.length * 2);
  }

  // ── Links ─────────────────────────────────────────────────────────
  let internalCount = 0;
  let externalCount = 0;

  for (const link of parsed.links) {
    const type = classifyLink(link.href, url);
    if (type === 'internal') internalCount++;
    if (type === 'external') externalCount++;
  }

  if (internalCount === 0) {
    suggestions.push({
      priority: 'high',
      category: 'links',
      message: 'No internal links found. Add links to other pages on your site.',
    });
    score -= 5;
  }

  // ── Content ───────────────────────────────────────────────────────
  if (parsed.wordCount < 300) {
    issues.push({
      severity: 'warning',
      category: 'content',
      message: `Thin content (${parsed.wordCount} words). Aim for at least 300 words for blog posts.`,
    });
    score -= 10;
  } else if (parsed.wordCount < 600) {
    suggestions.push({
      priority: 'medium',
      category: 'content',
      message: `Content is ${parsed.wordCount} words. Longer content (1000+) tends to rank better.`,
    });
    score -= 3;
  }

  // ── Canonical ─────────────────────────────────────────────────────
  if (!parsed.canonical) {
    suggestions.push({
      priority: 'medium',
      category: 'canonical',
      message: 'Add a canonical URL to prevent duplicate content issues.',
    });
    score -= 3;
  }

  // ── Open Graph ────────────────────────────────────────────────────
  if (!parsed.ogTitle || !parsed.ogDescription) {
    suggestions.push({
      priority: 'low',
      category: 'social',
      message: 'Add Open Graph tags (og:title, og:description) for better social media sharing.',
    });
    score -= 2;
  }

  if (!parsed.ogImage) {
    suggestions.push({
      priority: 'low',
      category: 'social',
      message: 'Add og:image for a preview image when shared on social media.',
    });
    score -= 1;
  }

  // ── Schema Markup ─────────────────────────────────────────────────
  if (parsed.schemaMarkup.length === 0) {
    suggestions.push({
      priority: 'medium',
      category: 'schema',
      message: 'Add JSON-LD structured data to enhance search result appearance.',
    });
    score -= 3;
  }

  // ── Load Time ─────────────────────────────────────────────────────
  if (loadTimeMs > 3000) {
    issues.push({
      severity: 'warning',
      category: 'performance',
      message: `Slow load time (${(loadTimeMs / 1000).toFixed(1)}s). Aim for under 3 seconds.`,
    });
    score -= 5;
  } else if (loadTimeMs > 5000) {
    issues.push({
      severity: 'critical',
      category: 'performance',
      message: `Very slow load time (${(loadTimeMs / 1000).toFixed(1)}s). This hurts rankings significantly.`,
    });
    score -= 10;
  }

  // ── Viewport ──────────────────────────────────────────────────────
  if (!parsed.viewport) {
    issues.push({
      severity: 'warning',
      category: 'mobile',
      message: 'Missing viewport meta tag. Required for mobile-friendly pages.',
    });
    score -= 5;
  }

  // ── Language ──────────────────────────────────────────────────────
  if (!parsed.lang) {
    suggestions.push({
      priority: 'low',
      category: 'accessibility',
      message: 'Add lang attribute to <html> tag for accessibility and SEO.',
    });
    score -= 1;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Build metadata
  const metadata: PageMetadata = {
    title: parsed.title,
    titleLength: parsed.title?.length ?? 0,
    metaDescription: parsed.metaDescription,
    metaDescriptionLength: parsed.metaDescription?.length ?? 0,
    canonical: parsed.canonical,
    robots: parsed.robots,
    h1: parsed.h1,
    h2: parsed.h2,
    h3: parsed.h3,
    wordCount: parsed.wordCount,
    paragraphCount: parsed.paragraphCount,
    imageCount: parsed.images.length,
    imagesWithAlt: parsed.images.length - imagesWithoutAlt.length,
    imagesWithoutAlt: imagesWithoutAlt.map((img) => img.src),
    internalLinks: internalCount,
    externalLinks: externalCount,
    hasSchemaMarkup: parsed.schemaMarkup.length > 0,
    ogTitle: parsed.ogTitle,
    ogDescription: parsed.ogDescription,
    ogImage: parsed.ogImage,
    loadTimeMs,
  };

  return { score, issues, suggestions, metadata };
}

// ── Readability ─────────────────────────────────────────────────────

/**
 * Calculate Flesch-Kincaid readability score.
 * Higher = easier to read.
 */
export function calculateReadability(text: string): {
  score: number;
  gradeLevel: string;
} {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0 || sentences.length === 0) {
    return { score: 0, gradeLevel: 'N/A' };
  }

  // Count syllables (rough estimate)
  const syllableCount = words.reduce((total, word) => {
    return total + countSyllables(word);
  }, 0);

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllableCount / words.length;

  // Flesch Reading Ease
  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  // Grade level mapping
  let gradeLevel: string;
  if (clampedScore >= 90) gradeLevel = '5th grade (very easy)';
  else if (clampedScore >= 80) gradeLevel = '6th grade (easy)';
  else if (clampedScore >= 70) gradeLevel = '7th grade (fairly easy)';
  else if (clampedScore >= 60) gradeLevel = '8th-9th grade (standard)';
  else if (clampedScore >= 50) gradeLevel = '10th-12th grade (fairly difficult)';
  else if (clampedScore >= 30) gradeLevel = 'College (difficult)';
  else gradeLevel = 'College graduate (very difficult)';

  return { score: clampedScore, gradeLevel };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  // Remove trailing 'e'
  word = word.replace(/(?:[^leas])e$/, '');
  word = word.replace(/^re/, 're');

  // Count vowel groups
  const matches = word.match(/[aeiouy]+/g);
  const count = matches ? matches.length : 1;

  return Math.max(1, count);
}

/**
 * Analyze keyword density for a text against target keywords.
 */
export function analyzeKeywordDensity(
  text: string,
  keywords: string[],
  title?: string | null,
  h1?: string[],
  metaDescription?: string | null,
): Record<string, { keyword: string; count: number; density: number; inTitle: boolean; inH1: boolean; inMetaDescription: boolean }> {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length;

  const result: Record<string, { keyword: string; count: number; density: number; inTitle: boolean; inH1: boolean; inMetaDescription: boolean }> = {};

  for (const keyword of keywords) {
    const lowerKw = keyword.toLowerCase();

    // Count occurrences (phrase matching)
    let count = 0;
    let searchFrom = 0;
    while (true) {
      const index = lowerText.indexOf(lowerKw, searchFrom);
      if (index === -1) break;
      count++;
      searchFrom = index + 1;
    }

    const density = totalWords > 0 ? (count / totalWords) * 100 : 0;
    const inTitle = title ? title.toLowerCase().includes(lowerKw) : false;
    const inH1 = h1 ? h1.some((h) => h.toLowerCase().includes(lowerKw)) : false;
    const inMetaDesc = metaDescription ? metaDescription.toLowerCase().includes(lowerKw) : false;

    result[keyword] = {
      keyword,
      count,
      density: Math.round(density * 100) / 100,
      inTitle,
      inH1,
      inMetaDescription: inMetaDesc,
    };
  }

  return result;
}
