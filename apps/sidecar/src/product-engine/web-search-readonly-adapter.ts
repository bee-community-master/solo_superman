/// <reference lib="dom" />

import { readdir, readFile, stat } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { basename, extname, join, resolve } from "node:path";
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
  readonly language?: string;
  readonly searchEngine?: WebSearchReadOnlySearchEngine;
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
  readonly localCorpusDir?: string;
  readonly language?: string;
  readonly region?: string;
  readonly searchEngine?: WebSearchReadOnlySearchEngine;
  readonly search?: WebSearchReadOnlySearch;
}

export type WebSearchReadOnlySearchEngine = "duckduckgo" | "bing" | "google.co.kr" | "naver";

export const WEB_SEARCH_READONLY_ENV = {
  maxResults: "SOLO_RESEARCH_WEB_MAX_RESULTS",
  maxFetchedPages: "SOLO_RESEARCH_WEB_MAX_FETCHED_PAGES",
  timeoutMillis: "SOLO_RESEARCH_WEB_TIMEOUT_MS",
  minDelayMillis: "SOLO_RESEARCH_WEB_MIN_DELAY_MS",
  maxDelayMillis: "SOLO_RESEARCH_WEB_MAX_DELAY_MS",
  engine: "SOLO_RESEARCH_WEB_ENGINE",
  localCorpusDir: "SOLO_RESEARCH_LOCAL_CORPUS_DIR",
  language: "SOLO_RESEARCH_LANGUAGE",
  region: "SOLO_RESEARCH_REGION"
} as const;

export interface WebSearchReadOnlySearchCandidate {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

type SearchCandidate = WebSearchReadOnlySearchCandidate;

export interface PlannedPublicWebSearchQueries {
  readonly queries: readonly string[];
  readonly coreTerms: readonly string[];
  readonly intentTerms: readonly string[];
  readonly researchObjective: string;
  readonly language: "ko" | "en" | "mixed";
}

interface ReviewedPublicWebSource {
  readonly source: WebSearchReadOnlySourceResult;
  readonly finding: string | null;
  readonly findingLabel: "supports" | "weakens" | "uncertain" | null;
  readonly sourceUtility?: SourceUtilityCheck;
  readonly rejectReason?: string;
}

interface SourceUtilityCheck {
  readonly score: number;
  readonly institutionality: "strong" | "medium" | "weak";
  readonly freshness: "current" | "dated" | "unknown";
  readonly sampleContext: boolean;
  readonly userBehaviorSignal: boolean;
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
    throw new Error(`${name} must be a positive integer when set. Example: ${name}=5.`);
  }

  const parsed = Number.parseInt(value, 10);

  if (parsed < 1) {
    throw new Error(`${name} must be between 1 and the documented maximum. Example: ${name}=5.`);
  }

  return parsed;
}

function assertEnvIntegerRange(
  value: number | undefined,
  name: string,
  min: number,
  max: number,
  example: number
) {
  if (value !== undefined && (value < min || value > max)) {
    throw new Error(`${name} must be between ${min} and ${max}. Example: ${name}=${example}.`);
  }
}

function optionalSearchEngineFromEnv(env: NodeJS.ProcessEnv, name: string): WebSearchReadOnlySearchEngine | undefined {
  const value = env[name]?.trim();

  if (!value) {
    return undefined;
  }

  if (value === "duckduckgo" || value === "bing" || value === "google.co.kr" || value === "naver") {
    return value;
  }

  throw new Error(`${name} must be one of duckduckgo, bing, google.co.kr, or naver. Example: ${name}=google.co.kr.`);
}

export function webSearchReadOnlyResearchAdapterOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): WebSearchReadOnlyResearchAdapterOptions {
  const maxResults = optionalPositiveIntegerFromEnv(env, WEB_SEARCH_READONLY_ENV.maxResults);
  const maxFetchedPages = optionalPositiveIntegerFromEnv(env, WEB_SEARCH_READONLY_ENV.maxFetchedPages);
  const timeoutMillis = optionalPositiveIntegerFromEnv(env, WEB_SEARCH_READONLY_ENV.timeoutMillis);
  const minDelayMillis = optionalPositiveIntegerFromEnv(env, WEB_SEARCH_READONLY_ENV.minDelayMillis);
  const maxDelayMillis = optionalPositiveIntegerFromEnv(env, WEB_SEARCH_READONLY_ENV.maxDelayMillis);
  const searchEngine = optionalSearchEngineFromEnv(env, WEB_SEARCH_READONLY_ENV.engine);
  const localCorpusDir = env[WEB_SEARCH_READONLY_ENV.localCorpusDir]?.trim() || undefined;
  const language = env[WEB_SEARCH_READONLY_ENV.language]?.trim() || undefined;
  const region = env[WEB_SEARCH_READONLY_ENV.region]?.trim() || undefined;

  assertEnvIntegerRange(maxResults, WEB_SEARCH_READONLY_ENV.maxResults, 1, MAX_SEARCH_RESULTS, 5);
  assertEnvIntegerRange(maxFetchedPages, WEB_SEARCH_READONLY_ENV.maxFetchedPages, 1, MAX_FETCH_PAGES, 3);
  assertEnvIntegerRange(timeoutMillis, WEB_SEARCH_READONLY_ENV.timeoutMillis, 1_000, MAX_TIMEOUT_MILLIS, 15_000);
  assertEnvIntegerRange(minDelayMillis, WEB_SEARCH_READONLY_ENV.minDelayMillis, DEFAULT_MIN_DELAY_MILLIS, MAX_DELAY_MILLIS, 1_000);
  assertEnvIntegerRange(maxDelayMillis, WEB_SEARCH_READONLY_ENV.maxDelayMillis, DEFAULT_MIN_DELAY_MILLIS, MAX_DELAY_MILLIS, 6_000);

  if (minDelayMillis && maxDelayMillis && maxDelayMillis < minDelayMillis) {
    throw new Error(`${WEB_SEARCH_READONLY_ENV.maxDelayMillis} must be greater than or equal to ${WEB_SEARCH_READONLY_ENV.minDelayMillis}. Example: ${WEB_SEARCH_READONLY_ENV.minDelayMillis}=1000 ${WEB_SEARCH_READONLY_ENV.maxDelayMillis}=6000.`);
  }

  return {
    ...(maxResults ? { maxResults } : {}),
    ...(maxFetchedPages ? { maxFetchedPages } : {}),
    ...(timeoutMillis ? { timeoutMillis } : {}),
    ...(minDelayMillis ? { minDelayMillis } : {}),
    ...(maxDelayMillis ? { maxDelayMillis } : {}),
    ...(searchEngine ? { searchEngine } : {}),
    ...(localCorpusDir ? { localCorpusDir } : {}),
    ...(language ? { language } : {}),
    ...(region ? { region } : {})
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function humanTitleFromUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./iu, "");
    const lastPathSegment = url.pathname
      .split("/")
      .filter(Boolean)
      .at(-1);
    const decodedPath = lastPathSegment
      ? decodeURIComponent(lastPathSegment).replace(/[-_]+/gu, " ").trim()
      : "";

    return decodedPath ? `${host} — ${decodedPath}` : host;
  } catch {
    return value;
  }
}

