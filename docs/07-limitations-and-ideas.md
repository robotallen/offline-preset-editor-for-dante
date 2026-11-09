# 07 — Known limitations and ideas for next steps

## Limitations

- **The browser version:** saving over files needs Chrome or Edge on desktop. Safari and Firefox can only download a copy. The desktop app (docs/08) doesn't have this limit.
- **The desktop app is unsigned,** so it gets a security warning the first time it's opened on Mac and Windows (see the README).
- **Static → DHCP** can't be applied from a preset. That's a Dante Controller limitation (docs/05 §6).
- **Device rename and channel labels in the same apply** may not both land. Apply twice if needed (docs/05 §4).
- **Templates have no hardware identity.** Dante Controller matches built devices by name, then by make and model, or you assign them by hand. The single DVS template carries a macOS model ID, so Windows DVS machines may need manual assignment.
- **Multicast flows (`<txflow>`)** are kept as they are but can't be edited. Building a device from a template doesn't copy flows.
- **Only some settings are editable:** RTP/AES67, the detailed clock settings, pull-up, codec and HA Remote are kept but not editable (by request, or never seen in an export).
- **Blank gateway/DNS in a static IP** are left out of the XML. This hasn't been checked against a real Dante Controller export.
- **The Yamaha QL5 template** was assembled from an older export and hasn't been tested on hardware.
- **Not translated or localised**, and not tested with screen readers beyond basic labels and keyboard support.
- **No undo** other than Revert to the last saved version, plus the preview in Copy names.
- **Large presets:** fully expanding the routing overview on very large systems is slow to draw.

## Ideas (none requested yet unless marked)

- ~~A packaged desktop app~~: **done** with Tauri 2 for macOS and Windows (docs/08).
- **Signing and notarising** the desktop app.
- **Undo/redo** (a stack of serialised states).
- **Bulk channel naming:** paste a column of names from a spreadsheet or channel list into Tx or Rx names.
- **Import and export of channel lists** as CSV (patch sheets).
- **Multi-select routing** in the overview: drag a diagonal to route 1:1 across a block.
- **Saving learned device types** permanently, for example by exporting and importing a library JSON.
- **Static-IP helpers:** auto-number IPs across selected devices, and a subnet calculator.
- **A printable patch report** (PDF): devices, IPs, routes.
- **Editing multicast Tx flows.**
- **A compare view** showing the difference between the saved preset and an export taken after applying (automating the bench-test method in docs/06).
