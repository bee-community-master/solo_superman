import type {
  AmbiguityAnswerOption,
  AmbiguityExpectedAnswerType
} from "@solo-superman/contracts";
import { plainUserFacingDecisionQueueText } from "./user-facing-text";
import {
  domainDerivedAnswerOptionsForTopic,
  extractIdeaFitDomainSignals,
  ideaFitDomainAnchorTerms
} from "./idea-fit-questioning";

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
      "성급한 확정을 줄이고 장단점이 보입니다.",
      "질문/리서치 부채가 한 번 더 남습니다."
    ),
    answerOption(
      "defer_as_risk",
      "리스크로 보류",
      "지금은 결정하지 않고 다음에 확인할 리스크로 남긴다.",
      "불확실성을 숨기지 않고 다음 행동으로 연결합니다.",
      "핵심 결정이면 다음 단계 준비가 지연될 수 있습니다."
    )
  ],
  text: [
    answerOption(
      "concrete_boundary",
      "구체 기준으로 답변",
      "측정 가능한 기준, 범위, 예외를 한 문장으로 고정한다.",
      "기획 문서와 완료 기준에 바로 반영하기 쉽습니다.",
      "근거가 약하면 과도하게 확정적으로 보일 수 있습니다."
    ),
    answerOption(
      "current_behavior",
      "현재 행동부터 설명",
      "현재 수동 방식, 빈도, 비용, 전후 행동을 먼저 서술한다.",
      "실제 사용 흐름과 문제 강도를 놓치지 않습니다.",
      "최종 결정 문장으로는 한 번 더 정리가 필요합니다."
    ),
    answerOption(
      "unknown_next_check",
      "모름 + 다음 검증",
      "아직 모르는 상태로 두고 다음에 확인할 사람/자료/실험을 적는다.",
      "추측을 줄이고 검증 가능한 부채로 남깁니다.",
      "답변만으로는 관련 판단이 닫히지 않습니다."
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
      "현재 확보된 리서치 단서와 보완할 관점이 강한 순서로 우선순위를 매긴다.",
      "과신과 한쪽으로 치우친 판단을 줄입니다.",
      "중요하지만 아직 근거가 없는 항목이 과소평가될 수 있습니다."
    ),
    answerOption(
      "rank_after_research",
      "리서치 후 정렬",
      "지금은 순위를 확정하지 않고 비교 근거를 먼저 모은다.",
      "순위 결정의 품질을 높입니다.",
      "질문 정리가 늦어질 수 있습니다."
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
      "답변만으로는 다음 판단이 닫히지 않습니다."
    )
  ],
  experiment: [
    answerOption(
      "interview_test",
      "인터뷰/수동 테스트",
      "이번 주 인터뷰나 수동 도움 테스트로 확인한다.",
      "가장 빠르게 실제 반응을 볼 수 있습니다.",
      "표본이 작아 일반화가 어렵습니다."
    ),
    answerOption(
      "behavior_signal",
      "말이 아니라 행동으로 확인",
      "가입, 재방문, 결제 시도, 반복 사용처럼 실제 행동을 확인한다.",
      "말보다 강한 신호를 얻습니다.",
      "측정 준비가 필요해 시간이 더 걸릴 수 있습니다."
    ),
    answerOption(
      "experiment_defer",
      "나중에 확인할 조건 남기기",
      "지금은 실험하지 않고 언제, 누가, 무엇을 확인할지 남긴다.",
      "실행 부담을 관리하면서 리스크를 숨기지 않습니다.",
      "확인이 미뤄져 확신을 높이기는 어렵습니다."
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
  readonly topicAnswerOptions?: Readonly<Partial<Record<string, readonly AmbiguityAnswerOption[]>>>;
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
    "돈을 낼 이유와 반복 사용 신호를 비용 관리 문제에서 확인합니다.",
    "보험이 없거나 의료비 부담이 낮은 보호자에게는 가치가 약할 수 있습니다."
  )
];

