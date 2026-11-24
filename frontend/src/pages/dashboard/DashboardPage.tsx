import { useState } from "react";
import { logout } from "../../features/auth/api";
import { useDroneLive } from "../../features/live/useDroneLive";
import DroneTelemetryPanel from "../../components/dashboard/DroneTelemetryPanel";
import LiveViewPanel from "../../components/dashboard/LiveViewPanel";
import "./DashboardPage.css";

// The demo replay (backend/app/demo/csv_importer.py) streams its mission as drone 2.
const DEMO_DRONE_ID = 2;

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function DashboardPage({ onLogout }: { onLogout: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const live = useDroneLive(DEMO_DRONE_ID);

  async function handleLogout() {
    setBusy(true);
    setMessage("");
    try { await logout(); onLogout(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not log out."); }
    finally { setBusy(false); }
  }

  const online = live.connection === "connected";
  const clock = new Date(live.now);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>Control Station - Dashboard</h1>
        <div className="dashboard-status">
          <span className={`system-status ${online ? "is-online" : "is-offline"}`} role="status">
            <span className="status-dot" aria-hidden="true" />
            {online ? "Systems Online" : live.connectionMessage}
          </span>
          <span className="dashboard-divider" aria-hidden="true" />
          <time className="dashboard-clock" dateTime={clock.toISOString()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
            {dateFormat.format(clock)}&nbsp; {timeFormat.format(clock)}
          </time>
          <button type="button" className="logout-button" disabled={busy} onClick={() => void handleLogout()}>
            {busy ? "Logging out…" : "Logout"}
          </button>
        </div>
      </header>

      {message && <p className="dashboard-feedback" role="alert">{message}</p>}

      <main className="dashboard-grid">
        <DroneTelemetryPanel droneId={DEMO_DRONE_ID} live={live} />
        <LiveViewPanel droneId={DEMO_DRONE_ID} live={live} />
      </main>
    </div>
  );
}
