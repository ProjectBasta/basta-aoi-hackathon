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
  // Update badge for the newly active tab (but don't parse or make API calls)
  updateBadgeForTab(activeInfo.tabId);
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

// Limit one mobility request in progress per tab
const mobilityFetchInProgress = new Set();

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
    // Use sender tab when message is from content script (so we get this tab's job info)
    const tabId = sender.tab ? sender.tab.id : null;
    function respondWithJobInfo(targetTabId) {
      chrome.storage.local.get(['jobInfoByTab', 'lastJobInfo'], (result) => {
        const jobInfoByTab = result.jobInfoByTab || {};
        const tabJobInfo = targetTabId ? jobInfoByTab[targetTabId] : null;
        sendResponse(tabJobInfo || result.lastJobInfo || null);
      });
    }
    if (tabId) {
      respondWithJobInfo(tabId);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        respondWithJobInfo(tabs.length > 0 ? tabs[0].id : null);
      });
    }
    return true; // Indicates we will send a response asynchronously
  }

  if (request.action === 'getMobilityForCurrentTab') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const targetTabId = tabs.length > 0 ? tabs[0].id : null;
        chrome.storage.local.get(['jobMobilityByTab'], (result) => {
          const mobility = targetTabId ? (result.jobMobilityByTab || {})[targetTabId] : null;
          sendResponse(mobility || null);
        });
      });
    } else {
      chrome.storage.local.get(['jobMobilityByTab'], (result) => {
        const mobility = (result.jobMobilityByTab || {})[tabId] || null;
        sendResponse(mobility);
      });
    }
    return true;
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

  if (request.action === 'fetchJobMobility') {
    let tabId = sender.tab?.id;
    const doFetch = (targetTabId) => {
      if (targetTabId != null && mobilityFetchInProgress.has(targetTabId)) {
        sendResponse({ success: true, message: 'Request already in progress for this tab' });
        return;
      }
      if (targetTabId != null) mobilityFetchInProgress.add(targetTabId);
      fetchJobMobility(request.jobData, targetTabId);
      sendResponse({ success: true, message: 'Job mobility fetch initiated' });
    };
    if (tabId) {
      doFetch(tabId);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        doFetch(tabs.length > 0 ? tabs[0].id : null);
      });
    }
    return true;
  }
});

// Generate UUID for user_id and response_id
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Extract numeric value from compensation string
function extractCompensationValue(compensation) {
  if (!compensation) return '';
  
  // Remove currency symbols and extract numbers
  const match = compensation.match(/[\d,]+/);
  if (match) {
    return match[0].replace(/,/g, '');
  }
  return '';
}

// Parse location value from location string
function parseLocationValue(location) {
  if (!location) return { value: '' };
  return { value: location };
}

// Fetch job mobility data
async function fetchJobMobility(jobData, tabId) {
  try {
    // Get user_id and response_id from login response (stored in chrome.storage)
    const storage = await chrome.storage.local.get(['userId', 'responseId']);
    let userId = storage.userId;
    let responseId = storage.responseId;

    // If not available from login, generate UUIDs as fallback
    if (!userId) {
      console.warn('user_id not found in storage, generating UUID');
      userId = generateUUID();
    }

    if (!responseId) {
      console.warn('response_id not found in storage, generating UUID');
      responseId = generateUUID();
    }

    // Prepare request payload
    const payload = {
      user_id: userId,
      response_id: responseId,
      job_information: {
        title: jobData.jobTitle || '',
        location: parseLocationValue(jobData.location),
        description: jobData.jobDescription || '',
        compensation: extractCompensationValue(jobData.compensation),
        company: jobData.companyName || ''
      }
    };

    // Make initial API call to get token
    const apiToken = 'hsy79jovh9sy973hfs80yj3upjgktf8';
    
    // Check if token is missing or still contains placeholder (build script didn't run)
    if (!apiToken || apiToken.includes('{{AOI_HACKATHON_API_TOKEN}}')) {
      console.error('API token not set! Please run: npm run build');
      throw new Error('API token not configured. Please run the build script.');
    }
    
    console.log('Making API call with token:', apiToken ? 'Token present' : 'Token missing');
    
    const response = await fetch('https://aoi-hackathon.projectbasta.com/job/mobility', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiToken
      },
      body: JSON.stringify(payload)
    });

    console.log('API Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('API Error Response:', errorText);
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    
    if (!responseData.success || !responseData.data || !responseData.data.token) {
      throw new Error(responseData.message || 'Failed to get token');
    }

    const token = responseData.data.token;

    // Poll for job mobility status
    pollJobMobilityStatus(token, responseId, tabId);
  } catch (error) {
    console.error('Error fetching job mobility:', error);
    if (tabId) mobilityFetchInProgress.delete(tabId);
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'jobMobilityUpdate',
        success: false,
        error: error.message
      }).catch(() => {}); // Ignore errors if tab is closed
    }
  }
}

