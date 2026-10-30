import { expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export const API_URL = (process.env.API_URL ?? "https://softala.haaga-helia.fi:8090").replace(/\/+$/, "");
// the origin the browser sends when the GitHub Pages site calls the API
export const FRONTEND_ORIGIN = new URL(
  process.env.FRONTEND_URL ?? "https://kolehmainen-works.github.io/bookstorefrontend.github.io/"
).origin;

export const USER = { username: process.env.E2E_USER ?? "user", password: process.env.E2E_USER_PASSWORD ?? "user" };
export const ADMIN = { username: process.env.E2E_ADMIN ?? "admin", password: process.env.E2E_ADMIN_PASSWORD ?? "admin" };

// every book the tests create starts with this, so leftovers can be cleaned up
export const TEST_TITLE_PREFIX = "E2E test book";

export function uniqueTitle(label: string) {
  return `${TEST_TITLE_PREFIX} ${label} ${Date.now()}`;
}

export async function apiLogin(request: APIRequestContext, user: { username: string; password: string }) {
  const response = await request.post(`${API_URL}/api/auth/login`, { data: user });
  expect(response.status(), `login as ${user.username}`).toBe(200);
  const body = await response.json();
  return body.token as string;
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// removes books left behind by failed test runs
export async function deleteTestBooks(request: APIRequestContext) {
  const token = await apiLogin(request, ADMIN);
  const response = await request.get(`${API_URL}/api/books`, { headers: bearer(token) });
  const books: { id: number; title: string }[] = await response.json();
  for (const book of books.filter((b) => b.title.startsWith(TEST_TITLE_PREFIX))) {
    await request.delete(`${API_URL}/api/books/${book.id}`, { headers: bearer(token) });
  }
}

export async function uiLogin(page: Page, user: { username: string; password: string }) {
  await page.goto("#/login");
  await page.getByLabel(/User name/).fill(user.username);
  await page.getByLabel(/^Password/).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`Logged in as: ${user.username}`)).toBeVisible();
}
