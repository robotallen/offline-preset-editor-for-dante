# 02 — The Dante Controller preset format (as observed)

Audinate does not publish an XML schema for presets. Everything here was worked out from real exports made by the user's Dante Controller (macOS, 2026), preset `version="3.0.0"`, plus one older `version="2.1.0"` export. Where something is inferred rather than seen, it says so.

Audinate's own page "Preset Elements – Configuration Parameters" (Dante Controller user guide) describes what each element *does* when it is applied. It doesn't show the XML. Its key points are quoted in docs/05.

## Overall structure

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<preset version="3.0.0">
    <name>Preset name</name>
    <description>Free text</description>
    <device> … </device>
    <device> … </device>
</preset>
```

Indentation in exports is 4 spaces. The app copies the indentation it finds.

## A complete `<device>` (v3.0.0), in the order Dante Controller writes it

```xml
<device>
    <captureInfo>                        <!-- which Preset Elements this device role offers -->
        <device_name/>
        <device_redundancy/>             <!-- only if the device supports it -->
        <device_switch_vlan/>
        <interface_ipv4_addresses/>
        <device_samplerate/>
        <device_clock_pullup/>
        <device_encoding/>
        <device_unicast_latency/>
        <rtp/>
        <clock/>
        <clock_priority/>
        <device_external_word_clock/>
        <txchannel_names/>
        <txflows/>
        <rxchannel_names/>
        <rxchannel_subscriptions/>
        <rxflows/>
    </captureInfo>
    <name>FOH-Console</name>             <!-- current Dante device name -->
    <default_name>DQ-Rack-0af706</default_name>   <!-- factory name -->
    <instance_id>                        <!-- hardware identity: Dante Controller's "perfect match" -->
        <device_id>0004C40AF7060000</device_id>
        <process_id>0</process_id>
    </instance_id>
    <manufacturer_id>44696769636F0000</manufacturer_id>   <!-- hex of an ASCII name, zero-padded -->
    <manufacturer_name>DiGiCo (UK) Ltd</manufacturer_name>
    <model_id>4447434F30180000</model_id>
    <model_name>DQ-Rack</model_name>
    <model_version>1.50.1</model_version>
    <model_version_string>…</model_version_string>        <!-- some devices -->
    <device_type>53756D6D69744843</device_type>
    <device_type_string>SummitHC</device_type_string>     <!-- Dante platform: UltimoX4, Brooklyn-3, DVS… -->
    <friendly_name>FOH-Console</friendly_name>            <!-- REQUIRED for the Name element to apply -->
    <redundancy value="true"/>
    <switch_vlan value="1"/>
    <preferred_master value="false"/>
    <external_word_clock value="false"/>
    <clock_pullup value="0"/>
    <samplerate>48000</samplerate>
    <encoding>24</encoding>
    <unicast_latency>1000</unicast_latency>               <!-- microseconds -->
    <interface network="0"> … </interface>                <!-- 0 = primary -->
    <interface network="1"> … </interface>                <!-- 1 = secondary (redundant devices) -->
    <txflow danteId="7" mediaType="audio">                <!-- multicast flows, if any -->
        <slot channelId="57"/> …
    </txflow>
    <txchannel danteId="1" mediaType="audio">
        <label>DQMic 1</label>
    </txchannel>
    <rxchannel danteId="1" mediaType="audio">
        <name>DQLineOut 1</name>
        <subscribed_channel>11</subscribed_channel>       <!-- source Tx label… -->
        <subscribed_device>DiGiCo-0af35a-Card1</subscribed_device>  <!-- …@ source device name -->
    </rxchannel>
    <rtp>
        <interop_mode>none</interop_mode>
        <aes67_multicast_address_prefix>4014276608</aes67_multicast_address_prefix>
    </rtp>
    <clock>
        <subdomain_name>_DFLT</subdomain_name>
        <v1_unicast_delay_requests>false</v1_unicast_delay_requests>
        <v2_unicast_delay_requests>false</v2_unicast_delay_requests>
        <v1_enabled>true</v1_enabled>
        <v2_enabled>false</v2_enabled>
    </clock>
    <clock_priority>
        <preferred>false</preferred>
        <follower_only>false</follower_only>              <!-- some devices only -->
    </clock_priority>
