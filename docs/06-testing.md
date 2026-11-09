# 06 — Testing

## Automated tests

`tests/run-tests.js` loads the real `src/index.html` into **jsdom** and drives it through its own buttons and inputs, using the files in `examples/`.

```bash
npm install      # in the project folder
npm test
```

**Current result: 36 passed, 0 failed.**

| Area | What's checked |
|---|---|
| Loading | A real export loads, **open + save with no edits is byte-identical**, it opens on the routing overview, missing `<friendly_name>`s are added and the preset is marked changed |
| Templates | All 22 built-in types build into one preset, the XML parses, no device is preferred leader, every device has captureInfo and friendly_name, and there are no validation issues |
| Routing | A crosspoint click writes `<subscribed_channel>`/`<subscribed_device>`, a grid Tx rename updates the route, a device rename updates routes and friendly_name, and Copy names (Rx after source) works |
| Static IP | The exact Dante Controller XML is written, a blank DNS is left out, a bad subnet mask is flagged, the DHCP/static toggle works, and typed values are restored |
| Dante Controller-style views | The Routing tab is selected after opening, Device Info lists each device with its IP, clicking a row opens Device View, Device Config shows clocking but not IP, Network Config shows IP but not clocking, and the status bar and Preferred Leader read-out appear |
| Preferred leader | One tickbox writes both `preferred_master` and `clock_priority/preferred` |
| Files | The file pickers are simulated: Open keeps a handle, Cmd+S overwrites, Save as switches file, and with no API Save downloads a copy with the original name |
| Desktop app | With a simulated Tauri bridge: opens the launch file, listens for the menu, open-paths and close-requested events, asks before closing when there are unsaved changes, Save writes the file, Save As adds .xml, and closing when saved closes straight away |

The desktop app itself was also run under a virtual display on Linux and driven with real key presses and the native dialogs. See docs/08.

jsdom has no real layout or native dialogs, so the file pickers are faked with an in-memory "disk". In a real Chromium (Playwright), it was confirmed that a page opened from `file://` has `isSecureContext === true` and has `showOpenFilePicker` and `showSaveFilePicker`.

## During development

These tests were also run against the user's full real presets: a 13-device church system with a dLive, DQ-Rack, DiGiCo DMI cards, DVS, Powersoft and Sennheiser; a 15-device Yamaha/d&b/Glensound system; and a starter system with Atlas, Glensound and Quattrocanali. They aren't included in this package. They covered:
- rename propagation (137 routes updated in one Copy names run)
- duplicate-IP detection
- detecting a second preferred leader
- expand-all performance (about 110,000 cells in about 2.5 seconds)

## Hardware testing (manual, by the user)

These are the only tests that prove Dante Controller accepts the output. The method:
1. Build or edit a preset in the app and save it.
2. In Dante Controller: File → Load Preset, tick the elements, check the role assignment, then Apply.
3. Wait a minute, then File → Save Preset to export what the device actually holds.
4. Compare the two files.

`examples/` holds the bench-test pairs used to find the friendly_name problem (01 → 02, 03 → 04) and the static-IP format (05). See docs/05.
