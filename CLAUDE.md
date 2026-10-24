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

1. Run `npx n8n-node dev --custom-user-folder <tmp dir>` (the first run installs n8n and takes several minutes) and confirm n8n loads the node without errors.
2. Open the node in the editor and check that new fields render where intended, show only for the right resource/operation/type, and send the right values.
3. If a live Appwrite server is not available, say so in the PR; never claim the node was tested in n8n if it was not.

State plainly in the PR what was verified (lint, unit tests, n8n load, editor check) and what was not.
