import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getStoredLanguage, setStoredLanguage } from "./language";

import enTranslation from "./locales/en/translation.json";
import hiTranslation from "./locales/hi/translation.json";
import bnTranslation from "./locales/bn/translation.json";

const lng = getStoredLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      hi: { translation: hiTranslation },
      bn: { translation: bnTranslation },
    },
    lng,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

i18n.on("languageChanged", (code) => {
  setStoredLanguage(code);
  document.documentElement.lang = code;
});

document.documentElement.lang = lng;

export default i18n;
