(function() {
  if (window.hasHandsFreeRunActiveGlobal) return;
  window.hasHandsFreeRunActiveGlobal = true;

  window.hfPointerEl = null;
  window.hfLastKnownX = 0;
  window.hfLastKnownY = 0;
  var trackingActive = false;
  var localStream = null;
  var recognition = null;

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "LAUNCH_SYSTEM") {
      injectFloatingWorkspace();
    }
  });

  async function injectFloatingWorkspace() {
    if (document.getElementById('hfWidgetContainer')) return;

    var container = document.createElement('div');
    container.id = 'hfWidgetContainer';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.width = '180px';
    container.style.height = '170px';
    container.style.backgroundColor = '#202124';
    container.style.border = '4px solid #9c27b0';
    container.style.borderRadius = '14px';
    container.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    container.style.zIndex = '999998';
    container.style.overflow = 'hidden';
    container.style.fontFamily = 'Arial, sans-serif';

    var header = document.createElement('div');
    header.innerText = "📹 HANDS-FREE TRACKER ACTIVE";
    header.style.color = '#ffffff';
    header.style.backgroundColor = '#9c27b0';
    header.style.fontSize = '9px';
    header.style.fontWeight = 'bold';
    header.style.textAlign = 'center';
    header.style.padding = '5px 0';

    var video = document.createElement('video');
    video.id = 'hfWidgetVideo';
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = '100%';
    video.style.height = '110px';
    video.style.transform = 'scaleX(-1)';
    video.style.objectFit = 'cover';

    var canvas = document.createElement('canvas');
    canvas.id = 'hfWidgetCanvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '18px';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '110px';
    canvas.style.transform = 'scaleX(-1)';
    canvas.style.pointerEvents = 'none';

    var statusBanner = document.createElement('div');
    statusBanner.id = 'hfStatusBanner';
    statusBanner.innerText = "🎙️ Listening for Down / Up / Yes...";
    statusBanner.style.color = '#34a853';
    statusBanner.style.backgroundColor = '#ffffff';
    statusBanner.style.fontSize = '9px';
    statusBanner.style.fontWeight = 'bold';
    statusBanner.style.textAlign = 'center';
    statusBanner.style.padding = '4px 0';

    container.appendChild(header);
    container.appendChild(video);
    container.appendChild(canvas);
    container.appendChild(statusBanner);
    document.body.appendChild(container);

    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 180, height: 110 }
      });
      video.srcObject = localStream;

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        trackingActive = true;
        requestAnimationFrame(runTrackingFrameLoop);
      };

      function runTrackingFrameLoop() {
        if (!trackingActive) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        var frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var data = frame.data;

        var totalX = 0, totalY = 0, count = 0;
        for (var i = 0; i < data.length; i += 8) {
          if (data[i] > 190 && data[i+1] > 190 && data[i+2] > 140) {
            var idx = i / 4;
            totalX += idx % canvas.width;
            totalY += Math.floor(idx / canvas.width);
            count++;
          }
        }

        if (count > 8) {
          var cx = totalX / count;
          var cy = totalY / count;

          window.hfLastKnownX = Math.round((1 - (cx / canvas.width)) * window.innerWidth);
          window.hfLastKnownY = Math.round((cy / canvas.height) * window.innerHeight);

          updateLivePointer(window.hfLastKnownX, window.hfLastKnownY);
        }
        requestAnimationFrame(runTrackingFrameLoop);
      }

      launchTabVoiceEngine();

    } catch (err) {
      console.error(err);
      container.remove();
      alert("Hardware initialization prompt aborted. Reset permissions.");
    }
  }

  function updateLivePointer(x, y) {
    if (!window.hfPointerEl) {
      window.hfPointerEl = document.createElement('div');
      window.hfPointerEl.id = 'handsFreePointerGlobal';
      window.hfPointerEl.style.position = 'fixed';
      window.hfPointerEl.style.width = '30px';
      window.hfPointerEl.style.height = '30px';
      window.hfPointerEl.style.backgroundColor = 'rgba(156, 39, 176, 0.9)'; 
      window.hfPointerEl.style.border = '4px solid white';
      window.hfPointerEl.style.borderRadius = '50%';
      window.hfPointerEl.style.zIndex = '999999';
      window.hfPointerEl.style.pointerEvents = 'none';
      window.hfPointerEl.style.boxShadow = '0 0 15px rgba(0,0,0,0.4)';
      window.hfPointerEl.style.transition = 'left 0.02s linear, top 0.02s linear';
      document.body.appendChild(window.hfPointerEl);
    }
    
    window.hfLastKnownX = Math.max(15, Math.min(x, window.innerWidth - 45));
    window.hfLastKnownY = Math.max(15, Math.min(y, window.innerHeight - 45));
    window.hfPointerEl.style.left = window.hfLastKnownX + 'px';
    window.hfPointerEl.style.top = window.hfLastKnownY + 'px';
  }

  // FIXED: Added array index parsing parameters to capture speech text without drops
  function launchTabVoiceEngine() {
    if (!('webkitSpeechRecognition' in window)) return;
    
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      if (!event.results || event.results.length <= event.resultIndex) return;
      var textRow = event.results[event.resultIndex];
      if (!textRow || textRow.length === 0 || !textRow[0]) return;
      
      var command = textRow[0].transcript.trim().toLowerCase();
      var banner = document.getElementById('hfStatusBanner');
      if (banner) banner.innerText = "🗣️ Heard: " + command;

      if (command.includes("down") || command.includes("scroll down")) {
        window.scrollBy({ top: 500, behavior: 'smooth' });
      } 
      else if (command.includes("up") || command.includes("scroll up")) {
        window.scrollBy({ top: -500, behavior: 'smooth' });
      } 
      else if (command.includes("yes") || command.includes("ok") || command.includes("okay") || command.includes("click")) {
        if (window.hfPointerEl) {
          var clickX = window.hfLastKnownX + 15;
          var clickY = window.hfLastKnownY + 15;
          var targetEl = document.elementFromPoint(clickX, clickY);
          if (targetEl) {
            targetEl.click();
            if (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA') targetEl.focus();
            
            window.hfPointerEl.style.backgroundColor = '#00e676'; 
            setTimeout(() => { 
              if(window.hfPointerEl) window.hfPointerEl.style.backgroundColor = 'rgba(156, 39, 176, 0.9)'; 
            }, 400);
          }
        }
      }
    };

    recognition.onerror = (e) => {
      if ((e.error === 'no-speech' || e.error === 'aborted') && recognition) {
        try { recognition.start(); } catch(err) {}
      }
    };
    
    recognition.onend = () => { 
      try { recognition.start(); } catch(e) {} 
    };
    
    recognition.start();
  }

  setInterval(() => {
    var allLinks = document.querySelectorAll('a[target="_blank"]');
    allLinks.forEach(function(link) {
      link.setAttribute('target', '_self');
    });
  }, 1000);

})();






