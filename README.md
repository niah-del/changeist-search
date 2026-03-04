# Changeist Community Search Tool

An embeddable search widget for community service opportunities — volunteer work, jobs, internships, and events. Results are ranked:

1. **Internal listings** (Changeist's own) — always on top
2. **Sponsored listings** (paid advertisers) — above web results
3. **Web results** (Google Programmable Search Engine) — bottom

---

## Quick Setup (5 steps)

### Step 1 — Create accounts (all free to start)

| Service | Purpose | Link |
|---|---|---|
| Vercel | Hosts the API and widget | https://vercel.com |
| Supabase | Database + admin dashboard | https://supabase.com |
| Serper.dev | Web results (real Google) | https://serper.dev |

---

### Step 2 — Set up the database (Supabase)

1. Create a new Supabase project
2. Go to **SQL Editor** in the Supabase dashboard
3. Paste and run the contents of `supabase-schema.sql`
4. Copy your **Project URL** and **service_role key** from **Settings → API**

---

### Step 3 — Set up web search (Serper.dev)

1. Go to https://serper.dev and sign up (free — 2,500 queries included)
2. Copy your **API key** from the dashboard
3. Paste it as `SERPER_API_KEY` in your Vercel environment variables

---

### Step 4 — Deploy to Vercel

```bash
# Install Vercel CLI if you don't have it
npm i -g vercel

# From the changeist-search folder
cd changeist-search
npm install
vercel deploy
```

When Vercel prompts you, set these **environment variables**:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase `service_role` key |
| `SERPER_API_KEY` | Your Serper.dev API key |
| `ADMIN_SECRET` | A long random string you choose (e.g. `openssl rand -hex 32`) |
| `INTERNAL_EMBED_KEY` | Another secret for changeist.org's own embed (e.g. `changeist-internal`) |

---

### Step 5 — Embed on changeist.org

In your Webflow/Squarespace/Wix site settings, add this to any page or the global footer:

```html
<div id="changeist-search"></div>
<script
  src="https://YOUR-VERCEL-URL.vercel.app/widget.js"
  data-api-key="changeist-internal"
></script>
```

Replace `YOUR-VERCEL-URL` with your actual Vercel deployment URL.

To use a custom subdomain like `search.changeist.org`, add a CNAME in your DNS settings pointing to `cname.vercel-dns.com`, then add the domain in Vercel settings.

---

## Sharing the widget with other sites

Give partner organizations an API key:

1. In Supabase **Table Editor** → `embed_keys` → Insert row:
   - `key`: a unique secret (generate with `openssl rand -hex 16`)
   - `org_name`: their organization name
   - `site_url`: their website

2. Send them these two lines of code:
   ```html
   <div id="changeist-search"></div>
   <script
     src="https://search.changeist.org/widget.js"
     data-api-key="THEIR_KEY"
   ></script>
   ```

To revoke access, set `is_active = false` on their row in Supabase.

---

## Managing listings

All listing management is done through the **Supabase Table Editor** (no code needed).

### Add a new listing
Table Editor → `listings` → **Insert row**

| Field | Values |
|---|---|
| `title` | Name of the opportunity |
| `organization` | Who's offering it |
| `description` | Short description |
| `type` | `job`, `volunteer`, `internship`, or `event` |
| `location` | City, state or "Remote" |
| `url` | Link to apply or learn more |
| `priority` | `0` = internal Changeist listing, `1` = sponsored/paid |
| `is_active` | `true` = visible, `false` = hidden |
| `expires_at` | Auto-hides after this date (leave blank = never expires) |
| `tags` | Array of keywords, e.g. `{environment,youth}` |

### Mark a listing as sponsored
Set `priority = 1` — it will appear above web results but below internal listings.

### Hide a listing
Set `is_active = false` — it disappears from all search results immediately.

---

## Widget customization options

The `<script>` tag accepts optional `data-*` attributes:

```html
<script
  src="https://search.changeist.org/widget.js"
  data-api-key="YOUR_KEY"
  data-placeholder="Find your next opportunity..."
  data-theme="dark"
></script>
```

| Attribute | Default | Options |
|---|---|---|
| `data-api-key` | _(required)_ | Your embed key |
| `data-placeholder` | "Search volunteer, job..." | Any text |
| `data-theme` | `light` | `light` or `dark` |
| `data-api-url` | auto-detected | Override API base URL |

---

## API Reference

### `GET /api/search`
```
GET /api/search?q=volunteer&key=YOUR_KEY&type=volunteer&location=New York
```

| Param | Required | Description |
|---|---|---|
| `q` | yes | Search query |
| `key` | yes | Embed API key |
| `type` | no | Filter: `job`, `volunteer`, `internship`, `event` |
| `location` | no | Filter by location (partial match) |

**Response:**
```json
{
  "query": "volunteer",
  "total": 12,
  "results": [
    {
      "id": "...",
      "title": "Community Garden Volunteer",
      "organization": "Changeist",
      "description": "...",
      "type": "volunteer",
      "location": "Brooklyn, NY",
      "url": "https://...",
      "priority": 0,
      "source": "internal"
    }
  ]
}
```

The `source` field indicates result origin: `"internal"`, `"sponsored"`, or `"web"`.

### `GET /api/listings` (admin)
```
GET /api/listings?secret=YOUR_ADMIN_SECRET
```

### `POST /api/listings` (admin)
```
POST /api/listings?secret=YOUR_ADMIN_SECRET
Content-Type: application/json

{
  "title": "Beach Cleanup Volunteer",
  "organization": "Ocean Guardians",
  "type": "volunteer",
  "location": "Miami, FL",
  "url": "https://...",
  "priority": 1,
  "tags": ["environment", "ocean"]
}
```

### `PATCH /api/listings?id=<uuid>` (admin)
Update any field of an existing listing.

### `DELETE /api/listings?id=<uuid>` (admin)
Soft-deletes (deactivates) a listing.

---

## File structure

```
changeist-search/
├── pages/api/
│   ├── search.js          # Main search endpoint
│   └── listings.js        # Admin CRUD endpoint
├── public/
│   ├── widget.js          # Embeddable widget (vanilla JS)
│   └── widget.css         # Widget styles
├── lib/
│   ├── supabase.js        # Supabase client
│   └── google-search.js   # Google CSE wrapper
├── supabase-schema.sql    # Run this in Supabase SQL Editor
├── next.config.js
└── package.json
```
