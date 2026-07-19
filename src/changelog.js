const CHANGELOG = [
  {
    version: "1.0.0",
    changes: [
      "Review duplicate tab groups from the toolbar popup.",
      "Close all duplicate tabs with a keyboard shortcut.",
      "Close duplicates for one URL group at a time.",
      "Choose whether query parameters are ignored while matching duplicates.",
      "Choose whether dedupe runs across all windows or only the active window.",
      "Keep the clicked tab first, then prefer duplicates in the active window.",
      "Show a toolbar badge when duplicate tabs are available to close.",
      "Open Chrome's shortcut settings from the options page.",
    ],
  },
];

const versionContext = document.querySelector("#version-context");
const changelogList = document.querySelector("#changelog-list");
const shortcutSettingsLink = document.querySelector("#shortcut-settings-link");

function getVersionContext() {
  const params = new URLSearchParams(window.location.search);
  const version = params.get("version") ?? chrome.runtime.getManifest().version;
  const previousVersion = params.get("previousVersion");

  if (previousVersion) {
    return `Updated from ${previousVersion} to ${version}`;
  }

  return `Version ${version}`;
}

function renderChangelog() {
  versionContext.textContent = getVersionContext();

  for (const release of CHANGELOG) {
    const section = document.createElement("article");
    section.className = "release";

    const heading = document.createElement("h2");
    heading.textContent = `Version ${release.version}`;

    const changes = document.createElement("ul");

    for (const change of release.changes) {
      const item = document.createElement("li");
      item.textContent = change;
      changes.append(item);
    }

    section.append(heading, changes);
    changelogList.append(section);
  }
}

shortcutSettingsLink.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: shortcutSettingsLink.href });
});

renderChangelog();
