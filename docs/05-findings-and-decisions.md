# 05 — Findings, hardware tests and design decisions

This is a record of how the tool was built, in order. It covers what was tried, what real Dante Controller did, and the decisions that followed. It's the most important file for anyone continuing the work.

The test bench was a **Blustream DA44AU** (UltimoX4, firmware 1.0.2 → 1.0.3), applied from **Dante Controller on macOS**, Sept to Oct 2026.

---

## 1. First version: open, rename, route, save

- **Approach:** a single HTML file that parses the preset with DOMParser and edits it in place.
- **Change preservation:** opening and saving a file with no changes gives a byte-identical file. This was checked against a real 115 KB export.
- **Renames update routes:** renaming a device or Tx channel rewrites the subscriptions that point at it. Without this, a rename in the XML silently breaks routes, because routes are stored by **name**.
- **Bug fixed early:** the start-screen panel stayed visible after loading, because its CSS `display:grid` overrode the `hidden` attribute. The fix is a global `[hidden]{display:none !important}`.

## 2. Build from scratch, first attempt: greyed-out Preset Elements

The first from-scratch devices had only `<name>`, sample rate, encoding, latency and channels.

**Result in Dante Controller:** almost every Preset Element, including **Name**, was greyed out (screenshot evidence).

**Cause:** the `<captureInfo>` block, which lists the elements a role offers. Real exports have it, the generated devices didn't. Once captureInfo was added, those elements became available.

**Decision:** build devices from **templates copied from real exports**, so the elements a role offers match what the hardware actually supports. Some of the clock and network elements depend on the device, so inventing them is risky.

## 3. The device name didn't change: `friendly_name`

- **Test 1:** applied `examples/01-generic-before-fix.xml` (Name ticked, device named `Bluestream-4x4`) to the DA44AU.
- **Export afterwards** (`examples/02-…`): the **channel names applied** (OUT1–4, IN1–4), but **the device name did not**. It stayed `DA44AU-971090`.
- **Finding:** Audinate's documentation says the Name element sets the **"Friendly Name"**. Real exports always contain `<friendly_name>`, and the generated file didn't.
- **Fix:** every device now gets `<friendly_name>`, right after `<name>`. Renames update both. Opening a preset that lacks friendly names adds them and tells the user.
- **Test 2:** applied `examples/03-…` (with `<friendly_name>BlueStream</friendly_name>`). The export afterwards (`examples/04-…`) shows **the name changed to BlueStream ✅**.

## 4. A rename and channel labels in the same run

In test 2, the device rename worked **but the channel names did not apply**. The export shows the default TX_1… and RX_1… names. Firmware also changed from 1.0.2 to 1.0.3 between the tests.

| Test | Device name | Channel names |
|---|---|---|
| 1 (no friendly_name) | ✗ | ✓ |
| 2 (friendly_name) | ✓ | ✗ |
| Later static-IP export, no rename involved | — | ✓ (names show test/yo/what/ever) |

**Working theory (not proven):** Audinate's docs say Dante Controller renames devices through an "intermediate name" and waits up to 40 seconds. While the device is changing name it can't be found ("Resolution Failed" events were logged, see below), so channel labels sent in that window may fail.

**Advice given:** when a preset changes both the device name and the channel names, apply it twice, or untick the channel labels on the first pass.

## 5. "Resolution Failed" events

The user saw "Resolution Failed" in Dante Controller's Events tab for BlueStream and DA44AU-971090. Audinate classes this as a **warning**. It means Dante Controller couldn't resolve the device by name, which is common straight after a rename or reboot.

The troubleshooting given:
- check whether the entries are old ones still in the log
- check the device works (not shown red, routes green)
- check the computer and device are on the same addressing (link-local vs DHCP vs static)
- check the Mac's interfaces (Wi-Fi off, the correct interface selected, interface order)
- restart Dante Controller and power-cycle the device
- turn EEE off on the switch

## 6. Static IP format

The format couldn't be found anywhere public, so the user set the DA44AU to static in Dante Controller and exported it (`examples/05-exported-static-ip.xml`). That gave the exact format (docs/02), and the static-IP editor was built from it.