const PET_LIFECYCLE_BUYER_USER_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "guardian_decides_and_uses",
    "보호자가 직접 결정하고 쓴다",
    "반려동물 보호자가 직접 비용을 내고 의료·급여·일상 기록도 관리한다.",
    "첫 인터뷰 대상과 구매 판단이 단순해집니다.",
    "가족, 병원, 보험사가 함께 관여하는 케이스는 놓칠 수 있습니다."
  ),
  answerOption(
    "family_shared_pet_care",
    "가족이 함께 돌봄을 나눈다",
    "한 명이 아니라 가족 구성원이 의료 기록, 급여, 비용 관리를 나눠 맡는다.",
    "공유와 권한 문제가 실제 사용 장면에 맞게 드러납니다.",
    "첫 버전 범위가 협업 기능 쪽으로 커질 수 있습니다."
  ),
  answerOption(
    "clinic_or_insurance_involved",
    "병원·보험사가 함께 관여한다",
    "보호자가 쓰지만 동물병원 기록이나 보험 청구 자료가 결정에 크게 관여한다.",
    "데이터 출처와 신뢰 문제가 초기에 보입니다.",
    "연동·정책·증빙 요구가 첫 버전에 비해 커질 수 있습니다."
  )
];

const PET_LIFECYCLE_VALUE_PROP_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "medical_records_in_one_place",
    "의료기록을 한곳에 모은다",
    "보호자가 흩어진 진료 기록과 투약 정보를 한곳에서 찾을 수 있어 선택한다.",
    "반복적으로 찾는 기록 문제를 직접 겨냥합니다.",
    "급여·보험·장례까지의 전생애 가치가 약하게 보일 수 있습니다."
  ),
  answerOption(
    "care_routine_continuity",
    "급여·일상 루틴을 놓치지 않는다",
    "보호자가 급여, 투약, 생활 루틴을 꾸준히 관리할 수 있어 선택한다.",
    "반복 사용 이유와 알림/기록 가치를 확인할 수 있습니다.",
    "의료비나 보험처럼 돈을 낼 이유가 강한 문제는 별도 확인이 필요합니다."
  ),
  answerOption(
    "insurance_cost_documents",
    "보험·의료비 자료를 정리한다",
    "보호자가 보험 청구와 의료비 기록을 쉽게 정리할 수 있어 선택한다.",
    "돈을 낼 이유와 비용 절감 가치를 빠르게 확인합니다.",
    "보험을 쓰지 않는 보호자에게는 가치가 약할 수 있습니다."
  ),
  answerOption(
    "end_of_life_readiness",
    "장례·말기 케어까지 준비한다",
    "보호자가 장례와 말기 케어까지 미리 준비할 수 있어 선택한다.",
    "전생애주기 차별점이 가장 선명하게 드러납니다.",
    "정서적으로 민감해 첫 접근 문구와 인터뷰 방식이 어려울 수 있습니다."
  )
];

const PET_LIFECYCLE_MVP_SCOPE_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "pet_medical_record_slice",
    "의료기록 정리부터 검증",
    "첫 버전은 동물병원 기록, 투약, 진료 메모를 모아보는 흐름부터 검증한다.",
    "보호자가 반복해서 찾는 자료 문제를 작게 확인합니다.",
    "급여·보험·장례 기능은 첫 검증에서 제외됩니다."
  ),
  answerOption(
    "pet_daily_care_slice",
    "급여·일상 루틴부터 검증",
    "첫 버전은 급여, 투약, 일상 체크 기록을 유지하는 흐름부터 검증한다.",
    "반복 사용성과 습관 형성 가능성을 볼 수 있습니다.",
    "의료비나 보험처럼 강한 비용 문제는 뒤로 밀릴 수 있습니다."
  ),
  answerOption(
    "pet_insurance_cost_slice",
    "보험·의료비 정리부터 검증",
    "첫 버전은 의료비와 보험 청구 자료를 정리하는 흐름부터 검증한다.",
    "돈을 낼 이유와 문서 정리 가치를 빠르게 확인합니다.",
    "일상 돌봄 전체를 담는 앱이라는 인상은 약해질 수 있습니다."
  )
];

