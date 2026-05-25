import { describe, expect, it } from "vitest";
import type {
  AmbiguityIssueSnapshot,
  EvidenceItemId,
  EvidenceMatrixProjection,
  QueueItemId,
  ResearchResultId,
  ResearchTaskId,
  ResearchTaskProjection,
  SessionId
} from "@solo-superman/contracts";
import {
  classifyResearchFollowUpAnswerShape,
  researchFollowUpAnswerOptions,
  researchFollowUpAnswerSelectionMode,
  researchFollowUpExpectedAnswerType
} from "./research-follow-up-answer-shape";

const researchTaskId = "research_task_answer_shape" as ResearchTaskId;
const sessionId = "session_answer_shape" as SessionId;

function task(objective: string): ResearchTaskProjection {
  return {
    researchTaskId,
    sessionId,
    objective,
    routeOutcome: "research_needed",
    impact: "medium",
    status: "evidence_ready",
    createdAt: "2026-05-24T00:00:00.000Z"
  };
}

function sourceQuestion(overrides: Partial<AmbiguityIssueSnapshot> = {}): AmbiguityIssueSnapshot {
  return {
    queueItemId: "queue_answer_shape_source" as QueueItemId,
    summary: "사용자가 직접 설명해야 하는 질문",
    uncertaintyType: "missing",
    severity: "medium",
    status: "open",
    questionText: "실제 상황을 설명해주세요.",
    expectedAnswerType: "text",
    ...overrides
  };
}

function evidenceMatrix(overrides: Partial<EvidenceMatrixProjection> = {}): EvidenceMatrixProjection {
  return {
    evidenceMatrixId: "evidence_matrix_answer_shape",
    researchTaskId,
    researchResultId: "research_result_answer_shape" as ResearchResultId,
    synthesisVersion: 1,
    proEvidence: [],
    conEvidence: [],
    uncertainties: [],
    additionalQuestions: [],
    balanceStatus: "source_quality_insufficient",
    decisionBlocked: false,
    ...overrides
  };
}

