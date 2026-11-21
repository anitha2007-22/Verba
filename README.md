# Verba — Language Translation Studio

**Live Demo:** [https://verba-ztkt.onrender.com/](https://verba-ztkt.onrender.com/)

Verba is a full-stack multilingual language translation web application built with **React**, **TypeScript**, **Tailwind CSS**, **Express**, and the **Google GenAI SDK (`@google/genai`)**. It provides fast, context-aware translations across 45 languages with automatic source language detection, tone adaptation, phonetic transliteration, text-to-speech playback, and a persistent phrasebook.

---

## Features

- **Dual-Pane Translation Workbench**
  - Translate up to 5,000 characters per request with live character count and `Cmd/Ctrl + Enter` shortcut.
  - **Auto-Translate** mode (debounced typing) or manual **Translate** trigger.
  - **45 Supported Languages** plus **Auto-Detect** with searchable dropdowns, quick-access recent language tabs, and one-click **Swap Languages**.
  - Proper **RTL** text direction support for Arabic, Hebrew, Persian, and Urdu.
- **Tone & Register Control**
  - Switch between **Standard**, **Formal**, **Casual**, and **Concise** translation styles.
- **Transliteration & Alternative Phrasings**
  - Displays romanization/phonetic readings for non-Latin scripts (Japanese, Chinese, Korean, Arabic, Russian, Hindi, etc.).
  - Surfaces up to 3 alternative translations with register/nuance notes.
- **Usability & Audio**
  - **One-Click Copy** for source text, translated output, and alternative phrasings.
  - **Text-to-Speech (Listen)** on both source and translated panes via `/api/tts` with automatic browser `SpeechSynthesis` fallback.
- **History, Saved Phrasebook & Languages Directory**
  - Locally persisted translation history with search, copy, and one-click restore.
  - Bookmark favorite translations into a **Saved Phrasebook** with audio playback and **CSV export**.
  - Browse all supported languages in the **Languages** directory and toggle between **Light** and **Dark** themes.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **Backend:** Node.js 22+, Express, `@google/genai` (`gemini-3.1-flash-lite` for translation, `gemini-3.8-flash-lite-tts` for speech)

---

## Project Structure

```text
├── server.ts                  # Express server, Gemini API routes (/api/translate, /api/tts, /api/health)
├── index.html                 # HTML entry point and Google Fonts
├── src/
│   ├── App.tsx                # Application shell, navigation, theme, localStorage persistence
│   ├── index.css              # Tailwind CSS v4 setup and theme tokens
│   ├── components/
│   │   ├── TranslationWorkbench.tsx
│   │   ├── LanguageSelector.tsx
│   │   ├── HistoryView.tsx
│   │   ├── SavedView.tsx
│   │   └── LanguagesDirectory.tsx
│   ├── data/languages.ts      # 45 supported languages and sample phrases
│   ├── types/translation.ts   # TypeScript interfaces and enums
│   └── utils/speech.ts        # Audio playback with Web Speech API fallback
└── package.json
```

---

## Local Development

### Prerequisites
- **Node.js** `>= 22.18.0`
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey)

### Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the project root (based on `.env.example`):
   ```env
   GEMINI_API_KEY="your_gemini_api_key"
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Deployment (Render)

| Setting | Value |
| :--- | :--- |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |
| **Environment Variables** | `GEMINI_API_KEY`, `NODE_ENV=production`, `NODE_VERSION=22` |

---

## API Endpoints

- `GET /api/health` — Returns `{ "status": "ok" }` for service health checks.
- `POST /api/translate` — Translates text with source language detection, tone guidance, transliteration, and alternatives.
- `POST /api/tts` — Synthesizes spoken audio (`audio/wav`) for source or translated text, with client fallback to browser speech synthesis.
