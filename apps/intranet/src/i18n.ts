import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en/translation.json";
import es from "./locales/es/translation.json";

i18n
  .use(initReactI18next)
  .init({
    fallbackLng: "es",
    interpolation: { escapeValue: false },
    lng: "es",
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
  })
  .catch((error) => {
    console.error("[i18n] init error", error);
  });

export { i18n };
