import type { ReactNode } from "react";
import type { DroneLive } from "../../features/live/useDroneLive";
import { STALE_TELEMETRY_SECONDS } from "../../features/live/useDroneLive";
import { batteryTone, fixed, magnitude, stateLabel, stateTone } from "./format";

function Row({ label, children, tone }: { label: string; children: ReactNode; tone?: string }) {
  return (
    <div className="tm-row">
      <dt>{label}</dt>
      <dd className={tone ? `tone-${tone}` : undefined}>{children}</dd>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="tm-card">
      <h3>
        <span className="tm-icon" aria-hidden="true">{icon}</span>
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

const icons = {
  battery: (
    <svg viewBox="0 0 24 24"><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" /></svg>
  ),
  position: (
    <svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
  ),
  motion: (
    <svg viewBox="0 0 24 24"><path d="M3 11 21 3l-8 18-2-8-8-2Z" /></svg>
  ),
  comm: (
    <svg viewBox="0 0 24 24"><path d="M4 20v-3M9 20v-7M14 20V9M19 20V5" /></svg>
  ),
};

export default function DroneTelemetryPanel({ droneId, live }: { droneId: number; live: DroneLive }) {
  const { telemetry: t, mission, connection, telemetryAgeSeconds } = live;

  const soc = t?.battery_soc_percent ?? null;
  const horizontalDistance = magnitude(t?.pos_x_m, t?.pos_z_m);
  const acceleration = magnitude(t?.acc_x_mps2, t?.acc_y_mps2, t?.acc_z_mps2);
  const stale = telemetryAgeSeconds !== null && telemetryAgeSeconds > STALE_TELEMETRY_SECONDS;

  const linkUp = t?.comm_status === "connected";

  return (
    <section className="panel telemetry-panel" aria-labelledby="telemetry-title">
      <header className="panel-header">
        <h2 id="telemetry-title">
          Drone Telemetry <span className="panel-subtitle">Drone {droneId}</span>
        </h2>
        <span className={`badge badge-${t ? stateTone(t.state) : "idle"}`}>{stateLabel(t?.state)}</span>
      </header>

      <div className="tm-grid">
        <Card title="Battery" icon={icons.battery}>
          <Row label="State of Charge (SoC)" tone={soc === null ? undefined : batteryTone(soc)}>
            {soc !== null && (
              <span className={`meter meter-${batteryTone(soc)}`} aria-hidden="true">
                <span style={{ width: `${Math.min(100, Math.max(0, soc))}%` }} />
              </span>
            )}
            {fixed(soc, 1, "%")}
          </Row>
          <Row label="Flight State">{stateLabel(t?.state)}</Row>
          <Row label="Mission">{mission ? `#${mission.id}` : "None"}</Row>
          <Row label="Mission Status" tone={mission?.status === "active" ? "ok" : undefined}>
            {mission ? mission.status[0].toUpperCase() + mission.status.slice(1) : "—"}
          </Row>
        </Card>

        <Card title="Position" icon={icons.position}>
          <Row label="X (from pad)">{fixed(t?.pos_x_m, 2, "m")}</Row>
          <Row label="Y (from pad)">{fixed(t?.pos_y_m, 2, "m")}</Row>
          <Row label="Z (from pad)">{fixed(t?.pos_z_m, 2, "m")}</Row>
          <Row label="Distance to Base">{fixed(horizontalDistance, 2, "m")}</Row>
        </Card>

        <Card title="Motion" icon={icons.motion}>
          <Row label="Speed">{fixed(t?.speed_mps, 2, "m/s")}</Row>
          <Row label="Velocity X">{fixed(t?.vel_x_mps, 2, "m/s")}</Row>
          <Row label="Velocity Y">{fixed(t?.vel_y_mps, 2, "m/s")}</Row>
          <Row label="Velocity Z">{fixed(t?.vel_z_mps, 2, "m/s")}</Row>
          <Row label="Acceleration">{fixed(acceleration, 2, "m/s²")}</Row>
        </Card>

        <Card title="Communication" icon={icons.comm}>
          <Row label="Drone Link" tone={t ? (linkUp ? "ok" : "bad") : undefined}>
            {t ? (linkUp ? "Connected" : "Lost") : "—"}
          </Row>
          <Row label="Station Stream" tone={connection === "connected" ? "ok" : "warn"}>
            {live.connectionMessage}
          </Row>
          <Row label="Last Update">
            {t ? new Date(t.recorded_at).toLocaleTimeString([], { hour12: false }) : "No data"}
          </Row>
          <Row label="Data Age" tone={stale ? "warn" : undefined}>
            {telemetryAgeSeconds === null ? "—" : `${telemetryAgeSeconds.toFixed(1)} s`}
          </Row>
        </Card>
      </div>
    </section>
  );
}
