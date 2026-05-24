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
  | "binary_choice"
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
  return /(?:고객|세그먼트|segment|customer|persona|성향|후보)/iu.test(
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

function hasOpenTextCue(question: string) {
  return /(?:주관식|서술형|자유\s*(?:답변|서술|입력)|직접\s*(?:입력|작성)|서술|설명|적어\s*주|작성|말로\s*(?:풀어|설명)|본인\s*말|자유롭게|구체적으로\s*(?:말|설명)|왜|어떻게|어떤\s*(?:상황|맥락|이유|제약)|describe|explain|write|free[-\s]?form|open[-\s]?ended|subjective)/iu.test(
    question
  );
}

function hasMultiSelectCue(question: string) {
  return /(?:복수|다중|모두|해당|중복|하나\s*(?:혹은|또는)?\s*여러\s*개|하나\s*이상|여러\s*(?:개|항목)|둘\s*이상|복수\s*선택|다중\s*선택|복수선택|다중선택|multi[-\s]?select|one\s+or\s+more|select\s+all|multiple|which\s+.+\s+together)/iu.test(
    question
  );
}

function hasBinaryChoiceCue(question: string) {
  return /(?:찬성\s*[/·또는과]*\s*반대|반대\s*[/·또는과]*\s*찬성|동의\s*[/·또는과]*\s*비동의|예\s*[/·또는과]*\s*아니오|양자\s*택일|양자택일|yes\s*[/ ]?no|agree\s*[/ ]?disagree|support\s*[/ ]?oppose|찬성인지\s*반대|동의하시|찬성하시|반대하시|진행할까요|해야\s*할까요|반영할까요)/iu.test(
    question
  );
}

function hasConcreteSingleChoiceCue(question: string) {
  return /(?:객관식|선택형|단일\s*선택|단일선택|하나(?:를|만)?\s*(?:선택|고르)|중\s*(?:하나|한\s*가지)|종류\s*중\s*하나|어느\s*(?:후보|성향|고객|세그먼트|종류|선택지)|(?:무엇|어디|누구)에\s*집중|선택하시겠|집중하시겠|고르시겠|choose|pick|which\s+(?:one|customer|segment|option)|single[-\s]?choice)/iu.test(
    question
  );
}

function hasSingleChoiceCue(question: string) {
  return /(?:어느\s*방향|which\s+direction)/iu.test(question) || hasConcreteSingleChoiceCue(question);
}

function isSignalOrCriteriaResearchFollowUp(input: Pick<ResearchFollowUpAnswerInput, "question" | "researchTask" | "sourceQuestion">) {
  return /(?:신호|조건|요인|기준|signal|criteria|factor|indicator)/iu.test(
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

function sourceQuestionImpliesChoice(sourceQuestion: AmbiguityIssueSnapshot | undefined) {
  return sourceQuestion?.expectedAnswerType === "choice" || sourceQuestion?.expectedAnswerType === "rank";
}

export function classifyResearchFollowUpAnswerShape(input: ResearchFollowUpAnswerInput): ResearchFollowUpAnswerShape {
  if (hasMultiSelectCue(input.question)) {
    return "multi_select";
  }

  if (hasBinaryChoiceCue(input.question)) {
    return "binary_choice";
  }

  if (hasConcreteSingleChoiceCue(input.question)) {
    return "single_choice";
  }

  if (hasOpenTextCue(input.question)) {
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

  if (isSignalOrCriteriaResearchFollowUp(input)) {
    return "customer_signal_selection";
  }

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

function binaryChoiceAnswerOptions() {
  return boundedResearchFollowUpAnswerOptions([
    researchFollowUpAnswerOption(
      "agree_or_continue",
      "찬성 / 진행",
      "현재 근거로는 이 방향에 찬성하고 다음 스펙 또는 검증 단계로 진행한다.",
      "결정이 닫혀 다음 작업으로 넘어가기 쉽습니다.",
      "숨은 반례가 있으면 너무 빠른 확정이 될 수 있습니다."
    ),
    researchFollowUpAnswerOption(
      "disagree_or_stop",
      "반대 / 보류",
      "현재 근거로는 이 방향에 반대하거나 보류하고 범위 축소 또는 방향 전환을 검토한다.",
      "잘못된 가정에 계속 투자하는 일을 줄입니다.",
      "실제로는 유효한 기회를 너무 일찍 버릴 수 있습니다."
    ),
    researchFollowUpAnswerOption(
      "conditional_yes",
      "조건부 찬성",
      "특정 조건이나 추가 확인이 충족되면 진행하고, 그 조건을 답변에 함께 적는다.",
      "찬반을 단순화하지 않고 실행 조건까지 남길 수 있습니다.",
      "조건이 흐리면 다음 질문이나 리서치가 한 번 더 필요합니다."
    ),
    researchFollowUpAnswerOption(
      "need_more_research",
      "추가 근거 필요",
      "찬성/반대를 정하기 전에 더 넓은 근거와 반례를 먼저 확인한다.",
      "중요한 결정을 더 안전하게 만들 수 있습니다.",
      "결정 완료와 구현 시작이 늦어집니다."
    )
  ]);
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

  if (answerShape === "binary_choice") {
    return binaryChoiceAnswerOptions();
  }

  if (answerShape === "single_choice" || answerShape === "multi_select") {
    return choiceAnswerOptions(input);
  }

  return evidenceJudgmentAnswerOptions(input);
}
