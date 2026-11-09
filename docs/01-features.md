# 01 — Features and user guide

## Layout

- **Header:** app name with the open file's name under it, the preset name and description (editable inline), a **Preferred Leader** read-out (which device or devices are set as leader, or "None set"), an "Unsaved changes" marker, and the buttons New preset…, Open preset…, Revert, Copy XML, Save as… and Save.
- **View tabs** under the header, modelled on Dante Controller: **Routing**, **Device Info** and **Device View** (the last one names the selected device, for example "Device View: BlueStream", and is disabled until a device exists).
- **Left sidebar:**
  - the device list: name, Tx×Rx channel count and model, with a red dot if the device has problems. Clicking a device opens its Device View.
  - **Add devices…**
  - the **Checks** panel, a live validation list
- **Main area:** the Routing grid, the Device Info table or the selected device's Device View.
- **Status bar** along the bottom: device count, total Tx and Rx channels, number of routes, the sample rate(s) in use, and the number of errors and warnings ("No problems found" when clean).

The window or browser tab title shows `• filename – Offline Preset Editor for Dante` when there are unsaved changes.

## Start screen

Drag a preset onto the window, click **Open preset…**, or click **Build from scratch…**. After a preset loads, the app opens on the **Routing** tab.

## Routing tab (home page)

This works like Dante Controller's routing grid:

- **Transmitters across the top, receivers down the side.** Devices start collapsed, one row and one column each.
- **+ / −** opens or closes a device's channels.
- **Receiving devices** show `routed/total`, for example `75/128`.
- **Crosspoints:** click a channel-to-channel crosspoint to route it, and click a lit one to unroute. Each Rx channel takes one source, so a new route replaces the old one.
- **Square marks** on a collapsed device summarise the routes inside it. Clicking one opens that device. A red mark means a route points at a Tx name that doesn't exist on that device.
- **Hovering** highlights the row and column and shows `RxCh@RxDevice ← TxCh@TxDevice` at the top right.
- **Renaming channels from the grid:** click any channel name in a header to rename it. Enter saves, Esc cancels, Tab saves and moves to the next channel on the same device, and Shift+Tab goes back. Tx renames carry their routes with them. Keyboard users can press Enter or F2 on a focused name.
- **The filter** matches device name or model. If the filter only matches one side (an amp that only receives, for example), the other side stays complete so you can still route to it.
- **Expand all / Collapse all:** Expand all asks for confirmation when there are more than about 60,000 crosspoints.
- **Click a device name** in the grid to open it in Device View.
- **Routes from devices not in the preset** can't be drawn as crosspoints, so the Rx row shows the source device name in grey.

## Device Info tab

One row per device, like Dante Controller's Device Info tab. The columns are Device Name, Manufacturer, Model, Dante Platform, Firmware, Sample Rate, Encoding, Latency, Clock (a "Preferred Leader" pill), Redundancy (Redundant or Switched), Primary IP, Secondary IP, and the Tx and Rx channel counts. The IP columns show the static address, "Automatic" for DHCP, or a dash if the device has no such interface. Values the device's XML doesn't carry show a dash. Click a row (or focus it and press Enter or Space) to open that device in Device View.

## Device View

**Header row:**
- The device name on a "label tape" input (validated against Dante rules).
- **"Update routes that use renamed devices and channels"** (on by default). When on, renaming a device or Tx channel rewrites every subscription that refers to it.
- **Remove device** (asks first).

**Info line:** model, firmware, sample rate and latency.

Four tabs:

### Tab: Receive & Transmit
- **Transmit channels:** rename Tx labels.
- **Receive channels:** rename Rx names, and set each one's source as channel @ device. Both fields suggest from the preset, and ✕ clears a route. The LED shows the route status: amber means OK, red means the source channel isn't found on that device.
- **Copy names…** opens a dialog with four modes and a preview of every change:
  1. **Name receive channels after their sources:** Rx name = the name of the Tx channel feeding it. This uses the name in the subscription, so it works even if the source device isn't in the preset.
  2. **Name sources after these receive channels:** the source Tx label = the Rx name. This changes the other devices, and their routes follow. Sources not in the preset are skipped. If one Tx feeds several Rx, the first wins.
  3. **Copy this device's Tx names to its Rx names**, matched by `danteId`.
  4. **Copy this device's Rx names to its Tx names**, matched by `danteId`. Routes follow.

  Repeated names get " 2", " 3" and so on added, because names must be unique per device and direction. Invalid characters (`=` `.` `@`) become `-`, and names are cut to 31 characters. Tx renames are done in two passes (to temporary names first) so swaps like A↔B can't tangle the routes.

