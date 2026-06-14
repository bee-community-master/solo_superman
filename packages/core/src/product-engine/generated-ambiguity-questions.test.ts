import { describe, expect, it } from "vitest";
import { parseGeneratedAmbiguityQuestionSet } from "./generated-ambiguity-questions";

const validPetGuardianAnswerOptions = [
  {
    id: "first_pet_guardian",
    label: "첫 반려동물을 키우는 보호자",
    value: "첫 반려동물을 키우는 보호자를 먼저 검증합니다.",
    primaryDetail: "입문 보호자의 기록 관리 흐름을 먼저 봅니다.",
    secondaryDetail: "노령·만성질환 케어는 별도 확인이 필요합니다."
  },
  {
    id: "senior_pet_guardian",
    label: "노령·만성질환 반려동물 보호자",
    value: "노령·만성질환 반려동물 보호자를 먼저 검증합니다.",
    primaryDetail: "진료, 약, 검사 이력을 먼저 봅니다.",
    secondaryDetail: "일상 케어 반복 사용은 별도 확인이 필요합니다."
  },
  {
    id: "insurance_pet_guardian",
    label: "보험·의료비 관리가 필요한 보호자",
    value: "보험·의료비 관리가 필요한 보호자를 먼저 검증합니다.",
    primaryDetail: "영수증과 청구 서류 흐름을 먼저 봅니다.",
    secondaryDetail: "보험이 없는 보호자 가치는 별도 확인이 필요합니다."
  }
] as const;

function generatedQuestionSetWithFirstOptions(answerOptions: readonly Readonly<Record<string, string>>[]) {
  return {
    schemaVersion: "solo-superman-generated-ambiguity-questions.v1",
    sourceSummary: "반려동물 전생애주기 관리 앱",
    questions: [
      {
        sectionRef: "Target Customer",
        topicKey: "pet_guardian_segment",
        uncertaintyType: "vague",
        severity: "high",
        summary: "첫 보호자 세그먼트가 넓음",
        whyItMatters: "보호자 유형에 따라 의료 기록, 보험, 일상 관리, 장례 준비 중 첫 범위가 달라집니다.",
        questionText: "반려동물 전생애주기 앱을 가장 먼저 써볼 보호자는 누구인가요?",
        expectedAnswerType: "choice",
        answerSelectionMode: "single",
        answerOptions,
        decisionItUnlocks: "첫 인터뷰 대상과 첫 화면 구성을 정합니다.",
        ambiguityDimension: "scope",
        ambiguityRoutingPath: "human_judgment",
        researchQuestion: "보호자 유형별로 어떤 기록 관리 불편이 더 자주 공개적으로 언급되는지 확인합니다.",
        possibleRoutes: ["question", "decision_candidate"],
        suggestedResearchTask: "의료 기록, 보험 청구, 일상 관리, 장례 준비 중 공개 후기가 많이 나오는 보호자 상황을 찾습니다."
      },
      {
        sectionRef: "Problem",
        topicKey: "pet_record_pain",
        uncertaintyType: "missing",
        severity: "high",
        summary: "가장 아픈 기록 관리 문제가 아직 구체적이지 않음",
        whyItMatters: "첫 기능은 가장 자주 찾거나 업데이트하는 기록에서 시작해야 합니다.",
        questionText: "지금 가장 찾기 어렵거나 최신 상태로 유지하기 힘든 반려동물 기록은 무엇인가요?",
        expectedAnswerType: "text",
        answerOptions: [],
        decisionItUnlocks: "첫 문제 문장과 리서치 방향을 정합니다.",
        ambiguityDimension: "context",
        ambiguityRoutingPath: "human_judgment",
        researchQuestion: "공개 후기에서 보호자가 반복해서 잃어버리거나 다시 요청하는 기록 종류를 확인합니다.",
        possibleRoutes: ["question", "research_needed"],
        suggestedResearchTask: "동물병원 기록, 보험 서류, 급여/사료 이력, 장례 준비 자료의 반복 불편 사례를 찾습니다."
      },
      {
        sectionRef: "Value Proposition",
        topicKey: "pet_switching_reason",
        uncertaintyType: "decision_required",
        severity: "medium",
        summary: "기존 메모나 병원 앱에서 옮길 이유가 필요함",
        whyItMatters: "보호자가 새 앱을 쓰려면 첫 사용 이유가 분명해야 합니다.",
        questionText: "보호자가 기존 메모, 사진첩, 병원 앱 대신 이 앱을 열게 만들 이유는 무엇인가요?",
        expectedAnswerType: "choice",
        answerSelectionMode: "single",
        answerOptions: [
          {
            id: "medical_timeline",
            label: "진료 타임라인",
            value: "진료 타임라인을 첫 가치로 둡니다.",
            primaryDetail: "의료 기록 흐름을 먼저 정리합니다.",
            secondaryDetail: "보험이나 일상 관리 가치는 별도 확인이 필요합니다."
          },
          {
            id: "insurance_claims",
            label: "보험 청구 서류",
            value: "보험 청구 서류 정리를 첫 가치로 둡니다.",
            primaryDetail: "의료비 관리와 서류 찾기를 먼저 해결합니다.",
            secondaryDetail: "보험이 없는 보호자 가치는 별도 확인이 필요합니다."
          },
          {
            id: "daily_care",
            label: "일상 케어 기록",
            value: "일상 케어 기록을 첫 가치로 둡니다.",
            primaryDetail: "반복 사용 빈도를 먼저 확인합니다.",
            secondaryDetail: "응급 상황이나 말기 케어 가치는 별도 확인이 필요합니다."
          }
        ],
        decisionItUnlocks: "첫 가치 제안과 온보딩 문구를 정합니다.",
        ambiguityDimension: "assumption_pressure",
        ambiguityRoutingPath: "human_judgment",
        researchQuestion: "보호자가 기존 기록 방법에서 불편을 느끼는 순간을 공개 자료로 확인합니다.",
        possibleRoutes: ["question", "decision_candidate"],
        suggestedResearchTask: "메모, 사진첩, 병원 앱, 보험 앱 사이에서 반복되는 기록 분산 불편을 찾습니다."
      }
    ]
  };
}

