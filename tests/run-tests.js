// Headless test suite for src/index.html
// Run:  cd tests && npm install && npm test
// Uses jsdom to load the real HTML file and drive it through its own UI.
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "..", "src", "index.html");
const EX = f => fs.readFileSync(path.join(__dirname, "..", "examples", f), "utf8");
const html = fs.readFileSync(APP, "utf8");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name); } }
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

// Make a fresh app instance. With fsApi=true, fake Chrome's file pickers using an in-memory "disk".
function app({ fsApi = false } = {}) {
  const disk = {};
  const dom = new JSDOM(html, {
    runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) {
      w.confirm = () => true;
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { this.open = false; };
      w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () { w.__downloaded = this.download; };
      if (fsApi) {
        const handle = name => ({
          kind: "file", name,
          getFile: async () => ({ name, text: async () => disk[name] }),
          queryPermission: async () => "granted",
          createWritable: async () => { let b = ""; return { write: async t => { b += t; }, close: async () => { disk[name] = b; } }; }
        });
        w.showOpenFilePicker = async () => [handle(w.__openName)];
        w.showSaveFilePicker = async o => { w.__suggested = o.suggestedName; return handle("saved-as.xml"); };
      }
    }
  });
  const w = dom.window, d = w.document;
  w.addEventListener("error", e => { fail++; console.log("  ✗ JS error:", e.message); });
  const fire = (el, v, type = "change") => { if (v !== undefined) el.value = v; el.dispatchEvent(new w.Event(type, { bubbles: true })); };
  const devs = () => w.eval("devices()");
  const idx = n => devs().findIndex(x => x.querySelector("name").textContent === n);
  const xml = () => w.eval("serialize()");
  const parses = s => !new w.DOMParser().parseFromString(s, "application/xml").getElementsByTagName("parsererror").length;
  return { w, d, disk, fire, devs, idx, xml, parses, load: (t, n) => w.eval("load")(t, n) };
}

