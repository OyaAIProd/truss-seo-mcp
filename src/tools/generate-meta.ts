import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { recordToolUsage } from '../lib/usage.js';

/**
 * Extract the most relevant sentences from content for meta generation.
 */
function extractKeySentences(content: string, keyword: string): string[] {
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const lowerKw = keyword.toLowerCase();

  // Prioritize sentences containing the keyword
  const withKeyword = sentences.filter((s) => s.toLowerCase().includes(lowerKw));
  const without = sentences.filter((s) => !s.toLowerCase().includes(lowerKw));

  return [...withKeyword, ...without].slice(0, 5);
}

/**
 * Generate a title tag from content and keyword.
 */
function generateTitle(content: string, keyword: string): string {
  const keySentences = extractKeySentences(content, keyword);

  // Try to craft a title around the keyword
  // Strategy: keyword + benefit/context from content
  const words = content.split(/\s+/).slice(0, 200);
  const firstSentence = keySentences[0] || words.join(' ');

  // If the first sentence is short enough, use it
  if (firstSentence.length <= 60 && firstSentence.toLowerCase().includes(keyword.toLowerCase())) {
    return firstSentence;
  }

  // Build a title with the keyword
  const titlePrefix = keyword.charAt(0).toUpperCase() + keyword.slice(1);

  // Find a good descriptor from content
  const descriptors = [
    'Complete Guide',
    'Everything You Need to Know',
    'Tips & Best Practices',
    'How-To Guide',
  ];

  // Check if content suggests a specific type
  const lowerContent = content.toLowerCase();
  let suffix = descriptors[0];

  if (lowerContent.includes('how to') || lowerContent.includes('step')) {
    suffix = 'Step-by-Step Guide';
  } else if (lowerContent.includes('tips') || lowerContent.includes('best practice')) {
    suffix = 'Tips & Best Practices';
  } else if (lowerContent.includes('review') || lowerContent.includes('comparison')) {
    suffix = 'Review & Comparison';
  } else if (lowerContent.includes('what is') || lowerContent.includes('definition')) {
    suffix = 'What It Is & Why It Matters';
  }

  let title = `${titlePrefix}: ${suffix}`;

  // Truncate if too long
  if (title.length > 60) {
    title = title.substring(0, 57) + '...';
  }

  return title;
}

/**
 * Generate a meta description from content and keyword.
 */
function generateDescription(content: string, keyword: string): string {
  const keySentences = extractKeySentences(content, keyword);
  const lowerKw = keyword.toLowerCase();

  // Try to use a sentence that contains the keyword
  for (const sentence of keySentences) {
    if (sentence.toLowerCase().includes(lowerKw) && sentence.length >= 120 && sentence.length <= 160) {
      return sentence;
    }
  }

  // Build from best sentences
  let desc = '';
  for (const sentence of keySentences) {
    const candidate = desc ? `${desc}. ${sentence}` : sentence;
    if (candidate.length > 160) break;
    desc = candidate;
  }

  // Ensure keyword is in the description
  if (!desc.toLowerCase().includes(lowerKw)) {
    desc = `Learn about ${keyword}. ${desc}`;
  }

  // Truncate
  if (desc.length > 160) {
    desc = desc.substring(0, 157) + '...';
  }

  // Pad if too short
  if (desc.length < 120) {
    desc += ` Discover tips, strategies, and insights about ${keyword}.`;
    if (desc.length > 160) {
      desc = desc.substring(0, 157) + '...';
    }
  }

  return desc;
}

export function registerGenerateMeta(server: McpServer): void {
  server.tool(
    'generate_meta',
    'Generate SEO-optimized title tag, meta description, and Open Graph tags from content and a target keyword. Ensures proper character lengths and keyword placement. Free tier: 3 queries/day.',
    {
      content: z.string().min(1).describe('The page content to generate meta tags for'),
      target_keyword: z.string().min(1).describe('Primary keyword to optimize for'),
    },
    async ({ content, target_keyword }) => {
      const title = generateTitle(content, target_keyword);
      const metaDescription = generateDescription(content, target_keyword);

      // OG tags can be slightly different/longer
      const ogTitle = title.length <= 95 ? title : title.substring(0, 92) + '...';
      const ogDescription =
        metaDescription.length <= 200
          ? metaDescription
          : metaDescription.substring(0, 197) + '...';

      const warnings: string[] = [];

      if (title.length > 60) {
        warnings.push(`Title is ${title.length} chars (recommended: 50-60). May be truncated in SERP.`);
      }
      if (metaDescription.length > 160) {
        warnings.push(
          `Meta description is ${metaDescription.length} chars (recommended: 150-160). May be truncated.`,
        );
      }
      if (!title.toLowerCase().includes(target_keyword.toLowerCase())) {
        warnings.push('Target keyword not found in title. Consider including it for better rankings.');
      }
      if (!metaDescription.toLowerCase().includes(target_keyword.toLowerCase())) {
        warnings.push('Target keyword not found in meta description.');
      }

      recordToolUsage('generate_meta');

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                title,
                meta_description: metaDescription,
                og_title: ogTitle,
                og_description: ogDescription,
                character_counts: {
                  title: title.length,
                  meta_description: metaDescription.length,
                  og_title: ogTitle.length,
                  og_description: ogDescription.length,
                },
                warnings,
                html_snippet: [
                  `<title>${title}</title>`,
                  `<meta name="description" content="${metaDescription}">`,
                  `<meta property="og:title" content="${ogTitle}">`,
                  `<meta property="og:description" content="${ogDescription}">`,
                ].join('\n'),
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
