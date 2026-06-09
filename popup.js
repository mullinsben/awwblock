// popup.js
// Cross-browser extension API (Chrome/Edge: chrome, Firefox: chrome|browser).
const ext = globalThis.chrome ?? globalThis.browser;
const countEl = document.getElementById("count");
const toggle = document.getElementById("toggle");
const stateLabel = document.getElementById("state-label");
const themeEl = document.getElementById("theme");
const chips = [...document.querySelectorAll("input[data-animal]")];

function chipStyles() {
  chips.forEach((c) => c.closest(".chip").classList.toggle("off", !c.checked));
}
function summary() {
  const n = chips.filter((c) => c.checked).length;
  if (themeEl) themeEl.textContent = n ? `${n} of ${chips.length} cuties in rotation` : "all cuties off";
}

function render(s) {
  countEl.textContent = s.deployed || 0;
  const on = s.enabled !== false;
  toggle.checked = on;
  stateLabel.textContent = on ? "Deploying" : "Off duty";
  const animals = s.animals || {};
  chips.forEach((c) => { c.checked = animals[c.dataset.animal] !== false; });
  chipStyles();
  summary();
}

ext.storage.local.get(["deployed", "enabled", "animals"], render);

toggle.addEventListener("change", () => {
  ext.storage.local.set({ enabled: toggle.checked });
  stateLabel.textContent = toggle.checked ? "Deploying" : "Off duty";
});

chips.forEach((chip) => {
  chip.addEventListener("change", () => {
    ext.storage.local.get(["animals"], (s) => {
      const animals = s.animals || {};
      animals[chip.dataset.animal] = chip.checked;
      ext.storage.local.set({ animals });
      chipStyles();
      summary();
    });
  });
});

// Live-update the counter while the popup is open.
ext.storage.onChanged.addListener((ch) => {
  if (ch.deployed) countEl.textContent = ch.deployed.newValue || 0;
});