function cleanSearchResultTitle(title: string, url: string) {
  const normalized = normalizedText(title);
  const fallback = humanTitleFromUrl(url);

  if (!normalized) {
    return fallback;
  }

  try {
    const host = new URL(url).hostname.replace(/^www\./iu, "");
    const collapsedHostAndUrlPattern = new RegExp(`${escapeRegExp(host)}\\s*https?://`, "iu");

    if (
      /https?:\/\//iu.test(normalized) ||
      collapsedHostAndUrlPattern.test(normalized) ||
      /^[\w.-]+\s*›\s*/iu.test(normalized)
    ) {
      return fallback;
    }
  } catch {
    if (/https?:\/\//iu.test(normalized)) {
      return fallback;
    }
  }

  return normalized;
}

function cleanSearchResultSnippet(snippet: string, title: string) {
  const cleaned = normalizedText(snippet)
    .replace(/\bFull page text was unavailable before timeout, so only the search-result summary is shown\.?/giu, "")
    .replace(/\bPublic page opened, but readable body text was blocked by a login, CAPTCHA, or anti-bot interstitial\.?/giu, "")
    .trim();

  return cleaned || title;
}

function stripPublicSafeSummaryLabels(value: string) {
  return value
    .replace(/\bFind decision evidence for:\s*/giu, "")
    .replace(/\bOriginal ambiguity:\s*/giu, "")
    .replace(/\bDecision this should inform:\s*/giu, "")
    .replace(/\bAmbiguity dimension:\s*/giu, "")
    .replace(/\bProduct category:\s*/giu, "")
    .replace(/\bCustomer\/problem hypothesis:\s*/giu, "")
    .replace(/\bResearch objective:\s*/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function removeGenericResearchObjectiveText(value: string) {
  return value
    .replace(/\bFind decision evidence for\b[:：]?\s*/giu, "")
    .replace(/\bOriginal ambiguity\b[:：]?[^.。!?]{0,160}[.。!?]?/giu, "")
    .replace(/\bDecision this should inform\b[:：]?[^.。!?]{0,160}[.。!?]?/giu, "")
    .replace(/\bAmbiguity dimension\b[:：]?[^.。!?]{0,120}[.。!?]?/giu, "")
    .replace(/(?:첫\s*)?고객\s*세그먼트[^.。!?]{0,80}(?:구체화|좁|넓)[^.。!?]*[.。!?]?/giu, "")
    .replace(/(?:first\s+)?customer\s+segment[^.?!]{0,100}(?:narrow|broad|specific|validate)[^.?!]*[.?!]?/giu, "")
    .replace(/(?:구매자|사용자)[^.。!?]{0,80}(?:확인|구체화|검증)[^.。!?]*[.。!?]?/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizedSearchTerm(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function uniqueSearchTerms(values: readonly string[], maxTerms: number) {
  return [
    ...new Set(
      values
        .map(normalizedSearchTerm)
        .filter((value) => value.length >= 2)
    )
  ].slice(0, maxTerms);
}

function includesLoose(value: string, term: string) {
  const normalizedValue = value.toLowerCase();
  const normalizedTerm = term.toLowerCase();

  return (
    normalizedValue.includes(normalizedTerm) ||
    normalizedValue.replace(/\s+/gu, "").includes(normalizedTerm.replace(/\s+/gu, ""))
  );
}

function tokenTermsFromText(value: string) {
  const stopwords = new Set([
    "research",
    "objective",
    "decision",
    "evidence",
    "validate",
    "public",
    "summary",
    "product",
    "category",
    "customer",
    "problem",
    "hypothesis",
    "조사",
    "리서치",
    "검증",
    "근거",
    "확인",
    "구체화",
    "필요",
    "관리",
    "정보"
  ]);

  return (value.match(/[가-힣a-z0-9]{2,}/giu) ?? [])
    .map((term) => term.toLowerCase())
    .filter((term) => !stopwords.has(term));
}

function coreTermsFor(objective: string, context: string) {
  const combined = `${objective} ${context}`;

  if (/(?:이혼|별거|소송|divorce|separation)/iu.test(combined)) {
    return uniqueSearchTerms(
      [
        "이혼 준비",
        "이혼",
        "재무",
        "현금흐름",
        "현금 runway",
        "생계비",
        "divorce financial planning",
        "cash flow"
      ],
      8
    );
  }

  if (/(?:반려\s*동물|반려견|반려묘|펫\b|pet\b)/iu.test(combined)) {
    return uniqueSearchTerms(["반려동물", "보호자", "동물병원", "의료 기록", "보험 청구", "돌봄 기록", "pet owner"], 8);
  }

  if (/(?:소상공인|미용실|네일|네일샵|음식점|식당|카페|예약|주문|단골|카카오톡|노쇼|merchant|reservation|order|loyalty)/iu.test(combined)) {
    return uniqueSearchTerms(["소상공인", "예약", "카카오톡", "노쇼", "주문", "단골", "미용실", "네일샵", "음식점"], 9);
  }

  return uniqueSearchTerms(tokenTermsFromText(combined), 8);
}

function searchIntentTermsFor(objective: string, context: string) {
  const combined = `${objective} ${context}`;
  const isKorean = /[가-힣]/u.test(combined);
  const commonKorean = [
    "후기",
    "커뮤니티",
    "대체재",
    "가격",
    "상담",
    "유료 의향",
    "결제 의향",
    "가입",
    "재방문",
    "반복 사용",
    "통계",
    "리포트"
  ];
  const commonEnglish = [
    "reviews",
    "community",
    "alternatives",
    "pricing",
    "willingness to pay",
    "subscription",
    "repeat use",
    "statistics",
    "report"
  ];

  if (/(?:반려\s*동물|반려견|반려묘|펫\b|pet\b)/iu.test(combined)) {
    return isKorean
      ? uniqueSearchTerms(["보호자 유형", "동물병원", "의료 기록", "보험 청구", "돌봄 기록", ...commonKorean], 12)
      : uniqueSearchTerms(["pet owner segments", "veterinary cost", "insurance", "care", ...commonEnglish], 12);
  }

  if (/(?:소상공인|미용실|네일|네일샵|음식점|식당|카페|예약|주문|단골|카카오톡|노쇼|merchant|reservation|order|loyalty)/iu.test(combined)) {
    return isKorean
      ? uniqueSearchTerms(["예약 누락", "노쇼", "카카오톡 예약", "소상공인 SaaS", "매장 운영", "단골 재방문", ...commonKorean], 12)
      : uniqueSearchTerms(["small business reservation", "no-show", "local merchant SaaS", "customer retention", ...commonEnglish], 12);
  }

  if (/(?:고객|세그먼트|customer|segment|persona|사용자\s*유형)/iu.test(combined)) {
    return isKorean
      ? uniqueSearchTerms(["고객 유형", "사용자 세그먼트", "시장 조사", ...commonKorean], 12)
      : uniqueSearchTerms(["customer segments", "user personas", "market research", ...commonEnglish], 12);
  }

  if (/(?:구매자|결제자|buyer|payer|user)/iu.test(combined)) {
    return isKorean
      ? uniqueSearchTerms(["구매자", "사용자", "의사결정자", ...commonKorean], 12)
      : uniqueSearchTerms(["buyer", "user", "decision maker", ...commonEnglish], 12);
  }

  return isKorean ? uniqueSearchTerms(commonKorean, 12) : uniqueSearchTerms(commonEnglish, 12);
}

function publicWebSearchContextFromPayload(payload: PublicSafeResearchDisclosurePayload) {
  const objective = stripPublicSafeSummaryLabels(payload.researchObjective);
  const context = removeGenericResearchObjectiveText(stripPublicSafeSummaryLabels(payload.publicSafeSummary));
  const objectivePart = removeGenericResearchObjectiveText(objective);

  return {
    objective: normalizedText(objectivePart || objective),
    context: normalizedText(context)
  };
}

function queryWithTerms(coreTerms: readonly string[], intentTerms: readonly string[], coreCount: number, intentCount: number) {
  return truncateText([...coreTerms.slice(0, coreCount), ...intentTerms.slice(0, intentCount)].join(" "), MAX_QUERY_CHARS);
}

function searchLanguageFor(value: string): PlannedPublicWebSearchQueries["language"] {
  const hasKorean = /[가-힣]/u.test(value);
  const hasLatin = /[a-z]/iu.test(value);

  return hasKorean && hasLatin ? "mixed" : hasKorean ? "ko" : "en";
}

function englishExpansionQueriesFor(combined: string) {
  if (/(?:반려\s*동물|반려견|반려묘|펫\b|pet\b)/iu.test(combined)) {
    return [
      "pet lifecycle app veterinary records pet insurance care routines market research",
      "pet guardian veterinary cost insurance claim care management reviews"
    ];
  }

  if (/(?:이혼|별거|소송|divorce|separation)/iu.test(combined)) {
    return ["divorce financial planning cash flow willingness to pay alternatives"];
  }

  if (/(?:소상공인|미용실|네일|네일샵|음식점|식당|카페|예약|주문|단골|카카오톡|노쇼|merchant|reservation|order|loyalty)/iu.test(combined)) {
    return [
      "small business appointment scheduling no-show customer retention software reviews",
      "local merchant reservation order management KakaoTalk customer loyalty SaaS"
    ];
  }

  return [];
}

export function planPublicWebSearchQueries(
  payload: PublicSafeResearchDisclosurePayload | undefined,
  run?: ResearchRunProjection
): PlannedPublicWebSearchQueries {
  const fallbackContext = run ? `${run.researchTaskId} ${run.connectorId} public evidence` : "public evidence";
  const { objective, context } = payload
    ? publicWebSearchContextFromPayload(payload)
    : { objective: fallbackContext, context: fallbackContext };
  const combined = `${objective} ${context}`;
  const language = searchLanguageFor(combined);
  const isKorean = language === "ko" || language === "mixed";
  const coreTerms = coreTermsFor(objective, context);
  const intentTerms = searchIntentTermsFor(objective, context);
  const queries = uniqueSearchTerms(
    [
      queryWithTerms(coreTerms, intentTerms, 4, 5),
      queryWithTerms(coreTerms.slice(1), intentTerms.slice(3), 4, 5),
      queryWithTerms(coreTerms, intentTerms.slice(5), 6, 5),
      ...(isKorean ? englishExpansionQueriesFor(combined) : [])
    ].filter(Boolean),
    4
  );

  return {
    queries: queries.length ? queries : [truncateText(combined, MAX_QUERY_CHARS)],
    coreTerms,
    intentTerms,
    researchObjective: truncateText(
      `이 결정을 뒤집거나 좁힐 공개 근거/반례 찾기: ${objective || context || fallbackContext}`,
      360
    ),
    language
  };
}

function sourceRefsFor(run: ResearchRunProjection, sources: readonly WebSearchReadOnlySourceResult[]) {
  return [...new Set([...run.sourceRefs, ...sources.map((source) => source.url)])];
}

function sourceHaystack(source: WebSearchReadOnlySourceResult) {
  return `${source.title} ${source.snippet} ${source.url}`;
}

function matchingTerms(value: string, terms: readonly string[]) {
  return terms.filter((term) => includesLoose(value, term));
}

function isLowQualityNoiseSource(source: WebSearchReadOnlySourceResult) {
  const haystack = sourceHaystack(source);
  const hostname = (() => {
    try {
      return new URL(source.url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  return (
    /(^|\.)encykorea\.aks\.ac\.kr$/u.test(hostname) ||
    /(^|\.)support\.microsoft\.com$/u.test(hostname) ||
    /(^|\.)namu\.wiki$/u.test(hostname) ||
    /(^|\.)wikipedia\.org$/u.test(hostname) ||
    /(^|\.)translate\.google\.com$/u.test(hostname) ||
    /(^|\.)tinhte\.vn$/u.test(hostname) ||
    /(^|\.)(reddit|quora)\.com$/u.test(hostname) ||
    /(^|\.)(blog|cafe)\.naver\.com$/u.test(hostname) ||
    /(wiki|백과|encyclopedia|forum|thread|translate|번역|windows|pc\s*reset|pc\s*초기화|os\s*help)/iu.test(haystack)
  );
}

function hasStrongDomainMatch(source: WebSearchReadOnlySourceResult, plan: PlannedPublicWebSearchQueries) {
  const haystack = sourceHaystack(source);
  const planText = `${plan.researchObjective} ${plan.coreTerms.join(" ")}`;

  if (/(?:이혼|divorce|separation)/iu.test(planText)) {
    return /이혼|divorce|separation/iu.test(haystack) &&
      /(재무|현금|현금흐름|생계비|runway|유료|결제|상담|후기|대체재|비용|financial|cash|pricing|paid|alternative|review)/iu.test(haystack);
  }

  if (/(?:반려\s*동물|반려견|반려묘|펫\b|pet\b)/iu.test(planText)) {
    return /반려\s*동물|반려견|반려묘|펫\b|pet\b/iu.test(haystack) &&
      /(의료|보험|돌봄|보호자|장례|후기|비용|veterinary|insurance|care|owner|pricing|review)/iu.test(haystack);
  }

  return false;
}

function sourceRelevanceDecision(source: WebSearchReadOnlySourceResult, plan: PlannedPublicWebSearchQueries) {
  const haystack = sourceHaystack(source);
  const coreMatches = matchingTerms(haystack, plan.coreTerms);
  const intentMatches = matchingTerms(haystack, plan.intentTerms);
  const minimumCoreMatches = Math.min(2, Math.max(1, plan.coreTerms.length));
  const strongDomainMatch = hasStrongDomainMatch(source, plan);
  const lowQualityNoise = isLowQualityNoiseSource(source);
  const relevant = (coreMatches.length >= minimumCoreMatches && intentMatches.length >= 1) || strongDomainMatch;

  if (!relevant) {
    return { usable: false, reason: "core/intent relevance 기준을 충족하지 못한 검색 노이즈" };
  }

  if (lowQualityNoise && !strongDomainMatch) {
    return { usable: false, reason: "위키/백과/OS 도움말/포럼 계열 결과라 결정 근거로 쓰지 않음" };
  }

  return { usable: true, reason: "core/intent relevance 기준 통과" };
}

function findingLabelForSource(source: WebSearchReadOnlySourceResult): ReviewedPublicWebSource["findingLabel"] {
  const text = source.snippet.toLowerCase();

  if (/(반례|우려|대체재|무료|충분|낮은|거부|부담|risk|counter|alternative|free|enough|low willingness)/iu.test(text)) {
    return "weakens";
  }

  if (/(결제\s*의향|유료\s*의향|가입|상담|후기|재방문|반복\s*사용|willingness to pay|paid|subscription|repeat use|pricing)/iu.test(text)) {
    return "supports";
  }

  return "uncertain";
}

function findingFromSource(source: WebSearchReadOnlySourceResult) {
  const snippet = normalizedText(source.snippet);
  const sentences = snippet.match(/[^.!?。！？]+[.!?。！？]?/gu) ?? [snippet];
  const decisionSentence = sentences.find((sentence) =>
    /(이혼|재무|현금|생계비|유료|결제|상담|후기|대체재|가격|비용|반려|보험|의료|돌봄|보호자|통계|리포트|니즈|willingness|paid|pricing|alternative|review|cash|financial|pet|guardian|veterinary|insurance|care|founder|validation|workflow|question|counter-evidence|quality-gate)/iu.test(sentence)
  );

  return decisionSentence
    ? truncateText(decisionSentence, 240)
    : snippet
      ? truncateText(sentences[0] ?? snippet, 240)
      : null;
}

function sourceUtilityCheck(source: WebSearchReadOnlySourceResult): SourceUtilityCheck {
  const haystack = sourceHaystack(source);
  const hostname = (() => {
    try {
      return new URL(source.url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const institutionality =
    /(?:\.gov$|\.go\.kr$|\.edu$|\.ac\.kr$|\.or\.kr$|kosis\.kr$|statista\.com$|mckinsey\.com$|gartner\.com$|pewresearch\.org$)/iu.test(hostname)
      ? "strong"
      : /(?:\.org$|\.or\.|research|institute|association|협회|연구원|공단|공사|agency)/iu.test(haystack)
        ? "medium"
        : "weak";
  const freshness = /(?:202[4-6]|[1-9]\s*(?:days?|weeks?|months?)\s*ago|[1-9]\s*(?:일|주|개월)\s*전|최근|latest|updated)/iu.test(haystack)
    ? "current"
    : /(?:201\d|202[0-3]|오래된|archived|archive)/iu.test(haystack)
      ? "dated"
      : "unknown";
  const sampleContext =
    /(?:조사|통계|리포트|보고서|사례|표본|응답자|인터뷰|설문|survey|sample|respondents?|interviews?|case\s*study|report|statistics?)/iu.test(haystack);
  const userBehaviorSignal =
    /(?:후기|리뷰|가입|결제|구매|재방문|반복\s*사용|대체재|가격|상담|willingness\s*to\s*pay|paid|subscription|pricing|purchase|repeat\s*use|reviews?|alternatives?)/iu.test(haystack);
  const score =
    (institutionality === "strong" ? 1 : 0) +
    (freshness === "current" ? 1 : 0) +
    (sampleContext ? 1 : 0) +
    (userBehaviorSignal ? 1 : 0);

  return {
    score,
    institutionality,
    freshness,
    sampleContext,
    userBehaviorSignal
  };
}

function reviewPublicWebSources(
  sources: readonly WebSearchReadOnlySourceResult[],
  plan: PlannedPublicWebSearchQueries
) {
  return sources.map((source): ReviewedPublicWebSource => {
    const decision = sourceRelevanceDecision(source, plan);

    if (!decision.usable) {
      return { source, finding: null, findingLabel: null, rejectReason: decision.reason };
    }

    const finding = findingFromSource(source);

    if (!finding) {
      return {
        source,
        finding: null,
        findingLabel: null,
        rejectReason: "source 내용에서 결정에 연결되는 짧은 finding을 추출하지 못함"
      };
    }

    return {
      source,
      finding,
      findingLabel: findingLabelForSource(source),
      sourceUtility: sourceUtilityCheck(source)
    };
  });
}

function sourceUtilityLine(review: ReviewedPublicWebSource) {
  const utility = review.sourceUtility;

  if (!utility) {
    return `- ${review.source.title}: score 0/4 (rejected or insufficient source context)`;
  }

  return `- ${review.source.title}: score ${utility.score}/4 (institutionality=${utility.institutionality}, freshness=${utility.freshness}, sample_context=${utility.sampleContext ? "yes" : "no"}, user_behavior_signal=${utility.userBehaviorSignal ? "yes" : "no"})`;
}

function summaryForSources(
  plan: PlannedPublicWebSearchQueries,
  queries: readonly string[],
  reviewedSources: readonly ReviewedPublicWebSource[],
  limitationLines: readonly string[]
) {
  const usableSources = reviewedSources.filter((review) => review.finding && review.findingLabel);
  const rejectedSources = reviewedSources.filter((review) => review.rejectReason);
  const rejectedReasons = uniqueSearchTerms(
    rejectedSources.map((review) => review.rejectReason ?? "관련성 또는 품질 기준 미달"),
    3
  );
  const findingLines = usableSources.length
    ? usableSources.map((review) =>
        `- [${review.findingLabel}] ${review.finding} — ${review.source.title} ${review.source.url}`
      )
    : ["- usable finding 없음"];
  const supportCount = usableSources.filter((review) => review.findingLabel === "supports").length;
  const counterCount = usableSources.filter((review) => review.findingLabel === "weakens").length;
  const undecidableCount = usableSources.filter((review) => review.findingLabel === "uncertain").length;
  const summary = [
    "Research objective:",
    plan.researchObjective,
    "Decision reversal target:",
    "이 결과는 자료를 많이 모으는 것이 아니라 현재 결정을 뒤집거나 범위를 줄일 수 있는 근거를 찾는 데 쓰입니다.",
    "Queries used:",
    ...queries.map((query) => `- ${query}`),
    "Evidence classification:",
    `- support_evidence: ${supportCount}`,
    `- counter_or_alternative: ${counterCount}`,
    `- still_undecidable: ${undecidableCount}`,
    "Usable findings:",
    ...findingLines,
    "Source utility checks:",
    ...(usableSources.length ? usableSources.map(sourceUtilityLine) : ["- score 0/4: usable source-linked finding이 없어 기관성/최신성/표본 맥락/행동 신호를 평가하지 못했습니다."]),
    "Rejected noise:",
    `- count: ${rejectedSources.length}`,
    ...rejectedReasons.map((reason) => `- ${reason}`),
    "Limitations:",
    ...(usableSources.length ? limitationLines : ["- source_quality_insufficient: usable source-linked finding이 없어 공개 검색 결과만으로 판단하지 않습니다.", ...limitationLines]),
    "리서치 실패가 의미하는 것:",
    usableSources.length
      ? "출처가 있어도 반례 수와 소스 유틸리티 점수가 약하면 Planning-ready 근거로 바로 쓰지 않습니다."
      : "공개 검색에서 유의미한 출처를 못 찾았다는 것은 수요가 없다는 뜻이 아니라, 검색어/출처 범위/비공개 사용자 맥락을 수동으로 다시 검증해야 한다는 뜻입니다.",
    "Manual validation action:",
    usableSources.length
      ? "약한 출처는 기관 리포트, 공개 리뷰, 가격/가입 행동 신호, 직접 인터뷰 중 하나로 보강합니다."
      : "검색어를 바꿔 공개 리포트/커뮤니티/대체재 리뷰를 수동 확인하거나, 타깃 사용자 3명에게 현재 대체 행동과 지불 의향을 직접 확인합니다.",
    "Human decision needed:",
    usableSources.length
      ? "finding은 품질 게이트 검토 뒤 스펙/질문 판단에 연결해야 합니다."
      : "공개 리서치에서 유의미한 근거를 찾지 못했으니 사용자가 직접 판단/검증 기준을 정해야 합니다."
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

function isNonPublicIpv4Address(hostname: string) {
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

function ipv4AddressFromIpv6Suffix(suffix: string) {
  if (isIP(suffix) === 4) {
    return suffix;
  }

  const hextets = suffix.split(":");

  if (hextets.length !== 2 || hextets.some((hextet) => !/^[\da-f]{1,4}$/iu.test(hextet))) {
    return null;
  }

  const [high = Number.NaN, low = Number.NaN] = hextets.map((hextet) => Number.parseInt(hextet, 16));

  if (!Number.isInteger(high) || !Number.isInteger(low)) {
    return null;
  }

  return `${Math.floor(high / 256)}.${high % 256}.${Math.floor(low / 256)}.${low % 256}`;
}

function ipv4AddressFromEmbeddedIpv6(hostname: string) {
  if (hostname.startsWith("::ffff:")) {
    return ipv4AddressFromIpv6Suffix(hostname.slice("::ffff:".length));
  }

  if (hostname.startsWith("::")) {
    return ipv4AddressFromIpv6Suffix(hostname.slice("::".length));
  }

  return null;
}

function firstIpv6Hextet(hostname: string) {
  const [first] = hostname.split(":");

  if (!first || !/^[\da-f]{1,4}$/iu.test(first)) {
    return null;
  }

  return Number.parseInt(first, 16);
}

function isNonPublicIpv6Address(hostname: string) {
  const embeddedIpv4 = ipv4AddressFromEmbeddedIpv6(hostname);
  const first = firstIpv6Hextet(hostname);
  const isLinkLocal = first !== null && first >= 0xfe80 && first <= 0xfebf;
  const isUniqueLocal = first !== null && first >= 0xfc00 && first <= 0xfdff;
  const isMulticast = first !== null && first >= 0xff00 && first <= 0xffff;
  const isDiscardOnly = first === 0x0100;

  return (
    Boolean(embeddedIpv4 && isNonPublicIpv4Address(embeddedIpv4)) ||
    hostname === "::" ||
    hostname === "::1" ||
    hostname.startsWith("2001:db8:") ||
    isLinkLocal ||
    isUniqueLocal ||
    isMulticast ||
    isDiscardOnly
  );
}

function isPublicIpAddress(value: string) {
  const hostname = normalizedHostname(value);
  const ipVersion = isIP(hostname);

  if (ipVersion === 4) {
    return !isNonPublicIpv4Address(hostname);
  }

  if (ipVersion === 6) {
    return !isNonPublicIpv6Address(hostname);
  }

  return false;
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

    if (ipVersion) {
      return isPublicIpAddress(hostname);
    }

    return true;
  } catch {
    return false;
  }
}

function isLocalCorpusUrl(value: string) {
  return value.startsWith("local-corpus://");
}

async function isPublicFetchTargetUrl(value: string) {
  if (!isPublicHttpUrl(value)) {
    return false;
  }

  try {
    const hostname = normalizedHostname(new URL(value).hostname);

    if (isIP(hostname)) {
      return isPublicIpAddress(hostname);
    }

    const addresses = await lookup(hostname, { all: true });

    return addresses.length > 0 && addresses.every(({ address }) => isPublicIpAddress(address));
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

    return /(^|\.)duckduckgo\.com$|(^|\.)bing\.com$|(^|\.)google\.com$|(^|\.)google\.co\.kr$|(^|\.)naver\.com$/iu.test(url.hostname);
  } catch {
    return true;
  }
}

function publicSourceResults(sources: readonly WebSearchReadOnlySourceResult[]) {
  return sources
    .filter((source) => isPublicHttpUrl(source.url) || isLocalCorpusUrl(source.url))
    .map((source) => {
      const title = truncateText(cleanSearchResultTitle(source.title, source.url), 180);

      return {
        ...source,
        title,
        snippet: truncateText(cleanSearchResultSnippet(source.snippet, title), MAX_SNIPPET_CHARS)
      };
    });
}

async function listCorpusFiles(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = join(root, entry.name);

    if (entry.isDirectory()) {
      return listCorpusFiles(absolutePath);
    }

    if (!entry.isFile()) {
      return [];
    }

    const extension = extname(entry.name).toLowerCase();

    return extension === ".md" || extension === ".txt" || extension === ".pdf" ? [absolutePath] : [];
  }));

  return files.flat();
}

function extractBestEffortPdfText(buffer: Buffer) {
  return buffer
    .toString("latin1")
    .replaceAll(/\\[nrt]/gu, " ")
    .replaceAll(/[^\p{Letter}\p{Number}\s.,:;!?()[\]_-]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

async function readCorpusText(path: string) {
  const extension = extname(path).toLowerCase();
  const buffer = await readFile(path);
  const text = extension === ".pdf" ? extractBestEffortPdfText(buffer) : buffer.toString("utf8");

  return normalizedText(text);
}

function corpusTermsFor(input: WebSearchReadOnlySearchInput) {
  return relevanceTermsForQuery(input.query);
}

function corpusScore(text: string, title: string, terms: readonly string[]) {
  const lowerText = text.toLowerCase();
  const lowerTitle = title.toLowerCase();

  return terms.reduce((score, term) => {
    if (lowerTitle.includes(term)) {
      return score + 4;
    }

    const matches = lowerText.match(new RegExp(escapeRegExp(term), "giu"))?.length ?? 0;

    return score + Math.min(matches, 5);
  }, 0);
}

function snippetForCorpusText(text: string, terms: readonly string[]) {
  const lowerText = text.toLowerCase();
  const firstIndex = terms
    .map((term) => lowerText.indexOf(term.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;
  const start = Math.max(0, firstIndex - 120);

  return truncateText(text.slice(start, start + MAX_SNIPPET_CHARS), MAX_SNIPPET_CHARS);
}

function localCorpusUrl(root: string, path: string) {
  const relativePath = path.slice(root.length).replace(/^[/\\]+/u, "").split("\\").join("/");

  return `local-corpus://${encodeURIComponent(relativePath)}`;
}

export async function runLocalCorpusSearch(
  localCorpusDir: string,
  input: WebSearchReadOnlySearchInput
): Promise<readonly WebSearchReadOnlySourceResult[]> {
  const root = resolve(localCorpusDir);
  const rootStat = await stat(root).catch(() => null);

  if (!rootStat?.isDirectory()) {
    throw new WebSearchReadOnlyAdapterError(
      "no_public_results",
      `Local research corpus directory does not exist or is not a directory: ${root}`
    );
  }

  const terms = corpusTermsFor(input);
  const scored = await Promise.all((await listCorpusFiles(root)).map(async (path) => {
    const text = await readCorpusText(path);
    const title = basename(path);

    return {
      path,
      text,
      title,
      score: corpusScore(text, title, terms)
    };
  }));
  const selected = scored
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.maxResults);

  if (!selected.length) {
    throw new WebSearchReadOnlyAdapterError(
      "no_public_results",
      `No Markdown, TXT, or best-effort PDF corpus files matched the research terms in ${root}.`
    );
  }

  return selected.map((candidate) => ({
    title: candidate.title,
    url: localCorpusUrl(root, candidate.path),
    snippet: snippetForCorpusText(candidate.text, terms),
    retrievedAt: input.now()
  }));
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

function relevanceTermsForQuery(query: string) {
  const stopwords = new Set([
    "research",
    "objective",
    "market",
    "public",
    "evidence",
    "조사",
    "통계",
    "시장",
    "사례",
    "니즈",
    "관리",
    "준비"
  ]);

  return [
    ...new Set(
      (query.match(/[가-힣a-z0-9]{2,}/giu) ?? [])
        .map((term) => term.toLowerCase())
        .filter((term) => !stopwords.has(term))
    )
  ].slice(0, 20);
}

function searchCandidateRelevanceScore(candidate: SearchCandidate, query: string) {
  const terms = relevanceTermsForQuery(query);
  const title = candidate.title.toLowerCase();
  const haystack = `${candidate.title} ${candidate.snippet} ${candidate.url}`.toLowerCase();

  return terms.reduce((score, term) => {
    if (title.includes(term)) {
      return score + 3;
    }

    if (haystack.includes(term)) {
      return score + 1;
    }

    return score;
  }, 0);
}

function searchCandidateSourceQualityScore(candidate: SearchCandidate) {
  const haystack = `${candidate.title} ${candidate.snippet}`.toLowerCase();
  const hostname = (() => {
    try {
      return new URL(candidate.url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  let score = 0;

  if (/(^|\.)go\.kr$/u.test(hostname) || /(^|\.)gov$/u.test(hostname) || /(^|\.)gov\./u.test(hostname)) {
    score += 12;
  }

  if (/(^|\.)(ac\.kr|edu)$/u.test(hostname) || /(^|\.)edu\./u.test(hostname)) {
    score += 8;
  }

  if (/(^|\.)(or\.kr|org)$/u.test(hostname) || /(^|\.)org\./u.test(hostname)) {
    score += 4;
  }

  if (/(통계|실태|현황|조사|보고서|리포트|연구|market\s*research|statistics|survey|report|study)/iu.test(haystack)) {
    score += 6;
  }

  if (/(보호자|동물병원|의료\s*기록|보험\s*청구|돌봄|의료비|보험|니즈|소상공인|예약|카카오톡|노쇼|주문|단골|미용실|네일|음식점|매장|이혼|재무|현금|현금흐름|생계비|결제|유료|상담|후기|대체재|segment|persona|need|care|insurance|veterinary|merchant|reservation|order|loyalty|no-show|divorce|financial|cash|pricing|paid|alternative|review)/iu.test(haystack)) {
    score += 3;
  }

  if (
    /\bpet\b/iu.test(haystack) &&
    /(검사|암|뇌질환|ct|mri|양전자|tomography|scan|oncology|brain)/iu.test(haystack) &&
    !/(반려|보호자|동물병원|수의|veterinary|guardian|insurance|care|lifecycle|record)/iu.test(haystack)
  ) {
    score -= 16;
  }

  if (
    /(^|\.)namu\.wiki$/u.test(hostname) ||
    /(^|\.)wikipedia\.org$/u.test(hostname) ||
    /(^|\.)zhihu\.com$/u.test(hostname) ||
    /(^|\.)tinhte\.vn$/u.test(hostname) ||
    /(^|\.)(reddit|quora)\.com$/u.test(hostname) ||
    /(^|\.)(blog|cafe)\.naver\.com$/u.test(hostname)
  ) {
    score -= 12;
  }

  if (/(wiki|forum|thread|translate|번역)/iu.test(haystack)) {
    score -= 4;
  }

  return score;
}

export function rankedSearchCandidates(
  candidates: readonly WebSearchReadOnlySearchCandidate[],
  query: string,
  maxResults: number
) {
  const scoredCandidates = candidates.map((candidate) => ({
    candidate,
    relevanceScore: searchCandidateRelevanceScore(candidate, query),
    sourceQualityScore: searchCandidateSourceQualityScore(candidate)
  }));
  const hasPositiveQualityCandidate = scoredCandidates.some(({ sourceQualityScore }) => sourceQualityScore > 0);

  return scoredCandidates
    .filter(
      ({ relevanceScore, sourceQualityScore }) =>
        relevanceScore > 0 &&
        (!hasPositiveQualityCandidate || sourceQualityScore >= 0)
    )
    .sort(
      (left, right) =>
        right.relevanceScore + right.sourceQualityScore - (left.relevanceScore + left.sourceQualityScore)
    )
    .slice(0, maxResults)
    .map(({ candidate }) => candidate);
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
        snippet: candidate.snippet,
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
      snippet: candidate.snippet,
      retrievedAt: now()
    };
  }
}

async function closeBrowser(browser: Browser | null, context: BrowserContext | null) {
  await context?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}

function searchUrlsForQuery(query: string, engine: WebSearchReadOnlySearchEngine = "duckduckgo") {
  const encodedQuery = encodeURIComponent(query);

  switch (engine) {
    case "bing":
      return [`https://www.bing.com/search?q=${encodedQuery}`, `https://html.duckduckgo.com/html/?q=${encodedQuery}`];
    case "google.co.kr":
      return [`https://www.google.co.kr/search?q=${encodedQuery}&hl=ko`, `https://html.duckduckgo.com/html/?q=${encodedQuery}`];
    case "naver":
      return [`https://search.naver.com/search.naver?query=${encodedQuery}`, `https://html.duckduckgo.com/html/?q=${encodedQuery}`];
    case "duckduckgo":
      return [`https://html.duckduckgo.com/html/?q=${encodedQuery}`, `https://www.bing.com/search?q=${encodedQuery}`];
  }
}

function searchEngineForRegion(region: string | undefined): WebSearchReadOnlySearchEngine | undefined {
  if (!region) {
    return undefined;
  }

  if (/^(?:kr|ko|ko[-_]kr|korea|south\s*korea|republic\s*of\s*korea)$/iu.test(region.trim())) {
    return "google.co.kr";
  }

  return undefined;
}

async function readSearchCandidates(page: Page, input: WebSearchReadOnlySearchInput) {
  let lastSearchBlocker: WebSearchReadOnlyAdapterError | null = null;
  const uniqueCandidates = new Map<string, SearchCandidate>();

  for (const searchUrl of searchUrlsForQuery(input.query, input.searchEngine)) {
    try {
      await delay(input.delayMillis());
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: input.timeoutMillis });
      await page.waitForLoadState("domcontentloaded", { timeout: input.timeoutMillis }).catch(() => undefined);
      await page.waitForLoadState("networkidle", { timeout: Math.min(input.timeoutMillis, 5_000) }).catch(() => undefined);

      const searchText = await pageText(page);

      if (hasCaptchaOrAntiBotText(searchText)) {
        lastSearchBlocker = new WebSearchReadOnlyAdapterError(
          "captcha_or_antibot_required",
          "Public web search was blocked by CAPTCHA or anti-bot verification; no bypass was attempted."
        );
        continue;
      }

      const candidates = await extractSearchCandidates(page, Math.max(input.maxResults * 2, input.maxResults));

      for (const candidate of candidates) {
        if (!uniqueCandidates.has(candidate.url)) {
          uniqueCandidates.set(candidate.url, candidate);
        }
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

  if (uniqueCandidates.size > 0) {
    return rankedSearchCandidates([...uniqueCandidates.values()], input.query, input.maxResults);
  }

  throw lastSearchBlocker ?? new WebSearchReadOnlyAdapterError(
    "no_public_results",
    "No public search results were readable from the browser search page."
  );
}

async function publicFetchCandidates(candidates: readonly SearchCandidate[]) {
  const publicCandidates: SearchCandidate[] = [];

  for (const candidate of candidates) {
    if (await isPublicFetchTargetUrl(candidate.url)) {
      publicCandidates.push(candidate);
    }
  }

  return publicCandidates;
}

async function fetchPublicCandidatePages(
  page: Page,
  candidates: readonly SearchCandidate[],
  input: WebSearchReadOnlySearchInput
) {
  const sources: WebSearchReadOnlySourceResult[] = [];

  for (const candidate of candidates.slice(0, input.maxFetchedPages)) {
    await delay(input.delayMillis());
    const fetched = await fetchCandidatePage(page, candidate, input.timeoutMillis, input.now);

    if (fetched) {
      sources.push(fetched);
    }
  }

  return sources.length > 0 ? sources : candidates.map((candidate) => ({ ...candidate, retrievedAt: input.now() }));
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
      locale: input.language === "ko" ? "ko-KR" : "en-US",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 SoloSupermanReadOnlyResearch/1.0"
    });
    const page = await context.newPage();
    const candidates = await readSearchCandidates(page, input);
    const publicCandidates = await publicFetchCandidates(candidates);

    return fetchPublicCandidatePages(page, publicCandidates, input);
  } catch (error) {
    if (error instanceof WebSearchReadOnlyAdapterError) {
      if (error.code === "no_public_results") {
        return [];
      }

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
  const search = options.search ??
    (options.localCorpusDir
      ? (input: WebSearchReadOnlySearchInput) => runLocalCorpusSearch(options.localCorpusDir as string, input)
      : runPlaywrightPublicWebSearch);
  const searchEngine = options.searchEngine ?? searchEngineForRegion(options.region) ?? "duckduckgo";
  const configuredLanguage = options.language;

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

      const plan = planPublicWebSearchQueries(input.disclosurePayload, run);
      const allSources = new Map<string, WebSearchReadOnlySourceResult>();

      for (const query of plan.queries) {
        const querySources = publicSourceResults(await search({
          query,
          language: configuredLanguage ?? plan.language,
          searchEngine,
          maxResults,
          maxFetchedPages,
          timeoutMillis,
          delayMillis,
          now
        }));

        for (const source of querySources) {
          if (!allSources.has(source.url)) {
            allSources.set(source.url, source);
          }
        }
      }

      const sources = [...allSources.values()];
      const limitations = [
        "Only publicly reachable web pages were checked; login-only, paid, CAPTCHA, and anti-bot-blocked pages were not used.",
        "Search snippets and available page text may be incomplete, so important claims still need follow-up confirmation.",
        `Random delay range was ${delayRange.min}-${delayRange.max}ms with at most ${maxFetchedPages} fetched public page(s).`
      ];
      const reviewedSources = reviewPublicWebSources(sources, plan);
      const usableSources = reviewedSources
        .filter((review) => review.finding && review.findingLabel)
        .map((review) => review.source);
      const primarySource = usableSources[0];

      return {
        status: "needs_review",
        providerRunId: run.provider.providerRunId ?? providerRunIdFor(run),
        completedAt: now(),
        ...(primarySource ? { sourceTitle: primarySource.title, sourceUrl: primarySource.url } : {}),
        summary: summaryForSources(plan, plan.queries, reviewedSources, limitations),
        limitations,
        sourceRefs: sourceRefsFor(run, usableSources)
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
