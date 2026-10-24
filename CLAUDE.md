# Working on this node

## Before pushing any change to `nodes/`

All of these must pass: `npm run lint`, `npm run format:check`, `npm run build`, `npm run typecheck`, `npm test`.
Do not loosen or skip `test/api-contract.test.ts`; fix the node instead, and add or update a test for each fix.

## n8n conventions

- Optional inputs go in a collection ("Additional Fields" on create, "Update Fields" on update), not as top-level fields. Required inputs are top-level.
- Do not mark a parameter `required` when an empty value is meaningful (for example, empty unsets the setting).
- Lists are entered as a comma-separated string or JSON array and sent as an array via `parseStringList`.
- Enumerations the spec limits are `options` / `multiOptions` with exactly the spec's values.
- Options and collection entries are sorted by display name; every parameter has a description.
- Follow the surrounding code's patterns rather than inventing new ones.

## Testing beyond the mock

Unit tests use a mock execute context and prove request bodies only. For any change that adds or alters node parameters, also:

1. Load the node in a real n8n. `n8n-node dev` did not finish installing in the routine's environment, so use this tested recipe instead:
   - Install n8n once, outside the repo: `mkdir -p /tmp/n8n-check && cd /tmp/n8n-check && npm init -y && npm install n8n --no-audit --no-fund` (about 5 minutes; skip it if the environment already has n8n installed).
   - `npm run build`, then link the repo as a custom node: `mkdir -p /tmp/n8n-user/.n8n/custom && ln -sfn "$PWD" /tmp/n8n-user/.n8n/custom/appwrite`.
   - Start n8n in the background with `HOME=/tmp/n8n-user N8N_USER_FOLDER=/tmp/n8n-user N8N_LISTEN_ADDRESS=0.0.0.0 N8N_DIAGNOSTICS_ENABLED=false setsid nohup /tmp/n8n-check/node_modules/.bin/n8n start > /tmp/n8n-run.log 2>&1 &`. `N8N_LISTEN_ADDRESS=0.0.0.0` is needed because the environment has no IPv6, and without it n8n exits right after starting. Wait for `curl localhost:5678/healthz` to return `{"status":"ok"}`.
   - Create a throwaway owner (`POST /rest/owner/setup` with email, firstName, lastName, password; keep the cookie), then `GET /types/nodes.json` with the cookie. The node loaded if it lists `CUSTOM.appwrite`. Inspect its `properties` for the new fields and their `displayOptions`.
   - To go further, run `node scripts/mock-appwrite.mjs` (a fake Appwrite API on port 4010 that logs each request), create an `appwriteApi` credential pointing at `http://127.0.0.1:4010/v1`, save a workflow with the changed operations (`POST /rest/workflows`), run it (`POST /rest/workflows/<id>/run` with `workflowData` and `triggerToStartFrom`), and read the logged request bodies.
   - Stop n8n and the mock server when done. Do not use `pkill -f` with a pattern that also appears in your own command line; it kills your shell.
2. Check that new fields exist where intended, show only for the right resource/operation/type, and send the right values in the logged requests. This verifies the node's definition and a real n8n execution, not how the editor looks. Say so in the PR; do not claim a visual check of the editor.
3. If a live Appwrite server is not available, say so in the PR; never claim the node was tested in n8n if it was not.

State plainly in the PR what was verified (lint, unit tests, n8n load, editor check) and what was not.
