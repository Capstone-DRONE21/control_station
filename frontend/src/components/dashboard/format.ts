export function fixed(value: number | null | undefined, digits: number, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

export function magnitude(...parts: (number | null | undefined)[]) {
  if (parts.some((part) => part === null || part === undefined)) return null;
  return Math.hypot(...(parts as number[]));
}

const STATE_LABELS: Record<string, string> = {
  idle: "Idle",
  taking_off: "Taking Off",
  on_mission: "In Flight",
  returning_to_base: "Returning",
  waiting_for_pad: "Waiting for Pad",
  landing: "Landing",
  charging: "Charging",
  offline: "Offline",
  fault: "Fault",
};

export function stateLabel(state: string | undefined) {
  if (!state) return "No Data";
  return STATE_LABELS[state] ?? state;
}

/** Badge tone used by the mockup: green flying, amber transitional, red problems, grey idle. */
export function stateTone(state: string | undefined): "ok" | "warn" | "bad" | "info" | "idle" {
  switch (state) {
    case "on_mission":
      return "ok";
    case "taking_off":
    case "landing":
    case "returning_to_base":
    case "waiting_for_pad":
      return "warn";
    case "charging":
      return "info";
    case "offline":
    case "fault":
      return "bad";
    default:
      return "idle";
  }
}

export function batteryTone(soc: number | null | undefined): "ok" | "warn" | "bad" {
  if (soc === null || soc === undefined) return "ok";
  if (soc < 20) return "bad";
  if (soc < 35) return "warn";
  return "ok";
}

export function duration(ms: number | null | undefined) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
