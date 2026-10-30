# bookstorefrontend

Bookstore frontend: React + TypeScript + Vite, MUI and AG Grid. It talks to the
[bookstorebackend](https://github.com/kolehmainen-works/bookstorebackend) REST API and signs in with a JWT.

Live: https://kolehmainen-works.github.io/bookstorefrontend.github.io/

## Pages

| Route | What it does |
|---|---|
| `/#/login` | Sign in (demo users `user`/`user` and `admin`/`admin`) |
| `/#/signup` | Create an account; signs the new user in |
| `/#/books` | "My books": the signed-in user's own books to edit and delete. Admins see "All books" with an Owner column |
| `/#/books/new`, `/#/books/:id/edit` | Add or edit a book |
| `/#/forgot-password` | Ask for a password reset email |
| `/#/reset-password?token=...` | Opened from the email link; set a new password |

## End-to-end tests

`e2e/` has Playwright tests that run against the **deployed** site and backend: every API
endpoint (signup, login, own books and admin view, categories, account deletion, password reset,
CORS) and the React pages in a
real browser. They create books named `E2E test book ...` and users named `e2e_...`, and delete
them afterwards.

```bash
npx playwright install chromium   # once
npm run test:e2e                  # report: npx playwright show-report e2e-report
```

Addresses and users can be changed with `FRONTEND_URL`, `API_URL`, `E2E_USER`,
`E2E_USER_PASSWORD`, `E2E_ADMIN` and `E2E_ADMIN_PASSWORD`.

## Backend address

The backend address defaults to `https://softala.haaga-helia.fi:8090`. To use another one,
set `VITE_API_URL` when building, e.g. `VITE_API_URL=https://localhost:8090 npm run dev`.

## Development

```bash
npm ci
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm run build      # tsc && vite build -> dist/
```

## Deploy to GitHub Pages (bash, no GitHub Actions)

Run from Git Bash (Windows), macOS or Linux. Settings are in `ghpages.conf`.

```bash
./setup.sh         # once: npm ci, checks that github.com/kolehmainen-works/bookstorefrontend.github.io exists
./setup.sh -r      # ...or let it create the repo with gh
./deploy.sh -n     # dry run: build and show what would change
./deploy.sh        # build, push dist/ to gh-pages, enable Pages on first run
```

- `deploy-ghpages.sh` and `setup-deploy-key.sh` are copied from the `ghpages-deploy` /
  `ghpages-setup` Claude skills.
- On your own machine, `gh auth login` is enough. For a server or a scheduled job, use
  `./setup.sh -k` to create a per-repo deploy key, then set `HOST_ALIAS` in `ghpages.conf`.
- The repo name must match `base` in `vite.config.ts` (`/bookstorefrontend.github.io/`).
