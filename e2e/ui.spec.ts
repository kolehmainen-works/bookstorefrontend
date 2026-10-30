import { expect, test } from "@playwright/test";
import { ADMIN, USER, deleteTestBooks, uiLogin, uniqueTitle } from "./helpers";

// The deployed React app in a real browser, talking to the deployed backend
test.describe("frontend + backend together", () => {
  test.describe.configure({ mode: "serial" });

  const title = uniqueTitle("ui");
  const editedTitle = `${title} edited`;

  test.afterAll(async ({ request }) => {
    await deleteTestBooks(request);
  });

  test("signed-out users are sent to the login page", async ({ page }) => {
    await page.goto("#/books");
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome to Bookstore" })).toBeVisible();
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("#/login");
    await page.getByLabel(/User name/).fill(USER.username);
    await page.getByLabel(/^Password/).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid username or password.")).toBeVisible();
  });

  test("user sees the book list, without Delete buttons", async ({ page }) => {
    await uiLogin(page, USER);
    await expect(page).toHaveURL(/#\/books$/);
    await expect(page.getByRole("heading", { name: "Books" })).toBeVisible();
    await expect(page.locator(".ag-row").first()).toBeVisible();
    for (const header of ["Product code", "Author", "Title", "Year", "Category", "ISBN", "Price", "Actions"]) {
      await expect(page.locator(".ag-header-cell-text", { hasText: header }).first()).toBeVisible();
    }
    await expect(page.locator(".ag-row").first().getByRole("link", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  });

  test("the login survives a page reload", async ({ page }) => {
    await uiLogin(page, USER);
    await page.reload();
    await expect(page.getByText(`Logged in as: ${USER.username}`)).toBeVisible();
    await expect(page.locator(".ag-row").first()).toBeVisible();
  });

  test("user adds a book", async ({ page }) => {
    await uiLogin(page, USER);
    await page.getByRole("link", { name: "Add new book" }).click();
    await expect(page.getByRole("heading", { name: "Add new book" })).toBeVisible();

    await page.getByLabel(/^Author/).fill("E2E Author");
    await page.getByLabel(/^Title/).fill(title);
    await page.getByLabel(/^Publication year/).fill("2024");
    // the category list comes from GET /api/categories
    await page.getByLabel(/^Category/).click();
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();
    await options.last().click();
    await page.getByLabel(/^ISBN/).fill("9780000000002");
    await page.getByLabel(/^Price/).fill("19.90");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/#\/books$/);
    const row = page.locator(".ag-row", { hasText: title });
    await expect(row).toBeVisible();
    await expect(row).toContainText("E2E Author");
    await expect(row).toContainText("2024");
    await expect(row).toContainText("€19.90");
  });

  test("user edits the book", async ({ page }) => {
    await uiLogin(page, USER);
    await page.locator(".ag-row", { hasText: title }).getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit book" })).toBeVisible();
    // the form is filled from GET /api/books/{id}
    await expect(page.getByLabel(/^Title/)).toHaveValue(title);
    await expect(page.getByLabel(/^ISBN/)).toHaveValue("9780000000002");

    await page.getByLabel(/^Title/).fill(editedTitle);
    await page.getByLabel(/^Price/).fill("21.50");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/#\/books$/);
    const row = page.locator(".ag-row", { hasText: editedTitle });
    await expect(row).toBeVisible();
    await expect(row).toContainText("€21.50");
  });

  test("user signs out", async ({ page }) => {
    await uiLogin(page, USER);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByText("You have been logged out.")).toBeVisible();
    await page.goto("#/books");
    await expect(page).toHaveURL(/#\/login$/);
  });

  test("admin deletes the book", async ({ page }) => {
    await uiLogin(page, ADMIN);
    const row = page.locator(".ag-row", { hasText: editedTitle });
    await expect(row).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator(".ag-row", { hasText: editedTitle })).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".ag-row").first()).toBeVisible();
    await expect(page.locator(".ag-row", { hasText: editedTitle })).toHaveCount(0);
  });

  test("forgot password page sends the request", async ({ page }) => {
    await page.goto("#/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Forgot password" })).toBeVisible();
    await page.getByLabel(/^Email/).fill("nobody-e2e@example.com");
    await page.getByRole("button", { name: "Send link" }).click();
    await expect(page.getByText(/If this email belongs to a user/)).toBeVisible();
  });

  test("reset password page rejects an invalid link", async ({ page }) => {
    await page.goto("#/reset-password?token=no-such-token");
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByLabel(/^New password/).fill("newpassword1");
    await page.getByLabel(/^Re-type password/).fill("newpassword1");
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText(/invalid or has expired/)).toBeVisible();
  });

  test("reset password page checks the passwords before sending", async ({ page }) => {
    await page.goto("#/reset-password?token=no-such-token");
    await page.getByLabel(/^New password/).fill("short");
    await expect(page.getByText("Password must be 7-30 characters long")).toBeVisible();
    await page.getByLabel(/^New password/).fill("newpassword1");
    await page.getByLabel(/^Re-type password/).fill("different1");
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset password" })).toBeDisabled();
  });

  test("reset link without a token is invalid", async ({ page }) => {
    await page.goto("#/reset-password");
    await expect(page.getByText("Oops! Seems like your link is invalid.")).toBeVisible();
  });
});
