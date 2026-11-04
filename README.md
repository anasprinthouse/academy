# Iqbal Online Quran Academy

Website and admissions admin panel for **Iqbal Online Quran Academy**: one-on-one online Quran classes (Noorani Qaida, Nazra with Tajweed, Hifz, Translation & Tafseer, Islamic Studies, Namaz & Duas) for kids and adults worldwide.

- **Website** (`/`): course info, female teacher section, free trial, contact, and an admission form.
- **Admin panel** (`/admin`): password-protected dashboard where every admission from the website appears.

Built to run on **Vercel** (free Hobby plan) with **Upstash Redis** (free tier) as the database. No build step and no npm packages.

---

## Features

### Website
- Admission form: student name, age, gender, country, WhatsApp number, course, preferred teacher (male/female), class time, message
- On submit, the admission is saved to the database **and** WhatsApp opens with the details pre-filled
- Hidden spam-trap field and per-connection rate limit (8 forms per hour)
- "Enroll" buttons pre-select the course; "Request a female teacher" pre-selects a female teacher
- Mobile friendly, light and dark mode

### Admin panel (`/admin`)
- Password login, session kept for 12 hours (secure HttpOnly cookie)
- Login rate limit: 10 attempts per 15 minutes
- Summary: waiting for reply, new this week, trial scheduled, enrolled, female teacher requests
- Status pipeline: **New → Contacted → Trial scheduled → Enrolled / Not interested**
- Search and filter by status, course and teacher
- Student detail: one-tap WhatsApp message, copy number, private admin notes, delete
- Demand by course and top countries
- Export to CSV (opens in Excel / Google Sheets)
- Auto-refresh every 90 seconds

---

## Project structure

```
.
├── index.html          # Public website + admission form
├── admin/
│   └── index.html      # Admin panel (served at /admin)
├── api/
│   ├── _lib.js         # Shared helpers: database, sessions, rate limits (not a public route)
│   ├── admission.js    # POST /api/admission  (public: saves a form)
│   └── admin.js        # /api/admin?action=login|logout|list|update|delete  (admin only)
├── package.json
├── vercel.json         # Clean URLs + security headers, /admin set to noindex
└── README.md
```

---

## Deploy to Vercel

### 1. Import the repo
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New → Project**, pick this repository, click **Import**.
3. Leave every setting as it is (Framework: *Other*, no build command) and click **Deploy**.

### 2. Add the database (free)
1. Open the project → **Storage** tab → **Create Database**.
2. Choose **Upstash for Redis** → Free plan → create it.
3. Click **Connect to project** and select this project.

This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically. (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work.)

### 3. Set the admin password
Project → **Settings → Environment Variables** → add:

| Key | Value | Required |
|---|---|---|
| `ADMIN_PASSWORD` | a strong password only staff know | Yes |
| `SESSION_SECRET` | any long random text | Recommended |

### 4. Redeploy
**Deployments** tab → top deployment → **⋯ → Redeploy**. Environment variables only take effect after a redeploy.

### 5. Test
1. Open the site, fill the admission form once.
2. Open `/admin`, sign in, and check the admission is there.

If something is missing, `/admin` shows exactly which step is not done (password or database).

### 6. Custom domain (optional)
Project → **Settings → Domains** → add `iqbalonlinequranacademy.com` (and `www.`). Add the DNS records Vercel shows at your domain provider, usually:

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Wait until Vercel shows **Valid Configuration**. HTTPS is added automatically.

---

## Everyday use

- Changing the password: update `ADMIN_PASSWORD` in Vercel, then redeploy. Everyone gets signed out.
- Updating the website: edit files on GitHub and commit. Vercel redeploys automatically.
- Backups: use **Export CSV** in the admin panel regularly.

## Settings in code

In `index.html`, near the bottom:

```js
var WHATSAPP = "923451020391";          // WhatsApp number that receives admissions
var ADMISSION_API = "/api/admission";   // where the form saves data (leave as is)
```

Contact details shown on the site: **0345 1020391**, **muftishahzaib786@gmail.com**.

## API reference

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/admission` | none | Save an admission (JSON body with form fields) |
| POST | `/api/admin?action=login` | none | `{ "password": "..." }` → sets session cookie |
| POST | `/api/admin?action=logout` | cookie | Clears the session |
| GET | `/api/admin?action=list` | cookie | All admissions |
| POST | `/api/admin?action=update` | cookie | `{ "id", "status"?, "notes"? }` |
| POST | `/api/admin?action=delete` | cookie | `{ "id" }` |

Admissions are stored in one Redis hash, `admissions`, keyed by id.

## Known limits
- No email or SMS alert on new admissions yet; check the admin panel ("Waiting for reply").
- Single shared admin password (no separate staff accounts).
- Upstash free tier allows 10,000 commands per day, far more than an academy needs.
