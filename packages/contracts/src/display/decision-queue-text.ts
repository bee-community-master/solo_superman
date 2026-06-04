export type DecisionQueueDisplayLanguage = "en" | "ja" | "ko";

const DECISION_QUEUE_PRODUCT_TERM_REPLACEMENTS: readonly (readonly [RegExp, string])[] = [
  [/\bcurrent public evidence\b/giu, "현재 공개 근거"],
  [/가장\s+먼저\s+검증할\s+primary customer/giu, "가장 먼저 검증할 고객/사용자"],
  [/첫\s+Build Slice/giu, "첫 구현 범위"],
  [/\bprimary customer\b/giu, "핵심 고객/사용자"],
  [/\bWhat evidence would resolve\b/giu, "어떤 근거가 판단을 좁힐 수 있는지"],
  [/\bValidate evidence for:\s*/giu, ""],
  [/\bFind decision evidence for:\s*/giu, ""],
  [/\bFind decision 근거 for:\s*/giu, ""],
  [/\bFind evidence for:\s*/giu, ""],
  [/\bBroaden research beyond existing notes for:\s*/giu, "기존 리서치 메모를 넘어 더 넓게 확인: "],
  [/\bBroaden research for:\s*/giu, "더 넓게 확인: "],
  [/\bcollect wider sources and counter-evidence\b/giu, "더 넓은 출처와 반례를 수집"],
  [/\busable source-linked finding\b/giu, "출처와 연결된 유의미한 근거"],
  [/\bsource-linked finding\b/giu, "출처 연결 근거"],
  [/\bcounter-evidence\b/giu, "반례"],
  [/\bMVP Scope\b/gu, "첫 버전 범위"],
  [/\bSuccess Criteria\b/gu, "성공 기준"],
  [/\bValidation Plan\b/gu, "확인 계획"],
  [/\bTarget Customer\b/gu, "첫 고객/사용자"],
  [/\bValue Proposition\b/gu, "사용자가 선택할 이유"],
  [/\bCurrent Alternatives\b/gu, "현재 쓰는 대안"],
  [/\bFounder Brief\b/gu, "창업자 요약"],
  [/\bPlanning Handoff\b/gu, "구현 계획 넘기기"],
  [/\bEvidence Matrix\b/gu, "근거 표"],
  [/\bDifferentiation\b/gu, "차별점"],
  [/\bNon-goals\b/gu, "이번에 하지 않을 일"],
  [/\bvalue proposition\b/giu, "사용자가 선택할 이유"],
  [/\bvalidation plan\b/giu, "확인 계획"],
  [/\binterview target\b/giu, "인터뷰 대상"],
  [/\bpain threshold\b/giu, "불편 기준"],
  [/\bproblem\b/giu, "문제"],
  [/\bacquisition\b/giu, "고객 모집"],
  [/\bhandoff\b/giu, "전달"],
  [/\bevidence\b/giu, "근거"],
  [/\bBuild Slice\b/giu, "구현 범위"],
  [/\bMVP\b/gu, "첫 버전"],
  [/\bretention proxy\b/giu, "반복해서 쓸 만하다는 신호"],
  [/\bcustomer lock-in\b/giu, "고객을 성급하게 확정하는 일"],
  [/\bwillingness-to-pay\b/giu, "돈을 낼 이유"],
  [/\bpaid intent decision\b/giu, "돈을 낼 사람에 대한 판단"],
  [/\bpaid intent\b/giu, "돈을 낼 이유"],
  [/\bcore-assumption risk\b/giu, "핵심 가설 리스크"],
  [/\bsource_quality_insufficient\b/giu, "출처 품질 부족"],
  [/\bassumption_pressure\b/giu, "가설 압박"]
];

const PUBLIC_RESEARCH_SNIPPET_REPLACEMENTS: readonly (readonly [RegExp, string])[] = [
  [
    /\bUse this divorce financial planning checklist to organize your cash flow, documents, insurance, account updates, and next-step planning during and after divorce\.?/giu,
    "이혼 전후의 현금 흐름, 서류, 보험, 계좌 업데이트, 다음 계획을 정리하는 재무 체크리스트입니다."
  ],
  [/\b(\d+)\s+days?\s+ago\s*[·-]\s*/giu, "최근 공개 검색 요약: "],
  [/\bcash flow\b/giu, "현금 흐름"],
  [/\bdocuments\b/giu, "서류"],
  [/\binsurance\b/giu, "보험"],
  [/\baccount updates\b/giu, "계좌 업데이트"],
  [/\bnext-step planning\b/giu, "다음 계획"],
  [/\bduring and after divorce\b/giu, "이혼 전후"],
  [/\bpublic web research\b/giu, "공개 웹 리서치"],
  [/\bhuman decision\b/giu, "사용자 판단"],
  [/\bsource freshness\b/giu, "출처 최신성"],
  [/\blimitations?\b/giu, "한계"],
  [/\bcounterexamples?\b/giu, "반례"],
  [/\bother perspectives?\b/giu, "다른 관점"]
];

