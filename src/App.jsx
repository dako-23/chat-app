import React, { useEffect, useState } from "react";
import { getSession, logout } from "./lib/auth";
import { myProfile } from "./lib/api";
import { startHeartbeat } from "./lib/realtime";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Chat from "./components/Chat.jsx";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState(null);
  const [mobileView, setMobileView] = useState("list"); // 'list' | 'chat'
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

  if (loading)
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );

  if (!profile) return <Login onLoggedIn={onLoggedIn} />;

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
