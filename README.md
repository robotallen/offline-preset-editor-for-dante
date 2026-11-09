# Offline Preset Editor for Dante — desktop app (macOS and Windows)

An offline editor for **Audinate Dante Controller preset files** (`.xml`). Open a preset exported from Dante Controller (File → Save Preset), or build one from scratch, then rename devices and channels, change routing, set static IPs and preferred leader, and save. Dante Controller can then load it (File → Load Preset) and apply it to real hardware.

It is a real desktop app with its own window and Dock or taskbar icon, a native menu bar, native Open and Save dialogs, and a prompt if you close with unsaved changes. The same editor still works as a single web page (`src/index.html`) if you open it in a browser.

> Not affiliated with, endorsed by or sponsored by Audinate. "Dante" and "Audinate" are trademarks of Audinate Pty Ltd. All other product and manufacturer names are trademarks of their owners and are used only to identify compatible hardware.

---

## Download

| | Direct download |
|---|---|
| **Mac** (Apple Silicon and Intel) | [Offline-Preset-Editor-for-Dante-macOS.dmg](https://github.com/robotallen/Dante-Preset-Editor/releases/latest/download/Offline-Preset-Editor-for-Dante-macOS.dmg) |
| **Windows** installer | [Offline-Preset-Editor-for-Dante-Windows-setup.exe](https://github.com/robotallen/Dante-Preset-Editor/releases/latest/download/Offline-Preset-Editor-for-Dante-Windows-setup.exe) |
| **Windows** portable (no install) | [Offline-Preset-Editor-for-Dante-Windows-portable.exe](https://github.com/robotallen/Dante-Preset-Editor/releases/latest/download/Offline-Preset-Editor-for-Dante-Windows-portable.exe) |

All releases: <https://github.com/robotallen/Dante-Preset-Editor/releases>. The app isn't code-signed yet, so see **First launch** below for the one-off warning on each platform.

## Support

If this saves you time, you can [buy me a coffee](https://buymeacoffee.com/YOUR_USERNAME).

## Licence

MIT, see `LICENSE`. Use at your own risk: work on a copy of your presets and always check them in Dante Controller before applying them to hardware.

## Building it yourself

### Option A: let GitHub build it (no tools needed on your computer)

1. Create a repository (or fork this one) and upload this whole folder to it (GitHub Desktop is the easiest way, or drag the files into the web page).
2. On the repository page, go to **Actions** → **Build desktop apps** → **Run workflow**.
3. After about 10–15 minutes, open the finished run and download from **Artifacts**:
   - **Dante-Preset-Editor-macOS**: a `.dmg` that runs on both Apple Silicon and Intel Macs
   - **Dante-Preset-Editor-Windows**: a `…setup.exe` installer, plus a `.msi`

To make a proper release later, push a tag such as `v1.0.1`. The same workflow then creates a draft Release with the installers attached.

### Option B: build it on your own computer

**Mac:**
1. Install the Xcode command-line tools: `xcode-select --install`
2. Install Rust: <https://rustup.rs>, then run `rustup target add aarch64-apple-darwin x86_64-apple-darwin`
3. Install Node.js 20 or later: <https://nodejs.org>
4. In this folder, run `npm install` and then `npm run build:mac`
5. The app is in `src-tauri/target/universal-apple-darwin/release/bundle/macos/`, and the `.dmg` is in `…/bundle/dmg/`.

**Windows:**
1. Install **Visual Studio Build Tools** with "Desktop development with C++": <https://visualstudio.microsoft.com/visual-cpp-build-tools/>
2. Install Rust (<https://rustup.rs>) and Node.js 20 or later (<https://nodejs.org>)
3. In this folder, run `npm install` and then `npm run build`
4. The installers are in `src-tauri\target\release\bundle\nsis\` (`.exe`) and `…\bundle\msi\`.

To try the app without packaging it, use `npm run dev`, which opens it straight away.

### First launch

- **Mac:** the app isn't signed with an Apple Developer certificate, so macOS will block it the first time. Right-click the app → **Open** → **Open**. On macOS 15 or later you may instead need System Settings → Privacy & Security → **Open Anyway**. If macOS says the app "is damaged", run `xattr -cr "/Applications/Dante Preset Editor.app"` in Terminal once.
- **Windows:** SmartScreen may say "Windows protected your PC". Click **More info** → **Run anyway**. The installer installs for your user only, so you don't need admin rights. It installs Microsoft's WebView2 component if it's missing, which Windows 10 and 11 normally already have.

Signing with an Apple Developer ID ($99 a year) and a Windows code-signing certificate would remove those warnings. `docs/08-desktop-app.md` explains how.

---

## Using it

| | Mac | Windows |
|---|---|---|
| New preset | ⌘N | Ctrl+N |
| Open | ⌘O | Ctrl+O |
| Save (over the open file) | ⌘S | Ctrl+S |
| Save As | ⇧⌘S | Ctrl+Shift+S |
| Routing overview | ⌘1 | Ctrl+1 |
| Add devices | ⇧⌘N | Ctrl+Shift+N |

- **Opening files:** you can also drag a preset onto the window, or launch the app with one. On a Mac that means Finder → right-click → Open With → Other… → Dante Preset Editor. On Windows it means right-click → Open with → Choose another app.
- **Close and Quit** ask before throwing away unsaved changes.
- **The editor features** are the same as the web version: see `docs/01-features.md`.

---

## What's in this folder

```
src/index.html              the editor (HTML/CSS/JS), the same file as the browser version
src-tauri/                  the desktop app shell (Rust + Tauri 2)
  src/lib.rs                menus, native dialogs, file reading/writing, open-with, close prompts
  tauri.conf.json           app name, window size, icons, installer settings
  icons/                    app icons, made from icon-source.png
.github/workflows/build.yml builds the Mac and Windows installers on GitHub
tests/run-tests.js          36 automated tests (npm test)
examples/                   real bench-test presets used by the tests
docs/                       full documentation (start with docs/08-desktop-app.md for the app side)
icon-source.png             1024×1024 master icon (run `npm run icons` after changing it)
```

## Documentation

| File | About |
|---|---|
| docs/01-features.md | Every screen and button |
| docs/02-dante-preset-format.md | The Dante preset XML format, worked out from real exports |
| docs/03-architecture.md | How the editor code is organised |
| docs/04-device-library.md | The 22 built-in device types, and how to add more |
| docs/05-findings-and-decisions.md | Hardware tests, what broke, and why things are the way they are |
| docs/06-testing.md | Automated and hardware testing |
| docs/07-limitations-and-ideas.md | Known limits and next steps |
| docs/08-desktop-app.md | The desktop app: how it's built, signing, and changing it |

**For an AI continuing this work:** read docs 05, 02, 03 and 08 first. The rules that matter most are in docs/05. In short: edit the XML in place; every device needs `<friendly_name>` and `<captureInfo>`; Tx and device renames must rewrite subscriptions; and don't invent XML that hasn't been seen in a real export.