const PET_LIFECYCLE_VALIDATION_EXPERIMENT_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "guardian_record_sorting_test",
    "보호자 기록 정리 테스트",
    "보호자에게 실제 진료·투약 기록을 가져오게 하고 수동으로 한곳에 정리해 반응을 본다.",
    "제품 없이도 기록 통합 가치와 민감도를 확인합니다.",
    "수동 지원 효과와 제품 자체 가치를 분리해 봐야 합니다."
  ),
  answerOption(
    "insurance_document_walkthrough",
    "보험 청구 자료 워크스루",
    "보험·의료비 자료가 있는 보호자와 청구 준비 과정을 함께 따라가며 불편을 확인한다.",
    "비용 문제와 돈을 낼 이유를 구체적으로 볼 수 있습니다.",
    "보험 이용자가 아닌 보호자에게 일반화하기 어렵습니다."
  ),
  answerOption(
    "senior_pet_care_plan_probe",
    "노령 반려동물 케어 플랜 확인",
    "노령·만성질환 반려동물 보호자에게 케어 계획 카드나 기록 샘플을 보여주고 저장 의향을 묻는다.",
    "강한 문제를 가진 보호자부터 검증합니다.",
    "무거운 케이스 중심으로 제품 범위가 커질 수 있습니다."
  )
];

const PET_LIFECYCLE_NON_GOAL_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "exclude_clinic_integration",
    "동물병원 자동 연동 제외",
    "첫 버전에서는 동물병원 시스템 자동 연동을 제외하고 보호자 입력/업로드만 다룬다.",
    "권한·연동 리스크를 줄이고 빠르게 검증할 수 있습니다.",
    "기록 자동화 기대가 큰 보호자에게는 매력이 약할 수 있습니다."
  ),
  answerOption(
    "exclude_claim_automation",
    "보험 청구 자동화 제외",
    "첫 버전에서는 보험 청구 자동 제출이 아니라 자료 정리와 확인까지만 다룬다.",
    "정책·오류 리스크를 줄입니다.",
    "보험 관리 가치를 강하게 느끼는 사용자는 부족하다고 볼 수 있습니다."
  ),
  answerOption(
    "exclude_end_of_life_services",
    "장례 상담·예약 제외",
    "첫 버전에서는 장례 상담, 예약, 결제 연결을 제외하고 기록/준비 정보만 다룬다.",
    "민감하고 운영 부담이 큰 영역을 뒤로 미룹니다.",
    "전생애주기 차별점은 첫 버전에서 덜 드러날 수 있습니다."
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
    "돈을 낼 이유와 급한 문제 강도는 약하게 나올 수 있습니다."
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
    "문제 강도와 돈을 낼 이유가 비교적 뚜렷하게 나타날 수 있습니다.",
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

const LOCAL_COMMERCE_BUYER_USER_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "merchant_decides_customer_uses",
    "매장이 비용을 내고 고객이 쓴다",
    "매장 운영자가 비용을 내고 손님은 예약, 주문, 혜택을 사용한다.",
    "가격과 영업 대상이 매장으로 선명해집니다.",
    "손님이 실제로 반복 사용할지는 별도 확인이 필요합니다."
  ),
  answerOption(
    "customer_direct_value",
    "손님이 직접 가치를 느낀다",
    "반복 방문 손님이 예약, 픽업, 혜택 편의 때문에 직접 사용한다.",
    "소비자 반복 사용 신호를 빠르게 확인합니다.",
    "매장이 비용을 낼 이유는 아직 약할 수 있습니다."
  ),
  answerOption(
    "operator_staff_workflow",
    "운영자와 직원이 함께 쓴다",
    "매장 운영자와 직원이 주문, 예약, 단골 관리를 함께 처리한다.",
    "현장 운영 흐름과 권한 문제를 볼 수 있습니다.",
    "소규모 매장에는 기능이 무겁게 느껴질 수 있습니다."
  )
];

