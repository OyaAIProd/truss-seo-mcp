#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Tool registrations
import { registerAnalyzePage } from './tools/analyze-page.js';
import { registerCheckKeywords } from './tools/check-keywords.js';
import { registerGenerateMeta } from './tools/generate-meta.js';
import { registerKeywordResearch } from './tools/keyword-research.js';
import { registerCompetitorAnalysis } from './tools/competitor-analysis.js';
import { registerContentBrief } from './tools/content-brief.js';
import { registerAuditSite } from './tools/audit-site.js';
import { registerSchemaMarkup } from './tools/schema-markup.js';
import { registerSerpPreview } from './tools/serp-preview.js';
import { registerInternalLinks } from './tools/internal-links.js';

// Lib
import { getLicenseStatus } from './lib/license.js';
import { checkUsageQuota, closeDb } from './lib/usage.js';
import { hasAiKey } from './lib/config.js';

const server = new McpServer({
  name: 'truss-seo-mcp',
  version: '1.0.0',
});

// ── Status Tool ─────────────────────────────────────────────────────

server.tool(
  'seo_status',
  'Check SEO MCP server status, license tier, usage quota, and available features.',
  {},
  async () => {
    const license = await getLicenseStatus();
    const quota = await checkUsageQuota();
    const aiAvailable = hasAiKey();

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              server: 'truss-seo-mcp',
              version: '1.0.0',
              license: {
                tier: license.tier,
                valid: license.valid,
                expires_at: license.expiresAt,
              },
              usage: {
                tier: quota.tier,
                remaining_today: quota.remaining === Infinity ? 'unlimited' : quota.remaining,
                daily_limit: quota.limit === Infinity ? 'unlimited' : quota.limit,
              },
              ai_features: {
                available: aiAvailable,
                note: aiAvailable
                  ? 'AI-enhanced content briefs and competitor analysis enabled'
                  : 'Set ANTHROPIC_API_KEY or OPENAI_API_KEY for AI-enhanced features',
              },
              free_tools: ['analyze_page', 'check_keywords', 'generate_meta'],
              pro_tools: [
                'keyword_research',
                'competitor_analysis',
                'content_brief',
                'audit_site',
                'schema_markup',
                'serp_preview',
                'internal_links',
              ],
              ...(license.tier === 'free'
                ? {
                    upgrade: {
                      url: 'https://truss.dev/seo',
                      price: '$29/mo',
                      features: [
                        'Unlimited queries (free tier: 3/day)',
                        'Keyword research with Google Suggest',
                        'Competitor SEO analysis',
                        'AI-powered content briefs',
                        'Full site audits (up to 50 pages)',
                        'JSON-LD schema markup generation',
                        'SERP preview (desktop + mobile)',
                        'Internal link analysis',
                      ],
                    },
                  }
                : {}),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ── Register All Tools ──────────────────────────────────────────────

// Free tier (3 queries/day)
registerAnalyzePage(server);
registerCheckKeywords(server);
registerGenerateMeta(server);

// Pro tier ($29/mo)
registerKeywordResearch(server);
registerCompetitorAnalysis(server);
registerContentBrief(server);
registerAuditSite(server);
registerSchemaMarkup(server);
registerSerpPreview(server);
registerInternalLinks(server);

// ── Start Server ────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Cleanup on exit
  process.on('SIGINT', () => {
    closeDb();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    closeDb();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start SEO MCP server:', err);
  process.exit(1);
});
