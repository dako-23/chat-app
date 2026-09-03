import React, { useState, useRef, useEffect } from "react";
import VoiceRecorder from "./VoiceRecorder.jsx";

const EMOJI_LIST =
  "😀 😂 🥹 😍 😘 😎 🤔 😐 😴 😭 😡 🥳 😇 🤗 😅 👍 👎 👌 🙏 👏 💪 🔥 ❤️ 💔 🎉 ✅ ❌ 💯 👀 🙈 🤝 ☕ 🍺 🌹 ⭐".split(
    " "
  );

// Компресиране на изображение преди качване
async function compress(file, maxDim = 1600, quality = 0.82) {
  if (!file.type.startsWith("image/")) return file;
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const r = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * r);
    height = Math.round(height * r);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);
  const blob = await new Promise((res) =>
    canvas.toBlob(res, "image/jpeg", quality)
  );
  URL.revokeObjectURL(img.src);
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
  });
}

export default function Composer({ replyTo, onCancelReply, onSend, onTyping }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recordingMode, setRecordingMode] = useState(false);
  const typingTimer = useRef(null);
  const isTyping = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    return () => preview && URL.revokeObjectURL(preview);
  }, [preview]);

  const fireTyping = () => {
    if (!isTyping.current) {
      isTyping.current = true;
      onTyping(true);
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      onTyping(false);
    }, 1500);
  };

  const pickFile = async (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    const compressed = await compress(f);
    setFile(compressed);
    setPreview(URL.createObjectURL(compressed));
  };

  const submit = () => {
    if (!text.trim() && !file) return;
    onSend({ text: text.trim() || null, file });
    setText("");
    setFile(null);
    setPreview(null);
    setShowEmoji(false);
    isTyping.current = false;
    onTyping(false);
    inputRef.current?.focus();
  };

  const addEmoji = (e) => {
    setText((t) => t + e);
    inputRef.current?.focus();
  };

  const handleRecorded = (blob) => {
    setRecordingMode(false);
    onSend({ audioBlob: blob });
  };

  return (
    <div
      className={`composer-wrap ${drag ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        pickFile(e.dataTransfer.files[0]);
      }}
    >
      {replyTo && (
        <div className="reply-banner">
          <div>
            <span className="rb-label">Отговор на</span>
            <span className="rb-text">
              {replyTo.body || (replyTo.image_url ? "📷 Снимка" : "")}
            </span>
          </div>
          <button onClick={onCancelReply}>✕</button>
        </div>
      )}

      {preview && (
        <div className="img-preview">
          <img src={preview} alt="" />
          <button
            onClick={() => {
              setFile(null);
              setPreview(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {recordingMode ? (
        <VoiceRecorder
          onRecorded={handleRecorded}
          onCancel={() => setRecordingMode(false)}
        />
      ) : (
        <div className="composer">
          {showEmoji && (
            <div className="emoji-menu">
              {EMOJI_LIST.map((e) => (
                <button key={e} onClick={() => addEmoji(e)}>
                  {e}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="emoji-btn"
            onClick={() => setShowEmoji((s) => !s)}
            aria-label="Емотикони"
          >
            😊
          </button>
          <label className="attach-btn">
            📎
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pickFile(e.target.files[0])}
            />
          </label>
          <input
            ref={inputRef}
            className="msg-input"
            value={text}
            placeholder="Съобщение…"
            onChange={(e) => {
              setText(e.target.value);
              fireTyping();
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {text.trim() || file ? (
            <button
              className="send-btn"
              onClick={submit}
              aria-label="Изпрати"
            >
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
          ) : (
            <button
              className="send-btn mic-btn"
              onClick={() => setRecordingMode(true)}
              aria-label="Гласово съобщение"
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"
                  fill="currentColor"
                />
                <path
                  d="M6 11a6 6 0 0 0 12 0M12 17v4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      )}
      {drag && <div className="drop-hint">Пусни снимката тук</div>}
    </div>
  );
}