const LOCAL_COMMERCE_VALUE_PROP_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "reservation_order_unified",
    "예약·주문을 한곳에 모은다",
    "매장과 손님이 예약과 픽업 주문을 한곳에서 처리할 수 있어 선택한다.",
    "반복 운영 문제를 직접 줄입니다.",
    "단골 혜택이나 재방문 가치는 약하게 보일 수 있습니다."
  ),
  answerOption(
    "regular_customer_rewards",
    "단골 혜택을 쉽게 관리한다",
    "매장이 단골 혜택과 재방문 기록을 쉽게 관리할 수 있어 선택한다.",
    "반복 방문과 매출 가치에 연결됩니다.",
    "신규 주문 처리 문제는 뒤로 밀릴 수 있습니다."
  ),
  answerOption(
    "pickup_wait_reduction",
    "픽업 대기와 혼선을 줄인다",
    "손님과 매장이 픽업 시간, 준비 상태, 주문 확인을 덜 헷갈려 선택한다.",
    "명확한 사용 순간과 행동 변화를 볼 수 있습니다.",
    "예약 중심 매장에는 덜 중요할 수 있습니다."
  )
];

const LOCAL_COMMERCE_MVP_SCOPE_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "reservation_slice",
    "예약 흐름부터 검증",
    "첫 버전은 예약 생성, 변경, 확인 흐름만 검증한다.",
    "작은 범위로 매장 운영 문제를 확인합니다.",
    "주문과 단골 혜택 가치는 제외됩니다."
  ),
  answerOption(
    "pickup_order_slice",
    "픽업 주문부터 검증",
    "첫 버전은 픽업 주문과 준비 상태 확인 흐름만 검증한다.",
    "손님 행동과 매장 운영 부담을 동시에 볼 수 있습니다.",
    "예약형 매장에는 맞지 않을 수 있습니다."
  ),
  answerOption(
    "loyalty_slice",
    "단골 혜택부터 검증",
    "첫 버전은 방문 기록과 단골 혜택 관리 흐름만 검증한다.",
    "재방문 가치와 매장이 돈을 낼 이유를 확인합니다.",
    "즉시 주문/예약 문제 해결은 뒤로 밀립니다."
  )
];

const LOCAL_COMMERCE_VALIDATION_EXPERIMENT_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "merchant_booking_concierge",
    "매장 예약 수동 운영 테스트",
    "한 매장의 예약을 수동으로 받아 정리해 주고 운영자가 계속 쓰려는지 본다.",
    "매장 구매자 문제를 제품 없이 확인합니다.",
    "손님 앱 사용성은 별도 검증이 필요합니다."
  ),
  answerOption(
    "pickup_order_paper_test",
    "픽업 주문 종이/폼 테스트",
    "손님에게 간단한 폼으로 픽업 주문을 받고 매장 준비 과정을 관찰한다.",
    "픽업 혼선과 대기 문제를 빠르게 확인합니다.",
    "실제 결제·알림 자동화 가치는 아직 검증되지 않습니다."
  ),
  answerOption(
    "loyalty_manual_stamp_test",
    "단골 혜택 수동 스탬프 테스트",
    "방문 기록과 혜택을 수동으로 관리해 보고 손님 재방문 반응을 확인한다.",
    "단골 혜택 가치와 반복 사용 가능성을 봅니다.",
    "예약/주문 문제와는 다른 방향으로 좁혀질 수 있습니다."
  )
];

