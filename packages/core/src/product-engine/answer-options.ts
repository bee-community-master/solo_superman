import type {
  AmbiguityAnswerOption,
  AmbiguityExpectedAnswerType
} from "@solo-superman/contracts";
import { plainUserFacingDecisionQueueText } from "./user-facing-text";

export type AnswerOptionSeed = {
  readonly topicKey: string | undefined;
  readonly expectedAnswerType: AmbiguityExpectedAnswerType;
  readonly answerOptions?: readonly AmbiguityAnswerOption[];
  readonly contextText?: string;
};

function plainUserFacingAnswerOption(option: AmbiguityAnswerOption): AmbiguityAnswerOption {
  const primaryDetail = option.primaryDetail ?? option.pro;
  const secondaryDetail = option.secondaryDetail ?? option.con;

  return {
    ...option,
    label: plainUserFacingDecisionQueueText(option.label),
    value: plainUserFacingDecisionQueueText(option.value),
    primaryDetail: plainUserFacingDecisionQueueText(primaryDetail),
    secondaryDetail: plainUserFacingDecisionQueueText(secondaryDetail),
    pro: plainUserFacingDecisionQueueText(option.pro),
    con: plainUserFacingDecisionQueueText(option.con)
  };
}

function answerOption(
  id: string,
  label: string,
  value: string,
  primaryDetail: string,
  secondaryDetail: string
): AmbiguityAnswerOption {
  return plainUserFacingAnswerOption({
    id,
    label,
    value,
    primaryDetail,
    secondaryDetail,
    pro: primaryDetail,
    con: secondaryDetail
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
      "현재 확보된 리서치 단서와 반례가 강한 순서로 우선순위를 매긴다.",
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
      "이 방향을 우선 후보로 둔다",
      "현재 확인된 단서로는 이 방향을 다음 결정 후보에 올린다.",
      "결정 후보로 빠르게 이동할 수 있습니다.",
      "다른 관점의 사례가 부족하면 과신이 될 수 있습니다."
    ),
    answerOption(
      "con_evidence_stronger",
      "범위 축소나 방향 전환을 검토한다",
      "현재 확인된 다른 관점 때문에 범위를 줄이거나 다른 방향을 함께 본다.",
      "실패 가능성을 빨리 드러냅니다.",
      "너무 이른 축소로 좋은 기회를 놓칠 수 있습니다."
    ),
    answerOption(
      "evidence_incomplete",
      "추가 리서치로 근거자료를 더 보강한다",
      "지금 답하기에는 자료가 부족하므로 더 넓은 자료를 모은다.",
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

type PrimaryCustomerContextProfile = {
  readonly id: string;
  readonly pattern: RegExp;
  readonly questionSubject: string;
  readonly personReference: string;
  readonly answerOptions: readonly AmbiguityAnswerOption[];
};

const PET_LIFECYCLE_PRIMARY_CUSTOMER_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "first_pet_guardian",
    "첫 반려동물을 키우는 보호자",
    "첫 반려동물을 키우는 보호자를 가장 먼저 만나 문제와 사용 장면을 확인한다.",
    "초보 보호자의 의료·급여·일상 기록 흐름을 먼저 검증합니다.",
    "노령·보험·장례처럼 복잡한 생애 후반 문제는 약하게 보일 수 있습니다."
  ),
  answerOption(
    "senior_chronic_pet_guardian",
    "노령·만성질환 반려동물 보호자",
    "노령·만성질환 반려동물 보호자를 가장 먼저 만나 기록·비용·돌봄 문제를 확인한다.",
    "병원 기록, 투약, 보험, 비용 관리의 강한 문제를 먼저 검증합니다.",
    "일상 관리 중심의 대중적 사용성은 별도 확인이 필요합니다."
  ),
  answerOption(
    "multi_pet_household",
    "여러 마리를 함께 키우는 가구",
    "여러 마리를 함께 키우는 가구를 가장 먼저 만나 동물별 관리 문제를 확인한다.",
    "동물별 의료·급여·보험 기록을 구분 관리하는 문제를 확인합니다.",
    "한 마리 보호자에게는 기능이 과하게 느껴질 수 있습니다."
  ),
  answerOption(
    "insurance_cost_sensitive_guardian",
    "보험·의료비 관리가 필요한 보호자",
    "보험·의료비 관리가 필요한 보호자를 가장 먼저 만나 비용 관리 문제를 확인한다.",
    "지불 의향과 반복 사용 신호를 비용 관리 문제에서 확인합니다.",
    "보험이 없거나 의료비 부담이 낮은 보호자에게는 가치가 약할 수 있습니다."
  )
];

const HEALTHCARE_PRIMARY_CUSTOMER_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "chronic_condition_patient",
    "만성질환을 꾸준히 관리하는 환자",
    "만성질환을 꾸준히 관리하는 환자를 가장 먼저 만나 반복 관리 문제를 확인한다.",
    "복약, 기록, 병원 방문 전후처럼 반복되는 사용 장면을 검증합니다.",
    "가벼운 건강관리 사용자에게는 기능이 무겁게 느껴질 수 있습니다."
  ),
  answerOption(
    "caregiver_family_member",
    "가족 건강을 함께 챙기는 보호자",
    "가족 건강을 함께 챙기는 보호자를 가장 먼저 만나 대리 관리 문제를 확인한다.",
    "구매자와 실제 사용자가 나뉘는지 일찍 확인할 수 있습니다.",
    "본인이 직접 쓰는 건강관리 습관은 별도 검증이 필요합니다."
  ),
  answerOption(
    "post_visit_record_keeper",
    "진료 전후 기록이 많은 사용자",
    "진료 전후 기록이 많은 사용자를 가장 먼저 만나 기록 정리 문제를 확인한다.",
    "병원 방문이라는 명확한 순간에서 문제 강도를 확인합니다.",
    "방문 빈도가 낮으면 반복 사용성이 약할 수 있습니다."
  ),
  answerOption(
    "preventive_wellness_tracker",
    "검진·복약·생활습관을 챙기는 사용자",
    "검진, 복약, 생활습관을 챙기는 사용자를 가장 먼저 만나 예방 관리 문제를 확인한다.",
    "넓은 건강관리 시장의 대중적 사용성을 탐색할 수 있습니다.",
    "지불 의향과 급한 문제 강도는 약하게 나올 수 있습니다."
  )
];

