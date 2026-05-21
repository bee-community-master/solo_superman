/// <reference lib="dom" />

import { isIP } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  assertResearchRunStatusTransition,
  validateResearchRunProjection,
  type PublicSafeResearchDisclosurePayload,
  type ResearchRunProjection
} from "@solo-superman/contracts";
import type {
  BackgroundResearchAdapterCancelInput,
  BackgroundResearchAdapterCancelResult,
  BackgroundResearchAdapterResult,
  BackgroundResearchAdapterResultInput,
  BackgroundResearchAdapterStartInput,
  BackgroundResearchAdapterStartResult,
  BackgroundResearchRuntimeAdapter
} from "@solo-superman/core";

const DEFAULT_ADAPTER_VERSION = "solo-superman.web-search-readonly-playwright.v1";
const DEFAULT_SEARCH_RESULTS = 5;
const DEFAULT_FETCH_PAGES = 3;
const DEFAULT_TIMEOUT_MILLIS = 15_000;
const DEFAULT_MIN_DELAY_MILLIS = 1_000;
const DEFAULT_MAX_DELAY_MILLIS = 6_000;
const MAX_SEARCH_RESULTS = 10;
const MAX_FETCH_PAGES = 5;
const MAX_TIMEOUT_MILLIS = 30_000;
const MAX_DELAY_MILLIS = DEFAULT_MAX_DELAY_MILLIS;
const MAX_QUERY_CHARS = 220;
const MAX_SNIPPET_CHARS = 700;
const MAX_SUMMARY_CHARS = 4_000;

export type WebSearchReadOnlyBlockCode =
  | "browser_unavailable"
  | "captcha_or_antibot_required"
  | "login_required"
  | "navigation_failed"
  | "no_public_results";

export class WebSearchReadOnlyAdapterError extends Error {
  readonly code: WebSearchReadOnlyBlockCode;

  constructor(code: WebSearchReadOnlyBlockCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WebSearchReadOnlyAdapterError";
    this.code = code;
  }
}

export interface WebSearchReadOnlySourceResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly retrievedAt?: string;
}

export interface WebSearchReadOnlySearchInput {
  readonly query: string;
  readonly maxResults: number;
  readonly maxFetchedPages: number;
  readonly timeoutMillis: number;
  readonly delayMillis: () => number;
  readonly now: () => string;
}

export type WebSearchReadOnlySearch = (
  input: WebSearchReadOnlySearchInput
) => Promise<readonly WebSearchReadOnlySourceResult[]>;

export interface WebSearchReadOnlyResearchAdapterOptions {
  readonly now?: () => string;
  readonly adapterVersion?: string;
  readonly maxResults?: number;
  readonly maxFetchedPages?: number;
  readonly timeoutMillis?: number;
  readonly minDelayMillis?: number;
  readonly maxDelayMillis?: number;
  readonly search?: WebSearchReadOnlySearch;
}

export const WEB_SEARCH_READONLY_ENV = {
  maxResults: "SOLO_RESEARCH_WEB_MAX_RESULTS",
  maxFetchedPages: "SOLO_RESEARCH_WEB_MAX_FETCHED_PAGES",
  timeoutMillis: "SOLO_RESEARCH_WEB_TIMEOUT_MS",
  minDelayMillis: "SOLO_RESEARCH_WEB_MIN_DELAY_MS",
  maxDelayMillis: "SOLO_RESEARCH_WEB_MAX_DELAY_MS"
} as const;

interface SearchCandidate {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

function defaultNow() {
  return new Date().toISOString();
}

function clampPositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isInteger(value) || !value || value < 1) {
    return fallback;
  }

  return value;
}

function clampIntegerRange(value: number | undefined, fallback: number, min: number, max: number) {
  return Math.min(max, Math.max(min, clampPositiveInteger(value, fallback)));
}

function boundedDelayRange(minDelayMillis: number | undefined, maxDelayMillis: number | undefined) {
  const min = clampIntegerRange(minDelayMillis, DEFAULT_MIN_DELAY_MILLIS, DEFAULT_MIN_DELAY_MILLIS, MAX_DELAY_MILLIS);
  const max = Math.max(
    min,
    clampIntegerRange(maxDelayMillis, DEFAULT_MAX_DELAY_MILLIS, DEFAULT_MIN_DELAY_MILLIS, MAX_DELAY_MILLIS)
  );

  return { min, max };
}

