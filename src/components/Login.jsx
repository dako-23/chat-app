import React, { useState } from "react";
import { register, login } from "../lib/auth";

export default function Login({ onLoggedIn }) {
  const [mode, setMode] = useState("register"); // 'register' | 'login'
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [creds, setCreds] = useState(null); // {username, password} след регистрация
  const [copied, setCopied] = useState(false);

  const doRegister = async () => {
    setErr("");
    setBusy(true);
    try {
      const c = await register(name);
      setCreds(c);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    setErr("");
    setBusy(true);
    try {
      await login(name, password);
      onLoggedIn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyCreds = () => {
    navigator.clipboard.writeText(
      `Име: ${name}\nПарола: ${creds.password}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Екран след успешна регистрация — показва паролата
  if (creds) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="brand">
            <span className="brand-dot a" />
            <span className="brand-dot b" />
          </div>
          <h1>Готово, {name}</h1>
          <p className="sub">
            Запази тези данни — с тях влизаш следващия път.
          </p>
          <div className="cred-box">
            <div>
              <span className="cred-label">Име</span>
              <span className="cred-val">{name}</span>
            </div>
            <div>
              <span className="cred-label">Парола</span>
              <span className="cred-val mono">{creds.password}</span>
            </div>
          </div>
          <button className="ghost" onClick={copyCreds}>
            {copied ? "Копирано ✓" : "Копирай данните"}
          </button>
          <button className="primary" onClick={onLoggedIn}>
            Продължи към чата
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <span className="brand-dot a" />
          <span className="brand-dot b" />
        </div>
        <h1>{mode === "register" ? "Създай профил" : "Влез отново"}</h1>
        <p className="sub">
          {mode === "register"
            ? "Само име. Ще ти дадем парола за следващия път."
            : "Въведи името и паролата, която запази."}
        </p>

        <input
          autoFocus
          value={name}
          maxLength={24}
          placeholder="Твоето име"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            (mode === "register" ? doRegister() : doLogin())
          }
        />
        {mode === "login" && (
          <input
            type="text"
            value={password}
            placeholder="Парола"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
          />
        )}

        {err && <div className="error">{err}</div>}

        <button
          className="primary"
          disabled={busy || !name.trim() || (mode === "login" && !password)}
          onClick={mode === "register" ? doRegister : doLogin}
        >
          {busy ? "Момент…" : mode === "register" ? "Създай и влез" : "Влез"}
        </button>

        <button
          className="switch"
          onClick={() => {
            setMode(mode === "register" ? "login" : "register");
            setErr("");
          }}
        >
          {mode === "register"
            ? "Вече имаш профил? Влез"
            : "Нямаш профил? Създай"}
        </button>
      </div>
    </div>
  );
}
