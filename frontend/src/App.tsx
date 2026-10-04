import { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    const controller = new AbortController();

    async function checkBackend() {
      try {
        const response = await fetch("/api/health", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Health request failed");
        }

        const result = await response.json();
        setStatus(`${result.service}: ${result.status}`);
      } catch {
        if (!controller.signal.aborted) {
          setStatus("Backend unavailable");
        }
      }
    }

    void checkBackend();

    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>Control Station</h1>
      <p role="status">{status}</p>
    </main>
  );
}