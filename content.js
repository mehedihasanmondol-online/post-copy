let uiContainer = null;
const STORAGE_KEY = `post_copy_${window.location.href.split('?')[0].split('#')[0]}`;
const PAGE_TITLE = document.title || window.location.hostname;

// --- Clipboard Logic ---
document.addEventListener("copy", (e) => {
  // If the user is copying from our own UI, don't intercept/append it to itself!
  if (e.target && e.target.classList && e.target.classList.contains("post-copy-clipboard-textarea")) {
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
  const statusEl = document.getElementById("post-copy-clipboard-status");
  if (statusEl) statusEl.textContent = "Saving...";

  chrome.storage.local.get([STORAGE_KEY], (result) => {
    let currentData = result[STORAGE_KEY];
    
    // Fallback if data exists as old string format
    if (typeof currentData === 'string') {
      currentData = { text: currentData, title: PAGE_TITLE, timestamp: Date.now() };
    }
    
    if (!currentData) {
      currentData = { text: "", title: PAGE_TITLE, timestamp: Date.now() };
    }

    if (currentData.text.length > 0) {
      currentData.text += "\n\n";
    }
    currentData.text += text;
    
    // Keep original timestamp if it exists, otherwise set it
    if (!currentData.timestamp) {
       currentData.timestamp = Date.now();
    }
    
    chrome.storage.local.set({ [STORAGE_KEY]: currentData }, () => {
      // Re-render UI if it's open
      if (uiContainer && uiContainer.style.display !== "none") {
        loadDataToUI(); // Re-render the whole list to show changes
      }
      
      if (statusEl) {
        statusEl.textContent = "Saved!";
        setTimeout(() => {
          if (statusEl.textContent === "Saved!") statusEl.textContent = "";
        }, 1000);
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

window.addEventListener("focus", () => {
  if (uiContainer && uiContainer.style.display !== "none") {
    loadDataToUI();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && uiContainer && uiContainer.style.display !== "none") {
    loadDataToUI();
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
    createUIWrapper();
    loadDataToUI();
  }
}

function createUIWrapper() {
  uiContainer = document.createElement("div");
  uiContainer.id = "post-copy-clipboard-container";

  // Header
  const header = document.createElement("div");
  header.id = "post-copy-clipboard-header";
  
  const headerLeft = document.createElement("div");
  headerLeft.style.display = "flex";
  headerLeft.style.alignItems = "center";
  headerLeft.style.gap = "8px";

  const title = document.createElement("p");
  title.id = "post-copy-clipboard-title";
  title.textContent = "Post-Copy Clipboard";

  const historyBtn = document.createElement("button");
  historyBtn.id = "post-copy-history-btn";
  historyBtn.innerHTML = "🕒";
  historyBtn.title = "Copy last cleared history";
  historyBtn.style.background = "none";
  historyBtn.style.border = "none";
  historyBtn.style.cursor = "pointer";
  historyBtn.style.fontSize = "14px";
  historyBtn.style.padding = "0";
  historyBtn.onclick = () => {
    chrome.storage.local.get(["post_copy_history_cache"], (result) => {
      const historyText = result["post_copy_history_cache"];
      if (historyText) {
        navigator.clipboard.writeText(historyText).then(() => {
          const statusEl = document.getElementById("post-copy-clipboard-status");
          if (statusEl) {
             statusEl.textContent = "History Copied!";
             setTimeout(() => { if (statusEl.textContent === "History Copied!") statusEl.textContent = ""; }, 2000);
          }
        });
      } else {
        const statusEl = document.getElementById("post-copy-clipboard-status");
        if (statusEl) {
           statusEl.textContent = "No history";
           setTimeout(() => { if (statusEl.textContent === "No history") statusEl.textContent = ""; }, 2000);
        }
      }
    });
  };

  const status = document.createElement("span");
  status.id = "post-copy-clipboard-status";
  status.textContent = "";

  headerLeft.appendChild(title);
  headerLeft.appendChild(historyBtn);
  headerLeft.appendChild(status);

  const closeBtn = document.createElement("button");
  closeBtn.id = "post-copy-clipboard-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.onclick = () => { uiContainer.style.display = "none"; };

  header.appendChild(headerLeft);
  header.appendChild(closeBtn);

  // Accordion Container
  const accordionContainer = document.createElement("div");
  accordionContainer.id = "post-copy-accordion-container";

  // Global Footer
  const footer = document.createElement("div");
  footer.id = "post-copy-clipboard-footer";
  footer.style.alignItems = "center";
  
  const globalCounterDiv = document.createElement("div");
  globalCounterDiv.id = "post-copy-global-counter";
  globalCounterDiv.className = "post-copy-local-counter";
  globalCounterDiv.textContent = "Total: 0 words | 0 chars";

  const btnContainer = document.createElement("div");
  btnContainer.style.display = "flex";
  btnContainer.style.gap = "10px";

  const clearAllBtn = document.createElement("button");
  clearAllBtn.id = "post-copy-btn-clear";
  clearAllBtn.className = "post-copy-btn";
  clearAllBtn.textContent = "Clear All";
  clearAllBtn.onclick = () => {
    chrome.storage.local.get(null, (items) => {
      const clipboards = [];
      const keysToRemove = [];
      for (const [key, val] of Object.entries(items)) {
        if (key.startsWith("post_copy_") && key !== "post_copy_history_cache") {
           let data = typeof val === 'string' ? { text: val, timestamp: 0 } : val;
           clipboards.push(data);
           keysToRemove.push(key);
        }
      }
      
      clipboards.sort((a, b) => a.timestamp - b.timestamp);
      const allText = clipboards.map(c => c.text).join("\n\n---\n\n");
      
      if (allText.trim().length > 0) {
        chrome.storage.local.set({ "post_copy_history_cache": allText }, () => {
          chrome.storage.local.remove(keysToRemove, () => {
            loadDataToUI();
          });
        });
      } else {
        chrome.storage.local.remove(keysToRemove, () => {
          loadDataToUI();
        });
      }
    });
  };

  const copyAllBtn = document.createElement("button");
  copyAllBtn.id = "post-copy-btn-copy";
  copyAllBtn.className = "post-copy-btn";
  copyAllBtn.textContent = "Copy All";
  copyAllBtn.onclick = () => {
    // Aggregate all text chronologically
    chrome.storage.local.get(null, (items) => {
      const clipboards = [];
      for (const [key, val] of Object.entries(items)) {
        if (key.startsWith("post_copy_") && key !== "post_copy_history_cache") {
           let data = typeof val === 'string' ? { text: val, timestamp: 0 } : val;
           clipboards.push(data);
        }
      }
      clipboards.sort((a, b) => a.timestamp - b.timestamp);
      
      if (clipboards.length === 0) return;
      
      const allText = clipboards.map(c => c.text).join("\n\n---\n\n");
      
      navigator.clipboard.writeText(allText).then(() => {
        const originalText = copyAllBtn.textContent;
        copyAllBtn.textContent = "Copied!";
        setTimeout(() => { copyAllBtn.textContent = originalText; }, 2000);
      });
    });
  };

  btnContainer.appendChild(clearAllBtn);
  btnContainer.appendChild(copyAllBtn);
  
  footer.appendChild(globalCounterDiv);
  footer.appendChild(btnContainer);

  uiContainer.appendChild(header);
  uiContainer.appendChild(accordionContainer);
  uiContainer.appendChild(footer);
  document.body.appendChild(uiContainer);

  makeDraggable(uiContainer, header);
}

function loadDataToUI() {
  const container = document.getElementById("post-copy-accordion-container");
  if (!container) return;
  container.innerHTML = ""; // Clear existing

  chrome.storage.local.get(null, (items) => {
    const clipboards = [];
    for (const [key, val] of Object.entries(items)) {
      if (key.startsWith("post_copy_") && key !== "post_copy_history_cache") {
         let data = val;
         if (typeof val === 'string') {
            data = { text: val, title: "Unknown Page", timestamp: 0 };
         }
         clipboards.push({ key, data });
      }
    }

    // Sort chronologically (oldest timestamp first)
    clipboards.sort((a, b) => a.data.timestamp - b.data.timestamp);

    // Assign chronological serial numbers
    clipboards.forEach((c, idx) => c.serialNumber = idx + 1);

    // Pin active page to the top
    const currentIndex = clipboards.findIndex(c => c.key === STORAGE_KEY);
    if (currentIndex > -1) {
      const currentItem = clipboards.splice(currentIndex, 1)[0];
      clipboards.unshift(currentItem);
    }

    let totalChars = 0;
    let totalWords = 0;

    clipboards.forEach((item) => {
      const isCurrentPage = item.key === STORAGE_KEY;
      createAccordionItem(container, item.key, item.data, isCurrentPage, item.serialNumber);
      
      totalChars += item.data.text.length;
      totalWords += item.data.text.trim() === "" ? 0 : item.data.text.trim().split(/\s+/).length;
    });

    const globalCounter = document.getElementById("post-copy-global-counter");
    if (globalCounter) {
      globalCounter.textContent = `Total: ${totalWords} words | ${totalChars} chars`;
    }
  });
}

function createAccordionItem(container, key, data, isExpanded, serialNumber) {
  const section = document.createElement("div");
  section.className = "post-copy-accordion-item";
  
  const header = document.createElement("div");
  header.className = "post-copy-accordion-header";
  header.onclick = () => {
    const content = section.querySelector(".post-copy-accordion-content");
    const isCurrentlyExpanded = content.style.display === "flex";
    content.style.display = isCurrentlyExpanded ? "none" : "flex";
  };

  const titleDiv = document.createElement("div");
  titleDiv.className = "post-copy-accordion-title";
  titleDiv.title = data.title || 'Untitled';
  titleDiv.textContent = `${serialNumber}. ${data.title || 'Untitled'}`;
  
  header.appendChild(titleDiv);

  const charCount = data.text.length;
  const wordCount = data.text.trim() === "" ? 0 : data.text.trim().split(/\s+/).length;
  const counterDiv = document.createElement("div");
  counterDiv.className = "post-copy-local-counter";
  counterDiv.textContent = `${wordCount} words | ${charCount} chars`;

  const content = document.createElement("div");
  content.className = "post-copy-accordion-content";
  content.style.display = isExpanded ? "flex" : "none";

  const textarea = document.createElement("textarea");
  textarea.className = "post-copy-clipboard-textarea";
  textarea.value = data.text;
  
  // Update data on edit
  textarea.addEventListener("input", () => {
    data.text = textarea.value;
    chrome.storage.local.set({ [key]: data });
    
    // Update local counters
    const newCharCount = data.text.length;
    const newWordCount = data.text.trim() === "" ? 0 : data.text.trim().split(/\s+/).length;
    counterDiv.textContent = `${newWordCount} words | ${newCharCount} chars`;
    
    // Global counters get updated when UI is fully reloaded, but for live updates on typing we can just let loadDataToUI handle it if needed.
    // For live global update, we might just call loadDataToUI(), but that resets focus. 
  });

  const localFooter = document.createElement("div");
  localFooter.className = "post-copy-local-footer";
  localFooter.style.alignItems = "center";
  
  const localClearBtn = document.createElement("button");
  localClearBtn.className = "post-copy-btn post-copy-local-btn";
  localClearBtn.textContent = "Clear";
  localClearBtn.onclick = () => {
    chrome.storage.local.remove(key, () => {
      loadDataToUI(); // reload UI
    });
  };

  const localCopyBtn = document.createElement("button");
  localCopyBtn.className = "post-copy-btn post-copy-local-btn";
  localCopyBtn.style.backgroundColor = "#e0f0ff";
  localCopyBtn.style.borderColor = "#b3d8ff";
  localCopyBtn.style.color = "#0056b3";
  localCopyBtn.textContent = "Copy";
  localCopyBtn.onclick = () => {
    navigator.clipboard.writeText(data.text).then(() => {
      const originalText = localCopyBtn.textContent;
      localCopyBtn.textContent = "Copied!";
      setTimeout(() => { localCopyBtn.textContent = originalText; }, 2000);
    });
  };

  localFooter.appendChild(counterDiv);
  localFooter.appendChild(localClearBtn);
  localFooter.appendChild(localCopyBtn);

  content.appendChild(textarea);
  content.appendChild(localFooter);

  section.appendChild(header);
  section.appendChild(content);
  container.appendChild(section);
  
  if (isExpanded) {
    // Scroll to bottom of the specific textarea
    setTimeout(() => { textarea.scrollTop = textarea.scrollHeight; }, 0);
  }
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
