;(function () {
  if (window.hfCleanup) {
    try {
      window.hfCleanup();
    } catch (err) {}
  }

  var oldOverlay = document.getElementById("hfActivationOverlay");
  if (oldOverlay) oldOverlay.remove();

  var oldWidget = document.getElementById("hfWidgetContainer");
  if (oldWidget) oldWidget.remove();

  var oldPointer = document.getElementById("handsFreePointerGlobal");
  if (oldPointer) oldPointer.remove();

  window.hfPointerEl = null;
  window.hfLastKnownX = 0;
  window.hfLastKnownY = 0;

  var trackingActive = false;
  var localStream = null;
  var recognition = null;
  var isSpeechEngineRunning = false;
  var startingRecognition = false;
  var restartTimer = null;
  var heartbeatTimer = null;
  var disposed = false;

  function cleanup() {
    disposed = true;
    trackingActive = false;

    if (restartTimer !== null) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }

    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      try {
        recognition.abort();
      } catch (err) {}

      recognition = null;
    }

    isSpeechEngineRunning = false;
    startingRecognition = false;

    if (localStream) {
      localStream.getTracks().forEach(function (track) {
        track.stop();
      });
      localStream = null;
    }

    ["hfActivationOverlay", "hfWidgetContainer", "handsFreePointerGlobal"].forEach(function (id) {
      var element = document.getElementById(id);
      if (element) element.remove();
    });

    window.hfPointerEl = null;

    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.onMessage
    ) {
      try {
        chrome.runtime.onMessage.removeListener(messageListener);
      } catch (err) {}
    }
  }

  window.hfCleanup = cleanup;

  function messageListener(request) {
    if (request && request.action === "LAUNCH_SYSTEM") {
      injectActivationOverlay();
    }
  }

  if (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.onMessage
  ) {
    try {
      chrome.runtime.onMessage.addListener(messageListener);
    } catch (err) {
      console.warn("Extension messaging unavailable:", err.message);
    }
  }

  function injectActivationOverlay() {
    if (
      disposed ||
      document.getElementById("hfActivationOverlay") ||
      document.getElementById("hfWidgetContainer")
    ) {
      return;
    }

    var overlay = document.createElement("div");
    overlay.id = "hfActivationOverlay";

    Object.assign(overlay.style, {
      position: "fixed",
      top: "15px",
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "#ffffff",
      border: "4px solid #9c27b0",
      borderRadius: "30px",
      padding: "12px 28px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      zIndex: "2147483646",
      display: "flex",
      alignItems: "center",
      gap: "15px",
      fontFamily: "Arial, sans-serif"
    });

    var txt = document.createElement("span");
    txt.innerText = "🤖 Hands-Free Access Ready!";

    Object.assign(txt.style, {
      color: "#202124",
      fontWeight: "bold",
      fontSize: "14px"
    });

    var btn = document.createElement("button");
    btn.innerText = "Initialize Accessibility Framework";

    Object.assign(btn.style, {
      backgroundColor: "#9c27b0",
      color: "#ffffff",
      border: "none",
      padding: "8px 18px",
      borderRadius: "20px",
      cursor: "pointer",
      fontWeight: "bold",
      fontSize: "13px"
    });

    btn.addEventListener("click", function () {
      overlay.remove();
      initializeAllInOneSystem();
    });

    overlay.appendChild(txt);
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
  }

  async function initializeAllInOneSystem() {
    if (disposed || document.getElementById("hfWidgetContainer")) {
      return;
    }

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      alert("Camera and microphone access is unavailable on this page. Try a regular HTTPS website.");
      injectActivationOverlay();
      return;
    }

    var container = document.createElement("div");
    container.id = "hfWidgetContainer";

    Object.assign(container.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "180px",
      height: "170px",
      backgroundColor: "#202124",
      border: "4px solid #9c27b0",
      borderRadius: "14px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
      zIndex: "2147483645",
      overflow: "hidden",
      fontFamily: "Arial, sans-serif"
    });

    var header = document.createElement("div");
    header.innerText = "📹 HANDS-FREE TRACKER ACTIVE";

    Object.assign(header.style, {
      color: "#ffffff",
      backgroundColor: "#9c27b0",
      fontSize: "9px",
      fontWeight: "bold",
      textAlign: "center",
      padding: "5px 0"
    });

    var video = document.createElement("video");
    video.id = "hfWidgetVideo";
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;

    Object.assign(video.style, {
      width: "100%",
      height: "110px",
      transform: "scaleX(-1)",
      objectFit: "cover"
    });

    var canvas = document.createElement("canvas");
    canvas.id = "hfWidgetCanvas";

    Object.assign(canvas.style, {
      position: "absolute",
      top: "18px",
      left: "0",
      width: "100%",
      height: "110px",
      transform: "scaleX(-1)",
      pointerEvents: "none"
    });

    var statusBanner = document.createElement("div");
    statusBanner.id = "hfStatusBanner";
    statusBanner.innerText = "🎙️ Initializing...";

    Object.assign(statusBanner.style, {
      color: "#34a853",
      backgroundColor: "#ffffff",
      fontSize: "9px",
      fontWeight: "bold",
      textAlign: "center",
      padding: "4px 0"
    });

    container.appendChild(header);
    container.appendChild(video);
    container.appendChild(canvas);
    container.appendChild(statusBanner);
    document.body.appendChild(container);

    var ctx = canvas.getContext("2d", {
      willReadFrequently: true
    });

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: 180,
          height: 110
        }
      });

      if (disposed || !container.isConnected) {
        localStream.getTracks().forEach(function (track) {
          track.stop();
        });
        localStream = null;
        return;
      }

      video.srcObject = localStream;

      video.onloadedmetadata = function () {
        if (disposed || !video.videoWidth || !video.videoHeight) {
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        trackingActive = true;
        requestAnimationFrame(runTrackingFrameLoop);
        launchTabVoiceEngine();
      };

      video.play().catch(function (err) {
        console.warn("Video playback error:", err.message);
      });

      if (video.readyState >= 1) {
        video.onloadedmetadata();
      }

    } catch (err) {
      console.warn("Camera or microphone initialization failed:", err.message);

      if (localStream) {
        localStream.getTracks().forEach(function (track) {
          track.stop();
        });
        localStream = null;
      }

      trackingActive = false;
      container.remove();

      if (!disposed) {
        injectActivationOverlay();
      }
    }

    function runTrackingFrameLoop() {
      if (
        disposed ||
        !trackingActive ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        return;
      }

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        var frame = ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );

        var data = frame.data;
        var totalX = 0;
        var totalY = 0;
        var count = 0;

        for (var i = 0; i < data.length; i += 32) {
          if (
            data[i] > 190 &&
            data[i + 1] > 190 &&
            data[i + 2] > 140
          ) {
            var idx = i / 4;

            totalX += idx % canvas.width;
            totalY += Math.floor(idx / canvas.width);
            count++;
          }
        }

        if (count > 8) {
          var cx = totalX / count;
          var cy = totalY / count;

          window.hfLastKnownX = Math.round(
            (1 - cx / canvas.width) * window.innerWidth
          );

          window.hfLastKnownY = Math.round(
            (cy / canvas.height) * window.innerHeight
          );

          updateLivePointer(
            window.hfLastKnownX,
            window.hfLastKnownY
          );
        }

      } catch (err) {
        console.warn("Tracking error:", err.message);
      }

      requestAnimationFrame(runTrackingFrameLoop);
    }
  }

  function updateLivePointer(x, y) {
    if (disposed) return;

    if (!window.hfPointerEl) {
      window.hfPointerEl = document.createElement("div");
      window.hfPointerEl.id = "handsFreePointerGlobal";

      Object.assign(window.hfPointerEl.style, {
        position: "fixed",
        width: "30px",
        height: "30px",
        backgroundColor: "rgba(156, 39, 176, 0.9)",
        border: "4px solid white",
        borderRadius: "50%",
        zIndex: "2147483647",
        pointerEvents: "none",
        boxShadow: "0 0 15px rgba(0,0,0,0.4)",
        transition: "left 0.02s linear, top 0.02s linear"
      });

      document.body.appendChild(window.hfPointerEl);
    }

    window.hfLastKnownX = Math.max(
      0,
      Math.min(x, window.innerWidth - 38)
    );

    window.hfLastKnownY = Math.max(
      0,
      Math.min(y, window.innerHeight - 38)
    );

    window.hfPointerEl.style.left =
      window.hfLastKnownX + "px";

    window.hfPointerEl.style.top =
      window.hfLastKnownY + "px";
  }

  function launchTabVoiceEngine() {
    var SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus("⚠️ Speech recognition unsupported");
      return;
    }

    if (disposed || recognition) return;

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = function () {
      isSpeechEngineRunning = true;
      startingRecognition = false;
      setStatus("🎙️ Listening for Up / Down / Click");
    };

    recognition.onresult = function (event) {
      if (!event.results || event.resultIndex >= event.results.length) {
        return;
      }

      var result = event.results[event.resultIndex];

      if (!result || !result[0]) return;

      var command = (result[0].transcript || "")
        .trim()
        .toLowerCase();

      if (!command) return;

      setStatus("🗣️ Heard: " + command);

      if (
        command === "down" ||
        command.includes("scroll down")
      ) {
        window.scrollBy({
          top: 500,
          behavior: "smooth"
        });

      } else if (
        command === "up" ||
        command.includes("scroll up")
      ) {
        window.scrollBy({
          top: -500,
          behavior: "smooth"
        });

      } else if (
        /\b(yes|okay|ok|click)\b/.test(command)
      ) {
        if (window.hfPointerEl) {
          var targetEl = document.elementFromPoint(
            window.hfLastKnownX + 15,
            window.hfLastKnownY + 15
          );

          if (
            targetEl &&
            !targetEl.closest("#hfWidgetContainer") &&
            !targetEl.closest("#hfActivationOverlay")
          ) {
            targetEl.click();

            if (
              targetEl.tagName === "INPUT" ||
              targetEl.tagName === "TEXTAREA"
            ) {
              targetEl.focus();
            }

            window.hfPointerEl.style.backgroundColor = "#00e676";

            setTimeout(function () {
              if (window.hfPointerEl) {
                window.hfPointerEl.style.backgroundColor =
                  "rgba(156, 39, 176, 0.9)";
              }
            }, 400);
          }
        }
      }
    };

    recognition.onerror = function (event) {
      isSpeechEngineRunning = false;
      startingRecognition = false;

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setStatus("⚠️ Microphone permission denied");
        return;
      }

      if (event.error === "audio-capture") {
        setStatus("⚠️ No microphone detected");
        return;
      }

      if (event.error !== "aborted") {
        setStatus("🎙️ Restarting voice recognition...");
      }

      restartVoiceSafely();
    };

    recognition.onend = function () {
      isSpeechEngineRunning = false;
      startingRecognition = false;
      restartVoiceSafely();
    };

    startRecognitionSafely();
  }

  function setStatus(message) {
    var banner = document.getElementById("hfStatusBanner");

    if (banner) {
      banner.innerText = message;
    }
  }

  function startRecognitionSafely() {
    if (
      disposed ||
      !trackingActive ||
      !recognition ||
      isSpeechEngineRunning ||
      startingRecognition
    ) {
      return;
    }

    startingRecognition = true;

    try {
      recognition.start();
    } catch (err) {
      startingRecognition = false;
      restartVoiceSafely();
    }
  }

  function restartVoiceSafely() {
    if (
      disposed ||
      !trackingActive ||
      !recognition ||
      isSpeechEngineRunning ||
      startingRecognition ||
      restartTimer !== null
    ) {
      return;
    }

    restartTimer = setTimeout(function () {
      restartTimer = null;
      startRecognitionSafely();
    }, 1200);
  }

  heartbeatTimer = setInterval(function () {
    if (disposed) return;

    document.querySelectorAll('a[target="_blank"]').forEach(function (link) {
      link.setAttribute("target", "_self");
    });

    restartVoiceSafely();
  }, 1000);

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      injectActivationOverlay,
      { once: true }
    );
  } else {
    injectActivationOverlay();
  }
})();










