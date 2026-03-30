import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeKeywordDensity, calculateReadability } from '../services/seo-scorer.js';
import { recordToolUsage } from '../lib/usage.js';

export function registerCheckKeywords(server: McpServer): void {
  server.tool(
    'check_keywords',
    'Analyze text for keyword density, readability (Flesch-Kincaid), and SEO optimization. Checks if target keywords appear in optimal positions and density. Free tier: 3 queries/day.',
    {
      text: z.string().min(1).describe('The text content to analyze'),
      target_keywords: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe('Target keywords to check density for (1-10 keywords)'),
    },
    async ({ text, target_keywords }) => {
      const density = analyzeKeywordDensity(text, target_keywords);
      const readability = calculateReadability(text);

      const suggestions: string[] = [];

      for (const [keyword, data] of Object.entries(density)) {
        if (data.count === 0) {
          suggestions.push(`Keyword "${keyword}" not found in text. Consider adding it naturally.`);
        } else if (data.density < 0.5) {
          suggestions.push(
            `Keyword "${keyword}" density is low (${data.density}%). Aim for 1-2% for primary keywords.`,
          );
        } else if (data.density > 3.0) {
          suggestions.push(
            `Keyword "${keyword}" density is high (${data.density}%). This may look like keyword stuffing. Reduce to 1-2%.`,
          );
        }
      }

      if (readability.score < 50) {
        suggestions.push(
          'Readability is low. Shorten sentences and use simpler words for broader audiences.',
        );
      }

      const words = text.split(/\s+/).filter((w) => w.length > 0);

      if (words.length < 300) {
        suggestions.push(
          `Content is only ${words.length} words. Aim for at least 300 words for SEO.`,
        );
      }

      recordToolUsage('check_keywords');

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                keyword_density: density,
                total_words: words.length,
                readability_score: readability.score,
                grade_level: readability.gradeLevel,
                suggestions,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
