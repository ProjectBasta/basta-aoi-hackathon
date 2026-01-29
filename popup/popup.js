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

      // Extract user_id and response_id from login response
      // user_id is at responseData.data.user.id
      // response_id is at responseData.data.user.response_id
      const userId = responseData.data?.user?.id || null;
      const responseId = responseData.data?.user?.response_id || null;

      // Store token, expiration, and user info
      await chrome.storage.local.set({
        authToken: accessToken,
        tokenExpiration: expirationTime,
        username: username,
        userFirstName: responseData.data.user?.first_name || '',
        userEmail: responseData.data.user?.email || '',
        userId: userId,
        responseId: responseId
      });

      // Log for debugging
      if (userId) {
        console.log('Stored user_id from login:', userId);
      } else {
        console.warn('user_id not found in login response');
      }
      if (responseId) {
        console.log('Stored response_id from login:', responseId);
      } else {
        console.warn('response_id not found in login response');
      }

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
    await chrome.storage.local.remove(['authToken', 'tokenExpiration', 'username', 'userFirstName', 'userEmail', 'userId', 'responseId']);
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTabId = tabs.length > 0 ? tabs[0].id : null;

      // Get job info
      chrome.runtime.sendMessage({ action: 'getJobInfo' }, (jobResponse) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading job info:', chrome.runtime.lastError);
          displayNoJobInfo();
          return;
        }

        // Get mobility data for this tab or fallback to lastJobMobility
        chrome.storage.local.get(['jobMobilityByTab', 'lastJobMobility'], (result) => {
          let mobilityData = null;
          if (activeTabId) {
            const jobMobilityByTab = result.jobMobilityByTab || {};
            mobilityData = jobMobilityByTab[activeTabId];
          }
          // Fallback to lastJobMobility if no tab-specific data
          if (!mobilityData && result.lastJobMobility) {
            mobilityData = result.lastJobMobility;
          }

          // Check if response has valid job information
          if (jobResponse && (jobResponse.jobTitle || jobResponse.companyName)) {
            displayJobInfo(jobResponse, mobilityData);
          } else {
            // No job info for current tab
            displayNoJobInfo();
          }
        });
      });
    });
  }

  function displayJobInfo(jobData, mobilityData) {
    const companyName = escapeHtml(jobData.companyName || 'Not available');
    const companyLink = jobData.companyName 
      ? `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(jobData.companyName)}`
      : '';

    let html = `
      <div class="job-field">
        <div class="job-field-label">Company</div>
        <div class="job-field-value">
          ${companyLink ? `<a href="${companyLink}" target="_blank" style="color: #131F39; text-decoration: none; font-weight: 600;">${companyName}</a>` : companyName}
      </div>
      </div>
      <div class="job-field">
        <div class="job-field-label">Title</div>
        <div class="job-field-value">${escapeHtml(jobData.jobTitle || 'Not available')}</div>
      </div>
    `;

    // Show available data even when status is in_progress
    if (mobilityData && mobilityData.job_mobility) {
      // Show available data even if status is in_progress
      // Pass the full mobilityData object, function will extract job_mobility
      html += createMobilityHTML(mobilityData, companyName, companyLink);
      
      // Show loading indicator if still in progress
      if (mobilityData.job_mobility.status === 'in_progress') {
        html += `
          <div class="job-field" style="text-align: center; padding: 20px;">
            <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #131F39; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="margin-top: 10px; color: #666;">Loading more data...</div>
          </div>
        `;
      }
    } else if (!mobilityData || (mobilityData.status && mobilityData.status === 'in_progress')) {
      // Show spinner only if no data at all
      html += `
        <div class="job-field" style="text-align: center; padding: 20px;">
          <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #131F39; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <div style="margin-top: 10px; color: #666;">Loading job mobility data...</div>
        </div>
      `;
    }

    jobInfoContainer.innerHTML = html;
    jobInfoContainer.classList.remove('empty', 'loading');

    // Don't trigger API call from popup - let the content script handle it on page load
    // The API call should only happen when the page is first loaded/refreshed
  }

  function createMobilityHTML(mobilityData, companyName, companyLink) {
    // Handle both direct job_mobility object and nested structure
    const data = mobilityData.job_mobility || mobilityData || {};
    let html = '';

    if (data.primary_industry) {
      html += `
        <div class="job-field">
          <div class="job-field-label">Industry</div>
          <div class="job-field-value">${escapeHtml(data.primary_industry)}</div>
        </div>
      `;
    }

    if (data.skills && data.skills.length > 0) {
      html += `
        <div class="job-field">
          <div class="job-field-label">Required: Skills</div>
          <div class="job-field-value">${data.skills.map(skill => escapeHtml(skill)).join(', ')}</div>
        </div>
      `;
    }

    // Always show Required Education (even if empty)
    html += `
      <div class="job-field">
        <div class="job-field-label">Required Education:</div>
        <div class="job-field-value">${escapeHtml(data.education || 'Not available')}</div>
      </div>
    `;

    // Always show Compensation (even if empty)
    const wage = data.wage || {};
    const low = wage.percentile_25 ? `$${Math.round(wage.percentile_25).toLocaleString()}` : '';
    const median = wage.median ? `$${Math.round(wage.median).toLocaleString()}` : '';
    const high = wage.percentile_75 ? `$${Math.round(wage.percentile_75).toLocaleString()}` : '';
    html += `
      <div class="job-field">
        <div class="job-field-label">Compensation:</div>
        <div class="job-field-value">Low${low}  Median ${median}  High ${high}</div>
      </div>
    `;

    // Always show Badges (even if empty)
    html += `
      <div class="job-field">
        <div class="job-field-label">Badges:</div>
        <div class="job-field-value">
          Overall ${escapeHtml(data.overall_badge || 'N/A')}<br>
          Early Career ${escapeHtml(data.badge_early_career || 'N/A')}<br>
          Growth ${escapeHtml(data.badge_growth || 'N/A')}<br>
          Stability ${escapeHtml(data.badge_stability || 'N/A')}
        </div>
      </div>
    `;

    // Always show Early Career Companies (even if empty)
    html += `
      <div class="job-field">
        <div class="job-field-label">Early Career Companies:</div>
        <div class="job-field-value">${data.badge_early_career_company && data.badge_early_career_company.length > 0
          ? data.badge_early_career_company.map(c => {
              const companyName = escapeHtml(c);
              const companyLink = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(c)}`;
              return `<a href="${companyLink}" target="_blank" style="color: #131F39; text-decoration: none; font-weight: 600;">${companyName}</a>`;
            }).join(', ')
          : 'Not available'}</div>
      </div>
    `;

    // Always show Growth Companies (even if empty)
    html += `
      <div class="job-field">
        <div class="job-field-label">Growth Companies:</div>
        <div class="job-field-value">${data.badge_growth_company && data.badge_growth_company.length > 0
          ? data.badge_growth_company.map(c => {
              const companyName = escapeHtml(c);
              const companyLink = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(c)}`;
              return `<a href="${companyLink}" target="_blank" style="color: #131F39; text-decoration: none; font-weight: 600;">${companyName}</a>`;
            }).join(', ')
          : 'Not available'}</div>
      </div>
    `;

    // Always show Stability Companies (even if empty)
    html += `
      <div class="job-field">
        <div class="job-field-label">Stability Companies:</div>
        <div class="job-field-value">${data.badge_stability_company && data.badge_stability_company.length > 0
          ? data.badge_stability_company.map(c => {
              const companyName = escapeHtml(c);
              const companyLink = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(c)}`;
              return `<a href="${companyLink}" target="_blank" style="color: #131F39; text-decoration: none; font-weight: 600;">${companyName}</a>`;
            }).join(', ')
          : 'Not available'}</div>
      </div>
    `;

    // Always show Pathways (even if empty)
    html += `
      <div class="job-field">
        <div class="job-field-label">Pathways:</div>
        <div class="job-field-value">${data.pathways && data.pathways.length > 0
          ? data.pathways.map(p => escapeHtml(p)).join(', ')
          : 'Not available'}</div>
      </div>
    `;

    if (data.recommendation) {
      html += `
        <div class="job-field">
          <div class="job-field-label">Recommendation:</div>
          <div class="job-field-value">${escapeHtml(data.recommendation)}</div>
        </div>
      `;
    }

    if (data.works && data.works.length > 0) {
      html += `
        <div class="job-field">
          <div class="job-field-label">What works well !</div>
          <div class="job-field-value">
            <ul style="margin: 8px 0; padding-left: 20px;">
              ${data.works.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }

    if (data.consider && data.consider.length > 0) {
      html += `
        <div class="job-field">
          <div class="job-field-label">Things to consider</div>
          <div class="job-field-value">
            <ul style="margin: 8px 0; padding-left: 20px;">
              ${data.consider.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }

    return html;
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
        if (changes.jobInfoByTab || changes.jobMobilityByTab) {
          // Job info or mobility data for a tab was updated, reload to get current tab's info
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