function validGeneratedQuestionSet() {
  return generatedQuestionSetWithFirstOptions(validPetGuardianAnswerOptions);
}

function generatedHealthcareRecordQuestionSet() {
  return {
    schemaVersion: "solo-superman-generated-ambiguity-questions.v1",
    sourceSummary: "환자 진료 기록과 복약 알림 관리 앱",
    questions: [
      {
        sectionRef: "Target Customer",
        topicKey: "healthcare_record_user_segment",
        uncertaintyType: "vague",
        severity: "high",
        summary: "첫 사용자 세그먼트가 넓음",
        whyItMatters: "환자 유형에 따라 진료 기록, 복약, 가족 공유 중 첫 범위가 달라집니다.",
        questionText: "환자 진료 기록 앱을 먼저 쓸 사용자 유형은 누구인가요?",
        expectedAnswerType: "choice",
        answerSelectionMode: "single",
        answerOptions: [
          {
            id: "chronic_condition_patient",
            label: "만성질환 환자",
            value: "만성질환 환자의 진료 기록과 복약 관리를 먼저 검증합니다.",
            primaryDetail: "반복 방문과 복약 기록 문제가 선명합니다.",
            secondaryDetail: "가벼운 건강관리 사용자는 별도 확인이 필요합니다."
          },
          {
            id: "family_caregiver",
            label: "가족 건강 보호자",
            value: "가족의 진료 기록을 대신 챙기는 보호자를 먼저 검증합니다.",
            primaryDetail: "대리 관리와 공유 문제가 드러납니다.",
            secondaryDetail: "본인이 직접 쓰는 흐름은 별도 확인이 필요합니다."
          },
          {
            id: "post_visit_record_keeper",
            label: "진료 전후 기록 사용자",
            value: "진료 전후 기록을 자주 다시 찾는 사용자를 먼저 검증합니다.",
            primaryDetail: "기록 찾기 문제를 직접 확인합니다.",
            secondaryDetail: "방문 빈도가 낮은 사용자는 약하게 보일 수 있습니다."
          }
        ],
        decisionItUnlocks: "첫 인터뷰 대상과 진료 기록 범위를 정합니다.",
        ambiguityDimension: "scope",
        ambiguityRoutingPath: "human_judgment",
        researchQuestion: "환자 유형별 진료 기록 관리 불편을 확인합니다.",
        possibleRoutes: ["question", "decision_candidate"],
        suggestedResearchTask: "환자 진료 기록 앱 공개 후기에서 불편 사례를 찾습니다."
      },
      {
        sectionRef: "Problem",
        topicKey: "healthcare_record_pain",
        uncertaintyType: "missing",
        severity: "high",
        summary: "가장 아픈 기록 관리 문제가 아직 구체적이지 않음",
        whyItMatters: "첫 기능은 환자가 반복해서 다시 찾는 기록에서 시작해야 합니다.",
        questionText: "환자가 진료 기록을 다시 찾기 어려운 순간은 언제인가요?",
        expectedAnswerType: "text",
        answerOptions: [],
        decisionItUnlocks: "첫 문제 문장과 리서치 방향을 정합니다.",
        ambiguityDimension: "context",
        ambiguityRoutingPath: "human_judgment",
        researchQuestion: "환자가 반복해서 다시 요청하는 진료 기록 종류를 확인합니다.",
        possibleRoutes: ["question", "research_needed"],
        suggestedResearchTask: "진료 기록, 검사 결과, 복약 이력의 반복 불편 사례를 찾습니다."
      },
      {
        sectionRef: "Value Proposition",
        topicKey: "healthcare_existing_tools_counterpoint",
        uncertaintyType: "missing_con_evidence",
        severity: "medium",
        summary: "기존 병원 앱이나 메모로 충분하다는 반례가 필요함",
        whyItMatters: "새 앱 전환 이유가 약하면 진료 기록 통합 가치가 과장될 수 있습니다.",
        questionText: "환자의 진료 기록과 복약 알림을 기존 메모로 충분히 관리한다는 반례는 무엇인가요?",
        expectedAnswerType: "text",
        answerOptions: [],
        decisionItUnlocks: "전환 이유와 반례 리서치 방향을 정합니다.",
        ambiguityDimension: "assumption_pressure",
        ambiguityRoutingPath: "human_judgment",
        researchQuestion: "환자의 진료 기록과 복약 알림이 기존 메모로 충분하다는 공개 반례를 확인합니다.",
        possibleRoutes: ["question", "missing_con_evidence"],
        suggestedResearchTask: "환자 커뮤니티와 진료 기록 앱 리뷰에서 기존 메모와 복약 알림으로 충분하다는 반례 자료를 찾습니다."
      }
    ]
  };
}

