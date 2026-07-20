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
  saveOptions();
});

shortcutSettingsLink.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: shortcutSettingsLink.href });
});

loadOptions();
