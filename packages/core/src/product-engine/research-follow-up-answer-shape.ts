import type {
  AmbiguityAnswerOption,
  AmbiguityAnswerSelectionMode,
  AmbiguityExpectedAnswerType,
  AmbiguityIssueSnapshot,
  EvidenceMatrixProjection,
  ResearchTaskProjection
} from "@solo-superman/contracts";
import { answerOptionsForQuestion } from "./answer-options";

export type ResearchFollowUpAnswerShape =
  | "open_text"
  | "single_choice"
  | "multi_select"
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
  pro: string,
  con: string
): AmbiguityAnswerOption {
  return {
    id,
    label,
    value,
    pro,
    con
  };
}

function boundedResearchFollowUpAnswerOptions(options: readonly AmbiguityAnswerOption[]) {
  const bounded = [...options];
  const fallbackOptions = [
    researchFollowUpAnswerOption(
      "need_more_research",
      "추가 리서치 필요",
      "지금 답하기에는 근거가 부족하므로 더 넓은 자료를 모은다.",
      "성급한 결정을 줄입니다.",
      "결정 완료와 구현 시작이 늦어집니다."
    ),
    researchFollowUpAnswerOption(
      "write_custom_answer",
      "직접 서술",
      "위 선택지보다 더 정확한 판단 기준이나 후보를 직접 적는다.",
      "실제 상황에 맞는 세밀한 답을 남길 수 있습니다.",
      "답변을 스펙으로 옮길 때 한 번 더 정리가 필요할 수 있습니다."
    ),
    researchFollowUpAnswerOption(
      "defer_as_known_risk",
      "리스크로 보류",
      "지금 확정하지 않고 알려진 리스크와 다음 검증 작업으로 남긴다.",
      "불확실성을 숨기지 않고 추적할 수 있습니다.",
      "이번 답변만으로는 결정이 닫히지 않습니다."
    )
  ];

  for (const fallbackOption of fallbackOptions) {
    if (bounded.length >= 3) {
      break;
    }

    if (!bounded.some((option) => option.id === fallbackOption.id)) {
      bounded.push(fallbackOption);
    }
  }

  return bounded.slice(0, 10);
}

