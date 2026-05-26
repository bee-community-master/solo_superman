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

    expect(parsed.ok).toBe(true);
    expect(parsed.questions[1]?.ambiguityRoutingPath).toBe("current_research");
  });
});
