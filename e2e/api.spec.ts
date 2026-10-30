import { expect, test } from "@playwright/test";
import {
  ADMIN,
  API_URL,
  FRONTEND_ORIGIN,
  USER,
  apiLogin,
  apiSignup,
  bearer,
  deleteAccount,
  deleteTestBooks,
  uniqueTitle,
  uniqueUser,
} from "./helpers";

// Every backend endpoint, called directly the way the frontend calls it
test.describe("backend API", () => {
  test.describe.configure({ mode: "serial" });

  let userToken: string;
  let adminToken: string;
  let categoryId: number;
  const createdUsers: { username: string; password: string }[] = [];

  test.beforeAll(async ({ request }) => {
    userToken = await apiLogin(request, USER);
    adminToken = await apiLogin(request, ADMIN);
  });

  test.afterAll(async ({ request }) => {
    await deleteTestBooks(request);
    for (const user of createdUsers) {
      await deleteAccount(request, user);
    }
  });

  test.describe("POST /api/auth/login", () => {
    test("user gets a JWT with ROLE_USER", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, { data: USER });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.token.split(".")).toHaveLength(3);
      expect(body.username).toBe(USER.username);
      expect(body.roles).toEqual(["ROLE_USER"]);
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    test("admin gets ROLE_ADMIN", async ({ request }) => {
      const body = await (await request.post(`${API_URL}/api/auth/login`, { data: ADMIN })).json();
      expect(body.roles).toEqual(["ROLE_ADMIN"]);
    });

    test("wrong password is 401", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: { username: USER.username, password: "wrong-password" },
      });
      expect(response.status()).toBe(401);
      expect((await response.json()).message).toBe("Invalid username or password.");
    });

    test("unknown user is 401", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, {
        data: { username: "no-such-user-e2e", password: "whatever" },
      });
      expect(response.status()).toBe(401);
    });

    test("missing password is 400", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/login`, { data: { username: USER.username } });
      expect(response.status()).toBe(400);
    });
  });

  test.describe("authentication", () => {
    test("books need a token", async ({ request }) => {
      expect((await request.get(`${API_URL}/api/books`)).status()).toBe(401);
      expect((await request.get(`${API_URL}/api/categories`)).status()).toBe(401);
    });

    test("a forged token is rejected", async ({ request }) => {
      const forged =
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInJvbGVzIjpbIlJPTEVfQURNSU4iXSwiZXhwIjo0MTAyNDQ0ODAwfQ.c2lnbmF0dXJl";
      expect((await request.get(`${API_URL}/api/books`, { headers: bearer(forged) })).status()).toBe(401);
    });
  });

  test.describe("books and categories", () => {
    test("GET /api/categories", async ({ request }) => {
      const response = await request.get(`${API_URL}/api/categories`, { headers: bearer(userToken) });
      expect(response.status()).toBe(200);
      const categories = await response.json();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toEqual({ id: expect.any(Number), name: expect.any(String) });
      categoryId = categories[0].id;
    });

    test("GET /api/books", async ({ request }) => {
      const response = await request.get(`${API_URL}/api/books`, { headers: bearer(userToken) });
      expect(response.status()).toBe(200);
      const books = await response.json();
      expect(books.length).toBeGreaterThan(0);
      expect(books[0]).toMatchObject({ id: expect.any(Number), title: expect.any(String), author: expect.any(String) });
      // the reset token and password hash never leave the server
      expect(JSON.stringify(books)).not.toContain("password");
    });

    test("GET /api/books/{id} of a missing book is 404", async ({ request }) => {
      const response = await request.get(`${API_URL}/api/books/987654321`, { headers: bearer(userToken) });
      expect(response.status()).toBe(404);
    });

    test("a user's list has only their own books", async ({ request }) => {
      const books = await (await request.get(`${API_URL}/api/books`, { headers: bearer(userToken) })).json();
      for (const book of books) {
        expect(book.ownerUsername).toBe(USER.username);
      }
    });

    test("owner creates, reads, edits and deletes a book", async ({ request }) => {
      const title = uniqueTitle("api");
      const book = {
        title,
        author: "E2E Author",
        isbn: "9780000000001",
        publicationYear: 2024,
        price: 9.99,
        category: { id: categoryId },
      };

      const created = await request.post(`${API_URL}/api/books`, { headers: bearer(userToken), data: book });
      expect(created.status()).toBe(201);
      const createdBook = await created.json();
      expect(createdBook).toMatchObject({ title, price: 9.99, category: { id: categoryId }, ownerUsername: USER.username });

      const read = await request.get(`${API_URL}/api/books/${createdBook.id}`, { headers: bearer(userToken) });
      expect(read.status()).toBe(200);
      expect((await read.json()).title).toBe(title);

      const edited = await request.put(`${API_URL}/api/books/${createdBook.id}`, {
        headers: bearer(userToken),
        data: { ...book, title: `${title} edited`, price: 12.5 },
      });
      expect(edited.status()).toBe(200);
      expect(await edited.json()).toMatchObject({
        id: createdBook.id,
        title: `${title} edited`,
        price: 12.5,
        ownerUsername: USER.username,
      });

      const deleted = await request.delete(`${API_URL}/api/books/${createdBook.id}`, { headers: bearer(userToken) });
      expect(deleted.status()).toBe(204);

      const gone = await request.get(`${API_URL}/api/books/${createdBook.id}`, { headers: bearer(userToken) });
      expect(gone.status()).toBe(404);

      const deleteAgain = await request.delete(`${API_URL}/api/books/${createdBook.id}`, { headers: bearer(userToken) });
      expect(deleteAgain.status()).toBe(404);
    });

    test("other users cannot see or change a user's book; admins can", async ({ request }) => {
      const other = uniqueUser("other");
      createdUsers.push(other);
      const otherToken = await apiSignup(request, other);

      const title = uniqueTitle("private");
      const created = await request.post(`${API_URL}/api/books`, {
        headers: bearer(userToken),
        data: { title, author: "E2E Author", isbn: "1", publicationYear: 2024, category: { id: categoryId } },
      });
      const bookId = (await created.json()).id;

      const otherList = await (await request.get(`${API_URL}/api/books`, { headers: bearer(otherToken) })).json();
      expect(otherList).toEqual([]);
      expect((await request.get(`${API_URL}/api/books/${bookId}`, { headers: bearer(otherToken) })).status()).toBe(404);
      const put = await request.put(`${API_URL}/api/books/${bookId}`, {
        headers: bearer(otherToken),
        data: { title: "Stolen", author: "x", isbn: "1", publicationYear: 2000 },
      });
      expect(put.status()).toBe(404);
      expect((await request.delete(`${API_URL}/api/books/${bookId}`, { headers: bearer(otherToken) })).status()).toBe(404);

      // admin sees every user's books, with the owner
      const adminList = await (await request.get(`${API_URL}/api/books`, { headers: bearer(adminToken) })).json();
      expect(adminList.find((b: { id: number }) => b.id === bookId)).toMatchObject({ title, ownerUsername: USER.username });
      expect((await request.delete(`${API_URL}/api/books/${bookId}`, { headers: bearer(adminToken) })).status()).toBe(204);
    });

    test("PUT of a missing book is 404", async ({ request }) => {
      const response = await request.put(`${API_URL}/api/books/987654321`, {
        headers: bearer(userToken),
        data: { title: uniqueTitle("missing"), author: "A", isbn: "1", publicationYear: 2000, price: 1 },
      });
      expect(response.status()).toBe(404);
    });

    test("a book without a title is 400", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/books`, {
        headers: bearer(userToken),
        data: { title: "", author: "E2E Author", isbn: "1", publicationYear: 2000 },
      });
      expect(response.status()).toBe(400);
    });

    test("an unknown category is 400", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/books`, {
        headers: bearer(userToken),
        data: { title: uniqueTitle("badcat"), author: "A", isbn: "1", publicationYear: 2000, category: { id: 987654321 } },
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe("POST /api/auth/signup and DELETE /api/users/me", () => {
    test("a new user is signed in and starts with no books", async ({ request }) => {
      const user = uniqueUser("signup");
      createdUsers.push(user);
      const response = await request.post(`${API_URL}/api/auth/signup`, {
        data: { ...user, passwordCheck: user.password },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toMatchObject({ username: user.username, roles: ["ROLE_USER"] });

      const books = await request.get(`${API_URL}/api/books`, { headers: bearer(body.token) });
      expect(await books.json()).toEqual([]);

      // the new password works for signing in
      await apiLogin(request, user);
    });

    test("taken user names and emails are refused", async ({ request }) => {
      const user = uniqueUser("taken");
      createdUsers.push(user);
      await apiSignup(request, user);

      const sameName = await request.post(`${API_URL}/api/auth/signup`, {
        data: { ...user, email: `other-${user.email}`, passwordCheck: user.password },
      });
      expect(sameName.status()).toBe(409);
      expect((await sameName.json()).message).toBe("Username is already taken.");

      const sameEmail = await request.post(`${API_URL}/api/auth/signup`, {
        data: { ...user, username: `${user.username}x`, passwordCheck: user.password },
      });
      expect(sameEmail.status()).toBe(409);
      expect((await sameEmail.json()).message).toBe("Email is already in use.");
    });

    test("bad signup input is 400", async ({ request }) => {
      const user = uniqueUser("bad");
      const mismatch = await request.post(`${API_URL}/api/auth/signup`, {
        data: { ...user, passwordCheck: "something-else" },
      });
      expect(mismatch.status()).toBe(400);
      expect((await mismatch.json()).message).toBe("Passwords do not match.");

      const short = await request.post(`${API_URL}/api/auth/signup`, {
        data: { ...user, password: "short", passwordCheck: "short" },
      });
      expect(short.status()).toBe(400);
      expect((await short.json()).message).toContain("password size must be between 7 and 30");

      const badEmail = await request.post(`${API_URL}/api/auth/signup`, {
        data: { ...user, email: "not-an-email", passwordCheck: user.password },
      });
      expect(badEmail.status()).toBe(400);
    });

    test("a user can delete their account", async ({ request }) => {
      const user = uniqueUser("leaving");
      const token = await apiSignup(request, user);
      expect((await request.delete(`${API_URL}/api/users/me`, { headers: bearer(token) })).status()).toBe(204);
      const login = await request.post(`${API_URL}/api/auth/login`, { data: user });
      expect(login.status()).toBe(401);
    });
  });

  test.describe("password reset", () => {
    test("forgot-password gives the same answer for an unknown email", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/forgot-password`, {
        data: { email: "nobody-e2e@example.com" },
      });
      expect(response.status()).toBe(200);
      expect((await response.json()).message).toContain("If this email belongs to a user");
    });

    test("forgot-password rejects a malformed email", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/forgot-password`, { data: { email: "not-an-email" } });
      expect(response.status()).toBe(400);
    });

    test("reset-password rejects an unknown token", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/reset-password`, {
        data: { token: "no-such-token", password: "newpassword1", passwordCheck: "newpassword1" },
      });
      expect(response.status()).toBe(400);
      expect((await response.json()).message).toContain("invalid or has expired");
    });

    test("reset-password rejects passwords that do not match", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/reset-password`, {
        data: { token: "no-such-token", password: "newpassword1", passwordCheck: "newpassword2" },
      });
      expect(response.status()).toBe(400);
      expect((await response.json()).message).toBe("Passwords do not match.");
    });

    test("reset-password rejects a too short password", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/auth/reset-password`, {
        data: { token: "no-such-token", password: "short", passwordCheck: "short" },
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe("CORS", () => {
    test("the GitHub Pages origin may call the API", async ({ request }) => {
      const response = await request.fetch(`${API_URL}/api/books/1`, {
        method: "OPTIONS",
        headers: {
          Origin: FRONTEND_ORIGIN,
          "Access-Control-Request-Method": "DELETE",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      });
      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers["access-control-allow-origin"]).toBe(FRONTEND_ORIGIN);
      expect(headers["access-control-allow-methods"]).toContain("DELETE");
      expect(headers["access-control-allow-headers"]?.toLowerCase()).toContain("authorization");
    });

    test("other origins are refused", async ({ request }) => {
      const response = await request.fetch(`${API_URL}/api/books`, {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example.com", "Access-Control-Request-Method": "GET" },
      });
      expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
    });
  });
});
