/**
 * Keyword research using Google Suggest API (free, no key needed).
 * Estimates volume from suggestion position + modifier patterns.
 */

import type { KeywordResearchEntry } from '../types.js';

const GOOGLE_SUGGEST_URL = 'https://suggestqueries.google.com/complete/search';

interface GoogleSuggestResponse {
  0: string;
  1: string[];
}

async function getGoogleSuggestions(query: string): Promise<string[]> {
  const url = new URL(GOOGLE_SUGGEST_URL);
  url.searchParams.set('client', 'firefox');
  url.searchParams.set('q', query);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as GoogleSuggestResponse;
    return Array.isArray(data[1]) ? data[1] : [];
  } catch {
    return [];
  }
}

/**
 * Estimate search volume based on suggestion position and modifiers.
 * Position 1-3 = high, 4-6 = medium, 7+ = low.
 * Commercial modifiers bump the estimate.
 */
function estimateVolume(
  keyword: string,
  position: number,
): 'high' | 'medium' | 'low' | 'very_low' {
  if (position <= 2) return 'high';
  if (position <= 5) return 'medium';
  if (position <= 8) return 'low';
  return 'very_low';
}

/**
 * Classify competition based on commercial intent modifiers.
 */
function classifyCompetition(keyword: string): 'high' | 'medium' | 'low' {
  const highCompetitionModifiers = [
    'buy', 'best', 'top', 'review', 'price', 'cost', 'cheap',
    'discount', 'deal', 'coupon', 'vs', 'alternative', 'software',
    'tool', 'service', 'agency', 'company', 'platform',
  ];

  const mediumCompetitionModifiers = [
    'how to', 'what is', 'guide', 'tutorial', 'tips', 'examples',
    'template', 'free', 'online',
  ];

  const lowerKeyword = keyword.toLowerCase();

  if (highCompetitionModifiers.some((mod) => lowerKeyword.includes(mod))) {
    return 'high';
  }
  if (mediumCompetitionModifiers.some((mod) => lowerKeyword.includes(mod))) {
    return 'medium';
  }
  return 'low';
}

/**
 * Estimate keyword difficulty (0-100) based on competition and volume signals.
 */
function estimateDifficulty(
  competition: 'high' | 'medium' | 'low',
  volume: 'high' | 'medium' | 'low' | 'very_low',
): number {
  const competitionScores = { high: 70, medium: 45, low: 20 };
  const volumeBonus = { high: 20, medium: 10, low: 5, very_low: 0 };

  return Math.min(100, competitionScores[competition] + volumeBonus[volume]);
}

/**
 * Rough CPC estimate based on competition.
 */
function estimateCpc(competition: 'high' | 'medium' | 'low'): string {
  switch (competition) {
    case 'high':
      return '$2.00-$8.00';
    case 'medium':
      return '$0.50-$2.00';
    case 'low':
      return '$0.10-$0.50';
  }
}

/**
 * Generate keyword variations using common modifier patterns.
 */
function generateVariations(seed: string): string[] {
  const prefixes = ['how to', 'best', 'what is', 'why', 'top'];
  const suffixes = ['guide', 'tips', 'examples', 'tools', 'vs', 'for beginners', 'tutorial'];

  const variations: string[] = [];
  for (const prefix of prefixes) {
    variations.push(`${prefix} ${seed}`);
  }
  for (const suffix of suffixes) {
    variations.push(`${seed} ${suffix}`);
  }
  return variations;
}

export async function researchKeyword(
  seedKeyword: string,
  count: number = 20,
): Promise<KeywordResearchEntry[]> {
  const results: KeywordResearchEntry[] = [];
  const seen = new Set<string>();

  // Get direct suggestions
  const directSuggestions = await getGoogleSuggestions(seedKeyword);

  for (let i = 0; i < directSuggestions.length; i++) {
    const kw = directSuggestions[i].toLowerCase().trim();
    if (seen.has(kw)) continue;
    seen.add(kw);

    const volume = estimateVolume(kw, i);
    const competition = classifyCompetition(kw);

    results.push({
      keyword: kw,
      estimated_volume: volume,
      competition,
      difficulty: estimateDifficulty(competition, volume),
      cpc_estimate: estimateCpc(competition),
      source: 'google_suggest',
    });
  }

  // Get variations via alphabet expansion (a-z appended)
  if (results.length < count) {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (const letter of letters) {
      if (results.length >= count) break;

      const suggestions = await getGoogleSuggestions(`${seedKeyword} ${letter}`);
      for (let i = 0; i < suggestions.length; i++) {
        if (results.length >= count) break;

        const kw = suggestions[i].toLowerCase().trim();
        if (seen.has(kw)) continue;
        seen.add(kw);

        const volume = estimateVolume(kw, i + 5); // offset since these are derivative
        const competition = classifyCompetition(kw);

        results.push({
          keyword: kw,
          estimated_volume: volume,
          competition,
          difficulty: estimateDifficulty(competition, volume),
          cpc_estimate: estimateCpc(competition),
          source: 'google_suggest_alpha',
        });
      }
    }
  }

  // Add pattern-based variations if still under count
  if (results.length < count) {
    const variations = generateVariations(seedKeyword);
    for (const variation of variations) {
      if (results.length >= count) break;

      const kw = variation.toLowerCase().trim();
      if (seen.has(kw)) continue;
      seen.add(kw);

      const competition = classifyCompetition(kw);

      results.push({
        keyword: kw,
        estimated_volume: 'low',
        competition,
        difficulty: estimateDifficulty(competition, 'low'),
        cpc_estimate: estimateCpc(competition),
        source: 'pattern_variation',
      });
    }
  }

  return results.slice(0, count);
}
