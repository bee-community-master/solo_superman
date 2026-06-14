import type { BusinessCriticIntensity, BusinessCriticPressureKind } from "@solo-superman/contracts";
import { GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION } from "@solo-superman/core";

function option(id: string, label: string) {
  return {
    id,
    label,
    value: `${label}을 우선한다.`,
    primaryDetail: `${label} 기준으로 첫 판단을 좁힙니다.`,
    secondaryDetail: "다른 후보는 다음 질문에서 확인합니다."
  };
}

function question(input: {
  readonly sectionRef: string;
  readonly topicKey: string;
  readonly uncertaintyType?: string;
  readonly severity?: string;
  readonly summary: string;
  readonly whyItMatters?: string;
  readonly questionText: string;
  readonly expectedAnswerType?: "choice" | "text" | "rank" | "evidence" | "experiment";
  readonly ambiguityDimension?: string;
  readonly ambiguityRoutingPath?: "human_judgment" | "existing_fact_check" | "current_research";
  readonly businessCriticIntensityMinimum?: BusinessCriticIntensity;
  readonly businessCriticPressureKind?: BusinessCriticPressureKind;
  readonly possibleRoutes?: readonly string[];
  readonly answerOptions?: readonly ReturnType<typeof option>[];
  readonly researchQuestion?: string;
  readonly suggestedResearchTask?: string;
}) {
  const expectedAnswerType = input.expectedAnswerType ?? "text";
  const ambiguityRoutingPath = input.ambiguityRoutingPath ?? "human_judgment";
  const possibleRoutes = input.possibleRoutes ?? (
    ambiguityRoutingPath === "current_research" ? ["question", "research_needed"] : ["question", "decision_candidate"]
  );

  return {
    sectionRef: input.sectionRef,
    topicKey: input.topicKey,
    uncertaintyType: input.uncertaintyType ?? "missing",
    severity: input.severity ?? "high",
    summary: input.summary,
    whyItMatters: input.whyItMatters ?? `${input.summary}이면 첫 제품 판단이 흔들립니다.`,
    questionText: input.questionText,
    expectedAnswerType,
    ...(expectedAnswerType === "choice" ? { answerSelectionMode: "single" } : {}),
    ...(expectedAnswerType === "rank" ? { answerSelectionMode: "ranked" } : {}),
    ...(expectedAnswerType !== "text"
      ? {
          answerOptions: input.answerOptions ?? [
            option(`${input.topicKey}_a`, "창업자 고객 인터뷰"),
            option(`${input.topicKey}_b`, "창업자 제품 범위"),
            option(`${input.topicKey}_c`, "창업자 검증 근거")
          ]
        }
      : { answerOptions: [] }),
    decisionItUnlocks: `${input.summary} 결정을 엽니다.`,
    ambiguityDimension: input.ambiguityDimension ?? "scope",
    ambiguityRoutingPath,
    ...(input.businessCriticIntensityMinimum ? { businessCriticIntensityMinimum: input.businessCriticIntensityMinimum } : {}),
    ...(input.businessCriticPressureKind ? { businessCriticPressureKind: input.businessCriticPressureKind } : {}),
    ...(ambiguityRoutingPath === "current_research"
      ? {
          researchQuestion: input.researchQuestion ?? `${input.summary}에 대한 공개 사례와 반례는 무엇인가?`,
          suggestedResearchTask: input.suggestedResearchTask ??
            `${input.summary} 관련 공개 사례, 커뮤니티 글, 후기에서 근거를 찾고 반례와 남은 판단을 분리합니다.`
        }
      : {
          ...(input.researchQuestion ? { researchQuestion: input.researchQuestion } : {}),
          ...(input.suggestedResearchTask ? { suggestedResearchTask: input.suggestedResearchTask } : {})
        }),
    possibleRoutes
  };
}

