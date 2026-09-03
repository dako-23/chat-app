import React, { useState, useRef, useEffect } from "react";

// Записва глас чрез микрофона. onRecorded(blob) при готово.
export default function VoiceRecorder({ onRecorded, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Избор на съвместим формат
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mime || "audio/webm",
        });
        stopTracks();
        onRecorded(blob);
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      setError("Няма достъп до микрофона.");
    }
  };

  const stop = () => {
    if (mediaRef.current && recording) {
      mediaRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const cancel = () => {
    if (mediaRef.current && recording) {
      mediaRef.current.onstop = null;
      mediaRef.current.stop();
    }
    stopTracks();
    clearInterval(timerRef.current);
    setRecording(false);
    onCancel();
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  // Стартирай веднага при показване
  useEffect(() => {
    start();
    return () => {
      clearInterval(timerRef.current);
      stopTracks();
    };
    // eslint-disable-next-line
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (error) {
    return (
      <div className="voice-rec error">
        <span>{error}</span>
        <button onClick={onCancel}>✕</button>
      </div>
    );
  }

  return (
    <div className="voice-rec">
      <button className="vr-cancel" onClick={cancel} title="Откажи">
        ✕
      </button>
      <span className="vr-pulse" />
      <span className="vr-time">
        {mm}:{ss}
      </span>
      <span className="vr-label">Записване…</span>
      <button className="vr-send" onClick={stop} title="Спри и изпрати">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path
            d="M4 12l16-8-6 8 6 8z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
