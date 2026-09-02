import React, { useEffect, useState, useCallback } from "react";
import {
  listConversations,
  searchUsers,
  openDirect,
  joinByCode,
} from "../lib/api";

export default function Sidebar({ profile, activeId, onOpen, onLogout }) {
  const [convs, setConvs] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      setConvs(await listConversations());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setResults(await searchUsers(term));
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const startWith = async (userId) => {
    try {
      const convId = await openDirect(userId);
      setShowNew(false);
      setTerm("");
      setResults([]);
      await refresh();
      onOpen({ conversation_id: convId });
    } catch (e) {
      setErr(e.message);
    }
  };

  const doJoin = async () => {
    setErr("");
    try {
      const convId = await joinByCode(code);
      setShowNew(false);
      setCode("");
      await refresh();
      onOpen({ conversation_id: convId });
    } catch (e) {
      setErr("Невалиден код.");
    }
  };

  return (
    <aside className="sidebar">
      <div className="side-head">
        <div className="my-id">
          <div className="avatar">{initials(profile.display_name)}</div>
          <div>
            <div className="my-name">{profile.display_name}</div>
            <div className="my-handle">@{profile.username}</div>
          </div>
        </div>
        <button className="icon-btn" onClick={onLogout} title="Изход">
          ⎋
        </button>
      </div>

      <button className="new-btn" onClick={() => setShowNew((s) => !s)}>
        {showNew ? "Затвори" : "+ Нов разговор"}
      </button>

      {showNew && (
        <div className="new-panel">
          <input
            placeholder="Търси по име…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoFocus
          />
          {results.map((u) => (
            <button key={u.id} className="result" onClick={() => startWith(u.id)}>
              <div className="avatar sm">{initials(u.display_name)}</div>
              <div>
                <div className="r-name">{u.display_name}</div>
                <div className="r-handle">@{u.username}</div>
              </div>
            </button>
          ))}
          <div className="divider">или по код</div>
          <div className="code-row">
            <input
              placeholder="Код на разговор"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
            <button onClick={doJoin} disabled={!code.trim()}>
              Влез
            </button>
          </div>
          {err && <div className="error sm">{err}</div>}
        </div>
      )}

      <div className="conv-list">
        {convs.length === 0 && (
          <div className="side-empty">Още нямаш разговори.</div>
        )}
        {convs.map((c) => (
          <button
            key={c.conversation_id}
            className={`conv-item ${
              c.conversation_id === activeId ? "active" : ""
            }`}
            onClick={() => onOpen(c)}
          >
            <div className="avatar">{initials(c.other_name || "?")}</div>
            <div className="conv-mid">
              <div className="conv-top">
                <span className="conv-name">{c.other_name || "Разговор"}</span>
                {c.last_message_at && (
                  <span className="conv-time">
                    {shortTime(c.last_message_at)}
                  </span>
                )}
              </div>
              <div className="conv-preview">
                {c.last_body || (c.last_image ? "📷 Снимка" : "…")}
              </div>
            </div>
            {c.unread > 0 && <span className="badge">{c.unread}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}

function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function shortTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}
