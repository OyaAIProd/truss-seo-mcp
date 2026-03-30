// ── SEO Analysis Types ──────────────────────────────────────────────

export interface SeoIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  element?: string;
}

export interface SeoSuggestion {
  priority: 'high' | 'medium' | 'low';
  category: string;
  message: string;
}

export interface PageMetadata {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  canonical: string | null;
  robots: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  wordCount: number;
  paragraphCount: number;
  imageCount: number;
  imagesWithAlt: number;
  imagesWithoutAlt: string[];
  internalLinks: number;
  externalLinks: number;
  hasSchemaMarkup: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  loadTimeMs: number;
}

export interface PageAnalysisResult {
  url: string;
  score: number;
  issues: SeoIssue[];
  suggestions: SeoSuggestion[];
  metadata: PageMetadata;
}

// ── Keyword Types ───────────────────────────────────────────────────

export interface KeywordDensityEntry {
  keyword: string;
  count: number;
  density: number;
  inTitle: boolean;
  inH1: boolean;
  inMetaDescription: boolean;
}

export interface KeywordCheckResult {
  keyword_density: Record<string, KeywordDensityEntry>;
  total_words: number;
  readability_score: number;
  grade_level: string;
  suggestions: string[];
}

export interface KeywordResearchEntry {
  keyword: string;
  estimated_volume: 'high' | 'medium' | 'low' | 'very_low';
  competition: 'high' | 'medium' | 'low';
  difficulty: number;
  cpc_estimate: string;
  source: string;
}

// ── Meta Generation Types ───────────────────────────────────────────

export interface MetaGenerationResult {
  title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
  character_counts: {
    title: number;
    meta_description: number;
    og_title: number;
    og_description: number;
  };
  warnings: string[];
}

// ── Competitor Types ────────────────────────────────────────────────

export interface CompetitorAnalysisResult {
  url: string;
  domain_info: {
    domain: string;
    protocol: string;
    path: string;
  };
  page_seo: PageMetadata;
  content_strategy: {
    word_count: number;
    heading_structure: string[];
    content_topics: string[];
    content_type: string;
  };
  technical_seo: {
    has_ssl: boolean;
    has_canonical: boolean;
    has_schema: boolean;
    has_og_tags: boolean;
    has_robots: boolean;
  };
  gaps: string[];
  ai_analysis?: string;
}

// ── Content Brief Types ─────────────────────────────────────────────

export interface ContentBriefResult {
  keyword: string;
  content_type: string;
  outline: ContentSection[];
  target_word_count: number;
  related_keywords: string[];
  questions_to_answer: string[];
  competitor_gaps: string[];
  ai_enhanced: boolean;
}

export interface ContentSection {
  heading: string;
  level: number;
  talking_points: string[];
}

// ── Site Audit Types ────────────────────────────────────────────────

export interface SiteAuditResult {
  url: string;
  pages_crawled: number;
  issues_by_severity: {
    critical: SeoIssue[];
    warning: SeoIssue[];
    info: SeoIssue[];
  };
  duplicate_titles: Array<{ title: string; urls: string[] }>;
  missing_meta: string[];
  broken_links: Array<{ url: string; status: number; found_on: string }>;
  sitemap_status: {
    found: boolean;
    url: string | null;
    entries: number;
  };
  robots_txt: {
    found: boolean;
    allows_crawling: boolean;
  };
  summary: {
    health_score: number;
    total_issues: number;
    pages_with_issues: number;
  };
}

// ── Schema Markup Types ─────────────────────────────────────────────

export type SchemaType = 'article' | 'product' | 'faq' | 'howto' | 'recipe' | 'event';

export interface SchemaMarkupResult {
  type: SchemaType;
  json_ld: object;
  html_snippet: string;
  validation_notes: string[];
}

// ── SERP Preview Types ──────────────────────────────────────────────

export interface SerpPreviewResult {
  desktop_preview: string;
  mobile_preview: string;
  truncation_warnings: string[];
  character_counts: {
    title: number;
    title_max: number;
    description: number;
    description_max: number;
    url: number;
  };
  pixel_widths: {
    title_estimated_px: number;
    title_max_px: number;
  };
}

// ── Internal Links Types ────────────────────────────────────────────

export interface InternalLinksResult {
  url: string;
  pages_crawled: number;
  orphan_pages: string[];
  hub_pages: Array<{ url: string; outgoing_links: number }>;
  link_depth_map: Record<string, number>;
  suggestions: string[];
  link_graph_summary: {
    total_internal_links: number;
    avg_links_per_page: number;
    max_depth: number;
  };
}

// ── License Types ───────────────────────────────────────────────────

export type LicenseTier = 'free' | 'pro';

export interface LicenseStatus {
  tier: LicenseTier;
  valid: boolean;
  expiresAt: string | null;
}
