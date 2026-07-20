const DEDUPE_SCOPES = {
  ALL_WINDOWS: "allWindows",
  ACTIVE_WINDOW: "activeWindow",
};

const DEFAULT_OPTIONS = {
  ignoreQueryParams: false,
  dedupeByHostname: false,
  ignoreSubdomains: false,
  dedupeScope: DEDUPE_SCOPES.ALL_WINDOWS,
};

const form = document.querySelector("#options-form");
const ignoreQueryParamsCheckbox = document.querySelector("#ignore-query-params");
const dedupeByHostnameCheckbox = document.querySelector("#dedupe-by-hostname");
const ignoreSubdomainsCheckbox = document.querySelector("#ignore-subdomains");
const dedupeScopeInputs = document.querySelectorAll("input[name='dedupe-scope']");
const shortcutSettingsLink = document.querySelector("#shortcut-settings-link");
const status = document.querySelector("#status");

function syncDependentOptions() {
  ignoreSubdomainsCheckbox.disabled = !dedupeByHostnameCheckbox.checked;

  if (!dedupeByHostnameCheckbox.checked) {
    ignoreSubdomainsCheckbox.checked = false;
  }
}

async function loadOptions() {
  const options = await chrome.storage.sync.get([
    "ignoreQueryParams",
    "dedupeByHostname",
    "ignoreSubdomains",
    "dedupeScope",
  ]);

  ignoreQueryParamsCheckbox.checked =
    typeof options.ignoreQueryParams === "boolean"
      ? options.ignoreQueryParams
      : DEFAULT_OPTIONS.ignoreQueryParams;

  dedupeByHostnameCheckbox.checked =
    typeof options.dedupeByHostname === "boolean"
      ? options.dedupeByHostname
      : DEFAULT_OPTIONS.dedupeByHostname;

  ignoreSubdomainsCheckbox.checked =
    dedupeByHostnameCheckbox.checked &&
    typeof options.ignoreSubdomains === "boolean"
      ? options.ignoreSubdomains
      : DEFAULT_OPTIONS.ignoreSubdomains;

  const dedupeScope = Object.values(DEDUPE_SCOPES).includes(options.dedupeScope)
    ? options.dedupeScope
    : DEFAULT_OPTIONS.dedupeScope;

  for (const input of dedupeScopeInputs) {
    input.checked = input.value === dedupeScope;
  }

  syncDependentOptions();
}

async function saveOptions() {
  const selectedDedupeScope = document.querySelector(
    "input[name='dedupe-scope']:checked",
  );

  await chrome.storage.sync.set({
    ignoreQueryParams: ignoreQueryParamsCheckbox.checked,
    dedupeByHostname: dedupeByHostnameCheckbox.checked,
    ignoreSubdomains:
      dedupeByHostnameCheckbox.checked && ignoreSubdomainsCheckbox.checked,
    dedupeScope: selectedDedupeScope?.value ?? DEFAULT_OPTIONS.dedupeScope,
  });

  status.textContent = "Saved";
  setTimeout(() => {
    status.textContent = "";
  }, 1500);
}

form.addEventListener("change", () => {
  syncDependentOptions();
  saveOptions();
});

shortcutSettingsLink.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: shortcutSettingsLink.href });
});

loadOptions();
