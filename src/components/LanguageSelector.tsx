import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { AUTO_DETECT_LANGUAGE, LANGUAGES } from "../data/languages";
import type { Language } from "../types/translation";

interface LanguageSelectorProps {
  value: string;
  onChange: (code: string) => void;
  allowAuto?: boolean;
  detectedLabel?: string;
  quickCodes: string[];
  align?: "left" | "right";
  ariaLabel: string;
}

export function LanguageSelector({
  value,
  onChange,
  allowAuto = false,
  detectedLabel,
  quickCodes,
  align = "left",
  ariaLabel,
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    } else {
      setQuery("");
    }
  }, [open]);

  const allOptions = useMemo<Language[]>(() => {
    return allowAuto ? [AUTO_DETECT_LANGUAGE, ...LANGUAGES] : LANGUAGES;
  }, [allowAuto]);

  const selectedLanguage = useMemo(() => {
    return allOptions.find((l) => l.code === value) ?? allOptions[0];
  }, [allOptions, value]);

  const filteredLanguages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter(
      (lang) =>
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q) ||
        lang.region.toLowerCase().includes(q)
    );
  }, [allOptions, query]);

  const quickTabs = useMemo(() => {
    const base = allowAuto ? ["auto", ...quickCodes] : quickCodes;
    const unique = Array.from(new Set(base)).slice(0, 3);
    if (!unique.includes(value) && value) {
      unique[unique.length - 1] = value;
    }
    return unique
      .map((code) => allOptions.find((l) => l.code === code))
      .filter((l): l is Language => Boolean(l));
  }, [allowAuto, quickCodes, value, allOptions]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-1 min-w-0">
      {/* Quick language tabs (desktop) */}
      <div className="hidden sm:flex items-center gap-1 min-w-0" role="tablist" aria-label={ariaLabel}>
        {quickTabs.map((lang) => {
          const isActive = lang.code === value;
          const displayLabel =
            lang.code === "auto" && detectedLabel && isActive
              ? `Auto · ${detectedLabel}`
              : lang.name;

          return (
            <button
              key={lang.code}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(lang.code)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 max-w-[170px] truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>

      {/* Mobile current selection + Desktop "All languages" dropdown trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${ariaLabel}: ${selectedLanguage.name}`}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <span className="sm:hidden truncate max-w-[140px]">
          {selectedLanguage.code === "auto" && detectedLabel
            ? `Auto · ${detectedLabel}`
            : selectedLanguage.name}
        </span>
        <span className="hidden sm:inline text-slate-500 dark:text-slate-400 text-xs">
          More
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 z-30 w-[min(92vw,420px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="dialog"
          aria-label={`Select ${ariaLabel}`}
        >
          <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search language or native script..."
              className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none py-1"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear language search"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div
            className="max-h-72 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-0.5"
            role="listbox"
          >
            {filteredLanguages.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No matching languages found.
              </div>
            ) : (
              filteredLanguages.map((lang) => {
                const isSelected = lang.code === value;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(lang.code);
                      setOpen(false);
                    }}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-left rounded-lg text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate">{lang.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {lang.nativeName}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
