# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dave - Digital Assets Viewer Extraordiner is a client-side web application for viewing and managing digital assets (3D models, images, videos, audio files) in a grid layout. It runs directly in modern browsers without a build process.

## Development Commands

### Running the Application
```bash
# Recommended: Use npm script (from project root)
npm start

# Or use the startup scripts
./scripts/Dave.sh    # Linux/macOS
scripts\Dave.bat     # Windows

# Or run server directly
node scripts/server.cjs
```
Access at: http://localhost:7777/

**Server Details:**
- Default port: 7777
- CORS enabled for local development
- Serves static files with automatic MIME type detection
- Rewrites URLs for /src/ resources (e.g., /styles/ → /src/styles/)

### Running Tests
```bash
# From project root - runs all test suites with summary
npm test

# Or from tests directory for more control
cd tests/e2e
npm install                   # First time only
npx playwright install chromium  # First time only

# Run all tests
npm test

# Run specific test suites
npm run test:file-loading    # File loading tests
npm run test:ui             # UI interaction tests
npm run test:keyboard       # Keyboard navigation tests
npm run test:memory         # Memory and performance tests
npm run test:errors         # Error handling tests

# Debug/interactive modes
npm run test:watch          # Playwright UI mode
npm run test:debug          # Debug mode with stepping
npm run test:headed         # Show browser window
npm run test:report         # View HTML test report
```

**Note**: Tests expect the server running on port 8080. Start with `PORT=8080 node scripts/server.cjs`

## Architecture

### Module Structure & Data Flow
```
index.html (import maps)
    ↓
src/core/main.js (application entry point)
    ↓
    ├── src/core/ui.js (UI initialization & event handlers)
    │       ↓
    │   src/core/asset_loading.js (file processing orchestration)
    │       ↓
    │   src/handlers/AssetHandlerFactory.js (creates handlers)
    │       ↓
    │   src/handlers/*Handler.js (type-specific rendering)
    │
    ├── src/viewers/ (specialized viewers: FBX, folder tree)
    ├── src/utils/ (error handling, memory, keyboard shortcuts)
    ├── src/workers/folder_scanner_worker.js (async file scanning)
    └── src/core/state.js (application state)
```

**Key Directories:**
- `src/core/` - Application bootstrap and orchestration
- `src/handlers/` - Factory pattern for file type handling (all extend BaseAssetHandler)
- `src/utils/` - Reusable utilities (error handling, debounce, memory management, keyboard shortcuts)
- `src/viewers/` - Specialized viewers (FBX 3D viewer, tree folder view)
- `src/workers/` - Web workers for non-blocking operations
- `tests/e2e/` - Playwright test suites
- `examples/` - Sample files for testing and demo purposes

### Key Design Patterns & Architecture Decisions

**Factory Pattern for Asset Handling:**
- `AssetHandlerFactory.js` determines handler based on file extension
- All handlers extend `BaseAssetHandler.js` with common interface
- Each handler (Image, Video, Audio, Model3D, Font, Document) implements type-specific rendering
- Handlers are stateless; can be reused for multiple files

**Module Loading:**
- Pure ES6 modules, no transpilation or bundling
- Import maps (in index.html) for Three.js CDN resolution
- Server rewrites /styles/ → /src/styles/ for clean imports

**State & Events:**
- Minimal global state in `src/core/state.js`
- UI updates primarily event-driven
- Custom events for cross-module communication

**Performance Considerations:**
- Web Worker (`folder_scanner_worker.js`) prevents UI blocking during file scans
- Memory manager actively cleans up resources for large files/3D models
- Lazy loading of asset previews with pagination

### External Dependencies
- **Three.js v0.161.0**: 3D model rendering (loaded via CDN)
- **Font Awesome v6.0.0-beta3**: UI icons (loaded via CDN)
- No build tools or bundlers required

### Testing Strategy
- **Playwright**: E2E testing framework
- Tests located in `tests/e2e/` directory
- Test suites organized by functionality (file loading, UI, keyboard, memory, errors)
- Single worker configuration for predictable results
- Screenshots/videos captured on failure
- Test fixtures in `tests/fixtures/` and sample files in `examples/`
- Custom `run_tests.js` provides comprehensive test summary with colored output

### Debugging
The application includes a global debug system accessible via browser console:
```javascript
// Enable all debug logging
window.APP_DEBUG.enabled = true

// Enable specific module debugging
window.APP_DEBUG.modules.ui = true
window.APP_DEBUG.modules.assetLoading = true
window.APP_DEBUG.modules.treeFolderView = true

// Toggle debugging for a module
window.APP_DEBUG.toggle('ui')  // Toggle specific module
window.APP_DEBUG.toggle()      // Toggle global debugging
```

### Important Considerations
- **No build process**: Dependencies loaded via CDN using import maps
- **No linting/formatting** tools configured
- **Module loading**: ES6 modules with import maps for Three.js (defined in index.html)
- **State management**: Centralized in `src/core/state.js`, minimal global state
- **Error handling**: Centralized error handler utility (`src/utils/errorHandler.js`)
- **Memory management**: Active cleanup with `memoryManager` utility for large files
- **Web Workers**: `folder_scanner_worker.js` for non-blocking file system operations