// Background Service Worker
// Handles message passing and storage management

// Badge management functions
function setBadgeSuccess(tabId = null) {
  const target = tabId ? { tabId } : {};
  chrome.action.setBadgeText({ text: '✓', ...target });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', ...target }); // Green
}

function setBadgeDefault(tabId = null) {
  const target = tabId ? { tabId } : {};
  chrome.action.setBadgeText({ text: '', ...target });
  chrome.action.setBadgeBackgroundColor({ color: '#808080', ...target }); // Grey
}

function setBadgeNotLoggedIn(tabId = null) {
  const target = tabId ? { tabId } : {};
  chrome.action.setBadgeText({ text: '?', ...target });
  chrome.action.setBadgeBackgroundColor({ color: '#FFC107', ...target }); // Yellow
}

// Update badge for a specific tab based on stored job info and login status
function updateBadgeForTab(tabId) {
  chrome.storage.local.get(['jobInfoByTab', 'authToken', 'tokenExpiration'], (result) => {
    // Check if user is logged in
    const isLoggedIn = result.authToken && result.tokenExpiration && Date.now() < result.tokenExpiration;
    
    if (!isLoggedIn) {
      setBadgeNotLoggedIn(tabId);
      return;
    }
    
    // User is logged in, check for job info
    const jobInfoByTab = result.jobInfoByTab || {};
    const jobInfo = jobInfoByTab[tabId];
    
    if (jobInfo && (jobInfo.jobTitle || jobInfo.companyName)) {
      setBadgeSuccess(tabId);
    } else {
      setBadgeDefault(tabId);
    }
  });
}

// Update badge for the active tab
function updateBadgeForActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      updateBadgeForTab(tabs[0].id);
    }
  });
}

// Initialize badge on startup
function initializeBadge() {
  chrome.storage.local.get(['authToken', 'tokenExpiration'], (result) => {
    const isLoggedIn = result.authToken && result.tokenExpiration && Date.now() < result.tokenExpiration;
    if (isLoggedIn) {
      updateBadgeForActiveTab();
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          setBadgeNotLoggedIn(tabs[0].id);
        } else {
          setBadgeNotLoggedIn();
        }
      });
    }
  });
}

// Initialize badge when extension starts
initializeBadge();

function isSupportedJobBoard(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes('linkedin.com') ||
           hostname.includes('ziprecruiter.com') ||
           hostname.includes('indeed.com') ||
           hostname.includes('joinhandshake.com');
  } catch (e) {
    return false;
  }
}

function parseJobFromTab(tabId) {
  // Send message to content script to parse the current page
  chrome.tabs.sendMessage(tabId, { action: 'parseCurrentPage' }, (response) => {
    if (chrome.runtime.lastError) {
      // Content script might not be ready yet, try again after a delay
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: 'parseCurrentPage' }, (retryResponse) => {
          if (!chrome.runtime.lastError && retryResponse && retryResponse.success && retryResponse.data) {
            // Save the parsed data for this specific tab
            saveJobInfoForTab(tabId, retryResponse.data);
          }
        });
      }, 1000);
      return;
    }

    if (response && response.success && response.data) {
      // Save the parsed data for this specific tab
      saveJobInfoForTab(tabId, response.data);
    }
  });
}

// Save job info for a specific tab
function saveJobInfoForTab(tabId, jobData) {
  chrome.storage.local.get(['jobInfoByTab'], (result) => {
    const jobInfoByTab = result.jobInfoByTab || {};
    jobInfoByTab[tabId] = jobData;
    
    chrome.storage.local.set({ 
      jobInfoByTab: jobInfoByTab,
      lastJobInfo: jobData // Keep lastJobInfo for backward compatibility
    }, () => {
      if (!chrome.runtime.lastError) {
        console.log('Job info collected for tab:', tabId, jobData);
        updateBadgeForTab(tabId);
      }
    });
  });
}

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Update badge for the newly active tab
  updateBadgeForTab(activeInfo.tabId);
  
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    
    if (tab && tab.url && isSupportedJobBoard(tab.url)) {
      // Wait a bit for the page to be ready
      setTimeout(() => {
        parseJobFromTab(activeInfo.tabId);
      }, 500);
    } else {
      // Not a job board, set badge to default for this tab
      setBadgeDefault(activeInfo.tabId);
    }
  });
});