export function generatedFounderQuestionSet(intensity: BusinessCriticIntensity = "balanced") {
  const baseQuestions = [
    question({
      sectionRef: "Target Customer",
      topicKey: "first_user_situation",
      summary: "첫 founder 사용자 상황 구체화 필요",
      questionText: "이 도구를 처음 쓰는 founder는 누구이고, 언제 어떤 막힘을 겪나요?",
      ambiguityDimension: "scope"
    }),
    question({
      sectionRef: "MVP Scope",
      topicKey: "planning_artifact_after_answers",
      summary: "답변 뒤 생길 기획서 조각 미정",
      questionText: "founder가 질문에 답하고 나면 어떤 기획서 조각이 생겨야 하나요?",
      ambiguityDimension: "scope"
    }),
    question({
      sectionRef: "JTBD / Use Case",
      topicKey: "case_response_shape",
      summary: "founder 유형별 대응 방식 미정",
      questionText: "초보 founder, 문서가 있는 founder, 팀이 있는 founder는 무엇이 달라야 하나요?",
      ambiguityDimension: "scope"
    }),
    question({
      sectionRef: "Current Alternatives",
      topicKey: "public_research_scenario_options",
      uncertaintyType: "missing_con_evidence",
      summary: "공개 리서치로 볼 사용 케이스 미정",
      questionText: "공개 자료를 보면 어떤 founder 사용 케이스와 기존 대안이 먼저 보이나요?",
      ambiguityDimension: "assumption_pressure",
      ambiguityRoutingPath: "current_research",
      researchQuestion: "founder 기획 상세화 도구와 관련된 공개 사례에서 가능한 사용자 미래, 대표 사용 케이스, 기존 대안, 막힐 상황은 무엇인가?",
      suggestedResearchTask:
        "founder 커뮤니티, 제품 스펙 사례, 고객 인터뷰 글에서 가능한 사용자 미래, 대표 사용 케이스, 기존 대안, 막힐 상황, 대응 선택지, 한계와 다른 관점, 다음 질문을 정리하고 리서치로 정할 수 없는 남은 사용자 판단을 분리합니다."
    }),
    question({
      sectionRef: "Target Customer",
      topicKey: "primary_customer_narrowing",
      uncertaintyType: "vague",
      summary: "첫 founder 고객군이 넓음",
      questionText: "founder 제품 스펙을 가장 먼저 검증할 고객군은 누구인가요?",
      expectedAnswerType: "choice",
      answerOptions: [
        option("paid_interview_founder", "유료 인터뷰를 준비하는 1인 창업자"),
        option("spec_drafting_founder", "제품 스펙 초안을 만드는 창업자"),
        option("evidence_tracking_founder", "근거 추적이 필요한 창업자")
      ]
    }),
    question({
      sectionRef: "MVP Scope",
      topicKey: "mvp_validation_scope",
      summary: "첫 founder 제품 범위 미정",
      questionText: "founder 제품 스펙 첫 버전에서 반드시 검증할 기능은 무엇인가요?",
      expectedAnswerType: "choice",
      possibleRoutes: ["question", "decision_candidate", "deferred"]
    }),
    question({
      sectionRef: "Current Alternatives",
      topicKey: "alternative_dissatisfaction_gap",
      uncertaintyType: "missing_con_evidence",
      summary: "founder 대체재 불만족 근거 부족",
      questionText: "founder는 현재 어떤 방식으로 제품 스펙을 만들고 어디서 충분하지 않다고 느끼나요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      possibleRoutes: ["research_needed", "missing_con_evidence"]
    }),
    question({
      sectionRef: "Target Customer",
      topicKey: "buyer_user_split",
      summary: "founder 구매자와 사용자 분리 미확인",
      questionText: "founder 제품을 실제로 쓰는 사람과 비용을 승인하는 사람은 같은가요?",
      expectedAnswerType: "choice"
    }),
    question({
      sectionRef: "Value Proposition",
      topicKey: "payment_hesitation_reason",
      uncertaintyType: "missing_con_evidence",
      summary: "founder 지불 망설임 이유 미확인",
      questionText: "founder가 이 제품에 돈을 내기 망설일 가장 큰 이유는 무엇인가요?",
      expectedAnswerType: "experiment",
      ambiguityDimension: "assumption_pressure",
      possibleRoutes: ["question", "missing_con_evidence", "deferred"]
    }),
    question({
      sectionRef: "Validation Plan",
      topicKey: "first_validation_experiment",
      summary: "founder 첫 검증 행동 미정",
      questionText: "이번 주 어떤 founder에게 결과를 보여주고 반응을 확인할까요?",
      expectedAnswerType: "experiment",
      ambiguityRoutingPath: "current_research"
    }),
    question({
      sectionRef: "Success Criteria",
      topicKey: "success_metric_measurability",
      uncertaintyType: "vague",
      summary: "founder 반복 사용 신호 미정",
      questionText: "founder가 제품을 다시 쓴다고 볼 수 있는 행동 신호는 무엇인가요?"
    }),
    question({
      sectionRef: "Value Proposition",
      topicKey: "value_prop_switching_reason",
      uncertaintyType: "decision_required",
      summary: "founder 대체재 전환 이유 미정",
      questionText: "founder가 기존 노트와 문서 대신 이 제품으로 옮겨올 이유는 무엇인가요?",
      expectedAnswerType: "rank",
      ambiguityDimension: "assumption_pressure"
    }),
    question({
      sectionRef: "Evidence Status",
      topicKey: "evidence_balance",
      uncertaintyType: "unsupported",
      severity: "medium",
      summary: "founder 핵심 주장 근거 균형 부족",
      questionText: "founder 핵심 주장을 뒷받침하는 단서와 다른 관점 중 무엇이 비어 있나요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      possibleRoutes: ["research_needed", "missing_con_evidence"]
    }),
    question({
      sectionRef: "Non-goals",
      topicKey: "non_goal_boundaries",
      uncertaintyType: "decision_required",
      severity: "medium",
      summary: "founder 첫 버전 제외 범위 미정",
      questionText: "founder 첫 버전에서 의도적으로 만들지 않을 범위는 무엇인가요?",
      expectedAnswerType: "choice",
      possibleRoutes: ["question", "deferred", "decision_candidate"]
    }),
    question({
      sectionRef: "Validation Plan",
      topicKey: "acquisition_channel_realism",
      uncertaintyType: "unsupported",
      severity: "medium",
      summary: "founder 모집 채널 근거 부족",
      questionText: "founder를 어디서 현실적으로 모집할 수 있나요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      possibleRoutes: ["research_needed", "spec_update_candidate"]
    }),
    question({
      sectionRef: "MVP Scope",
      topicKey: "implementation_resource_fit",
      uncertaintyType: "unsupported",
      severity: "medium",
      summary: "founder 제품 구현 범위 적합성 미확인",
      questionText: "현재 리소스로 founder 제품 첫 기능을 구현할 수 있나요?"
    }),
    question({
      sectionRef: "Differentiation",
      topicKey: "founder_advantage",
      uncertaintyType: "unsupported",
      severity: "medium",
      summary: "founder 대상 차별화 근거 부족",
      questionText: "이 제품이 founder 제품 스펙 문제를 더 잘 풀 수 있는 근거는 무엇인가요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      possibleRoutes: ["research_needed", "spec_update_candidate"]
    }),
    question({
      sectionRef: "Known Risks / Open Questions",
      topicKey: "operational_risk_boundary",
      severity: "low",
      summary: "founder 운영 리스크 경계 미정",
      questionText: "founder 제품에 남겨야 할 보안, 법률, 운영 리스크는 무엇인가요?",
      possibleRoutes: ["question", "deferred", "repeat_limit_reached"]
    }),
    question({
      sectionRef: "JTBD / Use Case",
      topicKey: "job_context_specificity",
      uncertaintyType: "vague",
      severity: "medium",
      summary: "founder 사용 맥락 부족",
      questionText: "founder는 어떤 상황에서 제품 스펙 도구를 써야 하나요?"
    })
  ];
  const strongQuestions = [
    question({
      sectionRef: "Value Proposition",
      topicKey: "strong_paid_intent_core_assumption",
      uncertaintyType: "missing_con_evidence",
      summary: "founder 유료 전환 판단 미확인",
      questionText: "founder가 제품에 돈을 내지 않을 가장 위험한 이유는 무엇인가요?",
      expectedAnswerType: "experiment",
      ambiguityDimension: "assumption_pressure",
      businessCriticIntensityMinimum: "strong",
      businessCriticPressureKind: "core_assumption_challenge",
      possibleRoutes: ["question", "missing_con_evidence", "deferred", "repeat_limit_reached"]
    })
  ];
  const investorQuestions = [
    question({
      sectionRef: "Value Proposition",
      topicKey: "investor_pricing_pressure",
      uncertaintyType: "missing_con_evidence",
      summary: "founder 가격 압박 근거 부족",
      questionText: "어떤 가격을 보여주면 founder가 망설일까요?",
      expectedAnswerType: "experiment",
      ambiguityDimension: "assumption_pressure",
      businessCriticIntensityMinimum: "investor_grade",
      businessCriticPressureKind: "investor_pressure_pass",
      possibleRoutes: ["question", "missing_con_evidence", "deferred", "repeat_limit_reached"]
    }),
    question({
      sectionRef: "Known Risks / Open Questions",
      topicKey: "investor_market_timing_pressure",
      uncertaintyType: "unsupported",
      summary: "founder 시장 타이밍 압박 근거 부족",
      questionText: "왜 지금 founder 제품 스펙 문제가 더 급해졌나요?",
      expectedAnswerType: "evidence",
      ambiguityRoutingPath: "current_research",
      businessCriticIntensityMinimum: "investor_grade",
      businessCriticPressureKind: "investor_pressure_pass",
      possibleRoutes: ["question", "research_needed", "deferred", "repeat_limit_reached"]
    })
  ];

  return {
    schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
    sourceSummary: "Founder validation fixture",
    questions: [
      ...baseQuestions,
      ...(intensity === "strong" || intensity === "investor_grade" ? strongQuestions : []),
      ...(intensity === "investor_grade" ? investorQuestions : [])
    ]
  };
}

