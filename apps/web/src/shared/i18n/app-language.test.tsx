import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  APP_LANGUAGE_STORAGE_KEY,
  AppLanguageProvider,
  LanguageSwitcher,
  normalizeAppLanguage,
  readStoredAppLanguage,
  writeStoredAppLanguage
} from "./app-language";

describe("app language settings", () => {
  it("keeps English as the safe default and accepts Japanese explicitly", () => {
    expect(normalizeAppLanguage(undefined)).toBe("en");
    expect(normalizeAppLanguage("ko")).toBe("en");
    expect(normalizeAppLanguage("en")).toBe("en");
    expect(normalizeAppLanguage("ja")).toBe("ja");
  });

  it("reads and writes the persisted first-setup language preference", () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value))
    } as unknown as Storage;

    writeStoredAppLanguage("ja", fakeStorage);

    expect(fakeStorage.setItem).toHaveBeenCalledWith(APP_LANGUAGE_STORAGE_KEY, "ja");
    expect(readStoredAppLanguage(fakeStorage)).toBe("ja");
  });

  it("renders a corner-friendly switcher with a stable Language label in Japanese mode", () => {
    const markup = renderToStaticMarkup(
      <AppLanguageProvider initialLanguage="ja">
        <LanguageSwitcher />
      </AppLanguageProvider>
    );

    expect(markup).toContain("Language");
    expect(markup).toContain("English");
    expect(markup).toContain("日本語");
    expect(markup).toContain("selected");
  });
});
