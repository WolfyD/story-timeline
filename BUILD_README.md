# Story Timeline Build README

This file explains how to run the project scripts and how to produce build artifacts (portable executable and installer).

## Prerequisites

- Node.js (LTS recommended)
- npm
- Windows 10/11 (for native Windows artifacts)

Install dependencies:

```bash
npm install
```

## NPM Scripts

Defined in `package.json`:

- `npm run start`  
  Starts the Electron app normally (`electron .`).

- `npm run dev`  
  Starts Electron with `nodemon` and auto-reloads on `js/html/css` changes.

- `npm run rebuild`  
  Rebuilds native modules for Electron (`better-sqlite3`) using `electron-rebuild`.

- `npm run build`  
  Runs `electron-builder` using the `build` config in `package.json`.

- `npm test`  
  Runs all Jest tests.

- `npm run test:watch`  
  Runs Jest in watch mode.

- `npm run test:timeline`  
  Runs `timeline.test.js`.

- `npm run test:app`  
  Runs `app.test.js`.

- `npm run test:database`  
  Runs `database.test.js`.

## Build Configuration Summary

Current Electron Builder config (from `package.json`):

- `productName`: `Story Timeline`
- Windows targets:
  - `nsis` (installer)
  - `portable` (standalone executable)
- Build resources directory: `assets`
- Installer mode: assisted install (`oneClick: false`)

## Standard Build (Installer + Portable EXE)

From project root:

```bash
npm run build
```

This creates Windows artifacts for both configured targets:

- NSIS installer (`.exe`)
- Portable executable (`.exe`)

Output location:

- `dist/`

## Build Only Installer

```bash
npx electron-builder --win nsis
```

## Build Only Portable Executable

```bash
npx electron-builder --win portable
```

## Build Unpacked App Folder (No Installer)

Useful for quick validation/debugging:

```bash
npx electron-builder --dir
```

## Clean Rebuild Flow (Recommended if Native Module Issues)

If packaging fails due to native modules (`better-sqlite3`, `sharp`) or Electron ABI mismatches:

```bash
npm install
npm run rebuild
npm run build
```

## Typical Release Flow

1. Run tests:
   ```bash
   npm test
   ```
2. Rebuild native modules:
   ```bash
   npm run rebuild
   ```
3. Build release artifacts:
   ```bash
   npm run build
   ```
4. Validate output files in `dist/`.

## Notes

- Building on Windows is the most reliable way to produce Windows installer/portable artifacts.
- If Windows Defender/SmartScreen prompts appear for unsigned binaries, that is expected for unsigned local builds.
