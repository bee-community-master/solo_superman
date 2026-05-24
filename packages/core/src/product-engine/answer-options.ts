import type {
  AmbiguityAnswerOption,
  AmbiguityExpectedAnswerType
} from "@solo-superman/contracts";
import { plainUserFacingDecisionQueueText } from "./user-facing-text";

export type AnswerOptionSeed = {
  readonly topicKey: string | undefined;
  readonly expectedAnswerType: AmbiguityExpectedAnswerType;
  readonly answerOptions?: readonly AmbiguityAnswerOption[];
};

function plainUserFacingAnswerOption(option: AmbiguityAnswerOption): AmbiguityAnswerOption {
  return {
    ...option,
    label: plainUserFacingDecisionQueueText(option.label),
    value: plainUserFacingDecisionQueueText(option.value),
    pro: plainUserFacingDecisionQueueText(option.pro),
    con: plainUserFacingDecisionQueueText(option.con)
  };
}

function answerOption(
  id: string,
  label: string,
  value: string,
  pro: string,
  con: string
): AmbiguityAnswerOption {
  return plainUserFacingAnswerOption({
    id,
    label,
    value,
    pro,
    con
  });
}

const GENERIC_ANSWER_OPTIONS_BY_TYPE = {
  choice: [
    answerOption(
      "narrow_decision",
      "하나로 좁혀 결정",
      "가장 좁고 즉시 검증 가능한 하나의 선택지로 결정한다.",
      "다음 질문과 실험이 바로 선명해집니다.",
      "틀렸을 때 방향 전환 비용이 생길 수 있습니다."
    ),
    answerOption(
      "compare_two",
      "두 후보를 병렬 비교",
      "상위 두 후보를 남기고 같은 기준으로 비교 검증한다.",
      "성급한 확정을 줄이고 tradeoff가 보입니다.",
      "질문/리서치 부채가 한 번 더 남습니다."
    ),
    answerOption(
      "defer_as_risk",
      "리스크로 보류",
      "지금은 결정하지 않고 Known Risk와 다음 검증 행동으로 남긴다.",
      "불확실성을 숨기지 않고 다음 행동으로 연결합니다.",
      "핵심 결정이면 planning-ready가 지연될 수 있습니다."
    )
  ],
  text: [
    answerOption(
      "concrete_boundary",
      "구체 기준으로 답변",
      "측정 가능한 기준, 범위, 예외를 한 문장으로 고정한다.",
      "Spec section과 completion gate에 바로 반영하기 쉽습니다.",
      "근거가 약하면 과도하게 확정적으로 보일 수 있습니다."
    ),
    answerOption(
      "current_behavior",
      "현재 행동부터 설명",
      "현재 수동 방식, 빈도, 비용, 전후 행동을 먼저 서술한다.",
      "실제 workflow와 문제 강도를 놓치지 않습니다.",
      "최종 결정 문장으로는 한 번 더 정리가 필요합니다."
    ),
    answerOption(
      "unknown_next_check",
      "모름 + 다음 검증",
      "아직 모르는 상태로 두고 다음에 확인할 사람/자료/실험을 적는다.",
      "추측을 줄이고 검증 가능한 부채로 남깁니다.",
      "답변만으로는 관련 decision이 닫히지 않습니다."
    )
  ],
  rank: [
    answerOption(
      "rank_by_pain",
      "문제 강도순 정렬",
      "사용자 고통, 빈도, 전환 비용 순서로 우선순위를 매긴다.",
      "가장 큰 고객 리스크를 먼저 줄입니다.",
      "구현 난이도나 채널 현실성은 뒤로 밀릴 수 있습니다."
    ),
    answerOption(
      "rank_by_evidence",
      "근거 강도순 정렬",
      "현재 확보된 pro/con 근거가 강한 순서로 우선순위를 매긴다.",
      "과신과 confirmation bias를 줄입니다.",
      "중요하지만 아직 근거가 없는 항목이 과소평가될 수 있습니다."
    ),
    answerOption(
      "rank_after_research",
      "리서치 후 정렬",
      "지금은 순위를 확정하지 않고 비교 근거를 먼저 모은다.",
      "순위 결정의 품질을 높입니다.",
      "Decision Queue burn-down이 늦어질 수 있습니다."
    )
  ],
  evidence: [
    answerOption(
      "pro_evidence_stronger",
      "찬성 근거 우세",
      "현재는 찬성 근거가 더 강하지만 반대근거 탐색을 기록한다.",
      "결정 후보로 빠르게 이동할 수 있습니다.",
      "반대근거가 약하면 high-impact gate를 통과하지 못할 수 있습니다."
    ),
    answerOption(
      "con_evidence_stronger",
      "반대 근거 우세",
      "반대근거가 더 강하므로 범위 축소 또는 pivot 후보로 본다.",
      "실패 가능성을 빨리 드러냅니다.",
      "너무 이른 축소로 좋은 기회를 놓칠 수 있습니다."
    ),
    answerOption(
      "evidence_incomplete",
      "근거 불충분",
      "찬반 근거가 모두 부족해 research_needed로 남긴다.",
      "불확실성을 정직하게 유지합니다.",
      "답변만으로는 다음 decision이 닫히지 않습니다."
    )
  ],
  experiment: [
    answerOption(
      "interview_test",
      "인터뷰/수동 테스트",
      "이번 주 인터뷰나 수동 concierge 테스트로 검증한다.",
      "가장 빠르게 실제 반응을 볼 수 있습니다.",
      "표본이 작아 일반화가 어렵습니다."
    ),
    answerOption(
      "behavior_proxy",
      "행동 proxy 측정",
      "가입, 재방문, 결제 의향, 반복 사용 등 행동 proxy를 측정한다.",
      "말보다 강한 신호를 얻습니다.",
      "측정 준비가 필요해 시간이 더 걸릴 수 있습니다."
    ),
    answerOption(
      "experiment_defer",
      "실험 보류 + 조건",
      "지금은 실험하지 않고 시작 조건과 owner/date를 남긴다.",
      "실행 부담을 관리하면서 리스크를 숨기지 않습니다.",
      "검증이 미뤄져 confidence 상승은 제한됩니다."
    )
  ]
} as const satisfies Record<
  AmbiguityExpectedAnswerType,
  readonly AmbiguityAnswerOption[]
