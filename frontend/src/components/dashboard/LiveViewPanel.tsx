import type { DroneLive } from "../../features/live/useDroneLive";
import { duration } from "./format";

const CAMERA_TEXT = {
  waiting: "Waiting for frames",
  receiving: "Receiving frames",
  error: "Could not load a camera frame",
} as const;

export default function LiveViewPanel({ droneId, live }: { droneId: number; live: DroneLive }) {
  const { canvasRef, camera, frameStats, now, mission } = live;

  // The feed is "live" while frames keep arriving; otherwise show the last frame as paused.
  const streaming =
    camera === "receiving" &&
    frameStats.lastFrameAt !== null &&
    now - frameStats.lastFrameAt < 2000;

  return (
    <section className="panel live-panel" aria-labelledby="live-title">
      <header className="panel-header">
        <h2 id="live-title">
          Live View <span className="panel-subtitle">Drone {droneId} camera</span>
        </h2>
        <span className={`badge ${streaming ? "badge-bad badge-live" : "badge-idle"}`}>
          {streaming ? "● LIVE" : "OFFLINE"}
        </span>
      </header>

      <div className="live-body">
        <div className="live-frame">
          <canvas ref={canvasRef} width={640} height={360} aria-label={`Drone ${droneId} camera feed`} />
          {camera !== "receiving" && (
            <div className="live-overlay" role="status">{CAMERA_TEXT[camera]}</div>
          )}
          {camera === "receiving" && (
            <div className="live-hud" aria-hidden="true">
              <span>FRAME {frameStats.frameIndex ?? "—"}</span>
            </div>
          )}
        </div>

        <dl className="tm-card live-stats">
          <div className="tm-row"><dt>Camera</dt><dd className={camera === "error" ? "tone-bad" : streaming ? "tone-ok" : undefined}>{CAMERA_TEXT[camera]}</dd></div>
          <div className="tm-row"><dt>Frame Number</dt><dd>{frameStats.frameIndex ?? "—"}</dd></div>
          <div className="tm-row"><dt>Mission Time</dt><dd>{duration(frameStats.elapsedMs)}</dd></div>

          <div className="tm-row"><dt>Mission</dt><dd>{mission ? `#${mission.id} · ${mission.status}` : "None"}</dd></div>
        </dl>
      </div>
    </section>
  );
}
