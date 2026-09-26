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