describe("research follow-up answer shape", () => {
  it("leaves descriptive follow-up questions as open text instead of forcing pro/con choices", () => {
    const input = {
      question: "고객이 이 문제를 겪는 상황을 본인 말로 설명해주세요.",
      researchTask: task("사용자가 겪는 실제 문제 맥락 확인"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("open_text");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("text");
    expect(researchFollowUpAnswerSelectionMode(input)).toBeUndefined();
    expect(researchFollowUpAnswerOptions(input)).toEqual([]);
  });

  it("keeps evidence-backed descriptive prompts open text when they ask for a narrative answer", () => {
    const input = {
      question:
        "리서치 근거는 반복적인 수동 정리 피로이고 한계와 불확실성은 표본이 좁다는 점입니다.\n\n이 근거를 참고해 실제 사용자가 어떤 상황에서 이 문제를 겪는지 본인 말로 3~5문장으로 서술해주세요.",
      researchTask: task("사용자 문제 상황과 맥락 설명"),
      sourceQuestion: sourceQuestion({
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_open_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "반복적인 수동 정리 피로"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertainty_open_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "표본이 좁음"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("open_text");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("text");
    expect(researchFollowUpAnswerOptions(input)).toEqual([]);
  });

  it("keeps subjective insight prompts open text even when evidence and choice source data exist", () => {
    const input = {
      question:
        "리서치에서 찬성 근거와 한계가 함께 나왔습니다.\n\n사용자의 실제 경험, 생각, 배운 점을 바탕으로 이 아이디어가 어떤 맥락에서 도움이 되는지 주관식으로 적어주세요.",
      researchTask: task("사용자 경험과 주관적 인사이트 정리"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_subjective_open_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "반복적인 수동 정리 피로"
          }
        ],
        conEvidence: [
          {
            evidenceItemId: "evidence_con_subjective_open_answer_shape" as EvidenceItemId,
            kind: "con",
            summary: "기존 도구도 일부 해결 가능"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertainty_subjective_open_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "주관적 맥락은 아직 확인 필요"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("open_text");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("text");
    expect(researchFollowUpAnswerSelectionMode(input)).toBeUndefined();
    expect(researchFollowUpAnswerOptions(input)).toEqual([]);
  });

  it("keeps evidence-balance questions as a single evidence judgment", () => {
    const input = {
      question:
        "첫 고객 세그먼트를 조금 더 구체화하기 위해 리서치 결과를 모아보니 찬성쪽 근거는 반복적인 수동 정리 피로입니다.\n\n한계와 불확실성은 반대 근거가 부족하다는 점입니다.\n\n어느 방향으로 판단하시겠습니까?",
      researchTask: task("첫 고객 세그먼트 근거 확인"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "반복적인 수동 정리 피로"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertainty_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "반대 근거 부족"
          }
        ],
        balanceStatus: "missing_con_evidence",
        decisionBlocked: true
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("evidence_judgment");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("evidence");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: expect.stringContaining("근거") })])
    );
  });

  it("supports one-of-many customer segment choices without treating them as evidence pro/con", () => {
    const input = {
      question: "고객 성향 후보는 혼자 만드는 창업자, 도메인 전문 1인 빌더, 팀 리더입니다. 어느 성향의 고객에 집중하시겠습니까?",
      researchTask: task("초기 고객 성향 후보 선택"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("single_choice");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "혼자 만드는 창업자" }),
        expect.objectContaining({ id: "question_candidate_2", label: "도메인 전문 1인 빌더" }),
        expect.objectContaining({ id: "question_candidate_3", label: "팀 리더" })
      ])
    );
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "need_more_research",
          value: expect.stringContaining("더 넓은 자료를 모은다")
        })
      ])
    );
  });

  it("uses pet lifecycle customer choices when the source idea is about pet all-life management", () => {
    const input = {
      question: "고객 후보를 하나 선택해주세요.",
      researchTask: task("첫 고객 세그먼트 구체화"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice",
        questionText:
          "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에서 관리하는 앱의 첫 고객은 누구인가요?"
      }),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("single_choice");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "첫 반려동물을 키우는 보호자" }),
        expect.objectContaining({ label: "노령·만성질환 반려동물 보호자" }),
        expect.objectContaining({ label: "보험·의료비 관리가 필요한 보호자" })
      ])
    );
    expect(researchFollowUpAnswerOptions(input)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "도메인 전문 1인 빌더" }),
        expect.objectContaining({ label: "팀 리더/운영 담당자" })
      ])
    );
  });

  it("overrides stale generic builder candidates when pet context is available from the source question", () => {
    const input = {
      question:
        "고객 성향 후보는 1인 창업자, 도메인 전문 1인 빌더, 팀 리더/운영 담당자입니다. 어느 성향의 고객에 집중하시겠습니까?",
      researchTask: task("첫 고객 세그먼트 구체화"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice",
        questionText:
          "반려동물 의료, 급여, 일상, 보험, 장례 정보를 통합 관리하는 앱의 첫 고객 세그먼트를 좁혀주세요."
      }),
      evidenceMatrix: evidenceMatrix()
    };

    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "첫 반려동물을 키우는 보호자" }),
        expect.objectContaining({ label: "여러 마리를 함께 키우는 가구" })
      ])
    );
    expect(researchFollowUpAnswerOptions(input)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "도메인 전문 1인 빌더" })])
    );
  });

  it("overrides stale generic builder candidates when pet context is available only from research evidence", () => {
    const input = {
      question:
        "고객 후보는 혼자 만드는 초기 창업자, 도메인 전문 1인 빌더, 팀 리더/운영 담당자입니다. 어느 성향의 고객에 집중하시겠습니까?",
      researchTask: task("첫 고객 세그먼트가 너무 넓음"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice",
        questionText: "첫 고객 세그먼트를 좁혀주세요."
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_pet_only_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary:
              "반려동물 전생애주기 의료, 급여, 일상, 보험, 장례 정보를 한 곳에서 관리하려는 보호자 문제"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertainty_pet_only_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "노령·보험·장례 구간 중 어디서 먼저 시작할지는 추가 확인 필요"
          }
        ]
      })
    };

    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "첫 반려동물을 키우는 보호자" }),
        expect.objectContaining({ label: "노령·만성질환 반려동물 보호자" }),
        expect.objectContaining({ label: "보험·의료비 관리가 필요한 보호자" })
      ])
    );
    expect(researchFollowUpAnswerOptions(input)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "도메인 전문 1인 빌더" }),
        expect.objectContaining({ label: "팀 리더/운영 담당자" })
      ])
    );
  });

  it.each([
    {
      caseKey: "education",
      sourceQuestionText: "AI 학습 코치 앱의 첫 학습자/교육 사용자 유형을 좁혀주세요.",
      expectedLabels: ["시험을 준비하는 학습자", "직무 전환·업스킬 학습자", "소규모 교육 운영자"]
    },
    {
      caseKey: "local_commerce",
      sourceQuestionText: "동네 식당과 카페의 예약, 픽업 주문, 단골 혜택 앱의 첫 고객/운영자 유형을 좁혀주세요.",
      expectedLabels: ["소규모 매장 운영자", "반복 방문하는 단골 고객", "픽업·배달을 자주 쓰는 고객"]
    }
  ])(
    "overrides stale generic builder candidates when $caseKey context is available from the source question",
    ({ sourceQuestionText, expectedLabels }) => {
      const input = {
        question:
          "고객 성향 후보는 1인 창업자, 도메인 전문 1인 빌더, 팀 리더/운영 담당자입니다. 어느 성향의 고객에 집중하시겠습니까?",
        researchTask: task("첫 고객 세그먼트 구체화"),
        sourceQuestion: sourceQuestion({
          topicKey: "primary_customer_narrowing",
          expectedAnswerType: "choice",
          questionText: sourceQuestionText
        }),
        evidenceMatrix: evidenceMatrix()
      };

      const labels = researchFollowUpAnswerOptions(input).map((option) => option.label);

      expect(labels).toEqual(expect.arrayContaining(expectedLabels));
      expect(labels).not.toEqual(
        expect.arrayContaining(["1인 창업자", "도메인 전문 1인 빌더", "팀 리더/운영 담당자"])
      );
    }
  );

  it("uses natural buyer/user decision labels instead of pro/con evidence labels", () => {
    const input = {
      question:
        "구매자와 실제 사용자가 같은지 확인되지 않음을 조금 더 구체화하기 위해 리서치 결과를 모아보니 가족 보호자와 실제 기록 작성자가 다를 수 있다는 단서가 나타났습니다.\n\n어느 방향으로 판단하시겠습니까?",
      researchTask: task("구매자와 실제 사용자가 같은지 확인"),
      sourceQuestion: sourceQuestion({
        topicKey: "buyer_user_split",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_buyer_user_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "보호자가 직접 구매하고 기록도 남기는 사례가 있음"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertainty_buyer_user_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "가족 구성원 간 역할 분리는 추가 확인 필요"
          }
        ]
      })
    };

    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "구매자와 실제 사용자가 같다" }),
        expect.objectContaining({ label: "구매자와 실제 사용자가 다르다" }),
        expect.objectContaining({ label: "추가 리서치로 근거자료를 더 보강한다" }),
        expect.objectContaining({ label: "지금은 스펙을 확정하기 어렵다" })
      ])
    );
    expect(researchFollowUpAnswerOptions(input)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "찬성 근거가 더 강함" }),
        expect.objectContaining({ label: "반대 근거를 더 찾기" }),
        expect.objectContaining({ label: "검증 후 결정" })
      ])
    );
  });

  it("uses concrete follow-up candidates before older source choices", () => {
    const input = {
      question: "후보는 개인 창업자, 팀 리더입니다. 어느 후보를 선택하시겠습니까?",
      researchTask: task("초기 고객 성향 후보 선택"),
      sourceQuestion: sourceQuestion({
        expectedAnswerType: "choice",
        answerOptions: [
          {
            id: "explicit_source_choice",
            label: "기존 명시 선택지",
            value: "기존 명시 선택지를 선택한다.",
            pro: "이전 질문에서 의도적으로 지정한 선택지를 보존합니다.",
            con: "새 질문 후보와 다르면 사용자가 직접 보완해야 합니다."
          }
        ]
      }),
      evidenceMatrix: evidenceMatrix()
    };

    expect(researchFollowUpAnswerOptions(input)).toEqual([
      expect.objectContaining({ id: "question_candidate_1", label: "개인 창업자" }),
      expect.objectContaining({ id: "question_candidate_2", label: "팀 리더" }),
      expect.objectContaining({ id: "need_more_research" })
    ]);
  });

  it("falls back to source choices when the follow-up question has no concrete candidates", () => {
    const input = {
      question: "이전 질문의 선택지 중 지금 아이디어에 가장 맞는 방향을 하나 골라주세요.",
      researchTask: task("초기 고객 성향 후보 선택"),
      sourceQuestion: sourceQuestion({
        expectedAnswerType: "choice",
        answerOptions: [
          {
            id: "explicit_source_choice",
            label: "기존 명시 선택지",
            value: "기존 명시 선택지를 선택한다.",
            pro: "이전 질문에서 의도적으로 지정한 선택지를 보존합니다.",
            con: "새 질문 후보와 다르면 사용자가 직접 보완해야 합니다."
          }
        ]
      }),
      evidenceMatrix: evidenceMatrix()
    };

    expect(researchFollowUpAnswerOptions(input)).toEqual([
      expect.objectContaining({ id: "explicit_source_choice", label: "기존 명시 선택지" }),
      expect.objectContaining({ id: "need_more_research" }),
      expect.objectContaining({ id: "decide_after_validation" })
    ]);
    expect(researchFollowUpAnswerOptions(input)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "write_custom_answer" })])
    );
  });

  it("uses the concrete candidates named in a generic single-choice follow-up question", () => {
    const input = {
      question:
        "리서치 결과 후보는 저가형 개인 사용자, 전문가형 1인 팀, 교육용 팀 리더입니다. 여러 종류 중 하나만 선택해야 한다면 어느 후보에 집중하시겠습니까?",
      researchTask: task("여러 종류 중 하나만 선택해야 하는 후보 결정"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("single_choice");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "저가형 개인 사용자" }),
        expect.objectContaining({ id: "question_candidate_2", label: "전문가형 1인 팀" }),
        expect.objectContaining({ id: "question_candidate_3", label: "교육용 팀 리더" })
      ])
    );
  });

  it("turns bullet-listed customer candidates into single-choice answer options", () => {
    const input = {
      question:
        "고객 후보는 다음과 같습니다:\n- 혼자 만드는 초기 창업자: 빠른 검증이 가능합니다.\n- 도메인 전문 1인 빌더: 문제 맥락이 뚜렷합니다.\n- 팀 리더/운영 담당자: 예산과 승인권을 확인해야 합니다.\n\n어느 후보에 집중하시겠습니까?",
      researchTask: task("첫 고객 후보 중 하나 선택"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("single_choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "혼자 만드는 초기 창업자" }),
        expect.objectContaining({ id: "question_candidate_2", label: "도메인 전문 1인 빌더" }),
        expect.objectContaining({ id: "question_candidate_3", label: "팀 리더/운영 담당자" })
      ])
    );
  });

  it("keeps evidence-backed customer segment questions as one-of-many choices", () => {
    const input = {
      question:
        "고객 세그먼트가 너무 넓어 리서치 결과를 모아보니 찬성쪽 근거는 반복적인 수동 정리 피로입니다.\n\n한계와 불확실성은 조직형 고객 표본이 좁다는 점입니다.\n\n후보는 혼자 만드는 창업자, 도메인 전문 1인 빌더, 팀 리더입니다. 어느 성향의 고객에 집중하시겠습니까?",
      researchTask: task("첫 고객 세그먼트 후보 선택"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_segment_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "반복적인 수동 정리 피로"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertainty_segment_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "조직형 고객 표본이 좁음"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("single_choice");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "혼자 만드는 창업자" }),
        expect.objectContaining({ id: "question_candidate_2", label: "도메인 전문 1인 빌더" }),
        expect.objectContaining({ id: "question_candidate_3", label: "팀 리더" })
      ])
    );
  });

  it("extracts prose-described customer candidates without keeping the introductory sentence as an option", () => {
    const input = {
      question:
        "고객 세그먼트가 너무 넓어 조금 더 구체화시켜보기 위해 실제 고객들의 정보들을 모아보니 빠른 검증을 원하는 성향과 전문 맥락을 가진 성향, 팀 운영을 맡는 성향 등 다양한 성향이 나타났습니다. 그중 저희의 아이디어에 가장 알맞는 후보는 혼자 만드는 창업자와 도메인 전문 1인 빌더, 팀 리더, 운영 담당자 정도로 추려졌습니다. 어느 성향의 고객에 집중하시겠습니까?",
      researchTask: task("첫 고객 세그먼트 후보 선택"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix()
    };

    const labels = researchFollowUpAnswerOptions(input).map((option) => option.label);

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("single_choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(labels).toEqual(
      expect.arrayContaining(["혼자 만드는 창업자", "도메인 전문 1인 빌더", "팀 리더", "운영 담당자"])
    );
    expect(labels).not.toEqual(
      expect.arrayContaining([expect.stringContaining("그중 저희의 아이디어에 가장 알맞는 후보는")])
    );
  });

  it("supports explicit agree/disagree questions without forcing every answer into evidence balance", () => {
    const input = {
      question:
        "리서치 근거를 보면 개인 창업자부터 시작하는 방향에 찬성/반대 중 어느 쪽인가요?",
      researchTask: task("초기 고객 선택 방향 찬반 결정"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_binary_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "개인 창업자의 반복 업무 고통"
          }
        ],
        conEvidence: [
          {
            evidenceItemId: "evidence_con_binary_answer_shape" as EvidenceItemId,
            kind: "con",
            summary: "팀 리더의 예산 권한이 더 큼"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("binary_choice");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "agree_or_continue", label: "진행 후보로 둔다" }),
        expect.objectContaining({ id: "disagree_or_stop", label: "보류하거나 좁힌다" })
      ])
    );
  });

  it("supports multi-select follow-up questions when several options can be true together", () => {
    const input = {
      question: "이번 아이디어에 해당되는 고객 신호를 여러 개 선택해주세요.",
      researchTask: task("여러 고객 신호를 함께 확인"),
      sourceQuestion: sourceQuestion({
        topicKey: "primary_customer_narrowing",
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("multi_select");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("multiple");
    expect(researchFollowUpAnswerOptions(input).length).toBeGreaterThanOrEqual(3);
  });

  it("keeps purchase-decision signal questions as multi-select instead of yes/no stance", () => {
    const input = {
      question: "구매 여부를 판단할 고객 신호와 조건을 하나 이상 선택해주세요.",
      researchTask: task("구매 여부 판단에 필요한 고객 신호 선택"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_signal_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "예산 시점과 반복 사용 신호가 함께 나타남"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertain_signal_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "어떤 신호 조합이 충분한지는 사용자 결정 필요"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("multi_select");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("multiple");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "repeat_manual_pain" }),
        expect.objectContaining({ id: "budget_or_paid_intent" })
      ])
    );
  });

  it("uses named candidates for one-or-more follow-up questions without collapsing them into pro/con", () => {
    const input = {
      question:
        "선택지는 빠른 온보딩, 수동 검증, 가격 테스트, 기존 대안 비교입니다. 여러 종류 중 하나 혹은 여러 개를 선택할 수 있습니다.",
      researchTask: task("여러 종류 중 하나 혹은 여러 개를 선택해야 하는 후보 결정"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_named_multi_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "복수 후보가 동시에 적용될 수 있음"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertain_named_multi_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "정확한 조합은 사용자 결정 필요"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("multi_select");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("multiple");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "빠른 온보딩" }),
        expect.objectContaining({ id: "question_candidate_2", label: "수동 검증" }),
        expect.objectContaining({ id: "question_candidate_3", label: "가격 테스트" }),
        expect.objectContaining({ id: "question_candidate_4", label: "기존 대안 비교" })
      ])
    );
  });

  it("parses choices listed before one-or-more wording", () => {
    const input = {
      question: "개인 창업자, 팀 리더, 운영 담당자 중 하나 혹은 여러 개를 선택해주세요.",
      researchTask: task("여러 종류 중 하나 혹은 여러 개를 선택해야 하는 후보 결정"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("multi_select");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("multiple");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "개인 창업자" }),
        expect.objectContaining({ id: "question_candidate_2", label: "팀 리더" }),
        expect.objectContaining({ id: "question_candidate_3", label: "운영 담당자" })
      ])
    );
  });

  it("turns numbered signal lists into multi-select answer options", () => {
    const input = {
      question:
        "확인할 고객 신호 선택지는 다음과 같습니다:\n1. 반복되는 수동 고통\n2. 예산/지불 의향\n3. 기존 대안 불만\n4. 직접 만든 임시 해결책\n\n해당되는 신호를 하나 이상 선택해주세요.",
      researchTask: task("고객 신호와 조건을 하나 이상 선택"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("multi_select");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("multiple");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "반복되는 수동 고통" }),
        expect.objectContaining({ id: "question_candidate_2", label: "예산/지불 의향" }),
        expect.objectContaining({ id: "question_candidate_3", label: "기존 대안 불만" }),
        expect.objectContaining({ id: "question_candidate_4", label: "직접 만든 임시 해결책" })
      ])
    );
  });

  it("keeps priority-order questions as ranked answers instead of open text", () => {
    const input = {
      question: "검증 빠르기, 고객 문제 강도, 구현 난이도 중 먼저 확인할 순서를 정해주세요.",
      researchTask: task("후보들의 우선순위를 정해야 하는 결정"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("ranked_choice");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("rank");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("ranked");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "검증 빠르기" }),
        expect.objectContaining({ id: "question_candidate_2", label: "고객 문제 강도" }),
        expect.objectContaining({ id: "question_candidate_3", label: "구현 난이도" })
      ])
    );
    expect(researchFollowUpAnswerOptions(input)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "need_more_research" })])
    );
  });

  it("keeps several-candidate priority questions ranked instead of treating them as multi-select", () => {
    const input = {
      question: "여러 개 검증 후보의 우선순위를 정해주세요: 고객 인터뷰, 랜딩페이지 신청, 수동 테스트.",
      researchTask: task("여러 개 후보의 우선순위를 정해야 하는 결정"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("ranked_choice");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("rank");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("ranked");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "고객 인터뷰" }),
        expect.objectContaining({ id: "question_candidate_2", label: "랜딩페이지 신청" }),
        expect.objectContaining({ id: "question_candidate_3", label: "수동 테스트" })
      ])
    );
  });

  it("returns signal-specific options for multi-select signal questions", () => {
    const input = {
      question:
        "리서치 근거와 한계가 섞여 있으니 다음 인터뷰에서 확인할 고객 신호를 하나 혹은 여러 개 선택해주세요.",
      researchTask: task("고객 신호와 검증 기준 선택"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("multi_select");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("multiple");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "repeat_manual_pain" }),
        expect.objectContaining({ id: "budget_or_paid_intent" })
      ])
    );
  });

  it("uses validation-plan answer labels and bounded choices when the question asks which experiment to run", () => {
    const input = {
      question:
        "검증 방법 후보는 고객 인터뷰, 랜딩페이지 신청, 수동 concierge 테스트입니다. 어느 검증 방법을 먼저 선택하시겠습니까?",
      researchTask: task("첫 검증 방법 선택"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("single_choice");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("experiment");
    expect(researchFollowUpAnswerSelectionMode(input)).toBe("single");
    expect(researchFollowUpAnswerOptions(input)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "question_candidate_1", label: "고객 인터뷰" }),
        expect.objectContaining({ id: "question_candidate_2", label: "랜딩페이지 신청" }),
        expect.objectContaining({ id: "question_candidate_3", label: "수동 concierge 테스트" })
      ])
    );
  });

  it("keeps generated choice lists flexible between three and ten options", () => {
    const twoCandidateInput = {
      question: "후보는 개인 창업자, 팀 리더입니다. 어느 후보를 선택하시겠습니까?",
      researchTask: task("후보 선택 최소 선택지 보강"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };
    const manyCandidateInput = {
      question:
        "후보는 개인 창업자, 팀 리더, 운영 담당자, 마케터, 디자이너, 개발자, 교육자, 컨설턴트, 소상공인, 크리에이터, 연구자입니다. 어느 후보를 선택하시겠습니까?",
      researchTask: task("후보 선택 최대 선택지 제한"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix()
    };

    expect(researchFollowUpAnswerOptions(twoCandidateInput)).toHaveLength(3);
    expect(researchFollowUpAnswerOptions(twoCandidateInput)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "개인 창업자" }),
        expect.objectContaining({ label: "팀 리더" }),
        expect.objectContaining({ id: "need_more_research" })
      ])
    );
    expect(researchFollowUpAnswerOptions(twoCandidateInput)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "defer_as_known_risk" })])
    );
    expect(researchFollowUpAnswerOptions(twoCandidateInput)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "write_custom_answer" })])
    );
    expect(researchFollowUpAnswerOptions(manyCandidateInput)).toHaveLength(10);
    expect(researchFollowUpAnswerOptions(manyCandidateInput)).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "크리에이터" })])
    );
    expect(researchFollowUpAnswerOptions(manyCandidateInput)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "need_more_research" })])
    );
    expect(researchFollowUpAnswerOptions(manyCandidateInput)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "연구자" })])
    );
  });

  it("classifies subjective, agree-disagree, single-choice, and multi-select wording from plain user language", () => {
    const base = {
      researchTask: task("답변 방식 다양화 확인"),
      sourceQuestion: sourceQuestion(),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_user_language_shape" as EvidenceItemId,
            kind: "pro",
            summary: "리서치 근거가 일부 있음"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertain_user_language_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "사용자 맥락은 직접 확인 필요"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "이 내용은 주관식으로 실제 이유를 서술형 답변으로 적어주세요."
    })).toBe("open_text");
    expect(researchFollowUpAnswerOptions({
      ...base,
      question: "이 내용은 주관식으로 실제 이유를 서술형 답변으로 적어주세요."
    })).toEqual([]);

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "찬성/반대 근거를 참고하되 open question으로 실제 판단 이유를 서술형 답변으로 적어주세요."
    })).toBe("open_text");
    expect(researchFollowUpAnswerOptions({
      ...base,
      question: "찬성/반대 근거를 참고하되 open question으로 실제 판단 이유를 서술형 답변으로 적어주세요."
    })).toEqual([]);

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "어느 고객 상황에서 문제가 커지는지 open question으로 주관식 서술형 답변을 적어주세요."
    })).toBe("open_text");
    expect(researchFollowUpAnswerOptions({
      ...base,
      question: "어느 고객 상황에서 문제가 커지는지 open question으로 주관식 서술형 답변을 적어주세요."
    })).toEqual([]);

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "선택지 없이 실제 고객 제약을 자유롭게 설명해주세요."
    })).toBe("open_text");
    expect(researchFollowUpAnswerOptions({
      ...base,
      question: "선택지 없이 실제 고객 제약을 자유롭게 설명해주세요."
    })).toEqual([]);

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "이 방향은 객관식으로 찬성/반대 중 하나를 선택해야 합니다."
    })).toBe("binary_choice");

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "찬성/반대 중 하나를 선택하고 조건이 있다면 이유를 적어주세요."
    })).toBe("binary_choice");

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "이 방향을 채택할지 말지 객관식으로 찬반을 골라주세요."
    })).toBe("binary_choice");

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "객관식으로 찬성/반대를 할 수도 있고 조건은 직접 설명해주세요."
    })).toBe("binary_choice");

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "This is a multiple-choice agree/disagree question: choose agree or disagree and explain the condition."
    })).toBe("binary_choice");
    expect(researchFollowUpAnswerSelectionMode({
      ...base,
      question: "This is a multiple-choice agree/disagree question: choose agree or disagree and explain the condition."
    })).toBe("single");

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "This is a multiple-choice question, but choose one customer segment: solo founder, team lead, or consultant."
    })).toBe("single_choice");
    expect(researchFollowUpAnswerSelectionMode({
      ...base,
      question: "This is a multiple-choice question, but choose one customer segment: solo founder, team lead, or consultant."
    })).toBe("single");
    expect(researchFollowUpAnswerOptions({
      ...base,
      question: "This is a multiple-choice question, but choose one customer segment: solo founder, team lead, or consultant."
    })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "solo founder" }),
        expect.objectContaining({ label: "team lead" }),
        expect.objectContaining({ label: "consultant" })
      ])
    );

    const candidateChoiceInput = {
      ...base,
      question:
        "찬성/반대 근거는 참고용입니다. 후보는 개인 창업자, 팀 리더, 운영 담당자입니다. 고객 후보를 선택해주세요."
    };

    expect(classifyResearchFollowUpAnswerShape(candidateChoiceInput)).toBe("single_choice");
    expect(researchFollowUpAnswerSelectionMode(candidateChoiceInput)).toBe("single");
    expect(researchFollowUpAnswerOptions(candidateChoiceInput)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "개인 창업자" }),
        expect.objectContaining({ label: "팀 리더" }),
        expect.objectContaining({ label: "운영 담당자" })
      ])
    );

    expect(classifyResearchFollowUpAnswerShape({
      ...base,
      question: "여러 종류 중 하나만 선택해야 한다면 어느 고객 유형에 집중하시겠습니까?"
    })).toBe("single_choice");

    const multiSelectInput = {
      ...base,
      question: "여러 종류 중 하나 혹은 여러 개를 선택할 수 있습니다. 해당되는 항목을 복수 선택해주세요."
    };

    expect(classifyResearchFollowUpAnswerShape(multiSelectInput)).toBe("multi_select");
    expect(researchFollowUpAnswerSelectionMode(multiSelectInput)).toBe("multiple");

    const englishMultiSelectInput = {
      ...base,
      question: "Choose multiple customer signals that can apply together before the next interview."
    };

    expect(classifyResearchFollowUpAnswerShape(englishMultiSelectInput)).toBe("multi_select");
    expect(researchFollowUpAnswerSelectionMode(englishMultiSelectInput)).toBe("multiple");

    const answerFormPolicyInput = {
      ...base,
      question:
        "모든 내용이 찬성과 반대가 되는 게 아니라 객관식으로 찬성/반대를 할 수도 있고, 여러 종류 중 하나 혹은 여러 개를 선택해야 할 수도 있습니다. 답변을 다양하게 필요에 맞게 구성해야 합니다."
    };

    expect(classifyResearchFollowUpAnswerShape(answerFormPolicyInput)).toBe("open_text");
    expect(researchFollowUpExpectedAnswerType(answerFormPolicyInput)).toBe("text");
    expect(researchFollowUpAnswerSelectionMode(answerFormPolicyInput)).toBeUndefined();
    expect(researchFollowUpAnswerOptions(answerFormPolicyInput)).toEqual([]);

    const exactPolicyWordingInput = {
      ...base,
      question:
        "모든 내용이 찬성과 반대가 되는 게 아니라 open question으로 주관식이나 서술형 답변을 요구할 수도 있고 객관식으로 찬성/반대를 할 수도 있고, 여러 종류중 하나 혹은 여러개를 선택해야할 수도 있습니다. 답변을 다양하게 필요에 맞게 구성할 수 있어야 합니다."
    };

    expect(classifyResearchFollowUpAnswerShape(exactPolicyWordingInput)).toBe("open_text");
    expect(researchFollowUpExpectedAnswerType(exactPolicyWordingInput)).toBe("text");
    expect(researchFollowUpAnswerSelectionMode(exactPolicyWordingInput)).toBeUndefined();
    expect(researchFollowUpAnswerOptions(exactPolicyWordingInput)).toEqual([]);

    const subjectiveAndObjectivePolicyInput = {
      ...base,
      question:
        "어떤 질문은 주관식으로 직접 설명하고 어떤 질문은 객관식으로 고르게 하면서 답변 형식을 질문 의도에 맞게 다양하게 구성해야 합니다."
    };

    expect(classifyResearchFollowUpAnswerShape(subjectiveAndObjectivePolicyInput)).toBe("open_text");
    expect(researchFollowUpExpectedAnswerType(subjectiveAndObjectivePolicyInput)).toBe("text");
    expect(researchFollowUpAnswerSelectionMode(subjectiveAndObjectivePolicyInput)).toBeUndefined();
    expect(researchFollowUpAnswerOptions(subjectiveAndObjectivePolicyInput)).toEqual([]);
  });

  it("lets explicit narrative instructions win over mentioned choice formats", () => {
    const input = {
      question:
        "여러 종류 중 하나 혹은 여러 개를 선택할 수도 있지만, 이번 질문은 open question으로 주관식 서술형 답변을 요구합니다. 실제 고객 맥락을 설명해주세요.",
      researchTask: task("답변 방식은 질문별로 달라져야 함"),
      sourceQuestion: sourceQuestion({
        expectedAnswerType: "choice"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_open_wins_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "후보 선택지가 일부 있음"
          }
        ],
        uncertainties: [
          {
            evidenceItemId: "evidence_uncertain_open_wins_answer_shape" as EvidenceItemId,
            kind: "uncertainty",
            summary: "실제 맥락은 사용자 설명 필요"
          }
        ]
      })
    };

    expect(classifyResearchFollowUpAnswerShape(input)).toBe("open_text");
    expect(researchFollowUpExpectedAnswerType(input)).toBe("text");
    expect(researchFollowUpAnswerSelectionMode(input)).toBeUndefined();
    expect(researchFollowUpAnswerOptions(input)).toEqual([]);
  });

  it("does not let negated agree-disagree wording override the requested answer form", () => {
    const base = {
      researchTask: task("찬반이 아닌 질문별 답변 방식 선택"),
      sourceQuestion: sourceQuestion({
        expectedAnswerType: "choice",
        topicKey: "primary_customer_narrowing"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_negated_binary_answer_shape" as EvidenceItemId,
            kind: "pro",
            summary: "일부 찬성 근거가 있지만 실제 질문은 찬반형이 아님"
          }
        ]
      })
    };

    const singleChoiceInput = {
      ...base,
      question: "찬성/반대 선택이 아니라 고객 후보를 하나 선택해주세요."
    };
    const multiSelectInput = {
      ...base,
      question: "찬성/반대가 아니라 여러 고객 신호를 하나 이상 선택해주세요."
    };
    const openTextInput = {
      ...base,
      question: "찬성/반대 선택이 아니라 실제 고객 제약을 직접 설명해주세요."
    };
    const englishSingleChoiceInput = {
      ...base,
      question: "Not agree/disagree; choose one customer segment: solo founder, team lead, or consultant."
    };
    const englishMultiSelectInput = {
      ...base,
      question: "Instead of agree/disagree, select all customer signals that apply."
    };

    expect(classifyResearchFollowUpAnswerShape(singleChoiceInput)).toBe("single_choice");
    expect(researchFollowUpAnswerSelectionMode(singleChoiceInput)).toBe("single");
    expect(researchFollowUpAnswerOptions(singleChoiceInput)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "solo_founders" }),
        expect.objectContaining({ id: "domain_expert_builders" })
      ])
    );

    expect(classifyResearchFollowUpAnswerShape(multiSelectInput)).toBe("multi_select");
    expect(researchFollowUpAnswerSelectionMode(multiSelectInput)).toBe("multiple");

    expect(classifyResearchFollowUpAnswerShape(openTextInput)).toBe("open_text");
    expect(researchFollowUpAnswerSelectionMode(openTextInput)).toBeUndefined();
    expect(researchFollowUpAnswerOptions(openTextInput)).toEqual([]);

    expect(classifyResearchFollowUpAnswerShape(englishSingleChoiceInput)).toBe("single_choice");
    expect(researchFollowUpAnswerSelectionMode(englishSingleChoiceInput)).toBe("single");
    expect(researchFollowUpAnswerOptions(englishSingleChoiceInput)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "solo founder" }),
        expect.objectContaining({ label: "team lead" }),
        expect.objectContaining({ label: "consultant" })
      ])
    );

    expect(classifyResearchFollowUpAnswerShape(englishMultiSelectInput)).toBe("multi_select");
    expect(researchFollowUpAnswerSelectionMode(englishMultiSelectInput)).toBe("multiple");
  });

  it("classifies each concrete question format independently under the flexible answer policy", () => {
    const base = {
      researchTask: task("질문 의도별 답변 형식 다양화"),
      sourceQuestion: sourceQuestion({
        expectedAnswerType: "choice",
        topicKey: "primary_customer_narrowing"
      }),
      evidenceMatrix: evidenceMatrix({
        proEvidence: [
          {
            evidenceItemId: "evidence_pro_flexible_answer_policy_shapes" as EvidenceItemId,
            kind: "pro",
            summary: "질문마다 필요한 답변 방식이 다름"
          }
        ]
      })
    };

    const openTextInput = {
      ...base,
      question: "이번 질문은 open question입니다. 주관형/서술식 답변으로 실제 고객 맥락을 설명해주세요."
    };
    const binaryChoiceInput = {
      ...base,
      question: "객관식으로 찬성/반대 중 하나를 선택하고, 조건이 있다면 아래에 이유를 직접 설명해주세요."
    };
    const singleChoiceInput = {
      ...base,
      question: "고객 후보는 개인 창업자, 팀 리더, 운영 담당자입니다. 여러 종류 중 하나를 선택해주세요."
    };
    const multiSelectInput = {
      ...base,
      question:
        "고객 신호는 반복되는 수동 고통, 예산/지불 의향, 기존 대안 불만입니다. 하나 혹은 여러개를 선택해야 합니다."
    };

    expect(classifyResearchFollowUpAnswerShape(openTextInput)).toBe("open_text");
    expect(researchFollowUpExpectedAnswerType(openTextInput)).toBe("text");
    expect(researchFollowUpAnswerSelectionMode(openTextInput)).toBeUndefined();
    expect(researchFollowUpAnswerOptions(openTextInput)).toEqual([]);

    expect(classifyResearchFollowUpAnswerShape(binaryChoiceInput)).toBe("binary_choice");
    expect(researchFollowUpExpectedAnswerType(binaryChoiceInput)).toBe("choice");
    expect(researchFollowUpAnswerSelectionMode(binaryChoiceInput)).toBe("single");
    expect(researchFollowUpAnswerOptions(binaryChoiceInput)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "진행 후보로 둔다" }),
        expect.objectContaining({ label: "보류하거나 좁힌다" })
      ])
    );

    expect(classifyResearchFollowUpAnswerShape(singleChoiceInput)).toBe("single_choice");
    expect(researchFollowUpAnswerSelectionMode(singleChoiceInput)).toBe("single");
    expect(researchFollowUpAnswerOptions(singleChoiceInput)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "개인 창업자" }),
        expect.objectContaining({ label: "팀 리더" }),
        expect.objectContaining({ label: "운영 담당자" })
      ])
    );

    expect(classifyResearchFollowUpAnswerShape(multiSelectInput)).toBe("multi_select");
    expect(researchFollowUpAnswerSelectionMode(multiSelectInput)).toBe("multiple");
    expect(researchFollowUpAnswerOptions(multiSelectInput)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "반복되는 수동 고통" }),
        expect.objectContaining({ label: expect.stringContaining("예산") })
      ])
    );
  });

});
