export const STORAGE_KEY = "kindred_language";

export const SUPPORTED_LANGUAGES = [
  { code: "en", displayName: "English", nativeName: "English" },
  { code: "hi", displayName: "Hindi", nativeName: "हिन्दी" },
  { code: "bn", displayName: "Bengali", nativeName: "বাংলা" },
];

export function getStoredLanguage() {
  try {
    const lang = localStorage.getItem(STORAGE_KEY);
    if (lang && SUPPORTED_LANGUAGES.some((l) => l.code === lang)) return lang;
  } catch {
    /* ignore */
  }
  return "en";
}

export function setStoredLanguage(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}
