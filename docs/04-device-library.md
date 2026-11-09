# 04 — Built-in device library

The device types are stored in `BUILTIN_TEMPLATES` inside the app. Each one was copied from a **real Dante Controller export** of the user's own equipment, with the device's identity (`instance_id`), names and channels removed.

**When a type is added:**
- **Preferred leader is turned off** (`preferred_master` and `clock_priority/preferred` set to false). Several source devices were the clock leader on their own system, and new devices shouldn't inherit that.
- **External word clock is set to false** where it was true (the DiGiCo DMI card).
- **The type is identified by `manufacturer_id|model_id`, not `model_id` alone.** Small Ultimo-based products from different makers share model IDs, for example Ampetronic and Allen & Heath are both `0000000000000002`.

| Label | Short name (auto-naming) | Tx × Rx | Extra preset elements (besides Name and channels) | Source |
|---|---|---|---|---|
| Allen & Heath Dante128 (dLive) | Dante128 | 128×128 | redundancy, IP, sample rate, latency, RTP, clock, clock priority, word clock | Dante.xml |
| Ampetronic C-Series loop driver | C-Series | 0×2 | IP, sample rate, encoding, latency, RTP, clock, clock priority | 24-09-26.xml |
| Atlas IED AZM8-D | AZM8-D | 16×16 | IP, sample rate, encoding, latency, RTP, clock, clock priority | Brook mead starter.xml |
| Audinate AVIO USB-C adapter | AVIO-USBC | 2×2 | IP, sample rate, encoding, latency, RTP, clock, clock priority | Brook mead starter.xml |
| Blustream DA11USB | DA11USB | 2×2 | IP, sample rate, encoding, latency, RTP, clock, clock priority | Dante.xml |
| Blustream DA44AU | DA44AU | 4×4 | IP, sample rate, encoding, latency, RTP, clock, clock priority | NBT after Load.xml (bench unit) |
| d&b audiotechnik 5D | 5D | 0×4 | switch VLAN, IP, sample rate, encoding, latency, RTP, clock, clock priority | 24-09-26.xml |
| Dante Virtual Soundcard | DVS | 64×64 | sample rate, pull-up, encoding, clock | Dante.xml (macOS 4.5.2), one entry for all OS versions at the user's request |
| DiGiCo DMI-Dante 64@96 card | DMI-Dante | 64×64 | redundancy, IP, sample rate, latency, RTP, clock, clock priority, word clock | Dante.xml (Card2) |
| DiGiCo DQ-Rack | DQ-Rack | 48×32 | redundancy, IP, sample rate, latency, RTP, clock, clock priority | Dante.xml |
| Glensound AOIP4 analogue output | AOIP4O | 0×4 | IP, sample rate, encoding, latency, RTP, clock, clock priority | 24-09-26.xml |
| Glensound Beatrice PM4 | PM4 | 4×4 | IP, sample rate, encoding, latency, RTP, clock, clock priority | Brook mead starter.xml |
| Glensound DARK8AO | DARK8AO | 0×8 | redundancy, IP, sample rate, latency, RTP, clock, clock priority | 24-09-26.xml |
| Powersoft Mezzo | Mezzo | 4×4 | switch VLAN, IP, sample rate, encoding, latency, RTP, clock, clock priority | Dante.xml |
| Powersoft Quattrocanali (Q1204, Q2404 etc.) | Quattro | 0×4 | IP, sample rate, encoding, latency, RTP, clock, clock priority | Brook mead starter.xml; the Q1204 and Q2404 are identical as far as Dante is concerned |
| Powersoft T Series | T-Series | 0×4 | switch VLAN, IP, sample rate, encoding, latency, RTP, clock, clock priority | Dante.xml |
| Sennheiser EW-DX EM 2 Dante | EWDX-EM2 | 2×0 | sample rate, encoding, latency, RTP, clock | Dante.xml |
| TEAC MM-2D | MM-2D | 4×4 | switch VLAN, IP, sample rate, encoding, latency, RTP, clock, clock priority | 24-09-26.xml |
| Yamaha MRX7-D | MRX7-D | 64×64 | redundancy, IP, sample rate, encoding, latency, RTP, clock, clock priority, word clock | 24-09-26.xml |
| Yamaha QL5 | QL5 | 64×64 | redundancy, switch VLAN (value 2), IP, sample rate, pull-up, encoding, latency, word clock | 30-07-2025.xml, an **older v2.1.0 export with no captureInfo**, so the captureInfo was **assembled** from the elements present. Not tested on hardware. |
| Yamaha Rio1608-D3 | Rio1608-D3 | 16×10 | redundancy, IP, sample rate, pull-up, encoding, latency, RTP, clock, clock priority | 24-09-26.xml |
| Yamaha Rio3224-D2 | Rio3224-D2 | 32×24 | redundancy, IP, sample rate, pull-up, encoding, latency, RTP, clock, clock priority | 24-09-26.xml |

Plus **Generic device**: captureInfo = Name, Sample Rate, Encoding, Device Latency and the four channel elements, with no identity. Dante Controller can only match it to hardware by name, or by manual assignment.

## Device types learned from an opened preset

When a preset is opened, any device type with a `captureInfo` that isn't already in the library is offered under **"From the opened preset"** in the Add devices dialog for that session. It isn't saved into the app.

## Adding a new built-in type (for a developer or AI)

1. Get a real Dante Controller export (v3.0.0, with `captureInfo`) containing the device.
2. Take its `<device>` element and remove: `<instance_id>`, `<name>`, `<default_name>`, `<friendly_name>`, every `<txchannel>`, `<rxchannel>` and `<txflow>`.
3. Set `preferred_master` and `clock_priority/preferred` to false, and `external_word_clock` to false.
4. Add an object to `BUILTIN_TEMPLATES`:
   `{"label":"Maker Model","short":"Model","model_id":"<manufacturer_id>|<model_id>","tx":N,"rx":N,"xml":"<device>…</device>"}`.
   Inside the JS string literal, `</` must be written as `<\/`, otherwise the HTML parser can close the `<script>` early.
5. Keep the array sorted by label.

This Python snippet was used to do it:

```python
import re, json
s = open("src/index.html").read()
k = "const BUILTIN_TEMPLATES="; a = s.index(k)+len(k); b = s.index(";\n", a)
L = json.loads(s[a:b].replace("<\\/", "</"))
# ... build dict t from a stripped <device> ...
L.append(t); L.sort(key=lambda t: t["label"].lower())
s = s[:a] + json.dumps(L, separators=(",",":")).replace("</", "<\\/") + s[b:]
open("src/index.html","w").write(s)
```
