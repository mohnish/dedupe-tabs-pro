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
const DEFAULT_DEV_OPTIONS = {
  profilingEnabled: false,
};

const CHANGELOG_PAGE_PATH = "src/changelog.html";
const DUPLICATE_BADGE_COLOR = "#b3261e";
const DEFAULT_ACTION_TITLE = "Review duplicate tabs";
const MESSAGES = {
  GET_DUPLICATE_GROUPS: "getDuplicateGroups",
  CLOSE_ALL_DUPLICATES: "closeAllDuplicates",
  CLOSE_DUPLICATE_GROUP: "closeDuplicateGroup",
};
const PROFILE_LOG_LABEL = "[Dedupe Tabs Pro profile]";
const COMMON_MULTI_PART_PUBLIC_SUFFIXES = new Set([
  "ac.uk",
  "co.in",
  "co.jp",
  "co.nz",
  "co.uk",
  "com.au",
  "com.br",
  "com.cn",
  "com.hk",
  "com.mx",
  "com.sg",
  "com.tr",
  "com.tw",
  "gov.uk",
  "net.au",
  "org.au",
  "org.uk",
]);

let badgeUpdateTimeoutId;
let profilingEnabled = DEFAULT_DEV_OPTIONS.profilingEnabled;

async function getOptions() {
  const options = await chrome.storage.sync.get([
    "ignoreQueryParams",
    "dedupeByHostname",
    "ignoreSubdomains",
    "dedupeScope",
  ]);

  if (typeof options.ignoreQueryParams !== "boolean") {
    options.ignoreQueryParams = DEFAULT_OPTIONS.ignoreQueryParams;
  }

  if (typeof options.dedupeByHostname !== "boolean") {
    options.dedupeByHostname = DEFAULT_OPTIONS.dedupeByHostname;
  }

  options.ignoreSubdomains =
    options.dedupeByHostname && typeof options.ignoreSubdomains === "boolean"
      ? options.ignoreSubdomains
      : DEFAULT_OPTIONS.ignoreSubdomains;

  if (!Object.values(DEDUPE_SCOPES).includes(options.dedupeScope)) {
    options.dedupeScope = DEFAULT_OPTIONS.dedupeScope;
  }

  return options;
}

async function loadDevOptions() {
  const options = await chrome.storage.local.get(["profilingEnabled"]);

  profilingEnabled =
    typeof options.profilingEnabled === "boolean"
      ? options.profilingEnabled
      : DEFAULT_DEV_OPTIONS.profilingEnabled;
}

function getDuration(startedAt) {
  return Number((performance.now() - startedAt).toFixed(2));
}

