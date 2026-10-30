import type { LoginResponse } from "./types";

export const API_URL = (import.meta.env.VITE_API_URL ?? "https://softala.haaga-helia.fi:8090").replace(/\/+$/, "");

const SESSION_KEY = "bookstore.session";

// The JWT from the login is kept in localStorage and sent as "Authorization: Bearer ..."
export function loadSession(): LoginResponse | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored) as LoginResponse;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: LoginResponse | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage blocked: the login then lasts only until the page is reloaded
  }
}

// called when the backend answers 401, e.g. because the token expired
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = loadSession()?.token;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Cannot reach the server. Please try again later.", 0);
  }

  if (response.status === 401 && token) {
    onUnauthorized();
  }
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body?.message) return body.message;
    if (body?.error) return body.error;
  } catch {
    // no JSON body
  }
  if (response.status === 401) return "Please sign in.";
  if (response.status === 403) return "You are not allowed to do that.";
  return `Something went wrong (${response.status} ${response.statusText}).`;
}