const EDUCATION_PRIMARY_CUSTOMER_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "exam_prep_learner",
    "시험을 준비하는 학습자",
    "시험을 준비하는 학습자를 가장 먼저 만나 목표와 마감이 있는 학습 문제를 확인한다.",
    "성과 기준과 사용 빈도가 비교적 선명합니다.",
    "시험 외 학습이나 장기 역량 개발 문제는 뒤로 밀릴 수 있습니다."
  ),
  answerOption(
    "career_switching_learner",
    "직무 전환·업스킬 학습자",
    "직무 전환이나 업스킬을 원하는 학습자를 가장 먼저 만나 실무형 학습 문제를 확인한다.",
    "돈과 시간을 낼 이유가 비교적 뚜렷합니다.",
    "학교나 어린 학생 중심의 사용성은 별도 확인이 필요합니다."
  ),
  answerOption(
    "parent_supported_student",
    "학부모가 함께 관리하는 학생",
    "학부모가 함께 관리하는 학생을 가장 먼저 만나 구매자와 사용자가 나뉘는 문제를 확인한다.",
    "의사결정자와 실제 사용자 분리를 일찍 검증합니다.",
    "제품 경험이 학부모 중심으로 과하게 기울 수 있습니다."
  ),
  answerOption(
    "small_education_operator",
    "소규모 교육 운영자",
    "소규모 교육 운영자를 가장 먼저 만나 학습 관리와 운영 문제를 확인한다.",
    "반복 운영, 결제, 관리 니즈를 함께 볼 수 있습니다.",
    "개별 학습자의 직접 사용 문제는 약하게 보일 수 있습니다."
  )
];

const PERSONAL_FINANCE_PRIMARY_CUSTOMER_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "paycheck_budgeter",
    "월급과 고정지출을 관리하는 직장인",
    "월급과 고정지출을 관리하는 직장인을 가장 먼저 만나 반복 예산 관리 문제를 확인한다.",
    "월 단위 반복 사용성과 명확한 비용 문제를 검증합니다.",
    "투자나 사업자 회계처럼 복잡한 사용 사례는 뒤로 밀릴 수 있습니다."
  ),
  answerOption(
    "freelance_income_tracker",
    "수입이 불규칙한 프리랜서",
    "수입이 불규칙한 프리랜서를 가장 먼저 만나 현금흐름 관리 문제를 확인한다.",
    "문제 강도와 지불 의향이 비교적 높게 나타날 수 있습니다.",
    "일반 직장인에게는 기능이 과하게 느껴질 수 있습니다."
  ),
  answerOption(
    "shared_household_budgeter",
    "공동 생활비를 나누는 가구",
    "공동 생활비를 나누는 가구를 가장 먼저 만나 함께 쓰는 돈 관리 문제를 확인한다.",
    "구매자, 사용자, 공유 권한 문제를 함께 검증합니다.",
    "개인 재무 목표 관리 니즈는 별도로 확인해야 합니다."
  ),
  answerOption(
    "insurance_investment_tracker",
    "보험·투자·대출을 함께 보는 사용자",
    "보험, 투자, 대출을 함께 보는 사용자를 가장 먼저 만나 복합 금융 관리 문제를 확인한다.",
    "복잡한 정보 통합과 장기 관리 가치를 검증합니다.",
    "규제·신뢰·보안 요구가 빠르게 커질 수 있습니다."
  )
];

