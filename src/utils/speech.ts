export type SpeechSlot = "source" | "target" | string;

interface ActivePlayback {
  slot: SpeechSlot;
  audio: HTMLAudioElement | null;
  utterance: SpeechSynthesisUtterance | null;
}

let activePlayback: ActivePlayback | null = null;
const audioCache = new Map<string, string>();

export function stopActiveSpeech(): void {
  if (activePlayback?.audio) {
    activePlayback.audio.pause();
    activePlayback.audio.currentTime = 0;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  activePlayback = null;
}

function speakWithBrowserSynthesis(
  text: string,
  speechLang: string,
  slot: SpeechSlot,
  onEnd: () => void,
  onError: (msg: string) => void
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onError("Speech playback is unavailable in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLang;
  utterance.rate = 0.96;
  utterance.onend = () => {
    activePlayback = null;
    onEnd();
  };
  utterance.onerror = () => {
    activePlayback = null;
    onEnd();
  };
  activePlayback = { slot, audio: null, utterance };
  window.speechSynthesis.speak(utterance);
}

export async function playTextToSpeech(params: {
  text: string;
  languageName: string;
  speechLang: string;
  slot: SpeechSlot;
  onStartPlaying: () => void;
  onEnd: () => void;
  onError: (message: string) => void;
}): Promise<void> {
  const { text, languageName, speechLang, slot, onStartPlaying, onEnd, onError } = params;
  const trimmed = text.trim();
  if (!trimmed) return;

  stopActiveSpeech();

  const cacheKey = `${languageName}::${trimmed.slice(0, 1500)}`;

  try {
    let dataUrl = audioCache.get(cacheKey);
    if (!dataUrl) {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          languageName,
        }),
      });

      if (!res.ok) {
        throw new Error("Server TTS unavailable");
      }

      const data = (await res.json()) as { audioBase64?: string; mimeType?: string; fallback?: boolean };
      if (data.fallback || !data.audioBase64) {
        throw new Error("Fallback to browser speech");
      }
      dataUrl = `data:${data.mimeType ?? "audio/wav"};base64,${data.audioBase64}`;
      if (audioCache.size > 30) {
        const firstKey = audioCache.keys().next().value;
        if (firstKey) audioCache.delete(firstKey);
      }
      audioCache.set(cacheKey, dataUrl);
    }

    const audio = new Audio(dataUrl);
    activePlayback = { slot, audio, utterance: null };
    audio.onended = () => {
      activePlayback = null;
      onEnd();
    };
    audio.onerror = () => {
      activePlayback = null;
      speakWithBrowserSynthesis(trimmed, speechLang, slot, onEnd, onError);
    };
    onStartPlaying();
    await audio.play();
  } catch {
    onStartPlaying();
    speakWithBrowserSynthesis(trimmed, speechLang, slot, onEnd, onError);
  }
}
