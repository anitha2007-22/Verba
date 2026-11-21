import type { Language } from "../types/translation";

export const AUTO_DETECT_LANGUAGE: Language = {
  code: "auto",
  name: "Auto-Detect",
  nativeName: "Detect language",
  speechLang: "en-US",
  region: "Automatic",
};

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English", speechLang: "en-US", region: "Global" },
  { code: "es", name: "Spanish", nativeName: "Español", speechLang: "es-ES", region: "Europe & Americas" },
  { code: "fr", name: "French", nativeName: "Français", speechLang: "fr-FR", region: "Europe & Africa" },
  { code: "de", name: "German", nativeName: "Deutsch", speechLang: "de-DE", region: "Europe" },
  { code: "it", name: "Italian", nativeName: "Italiano", speechLang: "it-IT", region: "Europe" },
  { code: "pt", name: "Portuguese", nativeName: "Português", speechLang: "pt-PT", region: "Europe & Americas" },
  { code: "ja", name: "Japanese", nativeName: "日本語", speechLang: "ja-JP", region: "East Asia" },
  { code: "ko", name: "Korean", nativeName: "한국어", speechLang: "ko-KR", region: "East Asia" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "简体中文", speechLang: "zh-CN", region: "East Asia" },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "繁體中文", speechLang: "zh-TW", region: "East Asia" },
  { code: "ar", name: "Arabic", nativeName: "العربية", speechLang: "ar-SA", region: "Middle East & Africa", rtl: true },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", speechLang: "hi-IN", region: "South Asia" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", speechLang: "bn-IN", region: "South Asia" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", speechLang: "ta-IN", region: "South Asia" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", speechLang: "te-IN", region: "South Asia" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", speechLang: "mr-IN", region: "South Asia" },
  { code: "ur", name: "Urdu", nativeName: "اردو", speechLang: "ur-PK", region: "South Asia", rtl: true },
  { code: "ru", name: "Russian", nativeName: "Русский", speechLang: "ru-RU", region: "Eastern Europe & Asia" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", speechLang: "uk-UA", region: "Eastern Europe" },
  { code: "pl", name: "Polish", nativeName: "Polski", speechLang: "pl-PL", region: "Europe" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", speechLang: "nl-NL", region: "Europe" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", speechLang: "sv-SE", region: "Northern Europe" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", speechLang: "nb-NO", region: "Northern Europe" },
  { code: "da", name: "Danish", nativeName: "Dansk", speechLang: "da-DK", region: "Northern Europe" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", speechLang: "fi-FI", region: "Northern Europe" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", speechLang: "el-GR", region: "Southern Europe" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", speechLang: "tr-TR", region: "Eurasia" },
  { code: "he", name: "Hebrew", nativeName: "עברית", speechLang: "he-IL", region: "Middle East", rtl: true },
  { code: "fa", name: "Persian", nativeName: "فارسی", speechLang: "fa-IR", region: "Middle East", rtl: true },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", speechLang: "vi-VN", region: "Southeast Asia" },
  { code: "th", name: "Thai", nativeName: "ไทย", speechLang: "th-TH", region: "Southeast Asia" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", speechLang: "id-ID", region: "Southeast Asia" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", speechLang: "ms-MY", region: "Southeast Asia" },
  { code: "tl", name: "Filipino", nativeName: "Filipino", speechLang: "fil-PH", region: "Southeast Asia" },
  { code: "cs", name: "Czech", nativeName: "Čeština", speechLang: "cs-CZ", region: "Central Europe" },
  { code: "ro", name: "Romanian", nativeName: "Română", speechLang: "ro-RO", region: "Eastern Europe" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", speechLang: "hu-HU", region: "Central Europe" },
  { code: "bg", name: "Bulgarian", nativeName: "Български", speechLang: "bg-BG", region: "Eastern Europe" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski", speechLang: "hr-HR", region: "Southern Europe" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", speechLang: "sk-SK", region: "Central Europe" },
  { code: "ca", name: "Catalan", nativeName: "Català", speechLang: "ca-ES", region: "Southern Europe" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", speechLang: "sw-KE", region: "East Africa" },
  { code: "af", name: "Afrikaans", nativeName: "Afrikaans", speechLang: "af-ZA", region: "Southern Africa" },
  { code: "am", name: "Amharic", nativeName: "አማርኛ", speechLang: "am-ET", region: "East Africa" },
  { code: "la", name: "Latin", nativeName: "Latina", speechLang: "la", region: "Classical" },
];

export function findLanguageByCode(code: string): Language | undefined {
  if (code === "auto") return AUTO_DETECT_LANGUAGE;
  return LANGUAGES.find((lang) => lang.code.toLowerCase() === code.toLowerCase());
}

export const SAMPLE_PHRASES: Array<{
  label: string;
  sourceLang: string;
  targetLang: string;
  text: string;
}> = [
  {
    label: "Business greeting",
    sourceLang: "en",
    targetLang: "ja",
    text: "Thank you for taking the time to meet with us today. We look forward to building a long-term partnership together.",
  },
  {
    label: "Travel inquiry",
    sourceLang: "en",
    targetLang: "es",
    text: "Excuse me, could you tell me which platform the express train to Madrid departs from, and whether seat reservations are required?",
  },
  {
    label: "Product announcement",
    sourceLang: "fr",
    targetLang: "en",
    text: "Notre nouvelle mise à jour simplifie le travail collaboratif grâce à une interface épurée et des performances nettement améliorées.",
  },
];