// Poll job mobility status
async function pollJobMobilityStatus(token, responseId, tabId) {
  const maxAttempts = 10;
  let attempts = 0;
  let pollInterval;

  const poll = async () => {
    attempts++;
    
    try {
      const apiToken = 'hsy79jovh9sy973hfs80yj3upjgktf8';
      
      // Check if token is missing or still contains placeholder (build script didn't run)
      if (!apiToken || apiToken.includes('{{AOI_HACKATHON_API_TOKEN}}')) {
        console.error('API token not set! Please run: npm run build');
        throw new Error('API token not configured. Please run the build script.');
      }
      
      const response = await fetch(`https://aoi-hackathon.projectbasta.com/job/mobility?token=${encodeURIComponent(token)}&response_id=${encodeURIComponent(responseId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiToken
        }
      });

      console.log('Polling API Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('Polling API Error Response:', errorText);
        throw new Error(`Polling failed: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      
      if (responseData.success && responseData.data) {
        const mobilityData = responseData.data;
        
        // Store mobility data in storage for popup access
        if (tabId) {
          chrome.storage.local.get(['jobMobilityByTab'], (result) => {
            const jobMobilityByTab = result.jobMobilityByTab || {};
            jobMobilityByTab[tabId] = mobilityData;
            chrome.storage.local.set({ jobMobilityByTab });
          });
          
          // Send update to content script
          chrome.tabs.sendMessage(tabId, {
            action: 'jobMobilityUpdate',
            success: true,
            data: mobilityData,
            status: mobilityData.job_mobility?.status || 'in_progress'
          }).catch(() => {}); // Ignore errors if tab is closed
        } else {
          // No tab ID, store as last mobility data for popup
          chrome.storage.local.set({ lastJobMobility: mobilityData });
        }

        // If status is completed or max attempts reached, stop polling
        if (mobilityData.job_mobility?.status === 'completed' || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (tabId) mobilityFetchInProgress.delete(tabId);
          return;
        }
      } else {
        // If we've reached max attempts, stop polling
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (tabId) {
            mobilityFetchInProgress.delete(tabId);
            chrome.tabs.sendMessage(tabId, {
              action: 'jobMobilityUpdate',
              success: false,
              error: 'Max polling attempts reached'
            }).catch(() => {}); // Ignore errors if tab is closed
          }
          return;
        }
      }
    } catch (error) {
      console.error('Error polling job mobility:', error);
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        if (tabId) {
          mobilityFetchInProgress.delete(tabId);
          chrome.tabs.sendMessage(tabId, {
            action: 'jobMobilityUpdate',
            success: false,
            error: error.message
          }).catch(() => {}); // Ignore errors if tab is closed
        }
      }
    }
  };

  // Start polling immediately, then every 3 seconds
  poll();
  pollInterval = setInterval(poll, 3000);
}


