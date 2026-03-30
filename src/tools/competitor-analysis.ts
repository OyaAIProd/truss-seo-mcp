import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchPage } from '../services/fetcher.js';
import { parseHtml } from '../services/html-parser.js';
import { scorePage } from '../services/seo-scorer.js';
import { generateAiContent, hasAiCapability } from '../services/ai-service.js';
import { recordToolUsage } from '../lib/usage.js';
import { requirePro } from '../lib/license.js';

function analyzeContentTopics(text: string): string[] {
  // Extract likely topic phrases (2-3 word combos that appear frequently)
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'will', 'your', 'about',
    'more', 'also', 'been', 'they', 'their', 'what', 'when', 'which',
    'there', 'would', 'could', 'should', 'other', 'than', 'then',
    'these', 'those', 'some', 'into', 'very', 'just', 'most',
  ]);

  const filteredWords = words.filter((w) => !stopWords.has(w) && !/^\d+$/.test(w));

  // Count word frequency
  const freq: Record<string, number> = {};
  for (const word of filteredWords) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // Get top topics by frequency
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

function classifyContentType(parsed: ReturnType<typeof parseHtml>): string {
  const text = parsed.rawText.toLowerCase();

  if (parsed.schemaMarkup.some((s) => s.includes('"Product"'))) return 'product_page';
  if (parsed.schemaMarkup.some((s) => s.includes('"Article"') || s.includes('"BlogPosting"')))
    return 'blog_post';
  if (parsed.schemaMarkup.some((s) => s.includes('"FAQPage"'))) return 'faq_page';

  if (text.includes('add to cart') || text.includes('buy now') || text.includes('price'))
    return 'product_page';
  if (parsed.h2.length > 3 && parsed.wordCount > 800) return 'long_form_content';
  if (parsed.wordCount < 300) return 'landing_page';

  return 'content_page';
}

export function registerCompetitorAnalysis(server: McpServer): void {
  server.tool(
    'competitor_analysis',
    'Analyze a competitor URL for SEO strategy — content structure, keyword targets, technical SEO, and gaps. Optionally enhanced with AI analysis. PRO feature ($29/mo).',
    {
      url: z.string().url().describe('Competitor URL to analyze'),
    },
    async ({ url }) => {
      try {
        await requirePro();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: message, upgrade_url: 'https://truss.dev/seo' }, null, 2),
            },
          ],
        };
      }

      try {
        const result = await fetchPage(url);
        const parsed = parseHtml(result.html);
        const seoScore = scorePage(parsed, url, result.loadTimeMs);
        const topics = analyzeContentTopics(parsed.rawText);
        const contentType = classifyContentType(parsed);

        const parsedUrl = new URL(url);

        const gaps: string[] = [];

        // Identify gaps
        if (!parsed.metaDescription) gaps.push('Missing meta description');
        if (parsed.h1.length === 0) gaps.push('No H1 tag');
        if (parsed.schemaMarkup.length === 0) gaps.push('No structured data (JSON-LD)');
        if (!parsed.ogTitle) gaps.push('Missing Open Graph tags');
        if (!parsed.canonical) gaps.push('No canonical URL');
        if (parsed.images.filter((i) => !i.alt).length > 0) gaps.push('Images missing alt text');
        if (parsed.wordCount < 1000) gaps.push(`Content is only ${parsed.wordCount} words — consider creating longer, more comprehensive content`);
        if (result.loadTimeMs > 3000) gaps.push(`Slow page load (${(result.loadTimeMs / 1000).toFixed(1)}s)`);

        let aiAnalysis: string | undefined;

        if (hasAiCapability()) {
          const aiResult = await generateAiContent(
            `Analyze this competitor page for SEO strategy:\n\nURL: ${url}\nTitle: ${parsed.title}\nH1: ${parsed.h1.join(', ')}\nH2s: ${parsed.h2.join(', ')}\nWord count: ${parsed.wordCount}\nTop topics: ${topics.join(', ')}\nContent type: ${contentType}\nSEO Score: ${seoScore.score}/100\nIssues: ${seoScore.issues.map((i) => i.message).join('; ')}\n\nProvide a brief competitive analysis: What are they doing well? Where are the opportunities to outrank them? What content strategy are they using?`,
            'You are an SEO expert. Provide concise, actionable competitor analysis. Focus on opportunities to outrank this competitor. Keep response under 500 words.',
          );

          if (aiResult.ai_used) {
            aiAnalysis = aiResult.text;
          }
        }

        recordToolUsage('competitor_analysis');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  url,
                  domain_info: {
                    domain: parsedUrl.hostname,
                    protocol: parsedUrl.protocol,
                    path: parsedUrl.pathname,
                  },
                  seo_score: seoScore.score,
                  page_seo: seoScore.metadata,
                  content_strategy: {
                    word_count: parsed.wordCount,
                    heading_structure: [
                      ...parsed.h1.map((h) => `H1: ${h}`),
                      ...parsed.h2.map((h) => `H2: ${h}`),
                      ...parsed.h3.map((h) => `H3: ${h}`),
                    ],
                    content_topics: topics,
                    content_type: contentType,
                  },
                  technical_seo: {
                    has_ssl: parsedUrl.protocol === 'https:',
                    has_canonical: !!parsed.canonical,
                    has_schema: parsed.schemaMarkup.length > 0,
                    has_og_tags: !!(parsed.ogTitle && parsed.ogDescription),
                    has_robots: !!parsed.robots,
                  },
                  issues: seoScore.issues,
                  gaps,
                  ...(aiAnalysis ? { ai_analysis: aiAnalysis } : {}),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Competitor analysis failed: ${message}`, url }, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
