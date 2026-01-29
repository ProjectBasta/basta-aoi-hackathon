// Popup Script
// Displays saved job information in the extension popup

// API Configuration
const API_ENDPOINT = 'https://staging-seekr-adaptive-api.projectbasta.com/auth/login';

document.addEventListener('DOMContentLoaded', () => {
  const jobInfoContainer = document.getElementById('jobInfo');
  const loginScreen = document.getElementById('loginScreen');
  const jobInfoScreen = document.getElementById('jobInfoScreen');
  const loginForm = document.getElementById('loginForm');
  const logoutButton = document.getElementById('logoutButton');
  const loginError = document.getElementById('loginError');
  const loginButton = document.getElementById('loginButton');
  const headerUserInfo = document.getElementById('headerUserInfo');
  const headerUserName = document.getElementById('headerUserName');

  // Check authentication status on load
  checkAuthStatus();

  // Login form handler
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('userId').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      showLoginError('Please enter both Username and Password');
      return;
    }

    // Show loading state
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';
    hideLoginError();

    try {
      // Prepare form data
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || `Login failed: ${response.statusText}`);
      }

      const responseData = await response.json();

      // Check if login was successful
      if (!responseData.success || !responseData.data || !responseData.data.token) {
        throw new Error(responseData.message || 'Login failed: Invalid response from server');
      }

      const tokenData = responseData.data.token;
      const accessToken = tokenData.access_token;
      const expiry = tokenData.expiry; // Unix timestamp in seconds

      if (!accessToken) {
        throw new Error('No access token received from server');
      }

      // Convert expiry from seconds to milliseconds for Date comparison
      const expirationTime = expiry * 1000;

      // Store token, expiration, and user info
      await chrome.storage.local.set({
        authToken: accessToken,
        tokenExpiration: expirationTime,
        username: username,
        userFirstName: responseData.data.user?.first_name || '',
        userEmail: responseData.data.user?.email || ''
      });

      // Update header with user's first name
      updateHeaderWithUserName(responseData.data.user?.first_name || '');

      // Update badge to show logged in state
      chrome.runtime.sendMessage({ action: 'updateBadgeForLogin', loggedIn: true });

      // Show job info screen
      showJobInfoScreen();
    } catch (error) {
      console.error('Login error:', error);
      showLoginError(error.message || 'Failed to login. Please check your credentials and try again.');
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Login';
    }
  });

  // Logout handler
  logoutButton.addEventListener('click', async () => {
    await chrome.storage.local.remove(['authToken', 'tokenExpiration', 'username', 'userFirstName', 'userEmail']);
    updateHeaderWithUserName('');
    chrome.runtime.sendMessage({ action: 'updateBadgeForLogin', loggedIn: false });
    showLoginScreen();
  });

  // Check if user is authenticated
  async function checkAuthStatus() {
    const result = await chrome.storage.local.get(['authToken', 'tokenExpiration', 'userFirstName']);
    
    if (result.authToken && result.tokenExpiration) {
      // Check if token is still valid (not expired)
      // tokenExpiration is in milliseconds
      if (Date.now() < result.tokenExpiration) {
        // Token is valid, show job info
        updateHeaderWithUserName(result.userFirstName || '');
        showJobInfoScreen();
        chrome.runtime.sendMessage({ action: 'updateBadgeForLogin', loggedIn: true });
        return;
      } else {
        // Token expired, clear it
        await chrome.storage.local.remove(['authToken', 'tokenExpiration', 'username', 'userFirstName', 'userEmail']);
      }
    }
    
    // Not logged in or token expired
    updateHeaderWithUserName('');
    showLoginScreen();
    chrome.runtime.sendMessage({ action: 'updateBadgeForLogin', loggedIn: false });
  }

  // Update header with user's first name and logout button
  function updateHeaderWithUserName(firstName) {
    if (firstName) {
      // Show user info section with name and logout button
      headerUserName.textContent = firstName;
      headerUserInfo.style.display = 'flex';
    } else {
      // Hide user info section
      headerUserInfo.style.display = 'none';
      headerUserName.textContent = '';
    }
  }

  function showLoginScreen() {
    loginScreen.style.display = 'block';
    jobInfoScreen.style.display = 'none';
    loginForm.reset();
    hideLoginError();
  }

  function showJobInfoScreen() {
    loginScreen.style.display = 'none';
    jobInfoScreen.style.display = 'block';
    // Load job info when showing the screen
    loadJobInfo();
  }

  function showLoginError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
  }

  function hideLoginError() {
    loginError.style.display = 'none';
  }

  function isSupportedJobBoard(url) {
    if (!url) return false;
    const hostname = new URL(url).hostname;
    return hostname.includes('linkedin.com') ||
           hostname.includes('ziprecruiter.com') ||
           hostname.includes('indeed.com') ||
           hostname.includes('joinhandshake.com');
  }

  function parseCurrentPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting current tab:', chrome.runtime.lastError);
        displayNoJobInfo();
        return;
      }

      if (tabs.length === 0) {
        displayNoJobInfo();
        return;
      }

      const currentTab = tabs[0];
      
      if (!isSupportedJobBoard(currentTab.url)) {
        displayNoJobInfo();
        return;
      }

      // Show loading state
      jobInfoContainer.innerHTML = '<div class="loading">Parsing job information from current page...</div>';
      jobInfoContainer.classList.add('loading');

      // Send message to content script to parse the page
      chrome.tabs.sendMessage(currentTab.id, { action: 'parseCurrentPage' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error parsing page:', chrome.runtime.lastError);
          displayNoJobInfo();
          return;
        }

        if (response && response.success && response.data) {
          const jobData = response.data;
          // Save the parsed data
          chrome.runtime.sendMessage({
            action: 'saveJobInfo',
            data: jobData
          }, () => {
            // Display the job info
            displayJobInfo(jobData);
          });
        } else {
          displayNoJobInfo();
        }
      });
    });
  }

  function loadJobInfo() {
    chrome.runtime.sendMessage({ action: 'getJobInfo' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading job info:', chrome.runtime.lastError);
        displayNoJobInfo();
        return;
      }

      // Check if response has valid job information
      if (response && (response.jobTitle || response.companyName)) {
        displayJobInfo(response);
      } else {
        // No job info for current tab
        displayNoJobInfo();
      }
    });
  }

  function displayJobInfo(jobData) {
    const html = `
      <div class="job-field">
        <div class="job-field-label">Job Title</div>
        <div class="job-field-value">${escapeHtml(jobData.jobTitle || 'Not available')}</div>
      </div>
      <div class="job-field">
        <div class="job-field-label">Company Name</div>
        <div class="job-field-value">${escapeHtml(jobData.companyName || 'Not available')}</div>
      </div>
      <div class="job-field">
        <div class="job-field-label">Job Description</div>
        <div class="job-field-value description">${escapeHtml(jobData.jobDescription || 'Not available')}</div>
      </div>
      ${jobData.location ? `
      <div class="job-field">
        <div class="job-field-label">Location</div>
        <div class="job-field-value">${escapeHtml(jobData.location)}</div>
      </div>
      ` : ''}
      ${jobData.compensation ? `
      <div class="job-field">
        <div class="job-field-label">Compensation</div>
        <div class="job-field-value">${escapeHtml(jobData.compensation)}</div>
      </div>
      ` : ''}
    `;
    jobInfoContainer.innerHTML = html;
    jobInfoContainer.classList.remove('empty', 'loading');
  }

  function displayNoJobInfo() {
    jobInfoContainer.innerHTML = `
      <div class="empty">
        <p>No Job information available.</p>
      </div>
    `;
    jobInfoContainer.classList.add('empty');
    jobInfoContainer.classList.remove('loading');
  }

  function displayError(message) {
    jobInfoContainer.innerHTML = `
      <div class="empty">
        <p style="color: #d32f2f;">${escapeHtml(message)}</p>
      </div>
    `;
    jobInfoContainer.classList.add('empty');
    jobInfoContainer.classList.remove('loading');
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Listen for storage changes to automatically update when new job info is collected for current tab
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      // Check if auth status changed
      if (changes.authToken || changes.tokenExpiration) {
        checkAuthStatus();
      }
      
      // Only update job info if logged in
      if (jobInfoScreen.style.display !== 'none') {
        if (changes.jobInfoByTab) {
          // Job info for a tab was updated, reload to get current tab's info
          loadJobInfo();
        } else if (changes.lastJobInfo) {
          // Fallback: check if it's for the current tab
          loadJobInfo();
        }
      }
    }
  });

  // Helper function to get auth token for API calls
  async function getAuthToken() {
    const result = await chrome.storage.local.get(['authToken', 'tokenExpiration']);
    if (result.authToken && result.tokenExpiration && Date.now() < result.tokenExpiration) {
      return result.authToken;
    }
    return null;
  }
});

