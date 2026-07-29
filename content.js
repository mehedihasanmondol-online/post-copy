let uiContainer = null;
let textarea = null;

// Use the origin + pathname to ignore query strings/hashes if preferred, but href is fine.
const STORAGE_KEY = `post_copy_${window.location.href.split('?')[0].split('#')[0]}`;

// --- Clipboard Logic ---
document.addEventListener("copy", (e) => {
  // If the user is copying from our own UI, don't intercept/append it to itself!
  if (e.target && e.target.id === "post-copy-clipboard-textarea") {
    return;
  }

  let copiedText = "";
  
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
    copiedText = activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
  } else {
    copiedText = window.getSelection().toString();
  }

  if (copiedText.trim().length > 0) {
    appendData(copiedText);
  }
});

function appendData(text) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    let currentText = result[STORAGE_KEY] || "";
    if (currentText.length > 0) {
      currentText += "\n\n";
    }
    currentText += text;
    
    chrome.storage.local.set({ [STORAGE_KEY]: currentText }, () => {
      // Update UI if it's open
      if (textarea) {
        textarea.value = currentText;
        updateCounters();
        scrollToBottom();
      }
    });
  });
}

// --- UI Logic ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggle_clipboard") {
    toggleUI();
  }
});

function toggleUI() {
  if (uiContainer) {
    if (uiContainer.style.display === "none") {
      uiContainer.style.display = "flex";
      loadDataToUI();
    } else {
      uiContainer.style.display = "none";
    }
  } else {
    createUI();
    loadDataToUI();
  }
}

function loadDataToUI() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (textarea) {
      textarea.value = result[STORAGE_KEY] || "";
      updateCounters();
      scrollToBottom();
    }
  });
}

function updateCounters() {
  if (!textarea) return;
  const text = textarea.value;
  const charCount = text.length;
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  
  const countersEl = document.getElementById("post-copy-clipboard-counters");
  if (countersEl) {
    countersEl.textContent = `${wordCount} words | ${charCount} chars`;
  }
}

function scrollToBottom() {
  if (textarea) {
    textarea.scrollTop = textarea.scrollHeight;
  }
}

function createUI() {
  uiContainer = document.createElement("div");
  uiContainer.id = "post-copy-clipboard-container";

  // Header
  const header = document.createElement("div");
  header.id = "post-copy-clipboard-header";
  
  const title = document.createElement("p");
  title.id = "post-copy-clipboard-title";
  title.textContent = "Post-Copy Clipboard";

  const closeBtn = document.createElement("button");
  closeBtn.id = "post-copy-clipboard-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.onclick = () => { uiContainer.style.display = "none"; };

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Textarea
  textarea = document.createElement("textarea");
  textarea.id = "post-copy-clipboard-textarea";
  textarea.placeholder = "Copied text will appear here...";
  textarea.addEventListener("input", () => {
    // Save manual edits
    chrome.storage.local.set({ [STORAGE_KEY]: textarea.value });
    updateCounters();
  });

  // Counters
  const countersDiv = document.createElement("div");
  countersDiv.id = "post-copy-clipboard-counters";
  countersDiv.textContent = "0 words | 0 chars";

  // Footer
  const footer = document.createElement("div");
  footer.id = "post-copy-clipboard-footer";

  const clearBtn = document.createElement("button");
  clearBtn.id = "post-copy-btn-clear";
  clearBtn.className = "post-copy-btn";
  clearBtn.textContent = "Clear";
  clearBtn.onclick = () => {
    chrome.storage.local.set({ [STORAGE_KEY]: "" }, () => {
      textarea.value = "";
      updateCounters();
    });
  };

  const copyAllBtn = document.createElement("button");
  copyAllBtn.id = "post-copy-btn-copy";
  copyAllBtn.className = "post-copy-btn";
  copyAllBtn.textContent = "Copy All";
  copyAllBtn.onclick = () => {
    navigator.clipboard.writeText(textarea.value).then(() => {
      const originalText = copyAllBtn.textContent;
      copyAllBtn.textContent = "Copied!";
      setTimeout(() => { copyAllBtn.textContent = originalText; }, 2000);
    });
  };

  footer.appendChild(clearBtn);
  footer.appendChild(copyAllBtn);

  uiContainer.appendChild(header);
  uiContainer.appendChild(textarea);
  uiContainer.appendChild(countersDiv);
  uiContainer.appendChild(footer);
  document.body.appendChild(uiContainer);

  makeDraggable(uiContainer, header);
}

function makeDraggable(elmnt, header) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  header.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    
    // Clear right/bottom so left/top takes precedence
    elmnt.style.right = "auto";
    elmnt.style.bottom = "auto";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}
