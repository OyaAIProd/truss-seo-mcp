import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { crawlSite } from '../services/crawler.js';
import { recordToolUsage } from '../lib/usage.js';
import { requirePro } from '../lib/license.js';

export function registerInternalLinks(server: McpServer): void {
  server.tool(
    'internal_links',
    'Analyze internal linking structure — find orphan pages, hub pages, link depth, and suggest improvements. PRO feature ($29/mo).',
    {
      url: z.string().url().describe('Root URL of the site to analyze'),
      max_pages: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum pages to crawl (default: 20, max: 50)'),
    },
    async ({ url, max_pages }) => {
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
        const maxPagesClamped = Math.min(max_pages ?? 20, 50);
        const crawlResult = await crawlSite(url, maxPagesClamped);

        // Build link graph
        const incomingLinks: Record<string, Set<string>> = {};
        const outgoingLinks: Record<string, Set<string>> = {};

        // Initialize all crawled pages
        for (const page of crawlResult.pages) {
          if (!incomingLinks[page.url]) incomingLinks[page.url] = new Set();
          if (!outgoingLinks[page.url]) outgoingLinks[page.url] = new Set();
        }

        // Build graph
        for (const page of crawlResult.pages) {
          for (const link of page.internalLinks) {
            outgoingLinks[page.url].add(link);
            if (!incomingLinks[link]) incomingLinks[link] = new Set();
            incomingLinks[link].add(page.url);
          }
        }

        // Find orphan pages (no incoming links except self)
        const crawledUrls = new Set(crawlResult.pages.map((p) => p.url));
        const orphanPages: string[] = [];

        for (const page of crawlResult.pages) {
          const incoming = incomingLinks[page.url] || new Set();
          // Filter out self-links
          const externalIncoming = [...incoming].filter((u) => u !== page.url);
          if (externalIncoming.length === 0 && page.url !== url) {
            orphanPages.push(page.url);
          }
        }

        // Find hub pages (most outgoing links)
        const hubPages = crawlResult.pages
          .map((page) => ({
            url: page.url,
            outgoing_links: page.internalLinks.length,
          }))
          .sort((a, b) => b.outgoing_links - a.outgoing_links)
          .slice(0, 10);

        // Calculate link depth (BFS from root)
        const linkDepthMap: Record<string, number> = {};
        const visited = new Set<string>();
        const queue: Array<{ url: string; depth: number }> = [{ url, depth: 0 }];

        while (queue.length > 0) {
          const current = queue.shift()!;

          // Normalize URL for matching
          const normalizedCurrent = current.url;
          if (visited.has(normalizedCurrent)) continue;
          visited.add(normalizedCurrent);
          linkDepthMap[normalizedCurrent] = current.depth;

          const page = crawlResult.pages.find((p) => p.url === normalizedCurrent);
          if (page) {
            for (const link of page.internalLinks) {
              if (!visited.has(link)) {
                queue.push({ url: link, depth: current.depth + 1 });
              }
            }
          }
        }

        // Calculate stats
        const totalInternalLinks = crawlResult.pages.reduce(
          (sum, page) => sum + page.internalLinks.length,
          0,
        );
        const avgLinksPerPage =
          crawlResult.pages.length > 0
            ? Math.round(totalInternalLinks / crawlResult.pages.length)
            : 0;
        const maxDepth =
          Object.values(linkDepthMap).length > 0
            ? Math.max(...Object.values(linkDepthMap))
            : 0;

        // Generate suggestions
        const suggestions: string[] = [];

        if (orphanPages.length > 0) {
          suggestions.push(
            `${orphanPages.length} orphan page(s) found with no incoming internal links. Add links from relevant pages.`,
          );
        }

        if (maxDepth > 3) {
          const deepPages = Object.entries(linkDepthMap)
            .filter(([, depth]) => depth > 3)
            .map(([pageUrl]) => pageUrl);
          suggestions.push(
            `${deepPages.length} page(s) are more than 3 clicks from the homepage. Move important pages closer to root.`,
          );
        }

        if (avgLinksPerPage < 3) {
          suggestions.push(
            `Average of only ${avgLinksPerPage} internal links per page. Aim for 3-5+ internal links per page.`,
          );
        }

        if (hubPages.length > 0 && hubPages[0].outgoing_links > 100) {
          suggestions.push(
            `${hubPages[0].url} has ${hubPages[0].outgoing_links} outgoing links. Consider reducing to keep link equity focused.`,
          );
        }

        // Suggest linking between topically related pages
        suggestions.push(
          'Review hub pages and ensure they link to the most important content.',
        );
        suggestions.push(
          'Add contextual internal links within body content (not just navigation).',
        );

        recordToolUsage('internal_links');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  url,
                  pages_crawled: crawlResult.pages.length,
                  orphan_pages: orphanPages,
                  hub_pages: hubPages,
                  link_depth_map: linkDepthMap,
                  suggestions,
                  link_graph_summary: {
                    total_internal_links: totalInternalLinks,
                    avg_links_per_page: avgLinksPerPage,
                    max_depth: maxDepth,
                  },
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
                { error: `Internal link analysis failed: ${message}`, url },
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