>;

const TOPIC_ANSWER_OPTIONS: Readonly<Partial<Record<string, readonly AmbiguityAnswerOption[]>>> = {
  primary_customer_narrowing: [
    answerOption(
      "solo_founders",
      "혼자 만드는 초기 창업자",
      "가장 먼저 검증할 primary customer는 혼자 제품을 만들기 시작한 초기 창업자다.",
      "문제와 채널을 좁혀 인터뷰가 빨라집니다.",
      "팀/조직형 고객의 요구는 놓칠 수 있습니다."
    ),
    answerOption(
      "domain_expert_builders",
      "도메인 전문 1인 빌더",
      "가장 먼저 검증할 primary customer는 특정 업계 경험이 있고 직접 도구를 만드는 1인 빌더다.",
      "고통과 전문성이 뚜렷해 깊은 답변을 얻기 쉽습니다.",
      "시장 크기와 반복 채널 검증은 더 필요합니다."
    ),
    answerOption(
      "two_segment_probe",
      "두 세그먼트 비교 검증",
      "초기 창업자와 도메인 전문 1인 빌더를 같은 질문으로 비교 검증한다.",
      "성급한 customer lock-in을 줄입니다.",
      "첫 배치의 실험 범위가 넓어집니다."
    )
  ],
  buyer_user_split: [
    answerOption(
      "same_person",
      "구매자와 사용자가 같다",
      "돈을 내는 사람과 실제 사용하는 사람은 같다.",
      "가격, 메시지, 인터뷰 대상을 단순하게 맞출 수 있습니다.",
      "조직 구매나 대리 의사결정 가능성을 놓칠 수 있습니다."
    ),
    answerOption(
      "different_roles",
      "구매자와 사용자가 다르다",
      "돈을 내는 사람과 실제 사용하는 사람이 다르며 각각 별도로 검증해야 한다.",
      "B2B/조직형 리스크를 일찍 드러냅니다.",
      "MVP와 검증 실험이 복잡해집니다."
    ),
    answerOption(
      "unknown_split",
      "아직 모른다",
      "구매자/사용자 분리는 아직 모르며 첫 인터뷰에서 확인한다.",
      "추측을 피하고 인터뷰 질문으로 전환합니다.",
      "paid intent decision은 아직 닫히지 않습니다."
    )
  ],
  mvp_validation_scope: [
    answerOption(
      "single_core_flow",
      "핵심 flow 하나만 포함",
      "첫 Build Slice는 핵심 검증 flow 하나만 포함하고 나머지는 제외한다.",
      "빠르게 만들고 검증할 수 있습니다.",
      "전체 제품 경험의 매력은 약해질 수 있습니다."
    ),
    answerOption(
      "manual_plus_ui",
      "수동 운영 + 얇은 UI",
      "수동 운영을 허용하고 사용자가 보는 얇은 UI만 만든다.",
      "학습 속도와 구현 부담의 균형이 좋습니다.",
      "자동화 가능성 검증은 뒤로 밀립니다."
    ),
    answerOption(
      "scope_cut_first",
      "포함보다 제외 먼저 결정",
      "이번 MVP에서 제외할 기능을 먼저 잠그고 남은 범위만 구현한다.",
      "scope creep을 강하게 막습니다.",
      "가치제안이 너무 작아질 수 있습니다."
    )
  ],
  non_goal_boundaries: [
    answerOption(
      "exclude_automation",
      "자동화 제외",
      "이번 MVP에서는 완전 자동화를 제외하고 수동 확인 가능한 flow만 남긴다.",
      "안전하고 검증 가능한 범위를 유지합니다.",
      "자동화 가치가 핵심이면 매력이 약해질 수 있습니다."
    ),
    answerOption(
      "exclude_integrations",
      "외부 연동 제외",
      "이번 MVP에서는 외부 계정/서비스 연동을 제외한다.",
      "보안·권한·운영 리스크를 줄입니다.",
      "실사용 workflow와 거리가 생길 수 있습니다."
    ),
    answerOption(
      "exclude_collaboration",
      "협업 기능 제외",
      "이번 MVP에서는 팀 협업, 권한, 공유 기능을 제외한다.",
      "개인/초기 사용 흐름을 빠르게 검증합니다.",
      "조직 구매자 검증에는 부족할 수 있습니다."
    )
  ],
  personal_gui_fit: [
    answerOption(
      "gui_required",
      "GUI가 필요하다",
      "첫 버전에는 직접 조작 가능한 GUI가 필요하다.",
      "반복 사용성과 상태 확인이 좋아집니다.",
      "구현 범위와 디자인 검증 비용이 커집니다."
    ),
    answerOption(
      "cli_or_docs_enough",
      "CLI/문서로 충분",
      "첫 버전은 CLI, 문서, 또는 간단한 로컬 화면으로 충분하다.",
      "가장 작게 만들어 실제 workflow를 검증합니다.",
      "비기술 사용자 사용성은 검증하기 어렵습니다."
    ),
    answerOption(
      "thin_local_screen",
      "얇은 로컬 화면",
      "핵심 상태만 보여주는 얇은 로컬 화면으로 시작한다.",
      "GUI 필요성과 구현 부담 사이의 균형이 좋습니다.",
      "복잡한 편집/자동화 UX는 아직 검증되지 않습니다."
    )
  ],
  personal_maintainability_boundary: [
    answerOption(
      "single_user_only",
      "단일 사용자만 지원",
      "이번 개인용 도구는 단일 사용자, 단일 기기 사용만 지원한다.",
      "유지보수와 권한 모델이 단순합니다.",
      "동기화/공유 요구가 생기면 재설계가 필요합니다."
    ),
    answerOption(
      "no_background_daemon",
      "상시 백그라운드 제외",
      "상시 실행 daemon이나 자동 스케줄러는 이번 버전에서 제외한다.",
      "운영 실패와 리소스 사용 리스크가 줄어듭니다.",
      "자동화 효용이 줄어 수동 실행이 남습니다."
    ),
    answerOption(
      "limited_file_scope",
      "파일 범위 제한",
      "읽고 쓰는 파일/폴더 범위를 명시적으로 제한한다.",
      "데이터 안전성과 예측 가능성이 올라갑니다.",
      "사용자가 원하는 모든 workflow를 담기 어렵습니다."
    )
  ]
};

export function answerOptionsForQuestion(
  topicKey: string | undefined,
  expectedAnswerType: AmbiguityExpectedAnswerType
): readonly AmbiguityAnswerOption[];
export function answerOptionsForQuestion(
  topicKey: string | undefined,
  expectedAnswerType: AmbiguityExpectedAnswerType | undefined
): readonly AmbiguityAnswerOption[] | undefined;
export function answerOptionsForQuestion(
  topicKey: string | undefined,
  expectedAnswerType: AmbiguityExpectedAnswerType | undefined
) {
  if (expectedAnswerType === "text") {
    return [];
  }

  return (
    (topicKey ? TOPIC_ANSWER_OPTIONS[topicKey] : undefined) ??
    (expectedAnswerType ? GENERIC_ANSWER_OPTIONS_BY_TYPE[expectedAnswerType] : undefined)
  );
}

export function answerOptionsForSeed(seed: AnswerOptionSeed) {
  return seed.answerOptions?.map(plainUserFacingAnswerOption) ?? answerOptionsForQuestion(seed.topicKey, seed.expectedAnswerType);
}
