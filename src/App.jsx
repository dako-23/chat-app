import React, { useEffect, useState, useRef } from "react";
import { getSession, logout } from "./lib/auth";
import { myProfile, totalUnread } from "./lib/api";
import { startHeartbeat } from "./lib/realtime";
import { supabase } from "./lib/supabase";
import { setUnreadTitle, playPing } from "./lib/notify";
import Login from "./components/Login.jsx";
import Surprise from "./components/Surprise.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Chat from "./components/Chat.jsx";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState(null);
  const [mobileView, setMobileView] = useState("list"); // 'list' | 'chat'
  const [surprise, setSurprise] = useState(() => {
    const p = new URLSearchParams(window.location.search).get("surprise");
    return p ? p.toLowerCase() : null;
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem("sidebarWidth"));
    return saved >= 240 && saved <= 560 ? saved : 330;
  });
  const dragging = useState(false);

  // Влачене на границата между сайдбар и чат
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging[0]) return;
      const w = Math.min(560, Math.max(240, e.clientX));
      setSidebarWidth(w);
    };
    const onUp = () => {
      if (dragging[0]) {
        dragging[1](false);
        localStorage.setItem("sidebarWidth", String(sidebarWidth));
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, sidebarWidth]);

  const startDrag = () => {
    dragging[1](true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (s) setProfile(await myProfile());
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!profile) return;
    const stop = startHeartbeat(profile.id);
    return stop;
  }, [profile]);

  // Брояч непрочетени в заглавието на таба + звук при ново съобщение
  const lastCountRef = useRef(0);
  useEffect(() => {
    if (!profile) {
      setUnreadTitle(0);
      return;
    }

    const refreshCount = async () => {
      const n = await totalUnread();
      setUnreadTitle(n);
      lastCountRef.current = n;
    };
    refreshCount();
    const poll = setInterval(refreshCount, 4000);

    // Realtime: звук при ново съобщение от друг, когато табът не е активен
    const channel = supabase
      .channel("global-msg-notify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new;
          if (m.sender_id === profile.id) return; // мое съобщение
          // звук само ако не гледам активно
          if (document.hidden) playPing();
          refreshCount();
        }
      )
      .subscribe();

    // Изчистване при връщане на таба
    const onVisible = () => {
      if (!document.hidden) setTimeout(refreshCount, 500);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [profile]);

  const onLoggedIn = async () => setProfile(await myProfile());
  const onLogout = async () => {
    await logout();
    setProfile(null);
    setActiveConv(null);
  };

  const openConv = (conv) => {
    setActiveConv(conv);
    setMobileView("chat");
  };

  const exitSurprise = () => {
    // Махаме параметъра от URL-а и показваме нормалния вход
    window.history.replaceState({}, "", window.location.pathname);
    setSurprise(null);
  };

  if (loading)
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );

  if (!profile) {
    if (surprise === "elena") {
      return <Surprise onExit={exitSurprise} onLoggedIn={onLoggedIn} />;
    }
    return <Login onLoggedIn={onLoggedIn} />;
  }

  return (
    <div
      className={`layout ${mobileView === "chat" ? "show-chat" : ""}`}
      style={{ gridTemplateColumns: `${sidebarWidth}px 6px 1fr` }}
    >
      <Sidebar
        profile={profile}
        activeId={activeConv?.conversation_id}
        onOpen={openConv}
        onLogout={onLogout}
      />
      <div
        className="resizer"
        onMouseDown={startDrag}
        title="Влачи за да промениш ширината"
      />
      <main className="main-panel">
        {activeConv ? (
          <Chat
            key={activeConv.conversation_id}
            profile={profile}
            conversation={activeConv}
            onBack={() => setMobileView("list")}
          />
        ) : (
          <div className="empty-main">
            <div>
              <div className="empty-emoji">💬</div>
              <p>Избери разговор или започни нов.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
