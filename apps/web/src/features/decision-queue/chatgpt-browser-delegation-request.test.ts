import { describe, expect, it } from "vitest";
import type { LivingSpecProjection, ResearchEvidenceProjection } from "@solo-superman/contracts";
import { visibleChatGptResearchHandoffForTask } from "./chatgpt-browser-delegation-request";

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

    const handoff = visibleChatGptResearchHandoffForTask({ spec, task });

    expect(handoff.openUrl).toBe("https://chatgpt.com/");
    expect(handoff.prompt).toContain("원문 아이디어: 초기 창업자가 막연한 서비스 아이디어");
    expect(handoff.prompt).toContain("현재까지의 사용자 답변/기획 맥락:");
    expect(handoff.prompt).toContain("사용자는 아이디어를 한두 문장으로 적고 쉬운 질문에 답한다.");
    expect(handoff.prompt).toContain("이번 리서치가 좁힐 결정: 초기 창업자 기획 상세화 도구");
    expect(handoff.prompt).toContain("가능한 사용자 미래");
    expect(handoff.prompt).toContain("대표 사용 케이스");
    expect(handoff.prompt).toContain("기존 대안");
    expect(handoff.prompt).toContain("대응 선택지");
    expect(handoff.prompt).toContain("다음 질문");
    expect(handoff.prompt).toContain("출처 요구사항");
    expect(handoff.prompt).toContain("로그인·CAPTCHA·결제·비공개 문서");
    expect(handoff.checklist.join("\n")).toContain("아이디어와 현재 답변 맥락");
  });
});
