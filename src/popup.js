const MESSAGES = {
  GET_DUPLICATE_GROUPS: "getDuplicateGroups",
  CLOSE_ALL_DUPLICATES: "closeAllDuplicates",
  CLOSE_DUPLICATE_GROUP: "closeDuplicateGroup",
};
const PROFILE_LOG_LABEL = "[Dedupe Tabs Pro profile]";

const summary = document.querySelector("#summary");
const closeAllButton = document.querySelector("#close-all");
const duplicateGroups = document.querySelector("#duplicate-groups");
const duplicateGroupTemplate = document.querySelector("#duplicate-group-template");
const shortcutSettingsLink = document.querySelector("#shortcut-settings-link");

let profilingEnabled = false;

async function loadDevOptions() {
  const options = await chrome.storage.local.get(["profilingEnabled"]);
  profilingEnabled = options.profilingEnabled === true;
}

function getDuration(startedAt) {
  if (typeof startedAt !== "number") {
    return undefined;
  }

  return Number((performance.now() - startedAt).toFixed(2));
}

function profileLog(eventName, details) {
  if (!profilingEnabled) {
    return;
  }

  console.info(PROFILE_LOG_LABEL, eventName, details);
}

async function sendMessage(message) {
  const startedAt = profilingEnabled ? performance.now() : undefined;
  const response = await chrome.runtime.sendMessage(message);

  if (!response?.ok) {
    throw new Error(response?.error ?? "Unable to communicate with extension.");
  }

  if (typeof response.data?.profilingEnabled === "boolean") {
    profilingEnabled = response.data.profilingEnabled;
  }

  if (profilingEnabled) {
    console.info(PROFILE_LOG_LABEL, "popup:message", {
      type: message.type,
      durationMs: getDuration(startedAt),
      backgroundProfile: response.data.profile,
    });
  }

  return response.data;
}

function getScopeLabel(scope) {
  return scope === "activeWindow" ? "active window" : "all windows";
}

function renderEmptyState() {
  closeAllButton.disabled = true;
  duplicateGroups.innerHTML = "";

  const emptyState = document.createElement("p");
  emptyState.className = "empty-state";
  emptyState.textContent = "No duplicate tabs found.";
  duplicateGroups.append(emptyState);
}

function renderError(error) {
  closeAllButton.disabled = true;
  summary.textContent = "Could not check tabs.";
  duplicateGroups.innerHTML = "";

  const errorState = document.createElement("p");
  errorState.className = "error-state";
  errorState.textContent = error.message;
  duplicateGroups.append(errorState);
}

function renderDuplicateGroups(result) {
  const startedAt = profilingEnabled ? performance.now() : undefined;
  const { groups, duplicateCount, scope } = result;
  duplicateGroups.innerHTML = "";
  summary.textContent = `${duplicateCount} duplicate tabs available in ${getScopeLabel(scope)}.`;
  closeAllButton.disabled = duplicateCount === 0;

  if (duplicateCount === 0) {
    renderEmptyState();
    return;
  }

  for (const group of groups) {
    const groupNode = duplicateGroupTemplate.content
      .firstElementChild
      .cloneNode(true);

    groupNode.querySelector(".group-url").textContent = group.displayUrl;
    groupNode.querySelector(".group-meta").textContent =
      `${group.tabCount} matching tabs, ${group.closeCount} will close`;

    const closeGroupButton = groupNode.querySelector(".close-group");
    closeGroupButton.textContent = `Close ${group.closeCount}`;
    closeGroupButton.addEventListener("click", async () => {
      const startedAt = profilingEnabled ? performance.now() : undefined;
      closeGroupButton.disabled = true;

      try {
        const result = await sendMessage({
          type: MESSAGES.CLOSE_DUPLICATE_GROUP,
          groupKey: group.key,
        });
        profilingEnabled = result.profilingEnabled;
        profileLog("popup:close-group", {
          groupKey: group.key,
          closedCount: result.closedCount,
          durationMs: getDuration(startedAt),
        });
        await loadDuplicateGroups();
      } catch (error) {
        renderError(error);
      }
    });

    duplicateGroups.append(groupNode);
  }

  profileLog("popup:render-groups", {
    groupCount: groups.length,
    duplicateCount,
    durationMs: getDuration(startedAt),
  });
}

async function loadDuplicateGroups() {
  const startedAt = profilingEnabled ? performance.now() : undefined;

  try {
    const result = await sendMessage({ type: MESSAGES.GET_DUPLICATE_GROUPS });
    profilingEnabled = result.profilingEnabled;
    renderDuplicateGroups(result);
    profileLog("popup:load", {
      groupCount: result.groups.length,
      duplicateCount: result.duplicateCount,
      durationMs: getDuration(startedAt),
    });
  } catch (error) {
    renderError(error);
  }
}

closeAllButton.addEventListener("click", async () => {
  const startedAt = profilingEnabled ? performance.now() : undefined;
  closeAllButton.disabled = true;

  try {
    const result = await sendMessage({ type: MESSAGES.CLOSE_ALL_DUPLICATES });
    profilingEnabled = result.profilingEnabled;
    profileLog("popup:close-all", {
      closedCount: result.closedCount,
      durationMs: getDuration(startedAt),
    });
    await loadDuplicateGroups();
  } catch (error) {
    renderError(error);
  }
});

shortcutSettingsLink.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: shortcutSettingsLink.href });
});

loadDevOptions().then(loadDuplicateGroups);
