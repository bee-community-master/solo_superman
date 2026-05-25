import type {
  AmbiguityAnswerOption,
  AmbiguityAnswerSelectionMode,
  AmbiguityExpectedAnswerType,
  AmbiguityIssueSnapshot,
  EvidenceMatrixProjection,
  ResearchTaskProjection
} from "@solo-superman/contracts";
import { describesAnswerFormPolicy } from "../answer-form-policy";
import {
  answerOptionsForQuestion,
  primaryCustomerContextProfileForText
} from "./answer-options";

export type ResearchFollowUpAnswerShape =
  | "open_text"
  | "binary_choice"
  | "single_choice"
  | "multi_select"
  | "ranked_choice"
  | "evidence_judgment";

interface ResearchFollowUpAnswerInput {
  readonly question: string;
  readonly researchTask: ResearchTaskProjection;
  readonly sourceQuestion: AmbiguityIssueSnapshot | undefined;
  readonly evidenceMatrix: EvidenceMatrixProjection;
}

function researchFollowUpAnswerOption(
  id: string,
  label: string,
  value: string,
  primaryDetail: string,
  secondaryDetail: string
): AmbiguityAnswerOption {
  return {
    id,
    label,
    value,
    primaryDetail,
    secondaryDetail,
    pro: primaryDetail,
    con: secondaryDetail
  };
}

const RESEARCH_FOLLOW_UP_FALLBACK_OPTIONS = [
  researchFollowUpAnswerOption(
    "need_more_research",
    "추가 리서치 필요",
    "지금 답하기에는 근거가 부족하므로 더 넓은 자료를 모은다.",
    "성급한 결정을 줄입니다.",
    "결정 완료와 구현 시작이 늦어집니다."
  ),
  researchFollowUpAnswerOption(
    "decide_after_validation",
    "검증 후 결정",
    "지금 확정하지 않고 다음 검증에서 확인할 조건을 답변에 남긴다.",
    "보류 이유와 다음 확인 조건을 답변 흐름 안에 남길 수 있습니다.",
    "Known Risk로 공식 이관하려면 카드의 Known Risk 전용 동작을 사용해야 합니다."
  ),
  researchFollowUpAnswerOption(
    "narrow_scope_before_answer",
    "범위 좁힌 뒤 답변",
    "먼저 고객/기능/검증 범위를 더 좁힌 뒤 그 좁은 기준으로 답한다.",
    "성급한 넓은 결정을 줄이고 다음 질문을 더 작게 만들 수 있습니다.",
    "이번 답변만으로는 넓은 원래 질문이 바로 닫히지 않을 수 있습니다."
  )
] as const;

function petLifecycleCustomerAnswerOptions(): readonly AmbiguityAnswerOption[] {
  return [
    researchFollowUpAnswerOption(
      "first_pet_guardians",
      "첫 반려동물을 키우는 보호자",
      "첫 반려동물 보호자를 가장 먼저 테스트한다.",
      "의료, 급여, 일상 기록을 한 번에 정리해야 하는 초보 보호자 흐름에 맞춰 인터뷰할 수 있습니다.",
      "노령·질환·보험·장례처럼 복잡한 생애 후반 문제는 첫 검증에서 약하게 보일 수 있습니다."
    ),
    researchFollowUpAnswerOption(
      "senior_or_chronic_pet_guardians",
      "노령·만성질환 반려동물 보호자",
      "노령이거나 만성질환이 있는 반려동물 보호자를 가장 먼저 테스트한다.",
      "병원 기록, 약/급여, 보험, 비용 관리 니즈가 강해 통합 관리 앱의 가치가 선명해질 수 있습니다.",
      "초기 사용자가 무거운 케이스로 치우쳐 일상 관리 기능의 대중성은 따로 확인해야 합니다."
    ),
    researchFollowUpAnswerOption(
      "multi_pet_households",
      "여러 마리를 함께 키우는 가구",
      "여러 반려동물을 함께 키우는 가구를 첫 검증 대상으로 둔다.",
      "동물별 의료·급여·보험·일상 기록을 한 곳에서 구분 관리해야 하는 문제가 분명합니다.",
      "한 마리만 키우는 보호자의 단순한 사용 흐름은 과하게 복잡해질 수 있습니다."
    ),
    researchFollowUpAnswerOption(
      "insurance_cost_sensitive_guardians",
      "보험·의료비 관리가 필요한 보호자",
      "보험 청구와 의료비 관리 부담이 큰 보호자를 먼저 테스트한다.",
      "지불 의향과 반복 사용 신호를 의료비·보험 서류 관리에서 빠르게 확인할 수 있습니다.",
      "보험이 없거나 의료비 부담이 낮은 보호자에게는 가치가 약할 수 있습니다."
    ),
    researchFollowUpAnswerOption(
      "end_of_life_care_guardians",
      "장례·말기 케어까지 준비하는 보호자",
      "장례와 말기 케어까지 고민하는 보호자를 별도 후보로 검증한다.",
      "전생애주기라는 아이디어의 차별점이 가장 강하게 드러나는 구간입니다.",
      "정서적으로 민감한 문제라 인터뷰 접근 방식과 표현을 신중히 설계해야 합니다."
    )
  ];
}

