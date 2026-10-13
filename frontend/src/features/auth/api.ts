export type Operator = { id: number; username: string };

async function authRequest(path: string, options: RequestInit = {}) {
  try {
    return await fetch(`/api/auth/${path}`, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Cannot reach the server. Please try again.", { cause: error });
  }
}

export async function restoreSession(signal: AbortSignal): Promise<Operator | null> {
  const response = await authRequest("me", { signal });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Could not check your session. Please sign in again.");
  return response.json();
}

export async function login(username: string, password: string): Promise<Operator> {
  const response = await authRequest("login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
    body: JSON.stringify({ username, password }),
  });
  if (response.status === 401) throw new Error("Invalid username or password.");
  if (response.status === 422) throw new Error("Check your username and password format.");
  if (!response.ok) throw new Error("Sign-in failed. Please try again.");
  return response.json();
}

export async function logout(): Promise<void> {
  const response = await authRequest("logout", {
    method: "POST",
    headers: { "X-CSRF-Protection": "1" },
  });
  if (!response.ok && response.status !== 401) throw new Error("Could not log out. Please try again.");
}