function generatedFounderValidationQuestionSet() {
  return {
    schemaVersion: "solo-superman-generated-ambiguity-questions.v1",
    sourceSummary: "customer interview 준비용 제품 스펙 생성기",
    questions: [
      {
        sectionRef: "Target Customer",
        topicKey: "founder_interview_segment",
        uncertaintyType: "vague",
        severity: "high",
        summary: "첫 창업자 세그먼트가 넓음",
        whyItMatters: "창업자 상황에 따라 질문 품질, 스펙, 근거 추적 중 첫 가치가 달라집니다.",
        questionText: "customer interview를 준비하는 창업자 중 먼저 검증할 유형은 누구인가요?",
        expectedAnswerType: "choice",
        answerSelectionMode: "single",
        answerOptions: [
          {
            id: "paid_interview_prep_founder",
            label: "유료 인터뷰를 준비하는 창업자",
            value: "유료 customer interview를 준비하는 창업자를 먼저 검증합니다.",
            primaryDetail: "질문 품질과 돈을 낼 이유가 직접 연결됩니다.",
            secondaryDetail: "팀 협업 요구는 별도 확인이 필요합니다."
          },
          {
            id: "rough_idea_founder",
            label: "막연한 아이디어를 정리하는 창업자",
            value: "아이디어를 제품 스펙으로 바꾸려는 창업자를 먼저 검증합니다.",
            primaryDetail: "초기 모호성 감소 가치를 확인합니다.",
            secondaryDetail: "이미 고객이 있는 창업자는 별도 확인이 필요합니다."
          },
          {
            id: "traceable_spec_builder",
            label: "근거 추적 스펙을 원하는 창업자",
            value: "근거 추적 product spec이 필요한 founder를 먼저 검증합니다.",
            primaryDetail: "traceable spec 가치를 확인합니다.",
            secondaryDetail: "비즈니스 검증보다 개발 handoff로 좁혀질 수 있습니다."
          }
        ],
        decisionItUnlocks: "첫 인터뷰 대상과 질문 품질 검증 범위를 정합니다.",
        ambiguityDimension: "scope",
        ambiguityRoutingPath: "human_judgment",
        researchQuestion: "창업자 유형별 customer interview 준비 불편을 확인합니다.",
        possibleRoutes: ["question", "decision_candidate"],
        suggestedResearchTask: "founder 커뮤니티에서 customer interview 질문 준비 불편 사례를 찾습니다."
      },
      {
        sectionRef: "Problem",
        topicKey: "founder_question_quality_pain",
        uncertaintyType: "missing",
        severity: "high",
        summary: "질문 품질 문제가 아직 구체적이지 않음",
        whyItMatters: "첫 기능은 창업자가 실제로 틀렸다고 느끼는 질문에서 시작해야 합니다.",
        questionText: "창업자가 customer interview 질문을 만들 때 가장 자주 막히는 순간은 언제인가요?",
        expectedAnswerType: "text",
        answerOptions: [],
        decisionItUnlocks: "첫 문제 문장과 질문 생성 기준을 정합니다.",
        ambiguityDimension: "context",
        ambiguityRoutingPath: "human_judgment",
        researchQuestion: "창업자 질문 작성 불편을 확인합니다.",
        possibleRoutes: ["question", "research_needed"],
        suggestedResearchTask: "founder 인터뷰 준비 자료와 커뮤니티에서 질문 품질 불편 사례를 찾습니다."
      },
      {
        sectionRef: "Value Proposition",
        topicKey: "founder_template_counterpoint",
        uncertaintyType: "missing_con_evidence",
        severity: "medium",
        summary: "기존 템플릿으로 충분하다는 반례가 필요함",
        whyItMatters: "기존 ChatGPT나 템플릿으로 충분하면 제품 전환 이유가 약해집니다.",
        questionText: "기존 ChatGPT나 템플릿으로 충분하다는 창업자 반례는 무엇인가요?",
        expectedAnswerType: "text",
        answerOptions: [],
        decisionItUnlocks: "전환 이유와 반례 리서치 방향을 정합니다.",
        ambiguityDimension: "assumption_pressure",
        ambiguityRoutingPath: "human_judgment",
        researchQuestion: "기존 템플릿으로 충분하다는 공개 반례를 확인합니다.",
        possibleRoutes: ["question", "missing_con_evidence"],
        suggestedResearchTask: "founder 커뮤니티와 제품 리뷰에서 기존 템플릿으로 충분하다는 반례 자료를 찾습니다."
      }
    ]
  };
}

