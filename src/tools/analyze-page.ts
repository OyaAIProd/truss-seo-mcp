import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchPage } from '../services/fetcher.js';
import { parseHtml } from '../services/html-parser.js';
import { scorePage } from '../services/seo-scorer.js';
import { recordToolUsage } from '../lib/usage.js';

export function registerAnalyzePage(server: McpServer): void {
  server.tool(
    'analyze_page',
    'Analyze on-page SEO for a URL — title, meta, headings, images, links, load time, schema markup. Returns a score (0-100) with issues and suggestions. Free tier: 3 queries/day.',
    {
      url: z.string().url().describe('Full URL of the page to analyze (e.g., https://example.com)'),
    },
    async ({ url }) => {
      try {
        const result = await fetchPage(url);
        const parsed = parseHtml(result.html);
        const analysis = scorePage(parsed, url, result.loadTimeMs);

        recordToolUsage('analyze_page');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  url,
                  final_url: result.finalUrl,
                  redirected: result.redirected,
                  status: result.status,
                  score: analysis.score,
                  issues: analysis.issues,
                  suggestions: analysis.suggestions,
                  metadata: analysis.metadata,
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
              text: JSON.stringify({ error: `Failed to analyze page: ${message}`, url }, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
