import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { crawlSite } from '../services/crawler.js';
import { fetchPageSafe } from '../services/fetcher.js';
import { recordToolUsage } from '../lib/usage.js';
import { requirePro } from '../lib/license.js';
import type { SeoIssue } from '../types.js';

export function registerAuditSite(server: McpServer): void {
  server.tool(
    'audit_site',
    'Crawl a site (up to 50 pages) and generate a comprehensive SEO audit — duplicate titles, missing meta, broken links, sitemap status, robots.txt analysis. PRO feature ($29/mo).',
    {
      url: z.string().url().describe('Root URL of the site to audit (e.g., https://example.com)'),
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

        const issues: { critical: SeoIssue[]; warning: SeoIssue[]; info: SeoIssue[] } = {
          critical: [],
          warning: [],
          info: [],
        };

        // Track duplicates
        const titleMap: Record<string, string[]> = {};
        const missingMeta: string[] = [];
        const allBrokenLinks: Array<{ url: string; status: number; found_on: string }> = [];
        let pagesWithIssues = 0;

        for (const page of crawlResult.pages) {
          let pageHasIssue = false;

          // Title checks
          const title = page.parsed.title;
          if (!title) {
            issues.critical.push({
              severity: 'critical',
              category: 'title',
              message: `Missing title: ${page.url}`,
            });
            pageHasIssue = true;
          } else {
            if (!titleMap[title]) titleMap[title] = [];
            titleMap[title].push(page.url);

            if (title.length > 60) {
              issues.warning.push({
                severity: 'warning',
                category: 'title',
                message: `Title too long (${title.length} chars): ${page.url}`,
                element: title,
              });
              pageHasIssue = true;
            }
          }

          // Meta description checks
          if (!page.parsed.metaDescription) {
            missingMeta.push(page.url);
            issues.warning.push({
              severity: 'warning',
              category: 'meta_description',
              message: `Missing meta description: ${page.url}`,
            });
            pageHasIssue = true;
          }

          // H1 checks
          if (page.parsed.h1.length === 0) {
            issues.warning.push({
              severity: 'warning',
              category: 'headings',
              message: `Missing H1: ${page.url}`,
            });
            pageHasIssue = true;
          } else if (page.parsed.h1.length > 1) {
            issues.info.push({
              severity: 'info',
              category: 'headings',
              message: `Multiple H1 tags (${page.parsed.h1.length}): ${page.url}`,
            });
          }

          // Image alt checks
          const noAlt = page.parsed.images.filter((i) => !i.alt || i.alt.trim() === '');
          if (noAlt.length > 0) {
            issues.warning.push({
              severity: 'warning',
              category: 'images',
              message: `${noAlt.length} images missing alt text: ${page.url}`,
            });
            pageHasIssue = true;
          }

          // Performance
          if (page.loadTimeMs > 3000) {
            issues.warning.push({
              severity: 'warning',
              category: 'performance',
              message: `Slow page (${(page.loadTimeMs / 1000).toFixed(1)}s): ${page.url}`,
            });
            pageHasIssue = true;
          }

          // Broken links
          for (const broken of page.brokenLinks) {
            allBrokenLinks.push({ url: broken.url, status: broken.status, found_on: page.url });
          }
          if (page.brokenLinks.length > 0) pageHasIssue = true;

          if (pageHasIssue) pagesWithIssues++;
        }

        // Find duplicate titles
        const duplicateTitles = Object.entries(titleMap)
          .filter(([, urls]) => urls.length > 1)
          .map(([title, urls]) => ({ title, urls }));

        for (const dup of duplicateTitles) {
          issues.warning.push({
            severity: 'warning',
            category: 'duplicate_title',
            message: `Duplicate title "${dup.title}" found on ${dup.urls.length} pages`,
          });
        }

        // Check sitemap
        let sitemapStatus = { found: false, url: null as string | null, entries: 0 };
        try {
          const baseUrl = new URL(url);
          const sitemapUrl = `${baseUrl.origin}/sitemap.xml`;
          const sitemapResult = await fetchPageSafe(sitemapUrl);

          if ('html' in sitemapResult && sitemapResult.status === 200) {
            const locMatches = sitemapResult.html.match(/<loc>/gi);
            sitemapStatus = {
              found: true,
              url: sitemapUrl,
              entries: locMatches ? locMatches.length : 0,
            };
          }
        } catch {
          // Non-fatal
        }

        // Check robots.txt
        let robotsTxt = { found: false, allows_crawling: true };
        try {
          const baseUrl = new URL(url);
          const robotsUrl = `${baseUrl.origin}/robots.txt`;
          const robotsResult = await fetchPageSafe(robotsUrl);

          if ('html' in robotsResult && robotsResult.status === 200) {
            const content = robotsResult.html.toLowerCase();
            robotsTxt = {
              found: true,
              allows_crawling: !content.includes('disallow: /'),
            };

            if (content.includes('disallow: /')) {
              issues.info.push({
                severity: 'info',
                category: 'robots',
                message: 'robots.txt contains Disallow directives — verify they are intentional',
              });
            }
          }
        } catch {
          // Non-fatal
        }

        // Calculate health score
        const totalIssues = issues.critical.length + issues.warning.length + issues.info.length;
        const healthScore = Math.max(
          0,
          Math.min(
            100,
            100 -
              issues.critical.length * 15 -
              issues.warning.length * 5 -
              issues.info.length * 1,
          ),
        );

        recordToolUsage('audit_site');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  url,
                  pages_crawled: crawlResult.pages.length,
                  crawl_errors: crawlResult.errors,
                  issues_by_severity: issues,
                  duplicate_titles: duplicateTitles,
                  missing_meta: missingMeta,
                  broken_links: allBrokenLinks,
                  sitemap_status: sitemapStatus,
                  robots_txt: robotsTxt,
                  summary: {
                    health_score: healthScore,
                    total_issues: totalIssues,
                    pages_with_issues: pagesWithIssues,
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
              text: JSON.stringify({ error: `Site audit failed: ${message}`, url }, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
