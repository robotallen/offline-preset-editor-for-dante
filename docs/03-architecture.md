# 03 — Architecture and code walkthrough

## Shape

- **One HTML file:** `src/index.html`, with `<style>`, markup, and one `<script>` in `"use strict"`. The same file runs in a browser and inside the desktop app (docs/08).
- **No libraries:** plain DOM APIs (`DOMParser`, `XMLSerializer`). There are no external requests (no web fonts, scripts or analytics), so it works fully offline.
- **The XML document is the single source of truth.** There is no separate data model. Every edit changes the parsed XML `Document` (`doc`) directly, and the UI re-renders from it. This is what keeps unknown elements and ordering intact.
- **Rendering** builds HTML strings and sets `innerHTML`. Event handling uses delegated listeners on `#work`, `#devList` and the dialogs. Data is passed in `data-*` attributes (indices into `devices()`).

## Global state (`let` at the top of the script)

| Variable | Meaning |
|---|---|
| `doc` | The parsed preset `XMLDocument` (null before anything is loaded) |
| `fileName`, `decl`, `originalText` | The loaded file's name, its `<?xml …?>` declaration (kept on save), and the text used by Revert |
| `sel`, `tab`, `view` | The selected device index, the Device View tab (`channels` = Receive & Transmit, `matrix` = Routing Grid, `settings` = Device Config, `network` = Network Config), and the top-level view (`overview` = Routing, `info` = Device Info, or `device` = Device View) |
| `mxTx` | The Tx device chosen in the single-device routing grid |
| `exTx`, `exRx`, `ovFilter` | The overview's open Tx and Rx devices (Sets of device elements) and its filter text |
| `dirty`, `propagate` | Unsaved-changes flag; whether renames rewrite routes |
| `fileHandle` | The open file as `{name, read(), write(text), path or handle}` (null if not saved yet) |
| `sessionTemplates` | Device types learned from the opened preset |
| `npRows`, `npMode` | Rows and mode (`new` or `add`) in the Build/Add dialog |

## Sections of the script (in file order; search for `/* ---------- `)

### XML helpers
- `kids(el,tag)` / `kid(el,tag)`: **direct children only**, matched on `localName`. This matters because both `<device>` and `<rxchannel>` contain `<name>`.
- `txt(el,tag)`: a direct child's text, or `""`.
- `appendEl(el,k)`: appends a child and copies the parent's indentation text nodes so the output stays pretty.
- `ensureKid`, `removeKid`, `setTxt`.

### Preset model
- **Lookups:** `root()`, `devices()`, `devName(d)`, `txChans(d)`, `rxChans(d)`, `txLabel(tc)` (`<label>`, falling back to `<name>`), `setTxLabel`, `chId(c)` (the `danteId`), `modelOf(d)`.
- **Routes:** `rxSub(rc)` → `{dev,ch}`, and `setSub(rc,dev,ch)`, which writes both elements, or removes both when empty.
- **Device lookup:** `findDev(name)` is case-insensitive, and `srcDev(d,name)` also handles `"."` (the same device).
- **`ensureFriendly(d)`** creates `<friendly_name>` right after `<name>` if it's missing.

### Renames with propagation
- `renameDevice(d,newName)` sets `<name>` and `<friendly_name>`. If `propagate` is on, it rewrites every `<subscribed_device>` equal to the old name in every device.
- `renameTx(d,tc,newLabel)` sets the label. If `propagate` is on, it rewrites `<subscribed_channel>` wherever `subscribed_device` is this device (or `.`) and the channel matches the old label.
- Both return the number of routes updated, which is shown in a message.

### Validation
- `devNameProblem`, `chNameProblem`: Dante's naming rules.
- `leaderOf(d)` is true if either `<preferred_master value="true">` or `<clock_priority><preferred>true`.
- `validate()` returns `{list:[{d,level:'e'|'w'|'i',msg}], perDev:Map}`. The checks are in docs/01. The IP checks use `ipOk`, `maskOk` (contiguous mask) and `ipInt`.

### Loading
- `load(text,name)` parses the text and rejects anything that isn't XML or has no `<preset>` with `<device>`s. It sets the state, keeps the XML declaration, calls `learnTemplates()`, adds missing `<friendly_name>`s, and renders. It returns true or false.
- `learnTemplates()`: each device type in the opened preset (keyed by `manufacturer_id|model_id`, with `captureInfo`) that isn't already known becomes a session template. Same-named models are skipped too, so DVS stays a single entry.
- `skeletonXml(d)` clones a device and strips its identity, names and channels, which is how templates are made.

### Rendering
- `render()` calls `renderSidebar()` and `renderWork()`. `renderSidebar()` draws the device list and Checks panel, marks the selected view tab, and fills the header's Preferred Leader read-out and the bottom status bar (device, channel and route counts, sample rates, errors and warnings).
- `renderWork()` shows `renderOverview()` (Routing), `renderInfo()` (Device Info) or the Device View. The Device View has four tabs: `channelsView(d)` (Receive & Transmit), `matrixView(d)` (Routing Grid), and `settingsView(d, part)` for Device Config (`part="config"`) and Network Config (`part="network"`).