function profileLog(eventName, details) {
  if (!profilingEnabled) {
    return;
  }

  console.info(PROFILE_LOG_LABEL, eventName, details);
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

function isIpAddressHostname(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function getBaseHostname(hostname) {
  const normalizedHostname = hostname.toLowerCase();

  if (!normalizedHostname || isIpAddressHostname(normalizedHostname)) {
    return normalizedHostname;
  }

  const labels = normalizedHostname.split(".").filter(Boolean);

  if (labels.length <= 2) {
    return normalizedHostname;
  }

  const publicSuffix = labels.slice(-2).join(".");

  if (COMMON_MULTI_PART_PUBLIC_SUFFIXES.has(publicSuffix)) {
    return labels.slice(-3).join(".");
  }

  return labels.slice(-2).join(".");
}

function getDedupeKey(tabUrl, options) {
  if (!tabUrl) {
    return null;
  }

  try {
    const url = new URL(tabUrl);

    if (options.dedupeByHostname) {
      if (!url.hostname) {
        return url.href;
      }

      return options.ignoreSubdomains
        ? getBaseHostname(url.hostname)
        : url.hostname;
    }

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
    dedupeByHostname: options.dedupeByHostname,
    ignoreSubdomains: options.ignoreSubdomains,
  };
}

async function getProfiledDuplicateGroupsForContext(contextTab, profileEventName) {
  const startedAt = performance.now();

  const optionsStartedAt = performance.now();
  const options = await getOptions();
  const optionsMs = getDuration(optionsStartedAt);

  const contextStartedAt = performance.now();
  const tab = contextTab ?? (await getCurrentContextTab());
  const contextMs = getDuration(contextStartedAt);

  const queryStartedAt = performance.now();
  const tabs = await getTabsForDedupe(options, tab);
  const queryMs = getDuration(queryStartedAt);

  const groupingStartedAt = performance.now();
  const groups = getDuplicateGroups(tabs, options, tab);
  const groupingMs = getDuration(groupingStartedAt);
  const duplicateCount = groups.reduce((sum, group) => sum + group.closeCount, 0);

  const profile = {
    event: profileEventName ?? "duplicate-groups",
    tabCount: tabs.length,
    groupCount: groups.length,
    duplicateCount,
    scope: options.dedupeScope,
    ignoreQueryParams: options.ignoreQueryParams,
    dedupeByHostname: options.dedupeByHostname,
    ignoreSubdomains: options.ignoreSubdomains,
    durationsMs: {
      options: optionsMs,
      context: contextMs,
      tabsQuery: queryMs,
      grouping: groupingMs,
      total: getDuration(startedAt),
    },
  };

  profileLog(profile.event, profile);

  return {
    groups,
    duplicateCount,
    scope: options.dedupeScope,
    ignoreQueryParams: options.ignoreQueryParams,
    profilingEnabled,
    profile,
  };
}

async function getDuplicateGroupsForContextWithOptionalProfile(
  contextTab,
  profileEventName,
) {
  if (profilingEnabled) {
    return getProfiledDuplicateGroupsForContext(contextTab, profileEventName);
  }

  const result = await getDuplicateGroupsForContext(contextTab);
  return {
    ...result,
    profilingEnabled: false,
  };
}

async function closeDuplicateTabs(contextTab) {
  const result = await getDuplicateGroupsForContextWithOptionalProfile(
    contextTab,
    "close-all:groups",
  );
  const duplicateTabIds = result.groups.flatMap((group) => group.tabIdsToClose);

  if (duplicateTabIds.length > 0) {
    await chrome.tabs.remove(duplicateTabIds);
  }

  await updateDuplicateBadge(contextTab);
  return { closedCount: duplicateTabIds.length };
}

async function closeDuplicateTabsWithProfile(contextTab) {
  const startedAt = performance.now();
  const result = await getProfiledDuplicateGroupsForContext(
    contextTab,
    "close-all:groups",
  );
  const duplicateTabIds = result.groups.flatMap((group) => group.tabIdsToClose);
  const removeStartedAt = performance.now();

  if (duplicateTabIds.length > 0) {
    await chrome.tabs.remove(duplicateTabIds);
  }

  const removeMs = getDuration(removeStartedAt);
  await updateDuplicateBadge(contextTab);
  const profile = {
    event: "close-all",
    closedCount: duplicateTabIds.length,
    removeMs,
    totalMs: getDuration(startedAt),
  };

  profileLog(profile.event, profile);

  return {
    closedCount: duplicateTabIds.length,
    profilingEnabled: true,
    profile,
  };
}

async function closeDuplicateGroup(groupKey, contextTab) {
  const result = await getDuplicateGroupsForContextWithOptionalProfile(
    contextTab,
    "close-group:groups",
  );
  const group = result.groups.find((candidate) => candidate.key === groupKey);

  if (!group) {
    await updateDuplicateBadge(contextTab);
    return { closedCount: 0 };
  }

  await chrome.tabs.remove(group.tabIdsToClose);
  await updateDuplicateBadge(contextTab);
  return { closedCount: group.tabIdsToClose.length };
}

async function closeDuplicateGroupWithProfile(groupKey, contextTab) {
  const startedAt = performance.now();
  const result = await getProfiledDuplicateGroupsForContext(
    contextTab,
    "close-group:groups",
  );
  const group = result.groups.find((candidate) => candidate.key === groupKey);

  if (!group) {
    await updateDuplicateBadge(contextTab);
    return {
      closedCount: 0,
      profilingEnabled: true,
    };
  }

  const removeStartedAt = performance.now();
  await chrome.tabs.remove(group.tabIdsToClose);
  const removeMs = getDuration(removeStartedAt);
  await updateDuplicateBadge(contextTab);
  const profile = {
    event: "close-group",
    groupKey,
    closedCount: group.tabIdsToClose.length,
    removeMs,
    totalMs: getDuration(startedAt),
  };

  profileLog(profile.event, profile);

  return {
    closedCount: group.tabIdsToClose.length,
    profilingEnabled: true,
    profile,
  };
}

async function updateDuplicateBadge(contextTab, reason = "direct") {
  const result = await getDuplicateGroupsForContextWithOptionalProfile(
    contextTab,
    `badge:${reason}`,
  );
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

function scheduleDuplicateBadgeUpdate(reason) {
  clearTimeout(badgeUpdateTimeoutId);
  badgeUpdateTimeoutId = setTimeout(() => {
    updateDuplicateBadge(undefined, reason);
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
      data: await getDuplicateGroupsForContextWithOptionalProfile(),
    };
  }

  if (message?.type === MESSAGES.CLOSE_ALL_DUPLICATES) {
    return {
      ok: true,
      data: profilingEnabled
        ? await closeDuplicateTabsWithProfile()
        : await closeDuplicateTabs(),
    };
  }

  if (message?.type === MESSAGES.CLOSE_DUPLICATE_GROUP) {
    return {
      ok: true,
      data: profilingEnabled
        ? await closeDuplicateGroupWithProfile(message.groupKey)
        : await closeDuplicateGroup(message.groupKey),
    };
  }

  return {
    ok: false,
    error: "Unknown message type.",
  };
}

loadDevOptions();

chrome.runtime.onInstalled.addListener((details) => {
  showChangelogOnUpdate(details);
  loadDevOptions();
  scheduleDuplicateBadgeUpdate("installed");
});

chrome.runtime.onStartup.addListener(() => {
  loadDevOptions();
  scheduleDuplicateBadgeUpdate("startup");
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
  scheduleDuplicateBadgeUpdate("tab-activated");
});

chrome.tabs.onAttached.addListener(() => {
  scheduleDuplicateBadgeUpdate("tab-attached");
});

chrome.tabs.onCreated.addListener(() => {
  scheduleDuplicateBadgeUpdate("tab-created");
});

chrome.tabs.onDetached.addListener(() => {
  scheduleDuplicateBadgeUpdate("tab-detached");
});

chrome.tabs.onMoved.addListener(() => {
  scheduleDuplicateBadgeUpdate("tab-moved");
});

chrome.tabs.onRemoved.addListener(() => {
  scheduleDuplicateBadgeUpdate("tab-removed");
});

chrome.tabs.onReplaced.addListener(() => {
  scheduleDuplicateBadgeUpdate("tab-replaced");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    scheduleDuplicateBadgeUpdate("tab-updated");
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  scheduleDuplicateBadgeUpdate("window-focus");
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName === "sync" &&
    (changes.ignoreQueryParams ||
      changes.dedupeByHostname ||
      changes.ignoreSubdomains ||
      changes.dedupeScope)
  ) {
    scheduleDuplicateBadgeUpdate("options-changed");
  }

  if (areaName === "local" && changes.profilingEnabled) {
    profilingEnabled =
      typeof changes.profilingEnabled.newValue === "boolean"
        ? changes.profilingEnabled.newValue
        : DEFAULT_DEV_OPTIONS.profilingEnabled;
    scheduleDuplicateBadgeUpdate("dev-options-changed");
  }
});
