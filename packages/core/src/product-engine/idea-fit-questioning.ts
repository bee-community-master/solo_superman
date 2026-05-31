import type { AmbiguityReductionDimension, AmbiguityAnswerOption } from "@solo-superman/contracts";
import { AMBIGUITY_REDUCTION_DIMENSIONS } from "@solo-superman/contracts";
import { plainUserFacingDecisionQueueText } from "./user-facing-text";

export interface IdeaFitQuestioningInput {
  readonly rawIdea?: string;
  readonly intakeGoal?: string;
}

export interface IdeaFitDomainSignals {
  readonly sourceText: string;
  readonly actors: readonly string[];
  readonly users: readonly string[];
  readonly buyers: readonly string[];
  readonly artifacts: readonly string[];
  readonly jobs: readonly string[];
  readonly pains: readonly string[];
  readonly constraints: readonly string[];
  readonly channels: readonly string[];
  readonly explicitExclusions: readonly string[];
  readonly domainTerms: readonly string[];
}

export interface IdeaFitDimensionScore {
  readonly dimension: AmbiguityReductionDimension;
  readonly clarityScore: number;
  readonly riskScore: number;
  readonly reasons: readonly string[];
}

const DIMENSION_FLOOR_GATE_PRIORITY: readonly AmbiguityReductionDimension[] = [
  "goal",
  "scope",
  "decision_authority",
  "success_criteria",
  "constraints",
  "assumption_pressure",
  "context"
] as const;

const GENERIC_DOMAIN_TERMS = new Set([
  "앱",
  "어플",
  "서비스",
  "제품",
  "도구",
  "플랫폼",
  "솔루션",
  "기능",
  "정보",
  "관리",
  "사용자",
  "고객",
  "사람",
  "유형",
  "후보",
  "문제",
  "상황",
  "검증",
  "질문",
  "범위",
  "방향",
  "처음",
  "먼저",
  "business",
  "startup",
  "service",
  "product",
  "tool",
  "app",
  "platform",
  "user",
  "customer",
  "person",
  "thing",
  "problem"
]);

const GENERIC_PERSONA_GUARDS = [
  {
    personaPattern: /(?:1\s*인\s*창업자|혼자\s*만드는\s*창업자|초기\s*창업자|개인\s*창업자|창업자|\bsolo\s*founder\b|\bfounder\b)/iu,
    allowedContextPattern:
      /(?:창업자|예비\s*창업자|창업\s*준비(?:자|생|중인\s*사람)|스타트업|고객\s*인터뷰|제품\s*스펙|아이디어\s*검증|\bfounder\b|\bstartup\b|\bsolo\s*founder\b)/iu
  },
  {
    personaPattern: /(?:도메인\s*전문\s*1\s*인\s*빌더|1\s*인\s*빌더|빌더|\bsolo\s*builder\b|\bdomain\s*builder\b)/iu,
    allowedContextPattern:
      /(?:1\s*인\s*빌더|빌더|도메인\s*전문\s*빌더|도메인\s*전문\s*1\s*인\s*빌더|\bsolo\s*builder\b|\bdomain\s*builder\b)/iu
  },
  {
    personaPattern: /(?:팀\s*리더|운영\s*담당자|\bteam\s*lead\b|\boperator\b)/iu,
    allowedContextPattern: /(?:팀\s*리더|운영\s*담당자|운영\s*팀|\bteam\s*lead\b|\boperator\b)/iu
  }
] as const;

const ACTOR_PATTERN =
  /(?:[가-힣A-Za-z0-9]+(?:\s*[·/]\s*[가-힣A-Za-z0-9]+)?(?:\s+[가-힣A-Za-z0-9]+){0,2}\s*(?:보호자|주민|환자|학습자|학생|학부모|운영자|손님|고객|사용자|직장인|프리랜서|창업자|크리에이터|담당자|가구|가족|팀|상인|판매자|구매자|관리자|caregiver|guardian|resident|patient|student|merchant|owner|operator|creator|founder|buyer|seller|manager))/giu;
const ARTIFACT_PATTERN =
  /(?:[가-힣A-Za-z0-9]+(?:\s*[·/+]\s*[가-힣A-Za-z0-9]+)?(?:\s+[가-힣A-Za-z0-9]+){0,2}\s*(?:기록|정보|데이터|서류|문서|사진|메모|보험|장례|급여|사료|식재료|재료|예약|주문|혜택|청구|비용|일정|계획|알림|리포트|스펙|인터뷰|record|data|document|photo|memo|insurance|food|ingredient|reservation|order|benefit|claim|cost|schedule|plan|report|spec))/giu;
