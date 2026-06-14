import { describe, expect, it } from "vitest";
import type { ResearchEvidenceProjection, ResearchTaskId, SessionId } from "@solo-superman/contracts";
import { researchRoutingReadinessForTask } from "./research-routing-readiness";

type ResearchTaskProjection = ResearchEvidenceProjection["tasks"][number];

function task(objective: string): ResearchTaskProjection {
  return {
    researchTaskId: "research_task_routing" as ResearchTaskId,
    sessionId: "sess_routing" as SessionId,
    objective,
    routeOutcome: "research_needed",
    impact: "medium",
    status: "planned",
    createdAt: "2026-06-14T00:00:00.000Z"
  };
}

describe("researchRoutingReadinessForTask", () => {
  it("keeps short public checks on the Codex quick-search path", () => {
    expect(
      researchRoutingReadinessForTask({
        task: task("기존 대안이 무엇인지 짧게 공개 검색으로 확인합니다.")
      })
    ).toBe("codex_quick_search");
  });

  it("does not overroute a short check just because the current spec mentions synthesis topics", () => {
    expect(
      researchRoutingReadinessForTask({
        task: task("기존 대안이 무엇인지 짧게 공개 검색으로 확인합니다."),
        spec: {
          title: "초기 창업자 기획 상세화 도구",
          sections: [
            "대표 사용 케이스와 가능한 사용자 미래는 기획서 초안에서 나중에 정리합니다.",
            "시장 변화와 경쟁 대안도 필요하면 별도 리서치로 확인합니다."
          ]
        }
      })
    ).toBe("codex_quick_search");
  });

  it("uses Browser/Deep Research only when multiple sources need synthesis", () => {
    expect(
      researchRoutingReadinessForTask({
        task: task("여러 출처를 비교해 가능한 사용자 미래, 대표 사용 케이스, 기존 대안을 종합합니다.")
      })
    ).toBe("browser_deep_research");
  });

  it("routes the accumulated planning-detail objective to Browser/Deep Research", () => {
    expect(
      researchRoutingReadinessForTask({
        task: task(
          "여러 공개 자료를 비교해 초기 창업자 기획 상세화 도구 아이디어의 가능한 사용자 미래, 대표 사용 케이스, 기존 대안, 막힐 상황, 대응 선택지를 종합합니다."
        )
      })
    ).toBe("browser_deep_research");
  });

  it("asks another clarification question before research when the target is still vague", () => {
    expect(
      researchRoutingReadinessForTask({
        task: task("첫 사용자 상황을 더 구체화해야 합니다.")
      })
    ).toBe("needs_more_clarification");
  });
});