const DECISION_QUEUE_STATUS_TERM_REPLACEMENTS: readonly (readonly [RegExp, string])[] = [
  [/\bimplementation-ready\b/giu, "구현 준비 완료"],
  [/\bprice proxy\b/giu, "가격 확인 방법"],
  [/\bproxy\b/giu, "행동 신호"],
  [/\bwas not found\b/giu, "찾지 못했습니다"],
  [/\bDecision Queue burn-down\b/gu, "질문 목록 처리"],
  [/\bNext Validation Action\b/gu, "다음 검증 작업"],
  [/\bvalidation action\b/giu, "검증 작업"],
  [/\bKnown Risk\b/gu, "다음 확인 리스크"],
  [/\blegal\/ops\/security\b/giu, "법무/운영/보안"],
  [/\bscope creep\b/giu, "범위가 계속 커지는 문제"],
  [/\bresearch_needed\b/giu, "리서치 필요"],
  [/\bhigh-impact gate\b/giu, "중요 검증 기준"],
  [/\bplanning-ready\b/giu, "계획 준비 완료"],
  [/\bSpec section\b/giu, "스펙 항목"],
  [/\bcompletion gate\b/giu, "완성 기준"],
  [/\btradeoff\b/giu, "장단점"],
  [/\bpro\/con\b/giu, "찬반"],
  [/\bowner\/date\b/giu, "담당자/날짜"],
  [/\bconfidence\b/giu, "확신도"],
  [/\bpivot\b/giu, "방향 전환"],
  [/\bworkflow는/giu, "작업 흐름은"],
  [/\bworkflow가/giu, "작업 흐름이"],
  [/\bworkflow를/giu, "작업 흐름을"],
  [/\bworkflow와/giu, "작업 흐름과"],
  [/\bworkflow의/giu, "작업 흐름의"],
  [/\bworkflow\b/giu, "작업 흐름"],
  [/\bflow\b/giu, "흐름"],
  [/\bGUI\b/gu, "화면 UI"],
  [/\bCLI\b/gu, "명령어 방식"],
  [/\bdaemon\b/giu, "상시 실행 프로그램"],
  [/\blocal data\b/giu, "내 컴퓨터의 데이터"],
  [/\bsecret\b/giu, "비밀값/토큰"],
  [/\bscope\b/giu, "범위"],
  [/\breadiness\b/giu, "준비 상태"],
  [/\bdecision\b/giu, "판단"],
  [/\bsection\b/giu, "항목"],
  [/\bclaim\b/giu, "주장"]
];

const USER_FACING_DECISION_QUEUE_TERM_REPLACEMENTS: readonly (readonly [RegExp, string])[] = [
  ...DECISION_QUEUE_PRODUCT_TERM_REPLACEMENTS,
  ...PUBLIC_RESEARCH_SNIPPET_REPLACEMENTS,
  ...DECISION_QUEUE_STATUS_TERM_REPLACEMENTS
];

const INTERNAL_RESEARCH_META_REPLACEMENTS: readonly RegExp[] = [
  /\bPage body could not be fetched before timeout;?\s*/giu,
  /\bFull page text was unavailable before timeout, so only the search-result summary is shown\.?/giu,
  /\b(?:search-result|rch-result|result)\s+snippet retained for review\.?/giu,
  /\bsnippet retained for review\.?/giu,
  /\bSource snippets and fetched page text require quality-gate review before accepted (?:evidence|근거)\.?/giu,
  /\bSource snippets and fetched page text require review before accepted (?:evidence|근거)\.?/giu,
  /\bBrowser search snippets can be incomplete; quality-gate review must verify claims before acceptance\.?/giu,
  /\bBrowser search snippets can be incomplete;?\s*/giu,
  /\bSearch snippets and available page text may be incomplete, so important claims still need follow-up confirmation\.?/giu,
  /\bOnly publicly reachable web pages were checked; login-only, paid, CAPTCHA, and anti-bot-blocked pages were not used\.?/giu,
  /\bquality-gate review must verify claims before acceptance\.?/giu,
  /\bquality-gate review before accepted (?:evidence|근거)\.?/giu,
  /\bPublic page opened, but readable body text was blocked by a login, CAPTCHA, or anti-bot interstitial\.?/giu,
  /\bBrowser-based public web search only; no login, CAPTCHA, anti-bot bypass, paid-service access, or external search API was used\.?/giu,
  /\bRandom delay range was \d+-\d+ms with at most \d+ fetched public page\(s\)\.?/giu,
  /\bPublic web research completed for [^.。!?]+[.。!?]?/giu,
  /\bQuery:\s*[^.。!?]+[.。!?]?/giu,
  /\bSources reviewed:\s*\d+[.。!?]?/giu,
  /\bPro:\s*At least one public source was reachable through a read-only browser search\.?/giu,
  /\bLimitation:\s*Browser search snippets can be incomplete;?\s*/giu,
  /\b(?:Pro|Con|Limitation):\s*$/giu,
  /\bread-only browser search\.?/giu,
  /\bread-only public web search\.?/giu
];

function stripInternalResearchMetaLine(line: string) {
  return INTERNAL_RESEARCH_META_REPLACEMENTS.reduce(
    (current, pattern) => current.replace(pattern, ""),
    line
  )
    .replace(/\s+([.。!?])/gu, "$1")
    .trim();
}

export function stripInternalResearchMetaText(value: string) {
  return value
    .split(/\r?\n/u)
    .map(stripInternalResearchMetaLine)
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function plainUserFacingDecisionQueueText(text: string) {
  return USER_FACING_DECISION_QUEUE_TERM_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text
  );
}

export function localizedUserFacingDecisionQueueText(
  text: string,
  language: DecisionQueueDisplayLanguage
) {
  const stripped = stripInternalResearchMetaText(text);

  if (language !== "ko") {
    return stripped;
  }

  return plainUserFacingDecisionQueueText(stripped)
    .replace(/한계와\s+불확실성은\s*([^.\n。]+)(?:입니다)?\.?/gu, "한계/불확실성: $1")
    .trim();
}
