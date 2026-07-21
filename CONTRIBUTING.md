# Contributing

Thanks for helping improve Open SAR Orbits!

## Ways to contribute

- **Registry fixes** — the highest-value contribution. See
  [docs/registry-guide.md](docs/registry-guide.md). Every value needs a public
  source; unknown values stay `null`.
- **Bug reports** — include browser/OS, backend logs, and
  `GET /api/metadata/status` output.
- **Features** — please open an issue first for anything larger than a fix;
  the phase roadmap in the README shows where the project is heading.

## Development setup

See the README quick-start. In short: `docker compose up --build`, or run the
backend (`pip install -e ".[dev]"`, `uvicorn app.main:app --reload`) and
frontend (`npm install && npm run dev`) separately.

## Quality gates (run before pushing)

Backend:

```bash
cd backend
ruff check app tests && black --check app tests && mypy app && pytest
```

Frontend:

```bash
cd frontend
npm run lint && npm run test && npm run build
```

CI runs the same commands on every PR.

## Conventions

- Small, focused modules; no Cesium imports outside `src/components/GlobeView.tsx`
  and friends.
- No live-network tests — use fixtures (`backend/tests/fixtures/`).
- Conventional, descriptive commit messages (`backend: guard empty OMM payload`).

## License

By contributing you agree your work is released under the MIT license.
