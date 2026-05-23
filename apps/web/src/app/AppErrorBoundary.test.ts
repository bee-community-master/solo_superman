import { describe, expect, it } from "vitest";
import { appErrorBoundaryCopyForLanguage } from "./AppErrorBoundary";

describe("AppErrorBoundary copy", () => {
  it("keeps the app error fallback copy localized per app language", () => {
    const englishCopy = Object.values(appErrorBoundaryCopyForLanguage("en")).join(" ");
    const japaneseCopy = Object.values(appErrorBoundaryCopyForLanguage("ja")).join(" ");
    const koreanCopy = Object.values(appErrorBoundaryCopyForLanguage("ko")).join(" ");

    expect(englishCopy).toContain("recover the workspace screen");
    expect(englishCopy).toContain("Try screen again");
    expect(englishCopy).not.toMatch(/[가-힣]/u);
    expect(japaneseCopy).toContain("作業画面");
    expect(koreanCopy).toContain("작업 화면");
  });
});
