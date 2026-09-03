import React, { useState, useRef, useEffect } from "react";

// Статична псевдо-вълна (декоративна) + реален прогрес.
const BARS = [
  6, 10, 14, 8, 18, 22, 16, 10, 20, 26, 18, 12, 8, 14, 20, 24, 16, 10, 6, 12,
  18, 14, 8, 16, 22, 12, 8, 6,
];

export default function VoicePlayer({ src, mine }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      if (a.duration && isFinite(a.duration))
        setProgress(a.currentTime / a.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onMeta = () => {
      if (isFinite(a.duration)) setDuration(a.duration);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play();
      setPlaying(true);
    }
  };

  const activeBars = Math.round(progress * BARS.length);
  const total = duration || 0;
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(Math.floor(total % 60)).padStart(2, "0");

  return (
    <div className={`voice-player ${mine ? "vp-mine" : ""}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button className="vp-play" onClick={toggle}>
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="vp-wave">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={i < activeBars ? "on" : ""}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <span className="vp-time">
        {total ? `${mm}:${ss}` : "🎤"}
      </span>
    </div>
  );
}
