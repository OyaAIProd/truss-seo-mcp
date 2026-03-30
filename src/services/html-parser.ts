/**
 * Regex-based HTML parser for SEO analysis.
 * No external dependencies — uses regex patterns to extract SEO-relevant data.
 */

export interface ParsedPage {
  title: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  canonical: string | null;
  robots: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  images: Array<{ src: string; alt: string | null }>;
  links: Array<{ href: string; text: string; rel: string | null }>;
  wordCount: number;
  paragraphCount: number;
  schemaMarkup: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogType: string | null;
  twitterCard: string | null;
  lang: string | null;
  charset: string | null;
  viewport: string | null;
  rawText: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(html: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

function extractAllTags(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text) results.push(text);
  }
  return results;
}

function extractMetaContent(html: string, nameOrProperty: string): string | null {
  // Try name attribute
  const nameRegex = new RegExp(
    `<meta[^>]*name=["']${nameOrProperty}["'][^>]*content=["']([^"']*)["'][^>]*/?>`,
    'i',
  );
  let match = html.match(nameRegex);
  if (match) return match[1];

  // Try content before name
  const nameRegex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${nameOrProperty}["'][^>]*/?>`,
    'i',
  );
  match = html.match(nameRegex2);
  if (match) return match[1];

  // Try property attribute (for OG tags)
  const propRegex = new RegExp(
    `<meta[^>]*property=["']${nameOrProperty}["'][^>]*content=["']([^"']*)["'][^>]*/?>`,
    'i',
  );
  match = html.match(propRegex);
  if (match) return match[1];

  // Try content before property
  const propRegex2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${nameOrProperty}["'][^>]*/?>`,
    'i',
  );
  match = html.match(propRegex2);
  if (match) return match[1];

  return null;
}

function extractImages(html: string): Array<{ src: string; alt: string | null }> {
  const regex = /<img[^>]+>/gi;
  const results: Array<{ src: string; alt: string | null }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    const altMatch = tag.match(/alt=["']([^"']*)["']/i);

    if (srcMatch) {
      results.push({
        src: srcMatch[1],
        alt: altMatch ? altMatch[1] : null,
      });
    }
  }

  return results;
}

function extractLinks(html: string): Array<{ href: string; text: string; rel: string | null }> {
  const regex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results: Array<{ href: string; text: string; rel: string | null }> = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const fullTag = match[0];
    const relMatch = fullTag.match(/rel=["']([^"']*)["']/i);

    results.push({
      href: match[1],
      text: stripTags(match[2]).trim(),
      rel: relMatch ? relMatch[1] : null,
    });
  }

  return results;
}

function extractSchemaMarkup(html: string): string[] {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const results: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    results.push(match[1].trim());
  }

  return results;
}

function extractCanonical(html: string): string | null {
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (match) return match[1];

  const match2 = html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*\/?>/i);
  return match2 ? match2[1] : null;
}

function extractCharset(html: string): string | null {
  const match = html.match(/<meta[^>]*charset=["']([^"']+)["'][^>]*\/?>/i);
  return match ? match[1] : null;
}

function extractLang(html: string): string | null {
  const match = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function countParagraphs(html: string): number {
  const matches = html.match(/<p[\s>]/gi);
  return matches ? matches.length : 0;
}

export function parseHtml(html: string): ParsedPage {
  const rawText = stripTags(html);
  const words = rawText.split(/\s+/).filter((w) => w.length > 0);

  return {
    title: extractTag(html, 'title'),
    metaDescription: extractMetaContent(html, 'description'),
    metaKeywords: extractMetaContent(html, 'keywords'),
    canonical: extractCanonical(html),
    robots: extractMetaContent(html, 'robots'),
    h1: extractAllTags(html, 'h1'),
    h2: extractAllTags(html, 'h2'),
    h3: extractAllTags(html, 'h3'),
    images: extractImages(html),
    links: extractLinks(html),
    wordCount: words.length,
    paragraphCount: countParagraphs(html),
    schemaMarkup: extractSchemaMarkup(html),
    ogTitle: extractMetaContent(html, 'og:title'),
    ogDescription: extractMetaContent(html, 'og:description'),
    ogImage: extractMetaContent(html, 'og:image'),
    ogType: extractMetaContent(html, 'og:type'),
    twitterCard: extractMetaContent(html, 'twitter:card'),
    lang: extractLang(html),
    charset: extractCharset(html),
    viewport: extractMetaContent(html, 'viewport'),
    rawText,
  };
}

/**
 * Classify a link as internal or external relative to a base URL.
 */
export function classifyLink(href: string, baseUrl: string): 'internal' | 'external' | 'other' {
  try {
    // Skip non-http links
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:') || href.startsWith('#')) {
      return 'other';
    }

    const base = new URL(baseUrl);
    const resolved = new URL(href, baseUrl);

    if (resolved.hostname === base.hostname) {
      return 'internal';
    }
    return 'external';
  } catch {
    return 'other';
  }
}
