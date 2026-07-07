# Contributing to Fiber Merchant Kit

Thank you for considering contributing to Fiber Merchant Kit. This document outlines the development workflow, code standards, and processes for this project.

## Table of Contents

- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [License](#license)

---

## Project Structure

This is a monorepo managed with **npm workspaces**. The packages live under `packages/`:

| Package | Description | Language |
|---|---|---|
| `packages/sdk-typescript` | TypeScript SDK (`@fiber-merchant/sdk`) | TypeScript |
| `packages/api-server` | REST API Server | TypeScript |
| `packages/admin-dashboard` | React admin dashboard | TypeScript / React |
| `packages/demo-store` | Demo e-commerce storefront | TypeScript / React |
| `packages/sdk-python` | Python SDK (`fiber-merchant`) | Python |

---

## Development Setup

### Prerequisites

- Node.js 18+ and npm 9+
- Python 3.9+ (for Python SDK work)

### Clone and Install

```bash
git clone <repo-url>
cd fiber-merchant-kit
npm install
```

This installs dependencies for all npm workspace packages.

### Environment Files

Each package that requires environment variables includes an `.env.example` file. Copy it to `.env` in the respective package directory:

```bash
cp packages/api-server/.env.example packages/api-server/.env
cp packages/admin-dashboard/.env.example packages/admin-dashboard/.env
cp packages/demo-store/.env.example packages/demo-store/.env
```

Or use the start script which does this automatically:

```bash
# macOS / Linux
./start.sh

# Windows PowerShell
.\start.ps1
```

---

## Development Workflow

### Running Individual Packages

Each package can be developed independently:

```bash
# API Server (http://localhost:3001)
npm run dev --workspace=packages/api-server

# Admin Dashboard (http://localhost:5173)
npm run dev --workspace=packages/admin-dashboard

# Demo Store (http://localhost:5174)
npm run dev --workspace=packages/demo-store

# TypeScript SDK (watch mode)
npm run dev --workspace=packages/sdk-typescript
```

### Running Everything Together

```bash
npm run dev
```

Or use the convenience scripts:

```bash
# macOS / Linux
./start.sh

# Windows PowerShell
.\start.ps1
```

### Building

```bash
# Build all packages
npm run build

# Build a specific package
npm run build --workspace=packages/api-server
```

---

## Code Standards

### TypeScript

- **Strict mode** is enabled across all packages (`strict: true` in `tsconfig.base.json`)
- All code must pass `tsc --noEmit` without errors
- Use modern ES2022 features
- Prefer `const` over `let` where possible
- Use explicit return types on public functions

### Code Style

- **2-space indentation**
- **Semicolons** are required
- **Single quotes** for strings
- **Trailing commas** in multiline objects and arrays
- Follow the conventions established in existing code

### Naming Conventions

| Convention | Example |
|---|---|
| `camelCase` for variables, functions, methods | `createInvoice`, `getBalance` |
| `PascalCase` for classes, types, interfaces | `MerchantClient`, `InvoiceStatus` |
| `UPPER_SNAKE_CASE` for constants | `MAX_RETRIES`, `DEFAULT_EXPIRY` |
| `kebab-case` for file names | `webhook-delivery.ts`, `fiber-client.ts` |

### Imports

- Use `import` syntax (ES modules)
- Group imports: third-party modules first, then internal modules with a blank line separator
- No unused imports

### Logging and Output

The API server outputs startup information and status messages to the console. Use plain text only -- no emoji characters or unicode box-drawing in log output. Prefer simple ASCII formatting.

### Python SDK

For the Python SDK (`packages/sdk-python`):

- Target Python 3.9+
- Follow PEP 8 style guidelines
- Use type hints for all functions
- Use `httpx` for HTTP requests

---

## Testing

### TypeScript Packages

Tests use **Vitest**. Run tests for all packages:

```bash
npm run test
```

Or for a specific package:

```bash
npm run test --workspace=packages/api-server
npm run test --workspace=packages/sdk-typescript
```

### Type Checking

Run the TypeScript compiler to check for type errors:

```bash
# All packages
npm run lint

# Specific package
npm run lint --workspace=packages/api-server
```

### API Integration Tests

A PowerShell test script is available to verify the API:

```powershell
.\test-api.ps1 -ApiKey fm_sk_YOUR_KEY
```

The API server must be running before executing this script.

### Manual Testing

The demo store (`http://localhost:5174`) provides end-to-end testing of the payment flow:

1. Start all services with `./start.sh` or `.\start.ps1`
2. Open the admin dashboard at `http://localhost:5173`
3. Enter the API key printed in the server logs
4. Create invoices, register webhooks, and monitor transactions
5. Open the demo store to run through the checkout flow

---

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following the code standards above.

3. **Run the type checker and tests** before committing:
   ```bash
   npm run lint
   npm run test
   ```

4. **Write or update tests** for any new functionality.

5. **Keep pull requests focused** on a single concern. Split large changes into multiple PRs.

6. **Update documentation** if you change behavior or add features:
   - `README.md` for project-level changes
   - `docs/` for API or architecture changes
   - Package-level `README.md` for SDK changes

7. **Write a clear PR description** explaining:
   - What the change does
   - Why it's needed
   - How to test it

8. **Ensure all CI checks pass** before requesting review.

---

## License

By contributing to Fiber Merchant Kit, you agree that your contributions will be licensed under the MIT License.