</device>
```

Elements appear only if the device supports them. For example, Dante Virtual Soundcard has no `interface`, `rtp`, `unicast_latency` or `clock_priority`, and has `clock_pullup`.

## captureInfo → Dante Controller "Preset Elements" names

| captureInfo tag | Shown in Dante Controller as |
|---|---|
| device_name | Name |
| device_redundancy | Redundancy Configuration |
| device_switch_vlan | Switch VLAN |
| interface_ipv4_addresses | Interface IPv4 Addresses |
| device_samplerate | Sample Rate |
| device_clock_pullup | Sample Rate Pull-up |
| device_encoding | Encoding |
| device_unicast_latency | Device Latency |
| rtp | RTP Configuration |
| clock | Clock Configuration |
| clock_priority | Clock Priority |
| device_external_word_clock | External Word Clock Setting |
| device_haremote_bridge_mode | HaRemote Bridge Mode (never seen in an export; name assumed) |
| device_codec | Codec (never seen in an export; name assumed) |
| txchannel_names | TX Channel Labels |
| txflows | TX Flows |
| rxchannel_names | RX Channel Labels |
| rxchannel_subscriptions | RX Subscriptions |
| rxflows | RX Flows |

**A device with no `<captureInfo>` gets almost every element greyed out in the Apply Preset dialog.** This was confirmed with screenshots. The older v2.1.0 export has no captureInfo at all.

## Channels and routing

- **Transmit channels:** `<txchannel danteId="n">` with `<label>`. Some older formats may use `<name>`, and the app supports both.
- **Receive channels:** `<rxchannel danteId="n">` with `<name>`. A route is the pair `<subscribed_channel>` (the source Tx **label**, not its number) and `<subscribed_device>` (the source device **name**). No pair means no route.
- **Routing is by name,** so renaming a Tx label or a device name breaks every route that points at it unless those subscriptions are rewritten too. The app rewrites them.
- **`<subscribed_device>.</subscribed_device>`** (a dot) is believed to mean "this same device" (a loopback). The app handles it, but it has not been seen in the user's files.
- **`danteId`** is the channel number, starting at 1.

## IP addressing (`interface_ipv4_addresses`)

DHCP / automatic, as exported:
```xml
<interface network="0">
    <ipv4_address mode="dynamic"/>
</interface>
```

Static, from a real export (`examples/05-exported-static-ip.xml`):
```xml
<interface network="0">
    <ipv4_address mode="static">
        <address>10.20.20.190</address>
        <netmask>255.255.255.0</netmask>
        <gateway>10.20.20.1</gateway>
        <dnsserver>8.8.8.8</dnsserver>
    </ipv4_address>
</interface>
```

- **Blank optional fields:** the app leaves out `<gateway>` / `<dnsserver>` when they are blank. **This hasn't been seen in a real export.** It is an assumption, and the user was told to test it.
- **Static to DHCP doesn't apply from a preset.** Audinate's docs say the Interface IPv4 Addresses element *"Only applies static IP configuration"*, and the user confirmed on hardware that `mode="dynamic"` does not switch a static device back. That change has to be made in Device View → Network Config.

## Name rules (Dante)

- **Device names:** 1–31 characters, letters, digits and hyphens only, and they can't start or end with a hyphen. They must be unique on the network.
- **Channel names:** 1–31 characters, and can't contain `=` `.` `@`. They must be unique per device and direction, case-insensitively.

## How Dante Controller matches roles to devices when applying

From Audinate's "Applying Presets" page:
1. **Perfect match:** the same physical device, by `instance_id`/`device_id`.
2. **Name match:** the device name.
3. **The same manufacturer and model:** an unassigned device of the same type.

After that you can assign roles by hand (select the role, select the target, then Apply Role). "Terminal" issues that block applying include **the same device name on several devices** and **the same static IP on several devices**.

## The older format (preset version 2.1.0)

This is the same device element, minus `<captureInfo>`, `<rtp>`, `<clock>` and `<clock_priority>`. Seen in `30-07-2025.xml` (a Yamaha QL5 system). The app reads it fine.
