# ProjectGraph

Turns a GitHub repo into a living mind map of what to build next. Click an idea, preview the change, open a real PR.

**Coding agents and humans: start at [`docs/index.md`](docs/index.md).**

## Run it (no keys needed)

Requires Node 20+.

```bash
git pull
npm install
cp .env.example .env.local     # MOCK_MODE=true by default
npm run dev                    # http://localhost:3000
```

- Click **Try demo** on the home page, or open `http://localhost:3000/map/demo`.
- API check: `http://localhost:3000/api/maps/demo` returns the mock map.
- Before you push: `npm run build` must pass.

## Real mode

Set the keys in `.env.local` (see `.env.example` and `docs/ARCHITECTURE.md` §9) and set `MOCK_MODE=false`. Never commit `.env.local`.

## Who owns what

See `docs/PLAN.md` (roles) and `docs/ARCHITECTURE.md` §4 (files). Work on your own branch and merge small PRs into `main`.

## GitHub sign-in (connect your account and pick a repo)

1. Create an OAuth App at https://github.com/settings/developers → **New OAuth App**.
   - Homepage URL: your app URL. **Authorization callback URL: `<app url>/api/auth/callback`**.
   - GitHub allows one callback URL per app, so make one app for localhost (`http://localhost:3000/api/auth/callback`) and one for production.
2. Put the Client ID and a generated secret in `.env.local` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, and set `SESSION_SECRET` to any random 32+ character string.
3. Restart the dev server. The home page now shows **Connect GitHub**; after approving, pick one of your repos.

## Deploying (Vercel / DigitalOcean)

Set the same variables in the host's environment settings, plus `MONGODB_URI`. **`MOCK_MODE` must be `false`** in production.
With `MOCK_MODE=true`, every repo you enter shows the built-in sample map (the home page shows an amber banner when this is on).
Serverless hosts forget in-memory data between requests, so real mode needs `MONGODB_URI`. Set `APP_URL` to the public URL if sign-in redirects look wrong.