function isCustomerSegmentResearchFollowUp(input: Pick<ResearchFollowUpAnswerInput, "question" | "researchTask" | "sourceQuestion">) {
  return /(?:고객|사용자|세그먼트|segment|customer|persona|성향|후보)/iu.test(
    [
      input.question,
      input.researchTask.objective,
      input.sourceQuestion?.summary,
      input.sourceQuestion?.questionText,
      input.sourceQuestion?.topicKey
    ]
      .filter(Boolean)
      .join(" ")
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

function hasMultiSelectCue(question: string) {
  return /(?:여러|복수|모두|해당|중복|하나\s*이상|여러\s*개|둘\s*이상|복수\s*선택|one\s+or\s+more|select\s+all|multiple|which\s+.+\s+together)/iu.test(
    question
  );
}

function hasSingleChoiceCue(question: string) {
  return /(?:하나(?:를|만)?\s*(?:선택|고르)|중\s*(?:하나|한\s*가지)|어느\s*(?:방향|후보|성향|고객|세그먼트|종류)|(?:무엇|어디|누구)에\s*집중|선택하시겠|집중하시겠|고르시겠|choose|pick|which\s+(?:one|customer|segment|option|direction))/iu.test(
    question
  );
}

function sourceQuestionImpliesChoice(sourceQuestion: AmbiguityIssueSnapshot | undefined) {
  return sourceQuestion?.expectedAnswerType === "choice" || sourceQuestion?.expectedAnswerType === "rank";
}

export function classifyResearchFollowUpAnswerShape(input: ResearchFollowUpAnswerInput): ResearchFollowUpAnswerShape {
  if (hasMultiSelectCue(input.question)) {
    return "multi_select";
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

  if (answerShape === "evidence_judgment") {
    return "evidence";
  }

  if (answerShape === "open_text") {
    return /(?:실험|검증|테스트|확인|experiment|test|validate|validation)/iu.test(input.question)
      ? "experiment"
      : "text";
  }

  if (/(?:순위|우선순위|rank|priorit)/iu.test(input.question)) {
    return "rank";
  }

  return "choice";
}

export function researchFollowUpAnswerSelectionMode(input: ResearchFollowUpAnswerInput): AmbiguityAnswerSelectionMode {
  return classifyResearchFollowUpAnswerShape(input) === "multi_select" ? "multiple" : "single";
}

function choiceTopicKeyForQuestion(input: ResearchFollowUpAnswerInput) {
  const text = normalizedQuestionContext(input);

  if (isCustomerSegmentResearchFollowUp(input)) {
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

function choiceAnswerOptions(input: ResearchFollowUpAnswerInput) {
  const sourceOptions =
    input.sourceQuestion?.answerOptions ??
    answerOptionsForQuestion(input.sourceQuestion?.topicKey, input.sourceQuestion?.expectedAnswerType);

  if (sourceOptions?.length) {
    return boundedResearchFollowUpAnswerOptions(sourceOptions);
  }

  return boundedResearchFollowUpAnswerOptions(
    answerOptionsForQuestion(choiceTopicKeyForQuestion(input), researchFollowUpExpectedAnswerType(input)) ?? []
  );
}

function evidenceJudgmentAnswerOptions(input: ResearchFollowUpAnswerInput) {
  const hasProEvidence = input.evidenceMatrix.proEvidence.length > 0;
  const hasConEvidence = input.evidenceMatrix.conEvidence.length > 0;
  const hasUncertainty = input.evidenceMatrix.uncertainties.length > 0;
  const options: AmbiguityAnswerOption[] = [];

  if (hasProEvidence) {
    options.push(
      researchFollowUpAnswerOption(
        "pro_evidence_stronger",
        "찬성 근거가 더 강함",
        "현재 리서치에서는 찬성 근거가 더 강하므로 이 방향을 결정 후보로 둔다.",
        "다음 스펙/구현 판단으로 빠르게 연결할 수 있습니다.",
        "반대 근거가 부족하면 중요한 결정에서는 과신이 될 수 있습니다."
      )
    );
  }

  if (hasConEvidence) {
    options.push(
      researchFollowUpAnswerOption(
        "con_evidence_stronger",
        "반대 근거가 더 강함",
        "현재 리서치에서는 반대 근거가 더 강하므로 범위 축소나 방향 전환 후보로 본다.",
        "실패 가능성을 일찍 드러내고 낭비를 줄입니다.",
        "너무 이른 축소로 좋은 기회를 놓칠 수 있습니다."
      )
    );
  }

  if (!hasConEvidence) {
    options.push(
      researchFollowUpAnswerOption(
        "find_counter_evidence",
        "반대 근거를 더 찾기",
        "아직 반대 근거가 부족하므로 결론을 미루고 반례와 한계를 더 조사한다.",
        "중요한 결정을 더 안전하게 만들 수 있습니다.",
        "질문/리서치 루프가 한 번 더 길어집니다."
      )
    );
  }

  if (hasUncertainty) {
    options.push(
      researchFollowUpAnswerOption(
        "resolve_uncertainty_first",
        "불확실성부터 줄이기",
        "한계와 불확실성이 큰 부분을 먼저 확인한 뒤 판단한다.",
        "근거의 빈틈을 숨기지 않고 다음 행동으로 바꿉니다.",
        "즉시 스펙을 확정하기는 어렵습니다."
      )
    );
  }

  options.push(
    researchFollowUpAnswerOption(
      "narrow_scope",
      "범위를 좁혀 진행",
      "전체 결론을 확정하지 않고 더 작은 고객/기능/검증 범위로 좁혀 진행한다.",
      "다음 실험과 구현 범위가 작아집니다.",
      "큰 시장 또는 넓은 사용 사례 검증은 뒤로 밀릴 수 있습니다."
    ),
    researchFollowUpAnswerOption(
      "need_more_research",
      "추가 리서치 필요",
      "지금 답하기에는 근거가 부족하므로 더 넓은 자료를 모은다.",
      "성급한 결정을 줄입니다.",
      "결정 완료와 구현 시작이 늦어집니다."
    ),
    researchFollowUpAnswerOption(
      "write_custom_answer",
      "직접 서술",
      "위 선택지보다 더 정확한 판단 기준이나 후보를 직접 적는다.",
      "실제 상황에 맞는 세밀한 답을 남길 수 있습니다.",
      "답변을 스펙으로 옮길 때 한 번 더 정리가 필요할 수 있습니다."
    )
  );

  return boundedResearchFollowUpAnswerOptions(options);
}

export function researchFollowUpAnswerOptions(input: ResearchFollowUpAnswerInput): readonly AmbiguityAnswerOption[] {
  const answerShape = classifyResearchFollowUpAnswerShape(input);

  if (answerShape === "open_text") {
    return [];
  }

  if (answerShape === "single_choice" || answerShape === "multi_select") {
    return choiceAnswerOptions(input);
  }

  return evidenceJudgmentAnswerOptions(input);
}