const JOB_PATTERN =
  /(?:[가-힣A-Za-z0-9]+(?:\s+[가-힣A-Za-z0-9]+){0,3}\s*(?:관리|교환|공유|모집|예약|주문|청구|정리|기록|비교|검색|찾기|확인|돌봄|준비|검증|작성|생성|전환|변환|연동|수집|분석|추천|알림|manage|exchange|share|book|order|claim|organize|record|compare|search|validate|prepare|generate|generator|turn|convert|recommend))/giu;
const PAIN_PATTERN =
  /(?:불편|번거로움|흩어(?:진|짐)|잃어버림|찾기\s*어려움|비용\s*부담|시간\s*낭비|스트레스|실패|위험|걱정|pain|friction|burden|fragmented|lost|hard\s*to\s*find|risk|stress)/giu;
const CONSTRAINT_PATTERN =
  /(?:아파트|동네|지역|로컬|오프라인|온라인|모바일|병원|동물병원|보험사|학교|회사|가족|개인|단일|로컬\s*전용|보안|개인정보|예산|법률|정책|권한|local|offline|online|mobile|clinic|school|company|family|privacy|security|budget|policy|permission)/giu;
const CHANNEL_PATTERN =
  /(?:커뮤니티|카페|단톡|오픈채팅|병원|학교|마켓|앱스토어|블로그|뉴스레터|검색|광고|소개|community|forum|chat|clinic|school|market|store|blog|newsletter|search|ads|referral)/giu;
const EXCLUSION_PATTERN =
  /(?:(?:제외|하지\s*않|안\s*하|없는|빼고|나중에|보류)\s*[^.?!。！？\n]{0,40}|[^.?!。！？\n]{0,30}\s*(?:제외|하지\s*않|안\s*하|빼고|보류))/giu;

function normalizeText(value: string | undefined) {
  return plainUserFacingDecisionQueueText(value ?? "").replace(/\s+/gu, " ").trim();
}

