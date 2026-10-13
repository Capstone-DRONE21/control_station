import { useEffect, useState } from "react";
import { restoreSession } from "./features/auth/api";
import type { Operator } from "./features/auth/api";
import LoginPage from "./pages/login/LoginPage";
import DashboardPage from "./pages/dashboard/DashboardPage";

export default function App() {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    restoreSession(controller.signal)
      .then((account) => { if (!controller.signal.aborted) setOperator(account); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Session check failed.");
      })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);

  // With two auth-dependent pages, keep the URL canonical on refresh and Back/Forward.
  useEffect(() => {
    if (checking) return;
    const syncRoute = () => {
      const path = operator ? "/dashboard" : "/login";
      if (window.location.pathname !== path) window.history.replaceState(null, "", path);
      document.title = `${operator ? "Dashboard" : "Operator Login"} | Control Station`;
    };
    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, [operator, checking]);

  if (checking) return <main className="session-loading" role="status">Checking your session…</main>;
  if (operator) return <DashboardPage onLogout={() => setOperator(null)} />;
  return <LoginPage onLogin={setOperator} sessionError={message} />;
}
