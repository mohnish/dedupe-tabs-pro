const DEDUPE_SCOPES = {
  ALL_WINDOWS: "allWindows",
  ACTIVE_WINDOW: "activeWindow",
};

const DEFAULT_OPTIONS = {
  ignoreQueryParams: false,
  dedupeScope: DEDUPE_SCOPES.ALL_WINDOWS,
};

const form = document.querySelector("#options-form");
const ignoreQueryParamsCheckbox = document.querySelector("#ignore-query-params");
const dedupeScopeInputs = document.querySelectorAll("input[name='dedupe-scope']");
const shortcutSettingsLink = document.querySelector("#shortcut-settings-link");
const shortcutKeys = document.querySelector("#shortcut-keys");
const status = document.querySelector("#status");

async function loadOptions() {
  const options = await chrome.storage.sync.get([
    "ignoreQueryParams",
    "dedupeScope",
  ]);

  ignoreQueryParamsCheckbox.checked =
    typeof options.ignoreQueryParams === "boolean"
      ? options.ignoreQueryParams
      : DEFAULT_OPTIONS.ignoreQueryParams;

  const dedupeScope = Object.values(DEDUPE_SCOPES).includes(options.dedupeScope)
    ? options.dedupeScope
    : DEFAULT_OPTIONS.dedupeScope;

  for (const input of dedupeScopeInputs) {
    input.checked = input.value === dedupeScope;
  }
}

function renderShortcut(shortcut) {
  shortcutKeys.replaceChildren();

  if (!shortcut) {
    const empty = document.createElement("span");
    empty.className = "keys-empty";
    empty.textContent = "No shortcut set";
    shortcutKeys.append(empty);
    return;
  }

  const keys = shortcut.includes("+") ? shortcut.split("+") : [shortcut];

  for (const key of keys) {
    const keyNode = document.createElement("kbd");
    keyNode.textContent = key;
    shortcutKeys.append(keyNode);
  }
}

async function loadShortcut() {
  if (!chrome.commands?.getAll) {
    return;
  }

  const commands = await chrome.commands.getAll();
  const closeCommand = commands.find((command) => command.name === "close-all-duplicates");
  renderShortcut(closeCommand?.shortcut || "");
}

async function saveOptions() {
  const selectedDedupeScope = document.querySelector(
    "input[name='dedupe-scope']:checked",
  );

  await chrome.storage.sync.set({
    ignoreQueryParams: ignoreQueryParamsCheckbox.checked,
    dedupeScope: selectedDedupeScope?.value ?? DEFAULT_OPTIONS.dedupeScope,
  });

  status.textContent = "Saved";
  setTimeout(() => {
    status.textContent = "";
  }, 1500);
}

form.addEventListener("change", () => {
  if (!globalThis.chrome?.storage?.sync) {
    return;
  }

  saveOptions();
});

shortcutSettingsLink.addEventListener("click", (event) => {
  event.preventDefault();

  if (!globalThis.chrome?.tabs?.create) {
    return;
  }

  chrome.tabs.create({ url: shortcutSettingsLink.href });
});

if (globalThis.chrome?.storage?.sync) {
  loadOptions();
}

if (globalThis.chrome?.commands?.getAll) {
  loadShortcut();
}
