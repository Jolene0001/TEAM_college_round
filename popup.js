document.getElementById('startBtn').addEventListener('click', async () => {
  const statusText = document.getElementById('statusText');
  
  try {
    // 1. Get the current active tab
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    statusText.innerText = "Injecting Core...";

    // 2. FORCE inject the content script file directly on demand
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    // 3. Send the initialization signal safely now that it definitely exists
    chrome.tabs.sendMessage(tab.id, { action: "LAUNCH_HANDS_FREE" });
    statusText.innerText = "System Active!";
    
    // Close the popup after a brief delay
    setTimeout(() => window.close(), 800);

  } catch (err) {
    console.error(err);
    statusText.innerText = "Error! Refresh Page.";
    statusText.style.color = "red";
  }
});