const LOCAL_COMMERCE_NON_GOAL_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "exclude_payment_integration",
    "결제 연동 제외",
    "첫 버전에서는 결제 연동을 제외하고 예약·주문 의향과 운영 흐름만 확인한다.",
    "정산·환불·보안 부담을 줄입니다.",
    "실제 구매 전환 신호는 약해질 수 있습니다."
  ),
  answerOption(
    "exclude_delivery_network",
    "배달망 연동 제외",
    "첫 버전에서는 외부 배달망 연동 없이 매장 자체 픽업/예약만 다룬다.",
    "연동 리스크를 줄이고 로컬 매장 흐름에 집중합니다.",
    "배달 중심 매장에는 가치가 낮을 수 있습니다."
  ),
  answerOption(
    "exclude_multi_location_admin",
    "다지점 관리 제외",
    "첫 버전에서는 여러 지점 통합 관리와 권한 기능을 제외한다.",
    "소규모 매장 검증에 집중할 수 있습니다.",
    "조직형 운영자의 요구는 뒤로 밀립니다."
  )
];

const FOUNDER_VALIDATION_PRIMARY_CUSTOMER_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "paid_interview_prep_founder",
    "유료 인터뷰를 준비하는 1인 창업자",
    "유료 고객 인터뷰를 준비하는 1인 창업자를 가장 먼저 만나 스펙과 근거 정리 문제를 확인한다.",
    "아이디어 검증과 돈을 낼 이유가 직접 연결됩니다.",
    "팀 단위 제품 기획 요구는 약하게 반영될 수 있습니다."
  ),
  answerOption(
    "rough_idea_founder",
    "막연한 아이디어를 정리하는 창업자",
    "막연한 아이디어를 제품 스펙으로 바꾸려는 창업자를 가장 먼저 만난다.",
    "초기 모호성 감소 가치를 가장 잘 확인합니다.",
    "이미 고객이 있는 창업자에게 필요한 리서치 깊이는 부족할 수 있습니다."
  ),
  answerOption(
    "evidence_sensitive_builder",
    "근거 추적을 중시하는 빌더",
    "기능 구현 전에 근거와 리스크를 추적하려는 빌더를 먼저 검증한다.",
    "source-traced spec 가치와 자동화 니즈를 확인합니다.",
    "비즈니스 검증보다 개발 생산성 쪽으로 좁혀질 수 있습니다."
  )
];

const FOUNDER_VALIDATION_VALUE_PROP_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "traceable_spec_output",
    "근거 추적 가능한 스펙",
    "창업자가 아이디어와 리서치 근거가 연결된 스펙을 얻을 수 있어 선택한다.",
    "Solo Superman의 핵심 산출물 가치를 검증합니다.",
    "질문 자체의 품질 문제가 약하면 스펙 신뢰도도 낮아질 수 있습니다."
  ),
  answerOption(
    "sharp_customer_questions",
    "더 날카로운 고객 질문",
    "창업자가 인터뷰 전에 고객·문제·성공 기준 질문을 더 선명하게 만들 수 있어 선택한다.",
    "질문 생성 품질을 직접 검증합니다.",
    "자동 구현이나 문서화 가치는 뒤로 밀릴 수 있습니다."
  ),
  answerOption(
    "build_risk_visible",
    "빌드 전 리스크 노출",
    "창업자가 만들기 전에 근거 부족과 다른 관점을 볼 수 있어 선택한다.",
    "성급한 구현 방지 가치를 검증합니다.",
    "즉시 실행을 원하는 사용자에게는 답답할 수 있습니다."
  )
];

const FOUNDER_VALIDATION_MVP_SCOPE_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "question_quality_slice",
    "질문 품질부터 검증",
    "첫 버전은 아이디어 맞춤 질문과 선택지 품질만 검증한다.",
    "현재 가장 큰 사용자 불만을 직접 해결합니다.",
    "리서치 자동화나 구현 연계 가치는 뒤로 밀립니다."
  ),
  answerOption(
    "research_trace_slice",
    "리서치 근거 추적부터 검증",
    "첫 버전은 질문과 리서치 근거가 스펙 판단으로 이어지는 흐름을 검증한다.",
    "source-traced spec 신뢰도를 확인합니다.",
    "질문 문장 품질 개선은 충분히 깊지 않을 수 있습니다."
  ),
  answerOption(
    "handoff_slice",
    "스펙 handoff부터 검증",
    "첫 버전은 답변 후 구현 가능한 handoff 산출물까지 이어지는 흐름을 검증한다.",
    "실제 작업 완료 가치까지 볼 수 있습니다.",
    "질문 생성 문제를 해결하기 전에 범위가 커질 수 있습니다."
  )
];

