import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "en" | "ja" | "ko";

export const APP_LANGUAGE_STORAGE_KEY = "solo_superman.language";
export const DEFAULT_APP_LANGUAGE: AppLanguage = "ko";

export const APP_LANGUAGE_OPTIONS = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" }
] as const satisfies readonly { readonly value: AppLanguage; readonly label: string }[];

const LANGUAGE_SWITCHER_LABELS = {
  en: "Language",
  ja: "言語",
  ko: "언어"
} as const satisfies Record<AppLanguage, string>;

interface AppLanguageContextValue {
  readonly language: AppLanguage;
  readonly setLanguage: (language: AppLanguage) => void;
}

const AppLanguageContext = createContext<AppLanguageContextValue>({
  language: DEFAULT_APP_LANGUAGE,
  setLanguage: () => undefined
});

export function normalizeAppLanguage(value: string | null | undefined): AppLanguage {
  return value === "en" || value === "ja" || value === "ko" ? value : DEFAULT_APP_LANGUAGE;
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
    return DEFAULT_APP_LANGUAGE;
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
  const label = LANGUAGE_SWITCHER_LABELS[language];

  return (
    <label className="language-switcher">
      <span>{label}</span>
      <select
        aria-label={label}
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
