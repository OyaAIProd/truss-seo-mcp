import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { recordToolUsage } from '../lib/usage.js';

// Google SERP character limits
const TITLE_MAX_CHARS = 60;
const TITLE_MAX_PX = 580;
const DESC_MAX_CHARS_DESKTOP = 160;
const DESC_MAX_CHARS_MOBILE = 120;

/**
 * Estimate pixel width of text (rough approximation).
 * Average character width in Google SERPs is ~7-8px for the title.
 */
function estimatePixelWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    if (/[A-Z]/.test(char)) width += 9;
    else if (/[a-z]/.test(char)) width += 7;
    else if (/[0-9]/.test(char)) width += 7;
    else if (char === ' ') width += 3.5;
    else if (/[.,:;!?]/.test(char)) width += 4;
    else if (/[-_/\\|]/.test(char)) width += 5;
    else width += 7;
  }
  return Math.round(width);
}

/**
 * Truncate text to simulate Google's display.
 */
function truncateForDisplay(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + '...';
}

/**
 * Format URL for display (breadcrumb style).
 */
function formatUrlForSerp(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    const parts = path.split('/').filter(Boolean);

    if (parts.length === 0) return parsed.hostname;

    const breadcrumbs = parts.map((part) =>
      part
        .replace(/-/g, ' ')
        .replace(/\.\w+$/, '')
        .substring(0, 30),
    );

    return `${parsed.hostname} > ${breadcrumbs.join(' > ')}`;
  } catch {
    return url;
  }
}

/**
 * Generate an ASCII art SERP preview.
 */
function generateDesktopPreview(
  title: string,
  description: string,
  url: string,
): string {
  const displayTitle = truncateForDisplay(title, TITLE_MAX_CHARS);
  const displayDesc = truncateForDisplay(description, DESC_MAX_CHARS_DESKTOP);
  const displayUrl = formatUrlForSerp(url);

  return [
    '┌─────────────────────────────────────────────────────────────┐',
    `│ ${displayTitle.padEnd(60).substring(0, 60)}│`,
    `│ ${displayUrl.padEnd(60).substring(0, 60)}│`,
    `│ ${displayDesc.substring(0, 60).padEnd(60)}│`,
    `│ ${(displayDesc.length > 60 ? displayDesc.substring(60, 120) : '').padEnd(60)}│`,
    `│ ${(displayDesc.length > 120 ? displayDesc.substring(120, 160) : '').padEnd(60)}│`,
    '└─────────────────────────────────────────────────────────────┘',
  ].join('\n');
}

function generateMobilePreview(
  title: string,
  description: string,
  url: string,
): string {
  const displayTitle = truncateForDisplay(title, TITLE_MAX_CHARS);
  const displayDesc = truncateForDisplay(description, DESC_MAX_CHARS_MOBILE);
  const displayUrl = formatUrlForSerp(url);

  return [
    '┌────────────────────────────────────┐',
    `│ ${displayTitle.substring(0, 35).padEnd(35)}│`,
    `│ ${(displayTitle.length > 35 ? displayTitle.substring(35, 60) : '').padEnd(35)}│`,
    `│ ${displayUrl.substring(0, 35).padEnd(35)}│`,
    `│ ${displayDesc.substring(0, 35).padEnd(35)}│`,
    `│ ${(displayDesc.length > 35 ? displayDesc.substring(35, 70) : '').padEnd(35)}│`,
    `│ ${(displayDesc.length > 70 ? displayDesc.substring(70, 105) : '').padEnd(35)}│`,
    `│ ${(displayDesc.length > 105 ? displayDesc.substring(105, 120) : '').padEnd(35)}│`,
    '└────────────────────────────────────┘',
  ].join('\n');
}

export function registerSerpPreview(server: McpServer): void {
  server.tool(
    'serp_preview',
    'Preview how a page will appear in Google search results — both desktop and mobile. Checks for truncation, character counts, and pixel width estimates. PRO feature ($29/mo).',
    {
      title: z.string().describe('Page title tag'),
      description: z.string().describe('Meta description'),
      url: z.string().url().describe('Page URL'),
    },
    async ({ title, description, url }) => {
      try {
        // NOTE: serp_preview is a Pro feature but we allow it so people see
        // the value. The quota check handles gating.

        const warnings: string[] = [];

        // Title checks
        if (title.length > TITLE_MAX_CHARS) {
          warnings.push(
            `Title will be truncated (${title.length}/${TITLE_MAX_CHARS} chars). Google cuts at ~${TITLE_MAX_CHARS} characters.`,
          );
        }

        const titlePx = estimatePixelWidth(title);
        if (titlePx > TITLE_MAX_PX) {
          warnings.push(
            `Title may be truncated by pixel width (~${titlePx}px, max ~${TITLE_MAX_PX}px).`,
          );
        }

        if (title.length < 30) {
          warnings.push('Title is very short. Aim for 50-60 characters to maximize SERP real estate.');
        }

        // Description checks
        if (description.length > DESC_MAX_CHARS_DESKTOP) {
          warnings.push(
            `Description will be truncated on desktop (${description.length}/${DESC_MAX_CHARS_DESKTOP} chars).`,
          );
        }

        if (description.length > DESC_MAX_CHARS_MOBILE) {
          warnings.push(
            `Description will be truncated on mobile (${description.length}/${DESC_MAX_CHARS_MOBILE} chars).`,
          );
        }

        if (description.length < 100) {
          warnings.push(
            'Description is short. Aim for 150-160 characters to maximize click-through rate.',
          );
        }

        // Call to action check
        const ctaWords = ['learn', 'discover', 'get', 'find', 'try', 'start', 'read', 'see', 'explore'];
        const hasCallToAction = ctaWords.some((w) => description.toLowerCase().includes(w));
        if (!hasCallToAction) {
          warnings.push('Consider adding a call-to-action in the description to improve CTR.');
        }

        const desktopPreview = generateDesktopPreview(title, description, url);
        const mobilePreview = generateMobilePreview(title, description, url);

        recordToolUsage('serp_preview');

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  desktop_preview: desktopPreview,
                  mobile_preview: mobilePreview,
                  truncation_warnings: warnings,
                  character_counts: {
                    title: title.length,
                    title_max: TITLE_MAX_CHARS,
                    description: description.length,
                    description_max_desktop: DESC_MAX_CHARS_DESKTOP,
                    description_max_mobile: DESC_MAX_CHARS_MOBILE,
                    url: url.length,
                  },
                  pixel_widths: {
                    title_estimated_px: titlePx,
                    title_max_px: TITLE_MAX_PX,
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
              text: JSON.stringify({ error: `SERP preview failed: ${message}` }, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
