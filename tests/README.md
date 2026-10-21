# Pricing Regression Checks

- Node 22.6+ is required for the dependency-free TypeScript tests: `pnpm test`.
- Start the admin dev server, then open its local URL with `playwright-cli open`.
- Run `playwright-cli run-code --filename tests/pricing.browser.js`.

The browser check uses isolated fixtures, then mocks all `/api/v1/` requests on
the real ModelsPage. It never updates a real model or calls a paid provider.
Screenshots are written to `output/playwright/`.

The repository-wide lint currently reports pre-existing `set-state-in-effect`
errors in `WorkspacesPage.tsx` (lines 83 and 105); the pricing files pass lint.

Google Standard rates mirror backend `internal/catalog/google_images.go`.
Cost previews are image-output-only examples, not task preauthorization quotes.
Production still requires deployment and an explicit model configuration save.

## Business ability browser checks

Start a local server with `pnpm dev`, then open an isolated browser session:

```sh
npx --yes --package @playwright/cli playwright-cli --session abilities open http://127.0.0.1:5273/login
pnpm test:abilities:browser
```

The script mocks every `/api/v1/` endpoint. It verifies second-page default
model candidates, editable public and execution bindings, arbitrary business names, renamed model
operations, pending default compatibility, duplicate-operation errors, tool creation
payloads, disabled assigned
abilities, explicit `ability_codes: []`, default-detach protection, read-only
permissions, UTF-8 validation, enable/disable, error retry and responsive layout. Screenshots go to `output/playwright/`.
No real configuration or model execution requests are made.
