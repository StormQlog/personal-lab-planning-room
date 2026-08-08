# Personal Lab Planning Room

Public, generated view for the StormQlog Personal Lab planning workflow.

- Live site: https://stormqlog.github.io/personal-lab-planning-room/
- Planning source: private Markdown in the relevant repository
- Execution source: GitHub Issues
- Delivery evidence: pull requests and `main`
- Portfolio status: the linked GitHub Project and Issues

The Page has one primary action: generate and copy a self-contained Codex work request. The user pastes that request into the current Codex task; Codex then checks the selected private repository for instructions and concurrent work before updating its planning Markdown or creating an execution Issue. The Page does not store the draft, call Codex, or write to GitHub directly.

Linked Project, Issue, and planning sources are private. GitHub may display a 404 when the browser is not signed in as StormQlog; the public Page labels those links accordingly.

This repository contains only the reviewed static artifact and its validation/deployment code. It is not the source of truth for private planning and must never contain credentials, tokens, personal data, original recordings, or private work material.

## Local validation

```powershell
node scripts/validate-planning-room.mjs
node scripts/validate-planning-room.mjs --deploy
node --test tests/portal/planner-core.test.mjs tests/portal/status.test.mjs
```

## Publication flow

1. Update only public-safe fields in `portal/data/status.json`.
2. Review the full `portal/` artifact and record publication approval.
3. Run validation and tests.
4. Dispatch the `Planning Room` workflow from `main`.

The deployed site is an informational view. Generated HTML and status cards do not replace the private planning records, Issues, pull requests, or repository code.