const FOUNDER_VALIDATION_EXPERIMENT_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "founder_question_review",
    "창업자 질문 리뷰 테스트",
    "실제 창업자 아이디어를 받아 질문 후보를 보여주고 맞지 않는 질문 수를 측정한다.",
    "질문 품질을 가장 직접적으로 검증합니다.",
    "리서치와 구현 연결 가치는 별도 확인이 필요합니다."
  ),
  answerOption(
    "paid_interview_prep_test",
    "유료 인터뷰 준비 테스트",
    "유료 인터뷰를 앞둔 창업자에게 질문과 스펙 초안을 제공하고 결제/재사용 의향을 본다.",
    "돈을 낼 이유와 실제 사용 압박을 동시에 확인합니다.",
    "표본 모집이 어렵고 케이스별 편차가 클 수 있습니다."
  ),
  answerOption(
    "spec_trace_walkthrough",
    "근거 추적 스펙 워크스루",
    "창업자에게 질문 답변과 리서치 근거가 연결된 스펙을 보여주고 신뢰도를 확인한다.",
    "source trace 가치와 handoff 품질을 검증합니다.",
    "초기 질문이 맞지 않으면 스펙 평가도 왜곡될 수 있습니다."
  )
];

const FOUNDER_VALIDATION_NON_GOAL_OPTIONS: readonly AmbiguityAnswerOption[] = [
  answerOption(
    "exclude_full_auto_research",
    "완전 자동 리서치 제외",
    "첫 버전에서는 완전 자동 리서치 결론 생성보다 질문 품질과 근거 연결만 다룬다.",
    "잘못된 근거 과신을 줄입니다.",
    "자동화 기대가 큰 창업자에게는 부족할 수 있습니다."
  ),
  answerOption(
    "exclude_auto_code_generation",
    "자동 구현 제외",
    "첫 버전에서는 코드 생성이나 PR 자동화를 제외하고 확인 질문과 기획 준비에 집중한다.",
    "질문/스펙 품질을 먼저 안정화합니다.",
    "구현까지 한 번에 원하는 사용자에게는 가치가 작게 보일 수 있습니다."
  ),
  answerOption(
    "exclude_team_workflows",
    "팀 협업 기능 제외",
    "첫 버전에서는 팀 권한, 리뷰, 승인 흐름을 제외하고 개인 창업자 흐름에 집중한다.",
    "첫 고객 흐름을 작게 유지합니다.",
    "팀 리더나 운영 조직 니즈는 뒤로 밀립니다."
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

const PET_LIFECYCLE_CONTEXT_PROFILE_PATTERN =
  /(?:반려\s*동물|반려견|반려묘|펫\b|pet\b|companion\s+animal|동물병원|수의|동물\s*진료|동물\s*의료|동물\s*보험|펫\s*보험|반려\s*(?:동물|견|묘).{0,20}(?:기록|의료|보험|장례|급여|일상|전생애|생애\s*주기)|사료|동물\s*장례|반려\s*(?:동물|견|묘).{0,20}말기\s*케어|동물\s*말기\s*케어|펫\s*말기\s*케어)/iu;

const PRIMARY_CUSTOMER_CONTEXT_PROFILES: readonly PrimaryCustomerContextProfile[] = [
  {
    id: "pet_lifecycle",
    pattern: PET_LIFECYCLE_CONTEXT_PROFILE_PATTERN,
    questionSubject: "보호자 유형",
    personReference: "그 보호자",
    answerOptions: PET_LIFECYCLE_PRIMARY_CUSTOMER_OPTIONS,
    topicAnswerOptions: {
      buyer_user_split: PET_LIFECYCLE_BUYER_USER_OPTIONS,
      value_prop_switching_reason: PET_LIFECYCLE_VALUE_PROP_OPTIONS,
      mvp_validation_scope: PET_LIFECYCLE_MVP_SCOPE_OPTIONS,
      first_validation_experiment: PET_LIFECYCLE_VALIDATION_EXPERIMENT_OPTIONS,
      non_goal_boundaries: PET_LIFECYCLE_NON_GOAL_OPTIONS
    }
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
    answerOptions: LOCAL_COMMERCE_PRIMARY_CUSTOMER_OPTIONS,
    topicAnswerOptions: {
      buyer_user_split: LOCAL_COMMERCE_BUYER_USER_OPTIONS,
      value_prop_switching_reason: LOCAL_COMMERCE_VALUE_PROP_OPTIONS,
      mvp_validation_scope: LOCAL_COMMERCE_MVP_SCOPE_OPTIONS,
      first_validation_experiment: LOCAL_COMMERCE_VALIDATION_EXPERIMENT_OPTIONS,
      non_goal_boundaries: LOCAL_COMMERCE_NON_GOAL_OPTIONS
    }
  },
  {
    id: "founder_validation",
    pattern:
      /(?:창업자|예비\s*창업|스타트업|1\s*인\s*창업|고객\s*인터뷰|제품\s*스펙|아이디어\s*검증|founder|startup|customer\s*interview|product\s*spec|idea\s*validation|solo\s*founder)/iu,
    questionSubject: "창업자 유형",
    personReference: "그 창업자",
    answerOptions: FOUNDER_VALIDATION_PRIMARY_CUSTOMER_OPTIONS,
    topicAnswerOptions: {
      buyer_user_split: [
        answerOption(
          "founder_decides_and_uses",
          "창업자가 직접 결정하고 쓴다",
          "창업자가 직접 비용을 내고 질문·스펙 산출물을 사용한다.",
          "첫 구매자와 사용자가 같아 검증이 단순합니다.",
          "팀이나 조직 승인 흐름은 놓칠 수 있습니다."
        ),
        answerOption(
          "advisor_or_team_influences",
          "멘토·팀이 판단에 관여한다",
          "창업자가 쓰지만 멘토, 공동창업자, 팀원이 산출물 신뢰도를 함께 판단한다.",
          "공유와 리뷰 요구를 일찍 볼 수 있습니다.",
          "개인 창업자용 첫 흐름이 복잡해질 수 있습니다."
        ),
        answerOption(
          "accelerator_or_program_buyer",
          "프로그램/조직이 구매자다",
          "액셀러레이터나 교육 프로그램이 비용을 내고 창업자가 사용한다.",
          "B2B 구매 가능성을 확인합니다.",
          "개별 창업자가 직접 돈을 낼 이유는 약하게 보일 수 있습니다."
        )
      ],
      value_prop_switching_reason: FOUNDER_VALIDATION_VALUE_PROP_OPTIONS,
      mvp_validation_scope: FOUNDER_VALIDATION_MVP_SCOPE_OPTIONS,
      first_validation_experiment: FOUNDER_VALIDATION_EXPERIMENT_OPTIONS,
      non_goal_boundaries: FOUNDER_VALIDATION_NON_GOAL_OPTIONS
    }
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
  customer_signal_selection: [
    answerOption(
      "repeat_manual_pain",
      "반복되는 수동 고통",
      "사용자가 같은 문제를 반복해서 수동으로 해결하고 있는지 확인한다.",
      "문제 강도와 사용 빈도를 빠르게 가늠할 수 있습니다.",
      "반복 빈도만으로는 돈을 낼 이유까지 증명되지 않습니다."
    ),
    answerOption(
      "budget_or_paid_intent",
      "돈이나 시간을 낼 이유",
      "해결책에 돈이나 시간을 실제로 쓸 이유가 있는지 확인한다.",
      "사업화 가능성과 우선순위 판단에 직접 연결됩니다.",
      "초기 인터뷰에서는 긍정 답변이 실제 결제로 이어지지 않을 수 있습니다."
    ),
    answerOption(
      "alternative_dissatisfaction",
      "기존 대안 불만",
      "현재 쓰는 대안이 무엇이고 어디에서 불만이 큰지 확인한다.",
      "차별화와 첫 버전 범위를 좁히는 데 도움이 됩니다.",
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
      "첫 버전과 확인 방법이 복잡해집니다."
    ),
    answerOption(
      "unknown_split",
      "아직 모른다",
      "구매자/사용자 분리는 아직 모르며 첫 인터뷰에서 확인한다.",
      "추측을 피하고 인터뷰 질문으로 전환합니다.",
      "돈을 낼 사람에 대한 판단은 아직 닫히지 않습니다."
    )
  ],
  mvp_validation_scope: [
    answerOption(
      "single_core_flow",
      "핵심 흐름 하나만 포함",
      "첫 버전은 핵심 확인 흐름 하나만 포함하고 나머지는 제외한다.",
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
      "첫 버전에서 제외할 기능을 먼저 잠그고 남은 범위만 구현한다.",
      "범위가 계속 커지는 일을 강하게 막습니다.",
      "가치제안이 너무 작아질 수 있습니다."
    )
  ],
  non_goal_boundaries: [
    answerOption(
      "exclude_automation",
      "자동화 제외",
      "첫 버전에서는 완전 자동화를 제외하고 수동 확인 가능한 흐름만 남긴다.",
      "안전하고 검증 가능한 범위를 유지합니다.",
      "자동화 가치가 핵심이면 매력이 약해질 수 있습니다."
    ),
    answerOption(
      "exclude_integrations",
      "외부 연동 제외",
      "첫 버전에서는 외부 계정/서비스 연동을 제외한다.",
      "보안·권한·운영 리스크를 줄입니다.",
      "실제 사용 흐름과 거리가 생길 수 있습니다."
    ),
    answerOption(
      "exclude_collaboration",
      "협업 기능 제외",
      "첫 버전에서는 팀 협업, 권한, 공유 기능을 제외한다.",
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

export const IDEA_FIT_ANSWER_OPTION_REQUIRED_TOPIC_KEYS = new Set([
  "primary_customer_narrowing",
  "buyer_user_split",
  "value_prop_switching_reason",
  "mvp_validation_scope",
  "first_validation_experiment",
  "non_goal_boundaries"
]);

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

  if (topicKey === "primary_customer_narrowing") {
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

  const topicAnswerOptions = topicKey ? primaryCustomerProfile?.topicAnswerOptions?.[topicKey] : undefined;

  if (topicAnswerOptions) {
    return topicAnswerOptions;
  }

  const signals = extractIdeaFitDomainSignals(contextText ? { rawIdea: contextText } : {});
  const domainDerivedOptions = domainDerivedAnswerOptionsForTopic(topicKey, expectedAnswerType, signals);

  if (domainDerivedOptions.length) {
    return domainDerivedOptions;
  }

  if (topicKey && IDEA_FIT_ANSWER_OPTION_REQUIRED_TOPIC_KEYS.has(topicKey)) {
    return [];
  }

  return ideaFitDomainAnchorTerms(signals).length ? answerOptionsForQuestion(topicKey, expectedAnswerType) : [];
}

export function answerOptionsForSeed(seed: AnswerOptionSeed) {
  if (seed.answerOptions) {
    return seed.answerOptions.map(plainUserFacingAnswerOption);
  }

  if (!seed.contextText) {
    return [];
  }

  return contextualAnswerOptionsForQuestion(seed.topicKey, seed.expectedAnswerType, seed.contextText);
}