function domainSpecificCustomerAnswerOptions(contextText: string) {
  const profile = primaryCustomerContextProfileForText(contextText);

  if (!profile) {
    return [];
  }

  return profile.id === "pet_lifecycle" ? petLifecycleCustomerAnswerOptions() : profile.answerOptions;
}

function boundedResearchFollowUpAnswerOptions(
  options: readonly AmbiguityAnswerOption[],
  input: { readonly reservePrimaryFallback?: boolean; readonly fillMinimumOptions?: boolean } = {}
) {
  const reservePrimaryFallback = input.reservePrimaryFallback ?? true;
  const fillMinimumOptions = input.fillMinimumOptions ?? true;
  const primaryFallbackOption = RESEARCH_FOLLOW_UP_FALLBACK_OPTIONS[0];
  const shouldReservePrimaryFallback =
    reservePrimaryFallback &&
    options.length < 10 &&
    !options.some((option) => option.id === primaryFallbackOption.id);
  const bounded = shouldReservePrimaryFallback ? [...options, primaryFallbackOption] : [...options];

  if (!fillMinimumOptions) {
    return bounded.slice(0, 10);
  }

  for (const fallbackOption of RESEARCH_FOLLOW_UP_FALLBACK_OPTIONS.slice(1)) {
    if (bounded.length >= 3) {
      break;
    }

    if (!bounded.some((option) => option.id === fallbackOption.id)) {
      bounded.push(fallbackOption);
    }
  }

  return bounded.slice(0, 10);
}

function boundedChoiceAnswerOptions(
  options: readonly AmbiguityAnswerOption[],
  answerShape: ResearchFollowUpAnswerShape
) {
  return boundedResearchFollowUpAnswerOptions(options, {
    reservePrimaryFallback: answerShape !== "ranked_choice",
    fillMinimumOptions: answerShape !== "ranked_choice"
  });
}

function candidateOptionId(index: number) {
  return `question_candidate_${index + 1}`;
}

