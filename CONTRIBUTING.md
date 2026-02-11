# Contributing to Dave

Thanks for your interest in contributing to Dave! This guide will help you get started.

## Getting Started

### Prerequisites
- Node.js (for running the dev server)
- A modern browser (Chrome, Firefox, Edge)
- Git

### Development Setup

1. Fork and clone the repository
2. Start the development server:
   ```bash
   node scripts/server.cjs
   ```
3. Open http://localhost:7777/ in your browser

### Running Tests

Tests use Playwright and expect the server on port 8080:
```bash
cd tests
npm install
npx playwright install chromium
npm test
```

## How to Contribute

### Fork & Pull Request Workflow

1. Fork the repository on GitHub
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Commit with a descriptive message (see conventions below)
5. Push to your fork and open a Pull Request against `main`

### Commit Message Conventions

Use conventional commit prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `chore:` - Maintenance tasks
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests

Example: `feat: add drag-and-drop support for audio files`

### Pre-commit Hooks

This project uses pre-commit hooks for code quality and secret scanning. Set them up:

```bash
pip install pre-commit detect-secrets
pre-commit install
```

The hooks will automatically run on each commit to check for:
- Large files (>1MB)
- Merge conflict markers
- Trailing whitespace
- Private keys and secrets
- JSON/YAML validity

## Code Style

- No build tools or bundlers - ES6 modules loaded directly
- Follow existing patterns in the codebase
- Keep dependencies minimal (CDN-loaded only)

## Questions?

Open an issue for questions or discussions about potential changes.
