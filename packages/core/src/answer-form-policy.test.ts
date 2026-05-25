import { describe, expect, it } from "vitest";
import { countMentionedAnswerFormFamilies, describesAnswerFormPolicy } from "./answer-form-policy";

describe("answer form policy wording", () => {
  it("recognizes mixed open, binary, single-choice, and multi-select wording as a format policy", () => {
    const policyWording =
      "모든 내용이 찬성과 반대가 되는 게 아니라 open question으로 주관식이나 서술형 답변을 요구할 수도 있고 객관식으로 찬성/반대를 할 수도 있고, 여러 종류중 하나 혹은 여러개를 선택해야할 수도 있어. 답변을 다양하게 필요에 맞게 구성할 수 있어야 해";

    expect(countMentionedAnswerFormFamilies(policyWording)).toBeGreaterThanOrEqual(4);
    expect(describesAnswerFormPolicy(policyWording)).toBe(true);
  });

  it("recognizes everyday Korean variants for flexible answer forms", () => {
    const policyWording =
      "질문마다 답변 방식이 달라야 합니다. 어떤 질문은 자유 문항으로 서술식 답변을 받고, 어떤 질문은 선다형으로 여러 가지 중 하나를 고르거나 복수 답변을 받을 수 있어야 합니다.";

    expect(countMentionedAnswerFormFamilies(policyWording)).toBeGreaterThanOrEqual(3);
    expect(describesAnswerFormPolicy(policyWording)).toBe(true);
  });

  it("recognizes objective-choice wording even without single-choice jargon", () => {
    const policyWording =
      "어떤 질문은 주관식으로 직접 설명하고 어떤 질문은 객관식으로 고르게 하면서, 답변 형식을 질문 의도에 맞게 다양하게 구성해야 합니다.";

    expect(countMentionedAnswerFormFamilies(policyWording)).toBeGreaterThanOrEqual(2);
    expect(describesAnswerFormPolicy(policyWording)).toBe(true);
  });

  it("does not mistake one concrete binary question for the whole policy", () => {
    const binaryQuestion = "이 방향을 지금 스펙에 반영하는 데 찬성/반대 중 하나를 선택해주세요.";

    expect(describesAnswerFormPolicy(binaryQuestion)).toBe(false);
  });

  it("does not double-count objective wording on one concrete binary choice", () => {
    const concreteBinaryQuestion = "이 질문의 답변 형식은 객관식 찬성/반대 중 하나를 선택하는 방식입니다.";

    expect(countMentionedAnswerFormFamilies(concreteBinaryQuestion)).toBe(1);
    expect(describesAnswerFormPolicy(concreteBinaryQuestion)).toBe(false);
  });
});