// Listen for tab updates (when URL changes in a tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process when the page is fully loaded
  if (changeInfo.status === 'complete') {
    // Check if this is the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      if (activeTabs.length > 0 && activeTabs[0].id === tabId) {
        if (tab.url && isSupportedJobBoard(tab.url)) {
          // Wait a bit for dynamic content to load
          setTimeout(() => {
            parseJobFromTab(tabId);
          }, 1000);
        } else {
          // Not a job board, set badge to default for this tab
          setBadgeDefault(tabId);
        }
      }
    });
  }
});

// Clean up job info when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(['jobInfoByTab'], (result) => {
    const jobInfoByTab = result.jobInfoByTab || {};
    if (jobInfoByTab[tabId]) {
      delete jobInfoByTab[tabId];
      chrome.storage.local.set({ jobInfoByTab });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadgeForLogin') {
    // Update badge based on login status
    if (request.loggedIn) {
      // User logged in, update badge based on job info
      updateBadgeForActiveTab();
    } else {
      // User not logged in, show yellow badge with ?
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          setBadgeNotLoggedIn(tabs[0].id);
        } else {
          setBadgeNotLoggedIn();
        }
      });
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'saveJobInfo') {
    // Get the tab ID from the sender, or get active tab if from popup
    const tabId = sender.tab ? sender.tab.id : null;
    
    if (tabId) {
      // Save job information for this specific tab
      saveJobInfoForTab(tabId, request.data);
      sendResponse({ success: true });
    } else {
      // No tab context (e.g., from popup), get active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          saveJobInfoForTab(tabs[0].id, request.data);
          sendResponse({ success: true });
        } else {
          // Fallback: save as lastJobInfo (for backward compatibility)
          chrome.storage.local.set({ 
            lastJobInfo: request.data 
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error saving job info:', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('Job info saved:', request.data);
              updateBadgeForActiveTab();
              sendResponse({ success: true });
            }
          });
        }
      });
    }
    return true; // Indicates we will send a response asynchronously
  }

  if (request.action === 'getJobInfo') {
    // Get job info for the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const activeTabId = tabs[0].id;
        chrome.storage.local.get(['jobInfoByTab', 'lastJobInfo'], (result) => {
          const jobInfoByTab = result.jobInfoByTab || {};
          const tabJobInfo = jobInfoByTab[activeTabId];
          // Return tab-specific info if available, otherwise fallback to lastJobInfo
          sendResponse(tabJobInfo || result.lastJobInfo || null);
        });
      } else {
        // No active tab, return lastJobInfo
        chrome.storage.local.get(['lastJobInfo'], (result) => {
          sendResponse(result.lastJobInfo || null);
        });
      }
    });
    return true; // Indicates we will send a response asynchronously
  }

  if (request.action === 'clearJobInfo') {
    // Get the tab ID from the sender, or get active tab if from popup
    const tabId = sender.tab ? sender.tab.id : null;
    
    if (tabId) {
      // Clear job info for this specific tab
      chrome.storage.local.get(['jobInfoByTab'], (result) => {
        const jobInfoByTab = result.jobInfoByTab || {};
        delete jobInfoByTab[tabId];
        
        chrome.storage.local.set({ jobInfoByTab }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error clearing job info:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            setBadgeDefault(tabId);
            sendResponse({ success: true });
          }
        });
      });
    } else {
      // No tab context (e.g., from popup), get active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.storage.local.get(['jobInfoByTab'], (result) => {
            const jobInfoByTab = result.jobInfoByTab || {};
            delete jobInfoByTab[tabs[0].id];
            
            chrome.storage.local.set({ jobInfoByTab }, () => {
              if (chrome.runtime.lastError) {
                console.error('Error clearing job info:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                setBadgeDefault(tabs[0].id);
                sendResponse({ success: true });
              }
            });
          });
        } else {
          // Fallback: clear lastJobInfo
          chrome.storage.local.remove(['lastJobInfo'], () => {
            if (chrome.runtime.lastError) {
              console.error('Error clearing job info:', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              updateBadgeForActiveTab();
              sendResponse({ success: true });
            }
          });
        }
      });
    }
    return true;
  }
});