function uniqueNormalized(values: readonly string[], limit = 12) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value)
      .replace(/^[은는이가을를과와의\s]+|[은는이가을를과와의\s]+$/gu, "")
      .trim();
    const key = normalized.toLowerCase();

    if (normalized.length < 2 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function matches(text: string, pattern: RegExp) {
  return [...text.matchAll(pattern)].map((match) => match[0]);
}

function domainTermCandidates(text: string) {
  const koreanTerms = [...text.matchAll(/[가-힣A-Za-z0-9][가-힣A-Za-z0-9+·/-]{1,}/giu)].map((match) => match[0]);
  const compoundNouns = [...text.matchAll(/[가-힣A-Za-z0-9]+\s+[가-힣A-Za-z0-9]+/giu)].map((match) => match[0]);

  return uniqueNormalized([...compoundNouns, ...koreanTerms], 40).filter((term) => {
    const key = term.toLowerCase();
    return !GENERIC_DOMAIN_TERMS.has(key) && !/^(?:하는|위한|관련|모든|한곳|한\s*곳|남은|실제|가장|첫|초기|구체|아직|사용|상황|정하지|않았다|더\s*좋|앱\s*아직|구체\s*고객이나)$/u.test(key);
  });
}

function termsMatching(terms: readonly string[], pattern: RegExp) {
  return terms.filter((term) => pattern.test(term));
}

export function extractIdeaFitDomainSignals(input: IdeaFitQuestioningInput): IdeaFitDomainSignals {
  const sourceText = [input.rawIdea, input.intakeGoal].map(normalizeText).filter(Boolean).join("\n");
  const domainTerms = domainTermCandidates(sourceText);
  const actors = uniqueNormalized([
    ...matches(sourceText, ACTOR_PATTERN),
    ...termsMatching(domainTerms, /(?:보호자|주민|환자|학생|학습자|학부모|운영자|손님|고객|사용자|직장인|프리랜서|창업자|크리에이터|담당자|가구|가족|팀|상인|판매자|구매자|관리자|resident|patient|student|merchant|operator|creator|founder|buyer|seller|manager)$/iu)
  ]).filter((actor) => !/(?:^앱\s|아직|구체|정하지|않았다)/u.test(actor));
  const users = uniqueNormalized(actors.filter((actor) => !/(?:구매자|buyer|payer)/iu.test(actor)));
  const buyers = uniqueNormalized([
    ...actors.filter((actor) => /(?:구매자|결제|승인|buyer|payer)/iu.test(actor)),
    ...termsMatching(domainTerms, /(?:구매자|결제자|승인권자|buyer|payer)/iu)
  ]);
  const artifacts = uniqueNormalized([
    ...matches(sourceText, ARTIFACT_PATTERN),
    ...termsMatching(domainTerms, /(?:기록|정보|데이터|서류|문서|사진|메모|보험|장례|급여|사료|식재료|재료|예약|주문|혜택|청구|비용|일정|계획|알림|리포트|스펙|인터뷰|record|data|document|insurance|ingredient|reservation|order|benefit|claim|schedule|report|spec)$/iu)
  ]);
  const jobs = uniqueNormalized(matches(sourceText, JOB_PATTERN));
  const pains = uniqueNormalized(matches(sourceText, PAIN_PATTERN));
  const constraints = uniqueNormalized([
    ...matches(sourceText, CONSTRAINT_PATTERN),
    ...termsMatching(domainTerms, /(?:아파트|동네|지역|로컬|오프라인|온라인|모바일|병원|동물병원|보험사|학교|회사|가족|개인|단일|보안|개인정보|예산|법률|정책|권한|local|privacy|security|budget|policy)$/iu)
  ]);
  const channels = uniqueNormalized(matches(sourceText, CHANNEL_PATTERN));
  const explicitExclusions = uniqueNormalized(matches(sourceText, EXCLUSION_PATTERN), 8);

  return {
    sourceText,
    actors,
    users,
    buyers,
    artifacts,
    jobs,
    pains,
    constraints,
    channels,
    explicitExclusions,
    domainTerms
  };
}

export function ideaFitDomainAnchorTerms(signals: IdeaFitDomainSignals) {
  return uniqueNormalized([
    ...signals.actors,
    ...signals.users,
    ...signals.buyers,
    ...signals.artifacts,
    ...signals.jobs,
    ...signals.pains,
    ...signals.constraints,
    ...signals.channels,
    ...signals.domainTerms
  ], 80).filter((term) => !GENERIC_DOMAIN_TERMS.has(term.toLowerCase()));
}

export function textHasIdeaFitDomainAnchor(text: string | undefined, signals: IdeaFitDomainSignals) {
  const normalized = normalizeText(text).toLowerCase();

  if (!normalized) {
    return false;
  }

  return ideaFitDomainAnchorTerms(signals).some((term) => normalized.includes(term.toLowerCase()));
}

export function textHasDisallowedGenericPersona(text: string | undefined, signals: IdeaFitDomainSignals) {
  const normalized = normalizeText(text);
  const context = signals.sourceText;

  return GENERIC_PERSONA_GUARDS.some(
    (guard) => guard.personaPattern.test(normalized) && !guard.allowedContextPattern.test(context)
  );
}

export function dimensionFloorGatePriorityRank(dimension: AmbiguityReductionDimension | undefined) {
  if (!dimension) {
    return DIMENSION_FLOOR_GATE_PRIORITY.length;
  }

  const rank = DIMENSION_FLOOR_GATE_PRIORITY.indexOf(dimension);

  return rank >= 0 ? rank : DIMENSION_FLOOR_GATE_PRIORITY.length;
}

function dimensionNeedsAttention(score: IdeaFitDimensionScore) {
  return score.riskScore > 0 || score.clarityScore < 2;
}

function compareIdeaFitDimensionScores(left: IdeaFitDimensionScore, right: IdeaFitDimensionScore) {
  const leftNeedsAttention = dimensionNeedsAttention(left);
  const rightNeedsAttention = dimensionNeedsAttention(right);

  if (leftNeedsAttention !== rightNeedsAttention) {
    return leftNeedsAttention ? -1 : 1;
  }

  return dimensionFloorGatePriorityRank(left.dimension) - dimensionFloorGatePriorityRank(right.dimension) ||
    right.riskScore - left.riskScore ||
    left.clarityScore - right.clarityScore;
}

export function scoreIdeaFitDimensions(signals: IdeaFitDomainSignals): readonly IdeaFitDimensionScore[] {
  const text = signals.sourceText;
  const hasActor = signals.actors.length > 0;
  const hasArtifactOrJob = signals.artifacts.length > 0 || signals.jobs.length > 0;
  const hasExplicitGoal = hasArtifactOrJob && /(?:관리|교환|공유|정리|기록|검증|작성|생성|전환|변환|예약|주문|청구|추천|알림|manage|exchange|share|organize|record|validate|generate|generator|turn|convert|book|order|claim|recommend)/iu.test(text);
  const hasScope = /(?:첫|먼저|범위|제외|포함|하나|작게|mvp|scope|exclude|include|first)/iu.test(text);
  const hasDecisionAuthority = /(?:구매자|사용자|결제|승인|돈|비용|buyer|payer|decision|approval)/iu.test(text);
  const hasSuccessCriteria = /(?:성공|기준|지표|측정|확인|검증|관찰|success|metric|measure|validate)/iu.test(text);
  const hasConstraints = signals.constraints.length > 0 || signals.explicitExclusions.length > 0;
  const hasPressure = /(?:반례|위험|불확실|대체|기존|실패|약하|counter|risk|alternative|fail)/iu.test(text);

  const byDimension: Record<AmbiguityReductionDimension, Omit<IdeaFitDimensionScore, "dimension">> = {
    goal: {
      clarityScore: hasExplicitGoal ? 2 : 0,
      riskScore: [!hasExplicitGoal, !hasArtifactOrJob].filter(Boolean).length,
      reasons: [hasExplicitGoal ? "goal includes a domain job or artifact" : "goal does not yet name the exact job/artifact to change"]
    },
    scope: {
      clarityScore: hasScope ? 2 : 0,
      riskScore: [!hasScope, hasActor && !hasDecisionAuthority].filter(Boolean).length,
      reasons: [hasScope ? "scope or first slice is named" : "first slice/non-goal is not explicit"]
    },
    decision_authority: {
      clarityScore: hasDecisionAuthority ? 2 : 0,
      riskScore: [!hasDecisionAuthority, hasActor && !signals.buyers.length].filter(Boolean).length,
      reasons: [hasDecisionAuthority ? "decision authority is mentioned" : "buyer/user/approver split is not explicit"]
    },
    success_criteria: {
      clarityScore: hasSuccessCriteria ? 2 : 0,
      riskScore: [!hasSuccessCriteria].filter(Boolean).length,
      reasons: [hasSuccessCriteria ? "success or validation language is present" : "observable success criteria are not named"]
    },
    constraints: {
      clarityScore: hasConstraints ? 2 : 0,
      riskScore: [!hasConstraints].filter(Boolean).length,
      reasons: [hasConstraints ? "constraints or exclusions are mentioned" : "constraints/non-goals are not named"]
    },
    assumption_pressure: {
      clarityScore: hasPressure ? 2 : 0,
      riskScore: [!hasPressure].filter(Boolean).length,
      reasons: [hasPressure ? "counterexample or risk language is present" : "weakening evidence or counterexample is not explicit"]
    },
    context: {
      clarityScore: hasActor && hasArtifactOrJob ? 2 : hasActor || hasArtifactOrJob ? 1 : 0,
      riskScore: [!hasActor, !hasArtifactOrJob].filter(Boolean).length,
      reasons: [hasActor && hasArtifactOrJob ? "actor and job/artifact context are present" : "actor/job/artifact context is incomplete"]
    }
  };

  return AMBIGUITY_REDUCTION_DIMENSIONS.map((dimension) => ({
    dimension,
    ...byDimension[dimension]
  })).sort(compareIdeaFitDimensionScores);
}

export function selectWeakestExecutionChangingDimension(
  scores: readonly IdeaFitDimensionScore[]
): IdeaFitDimensionScore | undefined {
  return [...scores].sort(compareIdeaFitDimensionScores)[0];
}

function answerOption(
  id: string,
  label: string,
  value: string,
  primaryDetail: string,
  secondaryDetail: string
): AmbiguityAnswerOption {
  return {
    id,
    label: plainUserFacingDecisionQueueText(label),
    value: plainUserFacingDecisionQueueText(value),
    primaryDetail: plainUserFacingDecisionQueueText(primaryDetail),
    secondaryDetail: plainUserFacingDecisionQueueText(secondaryDetail),
    pro: plainUserFacingDecisionQueueText(primaryDetail),
    con: plainUserFacingDecisionQueueText(secondaryDetail)
  };
}

function cleanId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/giu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 48) || "domain_choice";
}

