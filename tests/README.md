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
