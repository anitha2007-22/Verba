import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Copy, Download, Loader2, Search, Square, Trash2, Volume2 } from "lucide-react";
import { findLanguageByCode } from "../data/languages";
import type { SavedPhrase } from "../types/translation";
import { playTextToSpeech, stopActiveSpeech } from "../utils/speech";

interface SavedViewProps {
  phrases: SavedPhrase[];
  onRestore: (phrase: SavedPhrase) => void;
  onRemove: (id: string) => void;
}

export function SavedView({ phrases, onRestore, onRemove }: SavedViewProps) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return phrases;
    return phrases.filter(
      (item) =>
        item.sourceText.toLowerCase().includes(q) ||
        item.translatedText.toLowerCase().includes(q) ||
        item.sourceLangName.toLowerCase().includes(q) ||
        item.targetLangName.toLowerCase().includes(q)
    );
  }, [phrases, query]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSpeak = async (phrase: SavedPhrase) => {
    if (playingId === phrase.id || loadingAudioId === phrase.id) {
      stopActiveSpeech();
      setPlayingId(null);
      setLoadingAudioId(null);
      return;
    }

    const targetLang = findLanguageByCode(phrase.targetLang);
    setLoadingAudioId(phrase.id);

    await playTextToSpeech({
      text: phrase.translatedText,
      languageName: phrase.targetLangName,
      speechLang: targetLang?.speechLang ?? "en-US",
      slot: phrase.id,
      onStartPlaying: () => {
        setLoadingAudioId(null);
        setPlayingId(phrase.id);
      },
      onEnd: () => {
        setLoadingAudioId(null);
        setPlayingId(null);
      },
      onError: () => {
        setLoadingAudioId(null);
        setPlayingId(null);
      },
    });
  };

  const handleExportCsv = () => {
    if (phrases.length === 0) return;
    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const header = ["Source Language", "Target Language", "Source Text", "Translated Text", "Transliteration"];
    const rows = phrases.map((p) => [
      escape(p.sourceLangName),
      escape(p.targetLangName),
      escape(p.sourceText),
      escape(p.translatedText),
      escape(p.transliteration ?? ""),
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "verba-phrasebook.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-5" aria-label="Saved phrasebook">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Saved Phrasebook
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Bookmarked translations ready for quick reference and audio playback.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search saved phrases..."
              aria-label="Search saved phrases"
              className="pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {phrases.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {phrases.length === 0 ? "No saved phrases yet" : "No matching phrases found"}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {phrases.length === 0
              ? "Click Save on any translation in the workbench to bookmark it here."
              : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
          {filtered.map((phrase) => (
            <div
              key={phrase.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {phrase.sourceLangName} → {phrase.targetLangName}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <p className="text-slate-600 dark:text-slate-400 break-words">
                    {phrase.sourceText}
                  </p>
                  <div className="space-y-1">
                    <p className="text-slate-900 dark:text-slate-100 font-medium break-words">
                      {phrase.translatedText}
                    </p>
                    {phrase.transliteration && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {phrase.transliteration}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleSpeak(phrase)}
                  aria-label="Listen to saved translation"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  {loadingAudioId === phrase.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : playingId === phrase.id ? (
                    <Square className="w-3.5 h-3.5 fill-current text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  <span>{playingId === phrase.id ? "Stop" : "Listen"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onRestore(phrase)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors whitespace-nowrap"
                >
                  <span>Open</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopy(phrase.id, phrase.translatedText)}
                  aria-label="Copy saved translation"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  {copiedId === phrase.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedId === phrase.id ? "Copied" : "Copy"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onRemove(phrase.id)}
                  aria-label="Remove saved phrase"
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