function optionalPositiveIntegerFromEnv(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name];

  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${name} must be a positive integer when set.`);
  }

  const parsed = Number.parseInt(value, 10);

  if (parsed < 1) {
    throw new Error(`${name} must be greater than zero when set.`);
  }

  return parsed;
}

export function webSearchReadOnlyResearchAdapterOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): WebSearchReadOnlyResearchAdapterOptions {
  const maxResults = optionalPositiveIntegerFromEnv(env, WEB_SEARCH_READONLY_ENV.maxResults);
  const maxFetchedPages = optionalPositiveIntegerFromEnv(env, WEB_SEARCH_READONLY_ENV.maxFetchedPages);
  const timeoutMillis = optionalPositiveIntegerFromEnv(env, WEB_SEARCH_READONLY_ENV.timeoutMillis);
  const minDelayMillis = optionalPositiveIntegerFromEnv(env, WEB_SEARCH_READONLY_ENV.minDelayMillis);
  const maxDelayMillis = optionalPositiveIntegerFromEnv(env, WEB_SEARCH_READONLY_ENV.maxDelayMillis);

  if (maxResults && maxResults > MAX_SEARCH_RESULTS) {
    throw new Error(`${WEB_SEARCH_READONLY_ENV.maxResults} must be at most ${MAX_SEARCH_RESULTS} when set.`);
  }

  if (maxFetchedPages && maxFetchedPages > MAX_FETCH_PAGES) {
    throw new Error(`${WEB_SEARCH_READONLY_ENV.maxFetchedPages} must be at most ${MAX_FETCH_PAGES} when set.`);
  }

  if (timeoutMillis && timeoutMillis > MAX_TIMEOUT_MILLIS) {
    throw new Error(`${WEB_SEARCH_READONLY_ENV.timeoutMillis} must be at most ${MAX_TIMEOUT_MILLIS} when set.`);
  }

  if (minDelayMillis && minDelayMillis < DEFAULT_MIN_DELAY_MILLIS) {
    throw new Error(`${WEB_SEARCH_READONLY_ENV.minDelayMillis} must be at least ${DEFAULT_MIN_DELAY_MILLIS} when set.`);
  }

  if (maxDelayMillis && maxDelayMillis > MAX_DELAY_MILLIS) {
    throw new Error(`${WEB_SEARCH_READONLY_ENV.maxDelayMillis} must be at most ${MAX_DELAY_MILLIS} when set.`);
  }

  if (minDelayMillis && maxDelayMillis && maxDelayMillis < minDelayMillis) {
    throw new Error(`${WEB_SEARCH_READONLY_ENV.maxDelayMillis} must be greater than or equal to ${WEB_SEARCH_READONLY_ENV.minDelayMillis}.`);
  }

  return {
    ...(maxResults ? { maxResults } : {}),
    ...(maxFetchedPages ? { maxFetchedPages } : {}),
    ...(timeoutMillis ? { timeoutMillis } : {}),
    ...(minDelayMillis ? { minDelayMillis } : {}),
    ...(maxDelayMillis ? { maxDelayMillis } : {})
  };
}

function randomDelayMillis(min: number, max: number) {
  if (max <= min) {
    return min;
  }

  return min + Math.floor(Math.random() * (max - min + 1));
}

function assertPublicSafeDisclosurePayload(payload: PublicSafeResearchDisclosurePayload | undefined) {
  if (!payload?.researchObjective.trim() || !payload.publicSafeSummary.trim()) {
    throw new Error("Web search read-only research requires a public-safe disclosure payload.");
  }
}

function assertWebSearchRun(run: ResearchRunProjection) {
  if (run.provider.adapterKind !== "web_search_readonly") {
    throw new Error("Web search read-only adapter can only handle web_search_readonly runs.");
  }

  if (run.sourceCategory !== "public_web" || run.provider.sourceCategory !== "public_web") {
    throw new Error("Web search read-only adapter only supports public_web read-only research runs.");
  }
}

function providerRunIdFor(run: ResearchRunProjection) {
  return `web_search_readonly_${run.researchRunId}`;
}

function normalizedText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function truncateText(value: string, maxLength: number) {
  const text = normalizedText(value);

  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function searchQueryFromDisclosure(payload: PublicSafeResearchDisclosurePayload | undefined, run: ResearchRunProjection) {
  const raw = payload
    ? `${payload.researchObjective} ${payload.publicSafeSummary}`
    : `${run.researchTaskId} ${run.connectorId} public evidence`;

  return truncateText(raw, MAX_QUERY_CHARS);
}

function sourceRefsFor(run: ResearchRunProjection, sources: readonly WebSearchReadOnlySourceResult[]) {
  return [...new Set([...run.sourceRefs, ...sources.map((source) => source.url)])];
}

function summaryForSources(
  run: ResearchRunProjection,
  query: string,
  sources: readonly WebSearchReadOnlySourceResult[]
) {
  const sourceLines = sources.map((source, index) =>
    `${index + 1}. ${source.title} — ${source.url}\n   ${truncateText(source.snippet, 420)}`
  );
  const summary = [
    `Public web research completed for ${run.researchTaskId}.`,
    `Query: ${query}`,
    `Sources reviewed: ${sources.length}`,
    ...sourceLines,
    "Pro: At least one public source was reachable through a read-only browser search.",
    "Con: Browser search snippets can be incomplete; quality-gate review must verify claims before acceptance."
  ].join("\n");

  return truncateText(summary, MAX_SUMMARY_CHARS);
}

function hasCaptchaOrAntiBotText(value: string) {
  return /captcha|verify you are human|unusual traffic|robot check|automated queries|are you a robot|bots use|complete the following challenge/iu.test(value);
}

function hasLoginRequiredText(value: string) {
  return /sign in|log in|required to continue|create an account|가입|로그인/iu.test(value);
}

function normalizedHostname(rawHostname: string) {
  return rawHostname.replace(/^\[/u, "").replace(/\]$/u, "").replace(/\.$/u, "").toLowerCase();
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first = 0, second = 0] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIpv6(hostname: string) {
  return (
    hostname === "::" ||
    hostname === "::1" ||
    hostname.startsWith("fe80:") ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd")
  );
}

function isPublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = normalizedHostname(url.hostname);
    const ipVersion = isIP(hostname);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
      return false;
    }

    if (ipVersion === 4) {
      return !isPrivateIpv4(hostname);
    }

    if (ipVersion === 6) {
      return !isPrivateIpv6(hostname);
    }

    return true;
  } catch {
    return false;
  }
}

function normalizeCandidateUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl, "https://duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    const bingEncodedUrl =
      /(^|\.)bing\.com$/iu.test(url.hostname) && url.pathname.startsWith("/ck/")
        ? url.searchParams.get("u")
        : null;
    const decodedBingUrl = bingEncodedUrl ? decodeBingRedirectUrl(bingEncodedUrl) : null;
    const candidate = decodedBingUrl ? new URL(decodedBingUrl, "https://www.bing.com") : uddg ? new URL(uddg) : url;

    if (!isPublicHttpUrl(candidate.toString())) {
      return null;
    }

    return candidate.toString();
  } catch {
    return null;
  }
}

function isSearchEngineUtilityUrl(value: string) {
  try {
    const url = new URL(value);

    return /(^|\.)duckduckgo\.com$|(^|\.)bing\.com$|(^|\.)google\.com$/iu.test(url.hostname);
  } catch {
    return true;
  }
}

function publicSourceResults(sources: readonly WebSearchReadOnlySourceResult[]) {
  return sources.filter((source) => isPublicHttpUrl(source.url));
}

function decodeBingRedirectUrl(value: string) {
  try {
    const normalized = value.startsWith("a1") ? value.slice(2) : value;
    const decoded = Buffer.from(normalized.replace(/-/gu, "+").replace(/_/gu, "/"), "base64").toString("utf8");

    return decoded || null;
  } catch {
    return null;
  }
}

async function extractSearchCandidates(page: Page, maxResults: number) {
  const candidates = await page.evaluate<readonly SearchCandidate[]>(`
    (() => {
      const normalize = (value) => value?.replace(/\\s+/gu, " ").trim() ?? "";
      const resultCards = Array.from(document.querySelectorAll(".result, li.b_algo, article"));
      const cardCandidates = resultCards.flatMap((card) => {
        const anchor = card.querySelector("h2 a[href], a.result__a, a[href]");

        if (!anchor?.href) {
          return [];
        }

        const snippet = normalize(
          card.querySelector(".result__snippet, [class*='snippet'], p")?.textContent ?? card.textContent
        );

        return [{ title: normalize(anchor.textContent) || anchor.href, url: anchor.href, snippet }];
      });

      if (cardCandidates.length > 0) {
        return cardCandidates;
      }

      return Array.from(document.querySelectorAll("a[href]"))
        .filter((anchor) => normalize(anchor.textContent).length > 8)
        .map((anchor) => ({
          title: normalize(anchor.textContent) || anchor.href,
          url: anchor.href,
          snippet: normalize(anchor.closest("p, li, div")?.textContent ?? anchor.textContent)
        }));
    })()
  `);

  const unique = new Map<string, SearchCandidate>();

  for (const candidate of candidates) {
    const url = normalizeCandidateUrl(candidate.url);

    if (!url || unique.has(url) || isSearchEngineUtilityUrl(url)) {
      continue;
    }

    unique.set(url, {
      title: truncateText(candidate.title, 180),
      url,
      snippet: truncateText(candidate.snippet || candidate.title, MAX_SNIPPET_CHARS)
    });

    if (unique.size >= maxResults) {
      break;
    }
  }

  return [...unique.values()];
}

async function pageText(page: Page) {
  return page.evaluate<string>(`document.body?.innerText ?? document.documentElement?.textContent ?? ""`);
}

async function fetchCandidatePage(
  page: Page,
  candidate: SearchCandidate,
  timeoutMillis: number,
  now: () => string
): Promise<WebSearchReadOnlySourceResult | null> {
  try {
    await page.goto(candidate.url, { waitUntil: "domcontentloaded", timeout: timeoutMillis });
    const text = truncateText(await pageText(page), MAX_SNIPPET_CHARS);

    if (hasCaptchaOrAntiBotText(text) || hasLoginRequiredText(text)) {
      return {
        ...candidate,
        snippet: `${candidate.snippet} Public page opened, but readable body text was blocked by a login, CAPTCHA, or anti-bot interstitial.`,
        retrievedAt: now()
      };
    }

    const title = truncateText((await page.title()) || candidate.title, 180);

    return {
      title,
      url: candidate.url,
      snippet: text || candidate.snippet,
      retrievedAt: now()
    };
  } catch {
    return {
      ...candidate,
      snippet: `${candidate.snippet} Page body could not be fetched before timeout; search-result snippet retained for review.`,
      retrievedAt: now()
    };
  }
}

async function closeBrowser(browser: Browser | null, context: BrowserContext | null) {
  await context?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}

export async function runPlaywrightPublicWebSearch(
  input: WebSearchReadOnlySearchInput
): Promise<readonly WebSearchReadOnlySourceResult[]> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      javaScriptEnabled: false,
      locale: "en-US",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 SoloSupermanReadOnlyResearch/1.0"
    });
    const page = await context.newPage();
    const searchUrls = [
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`,
      `https://www.bing.com/search?q=${encodeURIComponent(input.query)}`
    ];
    let candidates: readonly SearchCandidate[] = [];
    let lastSearchBlocker: WebSearchReadOnlyAdapterError | null = null;

    for (const searchUrl of searchUrls) {
      try {
        await delay(input.delayMillis());
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: input.timeoutMillis });

        const searchText = await pageText(page);

        if (hasCaptchaOrAntiBotText(searchText)) {
          lastSearchBlocker = new WebSearchReadOnlyAdapterError(
            "captcha_or_antibot_required",
            "Public web search was blocked by CAPTCHA or anti-bot verification; no bypass was attempted."
          );
          continue;
        }

        candidates = await extractSearchCandidates(page, input.maxResults);

        if (candidates.length > 0) {
          break;
        }
      } catch (error) {
        lastSearchBlocker = error instanceof WebSearchReadOnlyAdapterError
          ? error
          : new WebSearchReadOnlyAdapterError(
              "navigation_failed",
              `Public search page could not be read: ${error instanceof Error ? error.message : String(error)}`
            );
      }
    }

    if (candidates.length === 0) {
      throw lastSearchBlocker ?? new WebSearchReadOnlyAdapterError(
        "no_public_results",
        "No public search results were readable from the browser search page."
      );
    }

    const sources: WebSearchReadOnlySourceResult[] = [];

    for (const candidate of candidates.slice(0, input.maxFetchedPages)) {
      await delay(input.delayMillis());
      const fetched = await fetchCandidatePage(page, candidate, input.timeoutMillis, input.now);

      if (fetched) {
        sources.push(fetched);
      }
    }

    return sources.length > 0 ? sources : candidates.map((candidate) => ({ ...candidate, retrievedAt: input.now() }));
  } catch (error) {
    if (error instanceof WebSearchReadOnlyAdapterError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const code: WebSearchReadOnlyBlockCode = /Executable doesn't exist|browserType.launch|chromium/iu.test(message)
      ? "browser_unavailable"
      : "navigation_failed";

    throw new WebSearchReadOnlyAdapterError(
      code,
      code === "browser_unavailable"
        ? "Playwright Chromium is unavailable. Run `pnpm --filter @solo-superman/sidecar exec playwright install chromium` and retry."
        : `Public web browser search failed before results could be reviewed: ${message}`,
      error instanceof Error ? { cause: error } : undefined
    );
  } finally {
    await closeBrowser(browser, context);
  }
}

