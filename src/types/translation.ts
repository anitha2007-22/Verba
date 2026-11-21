export enum ToneOption {
  Standard = "Standard",
  Formal = "Formal",
  Casual = "Casual",
  Concise = "Concise",
}

export enum ActiveView {
  Translate = "translate",
  History = "history",
  Saved = "saved",
  Languages = "languages",
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  speechLang: string;
  region: string;
  rtl?: boolean;
}

export interface AlternativeTranslation {
  text: string;
  nuance: string;
}

export interface TranslationResponse {
  translatedText: string;
  detectedSourceLanguage: string;
  detectedSourceCode: string;
  transliteration: string;
  alternatives: AlternativeTranslation[];
}

export interface HistoryEntry {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  sourceLangName: string;
  targetLang: string;
  targetLangName: string;
  tone: ToneOption;
  transliteration?: string;
  alternatives?: AlternativeTranslation[];
  timestamp: number;
}

export interface SavedPhrase {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  sourceLangName: string;
  targetLang: string;
  targetLangName: string;
  transliteration?: string;
  savedAt: number;
}
