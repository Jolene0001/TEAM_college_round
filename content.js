(function() {
  if (window.hasHandsFreeRun) return;
  window.hasHandsFreeRun = true;

  let localStream = null;
  let trackingActive = false;
  let currentX = 0;
  let currentY = 0;
  let pointer = null;
  let recognition = null;

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "LAUNCH_HANDS_FREE") {
      injectConsentOverlay();
    }
  });

  function injectConsentOverlay() {
    if (document.getElementById('hfConsentOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'hfConsentOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '20px';
    overlay.style.left = '50%';
    overlay.style.transform = 'translateX(-50%)';
    overlay.style.backgroundColor = '#ffffff';
    overlay.style.border = '3px solid #1a73e8';
    overlay.style.borderRadius = '12px';
    overlay.style.padding = '15px 25px';
    overlay.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
    overlay.style.zIndex = '999999';
    overlay.style.textAlign = 'center';
    overlay.style.fontFamily = 'Arial, sans-serif';

    const text = document.createElement('p');
    text.innerText = "🤖 Hands-Free Interface Ready! Click below to initialize voice engine controls.";
    text.style.margin = '0 0 12px 0';
    text.style.color = '#3c4043';
    text.style.fontWeight = 'bold';
    text.style.fontSize = '14px';

    const button = document.createElement('button');
    button.innerText = "Connect Microphone & Launch";
    button.style.backgroundColor = '#1a73e8';
    button.style.color = '#ffffff';
    button.style.border = 'none';
    button.style.padding = '8px 18px';
    button.style.borderRadius = '20px';
    button.style.cursor = 'pointer';
    button.style.fontWeight = 'bold';
    button.style.fontSize = '13px';

    button.addEventListener('click', () => {
      overlay.remove();
      initializeAllInOneSystem();
    });

    overlay.appendChild(text);
    overlay.appendChild(button);
    document.body.appendChild(overlay);
  }

  async function initializeAllInOneSystem() {
    if (document.getElementById('hfVideoContainer')) return;

    const container = document.createElement('div');
    container.id = 'hfVideoContainer';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.width = '160px';
    container.style.height = '120px';
    container.style.backgroundColor = '#202124';
    container.style.borderRadius = '12px';
    container.style.border = '3px solid #1a73e8';
    container.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
    container.style.zIndex = '999998';
    container.style.overflow = 'hidden';

    const video = document.createElement('video');
    video.id = 'hfVideoFeed';
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.transform = 'scaleX(-1)';
    video.style.objectFit = 'cover';

    const canvas = document.createElement('canvas');
    canvas.id = 'hfOverlay';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.transform = 'scaleX(-1)';
    canvas.style.pointerEvents = 'none';

    container.appendChild(video);
    container.appendChild(canvas);
    document.body.appendChild(container);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 160, height: 120 }
      });
      video.srcObject = localStream;

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        trackingActive = true;
        requestAnimationFrame(processFrame);
      };

      function processFrame() {
        if (!trackingActive) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = frame.data;

        let totalX = 0, totalY = 0, count = 0;
        for (let i = 0; i < data.length; i += 8) {
          if (data[i] > 190 && data[i+1] > 190 && data[i+2] > 150) {
            const idx = i / 4;
            totalX += idx % canvas.width;
            totalY += Math.floor(idx / canvas.width);
            count++;
          }
        }

        if (count > 8) {
          const cx = totalX / count;
          const cy = totalY / count;
          currentX = Math.round((1 - (cx / canvas.width)) * window.innerWidth);
          currentY = Math.round((cy / canvas.height) * window.innerHeight);
          updateVirtualPointer(currentX, currentY);
        }
        requestAnimationFrame(processFrame);
      }

      launchVoiceEngine();

    } catch (err) {
      alert("Hardware access failed. Please check extension permissions.");
    }
  }

  function updateVirtualPointer(x, y) {
    if (!pointer) {
      pointer = document.createElement('div');
      pointer.id = 'handsFreePointer';
      pointer.style.position = 'fixed';
      pointer.style.width = '30px';
      pointer.style.height = '30px';
      pointer.style.backgroundColor = 'rgba(156, 39, 176, 0.9)'; 
      pointer.style.border = '4px solid white';
      pointer.style.borderRadius = '50%';
      pointer.style.zIndex = '999999';
      pointer.style.pointerEvents = 'none';
      pointer.style.boxShadow = '0 0 15px rgba(0,0,0,0.4)';
      pointer.style.transition = 'left 0.02s linear, top 0.02s linear';
      document.body.appendChild(pointer);
    }
    pointer.style.left = Math.max(10, Math.min(x, window.innerWidth - 40)) + 'px';
    pointer.style.top = Math.max(10, Math.min(y, window.innerHeight - 40)) + 'px';
  }

  function launchVoiceEngine() {
    if (!('webkitSpeechRecognition' in window)) return;
    
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      if (!event.results || event.results.length <= event.resultIndex) return;
      const textRow = event.results[event.resultIndex];
      if (!textRow || textRow.length === 0 || !textRow[0]) return;
      
      // FIXED: Added [0] index accessor parameter to grab the true string data
      const command = textRow[0].transcript.trim().toLowerCase();
      console.log("🔊 Heard Command:", command);

      if (command.includes("down") || command.includes("scroll down")) {
        window.scrollBy({ top: 500, behavior: 'smooth' });
      } 
      // Fixed: Backwards traversal voice handler
      else if (command.includes("up") || command.includes("scroll up")) {
        window.scrollBy({ top: -500, behavior: 'smooth' });
      } 
      else if (command.includes("ok") || command.includes("okay") || command.includes("select") || command.includes("click")) {
        if (pointer) {
          const clickX = parseFloat(pointer.style.left) + 15;
          const clickY = parseFloat(pointer.style.top) + 15;
          
          const target = document.elementFromPoint(clickX, clickY);
          if (target) {
            target.click();
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') target.focus();
            
            pointer.style.backgroundColor = '#00e676'; 
            setTimeout(() => { if(pointer) pointer.style.backgroundColor = 'rgba(156, 39, 176, 0.9)'; }, 400);
          }
        }
      }
    };

    recognition.onerror = (e) => console.warn("Voice looping note:", e.error);
    recognition.onend = () => { try { recognition.start(); } catch(e) {} };
    
    recognition.start();
  }
})();
