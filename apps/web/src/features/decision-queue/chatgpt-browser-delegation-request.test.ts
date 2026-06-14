import { describe, expect, it } from "vitest";
import type { LivingSpecProjection, ResearchEvidenceProjection } from "@solo-superman/contracts";
import {
  buildVisibleChatGptResearchDelegationRequest,
  visibleChatGptResearchHandoffForTask
} from "./chatgpt-browser-delegation-request";

type ResearchTaskProjection = ResearchEvidenceProjection["tasks"][number];

describe("visibleChatGptResearchHandoffForTask", () => {
  it("includes the idea, current planning context, decision, output shape, and source requirements", () => {
    const task = {
      researchTaskId: "research_task_solo_superman" as ResearchTaskProjection["researchTaskId"],
      sessionId: "sess_solo_superman" as ResearchTaskProjection["sessionId"],
      objective: "초기 창업자 기획 상세화 도구의 사용자 미래와 기존 대안을 좁힌다.",
      routeOutcome: "research_needed",
      impact: "high",
      status: "planned",
      createdAt: "2026-06-14T00:00:00.000Z"
    } satisfies ResearchTaskProjection;
    const spec = {
      title: "초기 창업자가 막연한 서비스 아이디어를 실행 가능한 기획서로 구체화하도록 돕는 도구",
      sections: [
        "사용자는 아이디어를 한두 문장으로 적고 쉬운 질문에 답한다.",
        "답변 뒤에는 타깃 사용자, 사용 케이스, 첫 결과물, 다음 검증 질문이 생겨야 한다."
      ]
    } satisfies Pick<LivingSpecProjection, "title" | "sections">;

    const handoff = visibleChatGptResearchHandoffForTask({
      language: "ko",
      planningContext: "최근 사용자 답변: 막연한 아이디어는 있지만 실행 가능한 기획서로 정리하지 못하는 초기 창업자가 먼저 씁니다.",
      spec,
      task
    });

    expect(handoff.openUrl).toBe("https://chatgpt.com/");
    expect(handoff.prompt).toContain("원문 아이디어: 초기 창업자가 막연한 서비스 아이디어");
    expect(handoff.prompt).toContain("현재까지의 사용자 답변/기획 맥락:");
    expect(handoff.prompt).toContain("막연한 아이디어는 있지만 실행 가능한 기획서로 정리하지 못하는 초기 창업자");
    expect(handoff.prompt).toContain("이번 리서치로 좁힐 결정: 초기 창업자 기획 상세화 도구");
    expect(handoff.prompt).toContain("가능한 사용자 미래");
    expect(handoff.prompt).toContain("대표 사용 케이스");
    expect(handoff.prompt).toContain("기존 대안");
    expect(handoff.prompt).toContain("대응 선택지");
    expect(handoff.prompt).toContain("다음 질문");
    expect(handoff.prompt).toContain("출처 요구사항");
    expect(handoff.prompt).toContain("로그인·CAPTCHA·결제·비공개 문서");
    expect(handoff.prompt).not.toContain("Validate evidence for");
    expect(handoff.prompt).not.toContain("JTBD");
    expect(handoff.checklist.join("\n")).toContain("아이디어와 현재 답변 맥락");
  });

  it("keeps the visible ChatGPT prompt in English for non-Korean shells", () => {
    const task = {
      researchTaskId: "research_task_english" as ResearchTaskProjection["researchTaskId"],
      sessionId: "sess_english" as ResearchTaskProjection["sessionId"],
      objective: "Narrow user futures and current alternatives for a founder planning tool.",
      routeOutcome: "research_needed",
      impact: "high",
      status: "planned",
      createdAt: "2026-06-14T00:00:00.000Z"
    } satisfies ResearchTaskProjection;
    const spec = {
      title: "A planning assistant for early founders",
      sections: ["Founders answer simple questions to shape a concrete product brief."]
    } satisfies Pick<LivingSpecProjection, "title" | "sections">;

    const handoff = visibleChatGptResearchHandoffForTask({ language: "en", spec, task });

    expect(handoff.prompt).toContain("Original idea: A planning assistant for early founders");
    expect(handoff.prompt).toContain("Current user answers / planning context:");
    expect(handoff.prompt).toContain("Decision this research should narrow:");
    expect(handoff.prompt).toContain("Possible user futures");
    expect(handoff.prompt).toContain("Response options");
    expect(handoff.prompt).not.toContain("원문 아이디어");
    expect(handoff.checklist.join("\n")).toContain("current answer context");
  });

  it("does not leak Korean fallback copy into English prompts when planning context is missing", () => {
    const task = {
      researchTaskId: "research_task_english_fallback" as ResearchTaskProjection["researchTaskId"],
      sessionId: "sess_english_fallback" as ResearchTaskProjection["sessionId"],
      objective: "Narrow user futures for a vague product idea.",
      routeOutcome: "research_needed",
      impact: "medium",
      status: "planned",
      createdAt: "2026-06-14T00:00:00.000Z"
    } satisfies ResearchTaskProjection;

    const handoff = visibleChatGptResearchHandoffForTask({ language: "en", task });

    expect(handoff.prompt).toContain("Original idea: Untitled service idea");
    expect(handoff.prompt).toContain("User answers and planning context are not detailed yet.");
    expect(handoff.prompt).not.toContain("아직 제목이 없는 서비스 아이디어");
    expect(handoff.prompt).not.toContain("아직 사용자 답변");
  });

  it("keeps user-visible delegation copy action-oriented instead of handoff-oriented", () => {
    const task = {
      researchTaskId: "research_task_visible_copy" as ResearchTaskProjection["researchTaskId"],
      sessionId: "sess_visible_copy" as ResearchTaskProjection["sessionId"],
      objective: "Narrow representative use cases for a founder planning tool.",
      routeOutcome: "research_needed",
      impact: "high",
      status: "planned",
      createdAt: "2026-06-14T00:00:00.000Z"
    } satisfies ResearchTaskProjection;

    const request = buildVisibleChatGptResearchDelegationRequest({
      expectedStateVersion: 3 as Parameters<typeof buildVisibleChatGptResearchDelegationRequest>[0]["expectedStateVersion"],
      sessionId: "sess_visible_copy" as Parameters<typeof buildVisibleChatGptResearchDelegationRequest>[0]["sessionId"],
      task
    });

    expect(request.userVisibleExplanation).toContain("ChatGPT Deep Research request is prepared");
    expect(request.userVisibleExplanation).not.toContain("handoff");
    expect(request.nextAction).toContain("prompt preview");
    expect(request.policyRiskVerdict.rationale).not.toContain("handoff");
    expect(request.sessionOwnershipVerdict.rationale).not.toContain("handoff");
  });
});
