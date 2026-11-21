import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Bookmark,
  Check,
  Copy,
  Loader2,
  Moon,
  RotateCcw,
  Square,
  Sun,
  Volume2,
  X,
} from "lucide-react";
import { AUTO_DETECT_LANGUAGE, findLanguageByCode, SAMPLE_PHRASES } from "../data/languages";
import {
  ToneOption,
  type AlternativeTranslation,
  type HistoryEntry,
  type SavedPhrase,
  type TranslationResponse,
} from "../types/translation";
import { playTextToSpeech, stopActiveSpeech } from "../utils/speech";
import { LanguageSelector } from "./LanguageSelector";

const MAX_CHARS = 5000;

interface TranslationWorkbenchProps {
  sourceText: string;
  onSourceTextChange: (text: string) => void;
  sourceLang: string;
  onSourceLangChange: (code: string) => void;
  targetLang: string;
  onTargetLangChange: (code: string) => void;
  tone: ToneOption;
  onToneChange: (tone: ToneOption) => void;
  recentSourceCodes: string[];
  recentTargetCodes: string[];
  isDark: boolean;
  onToggleTheme: () => void;
  isSaved: (sourceText: string, translatedText: string, targetLang: string) => boolean;
  onToggleSave: (phrase: Omit<SavedPhrase, "id" | "savedAt">) => void;
  onRecordHistory: (entry: Omit<HistoryEntry, "id" | "timestamp">) => void;
  preloadedResult?: {
    translatedText: string;
    transliteration: string;
    alternatives: AlternativeTranslation[];
    detectedSourceLanguage: string;
    detectedSourceCode: string;
  } | null;
}