function normalizeQuestionCandidateLabel(value: string) {
  return value
    .replace(
      /^[^,·/\n]{0,96}(?:후보|선택지|옵션|종류|유형|타입|성향|세그먼트)(?:는|은|로는|로|:|：)\s*/iu,
      ""
    )
    .replace(/^[\s"'‘’“”([{<]+|[\s"'‘’“”)\]}>.。]+$/gu, "")
    .replace(/\s+(?:정도|후보|옵션|선택지)$/u, "")
    .trim();
}

function splitCandidatePhrase(value: string) {
  return value
    .replace(/([^\s,·/]+)(?:와|과)\s+/gu, "$1, ")
    .replace(/\s+(?:및|또는|혹은)\s+/gu, ", ")
    .replace(/\s+(?:and|or)\s+/giu, ", ")
    .split(/[,·/]+/u)
    .map(normalizeQuestionCandidateLabel)
    .filter((candidate) => candidate.length >= 2 && candidate.length <= 64);
}

function normalizeBulletCandidateLabel(value: string) {
  return normalizeQuestionCandidateLabel(
    value
      .replace(/\s*(?:[-–—]|:|：)\s+.+$/u, "")
      .replace(/\s*\([^)]{8,}\)\s*$/u, "")
      .replace(/\s*（[^）]{8,}）\s*$/u, "")
  );
}

function candidateBulletLabelsFromQuestion(question: string) {
  const candidates: string[] = [];
  let isCandidateListOpen = false;

  for (const line of question.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed) {
      isCandidateListOpen = false;
      continue;
    }

    if (/(?:후보|선택지|옵션|종류|유형|타입|성향|세그먼트|persona|segment|options?|candidates?)/iu.test(trimmed)) {
      isCandidateListOpen = true;
    }

    const match = trimmed.match(/^(?:[-*•]|[0-9]+[.)]|[①②③④⑤⑥⑦⑧⑨⑩])\s*(?<candidate>.+)$/u);

    if (!match?.groups?.candidate || !isCandidateListOpen) {
      continue;
    }

    const candidate = normalizeBulletCandidateLabel(match.groups.candidate);

    if (candidate.length >= 2 && candidate.length <= 64) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

function candidatePhrasesFromQuestion(question: string) {
  const phrases: string[] = [];
  const patterns = [
    /(?:후보|선택지|옵션|종류|유형|타입|성향)(?:는|은|로는|로|:)\s*(?<candidates>.+?)(?:입니다|입니다만|정도로|정도(?:로)?\s*추려|중에서|중\s*하나|가\s*있|이\s*있|를\s*고르|을\s*고르|를\s*선택|을\s*선택|\.|\?|$)/giu,
    /(?:customer\s*)?(?:(?:candidates?|options?)\s*(?:include|includes|are|:)|(?:segments?|personas?|types?)\s*(?:include|includes|:))\s*(?<candidates>[^.?\n]{2,180})(?:\.|\?|$)/giu,
    /(?:선택|고르|골라|정|순서|우선순위|rank|choose|select|pick)[^:：\n]{0,80}[:：]\s*(?<candidates>[^.?\n]{2,180})(?:\.|\?|$)/giu,
    /(?<candidates>[^.?\n]{2,180}?)(?:\s*정도로\s*추려졌|(?:이|가)\s*후보(?:입니다|로\s*남았))/giu,
    /(?<candidates>[^.?\n]{2,180}(?:[,·/]|(?:와|과)\s+|(?:및|또는|혹은)\s+)[^.?\n]{2,180}?)(?:\s*(?:중|가운데)\s*(?:하나(?:만)?|한\s*가지|하나\s*(?:혹은|또는)?\s*여러\s*개|하나\s*이상|여러\s*(?:개|항목)|복수|다중)(?:를|을)?\s*(?:선택|고르|골라|정|택)|\s*(?:중|가운데)\s*어느\s*(?:것|후보|항목|종류|유형)|\s*(?:중|가운데)\s*먼저\s*(?:볼|확인|검증|구현)할\s*순서)/giu
  ];

  for (const pattern of patterns) {
    for (const match of question.matchAll(pattern)) {
      const phrase = match.groups?.candidates?.trim();

      if (phrase) {
        phrases.push(phrase);
      }
    }
  }

  return phrases;
}

function candidateAnswerOptionsFromQuestion(question: string): readonly AmbiguityAnswerOption[] {
  const seen = new Set<string>();
  const candidates = [
    ...candidatePhrasesFromQuestion(question).flatMap(splitCandidatePhrase),
    ...candidateBulletLabelsFromQuestion(question)
  ]
    .filter((candidate) => {
      const key = candidate.toLocaleLowerCase("ko-KR");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

  return candidates.slice(0, 10).map((candidate, index) =>
    researchFollowUpAnswerOption(
      candidateOptionId(index),
      candidate,
      `${candidate} 후보를 선택한다.`,
      "질문에 제시된 후보라 다음 리서치, 스펙, 구현 범위에 바로 연결할 수 있습니다.",
      "후보 이름만으로 조건이나 제외 범위가 모호하면 아래 입력칸에 보완 설명이 필요합니다."
    )
  );
}

function looksLikeGenericBuilderSegmentOptions(options: readonly AmbiguityAnswerOption[]) {
  const labels = options.map((option) => option.label).join(" ");

  return /(?:1인\s*창업자|초기\s*창업자|solo\s*founder|도메인\s*전문|1인\s*빌더|팀\s*리더|운영\s*담당자|team\s*lead)/iu.test(
    labels
  );
}

function normalizedQuestionContext(input: ResearchFollowUpAnswerInput) {
  return [
    input.question,
    input.researchTask.objective,
    input.sourceQuestion?.summary,
    input.sourceQuestion?.questionText,
    input.evidenceMatrix.knownRisk
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function domainSpecificQuestionContext(input: ResearchFollowUpAnswerInput) {
  return [
    input.researchTask.objective,
    input.sourceQuestion?.summary,
    input.sourceQuestion?.questionText,
    input.evidenceMatrix.knownRisk,
    ...input.evidenceMatrix.proEvidence.map((item) => item.summary),
    ...input.evidenceMatrix.conEvidence.map((item) => item.summary),
    ...input.evidenceMatrix.uncertainties.map((item) => item.summary)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasEvidenceJudgmentCue(input: ResearchFollowUpAnswerInput) {
  const text = normalizedQuestionContext(input);

  return (
    /(?:찬성|반대|근거|한계|불확실성|반례|과신|추가\s*리서치|counter[-\s]?evidence|pro\s*evidence|con\s*evidence|skeptical\s*evidence|evidence\s*gap)/iu.test(
      text
    ) ||
    (input.evidenceMatrix.proEvidence.length > 0 &&
      (input.evidenceMatrix.conEvidence.length > 0 || input.evidenceMatrix.uncertainties.length > 0))
  );
}

function hasOpenTextCue(question: string) {
  return /(?:주관식|주관형|서술형|서술식|논술형|자유\s*(?:답변|서술|입력|문항)|직접\s*(?:입력|작성)|서술|설명|적어\s*주|작성|말로\s*(?:풀어|설명)|본인\s*말|자유롭게|구체적으로\s*(?:말|설명)|의견|생각|경험|이야기|인사이트|배운\s*점|느낀\s*점|왜|어떻게|어떤\s*(?:상황|맥락|이유|제약)|describe|explain|write|free[-\s]?form|open[-\s]?(?:ended|question)|subjective|narrative|descriptive)/iu.test(
    question
  );
}

const explicitNarrativeAnswerInstructionPattern = new RegExp(
  [
    "(?:이번(?:에는| 질문은)?|지금(?:은)?|여기서는|이\\s*질문은|답변은)[^.\\n?]{0,80}(?:주관식|주관형|서술형|서술식|논술형|자유\\s*(?:답변|서술|입력|문항)|직접\\s*(?:입력|작성)|open[-\\s]?question|open[-\\s]?ended)",
    "(?:주관식|주관형|서술형|서술식|논술형|자유\\s*(?:답변|서술|입력|문항)|open[-\\s]?question|open[-\\s]?ended)[^.\\n?]{0,80}(?:답변을?\\s*(?:요구|작성|적어|남겨)|로\\s*(?:답변|작성|서술))"
  ].join("|"),
  "iu"
);

function hasExplicitNarrativeAnswerInstruction(question: string) {
  return explicitNarrativeAnswerInstructionPattern.test(question);
}

function rejectsChoiceOptions(question: string) {
  return /(?:선택지\s*없이|선택지(?:가|는)?\s*아니라|선택(?:이|은|는)?\s*아니라|객관식(?:이|은)?\s*아니라|선택형(?:이|은)?\s*아니라|고르지\s*말고|선택하지\s*말고|without\s+choices?|no\s+choices?|not\s+(?:a\s+)?(?:choice|multiple[-\s]?choice|single[-\s]?choice))/iu.test(
    question
  );
}

function hasMultiSelectCue(question: string) {
  return (
    /(?:복수|다중|모두|해당|중복|하나\s*(?:혹은|또는)?\s*여러\s*개|하나\s*이상|여러\s*(?:개|항목)|둘\s*이상|복수\s*선택|다중\s*선택|복수선택|다중선택|multi[-\s]?select|one\s+or\s+more|select\s+all|which\s+.+\s+together)/iu.test(
      question
    ) ||
    /\b(?:select|choose|pick)\s+multiple\b/iu.test(question) ||
    /\bmultiple\s+(?:answers?|selections?)\b/iu.test(question) ||
    /\bmultiple\s+(?:options?|choices?|items?)\s+(?:can|may)\s+(?:apply|fit|be\s+true)\b/iu.test(question)
  );
}

function hasBinaryChoiceCue(question: string) {
  return /(?:(?:찬성\s*[/·또는과]*\s*반대|반대\s*[/·또는과]*\s*찬성|찬반|동의\s*[/·또는과]*\s*비동의|예\s*[/·또는과]*\s*아니오)\s*(?:중|중에|중에서|여부|어느|선택|고르|판단|객관식|(?:의견|답변|방향)?(?:을|를)?\s*(?:하|할|선택|고르|골라|판단|정|답))|(?:찬성|동의|진행|반영|채택)\s*여부|(?:할지|갈지|진행할지|반영할지)\s*말지|양자\s*택일|양자택일|yes\s*[/ ]?no|agree\s*[/ ]?disagree|support\s*[/ ]?oppose|찬성인지\s*반대|동의하시|찬성하시|반대하시|진행할까요|해야\s*할까요|반영할까요)/iu.test(
    question
  );
}

const NEGATED_BINARY_CHOICE_PATTERN = new RegExp(
  [
    "(?:찬성\\s*[/·또는과]*\\s*반대|반대\\s*[/·또는과]*\\s*찬성|찬반|동의\\s*[/·또는과]*\\s*비동의|예\\s*[/·또는과]*\\s*아니오)\\s*(?:선택|답변|판단|질문)?(?:이|가|은|는)?\\s*(?:아니라|아닌|말고|대신|보다)",
    "(?:not|instead\\s+of|rather\\s+than|not\\s+an?\\s+)[^.\\n?]{0,40}(?:yes\\s*[/ ]?no|agree\\s*[/ ]?disagree|support\\s*[/ ]?oppose|pro\\s*[/ ]?con|binary\\s+choice)",
    "(?:yes\\s*[/ ]?no|agree\\s*[/ ]?disagree|support\\s*[/ ]?oppose|pro\\s*[/ ]?con|binary\\s+choice)[^.\\n?]{0,40}(?:not|instead|rather\\s+than)"
  ].join("|"),
  "iu"
);

function rejectsBinaryChoiceCue(question: string) {
  return NEGATED_BINARY_CHOICE_PATTERN.test(question);
}

function hasRankedChoiceCue(question: string) {
  return /(?:우선순위|우선\s*순위|순위|순서|랭킹|중요도순|먼저\s*(?:볼|검증|구현|확인)할\s*순서|rank(?:ed|ing)?|priorit(?:y|ize|ise)|order\s+(?:of|the))/iu.test(
    question
  );
}

function hasForcedChoiceCue(question: string) {
  return /(?:객관식|선택형|선택|고르|골라|판단하시겠|어느\s*방향으로\s*판단|중\s*(?:하나|한\s*가지)|하나(?:를|만)?\s*(?:선택|고르)|하나\s*(?:혹은|또는)?\s*여러\s*개|하나\s*이상|복수|다중|(?:찬성\s*[/·또는과]*\s*반대|반대\s*[/·또는과]*\s*찬성|찬반|동의\s*[/·또는과]*\s*비동의|예\s*[/·또는과]*\s*아니오)\s*(?:중|중에|중에서|여부|선택|고르|판단|객관식)|(?:찬성|동의|진행|반영|채택)\s*여부|(?:할지|갈지|진행할지|반영할지)\s*말지|양자\s*택일|양자택일|choose|pick|select|single[-\s]?choice|multi[-\s]?select|one\s+or\s+more|select\s+all|yes\s*[/ ]?no|agree\s*[/ ]?disagree|support\s*[/ ]?oppose)/iu.test(
    question
  );
}

function hasConcreteSingleChoiceCue(question: string) {
  return /(?:객관식|선택형|단일\s*선택|단일선택|하나(?:를|만)?\s*(?:선택|고르)|중\s*(?:하나|한\s*가지)|종류\s*중\s*하나|(?:후보|선택지|옵션|고객\s*후보|고객\s*세그먼트)(?:를|을)?\s*(?:선택|고르)|어느\s*(?:후보|성향|고객|세그먼트|종류|선택지)|(?:무엇|어디|누구)에\s*집중|선택하시겠|집중하시겠|고르시겠|choose|pick|which\s+(?:one|customer|segment|option)|single[-\s]?choice)/iu.test(
    question
  );
}

function hasSingleChoiceCue(question: string) {
  return /(?:어느\s*방향|which\s+direction)/iu.test(question) || hasConcreteSingleChoiceCue(question);
}

function asksForValidationPlan(question: string) {
  return /(?:(?:실험|검증|테스트|확인)\s*(?:방법|방식|계획|후보|절차|전략|먼저|우선)|(?:방법|방식|계획|후보)\s*(?:중|가운데)?\s*(?:어느|어떤)?\s*(?:실험|검증|테스트|확인)|validation\s+plan|validate\s+(?:first|with|by)|which\s+(?:experiment|test|validation)|experiment\s+(?:plan|first|candidate)|test\s+(?:plan|first|candidate))/iu.test(
    question
  );
}

function sourceQuestionImpliesChoice(sourceQuestion: AmbiguityIssueSnapshot | undefined) {
  return sourceQuestion?.expectedAnswerType === "choice" || sourceQuestion?.expectedAnswerType === "rank";
}

export function classifyResearchFollowUpAnswerShape(input: ResearchFollowUpAnswerInput): ResearchFollowUpAnswerShape {
  if (describesAnswerFormPolicy(input.question)) {
    return "open_text";
  }

  if (hasExplicitNarrativeAnswerInstruction(input.question)) {
    return "open_text";
  }

  if (
    hasOpenTextCue(input.question) &&
    (rejectsChoiceOptions(input.question) || !hasForcedChoiceCue(input.question))
  ) {
    return "open_text";
  }

  if (hasBinaryChoiceCue(input.question) && !rejectsBinaryChoiceCue(input.question)) {
    return "binary_choice";
  }

  if (hasRankedChoiceCue(input.question)) {
    return "ranked_choice";
  }

  if (hasMultiSelectCue(input.question)) {
    return "multi_select";
  }

  if (hasConcreteSingleChoiceCue(input.question)) {
    return "single_choice";
  }

  if (hasOpenTextCue(input.question) && !hasForcedChoiceCue(input.question)) {
    return "open_text";
  }

  if (hasEvidenceJudgmentCue(input)) {
    return "evidence_judgment";
  }

  if (hasSingleChoiceCue(input.question) || sourceQuestionImpliesChoice(input.sourceQuestion)) {
    return "single_choice";
  }

  return "open_text";
}

export function researchFollowUpExpectedAnswerType(input: ResearchFollowUpAnswerInput): AmbiguityExpectedAnswerType {
  const answerShape = classifyResearchFollowUpAnswerShape(input);

  if (answerShape === "binary_choice") {
    return "choice";
  }

  if (answerShape === "evidence_judgment") {
    return "evidence";
  }

  if (answerShape === "open_text") {
    return asksForValidationPlan(input.question) ? "experiment" : "text";
  }

  if (answerShape === "ranked_choice") {
    return "rank";
  }

  if (/(?:순위|우선순위|rank|priorit)/iu.test(input.question)) {
    return "rank";
  }

  if (asksForValidationPlan(input.question)) {
    return "experiment";
  }

  return "choice";
}

export function researchFollowUpAnswerSelectionMode(input: ResearchFollowUpAnswerInput): AmbiguityAnswerSelectionMode | undefined {
  const answerShape = classifyResearchFollowUpAnswerShape(input);

  if (answerShape === "open_text") {
    return undefined;
  }

  if (answerShape === "multi_select") {
    return "multiple";
  }

  return answerShape === "ranked_choice" ? "ranked" : "single";
}

function choiceTopicKeyForText(text: string) {
  if (/(?:신호|조건|요인|기준|signal|criteria|factor|indicator)/iu.test(text)) {
    return "customer_signal_selection";
  }

  if (/(?:고객|세그먼트|segment|customer|persona|성향|후보)/iu.test(text)) {
    return "primary_customer_narrowing";
  }

  if (/(?:구매자|구매|결제자|사용자와|buyer)/iu.test(text)) {
    return "buyer_user_split";
  }

  if (/(?:범위|기능|첫\s*버전|mvp|scope)/iu.test(text)) {
    return "mvp_validation_scope";
  }

  if (/(?:제외|하지\s*않을|non-?goal|boundary)/iu.test(text)) {
    return "non_goal_boundaries";
  }

  return undefined;
}

function choiceTopicKeyForQuestion(input: ResearchFollowUpAnswerInput) {
  const text = normalizedQuestionContext(input);

  return choiceTopicKeyForText(text);
}

function choiceAnswerOptions(input: ResearchFollowUpAnswerInput, answerShape: ResearchFollowUpAnswerShape) {
  const explicitSourceOptions = input.sourceQuestion?.answerOptions;
  const sourceTopicOptions = answerOptionsForQuestion(input.sourceQuestion?.topicKey, input.sourceQuestion?.expectedAnswerType);
  const questionCandidateOptions = candidateAnswerOptionsFromQuestion(input.question);
  const questionTopicKey = choiceTopicKeyForText(input.question);
  const contextualTopicKey = choiceTopicKeyForQuestion(input);
  const domainSpecificOptions = domainSpecificCustomerAnswerOptions(domainSpecificQuestionContext(input));
  const questionTopicOptions = questionTopicKey
    ? answerOptionsForQuestion(questionTopicKey, researchFollowUpExpectedAnswerType(input))
    : undefined;

  if (
    questionCandidateOptions.length &&
    !(domainSpecificOptions.length && looksLikeGenericBuilderSegmentOptions(questionCandidateOptions))
  ) {
    return boundedChoiceAnswerOptions(questionCandidateOptions, answerShape);
  }

  if (domainSpecificOptions.length && contextualTopicKey === "primary_customer_narrowing") {
    return boundedChoiceAnswerOptions(domainSpecificOptions, answerShape);
  }

  if (questionTopicOptions?.length) {
    return boundedChoiceAnswerOptions(questionTopicOptions, answerShape);
  }

  if (explicitSourceOptions?.length) {
    return boundedChoiceAnswerOptions(explicitSourceOptions, answerShape);
  }

  if (sourceTopicOptions?.length) {
    return boundedChoiceAnswerOptions(sourceTopicOptions, answerShape);
  }

  return boundedChoiceAnswerOptions(
    answerOptionsForQuestion(contextualTopicKey, researchFollowUpExpectedAnswerType(input)) ?? [],
    answerShape
  );
}

function binaryChoiceAnswerOptions() {
  return boundedResearchFollowUpAnswerOptions([
    researchFollowUpAnswerOption(
      "agree_or_continue",
      "진행 후보로 둔다",
      "현재 단서로는 이 방향을 다음 스펙 또는 검증 후보에 올린다.",
      "결정이 닫혀 다음 작업으로 넘어가기 쉽습니다.",
      "숨은 반례가 있으면 너무 빠른 확정이 될 수 있습니다."
    ),
    researchFollowUpAnswerOption(
      "disagree_or_stop",
      "보류하거나 좁힌다",
      "현재 단서로는 바로 진행하지 않고 범위 축소 또는 방향 전환을 검토한다.",
      "잘못된 가정에 계속 투자하는 일을 줄입니다.",
      "실제로는 유효한 기회를 너무 일찍 버릴 수 있습니다."
    ),
    researchFollowUpAnswerOption(
      "conditional_yes",
      "조건을 붙여 진행한다",
      "특정 조건이나 추가 확인이 충족되면 진행하고, 그 조건을 답변에 함께 적는다.",
      "찬반을 단순화하지 않고 실행 조건까지 남길 수 있습니다.",
      "조건이 흐리면 다음 질문이나 리서치가 한 번 더 필요합니다."
    ),
    researchFollowUpAnswerOption(
      "need_more_research",
      "추가 리서치로 보강한다",
      "결정을 내리기 전에 더 넓은 자료와 반례를 먼저 확인한다.",
      "중요한 결정을 더 안전하게 만들 수 있습니다.",
      "결정 완료와 구현 시작이 늦어집니다."
    )
  ]);
}

function evidenceJudgmentAnswerOptions(input: ResearchFollowUpAnswerInput) {
  const hasProEvidence = input.evidenceMatrix.proEvidence.length > 0;
  const hasConEvidence = input.evidenceMatrix.conEvidence.length > 0;
  const hasUncertainty = input.evidenceMatrix.uncertainties.length > 0;
  const context = normalizedQuestionContext(input);

  if (/(?:구매자|결제자|실제\s*사용자|사용자가\s*같|사용자가\s*다르|buyer|payer|end\s*user)/iu.test(context)) {
    return boundedResearchFollowUpAnswerOptions([
      researchFollowUpAnswerOption(
        "buyer_user_same",
        "구매자와 실제 사용자가 같다",
        "구매자와 실제 사용자가 같은 사람이라고 보고 인터뷰와 첫 스펙을 맞춘다.",
        "첫 인터뷰, 결제 의향 질문, 제품 화면을 같은 보호자/담당자 기준으로 정합니다.",
        "가족, 병원, 보호자처럼 역할이 나뉘는 경우는 별도 확인이 필요합니다."
      ),
      researchFollowUpAnswerOption(
        "buyer_user_different",
        "구매자와 실제 사용자가 다르다",
        "구매 의사결정자와 매일 쓰는 사용자를 분리해 검증한다.",
        "가격·결제 질문과 실제 사용 흐름 질문을 따로 설계합니다.",
        "초기 인터뷰 수가 늘어나고 첫 스펙 범위가 커질 수 있습니다."
      ),
      researchFollowUpAnswerOption(
        "need_more_research",
        "추가 리서치로 근거자료를 더 보강한다",
        "구매자와 실제 사용자 관계를 확정하기 전에 더 넓은 자료와 사례를 확인한다.",
        "역할을 잘못 정해 제품/가격 판단이 어긋나는 일을 줄입니다.",
        "결정 완료와 구현 시작이 늦어집니다."
      ),
      researchFollowUpAnswerOption(
        "spec_not_ready",
        "지금은 스펙을 확정하기 어렵다",
        "역할 구분이 불명확하므로 스펙 확정을 보류하고 리스크로 남긴다.",
        "불확실한 가정을 숨기지 않고 다음 확인 항목으로 남깁니다.",
        "당장 구현할 화면과 온보딩 문구는 좁게 정하기 어렵습니다."
      )
    ]);
  }

  const options: AmbiguityAnswerOption[] = [];

  if (hasProEvidence) {
    options.push(
      researchFollowUpAnswerOption(
        "pro_evidence_stronger",
        "이 방향을 우선 후보로 둔다",
        "현재 확인된 단서로는 이 방향을 다음 결정 후보에 올린다.",
        "다음 스펙/검증 판단으로 빠르게 연결할 수 있습니다.",
        "다른 관점의 사례가 부족하면 과신이 될 수 있습니다."
      )
    );
  }

  if (hasConEvidence) {
    options.push(
      researchFollowUpAnswerOption(
        "con_evidence_stronger",
        "범위 축소나 방향 전환을 검토한다",
        "현재 확인된 다른 관점 때문에 범위를 줄이거나 다른 방향을 함께 본다.",
        "실패 가능성을 일찍 드러내고 낭비를 줄입니다.",
        "너무 이른 축소로 좋은 기회를 놓칠 수 있습니다."
      )
    );
  }

  if (!hasConEvidence) {
    options.push(
      researchFollowUpAnswerOption(
        "find_counter_evidence",
        "반례와 한계를 더 확인한다",
        "아직 다른 관점의 사례가 부족하므로 결론을 미루고 한계를 더 조사한다.",
        "중요한 결정을 더 안전하게 만들 수 있습니다.",
        "질문/리서치 루프가 한 번 더 길어집니다."
      )
    );
  }

  if (hasUncertainty) {
    options.push(
      researchFollowUpAnswerOption(
        "resolve_uncertainty_first",
        "불확실한 조건부터 확인한다",
        "아직 불명확한 조건을 먼저 확인한 뒤 판단한다.",
        "빈틈을 숨기지 않고 다음 행동으로 바꿉니다.",
        "즉시 스펙을 확정하기는 어렵습니다."
      )
    );
  }

  options.push(
    researchFollowUpAnswerOption(
      "narrow_scope",
      "작게 좁혀서 먼저 검증한다",
      "전체 결론을 확정하지 않고 더 작은 고객/기능/검증 범위로 좁혀 진행한다.",
      "다음 실험과 구현 범위가 작아집니다.",
      "큰 시장 또는 넓은 사용 사례 검증은 뒤로 밀릴 수 있습니다."
    ),
    researchFollowUpAnswerOption(
      "need_more_research",
      "추가 리서치로 근거자료를 더 보강한다",
      "지금 답하기에는 자료가 부족하므로 더 넓은 자료를 모은다.",
      "성급한 결정을 줄입니다.",
      "결정 완료와 구현 시작이 늦어집니다."
    ),
    researchFollowUpAnswerOption(
      "spec_not_ready",
      "지금은 스펙을 확정하기 어렵다",
      "지금 확정하지 않고 다음 검증에서 확인할 조건을 답변에 남긴다.",
      "보류 이유와 다음 확인 조건을 답변 흐름 안에 남길 수 있습니다.",
      "구현을 바로 시작하기에는 결정 기준이 부족합니다."
    )
  );

  return boundedResearchFollowUpAnswerOptions(options);
}

export function researchFollowUpAnswerOptions(input: ResearchFollowUpAnswerInput): readonly AmbiguityAnswerOption[] {
  const answerShape = classifyResearchFollowUpAnswerShape(input);

  if (answerShape === "open_text") {
    return [];
  }

  if (answerShape === "binary_choice") {
    return binaryChoiceAnswerOptions();
  }

  if (answerShape === "single_choice" || answerShape === "multi_select" || answerShape === "ranked_choice") {
    return choiceAnswerOptions(input, answerShape);
  }

  return evidenceJudgmentAnswerOptions(input);
}