describe("parseGeneratedAmbiguityQuestionSet context fit", () => {
  it("accepts pet lifecycle questions with pet guardian answer options", () => {
    const parsed = parseGeneratedAmbiguityQuestionSet(
      validGeneratedQuestionSet(),
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.questions[0]?.answerOptions?.map((option) => option.label)).toEqual([
      "첫 반려동물을 키우는 보호자",
      "노령·만성질환 반려동물 보호자",
      "보험·의료비 관리가 필요한 보호자"
    ]);
  });

  it("puts the clearest customer/scope/success bottleneck first instead of preserving model order", () => {
    const questionSet = validGeneratedQuestionSet();
    const customerQuestion = questionSet.questions[0]!;
    const problemQuestion = questionSet.questions[1]!;
    const pressureQuestion = questionSet.questions[2]!;
    const successQuestion = {
      ...customerQuestion,
      sectionRef: "Success Criteria",
      topicKey: "pet_success_metric",
      uncertaintyType: "missing",
      severity: "high",
      summary: "첫 성공 기준이 비어 있음",
      questionText: "반려동물 기록 앱이 첫 주에 성공했다고 볼 행동 지표는 무엇인가요?",
      expectedAnswerType: "text",
      answerOptions: [],
      decisionItUnlocks: "첫 주 검증 기준과 실패 시 중단 기준을 정합니다.",
      ambiguityDimension: "success_criteria",
      ambiguityRoutingPath: "human_judgment",
      possibleRoutes: ["question", "decision_candidate"]
    };
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...questionSet,
        questions: [
          pressureQuestion,
          { ...customerQuestion, severity: "medium" },
          successQuestion,
          problemQuestion
        ]
      },
      {
        contextText: "반려동물 기록 앱의 첫 고객, 첫 범위, 성공 기준을 좁히는 기획"
      }
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.questions[0]?.topicKey).toBe("pet_success_metric");
  });

  it("falls back to an open-text question when generated choices are generic planning placeholders", () => {
    const parsed = parseGeneratedAmbiguityQuestionSet(
      generatedQuestionSetWithFirstOptions([
        {
          id: "early_user",
          label: "초기 사용자",
          value: "초기 사용자를 먼저 검증합니다.",
          primaryDetail: "가장 먼저 만날 대상을 정합니다.",
          secondaryDetail: "구체적인 도메인 맥락은 아직 남아 있습니다."
        },
        {
          id: "customer_a",
          label: "고객 후보 A",
          value: "고객 후보 A를 먼저 검증합니다.",
          primaryDetail: "첫 세그먼트를 임시로 둡니다.",
          secondaryDetail: "실제 보호자 상황은 아직 남아 있습니다."
        },
        {
          id: "option_a",
          label: "옵션 A",
          value: "옵션 A를 먼저 검증합니다.",
          primaryDetail: "첫 방향을 임시로 둡니다.",
          secondaryDetail: "실제 선택 기준은 아직 남아 있습니다."
        }
      ])
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.questions[0]).toMatchObject({
      topicKey: "pet_guardian_segment",
      expectedAnswerType: "text"
    });
    expect(parsed.questions[0]?.answerOptions).toBeUndefined();
  });

  it("preserves explicit generated business critic pressure metadata", () => {
    const questionSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet({
      ...questionSet,
      questions: questionSet.questions.map((question, index) =>
        index === 2
          ? {
              ...question,
              businessCriticPressureKind: "core_assumption_challenge",
              businessCriticIntensityMinimum: "strong"
            }
          : question
      )
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.questions.find((question) => question.topicKey === "pet_switching_reason")).toMatchObject({
      businessCriticPressureKind: "core_assumption_challenge",
      businessCriticIntensityMinimum: "strong"
    });
  });

  it("rejects invalid generated business critic pressure metadata", () => {
    const questionSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet({
      ...questionSet,
      questions: questionSet.questions.map((question, index) =>
        index === 2
          ? {
              ...question,
              businessCriticPressureKind: "investor_pressure_pass",
              businessCriticIntensityMinimum: "strong"
            }
          : question
      )
    });

    expect(parsed.ok).toBe(false);
    expect(parsed.questions).toEqual([]);
    expect(parsed.issues.join("\n")).toContain("must be investor_grade for investor pressure questions");
  });

  it("rejects mismatched balanced generated business critic pressure metadata", () => {
    const questionSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet({
      ...questionSet,
      questions: questionSet.questions.map((question, index) =>
        index === 2
          ? {
              ...question,
              businessCriticPressureKind: "balanced_con",
              businessCriticIntensityMinimum: "strong"
            }
          : question
      )
    });

    expect(parsed.ok).toBe(false);
    expect(parsed.questions).toEqual([]);
    expect(parsed.issues.join("\n")).toContain("must be balanced for balanced pressure questions");
  });

  it("does not route generic healthcare record language through the pet lifecycle idea-fit gate", () => {
    const parsed = parseGeneratedAmbiguityQuestionSet(
      generatedHealthcareRecordQuestionSet(),
      {
        contextText: "환자 진료 기록과 복약 알림을 한 곳에서 관리하는 헬스케어 앱"
      }
    );

    expect(parsed.ok).toBe(true);
    expect(
      parsed.questions
        .find((question) => question.topicKey === "healthcare_record_user_segment")
        ?.answerOptions?.map((option) => option.label)
    ).toEqual([
      "만성질환 환자",
      "가족 건강 보호자",
      "진료 전후 기록 사용자"
    ]);
  });

  it("does not treat customer interview founder contexts as local-commerce customer contexts", () => {
    const parsed = parseGeneratedAmbiguityQuestionSet(
      generatedFounderValidationQuestionSet(),
      {
        contextText: "customer interview를 준비하는 창업자를 위한 제품 스펙과 근거 추적 앱"
      }
    );

    expect(parsed.ok).toBe(true);
    expect(
      parsed.questions
        .find((question) => question.topicKey === "founder_interview_segment")
        ?.answerOptions?.map((option) => option.label)
    ).toEqual([
      "유료 인터뷰를 준비하는 창업자",
      "막연한 아이디어를 정리하는 창업자",
      "근거 추적 스펙을 원하는 창업자"
    ]);
  });

  it("rejects generic builder personas for pet lifecycle ideas before they become queue questions", () => {
    const parsed = parseGeneratedAmbiguityQuestionSet(
      generatedQuestionSetWithFirstOptions([
        {
          id: "solo_founder",
          label: "1인 창업자",
          value: "1인 창업자를 먼저 검증합니다.",
          primaryDetail: "빠른 인터뷰가 가능합니다.",
          secondaryDetail: "반려동물 보호자 맥락은 남아 있습니다."
        },
        {
          id: "domain_builder",
          label: "도메인 전문 1인 빌더",
          value: "도메인 전문 1인 빌더를 먼저 검증합니다.",
          primaryDetail: "문제 맥락이 뚜렷합니다.",
          secondaryDetail: "실제 보호자 사용 맥락은 남아 있습니다."
        },
        {
          id: "team_operator",
          label: "팀리더/운영담당자",
          value: "팀리더나 운영담당자를 먼저 검증합니다.",
          primaryDetail: "운영 관점 검증이 가능합니다.",
          secondaryDetail: "가족 보호자 맥락은 남아 있습니다."
        }
      ]),
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.questions).toEqual([]);
    expect(parsed.issues.join("\n")).toContain("pet lifecycle generated questions must use pet guardian/domain choices");
  });

  it("does not allow founder/builder choices just because an unrelated operations idea names operators", () => {
    const parsed = parseGeneratedAmbiguityQuestionSet(
      generatedQuestionSetWithFirstOptions([
        {
          id: "solo_founder",
          label: "초기 창업자",
          value: "초기 창업자를 먼저 검증합니다.",
          primaryDetail: "빠른 인터뷰가 가능합니다.",
          secondaryDetail: "물류 운영자 맥락은 남아 있습니다."
        },
        {
          id: "domain_builder",
          label: "도메인 전문 1인 빌더",
          value: "도메인 전문 1인 빌더를 먼저 검증합니다.",
          primaryDetail: "문제 맥락이 뚜렷합니다.",
          secondaryDetail: "실제 교대 운영자 맥락은 남아 있습니다."
        },
        {
          id: "shift_operator",
          label: "교대 운영자",
          value: "교대 operator를 먼저 검증합니다.",
          primaryDetail: "현장 운영 관점 검증이 가능합니다.",
          secondaryDetail: "관리자 구매 맥락은 남아 있습니다."
        }
      ]),
      {
        contextText: "warehouse operations dashboard for shift operators"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.questions).toEqual([]);
    expect(parsed.issues.join("\n")).toContain(
      "generic founder/builder/team personas are only allowed when the idea names that audience"
    );
  });

  it("rejects generic founder personas for any idea that did not name that audience", () => {
    const parsed = parseGeneratedAmbiguityQuestionSet(
      generatedQuestionSetWithFirstOptions([
        {
          id: "solo_founder",
          label: "초기 창업자",
          value: "초기 창업자를 먼저 검증합니다.",
          primaryDetail: "빠른 인터뷰가 가능합니다.",
          secondaryDetail: "실제 예약 고객 맥락은 남아 있습니다."
        },
        {
          id: "domain_builder",
          label: "도메인 전문 1인 빌더",
          value: "도메인 전문 1인 빌더를 먼저 검증합니다.",
          primaryDetail: "문제 맥락이 뚜렷합니다.",
          secondaryDetail: "실제 사용 고객 맥락은 남아 있습니다."
        },
        {
          id: "team_operator",
          label: "팀 리더/운영 담당자",
          value: "팀 리더나 운영 담당자를 먼저 검증합니다.",
          primaryDetail: "운영 관점 검증이 가능합니다.",
          secondaryDetail: "최종 사용 고객 맥락은 남아 있습니다."
        }
      ]),
      {
        contextText: "창업 아이디어 검증용으로 동네 식당과 카페의 예약, 픽업 주문, 단골 혜택을 한 번에 관리하는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.questions).toEqual([]);
    expect(parsed.issues.join("\n")).toContain(
      "generated question options must be derived from the idea"
    );
  });

  it("rejects question text that is not anchored to the idea domain", () => {
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...validGeneratedQuestionSet(),
        questions: validGeneratedQuestionSet().questions.map((question, index) =>
          index === 0
            ? {
                ...question,
                questionText: "어떤 초기 사용자에게 먼저 집중하시겠습니까?"
              }
            : question
        )
      },
      {
        contextText: "동네 식당과 카페의 예약, 픽업 주문, 단골 혜택을 한 번에 관리하는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.questions).toEqual([]);
    expect(parsed.issues.join("\n")).toContain("generated question must include idea/domain anchors");
  });

  it("rejects generated questions that repeat the full idea text", () => {
    const generatedSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...generatedSet,
        questions: [
          {
            ...generatedSet.questions[0]!,
            questionText:
              "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱에서 가장 먼저 써볼 보호자는 누구인가요?"
          },
          ...generatedSet.questions.slice(1)
        ]
      },
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join("\n")).toContain("must not repeat the full idea or goal text");
  });

  it("rejects generated questions that are too long for user-facing onboarding", () => {
    const generatedSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...generatedSet,
        questions: [
          {
            ...generatedSet.questions[0]!,
            questionText:
              "반려동물 기록 앱을 실제로 처음 열어볼 가능성이 가장 높은 보호자 세그먼트는 초보 보호자, 노령·만성질환 보호자, 보험 청구가 잦은 보호자, 장례 준비를 시작한 보호자, 여러 마리를 함께 키우는 보호자 중 어디에 가장 가깝다고 보시나요?"
          },
          ...generatedSet.questions.slice(1)
        ]
      },
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join("\n")).toContain("generated question must stay under 120 characters");
  });

  it("rejects internal planning jargon in generated user-facing fields", () => {
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...generatedQuestionSetWithFirstOptions([
          {
            id: "first_pet_guardian",
            label: "첫 반려동물을 키우는 보호자",
            value: "첫 반려동물을 키우는 보호자를 먼저 검증합니다.",
            primaryDetail: "입문 보호자의 기록 관리 흐름을 먼저 봅니다.",
            secondaryDetail: "노령·만성질환 케어는 별도 확인이 필요합니다."
          },
          {
            id: "senior_pet_guardian",
            label: "노령·만성질환 반려동물 보호자",
            value: "노령·만성질환 반려동물 보호자를 먼저 검증합니다.",
            primaryDetail: "진료, 약, 검사 이력을 먼저 봅니다.",
            secondaryDetail: "일상 케어 반복 사용은 별도 확인이 필요합니다."
          },
          {
            id: "insurance_pet_guardian",
            label: "보험·의료비 관리가 필요한 보호자",
            value: "보험·의료비 관리가 필요한 보호자를 먼저 검증합니다.",
            primaryDetail: "영수증과 청구 서류 흐름을 먼저 봅니다.",
            secondaryDetail: "보험이 없는 보호자 가치는 별도 확인이 필요합니다."
          }
        ]),
        questions: [
          {
            ...generatedQuestionSetWithFirstOptions([]).questions[0]!,
            answerOptions: generatedQuestionSetWithFirstOptions([
              {
                id: "first_pet_guardian",
                label: "첫 반려동물을 키우는 보호자",
                value: "첫 반려동물을 키우는 보호자를 먼저 검증합니다.",
                primaryDetail: "입문 보호자의 기록 관리 흐름을 먼저 봅니다.",
                secondaryDetail: "노령·만성질환 케어는 별도 확인이 필요합니다."
              },
              {
                id: "senior_pet_guardian",
                label: "노령·만성질환 반려동물 보호자",
                value: "노령·만성질환 반려동물 보호자를 먼저 검증합니다.",
                primaryDetail: "진료, 약, 검사 이력을 먼저 봅니다.",
                secondaryDetail: "일상 케어 반복 사용은 별도 확인이 필요합니다."
              },
              {
                id: "insurance_pet_guardian",
                label: "보험·의료비 관리가 필요한 보호자",
                value: "보험·의료비 관리가 필요한 보호자를 먼저 검증합니다.",
                primaryDetail: "영수증과 청구 서류 흐름을 먼저 봅니다.",
                secondaryDetail: "보험이 없는 보호자 가치는 별도 확인이 필요합니다."
              }
            ]).questions[0]!.answerOptions,
            summary: "quality-gate 범위가 넓음"
          },
          ...generatedQuestionSetWithFirstOptions([]).questions.slice(1)
        ]
      },
      {
        contextText: "반려동물 전생애주기 관리 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join("\n")).toContain("user-facing generated question fields must avoid internal planning jargon");
  });


  it("rejects initial meta answer options that are not real domain choices", () => {
    const parsed = parseGeneratedAmbiguityQuestionSet(
      generatedQuestionSetWithFirstOptions([
        {
          id: "proceed",
          label: "진행",
          value: "이 방향으로 진행합니다.",
          primaryDetail: "다음 단계로 갑니다.",
          secondaryDetail: "구체 고객은 남아 있습니다."
        },
        {
          id: "hold",
          label: "보류",
          value: "지금은 보류합니다.",
          primaryDetail: "결정을 늦춥니다.",
          secondaryDetail: "다음 확인이 필요합니다."
        },
        {
          id: "more_research",
          label: "추가 리서치",
          value: "추가 리서치를 진행합니다.",
          primaryDetail: "근거를 더 봅니다.",
          secondaryDetail: "보호자 후보는 아직 정해지지 않습니다."
        }
      ]),
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join("\n")).toContain("real domain choices");
  });

  it("rejects generated questions that do not expose the ambiguity dimension and routing path", () => {
    const generatedSet = validGeneratedQuestionSet();
    const firstQuestionWithoutAlgorithmRouting: Record<string, unknown> = { ...generatedSet.questions[0]! };
    delete firstQuestionWithoutAlgorithmRouting.ambiguityDimension;
    delete firstQuestionWithoutAlgorithmRouting.ambiguityRoutingPath;

    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...generatedSet,
        questions: [
          firstQuestionWithoutAlgorithmRouting,
          ...generatedSet.questions.slice(1)
        ]
      },
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join("\n")).toContain("weakest ambiguity dimension is explicit");
    expect(parsed.issues.join("\n")).toContain("separates human judgment, existing facts, and current research");
  });

  it("rejects compound questions that combine customer, scope, and success decisions", () => {
    const generatedSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...generatedSet,
        questions: [
          {
            ...generatedSet.questions[0]!,
            questionText: "첫 고객은 누구이고 어떤 기능을 만들며 성공 기준은 무엇인가요?"
          },
          ...generatedSet.questions.slice(1)
        ]
      },
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join("\n")).toContain("must ask one execution-changing judgment");
  });

  it("requires current research questions to include a concrete evidence-seeking task", () => {
    const generatedSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...generatedSet,
        questions: [
          generatedSet.questions[0]!,
          {
            ...generatedSet.questions[1]!,
            ambiguityRoutingPath: "current_research",
            researchQuestion: "",
            suggestedResearchTask: "추가 리서치 필요",
            possibleRoutes: ["question"]
          },
          generatedSet.questions[2]!
        ]
      },
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join("\n")).toContain("must state what current evidence should be checked");
    expect(parsed.issues.join("\n")).toContain("must be a concrete source-seeking task");
    expect(parsed.issues.join("\n")).toContain("must include research_needed");
  });

  it("rejects current research tasks that do not say where to look and what could weaken the assumption", () => {
    const generatedSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...generatedSet,
        questions: [
          generatedSet.questions[0]!,
          {
            ...generatedSet.questions[1]!,
            ambiguityRoutingPath: "current_research",
            researchQuestion: "노령·만성질환 반려동물 보호자의 기록 관리 불편을 확인합니다.",
            suggestedResearchTask: "반려동물 기록 관리 니즈를 비교합니다.",
            possibleRoutes: ["question", "research_needed"]
          },
          generatedSet.questions[2]!
        ]
      },
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join("\n")).toContain("must name the source area or public evidence to inspect");
    expect(parsed.issues.join("\n")).toContain("must name what would weaken the assumption");
    expect(parsed.issues.join("\n")).toContain("must name the remaining human judgment after current research");
  });

  it("rejects current research tasks that omit the remaining human judgment", () => {
    const generatedSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...generatedSet,
        questions: [
          generatedSet.questions[0]!,
          {
            ...generatedSet.questions[1]!,
            ambiguityRoutingPath: "current_research",
            researchQuestion: "노령·만성질환 반려동물 보호자의 기록 관리 불편을 확인합니다.",
            suggestedResearchTask: "동물병원 후기, 펫보험 청구 안내, 보호자 커뮤니티 글에서 노령·만성질환 보호자의 기록 분산 사례와 반례를 찾습니다.",
            possibleRoutes: ["question", "research_needed"]
          },
          generatedSet.questions[2]!
        ]
      },
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join("\n")).toContain("must name the remaining human judgment after current research");
  });

  it("requires at least one pressure question in every generated ambiguity set", () => {
    const generatedSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...generatedSet,
        questions: generatedSet.questions.map((question) => ({
          ...question,
          uncertaintyType: question.uncertaintyType === "missing_con_evidence" ? "decision_required" : question.uncertaintyType,
          ambiguityDimension: question.ambiguityDimension === "assumption_pressure" ? "success_criteria" : question.ambiguityDimension,
          possibleRoutes: question.possibleRoutes.filter((route) => route !== "missing_con_evidence")
        }))
      },
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(false);
    expect(parsed.issues.join("\n")).toContain("must include at least one pressure question");
  });

  it("accepts current research questions when they name concrete evidence targets", () => {
    const generatedSet = validGeneratedQuestionSet();
    const parsed = parseGeneratedAmbiguityQuestionSet(
      {
        ...generatedSet,
        questions: [
          generatedSet.questions[0]!,
          {
            ...generatedSet.questions[1]!,
            ambiguityRoutingPath: "current_research",
            researchQuestion: "노령·만성질환 반려동물 보호자가 공개 후기에서 보험, 진료 기록, 약 이력 관리 불편을 반복해서 말하는지 확인합니다.",
            suggestedResearchTask: "동물병원 후기, 펫보험 청구 안내, 보호자 커뮤니티 글에서 노령·만성질환 보호자의 기록 분산 사례와 반례를 찾고, 리서치 뒤에도 어떤 보호자에 집중할지 사용자 판단이 남는다고 표시합니다.",
            possibleRoutes: ["question", "research_needed"]
          },
          generatedSet.questions[2]!
        ]
      },
      {
        contextText: "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에 모으는 앱"
      }
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.questions.find((question) => question.topicKey === "pet_record_pain")?.ambiguityRoutingPath).toBe(
      "current_research"
    );
  });
});
