import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppLanguageProvider } from "../../shared/i18n/app-language";

export function renderEnglishMarkup(element: ReactElement) {
  return renderToStaticMarkup(
    createElement(AppLanguageProvider, {
      initialLanguage: "en",
      children: element
    })
  );
}
