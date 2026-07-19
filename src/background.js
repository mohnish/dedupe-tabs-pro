const DEDUPE_SCOPES = {
  ALL_WINDOWS: "allWindows",
  ACTIVE_WINDOW: "activeWindow",
};

const DEFAULT_OPTIONS = {
  ignoreQueryParams: false,
  dedupeScope: DEDUPE_SCOPES.ALL_WINDOWS,
};

const CHANGELOG_PAGE_PATH = "src/changelog.html";
const DUPLICATE_BADGE_COLOR = "#b3261e";
const DEFAULT_ACTION_TITLE = "Review duplicate tabs";
const MESSAGES = {
  GET_DUPLICATE_GROUPS: "getDuplicateGroups",
  CLOSE_ALL_DUPLICATES: "closeAllDuplicates",
  CLOSE_DUPLICATE_GROUP: "closeDuplicateGroup",
};

let badgeUpdateTimeoutId;

async function getOptions() {
  const options = await chrome.storage.sync.get([
    "ignoreQueryParams",
    "dedupeScope",
  ]);

  if (typeof options.ignoreQueryParams !== "boolean") {
    options.ignoreQueryParams = DEFAULT_OPTIONS.ignoreQueryParams;
  }

  if (!Object.values(DEDUPE_SCOPES).includes(options.dedupeScope)) {
    options.dedupeScope = DEFAULT_OPTIONS.dedupeScope;
  }

  return options;
}

async function getTabsForDedupe(options, clickedTab) {
  if (
    options.dedupeScope === DEDUPE_SCOPES.ACTIVE_WINDOW &&
    typeof clickedTab?.windowId === "number"
  ) {
    return chrome.tabs.query({ windowId: clickedTab.windowId });
  }

  return chrome.tabs.query({ windowType: "normal" });
}

async function getCurrentContextTab() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
    windowType: "normal",
  });

  return activeTab;
}

function getDedupeKey(tabUrl, options) {
  if (!tabUrl) {
    return null;
  }

  try {
    const url = new URL(tabUrl);

    if (options.ignoreQueryParams) {
      url.search = "";
    }

    return url.href;
  } catch {
    return tabUrl;
  }
}

function orderedTabs(tabs) {
  return [...tabs].sort((a, b) => {
    if (a.windowId !== b.windowId) {
      return a.windowId - b.windowId;
    }

    return a.index - b.index;
  });
}

function getHighestIdTab(tabs) {
  return tabs.reduce((mostRecentTab, tab) => {
    const currentId = tab.id ?? 0;
    const mostRecentId = mostRecentTab.id ?? 0;

    return currentId > mostRecentId ? tab : mostRecentTab;
  });
}

function getTabToKeep(matchingTabs, clickedTab) {
  const activeTabMatch = matchingTabs.find((tab) => tab.id === clickedTab?.id);

  if (activeTabMatch) {
    return activeTabMatch;
  }

  const activeWindowMatches = matchingTabs.filter(
    (tab) => tab.windowId === clickedTab?.windowId,
  );

  if (activeWindowMatches.length > 0) {
    return getHighestIdTab(activeWindowMatches);
  }

  return getHighestIdTab(matchingTabs);
}

function getTabsToClose(tabs, options, clickedTab) {
  return getDuplicateGroups(tabs, options, clickedTab).flatMap(
    (group) => group.tabIdsToClose,
  );
}

function getTabSummary(tab, tabToKeep) {
  return {
    id: tab.id,
    title: tab.title || tab.url || "Untitled tab",
    url: tab.url || "",
    windowId: tab.windowId,
    index: tab.index,
    active: tab.active,
    kept: tab.id === tabToKeep.id,
  };
}

function getDuplicateGroups(tabs, options, clickedTab) {
  const tabsByUrl = new Map();

  for (const tab of orderedTabs(tabs)) {
    const key = getDedupeKey(tab.url, options);

    if (!key || tab.id === undefined) {
      continue;
    }

    if (!tabsByUrl.has(key)) {
      tabsByUrl.set(key, []);
    }

    tabsByUrl.get(key).push(tab);
  }

  const duplicateGroups = [];

  for (const [key, matchingTabs] of tabsByUrl.entries()) {
    if (matchingTabs.length < 2) {
      continue;
    }

    const tabToKeep = getTabToKeep(matchingTabs, clickedTab);
    const tabIdsToClose = matchingTabs
      .filter((tab) => tab.id !== tabToKeep.id)
      .map((tab) => tab.id);

    duplicateGroups.push({
      key,
      displayUrl: key,
      tabCount: matchingTabs.length,
      closeCount: tabIdsToClose.length,
      tabIdsToClose,
      keepTabId: tabToKeep.id,
      tabs: matchingTabs.map((tab) => getTabSummary(tab, tabToKeep)),
    });
  }

  return duplicateGroups;
}

