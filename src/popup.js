const MESSAGES = {
  GET_DUPLICATE_GROUPS: "getDuplicateGroups",
  CLOSE_ALL_DUPLICATES: "closeAllDuplicates",
  CLOSE_DUPLICATE_GROUP: "closeDuplicateGroup",
};

const summary = document.querySelector("#summary");
const closeAllButton = document.querySelector("#close-all");
const duplicateGroups = document.querySelector("#duplicate-groups");
const duplicateGroupTemplate = document.querySelector("#duplicate-group-template");
const shortcutSettingsLink = document.querySelector("#shortcut-settings-link");

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);

  if (!response?.ok) {
    throw new Error(response?.error ?? "Unable to communicate with extension.");
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
      closeGroupButton.disabled = true;
      await sendMessage({
        type: MESSAGES.CLOSE_DUPLICATE_GROUP,
        groupKey: group.key,
      });
      await loadDuplicateGroups();
    });

    duplicateGroups.append(groupNode);
  }
}

async function loadDuplicateGroups() {
  try {
    const result = await sendMessage({ type: MESSAGES.GET_DUPLICATE_GROUPS });
    renderDuplicateGroups(result);
  } catch (error) {
    renderError(error);
  }
}

closeAllButton.addEventListener("click", async () => {
  closeAllButton.disabled = true;
  await sendMessage({ type: MESSAGES.CLOSE_ALL_DUPLICATES });
  await loadDuplicateGroups();
});

shortcutSettingsLink.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: shortcutSettingsLink.href });
});

loadDuplicateGroups();