export function generatedPetLifecycleQuestionSet() {
  return {
    schemaVersion: GENERATED_AMBIGUITY_QUESTION_SET_SCHEMA_VERSION,
    sourceSummary: "Pet lifecycle fixture",
    questions: [
      question({
        sectionRef: "Target Customer",
        topicKey: "pet_first_user_situation",
        summary: "첫 반려동물 보호자 상황 구체화 필요",
        questionText: "이 반려동물 의료 기록 앱을 처음 쓰는 보호자는 누구이고, 언제 막히나요?",
        ambiguityDimension: "scope"
      }),
      question({
        sectionRef: "MVP Scope",
        topicKey: "pet_planning_artifact_after_answers",
        summary: "답변 뒤 생길 반려동물 관리 결과물 미정",
        questionText: "보호자가 질문에 답하고 나면 어떤 관리 기록이나 계획이 생겨야 하나요?",
        ambiguityDimension: "scope"
      }),
      question({
        sectionRef: "JTBD / Use Case",
        topicKey: "pet_case_response_shape",
        summary: "반려동물 보호자 유형별 대응 방식 미정",
        questionText: "초보 보호자, 노령 반려동물 보호자, 여러 마리 보호자는 무엇이 달라야 하나요?",
        ambiguityDimension: "scope"
      }),
      question({
        sectionRef: "Current Alternatives",
        topicKey: "pet_public_research_scenario_options",
        uncertaintyType: "missing_con_evidence",
        summary: "공개 리서치로 볼 반려동물 사용 케이스 미정",
        questionText: "공개 자료를 보면 어떤 반려동물 사용 케이스와 기존 대안이 먼저 보이나요?",
        ambiguityDimension: "assumption_pressure",
        ambiguityRoutingPath: "current_research",
        researchQuestion:
          "반려동물 의료·보험·돌봄 기록과 관련된 공개 사례에서 가능한 사용자 미래, 대표 사용 케이스, 기존 대안, 막힐 상황은 무엇인가?",
        suggestedResearchTask:
          "동물병원, 펫보험, 보호자 커뮤니티, 장례·말기 케어 자료에서 가능한 사용자 미래, 대표 사용 케이스, 기존 대안, 막힐 상황, 대응 선택지, 한계와 다른 관점, 다음 질문을 정리하고 리서치로 정할 수 없는 남은 사용자 판단을 분리합니다."
      }),
      question({
        sectionRef: "Problem",
        topicKey: "problem_pain_intensity",
        summary: "반려동물 보호자 의료 기록 문제 강도 미확인",
        questionText: "반려동물 보호자가 의료 기록, 급여, 보험 서류를 찾느라 가장 자주 겪는 불편은 무엇인가요?",
        ambiguityDimension: "success_criteria",
        ambiguityRoutingPath: "current_research",
        researchQuestion:
          "동물병원, 펫보험, 보호자 커뮤니티, 장례·말기 케어에서 기록 문제가 드물거나 기존 방식으로 충분히 해결되는 반례와 문제 빈도와 강도가 아직 측정되지 않음의 단서는 무엇인가?",
        suggestedResearchTask:
          "동물병원, 펫보험, 보호자 커뮤니티, 장례·말기 케어 자료에서 pet guardian 기록 문제 근거를 찾고 반례와 남은 판단을 분리합니다."
      }),
      question({
        sectionRef: "Target Customer",
        topicKey: "primary_customer_narrowing",
        uncertaintyType: "vague",
        summary: "첫 pet guardian 유형이 넓음",
        questionText: "pet lifecycle 앱을 가장 먼저 테스트할 pet guardian 유형은 누구인가요?",
        expectedAnswerType: "choice",
        answerOptions: [
          option("first_pet_guardian", "첫 반려동물을 키우는 pet guardian"),
          option("senior_chronic_pet_guardian", "노령·만성질환 pet guardian"),
          option("multi_pet_household", "여러 마리를 함께 키우는 pet guardian")
        ]
      }),
      question({
        sectionRef: "Value Proposition",
        topicKey: "payment_hesitation_reason",
        uncertaintyType: "missing_con_evidence",
        summary: "pet guardian 지불 망설임 이유 미확인",
        questionText: "pet guardian이 의료·보험·장례 기록 앱에 돈을 내기 망설일 이유는 무엇인가요?",
        expectedAnswerType: "experiment",
        ambiguityDimension: "assumption_pressure",
        possibleRoutes: ["question", "missing_con_evidence", "deferred"],
        answerOptions: [
          option("pet_guardian_price_test", "pet guardian 가격 테스트"),
          option("pet_guardian_privacy_test", "pet guardian 개인정보 우려 테스트"),
          option("pet_guardian_existing_app_test", "pet guardian 기존 앱 비교 테스트")
        ]
      }),
      question({
        sectionRef: "Current Alternatives",
        topicKey: "alternative_dissatisfaction_gap",
        uncertaintyType: "missing_con_evidence",
        summary: "pet guardian 대체재 불만족 근거 부족",
        questionText: "pet guardian은 메모, 사진첩, 병원 앱 중 어디서 충분하지 않다고 느끼나요?",
        expectedAnswerType: "evidence",
        ambiguityRoutingPath: "current_research",
        researchQuestion:
          "동물병원, 펫보험, 보호자 커뮤니티, 장례·말기 케어에서 대체재 만족/불만족 근거와 기존 대체재가 충분히 좋아서 전환하지 않는 반례는 무엇인가?",
        suggestedResearchTask:
          "동물병원, 펫보험, 보호자 커뮤니티, 장례·말기 케어 자료에서 대체재 만족/불만족 근거를 찾고 기존 대체재가 충분히 좋아서 전환하지 않는 반례와 남은 판단을 분리합니다.",
        possibleRoutes: ["question", "research_needed", "missing_con_evidence"],
        answerOptions: [
          option("pet_guardian_notes", "pet guardian 메모 앱"),
          option("pet_guardian_photo_album", "pet guardian 사진첩"),
          option("pet_guardian_clinic_app", "pet guardian 병원 앱")
        ]
      }),
      question({
        sectionRef: "Validation Plan",
        topicKey: "first_validation_experiment",
        summary: "pet guardian 첫 검증 행동 미정",
        questionText: "이번 주 어떤 pet guardian에게 의료 기록 화면을 보여주고 반응을 확인할까요?",
        expectedAnswerType: "experiment",
        ambiguityRoutingPath: "current_research",
        answerOptions: [
          option("senior_pet_guardian_interview", "노령 pet guardian 인터뷰"),
          option("insurance_pet_guardian_test", "보험 청구 pet guardian 테스트"),
          option("multi_pet_guardian_review", "여러 마리 pet guardian 화면 리뷰")
        ]
      }),
      question({
        sectionRef: "Success Criteria",
        topicKey: "success_metric_measurability",
        uncertaintyType: "vague",
        summary: "pet guardian 반복 사용 신호 미정",
        questionText: "pet guardian이 다시 쓴다고 볼 수 있는 의료·보험 기록 행동 신호는 무엇인가요?"
      }),
      question({
        sectionRef: "Target Customer",
        topicKey: "buyer_user_split",
        summary: "반려동물 보호자 구매자 사용자 분리 미확인",
        questionText: "반려동물 의료·보험 기록 앱을 쓰는 보호자와 비용을 내는 사람은 같은가요?",
        expectedAnswerType: "choice",
        answerOptions: [
          option("same_pet_guardian", "반려동물 보호자가 직접 결제"),
          option("family_pet_caregiver", "가족 보호자가 함께 결제"),
          option("clinic_pet_program", "동물병원 프로그램이 추천")
        ]
      }),
      question({
        sectionRef: "MVP Scope",
        topicKey: "mvp_validation_scope",
        summary: "반려동물 첫 의료 기록 범위 미정",
        questionText: "첫 버전에서 반려동물 의료 기록, 급여 기록, 보험 서류 중 무엇을 반드시 검증하나요?",
        expectedAnswerType: "choice",
        answerOptions: [
          option("pet_medical_records", "반려동물 의료 기록"),
          option("pet_feeding_care", "반려동물 급여·돌봄 기록"),
          option("pet_insurance_docs", "반려동물 보험 서류")
        ],
        possibleRoutes: ["question", "decision_candidate", "deferred"]
      }),
      question({
        sectionRef: "Non-goals",
        topicKey: "non_goal_boundaries",
        uncertaintyType: "decision_required",
        severity: "medium",
        summary: "반려동물 장례·말기 케어 제외 범위 미정",
        questionText: "첫 버전에서 반려동물 장례, 말기 케어, 보험 청구 중 의도적으로 제외할 범위는 무엇인가요?",
        expectedAnswerType: "choice",
        answerOptions: [
          option("exclude_pet_funeral", "반려동물 장례 준비 제외"),
          option("exclude_end_of_life", "반려동물 말기 케어 제외"),
          option("exclude_insurance_claims", "반려동물 보험 청구 제외")
        ],
        possibleRoutes: ["question", "deferred", "decision_candidate"]
      }),
      question({
        sectionRef: "Validation Plan",
        topicKey: "acquisition_channel_realism",
        uncertaintyType: "unsupported",
        severity: "medium",
        summary: "반려동물 보호자 모집 채널 근거 부족",
        questionText: "노령·만성질환 반려동물 보호자를 어디서 현실적으로 모집할 수 있나요?",
        expectedAnswerType: "evidence",
        ambiguityRoutingPath: "current_research",
        answerOptions: [
          option("senior_pet_community", "노령 반려동물 보호자 커뮤니티"),
          option("pet_clinic_channel", "동물병원 보호자 채널"),
          option("pet_insurance_channel", "펫보험 보호자 채널")
        ],
        possibleRoutes: ["research_needed", "spec_update_candidate"]
      })
    ]
  };
}