### Tab: Routing Grid
A single-device grid: this device's Rx channels against a Tx device you choose from a dropdown.

### Tab: Device Config
This shows only the settings present in that device's XML:
- **Audio:** sample rate, encoding, device latency, and pull-up (read-only).
- **Clocking:** **Preferred leader** only, by design (the user asked for the other clock settings to be hidden). Some devices store it in two places, `<preferred_master value>` and `<clock_priority><preferred>`, and the one tickbox sets both. All other clock XML is preserved, just not shown.
- **Identity:** manufacturer, model, firmware, Dante platform, default name and device ID (read-only).
- **Preset elements this device carries:** the `<captureInfo>` list, shown with Dante Controller's names for each element.

### Tab: Network Config
- Redundancy.
- Switch VLAN.
- **IP addressing per interface**, Primary and Secondary: **Automatic (DHCP)** or **Static**. Static shows IP address, subnet mask, gateway (optional) and DNS server (optional). Switching back to DHCP and then to Static restores the values you'd typed. Under a DHCP interface, a note explains that a preset can't switch a static device back to DHCP. Generic devices get an **Add IP settings to this device** button.
- The AES67 / RTP settings (interop mode and multicast prefix), read-only.

## Build from scratch / Add devices

A dialog with one row per device: **Device type**, **Name**, **Tx count** and **Rx count**.
- **Device type** is "Generic device", one of the built-in types (see `04-device-library.md`), or a type learned from the preset you have open ("From the opened preset").
- Choosing a type fills in its real channel counts and an automatic name (`DQ-Rack-1`, `DQ-Rack-2`…).
- **Add another device** copies the previous row's type and counts.
- **Sample rate** applies to all new devices. **Latency** can be left at each type's own value.
- New devices always start with **Preferred leader off**.
- In New preset mode you also set the preset name and description.
- The form checks names against Dante rules and against devices already in the preset, and limits counts to 0–512.

## Checks panel (validation)

| Check | Level |
|---|---|
| Device name invalid (empty, over 31 characters, or not letters/digits/hyphens, or starts or ends with a hyphen) | Error |
| Two devices with the same name | Error |
| Channel name invalid (empty, over 31 characters, or contains `=` `.` `@`) | Error |
| Duplicate Tx or Rx names on a device (case-insensitive) | Error |
| Subscription with only a device or only a channel | Error |
| Subscription to a Tx name that doesn't exist on that device | Warning |
| Subscription to a device that isn't in the preset | Info |
| More than one preferred leader | Warning |
| Devices at different sample rates | Warning |
| Static IP: missing or invalid address or mask, network or broadcast address used, invalid gateway or DNS | Error |
| The same static IP on two interfaces (Dante Controller refuses to apply this) | Error |
| Gateway outside the device's subnet | Warning |
| A redundant device with primary and secondary on the same subnet | Warning |

Saving with errors asks for confirmation first.

## Files

In the **desktop app** these use native dialogs and the File menu (docs/08). The notes below describe the **browser version**.


- **Open preset… (Cmd/Ctrl+O):**
  - In Chrome and Edge this uses the File System Access API (`showOpenFilePicker`) and keeps a handle on the file, so **Save** can overwrite it.
  - Drag and drop also gets a handle, via `DataTransferItem.getAsFileSystemHandle()`.
  - Other browsers fall back to an `<input type=file>`.
- **Save (Cmd/Ctrl+S):** writes over the open file. Chrome asks for permission the first time. With no file handle (a new preset, or a file opened without one), Save behaves as Save as.
- **Save as… (Shift+Cmd/Ctrl+S):** uses `showSaveFilePicker`, and from then on Save writes to the new file. In Safari and Firefox both Save and Save as download a copy instead, and a message explains why.
- **Revert:** reloads the file from disk if there's a handle, otherwise goes back to the last saved or loaded text.
- **Copy XML:** copies the current preset to the clipboard.
- **Opening presets with no friendly names:** if a preset has devices with no `<friendly_name>`, the app adds them on load, marks the preset as changed and says so (see docs/05).
