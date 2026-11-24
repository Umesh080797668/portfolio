# Work tracking, file intake and admin dashboard

Visitors can send requests with files, you accept them and issue a tracking code, and both of you follow the work live.

```
Visitor browser ──► PUBLIC server (port 3000) ──► Supabase (database)
        │                                    └──► Cloudinary (private files)
        └─ uploads files straight to Cloudinary with a one-time signature

You ──► ADMIN server (port 3001, localhost / private network only) ──► same Supabase + Cloudinary
```

The admin dashboard is a **separate server**. There is no admin code, route or link on the public website.

## 1. Install

```bash
npm install
cp .env.example .env     # then fill in every value
```

## 2. Supabase

1. Create a project at supabase.com.
2. SQL Editor -> paste `supabase/schema.sql` -> Run. (Tables are created with Row Level Security on and no policies, so the public key can read nothing.)
3. Authentication -> Providers -> Email: **turn OFF "Allow new users to sign up"**.
4. Authentication -> Users -> **Add user** with your admin e-mail and a long password (tick auto-confirm).
5. Copy into `.env`: Project URL (`SUPABASE_URL`), anon key (`SUPABASE_ANON_KEY`), service_role key (`SUPABASE_SERVICE_ROLE_KEY`).
6. Put the same e-mail in `ADMIN_EMAILS`.

## 3. Cloudinary

Copy cloud name, API key and API secret from Settings -> API Keys into `.env`. Files are stored as `authenticated` (private); nobody can open them without an expiring link created by the server. Free plans accept 10 MB per file (`MAX_FILE_MB`).

## 4. Generate the upload secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
Paste the result in `UPLOAD_TOKEN_SECRET`.

## 5. Run

```bash
npm start
# Public site + API:  http://localhost:3000
# Admin dashboard:    http://127.0.0.1:3001   (first login asks you to set up an authenticator app)
```

Run the tests any time with `npm test`.

## Daily use

| Situation | What you do |
|---|---|
| Visitor sends a request on the website | Admin -> open the request -> **Accept & issue tracking code** -> **Send via WhatsApp** (message with code + link is prepared) |
| Client contacted you on WhatsApp / phone | Admin -> **+ New order** (leave "Issue a tracking code now" ticked) -> send the code |
| Work progresses | Open the order -> **Post an update** (status, progress, message). The visitor's page changes instantly. Untick "Show to the client" for private notes |
| Work finished | **Upload for client**; they download it from their tracking page |
| Code shared by mistake | **New code**; the old one stops working at once |

Clients open `https://yoursite/?track=TAL-XXXXX-XXXXX#track` or type the code in the Track section.

## Where secrets live

| Secret | Where | Reaches browser? |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_SECRET`, `UPLOAD_TOKEN_SECRET` | `.env` on the server only | Never |
| `SUPABASE_ANON_KEY` | `.env`, sent to the admin login page | Yes by design (it can access nothing, because of Row Level Security) |
| `FORMSPREE_FORM_ID`, `WHATSAPP_NUMBER` | `.env`, served through `/config.js` | Yes (not secret) |

`.env` is in `.gitignore`. Commit only `.env.example`. **If a real key was ever committed or pasted somewhere, rotate it.** The Formspree id that used to be hard-coded in `index.html` stays in your Git history; create a new Formspree form if that matters to you.

## Security design

* **Admin separated from visitors**: own port/server, `ADMIN_BIND_HOST=127.0.0.1` by default. Expose it only through a VPN, Tailscale, Cloudflare Access or an IP-restricted admin sub-domain.
* **Admin login**: Supabase Auth + mandatory TOTP two-factor (`ADMIN_REQUIRE_MFA=true`). The server verifies the token with Supabase on every request, requires a confirmed e-mail, an e-mail in `ADMIN_EMAILS`, and a two-factor session.
* **Audit log** of every admin action and denied attempt (Admin -> Audit log).
* **No database access for visitors**: the database is reachable only from the server (service role). Visitors get a minimal view of one order: no phone, e-mail, internal notes.
* **Tracking codes**: 10 random characters (about 2^49 combinations), rate limited, identical "not found" answer for every wrong code. Codes are only created when you accept.
* **Files**: private storage, signed one-time uploads, folders and file names chosen by the server, size/type re-checked against Cloudinary after upload, executables blocked, expiring download links, admin downloads logged.
* **Web hardening**: strict Content-Security-Policy (the admin page allows no external or inline scripts), no inline scripts on the public page, CORS allow-list, request size limits, rate limits, honeypot against bots, all user text shown with `textContent`.

## Hosting notes

* Run behind HTTPS (Render, Railway, Fly.io, a VPS with Caddy/nginx). Set `TRUST_PROXY=1` behind one proxy.
* GitHub Pages alone cannot run this backend. If the static site stays on GitHub Pages, deploy the Node server elsewhere, set `PUBLIC_API_BASE` and `CORS_ORIGINS`, and run `npm run build:config` to create `config.js` for the static site.
* Rate limits and live streams live in the memory of one process. Run one instance (or add a shared store before scaling out).
* Files uploaded but never submitted stay in the `incoming` folder of Cloudinary. Delete old ones from the Cloudinary console from time to time (a lifecycle rule can do this).
* Realtime: run the last block of `supabase/schema.sql` so changes made directly in Supabase also update open tracking pages.

## Not tested against live services

The automated tests use an in-memory database, a fake storage and a fake login. Before going live, do one real pass: create a request with a file, accept it, update it, deliver a file and download it, on your real Supabase and Cloudinary accounts.
