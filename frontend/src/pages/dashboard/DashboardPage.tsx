import { useState } from "react";
import { logout } from "../../features/auth/api";
import "./DashboardPage.css";

export default function DashboardPage({ onLogout }: {
  onLogout: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogout() {
    setBusy(true);
    setMessage("");
    try { await logout(); onLogout(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not log out."); }
    finally { setBusy(false); }
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-actions">
        <button type="button" disabled={busy} onClick={() => void handleLogout()}>
          {busy ? "Logging out…" : "Logout"}
        </button>
        {message && <p className="dashboard-feedback" role="alert">{message}</p>}
      </div>
      <h1>Dashboard</h1>
    </main>
  );
}
