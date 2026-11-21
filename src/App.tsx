import { useCallback, useEffect, useState } from "react";
import { LanguagesDirectory } from "./components/LanguagesDirectory";
import { HistoryView } from "./components/HistoryView";
import { SavedView } from "./components/SavedView";
import { TranslationWorkbench } from "./components/TranslationWorkbench";
import {
  ActiveView,
  ToneOption,
  type AlternativeTranslation,
  type HistoryEntry,
  type SavedPhrase,
} from "./types/translation";
import { stopActiveSpeech } from "./utils/speech";

const HISTORY_STORAGE_KEY = "verba_history_v1";
const SAVED_STORAGE_KEY = "verba_saved_v1";
const THEME_STORAGE_KEY = "verba_theme_v1";

function loadStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>(ActiveView.Translate);
  const [sourceText, setSourceText] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("es");
  const [tone, setTone] = useState<ToneOption>(ToneOption.Standard);

  const [recentSourceCodes, setRecentSourceCodes] = useState<string[]>(["en", "fr"]);
  const [recentTargetCodes, setRecentTargetCodes] = useState<string[]>(["es", "fr", "ja"]);

  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    loadStoredJson<HistoryEntry[]>(HISTORY_STORAGE_KEY, [])
  );
  const [savedPhrases, setSavedPhrases] = useState<SavedPhrase[]>(() =>
    loadStoredJson<SavedPhrase[]>(SAVED_STORAGE_KEY, [])
  );

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
  });

  const [preloadedResult, setPreloadedResult] = useState<{
    translatedText: string;
    transliteration: string;
    alternatives: AlternativeTranslation[];
    detectedSourceLanguage: string;
    detectedSourceCode: string;
  } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    } else {
      root.classList.remove("dark");
      window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    }
  }, [isDark]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(savedPhrases));
    } catch {
      // Ignore storage quota errors
    }
  }, [savedPhrases]);

  const handleSourceLangChange = (code: string) => {
    setSourceLang(code);
    if (code !== "auto") {
      setRecentSourceCodes((prev) => [code, ...prev.filter((c) => c !== code)].slice(0, 4));
    }
  };

  const handleTargetLangChange = (code: string) => {
    setTargetLang(code);
    setRecentTargetCodes((prev) => [code, ...prev.filter((c) => c !== code)].slice(0, 4));
  };

  const handleRecordHistory = useCallback((entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    setHistory((prev) => {
      const top = prev[0];
      if (
        top &&
        top.sourceText === entry.sourceText &&
        top.targetLang === entry.targetLang &&
        top.tone === entry.tone
      ) {
        return prev;
      }
      const next: HistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };
      return [next, ...prev].slice(0, 50);
    });
  }, []);

  const isPhraseSaved = useCallback(
    (src: string, trg: string, trgLang: string) =>
      savedPhrases.some(
        (p) => p.sourceText === src && p.translatedText === trg && p.targetLang === trgLang
      ),
    [savedPhrases]
  );

  const handleToggleSave = useCallback((phrase: Omit<SavedPhrase, "id" | "savedAt">) => {
    setSavedPhrases((prev) => {
      const existing = prev.find(
        (p) =>
          p.sourceText === phrase.sourceText &&
          p.translatedText === phrase.translatedText &&
          p.targetLang === phrase.targetLang
      );
      if (existing) {
        return prev.filter((p) => p.id !== existing.id);
      }
      const next: SavedPhrase = {
        ...phrase,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        savedAt: Date.now(),
      };
      return [next, ...prev];
    });
  }, []);

  const handleRestoreFromHistory = (entry: HistoryEntry) => {
    stopActiveSpeech();
    setSourceLang(entry.sourceLang);
    setTargetLang(entry.targetLang);
    setTone(entry.tone);
    setSourceText(entry.sourceText);
    setPreloadedResult({
      translatedText: entry.translatedText,
      transliteration: entry.transliteration ?? "",
      alternatives: entry.alternatives ?? [],
      detectedSourceLanguage: entry.sourceLangName,
      detectedSourceCode: entry.sourceLang,
    });
    setActiveView(ActiveView.Translate);
  };

  const handleRestoreFromSaved = (phrase: SavedPhrase) => {
    stopActiveSpeech();
    setSourceLang(phrase.sourceLang);
    setTargetLang(phrase.targetLang);
    setSourceText(phrase.sourceText);
    setPreloadedResult({
      translatedText: phrase.translatedText,
      transliteration: phrase.transliteration ?? "",
      alternatives: [],
      detectedSourceLanguage: phrase.sourceLangName,
      detectedSourceCode: phrase.sourceLang,
    });
    setActiveView(ActiveView.Translate);
  };

  const handleNewSession = () => {
    stopActiveSpeech();
    setSourceText("");
    setPreloadedResult(null);
    setActiveView(ActiveView.Translate);
  };

  const navItems: Array<{ id: ActiveView; label: string }> = [
    { id: ActiveView.Translate, label: "Translate" },
    { id: ActiveView.History, label: "History" },
    { id: ActiveView.Saved, label: "Saved" },
    { id: ActiveView.Languages, label: "Languages" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar: 3-zone contract */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line wordmark */}
          <a
            href="#translate"
            onClick={(e) => {
              e.preventDefault();
              setActiveView(ActiveView.Translate);
            }}
            className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            Verba
          </a>

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto" aria-label="Primary">
            {navItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    active
                      ? "border-blue-600 text-slate-900 dark:text-white"
                      : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleNewSession}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              New translation
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeView === ActiveView.Translate && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Language Translation
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Translate across 45 languages with automatic detection, register control, and spoken audio.
              </p>
            </div>

            <TranslationWorkbench
              sourceText={sourceText}
              onSourceTextChange={(val) => {
                setPreloadedResult(null);
                setSourceText(val);
              }}
              sourceLang={sourceLang}
              onSourceLangChange={handleSourceLangChange}
              targetLang={targetLang}
              onTargetLangChange={handleTargetLangChange}
              tone={tone}
              onToneChange={setTone}
              recentSourceCodes={recentSourceCodes}
              recentTargetCodes={recentTargetCodes}
              isDark={isDark}
              onToggleTheme={() => setIsDark((prev) => !prev)}
              isSaved={isPhraseSaved}
              onToggleSave={handleToggleSave}
              onRecordHistory={handleRecordHistory}
              preloadedResult={preloadedResult}
            />
          </div>
        )}

        {activeView === ActiveView.History && (
          <HistoryView
            history={history}
            onRestore={handleRestoreFromHistory}
            onDeleteEntry={(id) => setHistory((prev) => prev.filter((item) => item.id !== id))}
            onClearAll={() => setHistory([])}
          />
        )}

        {activeView === ActiveView.Saved && (
          <SavedView
            phrases={savedPhrases}
            onRestore={handleRestoreFromSaved}
            onRemove={(id) => setSavedPhrases((prev) => prev.filter((item) => item.id !== id))}
          />
        )}

        {activeView === ActiveView.Languages && (
          <LanguagesDirectory
            sourceLang={sourceLang}
            targetLang={targetLang}
            onSelectSource={(code) => {
              handleSourceLangChange(code);
              setActiveView(ActiveView.Translate);
            }}
            onSelectTarget={(code) => {
              handleTargetLangChange(code);
              setActiveView(ActiveView.Translate);
            }}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>Verba Translation Studio</span>
          <div className="flex items-center gap-4 tabular-nums">
            <span>{history.length} recent</span>
            <span aria-hidden="true">·</span>
            <span>{savedPhrases.length} saved</span>
            <span aria-hidden="true">·</span>
            <span>Shortcut: Cmd/Ctrl + Enter to translate</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
