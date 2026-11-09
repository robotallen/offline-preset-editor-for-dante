# 08 — The desktop app (macOS and Windows)

## Why Tauri, not Xcode

The user asked for an Xcode app that would also run on Windows. Xcode can't do that: its native interface frameworks (SwiftUI and AppKit) only exist on Apple platforms. The options offered were a Mac-only Xcode app, a full native rewrite, or one cross-platform project. The user chose the last.

**Tauri 2** was used because:
- It reuses the tested editor page unchanged in substance, so the same `src/index.html` runs in a browser and in the app.
- On a Mac it uses the system WebKit (WKWebView), and on Windows Microsoft's WebView2 (Edge). Installers are small, around 5–10 MB, compared with about 100 MB for Electron.
- The menus, dialogs and file access are native, written in Rust.
- One project produces a `.app`/`.dmg` for macOS (Apple Silicon and Intel in one) and `.exe`/`.msi` installers for Windows.

## How the two halves talk

```
 src/index.html  (editor UI, JS)                       src-tauri/src/lib.rs  (Rust)
 ─────────────────────────────────                     ─────────────────────────────
 invoke("open_dialog",{dir})            ───────────▶   native Open dialog → path | null
 invoke("save_dialog",{suggested,dir})  ───────────▶   native Save dialog → path | null
 invoke("read_file",{path})             ───────────▶   read text
 invoke("write_file",{path,contents})   ───────────▶   write via temp file + rename (atomic)
 invoke("ask_dialog",{message})         ───────────▶   native OK/Cancel → bool
 invoke("set_title",{title})            ───────────▶   window title ("• file.xml – …" when unsaved)
 invoke("frontend_ready")               ───────────▶   marks the page as listening; returns files the app was launched with
 invoke("close_app")                    ───────────▶   exit

 listen("menu", id)                     ◀───────────   menu item clicked: new, open, save, save_as, revert, copy_xml, overview, add_devices
 listen("open-paths", [paths])          ◀───────────   file dropped on the window, or opened from Finder/Explorer while running
 listen("close-requested")              ◀───────────   window close, Quit, Exit or Dock Quit; the page asks about unsaved changes, then calls close_app
```

`withGlobalTauri: true` exposes `window.__TAURI__` to the page, so there's no JS bundler or npm packages in the front end. The page detects the app with `const APP = !!(window.__TAURI__ && window.__TAURI__.core)`.

### In the page (`src/index.html`, section "Files: open, save over, save as")
- **The open file** is kept as `fileHandle = {name, read(), write(text), path?|handle?}`, made by `nativeFile(path)` (app) or `webFile(handle)` (Chrome/Edge). Save, Save as, Revert and the title code work the same in every mode.
- **`ask(message)`** replaces the browser's `confirm()`. It's async, and uses the native dialog in the app. A native web view doesn't reliably show `confirm()`, which is why every confirmation was converted.
- **Menu items and keyboard shortcuts** both go through `runAction(id)`. A 500 ms guard stops one key press running twice when both the menu accelerator and the page see it.
- The desktop wiring is at the end of the file in the section "Desktop app wiring (Tauri)".

### In Rust (`src-tauri/src/lib.rs`)
- **Menu:**
  - App menu on a Mac (About, Services, Hide, Quit).
  - File: New, Open, Save, Save As, Revert to Saved, Copy Preset XML, and Exit on Windows.
  - Edit: undo, redo, cut, copy, paste and select all. These **are required on a Mac** or copy and paste won't work in text boxes.
  - View: Routing Overview, Add Devices.
  - Window, and Help/About on Windows.
- **Quit goes through the page:** Quit is a custom item, and window-close and Dock-quit are intercepted, so the page can check for unsaved changes. If the page isn't listening yet (`ready == false`), closing just closes, so a broken page can never trap the user.
- **Opening files from outside:** startup arguments (Windows "Open with", or a file dropped on the .exe) and `RunEvent::Opened` (macOS Finder) are queued until the page calls `frontend_ready`, then sent as `open-paths`.
- **Saving** writes to `file.xml.saving` first, then renames it over the original, so a failed save can't leave half a preset.

## File association

The app deliberately **doesn't register itself as the handler for `.xml`**. That would take over every XML file on a Windows PC. Use Open With, drag and drop, or File → Open. Registering a custom extension would need Dante Controller to accept it too, and it only works with `.xml`.

## Tested so far

- **Linux, under a virtual display:**
  - The app compiles, launches and opens the file it's launched with.
  - The native menu works, and Ctrl+S saves over the file (byte-identical when nothing changed).
  - The native Open dialog opens in the current file's folder, filtered to Dante presets.
  - The window title shows the file name and an unsaved marker.
  - Closing with unsaved changes shows the native question; Cancel keeps the window open.
  - After saving, the window closes straight away and no temp files are left.
  - A release `.deb` package was built to validate the packaging config.
- **Not run here:** the Mac- and Windows-specific builds. A Mac and a Windows PC weren't available, and the Rust toolchains for those targets couldn't be downloaded in that environment. The Mac-only code (app menu items, Finder open events) was checked against the Tauri 2.12 source. The GitHub workflow builds both on real Mac and Windows machines.
- **Also found while testing:** WebKit (Safari, and the Mac app) won't rotate a `<button>` sideways, so the vertical Tx device names in the routing overview were blank. They're now `<span role="button" tabindex="0">`, which fixes the browser version in Safari too.

## Signing (optional, removes the security warnings)

- **macOS:**
  - Join the Apple Developer Program, create a "Developer ID Application" certificate, and set `bundle.macOS.signingIdentity` to it. It's currently `"-"`, an ad-hoc signature.
  - For notarisation, add the `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password) and `APPLE_TEAM_ID` environment variables or GitHub secrets. tauri-action notarises automatically when they're present. See <https://v2.tauri.app/distribute/sign/macos/>.
- **Windows:** use a code-signing certificate (an OV/EV certificate, or Azure Trusted Signing). See <https://v2.tauri.app/distribute/sign/windows/>.

## Changing things

- **The editor UI:** edit `src/index.html`, then run `npm test` and `npm run dev`. The same file is the browser version.
- **The app name, window size or version:** `src-tauri/tauri.conf.json`, plus the version in `src-tauri/Cargo.toml` and `package.json`.
- **The icon:** replace `icon-source.png` (1024×1024), then run `npm run icons`. Then delete `src-tauri/icons/android` and `src-tauri/icons/ios`, which aren't needed.
- **Adding a native feature:** add a `#[tauri::command]` in `lib.rs`, register it in `generate_handler![…]`, and call it from the page with `invoke(...)`.