async function getDuplicateGroupsForContext(contextTab) {
  const options = await getOptions();
  const tab = contextTab ?? (await getCurrentContextTab());
  const tabs = await getTabsForDedupe(options, tab);
  const groups = getDuplicateGroups(tabs, options, tab);

  return {
    groups,
    duplicateCount: groups.reduce((sum, group) => sum + group.closeCount, 0),
    scope: options.dedupeScope,
    ignoreQueryParams: options.ignoreQueryParams,
  };
}

async function closeDuplicateTabs(contextTab) {
  const result = await getDuplicateGroupsForContext(contextTab);
  const duplicateTabIds = result.groups.flatMap((group) => group.tabIdsToClose);

  if (duplicateTabIds.length > 0) {
    await chrome.tabs.remove(duplicateTabIds);
  }

  await updateDuplicateBadge(contextTab);
  return { closedCount: duplicateTabIds.length };
}

async function closeDuplicateGroup(groupKey, contextTab) {
  const result = await getDuplicateGroupsForContext(contextTab);
  const group = result.groups.find((candidate) => candidate.key === groupKey);

  if (!group) {
    await updateDuplicateBadge(contextTab);
    return { closedCount: 0 };
  }

  await chrome.tabs.remove(group.tabIdsToClose);
  await updateDuplicateBadge(contextTab);
  return { closedCount: group.tabIdsToClose.length };
}

async function updateDuplicateBadge(contextTab) {
  const result = await getDuplicateGroupsForContext(contextTab);
  const duplicateCount = result.duplicateCount;

  if (duplicateCount === 0) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setTitle({ title: DEFAULT_ACTION_TITLE });
    return;
  }

  await chrome.action.setBadgeBackgroundColor({ color: DUPLICATE_BADGE_COLOR });
  await chrome.action.setBadgeText({ text: String(duplicateCount) });
  await chrome.action.setTitle({
    title: `${DEFAULT_ACTION_TITLE} (${duplicateCount} duplicate tabs available)`,
  });
}

function scheduleDuplicateBadgeUpdate() {
  clearTimeout(badgeUpdateTimeoutId);
  badgeUpdateTimeoutId = setTimeout(() => {
    updateDuplicateBadge();
  }, 150);
}

function showChangelogOnUpdate(details) {
  if (details.reason !== "update") {
    return;
  }

  const manifest = chrome.runtime.getManifest();
  const changelogUrl = new URL(chrome.runtime.getURL(CHANGELOG_PAGE_PATH));

  changelogUrl.searchParams.set("version", manifest.version);

  if (details.previousVersion) {
    changelogUrl.searchParams.set("previousVersion", details.previousVersion);
  }

  chrome.tabs.create({ url: changelogUrl.href });
}

async function handleMessage(message) {
  if (message?.type === MESSAGES.GET_DUPLICATE_GROUPS) {
    return {
      ok: true,
      data: await getDuplicateGroupsForContext(),
    };
  }

  if (message?.type === MESSAGES.CLOSE_ALL_DUPLICATES) {
    return {
      ok: true,
      data: await closeDuplicateTabs(),
    };
  }

  if (message?.type === MESSAGES.CLOSE_DUPLICATE_GROUP) {
    return {
      ok: true,
      data: await closeDuplicateGroup(message.groupKey),
    };
  }

  return {
    ok: false,
    error: "Unknown message type.",
  };
}

chrome.runtime.onInstalled.addListener((details) => {
  showChangelogOnUpdate(details);
  scheduleDuplicateBadgeUpdate();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleDuplicateBadgeUpdate();
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "close-all-duplicates") {
    closeDuplicateTabs(tab);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error.message,
      });
    });

  return true;
});

chrome.tabs.onActivated.addListener(() => {
  scheduleDuplicateBadgeUpdate();
});

chrome.tabs.onAttached.addListener(() => {
  scheduleDuplicateBadgeUpdate();
});

chrome.tabs.onCreated.addListener(() => {
  scheduleDuplicateBadgeUpdate();
});

chrome.tabs.onDetached.addListener(() => {
  scheduleDuplicateBadgeUpdate();
});

chrome.tabs.onMoved.addListener(() => {
  scheduleDuplicateBadgeUpdate();
});

chrome.tabs.onRemoved.addListener(() => {
  scheduleDuplicateBadgeUpdate();
});

chrome.tabs.onReplaced.addListener(() => {
  scheduleDuplicateBadgeUpdate();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    scheduleDuplicateBadgeUpdate();
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  scheduleDuplicateBadgeUpdate();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName === "sync" &&
    (changes.ignoreQueryParams || changes.dedupeScope)
  ) {
    scheduleDuplicateBadgeUpdate();
  }
});
