import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** One telemetry row as stored by the backend (`telemetry` table). */
export type Telemetry = {
  id: number;
  drone_id: number;
  mission_id: number | null;
  recorded_at: string;
  state: string;
  comm_status: "connected" | "lost";
  battery_soc_percent: number | null;
  battery_soh_percent: number | null;
  latitude: number | null;
  longitude: number | null;
  pos_x_m: number | null;
  pos_y_m: number | null;
  pos_z_m: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  vel_x_mps: number | null;
  vel_y_mps: number | null;
  vel_z_mps: number | null;
  acc_x_mps2: number | null;
  acc_y_mps2: number | null;
  acc_z_mps2: number | null;
};

export type Mission = {
  id: number;
  status: "planned" | "active" | "completed" | "aborted";
  started_at: string | null;
  ended_at: string | null;
};

type Frame = {
  id: number;
  mission_id: number;
  frame_index: number;
  elapsed_ms: number;
  recorded_at: string;
  image_url: string;
};

type LiveMessage =
  | { type: "mission"; data: Mission | null }
  | { type: "telemetry"; data: Telemetry }
  | { type: "frame"; data: Frame }
  | { type: "error"; message: string };

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "unauthorized";

export type CameraState = "waiting" | "receiving" | "error";

export type FrameStats = {
  frameIndex: number | null;
  elapsedMs: number | null;
  width: number | null;
  height: number | null;
  fps: number;
  lastFrameAt: number | null;
};

const EMPTY_FRAME_STATS: FrameStats = {
  frameIndex: null,
  elapsedMs: null,
  width: null,
  height: null,
  fps: 0,
  lastFrameAt: null,
};

/** Telemetry older than this is no longer considered live (matches backend stale_telemetry_seconds). */
export const STALE_TELEMETRY_SECONDS = 2;

export type DroneLive = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  telemetry: Telemetry | null;
  mission: Mission | null;
  connection: ConnectionState;
  connectionMessage: string;
  camera: CameraState;
  frameStats: FrameStats;
  /** Wall clock, refreshed every 500 ms, for ages and the header clock. */
  now: number;
  telemetryAgeSeconds: number | null;
  live: boolean;
};

/**
 * Subscribes to the live WebSocket for one drone: mission changes, telemetry
 * samples and video frames (drawn straight onto `canvasRef`).
 */
export function useDroneLive(droneId: number): DroneLive {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameStatsRef = useRef<FrameStats>({ ...EMPTY_FRAME_STATS });
  const frameTimesRef = useRef<number[]>([]);

  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [mission, setMission] = useState<Mission | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [connectionMessage, setConnectionMessage] = useState("Connecting");
  const [camera, setCamera] = useState<CameraState>("waiting");
  const [frameStats, setFrameStats] = useState<FrameStats>(EMPTY_FRAME_STATS);
  const [now, setNow] = useState(() => Date.now());

  // Frames arrive at up to ~30 fps; sample their stats on a slower tick so the
  // whole dashboard is not re-rendered for every frame.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Date.now();
      const times = frameTimesRef.current;
      while (times.length > 0 && current - times[0] > 1000) times.shift();
      frameStatsRef.current.fps = times.length;
      setFrameStats({ ...frameStatsRef.current });
      setNow(current);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let activeMissionId: number | null = null;
    let generation = 0;

    const controller = new AbortController();

    // A bounded image queue prevents slow image loading from accumulating
    // an unlimited delay behind the live feed.
    const frameQueue: Frame[] = [];
    let loadingImage = false;

    function resetCamera() {
      generation++;
      frameQueue.length = 0;
      frameTimesRef.current = [];
      frameStatsRef.current = { ...EMPTY_FRAME_STATS };

      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);

      setCamera("waiting");
    }

    async function displayFrames() {
      if (loadingImage || stopped) return;
      loadingImage = true;

      try {
        while (frameQueue.length > 0 && !stopped) {
          const frame = frameQueue.shift()!;
          const frameGeneration = generation;
          const image = new Image();
          image.src = frame.image_url;

          try {
            await image.decode();

            if (
              stopped ||
              frameGeneration !== generation ||
              frame.mission_id !== activeMissionId
            ) {
              continue;
            }

            const canvas = canvasRef.current;
            const context = canvas?.getContext("2d");

            if (canvas && context) {
              if (
                canvas.width !== image.naturalWidth ||
                canvas.height !== image.naturalHeight
              ) {
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
              }

              context.drawImage(image, 0, 0);

              const drawnAt = Date.now();
              frameTimesRef.current.push(drawnAt);
              Object.assign(frameStatsRef.current, {
                frameIndex: frame.frame_index,
                elapsedMs: frame.elapsed_ms,
                width: image.naturalWidth,
                height: image.naturalHeight,
                lastFrameAt: drawnAt,
              });
              setCamera("receiving");
            }
          } catch {
            if (!stopped && frameGeneration === generation) setCamera("error");
          }
        }
      } finally {
        loadingImage = false;
      }
    }

    // Load an initial snapshot through REST.
    void fetch(`/api/drones/${droneId}/telemetry/latest`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Telemetry request failed: ${response.status}`);
        return response.json();
      })
      .then((result: { telemetry: Telemetry | null }) => {
        if (stopped) return;
        // Do not overwrite a newer WebSocket sample.
        setTelemetry((current) => {
          if (!result.telemetry) return current;
          if (current && current.id >= result.telemetry.id) return current;
          return result.telemetry;
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.error(error);
      });

    function connect() {
      if (stopped) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/ws/drones/${droneId}`);

      socket.onopen = () => {
        if (stopped) return;
        setConnection("connected");
        setConnectionMessage("Connected");
      };

      socket.onmessage = (event) => {
        if (stopped) return;
        const message = JSON.parse(event.data) as LiveMessage;

        if (message.type === "mission") {
          const newMissionId = message.data?.id ?? null;
          if (newMissionId !== activeMissionId) {
            activeMissionId = newMissionId;
            resetCamera();
            setTelemetry(null);
          }
          setMission(message.data);
        }

        if (message.type === "telemetry") setTelemetry(message.data);

        if (message.type === "frame") {
          // Keep latency bounded if decoding falls behind.
          if (frameQueue.length >= 6) frameQueue.shift();
          frameQueue.push(message.data);
          void displayFrames();
        }

        if (message.type === "error") {
          setConnection("error");
          setConnectionMessage(message.message);
        }
      };

      socket.onerror = () => {
        if (stopped) return;
        setConnection("error");
        setConnectionMessage("Connection error");
      };

      socket.onclose = (event) => {
        if (stopped) return;

        if (event.code === 1008) {
          setConnection("unauthorized");
          setConnectionMessage("Session unavailable — sign in again");
          return;
        }

        setConnection("reconnecting");
        setConnectionMessage("Disconnected — retrying");
        reconnectTimer = window.setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      stopped = true;
      generation++;
      frameQueue.length = 0;
      controller.abort();
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [droneId]);

  const telemetryAgeSeconds = telemetry
    ? Math.max(0, (now - Date.parse(telemetry.recorded_at)) / 1000)
    : null;

  const live =
    connection === "connected" &&
    mission?.status === "active" &&
    telemetryAgeSeconds !== null &&
    telemetryAgeSeconds <= STALE_TELEMETRY_SECONDS;

  return {
    canvasRef,
    telemetry,
    mission,
    connection,
    connectionMessage,
    camera,
    frameStats,
    now,
    telemetryAgeSeconds,
    live,
  };
}
