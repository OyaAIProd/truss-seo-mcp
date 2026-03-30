/**
 * Simple recursive crawler for site audits and internal link analysis.
 * Respects max page limits and stays within the same domain.
 */

import { fetchPage, checkUrl } from './fetcher.js';
import { parseHtml, classifyLink, type ParsedPage } from './html-parser.js';

export interface CrawledPage {
  url: string;
  status: number;
  parsed: ParsedPage;
  loadTimeMs: number;
  internalLinks: string[];
  externalLinks: string[];
  brokenLinks: Array<{ url: string; status: number }>;
}

export interface CrawlResult {
  pages: CrawledPage[];
  errors: Array<{ url: string; error: string }>;
}

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(href, baseUrl);
    // Remove hash and trailing slash for dedup
    resolved.hash = '';
    let normalized = resolved.toString();
    if (normalized.endsWith('/') && normalized.split('/').length > 4) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}

function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).hostname === new URL(baseUrl).hostname;
  } catch {
    return false;
  }
}

function shouldSkipUrl(url: string): boolean {
  const skipExtensions = [
    '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
    '.css', '.js', '.zip', '.tar', '.gz', '.mp4', '.mp3',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.ico', '.woff', '.woff2', '.ttf', '.eot',
  ];

  const lowerUrl = url.toLowerCase();
  return skipExtensions.some((ext) => lowerUrl.endsWith(ext));
}

export async function crawlSite(
  startUrl: string,
  maxPages: number = 50,
): Promise<CrawlResult> {
  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  const pages: CrawledPage[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!;

    // Normalize for dedup
    const normalized = normalizeUrl(url, startUrl);
    if (!normalized || visited.has(normalized)) continue;
    visited.add(normalized);

    // Skip non-HTML resources
    if (shouldSkipUrl(normalized)) continue;

    try {
      const result = await fetchPage(normalized);
      const parsed = parseHtml(result.html);

      const internalLinks: string[] = [];
      const externalLinks: string[] = [];

      for (const link of parsed.links) {
        const classification = classifyLink(link.href, normalized);
        if (classification === 'internal') {
          const resolvedLink = normalizeUrl(link.href, normalized);
          if (resolvedLink && isSameDomain(resolvedLink, startUrl)) {
            internalLinks.push(resolvedLink);
            // Add to crawl queue if not visited
            if (!visited.has(resolvedLink) && !shouldSkipUrl(resolvedLink)) {
              queue.push(resolvedLink);
            }
          }
        } else if (classification === 'external') {
          externalLinks.push(link.href);
        }
      }

      // Check for broken links (sample up to 10 external links per page)
      const brokenLinks: Array<{ url: string; status: number }> = [];
      const linksToCheck = externalLinks.slice(0, 10);

      for (const linkUrl of linksToCheck) {
        const check = await checkUrl(linkUrl);
        if (!check.ok) {
          brokenLinks.push({ url: linkUrl, status: check.status });
        }
      }

      pages.push({
        url: normalized,
        status: result.status,
        parsed,
        loadTimeMs: result.loadTimeMs,
        internalLinks: [...new Set(internalLinks)],
        externalLinks: [...new Set(externalLinks)],
        brokenLinks,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ url: normalized, error: message });
    }
  }

  return { pages, errors };
}
