import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { researchKeyword } from '../services/keyword-suggest.js';
import { recordToolUsage } from '../lib/usage.js';
import { requirePro } from '../lib/license.js';

export function registerKeywordResearch(server: McpServer): void {
  server.tool(
    'keyword_research',
    'Research related keywords, estimate search volume, competition, and difficulty for a seed keyword. Uses Google Suggest API for real suggestion data. PRO feature ($29/mo).',
    {
      seed_keyword: z.string().min(1).describe('The seed keyword to research'),
      count: z
        .number()
        .int()
        .min(5)
        .max(100)
        .optional()
        .describe('Number of keyword suggestions to return (default: 20, max: 100)'),
    },
    async ({ seed_keyword, count }) => {
      try {
        await requirePro();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: message,
                  upgrade_url: 'https://truss.dev/seo',
                  price: '$29/mo',
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      try {
        const results = await researchKeyword(seed_keyword, count ?? 20);

        recordToolUsage('keyword_research');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  seed_keyword,
                  total_results: results.length,
                  keywords: results,
                  methodology:
                    'Volume estimates based on Google Suggest position and modifier analysis. Competition classified by commercial intent signals.',
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
              text: JSON.stringify(
                { error: `Keyword research failed: ${message}`, seed_keyword },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