**Static to DHCP doesn't work from a preset (confirmed on hardware).** Audinate's docs say Interface IPv4 Addresses *"Only applies static IP configuration"*. The app shows a note under DHCP interfaces saying so.

## 7. Clock Priority warning when applying

Dante Controller showed: *"BlueStream-v2 does not support all the preset configuration for Clock Priority"* (a red LED, a non-terminal warning).

- **Possible cause:** the user had ticked Preferred leader in the editor, and the device reports `clock_priority` support but may not accept `preferred=true` through the preset. Audinate notes that clock priority depends on the device's clock mode.
- **Advice given:** untick the Clock Priority element, or leave Preferred leader off.
- **Status:** not confirmed which setting causes it.

## 8. Clocking UI reduced to Preferred leader only

At the user's request the Clocking section shows only Preferred leader. All other clock XML is kept as it is, just not shown.

## 9. Library decisions

- **One DVS entry:** the user asked for a single Dante Virtual Soundcard type rather than one per OS and version. Opening presets with other DVS versions doesn't add them back. Side effect: the DVS template carries the macOS model ID, so Dante Controller may not auto-match it to a Windows PC, and the role then has to be assigned by hand.
- **New devices start with Preferred leader off.**
- **Types are identified by manufacturer and model together** (see docs/04).
- **Quattrocanali:** the Q1204 and Q2404 are identical as far as Dante is concerned, so they're one entry.

## 10. Routing overview and grid renaming

- The user asked for a home page laid out like Dante Controller's routing view, then for the ability to rename channels from it.
- **Performance:** fully expanding the user's 13-device preset is about 110,000 cells and takes around 2.5 seconds to draw, so Expand all asks for confirmation over 60,000.

## 11. Save over the file

The user wanted Save (overwrite) and Save as, which a plain web page can't normally do. The File System Access API (Chrome and Edge) can, and it works for a page opened from a local `file://` URL. This was confirmed in Chromium: `isSecureContext` is true and the pickers exist. Safari and Firefox fall back to downloading a copy.

**Options discussed for a "real app"** (not built):
- Host the page on https (for example GitHub Pages) and use Chrome's "Install" for its own window and Dock icon.
- Wrap it in Electron for proper menus, at about 100 MB and unsigned, so macOS needs right-click → Open the first time.

## 12. Copy names (Tx ↔ Rx)

The user asked for a button to copy Tx names to Rx names or the other way round. Since that can mean "by channel number on one device" or "follow the route", all four modes were built, with a preview (docs/01).

## 13. Other support given along the way (not code)

- **DVS renaming:** DVS takes the computer's name by default, but it can be renamed in Dante Controller → Device Config → Rename Device. Close audio apps and unlock the device first.
- **macOS Dante Controller seeing no devices** (while Windows did): the usual cause is **System Settings → Privacy & Security → Local Network → Dante Controller**. Turn it on, or off and on again, then restart Dante Controller. Also check the interface selection and order, IP addressing, and VPN or filter software. The firewall is not the cause.
- **Similar existing tools:** Dante Config Editor (DCE) by Mamat79 on GitHub, a much larger desktop app; DanteOfflineEditor by garthorr and by TimoteusRuotsalainen, which are simpler. DCE's author reaches the same principles: edit in place, and never add an element the device hasn't shown.

## 14. Desktop app (Nov 2026)

The user asked for an Xcode app that would also run on Windows. Xcode can't target Windows, so after offering the choices, the user picked **one cross-platform project**. It's built with Tauri 2 around the same editor page (docs/08).

Testing found that WebKit wouldn't render the vertical Tx device names in the routing overview, because WebKit won't rotate `<button>` elements. They became `<span role="button">`.

## Open questions

- Does Dante Controller accept a static `<ipv4_address>` with no `<gateway>` or `<dnsserver>`?
- Do rename and channel labels in one apply reliably fail (finding 4)?
- Which Clock Priority value triggers the warning on the DA44AU?
- Does the assembled QL5 template apply cleanly?
