import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "en" | "ja" | "ko";

export const APP_LANGUAGE_STORAGE_KEY = "solo_superman.language";

export const APP_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" }
] as const satisfies readonly { readonly value: AppLanguage; readonly label: string }[];

interface AppLanguageContextValue {
  readonly language: AppLanguage;
  readonly setLanguage: (language: AppLanguage) => void;
}

const AppLanguageContext = createContext<AppLanguageContextValue>({
  language: "en",
  setLanguage: () => undefined
});

export function normalizeAppLanguage(value: string | null | undefined): AppLanguage {
  return value === "ja" || value === "ko" ? value : "en";
}

function browserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function readStoredAppLanguage(storage: Storage | null = browserStorage()): AppLanguage {
  try {
    return normalizeAppLanguage(storage?.getItem(APP_LANGUAGE_STORAGE_KEY));
  } catch {
    return "en";
  }
}

export function writeStoredAppLanguage(language: AppLanguage, storage: Storage | null = browserStorage()) {
  try {
    storage?.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Language switching is a setup convenience. A private-mode storage failure must not block the app.
  }
}

interface AppLanguageProviderProps {
  readonly children: ReactNode;
  readonly initialLanguage?: AppLanguage;
}

export function AppLanguageProvider({ children, initialLanguage }: AppLanguageProviderProps) {
  const [language, setLanguageState] = useState<AppLanguage>(() => initialLanguage ?? readStoredAppLanguage());

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    writeStoredAppLanguage(nextLanguage);
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage
    }),
    [language]
  );

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage() {
  return useContext(AppLanguageContext);
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useAppLanguage();

  return (
    <label className="language-switcher">
      <span>Language</span>
      <select
        aria-label="Language"
        value={language}
        onChange={(event) => setLanguage(normalizeAppLanguage(event.target.value))}
      >
        {APP_LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
