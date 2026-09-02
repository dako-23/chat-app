import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  fetchMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  fetchReactions,
  markRead,
  fetchReadState,
  getConversation,
  uploadImage,
} from "../lib/api";
import { subscribeMessages, joinPresence } from "../lib/realtime";
import MessageRow from "./MessageRow.jsx";
import Composer from "./Composer.jsx";

const PAGE = 30;

export default function Chat({ profile, conversation, onBack }) {
  const convId = conversation.conversation_id;
  const [meta, setMeta] = useState(conversation);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [readState, setReadState] = useState([]);
  const [online, setOnline] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const streamRef = useRef(null);
  const presenceRef = useRef(null);
  const bottomRef = useRef(true); // дали сме залепени долу

  // Първоначално зареждане
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!meta.other_name) setMeta(await getConversation(convId));
      } catch {}
      const msgs = await fetchMessages(convId, { limit: PAGE });
      if (!alive) return;
      setMessages(msgs);
      setHasMore(msgs.length === PAGE);
      setReactions(await fetchReactions(convId));
      setReadState(await fetchReadState(convId));
      await markRead(convId);
      scrollToBottom(true);
    })();
    return () => {
      alive = false;
    };
  }, [convId]);

  // Realtime абонамент
  useEffect(() => {
    const unsub = subscribeMessages(convId, {
      onInsert: (m) => {
        setMessages((prev) => {
          // премахни optimistic дубликат
          const withoutTemp = prev.filter(
            (x) => !(x._temp && x.body === m.body && x.sender_id === m.sender_id)
          );
          if (withoutTemp.some((x) => x.id === m.id)) return withoutTemp;
          return [...withoutTemp, m];
        });
        if (m.sender_id !== profile.id) markRead(convId);
      },
      onUpdate: (m) =>
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x))),
      onReactionChange: async () => setReactions(await fetchReactions(convId)),
      onReadChange: async () => setReadState(await fetchReadState(convId)),
    });
    return unsub;
  }, [convId, profile.id]);

  // Presence + typing
  useEffect(() => {
    const p = joinPresence(
      convId,
      { id: profile.id, display_name: profile.display_name },
      {
        onOnline: setOnline,
        onTyping: (uid, typing) =>
          setTypingUsers((prev) => ({ ...prev, [uid]: typing })),
      }
    );
    presenceRef.current = p;
    return () => p.leave();
  }, [convId, profile.id, profile.display_name]);

  // Автоскрол при нови съобщения, ако сме долу
  useEffect(() => {
    if (bottomRef.current) scrollToBottom();
  }, [messages]);

  const scrollToBottom = (instant) => {
    const el = streamRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: instant ? "auto" : "smooth" });
    });
  };

  const onScroll = () => {
    const el = streamRef.current;
    if (!el) return;
    bottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && hasMore && !loadingMore) loadOlder();
  };

  const loadOlder = async () => {
    setLoadingMore(true);
    const el = streamRef.current;
    const prevHeight = el.scrollHeight;
    const older = await fetchMessages(convId, {
      before: messages[0]?.created_at,
      limit: PAGE,
    });
    setMessages((prev) => [...older, ...prev]);
    setHasMore(older.length === PAGE);
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - prevHeight;
    });
    setLoadingMore(false);
  };

  // Изпращане с optimistic UI
  const handleSend = async ({ text, file }) => {
    let imageUrl = null;
    const temp = {
      id: `temp-${Date.now()}`,
      _temp: true,
      conversation_id: convId,
      sender_id: profile.id,
      body: text || null,
      image_url: file ? "uploading" : null,
      reply_to: replyTo?.id || null,
      created_at: new Date().toISOString(),
      _status: "pending",
    };
    setMessages((prev) => [...prev, temp]);
    bottomRef.current = true;
    const currentReply = replyTo?.id || null;
    setReplyTo(null);

    try {
      if (file) imageUrl = await uploadImage(convId, file);
      await sendMessage(convId, { text, imageUrl, replyTo: currentReply });
      // realtime INSERT ще замени temp-а
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.id === temp.id ? { ...m, _status: "failed" } : m))
      );
    }
  };

  const handleTyping = (typing) =>
    presenceRef.current?.sendTyping(typing);

  const otherTyping = Object.entries(typingUsers).some(
    ([uid, t]) => t && uid !== profile.id
  );

  const otherOnline = online.some((id) => id !== profile.id);

  // read receipt: последно прочетено от другия
  const otherRead = readState.find((r) => r.user_id !== profile.id);

  const reactionsByMsg = {};
  for (const r of reactions) {
    (reactionsByMsg[r.message_id] ??= []).push(r);
  }

  return (
    <div className="chat-view">
      <header className="chat-head">
        <button className="back-btn" onClick={onBack}>
          ‹
        </button>
        <div className="ch-avatar">{initials(meta.other_name || "?")}</div>
        <div className="ch-info">
          <div className="ch-name">{meta.other_name || "Разговор"}</div>
          <div className="ch-status">
            {otherTyping ? (
              <span className="typing-lbl">пише…</span>
            ) : otherOnline ? (
              <span className="online-lbl">● онлайн</span>
            ) : (
              <span>{lastSeenText(meta.other_last_seen)}</span>
            )}
          </div>
        </div>
        {meta.join_code && (
          <div className="code-chip" title="Код за покана">
            {meta.join_code}
          </div>
        )}
      </header>

      <div className="stream" ref={streamRef} onScroll={onScroll}>
        {loadingMore && <div className="load-more">Зареждане…</div>}
        {!hasMore && messages.length > 0 && (
          <div className="conv-start">Начало на разговора</div>
        )}
        {renderWithDates(messages, {
          profile,
          reactionsByMsg,
          otherRead,
          onReply: setReplyTo,
          onEdit: editMessage,
          onDelete: deleteMessage,
          onReact: toggleReaction,
        })}
        {otherTyping && (
          <div className="typing-bubble">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>

      <Composer
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={handleSend}
        onTyping={handleTyping}
      />
    </div>
  );
}

// Вмъква разделители по дата
function renderWithDates(messages, ctx) {
  const out = [];
  let lastDate = null;
  messages.forEach((m, i) => {
    const d = new Date(m.created_at).toDateString();
    if (d !== lastDate) {
      out.push(
        <div className="date-sep" key={`d-${d}-${i}`}>
          <span>{dateLabel(m.created_at)}</span>
        </div>
      );
      lastDate = d;
    }
    const prev = messages[i - 1];
    const grouped =
      prev &&
      prev.sender_id === m.sender_id &&
      new Date(m.created_at) - new Date(prev.created_at) < 5 * 60000 &&
      new Date(prev.created_at).toDateString() === d;
    out.push(
      <MessageRow
        key={m.id}
        message={m}
        grouped={grouped}
        mine={m.sender_id === ctx.profile.id}
        reactions={ctx.reactionsByMsg[m.id] || []}
        profile={ctx.profile}
        read={
          ctx.otherRead &&
          new Date(ctx.otherRead.last_read_at) >= new Date(m.created_at)
        }
        allMessages={messages}
        onReply={ctx.onReply}
        onEdit={ctx.onEdit}
        onDelete={ctx.onDelete}
        onReact={ctx.onReact}
      />
    );
  });
  return out;
}

function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function dateLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Днес";
  if (d.toDateString() === yest.toDateString()) return "Вчера";
  return d.toLocaleDateString("bg-BG", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function lastSeenText(iso) {
  if (!iso) return "офлайн";
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "онлайн наскоро";
  if (diff < 60) return `видян преди ${Math.floor(diff)} мин`;
  if (diff < 1440) return `видян преди ${Math.floor(diff / 60)} ч`;
  return `видян ${new Date(iso).toLocaleDateString("bg-BG")}`;
}
