# truss-seo-mcp

**SEO Command Center for AI agents.** Keyword research, site audits, content optimization, schema markup, SERP previews, and competitor analysis — all from your AI agent.

This MCP server gives Claude Code (or any MCP-compatible agent) full SEO analysis capabilities. No external API keys needed for basic analysis — page scoring, keyword density, and meta tag generation all run locally. Add an AI key for enhanced content briefs and competitor strategy insights.

## Installation

```bash
npm install -g truss-seo-mcp
```

## Claude Code Configuration

Add to your `~/.claude/settings.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "seo": {
      "command": "truss-seo",
      "env": {
        "TRUSS_LICENSE_KEY": "truss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "ANTHROPIC_API_KEY": "sk-ant-xxx (optional, for AI features)",
        "OPENAI_API_KEY": "sk-xxx (optional, for AI features)"
      }
    }
  }
}
```

## Tools

### Free Tier (3 queries/day)

| Tool | Description |
|------|-------------|
| `seo_status` | Check server status, license, and available features |
| `analyze_page` | Analyze on-page SEO for any URL (score 0-100, issues, suggestions) |
| `check_keywords` | Analyze text for keyword density and readability |
| `generate_meta` | Generate SEO-optimized title, meta description, and OG tags |

### Pro Tier ($29/mo)

| Tool | Description |
|------|-------------|
| `keyword_research` | Find related keywords with volume estimates and competition |
| `competitor_analysis` | Analyze competitor URL for SEO strategy and gaps |
| `content_brief` | Generate a content brief with outline, keywords, and questions |
| `audit_site` | Crawl up to 50 pages and generate a full SEO audit |
| `schema_markup` | Generate JSON-LD structured data (Article, Product, FAQ, HowTo, Recipe, Event) |
| `serp_preview` | Preview desktop and mobile search result appearance |
| `internal_links` | Analyze internal linking structure, find orphan pages |

## Examples

### Analyze a page

```
> analyze_page url:"https://example.com/blog/seo-guide"

Score: 78/100
Issues:
  - [warning] Meta description too long (172 chars)
  - [warning] 3 images missing alt text
Suggestions:
  - Add H2 subheadings for better structure
  - Add JSON-LD structured data
```

### Check keyword density

```
> check_keywords text:"Your article content..." target_keywords:["SEO", "marketing"]

Keyword density:
  SEO: 2.1% (15 occurrences, in title: yes, in H1: yes)
  marketing: 0.8% (6 occurrences, in title: no, in H1: no)
Readability: 65 (8th-9th grade)
```

### Generate meta tags

```
> generate_meta content:"Your page content..." target_keyword:"seo tools"

Title: "SEO Tools: Complete Guide to Search Optimization"
Meta Description: "Discover the best SEO tools for keyword research, site audits, and content optimization. Compare features, pricing, and reviews."
```

### Research keywords

```
> keyword_research seed_keyword:"email marketing" count:10

Results:
  1. email marketing software (high volume, high competition, difficulty: 90)
  2. email marketing best practices (medium volume, medium competition, difficulty: 55)
  3. email marketing examples (medium volume, low competition, difficulty: 25)
  ...
```

### Audit a site

```
> audit_site url:"https://example.com" max_pages:20

Pages crawled: 18
Health Score: 72/100
Critical: 2 (missing titles)
Warnings: 8 (duplicate titles, missing meta, slow pages)
Broken links: 3
Sitemap: found (45 entries)
```

## AI Features

When you provide `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, these tools get enhanced:

- **content_brief**: AI generates detailed outlines, competitor gap analysis, and LSI keyword suggestions
- **competitor_analysis**: AI provides strategic insights on how to outrank competitors

Without an AI key, these tools use rule-based analysis that still provides solid, actionable recommendations.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TRUSS_LICENSE_KEY` | No | License key for Pro features |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for AI-enhanced features |
| `OPENAI_API_KEY` | No | OpenAI API key for AI-enhanced features (fallback) |

## Data Storage

Local data is stored at `~/.truss/seo/`:
- `seo-usage.db` — SQLite database tracking daily usage
- `license-cache.json` — Cached license validation (refreshes weekly)

## How It Works

- **Page analysis**: Fetches HTML and parses with regex for SEO elements (title, meta, headings, images, links, schema)
- **Keyword research**: Uses Google Suggest API (free, no key) for real autocomplete data, then estimates volume from position
- **Site audit**: Recursive crawler that follows internal links up to max_pages, checking each for SEO issues
- **Schema markup**: Generates valid JSON-LD from page content, with placeholders for custom data

## Pricing

| | Free | Pro ($29/mo) |
|---|---|---|
| Queries per day | 3 | Unlimited |
| Page analysis | Yes | Yes |
| Keyword check | Yes | Yes |
| Meta generation | Yes | Yes |
| Keyword research | - | Yes |
| Competitor analysis | - | Yes |
| Content briefs | - | Yes |
| Site audits | - | Yes |
| Schema markup | - | Yes |
| SERP preview | - | Yes |
| Internal links | - | Yes |

Subscribe at [truss.dev/seo](https://truss.dev/seo)

## License

MIT
