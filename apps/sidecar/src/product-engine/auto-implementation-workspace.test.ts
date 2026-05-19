import { describe, expect, it } from "vitest";
import { isGitHubRemoteUrl, sanitizeProjectFolderName } from "./auto-implementation-workspace";

describe("auto implementation workspace helpers", () => {
  it("recognizes common GitHub remote URL shapes without classifying URL schemes as SCP hosts", () => {
    expect(isGitHubRemoteUrl("https://github.com/bee-community-master/solo_superman.git")).toBe(true);
    expect(isGitHubRemoteUrl("git@github.com:bee-community-master/solo_superman.git")).toBe(true);
    expect(isGitHubRemoteUrl("ssh://git@github.com/bee-community-master/solo_superman.git")).toBe(true);
    expect(isGitHubRemoteUrl("https://gitlab.com/bee-community-master/solo_superman.git")).toBe(false);
    expect(isGitHubRemoteUrl("/tmp/local-bare-repo.git")).toBe(false);
  });

  it("uses deterministic safe fallback folders for non-ASCII or reserved project names", () => {
    expect(sanitizeProjectFolderName("Demo Workspace App")).toBe("demo-workspace-app");
    expect(sanitizeProjectFolderName("고양이 펜팔 서비스")).toMatch(/^solo-superman-project-[a-f0-9]{16}$/u);
    expect(sanitizeProjectFolderName("con")).toMatch(/^solo-superman-project-[a-f0-9]{16}$/u);
  });
});
