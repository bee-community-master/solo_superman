import { describe, expect, it } from "vitest";
import {
  generatedFounderQuestionSet,
  generatedPetLifecycleQuestionSet
} from "./generated-ambiguity-question-fixtures";

const earlyQuestionPressureTerms = /반례|계획을 바꿔|지불 의향|투자 심사|핵심 가설/u;

function questionText(question: unknown) {
  return typeof question === "object" && question !== null && "questionText" in question
    ? String((question as { readonly questionText: unknown }).questionText)
    : "";
}

describe("generated ambiguity question fixtures", () => {
  it("starts founder planning with friendly detail questions before risk pressure", () => {
    const questions = generatedFounderQuestionSet("strong").questions;

    expect(questions.slice(0, 4).map((question) => question.topicKey)).toEqual([
      "first_user_situation",
      "planning_artifact_after_answers",
      "case_response_shape",
      "public_research_scenario_options"
    ]);
    expect(questions.slice(0, 3).map(questionText).join("\n")).not.toMatch(earlyQuestionPressureTerms);
    expect(questionText(questions[0])).toContain("누구");
    expect(questions[0]).toMatchObject({
      expectedAnswerType: "choice",
      answerOptions: expect.arrayContaining([
        expect.objectContaining({ label: "처음 창업하는 1인 창업자" }),
        expect.objectContaining({ label: "직접 입력" })
      ])
    });
    expect(questionText(questions[1])).toContain("기획서");
    expect(questionText(questions[2])).toContain("무엇이 달라야");
    expect(questions[3]?.possibleRoutes).toEqual(["research_needed", "missing_con_evidence"]);
    expect(questions[3]?.suggestedResearchTask).toContain("가능한 사용자 미래");
    expect(questions[3]?.suggestedResearchTask).toContain("대응 선택지");
  });

  it("starts pet lifecycle planning with domain-specific use-case questions", () => {
    const questions = generatedPetLifecycleQuestionSet().questions;

    expect(questions.slice(0, 4).map((question) => question.topicKey)).toEqual([
      "pet_first_user_situation",
      "pet_planning_artifact_after_answers",
      "pet_case_response_shape",
      "pet_public_research_scenario_options"
    ]);
    expect(questions.slice(0, 3).map(questionText).join("\n")).not.toMatch(earlyQuestionPressureTerms);
    expect(questionText(questions[0])).toContain("반려동물 의료 기록");
    expect(questionText(questions[1])).toContain("관리 기록");
    expect(questionText(questions[2])).toContain("무엇이 달라야");
    expect(questions[3]?.suggestedResearchTask).toContain("대표 사용 케이스");
    expect(questions[3]?.suggestedResearchTask).toContain("다음 질문");
  });
});
