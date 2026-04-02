# Zuzzkin's Kitchen — Website

The official website for Zuzzkin's Kitchen, a home bakery in Kingston Springs, TN.  
Built with [Astro](https://astro.build), deployed via Git push.

---

## 🚀 Quick Start

```sh
npm install         # Install dependencies
npm run dev         # Start local dev server at localhost:4321
npm run build       # Build production site → dist/
npm run preview     # Preview the production build locally
```

---

## 📋 Content Management

All site content (stops, photos, site info) is managed via `manage.sh`.

```sh
./manage.sh help    # Full command reference
```

### Common operations

```sh
# Add a market stop
./manage.sh stops add "2026-04-15" "Kingston Springs Market" "Kingston Springs, TN" "9:00 AM – 12:00 PM"

# List upcoming stops
./manage.sh stops list

# Update contact email
./manage.sh info set contactEmail "hello@zuzzkins.com"

# Update tagline
./manage.sh info set tagline "Always Homemade"

# Add a photo (file must be in public/ first)
./manage.sh photos add "newcake.jpg" "A beautiful layered cake"
```

---

## 🧪 Test Suite

Tests use Node.js built-in `node:test` — no external dependencies required.

| Script | What it does |
|--------|-------------|
| `npm test` | Pre-build tests (source validation) |
| `npm run test:post` | Post-build tests only (requires dist/) |
| `npm run test:build` | Build then run post-build tests |
| `npm run test:all` | Full suite: pre → build → post |

### Pre-build tests (`tests/pre-build.test.mjs`)

Validates source files *before* building:

- `content.json` exists and is valid JSON
- Required site fields present (tagline, location, email)
- All photos have `src` + `alt` attributes
- All photo `src` files exist in `public/`
- All market stops have required fields (id, venue, location, time)
- Key source files exist (Layout.astro, index.astro, etc.)

### Post-build tests (`tests/post-build.test.mjs`)

Validates `dist/` output *after* building:

- `dist/` exists and contains `index.html`
- All HTML files have valid structure (doctype, html/head/body tags)
- Lighthouse basics: `<title>`, meta description, meta viewport, charset
- Critical content: business name, contact email, location all present
- Internal links resolve to real files (no broken hrefs)
- Image `src` attributes point to real files in dist/
- 404 page check (soft warning if missing)
- Build artifacts exist (assets or inline styles)

---

## 🚢 Deploy Pipeline

Deployment runs tests, builds, tests again, then pushes to Git.  
The remote Git server handles the actual site publish.

```sh
npm run deploy              # Full pipeline: test → build → test → deploy
npm run deploy:dry          # Same, but skip the git push (safe preview)

# Or call the script directly for more options:
./scripts/deploy.sh --dry-run
./scripts/deploy.sh --message "Add: Spring market dates"
./scripts/deploy.sh --skip-pre-tests   # Faster for content-only deploys
```

### Pipeline steps

```
Step 1/4 — Pre-build tests      (source validation)
Step 2/4 — Build                (npm run build → dist/)
Step 3/4 — Post-build tests     (HTML, links, content checks)
Step 4/4 — Deploy               (git add -A && git commit && git push)
```

If any step fails, the pipeline stops before deploying. The site is never
pushed in a broken state.

### Environment variables

| Variable | Effect |
|----------|--------|
| `DEPLOY_MSG` | Override commit message |
| `SKIP_DEPLOY=1` | Equivalent to `--dry-run` |

### Using `manage.sh deploy`

The legacy `./manage.sh deploy "message"` still works — it does a simple
`git add -A && git commit && git push` without running tests.

For content-only updates (adding stops, photos), you can still use it. For
code changes, use `npm run deploy` to get the full safety net.

---

## 📁 Project Structure

```
/
├── public/             Static assets (images, icons, favicon)
├── src/
│   ├── components/     Astro components (Hero, Gallery, Contact, Footer…)
│   ├── data/
│   │   └── content.json  All editable site content (managed via manage.sh)
│   ├── layouts/
│   │   └── Layout.astro  HTML shell (head, meta, body)
│   ├── lib/
│   │   └── content.ts    Content loader
│   ├── pages/
│   │   └── index.astro   Homepage
│   └── styles/
│       └── global.css
├── tests/
│   ├── pre-build.test.mjs   Source validation tests
│   └── post-build.test.mjs  Build output tests
├── scripts/
│   └── deploy.sh            Deploy pipeline script
├── manage.sh               Content management CLI
├── astro.config.mjs
└── package.json
```

---

## 🧞 All npm Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build production site to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm test` | Run pre-build source tests |
| `npm run test:post` | Run post-build HTML/content tests |
| `npm run test:build` | Build + run post-build tests |
| `npm run test:all` | Full test suite (pre + build + post) |
| `npm run deploy` | Full pipeline (tests → build → deploy) |
| `npm run deploy:dry` | Full pipeline without actual deploy |
