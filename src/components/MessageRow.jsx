import React, { useState, useRef, useEffect } from "react";

const EMOJIS = ["❤️", "😂", "👍", "😮", "😢"];

export default function MessageRow({
  message: m,
  grouped,
  mine,
  reactions,
  profile,
  read,
  allMessages,
  onReply,
  onEdit,
  onDelete,
  onReact,
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body || "");
  const [showPicker, setShowPicker] = useState(false);
  const rowRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setMenu(false);
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const replied = m.reply_to
    ? allMessages.find((x) => x.id === m.reply_to)
    : null;

  // групиране на реакции по емоджи
  const groupedReacts = {};
  for (const r of reactions) {
    groupedReacts[r.emoji] = (groupedReacts[r.emoji] || 0) + 1;
  }

  const saveEdit = async () => {
    if (draft.trim() && draft !== m.body) await onEdit(m.id, draft.trim());
    setEditing(false);
  };

  if (m.deleted) {
    return (
      <div className={`row ${mine ? "mine" : "theirs"} ${grouped ? "grouped" : ""}`}>
        <div className="bubble deleted">Съобщението е изтрито</div>
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      className={`row ${mine ? "mine" : "theirs"} ${grouped ? "grouped" : ""}`}
    >
      <div className="bubble-wrap">
        <div
          className={`bubble ${m._status === "failed" ? "failed" : ""}`}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu(true);
          }}
          onDoubleClick={() => setShowPicker((s) => !s)}
        >
          {replied && (
            <div className="reply-preview">
              <span className="reply-name">
                {replied.sender_id === profile.id ? "Ти" : "Отговор"}
              </span>
              <span className="reply-text">
                {replied.body || (replied.image_url ? "📷 Снимка" : "")}
              </span>
            </div>
          )}

          {m.image_url && m.image_url !== "uploading" && (
            <img
              className="msg-image"
              src={m.image_url}
              alt=""
              onClick={() => window.open(m.image_url, "_blank")}
            />
          )}
          {m.image_url === "uploading" && (
            <div className="img-uploading">Качване…</div>
          )}

          {editing ? (
            <div className="edit-box">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
              />
              <div className="edit-actions">
                <button onClick={() => setEditing(false)}>Отказ</button>
                <button className="save" onClick={saveEdit}>
                  Запази
                </button>
              </div>
            </div>
          ) : (
            m.body && <span className="text">{m.body}</span>
          )}

          <span className="meta">
            {m.edited_at && <span className="edited">ред.</span>}
            <span className="stamp">{time(m.created_at)}</span>
            {mine && !m._temp && (
              <span className={`ticks ${read ? "read" : ""}`}>
                {read ? "✓✓" : "✓"}
              </span>
            )}
            {m._status === "pending" && <span className="ticks">🕓</span>}
            {m._status === "failed" && <span className="failed-mark">!</span>}
          </span>
        </div>

        {/* Бутон за бърза реакция/меню */}
        <button
          className="react-trigger"
          onClick={() => setShowPicker((s) => !s)}
        >
          ⌣
        </button>

        {showPicker && (
          <div className="emoji-picker">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onReact(m.id, e);
                  setShowPicker(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {menu && (
          <div className="ctx-menu">
            <button onClick={() => { onReply(m); setMenu(false); }}>
              Отговори
            </button>
            {m.body && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(m.body);
                  setMenu(false);
                }}
              >
                Копирай
              </button>
            )}
            {mine && m.body && (
              <button onClick={() => { setEditing(true); setMenu(false); }}>
                Редактирай
              </button>
            )}
            <button
              onClick={() => { onDelete(m.id, "me"); setMenu(false); }}
            >
              Изтрий за мен
            </button>
            {mine && (
              <button
                className="danger"
                onClick={() => { onDelete(m.id, "all"); setMenu(false); }}
              >
                Изтрий за всички
              </button>
            )}
          </div>
        )}
      </div>

      {Object.keys(groupedReacts).length > 0 && (
        <div className="reacts">
          {Object.entries(groupedReacts).map(([e, n]) => (
            <button key={e} className="react-chip" onClick={() => onReact(m.id, e)}>
              {e} {n > 1 && n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function time(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
