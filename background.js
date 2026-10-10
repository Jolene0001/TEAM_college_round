// 1. Master Toggle Switch: Triggered upon clicking the extension icon
chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id || !tab.url || tab.url.startsWith("chrome://")) return;

  chrome.storage.local.get(['globalHandsFreeStateActive'], function(data) {
    let newState = !data.globalHandsFreeStateActive;
    
    chrome.storage.local.set({ globalHandsFreeStateActive: newState }, function() {
      if (newState) {
        injectAndLaunchCoreSystem(tab.id);
      } else {
        // Force a page refresh to clear out the extension variables when clicked again
        chrome.tabs.reload(tab.id);
      }
    });
  });
});

// 2. THE UNIVERSAL PERSISTENCE ENGINE: Automatically runs on hard page refreshes AND hidden product URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && !tab.url.startsWith("chrome://")) {
    // FIXED: Triggers if the page completes a standard load OR if a dynamic AJAX link swaps the URL address string
    if (changeInfo.status === 'complete' || changeInfo.url) {
      chrome.storage.local.get(['globalHandsFreeStateActive'], function(data) {
        if (data && data.globalHandsFreeStateActive === true) {
          injectAndLaunchCoreSystem(tabId);
        }
      });
    }
  }
});

function injectAndActivateSystem(targetTabId) {
  chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    files: ['content.js']
  }).then(() => {
    chrome.tabs.sendMessage(targetTabId, { action: "LAUNCH_SYSTEM" }).catch(() => {});
  }).catch((err) => console.log("System transition sweep notice:", err));
}

function injectAndLaunchCoreSystem(targetTabId) {
  injectAndActivateSystem(targetTabId);
}



