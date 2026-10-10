let recognition;
let localStream = null;
let trackingActive = false;
let currentCursorX = 0;
let currentCursorY = 0;
let cachedTabId = null;

// Track active window tabs smoothly in the background context
setInterval(async () => {
  if (!trackingActive) return;
  try {
    let [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab && activeTab.url && !activeTab.url.startsWith('chrome-extension://')) {
      cachedTabId = activeTab.id;
    }
  } catch (e) {}
}, 300);

document.getElementById('listenBtn').addEventListener('click', async () => {
  const status = document.getElementById('statusText');
  const logBox = document.getElementById('consoleLogs');
  const video = document.getElementById('videoFeed');
  const canvas = document.getElementById('trackingOverlay');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  try {
    logBox.innerHTML += `[SYS] Spawning processing architecture...<br>`;
    
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { width: 320, height: 240 }
    });
    
    video.srcObject = localStream;
    status.innerText = "📹 Framework Online. Tracking fingertip marker...";
    
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      trackingActive = true;
      requestAnimationFrame(processVisionFrame);
    };

    function processVisionFrame() {
      if (!trackingActive) return;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = frame.data;
      
      let totalX = 0, totalY = 0, matchingPixels = 0;
      
      for (let i = 0; i < data.length; i += 8) {
        if (data[i] > 180 && data[i+1] > 180 && data[i+2] > 140) {
          const pixelIndex = i / 4;
          totalX += pixelIndex % canvas.width;
          totalY += Math.floor(pixelIndex / canvas.width);
          matchingPixels++;
        }
      }
      
      if (matchingPixels > 10) {
        const centroidX = totalX / matchingPixels;
        const centroidY = totalY / matchingPixels;
        
        ctx.fillStyle = '#ff1744';
        ctx.beginPath();
        ctx.arc(centroidX, centroidY, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // Map calculations onto display canvas widths
        currentCursorX = Math.round((1 - (centroidX / canvas.width)) * window.screen.width);
        currentCursorY = Math.round((centroidY / canvas.height) * window.screen.height);
        
        if (cachedTabId) {
          chrome.tabs.sendMessage(cachedTabId, { type: "MOVE_POINTER", x: currentCursorX, y: currentCursorY }).catch(() => {});
        }
      }
      
      requestAnimationFrame(processVisionFrame);
    }

    // Fixed: Native script injection logic execution matrix for speech scrolling commands
    function executeVoiceScroll(direction) {
      if (cachedTabId) {
        logBox.innerHTML += `[VOICE] Scroll ${direction.toUpperCase()}<br>`;
        const scrollAmt = direction === "down" ? 500 : -500;
        chrome.scripting.executeScript({
          target: { tabId: cachedTabId },
          func: (amt) => window.scrollBy({ top: amt, behavior: 'smooth' }),
          args: [scrollAmt]
        }).catch(() => {});
      }
    }

    if ('webkitSpeechRecognition' in window) {
      recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        status.innerText = "📡 Workspace Active: Systems Listening...";
        status.style.color = "#137333";
        document.getElementById('listenBtn').style.display = "none";
      };

      recognition.onresult = (event) => {
        if (!event.results || event.results.length <= event.resultIndex) return;
        const resultRow = event.results[event.resultIndex];
        if (!resultRow || resultRow.length === 0 || !resultRow[0]) return;
        
        const command = resultRow[0].transcript.trim().toLowerCase();
        status.innerText = `🗣️ Heard Action: "${command}"`;
        
        if (command.includes("down") || command.includes("scroll down")) {
          executeVoiceScroll("down");
        } else if (command.includes("up") || command.includes("scroll up")) {
          executeVoiceScroll("up");
        } else if (command.includes("ok") || command.includes("okay") || command.includes("select") || command.includes("click")) {
          if (cachedTabId) chrome.tabs.sendMessage(cachedTabId, { type: "CLICK_POINTER" }).catch(() => {});
        }
      };

      recognition.onerror = () => { try { recognition.start(); } catch(e) {} };
      recognition.onend = () => { if (trackingActive) try { recognition.start(); } catch(e) {} };
      recognition.start();
    }

  } catch (err) {
    status.innerText = "❌ Media Boot Failed!";
  }
});
