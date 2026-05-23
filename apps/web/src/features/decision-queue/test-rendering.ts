import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppLanguageProvider, type AppLanguage } from "../../shared/i18n/app-language";

export function renderMarkup(element: ReactElement, initialLanguage: AppLanguage) {
  return renderToStaticMarkup(
    createElement(AppLanguageProvider, {
      initialLanguage,
      children: element
    })
  );
}

export function renderEnglishMarkup(element: ReactElement) {
  return renderMarkup(element, "en");
}
