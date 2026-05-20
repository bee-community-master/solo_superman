import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  APP_LANGUAGE_STORAGE_KEY,
  AppLanguageProvider,
  DEFAULT_APP_LANGUAGE,
  LanguageSwitcher,
  normalizeAppLanguage,
  readStoredAppLanguage,
  writeStoredAppLanguage
} from "./app-language";

describe("app language settings", () => {
  it("keeps Korean as the safe default and accepts supported setup languages explicitly", () => {
    expect(DEFAULT_APP_LANGUAGE).toBe("ko");
    expect(normalizeAppLanguage(undefined)).toBe("ko");
    expect(normalizeAppLanguage("fr")).toBe("ko");
    expect(normalizeAppLanguage("en")).toBe("en");
    expect(normalizeAppLanguage("ja")).toBe("ja");
    expect(normalizeAppLanguage("ko")).toBe("ko");
  });

  it("defaults first setup to Korean when no language preference is stored", () => {
    const fakeStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn()
    } as unknown as Storage;

    expect(readStoredAppLanguage(fakeStorage)).toBe("ko");
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

  it("renders a corner-friendly switcher with a localized label in Japanese mode", () => {
    const markup = renderToStaticMarkup(
      <AppLanguageProvider initialLanguage="ja">
        <LanguageSwitcher />
      </AppLanguageProvider>
    );

    expect(markup).toContain("言語");
    expect(markup).toContain("English");
    expect(markup).toContain("日本語");
    expect(markup).toContain("한국어");
    expect(markup).toContain("selected");
  });

  it("renders the language switcher label in Korean mode", () => {
    const markup = renderToStaticMarkup(
      <AppLanguageProvider initialLanguage="ko">
        <LanguageSwitcher />
      </AppLanguageProvider>
    );

    expect(markup).toContain("언어");
    expect(markup).toContain("한국어");
    expect(markup).toContain("English");
    expect(markup).toContain("日本語");
  });

  it("persists Korean as a supported first-setup language", () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value))
    } as unknown as Storage;

    writeStoredAppLanguage("ko", fakeStorage);

    expect(fakeStorage.setItem).toHaveBeenCalledWith(APP_LANGUAGE_STORAGE_KEY, "ko");
    expect(readStoredAppLanguage(fakeStorage)).toBe("ko");
  });
});