const LOCAL_COMMERCE_PRIMARY_CUSTOMER_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "small_store_owner",
    "소규모 매장 운영자",
    "소규모 매장 운영자를 가장 먼저 만나 주문, 예약, 고객 관리 문제를 확인한다.",
    "예산과 운영 고통을 가진 구매자를 직접 검증할 수 있습니다.",
    "최종 소비자의 사용 경험은 별도 검증이 필요합니다."
  ),
  answerOption(
    "repeat_local_customer",
    "반복 방문하는 단골 고객",
    "반복 방문하는 단골 고객을 가장 먼저 만나 재방문과 편의 문제를 확인한다.",
    "소비자 관점의 반복 사용 이유를 빠르게 확인합니다.",
    "매장 운영자가 실제로 돈을 낼지는 아직 불확실합니다."
  ),
  answerOption(
    "pickup_delivery_customer",
    "픽업·배달을 자주 쓰는 고객",
    "픽업이나 배달을 자주 쓰는 고객을 가장 먼저 만나 주문 전후 불편을 확인한다.",
    "뚜렷한 사용 상황과 행동 신호를 볼 수 있습니다.",
    "방문형 매장 경험과는 다른 문제로 좁혀질 수 있습니다."
  ),
  answerOption(
    "multi_location_operator",
    "여러 지점을 관리하는 운영자",
    "여러 지점을 관리하는 운영자를 가장 먼저 만나 관리 복잡도 문제를 확인한다.",
    "조직형 구매와 운영 효율 가치를 일찍 검증합니다.",
    "초기 제품 범위가 커질 수 있습니다."
  )
];

const CREATOR_PRIMARY_CUSTOMER_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "solo_creator",
    "혼자 콘텐츠를 만드는 크리에이터",
    "혼자 콘텐츠를 만드는 크리에이터를 가장 먼저 만나 기획·제작·게시 반복 문제를 확인한다.",
    "개인 생산성 문제와 반복 사용성을 빠르게 검증합니다.",
    "팀 제작이나 브랜드 운영 니즈는 뒤로 밀릴 수 있습니다."
  ),
  answerOption(
    "small_brand_marketer",
    "소규모 브랜드 마케터",
    "소규모 브랜드 마케터를 가장 먼저 만나 콘텐츠 성과와 운영 문제를 확인한다.",
    "구매 예산과 성과 지표를 함께 확인할 수 있습니다.",
    "개인 크리에이터에게는 제품이 업무용으로 느껴질 수 있습니다."
  ),
  answerOption(
    "short_form_video_creator",
    "숏폼 영상을 자주 올리는 창작자",
    "숏폼 영상을 자주 올리는 창작자를 가장 먼저 만나 빠른 제작 주기 문제를 확인한다.",
    "빈도 높은 사용 장면과 명확한 대체재를 검증합니다.",
    "글, 뉴스레터, 이미지 중심 창작자는 약하게 반영될 수 있습니다."
  ),
  answerOption(
    "agency_content_operator",
    "여러 계정을 운영하는 에이전시 담당자",
    "여러 계정을 운영하는 에이전시 담당자를 가장 먼저 만나 협업과 반복 운영 문제를 확인한다.",
    "조직 구매와 반복 업무 자동화 가치를 확인할 수 있습니다.",
    "권한, 승인, 협업 기능 요구가 빠르게 커질 수 있습니다."
  )
];

