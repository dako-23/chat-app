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
    <div className={`layout ${mobileView === "chat" ? "show-chat" : ""}`}>
      <Sidebar
        profile={profile}
        activeId={activeConv?.conversation_id}
        onOpen={openConv}
        onLogout={onLogout}
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