### Device Info
- `renderInfo()` builds one table row per device (name, manufacturer, model, Dante platform, firmware, sample rate, encoding, latency, preferred-leader pill, redundancy, primary and secondary IP, Tx and Rx counts). Rows carry `data-row`, and a click or Enter opens that device in Device View.

### Routing overview
- `renderOverview()` draws the header, filter and table container. `refreshOverview()` redraws only the table and keeps the scroll position.
- `ovTable()` builds the grid. Columns are Tx devices plus their channels when open. Rows are Rx devices plus their channels when open. Cells carry `data-x="rxDevIdx,rxChIdx,txDevIdx,txChIdx"`, where -1 means the device-level summary.
  - Cell classes: `o` = routed, `w` = route to a missing Tx name, `s` = summary cell.
- `ovClick(e)` handles opening devices, toggling crosspoints, expand/collapse all, and channel-name clicks.
- `ovStartEdit(el)` puts a floating `#ovEdit` input over a channel name (`data-rtx` or `data-rrx`) and handles Enter, Esc, Tab and Shift+Tab.
- `ovHover(td)` highlights the row and column and fills the route description.

### Device Config and Network Config
- `settingsView(d,part)` renders only what exists in that device's XML. `part="config"` gives Audio, Clocking, Identity and the captureInfo list; `part="network"` gives redundancy, VLAN, IP addressing and the read-only RTP/AES67 rows. Helpers: `selRow`, `chkRow`, `txtRow`, `roRow`, `blockRows`.
- **Preferred leader** has its own handler, which writes both `preferred_master@value` and `clock_priority/preferred`.
- Other settings use `data-path` / `data-kind` and `applySetting(d,el)`. The kinds are `text`, `bool-text`, `attr` and `bool-attr`.
- **IP:** `IPF` (the field list), `ipVals(iface)`, `writeIp(iface,v)` (rebuilds the `<ipv4_address>` children, leaving optional blanks out), `addIface(d)` (adds interfaces and the captureInfo entry), and `ipStash` (a WeakMap that remembers static values when you switch to DHCP).

### Events
These are delegated listeners. `#work` gets click, change, input, mouseover and keydown. There are also the sidebar list, the preset name and description, and the global keyboard shortcuts.

### Files: open, save over, save as
- **Three modes:** the desktop app (`APP`, Rust commands through `invoke`), Chrome/Edge (`FS_OK`, the File System Access API), and other browsers (file input plus download).
- **The open file** is `fileHandle`, built by `nativeFile(path)` or `webFile(handle)`. Both have `read()` and `write(text)`. `openFileObj(f)` reads the file and calls `load`, and `openPath(path)` is the app version.
- **`ask(message)`** is an async confirmation: the native dialog in the app, `confirm()` in a browser. Every confirmation in the editor uses it.
- **`pick()`, `save()`, `saveAs()` and `revert()`** work in all three modes. `checkErrors()` is async because it may ask.
- **`runAction(id)`** is the one entry point for menu items and keyboard shortcuts, with a 500 ms repeat guard.
- **The desktop wiring section** at the end of the script listens for the `menu`, `open-paths` and `close-requested` events (docs/08).
- `serialize()` uses `XMLSerializer` and puts back the original XML declaration.
- `updateTitle()` updates the file label and the tab title. `markDirty()` and `markClean()` set the unsaved state.
- Drag and drop tries `getAsFileSystemHandle()` first.

### Copy channel names
- `cnPlan(d,mode)` returns `{changes:[{kind:'tx'|'rx',dev,el,from,to}],notes,renumbered}`. The modes are `rxFromSrc`, `srcFromRx`, `txToRx` and `rxToTx`. It cleans names (`cleanName`) and makes them unique per device and direction by adding " 2", " 3" and so on.
- On submit, Tx changes are applied in two passes: first to temporary names `\u0001tmp{i}`, then to the final names. `propagate` is forced on so routes follow. Rx changes are plain `setTxt`.

### Build from scratch / add devices
- `BUILTIN_TEMPLATES` is a JSON array near the top of the script: `{label, short, model_id ("manufacturer_id|model_id"), tx, rx, xml}`. The `xml` is a `<device>` skeleton (captureInfo, identity and settings, with no name, identity or channels). See docs/04.
- `allTemplates()` returns the built-in templates followed by the session templates.
- `buildDevice(r,sr,lat)` builds a `<device>` from a template or as generic:
  - It inserts `<name>`, `<default_name>` and `<friendly_name>`, sets the sample rate and latency, and inserts numbered channels (`01`, `02`… or `001` for 100+) before `<rtp>`/`<clock>`.
  - Generic devices get `GENERIC_CAPTURE` and `<friendly_name>`.
- `indent(n,level)` re-indents built nodes with 4 spaces.
- **Template identity:** templates have no `instance_id`, so Dante Controller can't "perfect match" them to hardware. It matches by name, or by make and model.

## Conventions to keep

- **Edit nodes in place.** Never rebuild the document, never reorder existing nodes, and never drop unknown nodes.
- **Insert new elements where Dante Controller would put them** (see the order in docs/02).
- **Validate, don't block:** the user can save with errors after confirming.
- **Keep it a single file with no dependencies.** The user uses it on site laptops.