(async () => {
  console.log("\nLoading and round trip");
  {
    const a = app(); const src = EX("05-exported-static-ip.xml");
    ok(a.load(src, "x.xml"), "loads a real export");
    ok(a.xml().trim() === src.trim(), "open + save with no edits is byte-identical");
    ok(!!a.d.querySelector("table.ovt"), "opens on the routing overview");
  }
  {
    const a = app(); a.load(EX("01-generic-before-fix.xml"), "x.xml");
    ok(/<friendly_name>Bluestream-4x4<\/friendly_name>/.test(a.xml()), "adds missing <friendly_name> on load");
    ok(!a.d.getElementById("dirty").hidden, "marks the preset as changed after adding friendly names");
  }

  console.log("\nBuild from every built-in template");
  {
    const a = app(); const { d, w } = a;
    d.getElementById("newBtn2").click();
    const n = w.eval("BUILTIN_TEMPLATES.length");
    for (let i = 1; i < n; i++) d.getElementById("npAddRow").click();
    for (let i = 0; i < n; i++) a.fire(d.querySelectorAll("[data-f=type]")[i], String(i));
    d.getElementById("newForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
    const out = a.xml();
    ok(a.devs().length === n, `builds all ${n} device types`);
    ok(a.parses(out), "result is valid XML");
    ok(!/preferred_master value="true"|<preferred>true/.test(out), "no new device is preferred leader");
    ok(a.devs().every(dv => dv.querySelector("captureInfo") && dv.querySelector("friendly_name")), "every device has captureInfo and friendly_name");
    ok(/All names, routes and clocking look valid/.test(d.getElementById("issues").textContent), "no validation issues");
  }

  console.log("\nRouting, renames and propagation");
  {
    const a = app(); const { d, w } = a;
    d.getElementById("newBtn2").click();
    d.getElementById("npAddRow").click();
    const names = d.querySelectorAll("[data-f=name]");
    a.fire(names[0], "Stage", "input"); a.fire(names[1], "FOH", "input");
    d.getElementById("newForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
    // route FOH Rx1 <- Stage Tx1 via the overview grid
    d.getElementById("overviewBtn").click();
    d.querySelector(`[data-ovtx="${a.idx("Stage")}"]`).click();
    d.querySelector(`[data-ovrx="${a.idx("FOH")}"]`).click();
    d.querySelector(`td[data-x="${a.idx("FOH")},0,${a.idx("Stage")},0"]`).click();
    ok(/<subscribed_channel>01<\/subscribed_channel>\s*<subscribed_device>Stage<\/subscribed_device>/.test(a.xml()), "crosspoint click writes a subscription");
    // rename Tx from the grid
    d.querySelector(`[data-rtx="${a.idx("Stage")},0"]`).click();
    const ed = d.getElementById("ovEdit"); ed.value = "Kick";
    ed.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    ok(/<subscribed_channel>Kick<\/subscribed_channel>/.test(a.xml()), "renaming a Tx label in the grid updates the route");
    // rename device from its page
    d.querySelector(`#devList li[data-i="${a.idx("Stage")}"]`).click();
    a.fire(d.getElementById("devNameIn"), "Stagebox");
    const out = a.xml();
    ok(/<subscribed_device>Stagebox<\/subscribed_device>/.test(out), "renaming a device updates routes");
    ok(/<friendly_name>Stagebox<\/friendly_name>/.test(out), "renaming a device updates friendly_name");
    // copy names: name FOH Rx after its sources
    d.querySelector(`#devList li[data-i="${a.idx("FOH")}"]`).click();
    d.getElementById("copyNamesBtn").click();
    d.getElementById("cnForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
    ok(/<name>Kick<\/name>/.test(a.xml()), "Copy names: Rx named after its source");
  }

  console.log("\nStatic IP");
  {
    const a = app(); const { d } = a;
    a.load(EX("02-exported-after-applying-01.xml"), "x.xml");
    d.querySelector("#devList li").click();
    d.querySelector("[data-tab='network']").click();
    a.fire(d.querySelector("[data-ipmode]"), "static");
    a.fire(d.querySelector("[data-f=address]"), "10.20.20.50");
    a.fire(d.querySelector("[data-f=netmask]"), "255.255.255.0");
    a.fire(d.querySelector("[data-f=gateway]"), "10.20.20.1");
    const out = a.xml();
    ok(/<ipv4_address mode="static">\s*<address>10\.20\.20\.50<\/address>\s*<netmask>255\.255\.255\.0<\/netmask>\s*<gateway>10\.20\.20\.1<\/gateway>\s*<\/ipv4_address>/.test(out), "writes static IP in Dante Controller's format (blank DNS left out)");
    a.fire(d.querySelector("[data-f=netmask]"), "255.0.255.0");
    ok(/subnet mask isn't valid/.test(d.getElementById("issues").textContent), "flags an invalid subnet mask");
    a.fire(d.querySelector("[data-f=netmask]"), "255.255.255.0");
    a.fire(d.querySelector("[data-ipmode]"), "dynamic");
    ok(/<ipv4_address mode="dynamic"\/>/.test(a.xml()), "switching to DHCP writes mode=dynamic");
    a.fire(d.querySelector("[data-ipmode]"), "static");
    ok(d.querySelector("[data-f=address]").value === "10.20.20.50", "switching back to static restores the typed values");
  }

  console.log("\nDante Controller-style views");
  {
    const a = app(); const { d } = a;
    a.load(EX("05-exported-static-ip.xml"), "x.xml");
    ok(d.getElementById("overviewBtn").getAttribute("aria-selected") === "true", "Routing tab is selected after opening");
    d.getElementById("infoBtn").click();
    const row = d.querySelector("table.info tbody tr");
    ok(!!row && /BlueStream/.test(row.textContent) && /10\.20\.20\.190/.test(row.textContent), "Device Info lists each device with its IP");
    row.click();
    ok(!!d.getElementById("devNameIn") && /BlueStream/.test(d.getElementById("deviceTabBtn").textContent), "clicking a Device Info row opens Device View");
    d.querySelector("[data-tab='settings']").click();
    ok(!d.querySelector("[data-ipmode]") && !!d.getElementById("prefLeader"), "Device Config shows clocking, not IP");
    d.querySelector("[data-tab='network']").click();
    ok(!!d.querySelector("[data-ipmode]") && !d.getElementById("prefLeader"), "Network Config shows IP settings");
    ok(/1 device/.test(d.getElementById("statusBar").textContent) && /Preferred Leader/.test(d.getElementById("leaderInfo").textContent), "status bar and preferred-leader readout are filled in");
  }

  console.log("\nPreferred leader");
  {
    const a = app(); const { d } = a;
    a.load(EX("02-exported-after-applying-01.xml"), "x.xml");
    d.querySelector("#devList li").click(); d.querySelector("[data-tab='settings']").click();
    const c = d.getElementById("prefLeader"); c.checked = true; a.fire(c);
    const out = a.xml();
    ok(/<preferred_master value="true"\/>/.test(out) && /<preferred>true<\/preferred>/.test(out), "one tickbox sets both preferred_master and clock_priority/preferred");
  }

  console.log("\nSave and Save as (simulated Chrome file pickers)");
  {
    const a = app({ fsApi: true }); const { d, w, disk } = a;
    disk["bench.xml"] = EX("03-generic-with-friendly-name.xml"); w.__openName = "bench.xml";
    d.getElementById("openBtn2").click(); await tick();
    ok(d.getElementById("fileLabel").textContent === "bench.xml", "Open keeps a file handle");
    d.querySelector("#devList li").click();
    a.fire(d.getElementById("devNameIn"), "BlueStream-3");
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true })); await tick();
    ok(disk["bench.xml"].includes("<name>BlueStream-3</name>"), "Cmd/Ctrl+S saves over the opened file");
    d.getElementById("saveAsBtn").click(); await tick();
    ok(!!disk["saved-as.xml"] && d.getElementById("fileLabel").textContent === "saved-as.xml", "Save as writes a new file and switches to it");
  }
  {
    const a = app(); const { d, w } = a;   // Safari/Firefox: no File System Access API
    a.load(EX("03-generic-with-friendly-name.xml"), "bench.xml"); w.eval("markDirty()");
    d.getElementById("saveBtn").click(); await tick();
    ok(w.__downloaded === "bench.xml", "without the API, Save downloads a copy");
  }

  console.log("\nDesktop app mode (simulated Tauri bridge)");
  {
    const disk = { "/presets/bench.xml": EX("03-generic-with-friendly-name.xml") };
    const calls = [], listeners = {};
    let answer = false;
    const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, beforeParse(w) {
      w.__TAURI__ = {
        core: { invoke: async (cmd, a = {}) => { calls.push(cmd);
          if (cmd === "frontend_ready") return ["/presets/bench.xml"];
          if (cmd === "read_file") return disk[a.path];
          if (cmd === "write_file") { disk[a.path] = a.contents; return null; }
          if (cmd === "save_dialog") return "/presets/copy";
          if (cmd === "ask_dialog") return answer;
          return null; } },
        event: { listen: async (name, fn) => { listeners[name] = fn; } }
      };
    } });
    const w = dom.window, d = w.document;
    w.addEventListener("error", e => { fail++; console.log("  ✗ JS error:", e.message); });
    await tick(60);
    ok(d.getElementById("fileLabel").textContent === "bench.xml", "opens the file the app was launched with");
    ok(["menu", "open-paths", "close-requested"].every(n => listeners[n]), "listens for menu, open-paths and close-requested");
    d.querySelector("#devList li").click();
    const n = d.getElementById("devNameIn"); n.value = "Bench-2"; n.dispatchEvent(new w.Event("change", { bubbles: true }));
    listeners["close-requested"]({}); await tick();
    ok(calls.includes("ask_dialog") && !calls.includes("close_app"), "closing with unsaved changes asks, and Cancel keeps it open");
    listeners["menu"]({ payload: "save" }); await tick();
    ok(disk["/presets/bench.xml"].includes("<name>Bench-2</name>"), "File > Save writes over the opened file");
    listeners["menu"]({ payload: "save_as" }); await tick();
    ok(!!disk["/presets/copy.xml"] && d.getElementById("fileLabel").textContent === "copy.xml", "File > Save As adds .xml and switches to the new file");
    calls.length = 0; listeners["close-requested"]({}); await tick();
    ok(calls.includes("close_app") && !calls.includes("ask_dialog"), "closing with everything saved closes straight away");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
