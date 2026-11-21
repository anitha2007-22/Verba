import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { LANGUAGES } from "../data/languages";

interface LanguagesDirectoryProps {
  sourceLang: string;
  targetLang: string;
  onSelectSource: (code: string) => void;
  onSelectTarget: (code: string) => void;
}

export function LanguagesDirectory({
  sourceLang,
  targetLang,
  onSelectSource,
  onSelectTarget,
}: LanguagesDirectoryProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (lang) =>
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q) ||
        lang.region.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <section className="space-y-5" aria-label="Supported languages directory">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Supported Languages
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {LANGUAGES.length} languages with bidirectional translation, transliteration, and audio pronunciation.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search language or region..."
            aria-label="Search supported languages"
            className="pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Native Script</th>
                <th className="py-3 px-4">Region</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {filtered.map((lang) => {
                const isSource = sourceLang === lang.code;
                const isTarget = targetLang === lang.code;
                return (
                  <tr
                    key={lang.code}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {lang.name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      {lang.nativeName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                      {lang.region}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {lang.code}
                      {lang.rtl ? " · RTL" : ""}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectSource(lang.code)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          isSource
                            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {isSource ? "Current source" : "Set source"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectTarget(lang.code)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          isTarget
                            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                            : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        }`}
                      >
                        {isTarget ? "Current target" : "Set target"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