function primaryActor(signals: IdeaFitDomainSignals) {
  return signals.actors[0] ?? signals.users[0] ?? "사용자";
}

function primaryArtifact(signals: IdeaFitDomainSignals) {
  return signals.artifacts[0] ?? signals.domainTerms.find((term) => !signals.actors.includes(term)) ?? "핵심 정보";
}

function primaryJob(signals: IdeaFitDomainSignals) {
  return signals.jobs[0] ?? `${primaryArtifact(signals)} 관리`;
}

export function domainDerivedAnswerOptionsForTopic(
  topicKey: string | undefined,
  expectedAnswerType: string | undefined,
  signals: IdeaFitDomainSignals
): readonly AmbiguityAnswerOption[] {
  if (!topicKey || expectedAnswerType === "text") {
    return [];
  }

  const actor = primaryActor(signals);
  const artifact = primaryArtifact(signals);
  const job = primaryJob(signals);
  const hasEnoughDomain = ideaFitDomainAnchorTerms(signals).length >= 3 && (signals.actors.length > 0 || signals.artifacts.length > 0);

  if (!hasEnoughDomain) {
    return [];
  }

  if (topicKey === "primary_customer_narrowing") {
    if (signals.actors.length >= 3) {
      return signals.actors.slice(0, 4).map((candidate, index) => answerOption(
        `domain_actor_${cleanId(candidate) || index + 1}`,
        candidate,
        `${candidate}을(를) 가장 먼저 검증합니다.`,
        `${candidate} 관점의 ${artifact} 문제를 먼저 확인합니다.`,
        `다른 ${signals.actors.filter((other) => other !== candidate).slice(0, 2).join("·") || "사용자"} 관점은 남아 있습니다.`
      ));
    }

    return [
      answerOption(
        `domain_${cleanId(actor)}_provider`,
        `${artifact}를 내놓는 ${actor}`,
        `${artifact}를 내놓는 ${actor}을(를) 먼저 검증합니다.`,
        `${actor}이(가) ${artifact}를 제공하거나 등록하려는 이유를 확인합니다.`,
        `${artifact}를 찾는 쪽의 반복 사용 의향은 별도 확인이 필요합니다.`
      ),
      answerOption(
        `domain_${cleanId(actor)}_receiver`,
        `${artifact}를 찾는 ${actor}`,
        `${artifact}를 찾는 ${actor}을(를) 먼저 검증합니다.`,
        `${actor}이(가) ${artifact}를 필요로 하는 빈도와 불편을 확인합니다.`,
        `${artifact}를 내놓는 쪽의 공급 의향은 별도 확인이 필요합니다.`
      ),
      answerOption(
        `domain_${cleanId(actor)}_repeat`,
        `${job}를 자주 겪는 ${actor}`,
        `${job}를 자주 겪는 ${actor}을(를) 먼저 검증합니다.`,
        `${job}가 반복되는 실제 상황을 먼저 확인합니다.`,
        `드물게 ${job}를 겪는 ${actor}에게도 가치가 있는지는 남아 있습니다.`
      )
    ];
  }

  if (topicKey === "buyer_user_split") {
    return [
      answerOption(
        "domain_same_decider_user",
        `${actor}이 직접 결정하고 쓴다`,
        `${actor}이(가) 직접 결정하고 ${artifact} 관련 기능을 사용합니다.`,
        `첫 인터뷰와 사용 흐름을 ${actor} 기준으로 단순하게 맞춥니다.`,
        `다른 승인자나 비용 부담자가 있는지는 남아 있습니다.`
      ),
      answerOption(
        "domain_shared_decision",
        `${actor} 외 다른 사람이 함께 결정한다`,
        `${actor}이(가) 쓰지만 가족, 관리자, 기관 등 다른 결정자가 함께 관여합니다.`,
        `승인과 신뢰 조건을 일찍 확인합니다.`,
        `첫 버전의 권한과 공유 범위가 커질 수 있습니다.`
      ),
      answerOption(
        "domain_unknown_decision",
        `결정자를 먼저 확인한다`,
        `${artifact} 문제의 실제 결정자를 첫 인터뷰에서 확인합니다.`,
        `구매자와 사용자를 추측하지 않습니다.`,
        `결정 전까지 가격과 메시지는 확정하기 어렵습니다.`
      )
    ];
  }

  if (topicKey === "value_prop_switching_reason") {
    return [
      answerOption(
        "domain_find_faster",
        `${artifact}를 더 빨리 찾는다`,
        `${actor}이(가) ${artifact}를 더 빨리 찾을 수 있어 선택합니다.`,
        `${artifact} 접근성 가치를 먼저 검증합니다.`,
        `입력하거나 유지하는 부담은 별도 확인이 필요합니다.`
      ),
      answerOption(
        "domain_reduce_repeat_work",
        `${job} 반복을 줄인다`,
        `${actor}이(가) ${job} 반복을 줄일 수 있어 선택합니다.`,
        `반복 업무 감소를 첫 가치로 둡니다.`,
        `반복 빈도가 낮은 사용자에게도 가치가 있는지는 남아 있습니다.`
      ),
      answerOption(
        "domain_trust_context",
        `${artifact}를 믿고 공유한다`,
        `${actor}이(가) ${artifact}를 믿고 공유할 수 있어 선택합니다.`,
        `신뢰와 공유 맥락을 첫 가치로 확인합니다.`,
        `개인 혼자 쓰는 흐름에는 과할 수 있습니다.`
      )
    ];
  }

  if (topicKey === "mvp_validation_scope") {
    return [
      answerOption(
        "domain_single_flow",
        `${job} 하나만 검증한다`,
        `첫 버전은 ${job} 하나만 검증합니다.`,
        `가장 작은 실행 범위를 정합니다.`,
        `다른 ${artifact} 흐름의 매력은 뒤로 밀립니다.`
      ),
      answerOption(
        "domain_artifact_flow",
        `${artifact} 흐름만 검증한다`,
        `첫 버전은 ${artifact}를 등록하고 다시 쓰는 흐름만 검증합니다.`,
        `${artifact} 중심의 사용 가치를 선명하게 봅니다.`,
        `커뮤니티, 결제, 자동화 같은 주변 기능은 남아 있습니다.`
      ),
      answerOption(
        "domain_manual_slice",
        `수동으로 ${job}를 검증한다`,
        `자동화 전에 수동으로 ${job}를 도와 실제 사용 의향을 확인합니다.`,
        `구현 부담을 줄이고 학습 속도를 높입니다.`,
        `자동화 가치 자체는 별도 확인이 필요합니다.`
      )
    ];
  }

  if (topicKey === "first_validation_experiment") {
    return [
      answerOption(
        "domain_interview",
        `${actor} 인터뷰`,
        `${actor}에게 ${artifact}와 ${job} 상황을 인터뷰로 확인합니다.`,
        `가장 빠르게 문제 맥락을 확인합니다.`,
        `말한 의향이 실제 사용으로 이어지는지는 남아 있습니다.`
      ),
      answerOption(
        "domain_manual_test",
        `수동 ${job} 테스트`,
        `${actor}의 ${job}를 수동으로 도와 반복 사용 의향을 봅니다.`,
        `행동 기반 신호를 얻습니다.`,
        `운영자가 개입한 효과와 제품 효과가 섞일 수 있습니다.`
      ),
      answerOption(
        "domain_artifact_upload",
        `${artifact} 등록 의향 확인`,
        `${actor}이(가) 실제 ${artifact}를 맡기거나 입력하려는지 확인합니다.`,
        `데이터 신뢰와 입력 장벽을 확인합니다.`,
        `장기 반복 사용은 추가 관찰이 필요합니다.`
      )
    ];
  }

  if (topicKey === "non_goal_boundaries") {
    return [
      answerOption(
        "domain_no_external_integration",
        `외부 연동은 제외한다`,
        `첫 버전에서는 ${artifact} 관련 외부 계정이나 기관 연동을 제외합니다.`,
        `권한과 보안 리스크를 줄입니다.`,
        `실제 ${job} 흐름과 거리가 생길 수 있습니다.`
      ),
      answerOption(
        "domain_no_automation",
        `자동화는 제외한다`,
        `첫 버전에서는 ${job} 자동화를 제외하고 수동 확인 흐름만 남깁니다.`,
        `작고 안전하게 검증합니다.`,
        `자동화가 핵심 가치라면 매력이 약해질 수 있습니다.`
      ),
      answerOption(
        "domain_no_multi_actor",
        `다자 협업은 제외한다`,
        `첫 버전에서는 여러 ${actor}이(가) 함께 쓰는 권한·공유 기능을 제외합니다.`,
        `단일 사용자 흐름을 빠르게 검증합니다.`,
        `공동 사용이 핵심인 상황은 뒤로 밀립니다.`
      )
    ];
  }

  return [];
}
