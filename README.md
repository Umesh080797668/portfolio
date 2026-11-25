# Imantha Umesh: portfolio, services and work tracking

```
frontend/   static website (index.html = portfolio, services.html = services, pricing, quotation, tracking)
backend/    API + admin dashboard (Node/Express, Supabase database, Cloudinary files) - deploy on Vercel
```

The two parts are deployed separately and have **separate `.env` files**:

| | File | Contains | Secret? |
|---|---|---|---|
| Frontend | `frontend/.env` (from `frontend/.env.example`) | API address, WhatsApp number, Formspree id, Supabase URL + anon key | No: everything ends up visible in the browser |
| Backend | `backend/.env` (from `backend/.env.example`) | Supabase service key, Cloudinary secret, upload secret, admin e-mails | **Yes: never commit, never copy to the frontend** |

On Vercel / Netlify you enter the same names as **Environment Variables** in the dashboard instead of using the files.

## 1. Supabase (once)

1. Create a project. SQL Editor -> paste `backend/supabase/schema.sql` -> Run. This creates the tables (Row Level Security on, no public policies) and the shared rate-limit function.
2. Authentication -> Providers -> Email: **turn OFF "Allow new users to sign up"**.
3. Authentication -> Users -> **Add user** (your admin e-mail, long password, auto-confirm).
4. Project Settings -> Realtime: keep "Allow public access" **on** (default). Live updates use data-free broadcast pings.
5. Copy the Project URL, the `anon` key and the `service_role` key.

## 2. Backend on Vercel

1. Vercel -> **Add New Project** -> import the repo -> **Root Directory: `backend`** -> Framework preset: *Other* -> no build command.
2. Settings -> **Environment Variables** (Production): everything from `backend/.env.example`, in particular
   `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_*`, `ADMIN_EMAILS`, `ADMIN_REQUIRE_MFA=true`, `UPLOAD_TOKEN_SECRET`, `TRUST_PROXY=1`, `ADMIN_HOSTNAME`.
3. Settings -> **Domains**: add `api.yourdomain.com` (visitor API) and `admin.yourdomain.com` (put the same name in `ADMIN_HOSTNAME`).
   * `api.` serves only the visitor API. There is no admin route on that host.
   * `admin.` serves the dashboard. Leave `ADMIN_HOSTNAME` empty to switch the dashboard off completely.
4. Strongly recommended: Vercel -> Firewall -> add a rule that only lets **your IP / VPN** reach `admin.yourdomain.com`. The login (+ two-factor) protects it anyway; the rule hides it.
5. Deploy. Check `https://api.yourdomain.com/health` returns `{"ok":true}`.

## 3. Frontend

Any static host works (Netlify, Cloudflare Pages, Vercel, GitHub Pages).

```bash
cd frontend
cp .env.example .env      # set API_BASE_URL=https://api.yourdomain.com and the other values
npm run build             # writes config.js and _headers (both generated, not committed)
npm run dev               # local preview on http://127.0.0.1:3200
```

* **Netlify:** the root `netlify.toml` already points at `frontend/` with `npm run build`. Add the `.env` names as Netlify environment variables. `_headers` gives you the Content-Security-Policy.
* **Vercel / GitHub Pages:** run `npm run build`, publish `frontend/` (including the generated `config.js`). These hosts ignore `_headers`; add equivalent headers in their settings if you want the CSP.
* After the first deploy set `FRONTEND_URL` in the backend to the website address (it also controls CORS: only that origin may call the API).

## 4. Run everything locally

```bash
cd backend && npm install && cp .env.example .env   # fill in, then:
npm run vendor:admin    # only needed if backend/admin/vendor/supabase.js is missing
npm start               # API on :3000, admin dashboard on 127.0.0.1:3001
npm test                # 22 automated tests (use fakes, no real accounts needed)
```

## How tracking works

| Situation | What you do |
|---|---|
| Visitor sends a request (Services page -> Track -> *Send a request & files*, or "Submit as Request + Files" on a quotation) | Admin dashboard -> open it -> **Accept & issue tracking code** -> **Send via WhatsApp** (message and link are prepared) |
| Client contacted you on WhatsApp / phone | Admin -> **+ New order** (leave "Issue a tracking code now" ticked) -> send the code |
| Work progresses | **Post an update** (status, progress, message). The visitor's page refreshes within a second. Untick "Show to the client" for private notes |
| Work finished | **Upload for client**; they download it from their tracking page |
| Code shared by mistake | **New code**: the old one stops working at once |

Clients open `https://yoursite/services.html?track=TAL-XXXXX-XXXXX#track` or type the code in the Track section.

## Security design

* **Secrets only in the backend**, only in environment variables. The frontend build contains only public values.
* **Admin separated from visitors**: different host name (Vercel) or port (local), not linked from the website, hidden behind a Firewall rule if you add one.
* **Admin login**: Supabase Auth + mandatory TOTP two-factor. The server verifies the token with Supabase on every request and requires a confirmed e-mail from `ADMIN_EMAILS` and a two-factor session. Every admin action and denied attempt is in the audit log.
* **No database access for visitors**: only the server (service role) reads the tables. A visitor with a code gets a minimal view of that one order: no phone, e-mail or internal notes.
* **Tracking codes**: 10 random characters (about 2^49 combinations), rate limited per IP with counters shared through the database (works across Vercel instances), the same "not found" answer for every wrong code, created only when you accept.
* **Live updates**: the server sends a data-free "changed" ping on a secret channel (HMAC of order + code); the page then re-fetches from the API. The page also refreshes every 20 seconds as a fallback.
* **Files**: private Cloudinary storage, signed one-time uploads with server-chosen paths, size and type re-checked after upload, executables blocked, expiring download links, admin downloads logged.
* **Web hardening**: strict CSP (admin page: no external or inline scripts), CORS allow-list, request size limits, honeypot, all user text rendered with `textContent`.

## Not tested against live services

The automated tests and my browser runs used an in-memory database, fake file storage and a fake login, and a stubbed realtime client. Before going live, do one real pass on your own accounts: create a request with a file, accept it, update it, watch the tracking page change, deliver a file and download it. The two things I could not verify offline: the Cloudinary download link for non-image files, and Supabase Realtime delivery to a real browser.