export function TranslationWorkbench({
  sourceText,
  onSourceTextChange,
  sourceLang,
  onSourceLangChange,
  targetLang,
  onTargetLangChange,
  tone,
  onToneChange,
  recentSourceCodes,
  recentTargetCodes,
  isDark,
  onToggleTheme,
  isSaved,
  onToggleSave,
  onRecordHistory,
  preloadedResult,
}: TranslationWorkbenchProps) {
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [result, setResult] = useState<TranslationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedSlot, setCopiedSlot] = useState<"source" | "target" | number | null>(null);
  const [speechState, setSpeechState] = useState<{
    slot: "source" | "target" | null;
    status: "idle" | "loading" | "playing";
  }>({ slot: null, status: "idle" });
  const [speechError, setSpeechError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastTranslatedKeyRef = useRef<string>("");
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (preloadedResult) {
      setResult(preloadedResult);
      setErrorMessage(null);
      lastTranslatedKeyRef.current = `${sourceLang}:${targetLang}:${tone}:${sourceText.trim()}`;
    }
  }, [preloadedResult, sourceLang, targetLang, tone, sourceText]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
      stopActiveSpeech();
    };
  }, []);

  const sourceLanguageObj = useMemo(
    () => findLanguageByCode(sourceLang) ?? AUTO_DETECT_LANGUAGE,
    [sourceLang]
  );
  const targetLanguageObj = useMemo(
    () => findLanguageByCode(targetLang) ?? findLanguageByCode("es")!,
    [targetLang]
  );

  const runTranslation = useCallback(
    async (textToTranslate: string, force = false) => {
      const trimmed = textToTranslate.trim();
      if (!trimmed) {
        abortControllerRef.current?.abort();
        setResult(null);
        setErrorMessage(null);
        setIsLoading(false);
        lastTranslatedKeyRef.current = "";
        return;
      }

      if (trimmed.length > MAX_CHARS) {
        setErrorMessage(`Text exceeds the ${MAX_CHARS.toLocaleString()} character limit.`);
        return;
      }

      const requestKey = `${sourceLang}:${targetLang}:${tone}:${trimmed}`;
      if (!force && requestKey === lastTranslatedKeyRef.current) {
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            text: trimmed,
            sourceLang,
            sourceLangName: sourceLanguageObj.name,
            targetLang,
            targetLangName: targetLanguageObj.name,
            tone,
          }),
        });

        const payload = (await res.json()) as Partial<TranslationResponse> & { error?: string };

        if (!res.ok) {
          throw new Error(payload.error || "Translation request failed.");
        }

        const cleanResult: TranslationResponse = {
          translatedText: payload.translatedText ?? "",
          detectedSourceLanguage: payload.detectedSourceLanguage ?? sourceLanguageObj.name,
          detectedSourceCode: payload.detectedSourceCode ?? sourceLang,
          transliteration: payload.transliteration ?? "",
          alternatives: Array.isArray(payload.alternatives) ? payload.alternatives : [],
        };

        lastTranslatedKeyRef.current = requestKey;
        setResult(cleanResult);
        setIsLoading(false);

        if (cleanResult.translatedText) {
          onRecordHistory({
            sourceText: trimmed,
            translatedText: cleanResult.translatedText,
            sourceLang: cleanResult.detectedSourceCode || sourceLang,
            sourceLangName: cleanResult.detectedSourceLanguage || sourceLanguageObj.name,
            targetLang,
            targetLangName: targetLanguageObj.name,
            tone,
            transliteration: cleanResult.transliteration,
            alternatives: cleanResult.alternatives,
          });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setIsLoading(false);
        setErrorMessage(
          err instanceof Error ? err.message : "Unable to complete translation right now."
        );
      }
    },
    [sourceLang, targetLang, tone, sourceLanguageObj.name, targetLanguageObj.name, onRecordHistory]
  );

  // Debounced auto-translate
  useEffect(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!sourceText.trim()) {
      abortControllerRef.current?.abort();
      setResult(null);
      setErrorMessage(null);
      setIsLoading(false);
      lastTranslatedKeyRef.current = "";
      return;
    }

    if (!autoTranslate) return;

    debounceTimerRef.current = window.setTimeout(() => {
      void runTranslation(sourceText);
    }, 550);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [sourceText, sourceLang, targetLang, tone, autoTranslate, runTranslation]);

  const handleManualTranslate = () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    void runTranslation(sourceText, true);
  };

  const handleSwapLanguages = () => {
    stopActiveSpeech();
    setSpeechState({ slot: null, status: "idle" });

    const nextSource = targetLang;
    const resolvedCurrentSource =
      sourceLang === "auto"
        ? result?.detectedSourceCode && findLanguageByCode(result.detectedSourceCode)
          ? result.detectedSourceCode
          : "en"
        : sourceLang;

    const nextTarget = resolvedCurrentSource === nextSource ? "en" : resolvedCurrentSource;

    onSourceLangChange(nextSource);
    onTargetLangChange(nextTarget);

    if (result?.translatedText) {
      const previousSource = sourceText;
      onSourceTextChange(result.translatedText);
      setResult({
        translatedText: previousSource,
        detectedSourceLanguage: targetLanguageObj.name,
        detectedSourceCode: nextSource,
        transliteration: "",
        alternatives: [],
      });
      lastTranslatedKeyRef.current = "";
    }
  };

  const handleClearSource = () => {
    stopActiveSpeech();
    setSpeechState({ slot: null, status: "idle" });
    abortControllerRef.current?.abort();
    onSourceTextChange("");
    setResult(null);
    setErrorMessage(null);
    setIsLoading(false);
    lastTranslatedKeyRef.current = "";
  };

  const handleCopy = async (text: string, slot: "source" | "target" | number) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSlot(slot);
      window.setTimeout(() => {
        setCopiedSlot((current) => (current === slot ? null : current));
      }, 1800);
    } catch {
      setErrorMessage("Clipboard access is blocked by browser permissions.");
    }
  };

  const handleSpeech = async (slot: "source" | "target") => {
    setSpeechError(null);
    if (speechState.slot === slot && speechState.status !== "idle") {
      stopActiveSpeech();
      setSpeechState({ slot: null, status: "idle" });
      return;
    }

    const text = slot === "source" ? sourceText.trim() : result?.translatedText.trim() ?? "";
    if (!text) return;

    const langObj =
      slot === "source"
        ? findLanguageByCode(result?.detectedSourceCode || sourceLang) ?? sourceLanguageObj
        : targetLanguageObj;

    setSpeechState({ slot, status: "loading" });

    await playTextToSpeech({
      text,
      languageName:
        slot === "source" && sourceLang === "auto" && result?.detectedSourceLanguage
          ? result.detectedSourceLanguage
          : langObj.name,
      speechLang: langObj.speechLang,
      slot,
      onStartPlaying: () => setSpeechState({ slot, status: "playing" }),
      onEnd: () => setSpeechState({ slot: null, status: "idle" }),
      onError: (msg) => {
        setSpeechState({ slot: null, status: "idle" });
        setSpeechError(msg);
      },
    });
  };

  const currentlySaved = useMemo(() => {
    if (!sourceText.trim() || !result?.translatedText) return false;
    return isSaved(sourceText.trim(), result.translatedText, targetLang);
  }, [sourceText, result, targetLang, isSaved]);

  const handleToggleBookmark = () => {
    if (!sourceText.trim() || !result?.translatedText) return;
    onToggleSave({
      sourceText: sourceText.trim(),
      translatedText: result.translatedText,
      sourceLang: result.detectedSourceCode || sourceLang,
      sourceLangName: result.detectedSourceLanguage || sourceLanguageObj.name,
      targetLang,
      targetLangName: targetLanguageObj.name,
      transliteration: result.transliteration,
    });
  };

  const charCount = sourceText.length;
  const isOverLimit = charCount > MAX_CHARS;

  const detectedLabel =
    sourceLang === "auto" && result?.detectedSourceLanguage
      ? result.detectedSourceLanguage
      : undefined;

  const outputFontSizeClass = useMemo(() => {
    const len = result?.translatedText.length ?? 0;
    if (len > 400) return "text-base leading-relaxed";
    if (len > 140) return "text-lg leading-relaxed";
    return "text-xl leading-relaxed";
  }, [result?.translatedText]);

  return (
    <section className="space-y-5" aria-label="Translation workbench">
      {/* Workspace Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tone segmented control */}
          <div
            className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
            role="group"
            aria-label="Translation tone"
          >
            {Object.values(ToneOption).map((option) => {
              const active = tone === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onToneChange(option)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    active
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setAutoTranslate((prev) => !prev)}
            aria-pressed={autoTranslate}
            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              autoTranslate
                ? "bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>Auto-translate: {autoTranslate ? "On" : "Off"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? "Light" : "Dark"}</span>
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Workbench Surface */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-visible">
        {/* Language Selection Bar */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0 flex items-center">
            <LanguageSelector
              value={sourceLang}
              onChange={(code) => {
                if (code === targetLang && code !== "auto") {
                  onTargetLangChange(sourceLang === "auto" ? "en" : sourceLang);
                }
                onSourceLangChange(code);
              }}
              allowAuto
              detectedLabel={detectedLabel}
              quickCodes={recentSourceCodes}
              align="left"
              ariaLabel="Source language"
            />
          </div>

          <button
            type="button"
            onClick={handleSwapLanguages}
            aria-label="Swap source and target languages"
            title="Swap languages"
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <div className="min-w-0 flex items-center justify-end sm:justify-start">
            <LanguageSelector
              value={targetLang}
              onChange={(code) => {
                if (code === sourceLang) {
                  onSourceLangChange(targetLang);
                }
                onTargetLangChange(code);
              }}
              quickCodes={recentTargetCodes}
              align="right"
              ariaLabel="Target language"
            />
          </div>
        </div>

        {/* Dual Pane Body */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Source Input Pane */}
          <div className="flex flex-col min-h-[300px] lg:min-h-[340px] p-5">
            <div className="flex items-start gap-2 flex-1">
              <textarea
                value={sourceText}
                onChange={(e) => onSourceTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleManualTranslate();
                  }
                }}
                dir={sourceLanguageObj.rtl ? "rtl" : "auto"}
                placeholder="Enter or paste text to translate..."
                aria-label="Source text to translate"
                className="w-full flex-1 min-h-[210px] resize-none bg-transparent text-lg leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
              {sourceText && (
                <button
                  type="button"
                  onClick={handleClearSource}
                  aria-label="Clear source text"
                  title="Clear text"
                  className="p-2 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sample phrase quick-fill when empty */}
            {!sourceText && (
              <div className="pt-3 pb-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Try a sample:</span>
                {SAMPLE_PHRASES.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => {
                      onSourceLangChange(sample.sourceLang);
                      onTargetLangChange(sample.targetLang);
                      onSourceTextChange(sample.text);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium whitespace-nowrap"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            )}

            {/* Source Bottom Bar */}
            <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!sourceText.trim()}
                  onClick={() => void handleSpeech("source")}
                  aria-label={
                    speechState.slot === "source" && speechState.status !== "idle"
                      ? "Stop listening to source text"
                      : "Listen to source text"
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {speechState.slot === "source" && speechState.status === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : speechState.slot === "source" && speechState.status === "playing" ? (
                    <Square className="w-3.5 h-3.5 fill-current text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span>
                    {speechState.slot === "source" && speechState.status === "playing"
                      ? "Stop"
                      : "Listen"}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!sourceText.trim()}
                  onClick={() => void handleCopy(sourceText, "source")}
                  aria-label="Copy source text"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {copiedSlot === "source" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`font-mono text-xs tabular-nums ${
                    isOverLimit
                      ? "text-red-600 dark:text-red-400 font-medium"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>

                <button
                  type="button"
                  disabled={!sourceText.trim() || isLoading || isOverLimit}
                  onClick={handleManualTranslate}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Translate</span>
                </button>
              </div>
            </div>
          </div>

          {/* Target Output Pane */}
          <div className="flex flex-col min-h-[300px] lg:min-h-[340px] p-5 bg-slate-50/75 dark:bg-slate-950/40">
            <div className="flex-1 flex flex-col">
              {errorMessage ? (
                <div
                  role="alert"
                  className="flex flex-col items-start gap-3 p-4 rounded-lg border border-red-200 dark:border-red-900/70 bg-red-50/70 dark:bg-red-950/30 text-red-800 dark:text-red-200"
                >
                  <div className="flex items-start gap-2.5 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualTranslate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry translation</span>
                  </button>
                </div>
              ) : isLoading && !result?.translatedText ? (
                <div className="space-y-3 py-1" aria-busy="true" aria-label="Translating text">
                  <div className="h-5 w-4/5 rounded bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                  <div className="h-5 w-3/5 rounded bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
                  <div className="h-5 w-2/5 rounded bg-slate-200/60 dark:bg-slate-800 animate-pulse" />
                </div>
              ) : result?.translatedText ? (
                <div className="space-y-3">
                  <div
                    dir={targetLanguageObj.rtl ? "rtl" : "auto"}
                    className={`whitespace-pre-wrap break-words text-slate-900 dark:text-slate-100 select-text transition-opacity duration-150 ${outputFontSizeClass} ${
                      isLoading ? "opacity-60" : "opacity-100"
                    }`}
                  >
                    {result.translatedText}
                  </div>
                  {result.transliteration && (
                    <div className="text-sm text-slate-500 dark:text-slate-400 font-normal leading-relaxed select-text">
                      {result.transliteration}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-lg text-slate-400 dark:text-slate-500 select-none">
                  Translation will appear here
                </div>
              )}

              {speechError && (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400" role="status">
                  {speechError}
                </p>
              )}
            </div>

            {/* Target Bottom Bar */}
            <div className="pt-4 mt-3 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!result?.translatedText}
                  onClick={() => void handleSpeech("target")}
                  aria-label={
                    speechState.slot === "target" && speechState.status !== "idle"
                      ? "Stop listening to translation"
                      : "Listen to translation"
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {speechState.slot === "target" && speechState.status === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : speechState.slot === "target" && speechState.status === "playing" ? (
                    <Square className="w-3.5 h-3.5 fill-current text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span>
                    {speechState.slot === "target" && speechState.status === "playing"
                      ? "Stop"
                      : "Listen"}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!result?.translatedText}
                  onClick={() => void handleCopy(result?.translatedText ?? "", "target")}
                  aria-label="Copy translation"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {copiedSlot === "target" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy translation</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {result?.detectedSourceLanguage && sourceLang === "auto" && (
                  <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400">
                    Detected: {result.detectedSourceLanguage}
                  </span>
                )}

                <button
                  type="button"
                  disabled={!result?.translatedText}
                  onClick={handleToggleBookmark}
                  aria-pressed={currentlySaved}
                  aria-label={currentlySaved ? "Remove from saved phrases" : "Save phrase"}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    currentlySaved
                      ? "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${currentlySaved ? "fill-current" : ""}`} />
                  <span>{currentlySaved ? "Saved" : "Save"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alternative Phrasings Section */}
      {result?.alternatives && result.alternatives.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Alternative phrasings in {targetLanguageObj.name}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {result.alternatives.length} {result.alternatives.length === 1 ? "option" : "options"}
            </span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {result.alternatives.map((alt, idx) => (
              <div
                key={`${alt.text}-${idx}`}
                className="py-3 first:pt-3 last:pb-0 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 space-y-0.5">
                  <div
                    dir={targetLanguageObj.rtl ? "rtl" : "auto"}
                    className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words"
                  >
                    {alt.text}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {alt.nuance}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy(alt.text, idx)}
                  aria-label={`Copy alternative phrasing: ${alt.text}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedSlot === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