const PRIMARY_CUSTOMER_CONTEXT_PROFILES: readonly PrimaryCustomerContextProfile[] = [
  {
    id: "pet_lifecycle",
    pattern:
      /(?:반려\s*동물|반려견|반려묘|펫\b|pet\b|companion\s+animal|동물병원|수의|진료\s*기록|투약|의료비|사료|보험|장례|말기\s*케어|전생애|생애\s*주기)/iu,
    questionSubject: "보호자 유형",
    personReference: "그 보호자",
    answerOptions: PET_LIFECYCLE_PRIMARY_CUSTOMER_OPTIONS
  },
  {
    id: "healthcare",
    pattern:
      /(?:건강|헬스케어|의료|병원|환자|진료|복약|약\s*관리|만성\s*질환|혈당|혈압|검진|caregiver|health\s*care|healthcare|medical|patient|clinic)/iu,
    questionSubject: "사용자 유형",
    personReference: "그 사용자",
    answerOptions: HEALTHCARE_PRIMARY_CUSTOMER_OPTIONS
  },
  {
    id: "education",
    pattern:
      /(?:교육|학습|공부|시험|수업|과외|학생|학부모|강의|러닝|러너|edtech|learning|study|student|tutor|course|classroom)/iu,
    questionSubject: "학습자/교육 사용자 유형",
    personReference: "그 사용자",
    answerOptions: EDUCATION_PRIMARY_CUSTOMER_OPTIONS
  },
  {
    id: "personal_finance",
    pattern:
      /(?:가계부|예산|지출|소비|저축|보험|대출|투자|자산|월급|생활비|카드값|현금흐름|finance|budget|expense|saving|investment|loan|insurance)/iu,
    questionSubject: "금융 관리 사용자 유형",
    personReference: "그 사용자",
    answerOptions: PERSONAL_FINANCE_PRIMARY_CUSTOMER_OPTIONS
  },
  {
    id: "local_commerce",
    pattern:
      /(?:식당|카페|매장|소상공인|예약|주문|픽업|배달|단골|로컬\s*커머스|restaurant|cafe|store|merchant|reservation|order|pickup|delivery)/iu,
    questionSubject: "고객/운영자 유형",
    personReference: "그 사람",
    answerOptions: LOCAL_COMMERCE_PRIMARY_CUSTOMER_OPTIONS
  },
  {
    id: "creator",
    pattern:
      /(?:크리에이터|콘텐츠|창작|유튜브|유튜버|인스타|틱톡|숏폼|뉴스레터|블로그|creator|content|youtube|instagram|tiktok|shorts|newsletter|blog)/iu,
    questionSubject: "창작자/운영자 유형",
    personReference: "그 사람",
    answerOptions: CREATOR_PRIMARY_CUSTOMER_OPTIONS
  }
];

export function primaryCustomerContextProfileForText(contextText: string | undefined) {
  const normalizedContext = contextText ?? "";

  return PRIMARY_CUSTOMER_CONTEXT_PROFILES.find((profile) => profile.pattern.test(normalizedContext));
}

export function isPetLifecycleContextText(contextText: string | undefined) {
  return primaryCustomerContextProfileForText(contextText)?.id === "pet_lifecycle";
}

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
  customer_signal_selection: [
    answerOption(
      "repeat_manual_pain",
      "반복되는 수동 고통",
      "사용자가 같은 문제를 반복해서 수동으로 해결하고 있는지 확인한다.",
      "문제 강도와 사용 빈도를 빠르게 가늠할 수 있습니다.",
      "반복 빈도만으로는 지불 의향까지 증명되지 않습니다."
    ),
    answerOption(
      "budget_or_paid_intent",
      "예산/지불 의향",
      "해결책에 돈이나 시간을 실제로 낼 의향이 있는지 확인한다.",
      "사업화 가능성과 우선순위 판단에 직접 연결됩니다.",
      "초기 인터뷰에서는 긍정 답변이 실제 결제로 이어지지 않을 수 있습니다."
    ),
    answerOption(
      "alternative_dissatisfaction",
      "기존 대안 불만",
      "현재 쓰는 대안이 무엇이고 어디에서 불만이 큰지 확인한다.",
      "차별화와 MVP 범위를 좁히는 데 도움이 됩니다.",
      "기존 대안이 충분하면 새 제품 전환이 어려울 수 있습니다."
    ),
    answerOption(
      "self_built_workaround",
      "직접 만든 임시 해결책",
      "사용자가 이미 스프레드시트, 스크립트, 수동 절차 같은 임시 해결책을 만들었는지 확인한다.",
      "고통이 충분히 커서 직접 해결을 시도했는지 볼 수 있습니다.",
      "기술 친화적인 일부 사용자에게만 강하게 나타날 수 있습니다."
    ),
    answerOption(
      "repeat_use_or_sharing",
      "반복 사용/공유 신호",
      "한 번 쓰고 끝나는지, 반복 사용하거나 다른 사람에게 공유하려는 신호가 있는지 확인한다.",
      "retention과 확산 가능성의 초기 단서가 됩니다.",
      "관찰 시간이 필요해 즉시 확인하기 어려울 수 있습니다."
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

function contextualAnswerOptionsForQuestion(
  topicKey: string | undefined,
  expectedAnswerType: AmbiguityExpectedAnswerType,
  contextText: string | undefined
) {
  const primaryCustomerProfile = primaryCustomerContextProfileForText(contextText);

  if (topicKey === "primary_customer_narrowing" && primaryCustomerProfile) {
    return primaryCustomerProfile.answerOptions;
  }

  return answerOptionsForQuestion(topicKey, expectedAnswerType);
}

export function answerOptionsForSeed(seed: AnswerOptionSeed) {
  return (
    seed.answerOptions?.map(plainUserFacingAnswerOption) ??
    contextualAnswerOptionsForQuestion(seed.topicKey, seed.expectedAnswerType, seed.contextText)
  );
}
