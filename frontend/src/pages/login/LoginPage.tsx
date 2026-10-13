import { useState } from "react";
import type { FormEvent } from "react";
import FarmScene from "../../components/farm/FarmScene";
import { login } from "../../features/auth/api";
import type { Operator } from "../../features/auth/api";
import "./LoginPage.css";

export default function LoginPage({ onLogin, sessionError }: {
  onLogin: (operator: Operator) => void;
  sessionError: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(sessionError);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage("");
    try {
      const account = await login(String(data.get("username") ?? "").trim(), String(data.get("password") ?? ""));
      form.reset();
      onLogin(account);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="farm-background" aria-hidden="true"><FarmScene /></div>
      <header className="login-brand">TEAM 21 <span aria-hidden="true">✦</span> CONTROL STATION</header>
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Operator Login</h1>
            <form onSubmit={handleLogin}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                minLength={3}
                maxLength={32}
                required
                disabled={busy}
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
                disabled={busy}
              />

              <button type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
        <p className="login-feedback" role="status">{message}</p>
      </section>
    </main>
  );
}