export function createWebSearchReadOnlyResearchAdapter(
  options: WebSearchReadOnlyResearchAdapterOptions = {}
): BackgroundResearchRuntimeAdapter {
  const now = options.now ?? defaultNow;
  const adapterVersion = options.adapterVersion ?? DEFAULT_ADAPTER_VERSION;
  const maxResults = clampIntegerRange(options.maxResults, DEFAULT_SEARCH_RESULTS, 1, MAX_SEARCH_RESULTS);
  const maxFetchedPages = Math.min(
    maxResults,
    clampIntegerRange(options.maxFetchedPages, DEFAULT_FETCH_PAGES, 1, MAX_FETCH_PAGES)
  );
  const timeoutMillis = clampIntegerRange(options.timeoutMillis, DEFAULT_TIMEOUT_MILLIS, 1_000, MAX_TIMEOUT_MILLIS);
  const delayRange = boundedDelayRange(options.minDelayMillis, options.maxDelayMillis);
  const delayMillis = () => randomDelayMillis(delayRange.min, delayRange.max);
  const search = options.search ?? runPlaywrightPublicWebSearch;

  return {
    adapterKind: "web_search_readonly",
    adapterVersion,
    readonlyExternalAccess: true,

    async start(input: BackgroundResearchAdapterStartInput): Promise<BackgroundResearchAdapterStartResult> {
      const run = validateResearchRunProjection(input.researchRun);

      assertResearchRunStatusTransition(run.status, "running");
      assertPublicSafeDisclosurePayload(input.disclosurePayload);
      assertWebSearchRun(run);

      return {
        status: "running",
        providerRunId: providerRunIdFor(run),
        startedAt: now()
      };
    },

    async pollResult(input: BackgroundResearchAdapterResultInput): Promise<BackgroundResearchAdapterResult> {
      const run = validateResearchRunProjection(input.researchRun);

      assertResearchRunStatusTransition(run.status, "needs_review");
      assertWebSearchRun(run);

      const query = searchQueryFromDisclosure(input.disclosurePayload, run);
      const sources = publicSourceResults(await search({
        query,
        maxResults,
        maxFetchedPages,
        timeoutMillis,
        delayMillis,
        now
      }));

      if (sources.length === 0) {
        throw new WebSearchReadOnlyAdapterError(
          "no_public_results",
          "No public web sources were readable from the browser search run."
        );
      }
      const primarySource = sources[0];

      return {
        status: "needs_review",
        providerRunId: run.provider.providerRunId ?? providerRunIdFor(run),
        completedAt: now(),
        ...(primarySource ? { sourceTitle: primarySource.title, sourceUrl: primarySource.url } : {}),
        summary: summaryForSources(run, query, sources),
        limitations: [
          "Browser-based public web search only; no login, CAPTCHA, anti-bot bypass, paid-service access, or external search API was used.",
          "Source snippets and fetched page text require quality-gate review before accepted evidence.",
          `Random delay range was ${delayRange.min}-${delayRange.max}ms with at most ${maxFetchedPages} fetched public page(s).`
        ],
        sourceRefs: sourceRefsFor(run, sources)
      };
    },

    async cancel(input: BackgroundResearchAdapterCancelInput): Promise<BackgroundResearchAdapterCancelResult> {
      const run = validateResearchRunProjection(input.researchRun);
      const status = (run.status === "queued" || run.status === "paused") && !run.provider.providerRunId
        ? "cancelled"
        : "cancel_requested";

      assertResearchRunStatusTransition(run.status, status);
      assertWebSearchRun(run);

      return {
        status,
        ...(run.provider.providerRunId ? { providerRunId: run.provider.providerRunId } : {}),
        ...(status === "cancelled" ? { completedAt: now() } : {}),
        reason: input.reason
      };
    }
  };
}

export function webSearchReadOnlyAdapterFailureMessage(error: unknown) {
  if (error instanceof WebSearchReadOnlyAdapterError) {
    return `${error.code}: ${error.message}`;
  }

  return error instanceof Error ? error.message : String(error);
}
