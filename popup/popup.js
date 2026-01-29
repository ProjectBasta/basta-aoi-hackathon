// Popup Script
// Displays saved job information in the extension popup

// API Configuration
const API_ENDPOINT =
  "https://staging-seekr-adaptive-api.projectbasta.com/auth/login"

document.addEventListener("DOMContentLoaded", () => {
  const jobInfoContainer = document.getElementById("jobInfo")
  const loginScreen = document.getElementById("loginScreen")
  const jobInfoScreen = document.getElementById("jobInfoScreen")
  const loginForm = document.getElementById("loginForm")
  const logoutButton = document.getElementById("logoutButton")
  const loginError = document.getElementById("loginError")
  const loginButton = document.getElementById("loginButton")
  const headerUserInfo = document.getElementById("headerUserInfo")
  const headerUserName = document.getElementById("headerUserName")
  const sidebarToggle = document.getElementById("sidebarToggle")

  // Check authentication status on load
  checkAuthStatus()

  // Login form handler
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    const username = document.getElementById("userId").value.trim()
    const password = document.getElementById("password").value.trim()

    if (!username || !password) {
      showLoginError("Please enter both Username and Password")
      return
    }

    // Show loading state
    loginButton.disabled = true
    loginButton.textContent = "Logging in..."
    hideLoginError()

    try {
      // Prepare form data
      const formData = new URLSearchParams()
      formData.append("username", username)
      formData.append("password", password)

      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Login failed" }))
        throw new Error(
          errorData.message || `Login failed: ${response.statusText}`,
        )
      }

      const responseData = await response.json()

      // Check if login was successful
      if (
        !responseData.success ||
        !responseData.data ||
        !responseData.data.token
      ) {
        throw new Error(
          responseData.message || "Login failed: Invalid response from server",
        )
      }

      const tokenData = responseData.data.token
      const accessToken = tokenData.access_token
      const expiry = tokenData.expiry // Unix timestamp in seconds

      if (!accessToken) {
        throw new Error("No access token received from server")
      }

      // Convert expiry from seconds to milliseconds for Date comparison
      const expirationTime = expiry * 1000

      // Extract user_id and response_id from login response
      // user_id is at responseData.data.user.id
      // response_id is at responseData.data.user.response_id
      const userId = responseData.data?.user?.id || null
      const responseId = responseData.data?.user?.response_id || null

      // Store token, expiration, and user info
      await chrome.storage.local.set({
        authToken: accessToken,
        tokenExpiration: expirationTime,
        username: username,
        userFirstName: responseData.data.user?.first_name || "",
        userEmail: responseData.data.user?.email || "",
        userId: userId,
        responseId: responseId,
      })

      // Log for debugging
      if (userId) {
        console.log("Stored user_id from login:", userId)
      } else {
        console.warn("user_id not found in login response")
      }
      if (responseId) {
        console.log("Stored response_id from login:", responseId)
      } else {
        console.warn("response_id not found in login response")
      }

      // Update header with user's first name
      updateHeaderWithUserName(responseData.data.user?.first_name || "")

      // Update badge to show logged in state
      chrome.runtime.sendMessage({
        action: "updateBadgeForLogin",
        loggedIn: true,
      })

      // Show job info screen
      showJobInfoScreen()
    } catch (error) {
      console.error("Login error:", error)
      showLoginError(
        error.message ||
          "Failed to login. Please check your credentials and try again.",
      )
    } finally {
      loginButton.disabled = false
      loginButton.textContent = "Login"
    }
  })

  // Logout handler
  logoutButton.addEventListener("click", async () => {
    await chrome.storage.local.remove([
      "authToken",
      "tokenExpiration",
      "username",
      "userFirstName",
      "userEmail",
      "userId",
      "responseId",
    ])
    updateHeaderWithUserName("")
    chrome.runtime.sendMessage({
      action: "updateBadgeForLogin",
      loggedIn: false,
    })
    showLoginScreen()
  })

  // Check if user is authenticated
  async function checkAuthStatus() {
    const result = await chrome.storage.local.get([
      "authToken",
      "tokenExpiration",
      "userFirstName",
    ])

    if (result.authToken && result.tokenExpiration) {
      // Check if token is still valid (not expired)
      // tokenExpiration is in milliseconds
      if (Date.now() < result.tokenExpiration) {
        // Token is valid, show job info
        updateHeaderWithUserName(result.userFirstName || "")
        showJobInfoScreen()
        chrome.runtime.sendMessage({
          action: "updateBadgeForLogin",
          loggedIn: true,
        })
        return
      } else {
        // Token expired, clear it
        await chrome.storage.local.remove([
          "authToken",
          "tokenExpiration",
          "username",
          "userFirstName",
          "userEmail",
        ])
      }
    }

    // Not logged in or token expired
    updateHeaderWithUserName("")
    showLoginScreen()
    chrome.runtime.sendMessage({
      action: "updateBadgeForLogin",
      loggedIn: false,
    })
  }

  // Update header with user's first name and logout button
  function updateHeaderWithUserName(firstName) {
    if (firstName) {
      // Show user info section with name and logout button
      headerUserName.textContent = firstName
      headerUserInfo.style.display = "flex"
    } else {
      // Hide user info section
      headerUserInfo.style.display = "none"
      headerUserName.textContent = ""
    }
  }

  function showLoginScreen() {
    loginScreen.style.display = "block"
    jobInfoScreen.style.display = "none"
    loginForm.reset()
    hideLoginError()
  }

  function showJobInfoScreen() {
    loginScreen.style.display = "none"
    jobInfoScreen.style.display = "block"
    // Load sidebar toggle state (default off so user opts in to show sidebar)
    chrome.storage.local.get(["sidebarVisible"], (result) => {
      if (sidebarToggle) {
        sidebarToggle.checked = result.sidebarVisible === true
      }
    })
    // Load job info when showing the screen
    loadJobInfo()
  }

  // Sidebar toggle: save preference, tell content script, close popup when turning sidebar ON
  if (sidebarToggle) {
    sidebarToggle.addEventListener("change", async () => {
      const visible = sidebarToggle.checked
      await chrome.storage.local.set({ sidebarVisible: visible })

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: "setSidebarVisible",
            visible,
          })
        } catch (e) {
          // Tab may not have content script (e.g. not a job board)
        }
      }

      // Close popup when sidebar is turned ON so user can see the page with the sidebar
      if (visible) {
        window.close()
      }
    })
  }

  function showLoginError(message) {
    loginError.textContent = message
    loginError.style.display = "block"
  }

  function hideLoginError() {
    loginError.style.display = "none"
  }

  function isSupportedJobBoard(url) {
    if (!url) return false
    const hostname = new URL(url).hostname
    return (
      hostname.includes("linkedin.com") ||
      hostname.includes("ziprecruiter.com") ||
      hostname.includes("indeed.com") ||
      hostname.includes("joinhandshake.com")
    )
  }

  function parseCurrentPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting current tab:", chrome.runtime.lastError)
        displayNoJobInfo()
        return
      }

      if (tabs.length === 0) {
        displayNoJobInfo()
        return
      }

      const currentTab = tabs[0]

      if (!isSupportedJobBoard(currentTab.url)) {
        displayNoJobInfo()
        return
      }

      // Show loading state
      jobInfoContainer.innerHTML =
        '<div class="loading">Parsing job information from current page...</div>'
      jobInfoContainer.classList.add("loading")

      // Send message to content script to parse the page
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: "parseCurrentPage" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error parsing page:", chrome.runtime.lastError)
            displayNoJobInfo()
            return
          }

          if (response && response.success && response.data) {
            const jobData = response.data
            // Save the parsed data
            chrome.runtime.sendMessage(
              {
                action: "saveJobInfo",
                data: jobData,
              },
              () => {
                // Display the job info
                displayJobInfo(jobData)
              },
            )
          } else {
            displayNoJobInfo()
          }
        },
      )
    })
  }

  function renderSeekrProfileHTML(profileData) {
    const topDrivers = profileData?.top_drivers ?? profileData?.data?.top_drivers
    if (!profileData || !topDrivers || !topDrivers.length) return ""
    const drivers = topDrivers
    const driversHtml = drivers
      .map((d) => {
        const driverText = escapeHtml(d.driver || "")
        const tooltip = escapeHtml(d.description || "")
        return `<span class="job-field-seekr-driver" title="${tooltip}">${driverText}</span>`
      })
      .join(", ")
    return `
      <div class="job-field job-field-seekr-profile">
        <div class="job-field-label job-field-seekr-profile-title">Your seekr profile</div>
        <div class="job-field-label">Top Drivers</div>
        <div class="job-field-value job-field-seekr-drivers">${driversHtml}</div>
      </div>
    `
  }

  function loadJobInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTabId = tabs.length > 0 ? tabs[0].id : null
      const activeTab = tabs.length > 0 ? tabs[0] : null

      chrome.storage.local.get(
        ["jobInfoByTab", "jobMobilityByTab", "seekrProfile", "responseId"],
        (result) => {
          const jobInfoByTab = result.jobInfoByTab || {}
          const jobMobilityByTab = result.jobMobilityByTab || {}
          const seekrProfile = result.seekrProfile || null
          const jobResponse = activeTabId ? jobInfoByTab[activeTabId] : null
          const mobilityData = activeTabId
            ? jobMobilityByTab[activeTabId]
            : null

          function show(jobData, mobility) {
            if (jobData && (jobData.jobTitle || jobData.companyName)) {
              displayJobInfo(jobData, mobility, seekrProfile)
            } else {
              displayNoJobInfo(seekrProfile)
            }
          }

          // If we have responseId but no profile yet, request fetch so it appears when ready
          if (result.responseId && !seekrProfile) {
            chrome.runtime.sendMessage({ action: "fetchSeekrProfile" }, (res) => {
              if (res?.success && res?.data) {
                chrome.storage.local.set({ seekrProfile: res.data }, () => {})
              }
            })
          }

          // On a job board, always get fresh parse so compensation reflects current page after switching jobs
          if (
            activeTabId &&
            activeTab?.url &&
            isSupportedJobBoard(activeTab.url)
          ) {
            chrome.tabs.sendMessage(
              activeTabId,
              { action: "parseCurrentPage" },
              (response) => {
                if (
                  !chrome.runtime.lastError &&
                  response?.success &&
                  response?.data &&
                  (response.data.jobTitle || response.data.companyName)
                ) {
                  chrome.runtime.sendMessage(
                    { action: "saveJobInfo", data: response.data },
                    () => show(response.data, mobilityData),
                  )
                } else {
                  show(jobResponse, mobilityData)
                }
              },
            )
        } else {
          show(jobResponse, mobilityData)
        }
      }
      )
    })
  }

  function displayJobInfo(jobData, mobilityData, seekrProfile) {
    const companyName = escapeHtml(jobData.companyName || "Not available")
    const companyLink = companySearchUrl(jobData.companyName)
    const overallBadgeHtml = mobilityData?.job_mobility
      ? renderBadgeHtml(mobilityData.job_mobility.overall_badge)
      : renderBadgeHtml(null)

    // Order: Company, This role, Compensation, Your seekr profile (Top Drivers), then rest
    let html = ""
    html += `
      <div class="job-field">
        <div class="job-field-label">Company</div>
        <div class="job-field-value job-field-company-with-badge">
          ${companyLink ? `<a href="${companyLink}" target="_blank" class="job-field-company-link">${companyName}</a>` : companyName}
          ${overallBadgeHtml}
        </div>
      </div>
      
    `

    // Show available data even when status is in_progress (same order as sidebar)
    if (mobilityData && mobilityData.job_mobility) {
      // Show available data even if status is in_progress
      // Pass the full mobilityData object, function will extract job_mobility
      html += createMobilityHTML(
        mobilityData,
        companyName,
        companyLink,
        jobData.compensation,
        seekrProfile,
      )

      // Show loading indicator if still in progress
      if (mobilityData.job_mobility.status === "in_progress") {
        html += `
          <div class="job-field" style="text-align: center; padding: 20px;">
            <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #131F39; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="margin-top: 10px; color: #666;">Loading more data...</div>
          </div>
        `
      }
    } else if (
      !mobilityData ||
      (mobilityData.status && mobilityData.status === "in_progress")
    ) {
      // Show spinner only if no data at all; still show seekr profile below
      html += `
        <div class="job-field" style="text-align: center; padding: 20px;">
          <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #131F39; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <div style="margin-top: 10px; color: #666;">Loading job mobility data...</div>
        </div>
      `
      if (seekrProfile) {
        html += renderSeekrProfileHTML(seekrProfile)
      }
    }

    jobInfoContainer.innerHTML = html
    jobInfoContainer.classList.remove("empty", "loading")

    // Don't trigger API call from popup - let the content script handle it on page load
    // The API call should only happen when the page is first loaded/refreshed
  }

  function createMobilityHTML(
    mobilityData,
    companyName,
    companyLink,
    pageCompensation,
    seekrProfile,
  ) {
    // Same order as sidebar: This role, Compensation, Your seekr profile (Top Drivers), Recommendation, What works well, etc.
    const data = mobilityData.job_mobility || mobilityData || {}
    let html = ""

    // This role at this company (badges)
    html += `
      <div class="job-field">
        <div class="job-field-label">This role at this company:</div>
        <div class="job-field-value basta-badges-wrap">
          <div class="basta-badges-row"><span class="basta-badges-row-label">Early Career</span>${renderBadgeHtml(data.badge_early_career)}</div>
          <div class="basta-badges-row"><span class="basta-badges-row-label">Growth</span>${renderBadgeHtml(data.badge_growth)}</div>
          <div class="basta-badges-row"><span class="basta-badges-row-label">Stability</span>${renderBadgeHtml(data.badge_stability)}</div>
        </div>
      </div>
    `

    // Compensation
    const wage = data.wage || {}
    const pageCompDisplay = formatCompensationForDisplay(pageCompensation || "")
    const pageCompText = pageCompDisplay ? escapeHtml(pageCompDisplay) : ""
    const compIndicator = getCompensationIndicator(pageCompensation, wage)
    const compIndicatorHtml = renderCompensationIndicatorHtml(compIndicator)
    html += `
      <div class="job-field">
        <div class="job-field-label">Compensation:</div>
        <div class="job-field-value basta-compensation-row">
          <span class="basta-compensation-text">${pageCompText || "Not on page"}</span>
          ${compIndicatorHtml}
        </div>
      </div>
    `

    // Your seekr profile (Top Drivers) — below compensation
    if (seekrProfile) {
      html += renderSeekrProfileHTML(seekrProfile)
    }

    if (data.recommendation) {
      html += `
        <div class="job-field">
          <div class="job-field-label">Recommendation:</div>
          <div class="job-field-value">${escapeHtml(data.recommendation)}</div>
        </div>
      `
    }

    if (data.works && data.works.length > 0) {
      html += `
        <div class="job-field">
          <div class="job-field-label">What works well:</div>
          <div class="job-field-value">
            <ul class="job-field-list">
              ${data.works.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}
            </ul>
          </div>
        </div>
      `
    }

    if (data.consider && data.consider.length > 0) {
      html += `
        <div class="job-field">
          <div class="job-field-label">Things to consider:</div>
          <div class="job-field-value">
            <ul class="job-field-list">
              ${data.consider.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
            </ul>
          </div>
        </div>
      `
    }

    if (data.skills && data.skills.length > 0) {
      html += `
        <div class="job-field">
          <div class="job-field-label">Skills that will help you succeed in this role</div>
          <div class="job-field-value">${data.skills.map((skill) => escapeHtml(skill)).join(", ")}</div>
        </div>
      `
    }

    // Pathways at the bottom
    html += `
      <div class="job-field">
        <div class="job-field-label">Pathways:</div>
        <div class="job-field-value">${
          data.pathways && data.pathways.length > 0
            ? data.pathways.map((p) => escapeHtml(p)).join(", ")
            : "Not available"
        }</div>
      </div>
    `

    return html
  }

  function displayNoJobInfo(seekrProfile) {
    let html = ""
    if (seekrProfile) {
      html += renderSeekrProfileHTML(seekrProfile)
    }
    html += `
      <div class="empty">
        <p>No Job information available.</p>
      </div>
    `
    jobInfoContainer.innerHTML = html
    jobInfoContainer.classList.add("empty")
    jobInfoContainer.classList.remove("loading")
  }

  function displayError(message) {
    jobInfoContainer.innerHTML = `
      <div class="empty">
        <p style="color: #d32f2f;">${escapeHtml(message)}</p>
      </div>
    `
    jobInfoContainer.classList.add("empty")
    jobInfoContainer.classList.remove("loading")
  }

  function escapeHtml(text) {
    if (!text) return ""
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  // Build LinkedIn company search URL: spaces in company name become underscores
  function companySearchUrl(companyName) {
    if (!companyName || typeof companyName !== "string") return ""
    const slug = companyName.trim().replace(/\s+/g, "_")
    return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(slug)}`
  }

  // Badge config for Platinum / Gold / N/A with tooltips
  function getBadgeConfig(value) {
    const v = (value || "").toString().trim().toLowerCase()
    if (v === "platinum")
      return {
        type: "platinum",
        label: "Platinum",
        tooltip: "Top 20% (80–100th percentile)",
      }
    if (v === "gold")
      return { type: "gold", label: "Gold", tooltip: "60–80th percentile" }
    return { type: "na", label: "N/A", tooltip: "Below 60th percentile" }
  }

  function renderBadgeHtml(value) {
    const cfg = getBadgeConfig(value)
    const tip = escapeHtml(cfg.tooltip)
    return `<span class="basta-badge basta-badge-${cfg.type}" title="${tip}"><span class="basta-badge-inner">${escapeHtml(cfg.label)}</span><span class="basta-badge-tooltip">${tip}</span></span>`
  }

  function parseCompensationToNumber(str) {
    if (!str || typeof str !== "string") return null
    const s = str.trim()
    const match = s.match(/\$?\s*([\d,]+)\s*([KMB])?/i)
    if (!match) return null
    let num = parseInt(match[1].replace(/,/g, ""), 10)
    if (isNaN(num)) return null
    const suffix = (match[2] || "").toUpperCase()
    if (suffix === "K") num *= 1000
    else if (suffix === "M") num *= 1000000
    else if (suffix === "B") num *= 1000000000
    if (/\d+\s*\/\s*(hr|hour)|\s+per\s+(hour|hr)/i.test(s))
      num = Math.round(num * 2080)
    return num
  }

  function formatCompensationForDisplay(str) {
    if (!str || typeof str !== "string") return ""
    const s = str.trim()
    if (!s) return ""
    const isHourly = /\d+\s*\/\s*(hr|hour)|\s+per\s+(hour|hr)/i.test(s)
    if (!isHourly) return s
    const yearly = parseCompensationToNumber(str)
    if (yearly == null) return s
    return s + " (~$" + yearly.toLocaleString() + "/yr)"
  }

  function getCompensationIndicator(pageCompensation, wage) {
    const pageLow = parseCompensationToNumber(pageCompensation)
    const apiLow =
      wage && wage.percentile_25 != null
        ? wage.percentile_25
        : wage && wage.median != null
          ? wage.median
          : null
    if (pageLow == null || apiLow == null) return null
    const tolerance = apiLow * 0.05
    if (pageLow > apiLow + tolerance) return "higher"
    if (pageLow < apiLow - tolerance) return "lower"
    return "average"
  }

  function renderCompensationIndicatorHtml(indicator) {
    if (!indicator || !["higher", "average", "lower"].includes(indicator))
      return ""
    const tips = {
      higher: "Higher than average for this job title",
      average: "Average for this job title",
      lower: "Lower than average for this job title",
    }
    const tip = escapeHtml(tips[indicator])
    const svgPath =
      indicator === "higher"
        ? "M7 14l5-5 5 5z"
        : indicator === "lower"
          ? "M7 10l5 5 5-5z"
          : "M10 6l6 6-6 6V6z"
    const cls = "basta-comp-indicator basta-comp-" + indicator
    return `<span class="${cls}" title="${tip}" role="img" aria-label="${tips[indicator]}"><span class="basta-comp-indicator-tooltip">${tip}</span><svg width="2em" height="2em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${svgPath}"/></svg></span>`
  }

  // Listen for storage changes to automatically update when new job info is collected for current tab
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      // Check if auth status changed
      if (changes.authToken || changes.tokenExpiration) {
        checkAuthStatus()
      }

      // Only update job info if logged in
      if (jobInfoScreen.style.display !== "none") {
        if (changes.seekrProfile || changes.jobInfoByTab || changes.jobMobilityByTab) {
          // Seekr profile or job/mobility data updated, reload to show latest
          loadJobInfo()
        } else if (changes.lastJobInfo) {
          // Fallback: check if it's for the current tab
          loadJobInfo()
        }
      }
    }
  })

  // Helper function to get auth token for API calls
  async function getAuthToken() {
    const result = await chrome.storage.local.get([
      "authToken",
      "tokenExpiration",
    ])
    if (
      result.authToken &&
      result.tokenExpiration &&
      Date.now() < result.tokenExpiration
    ) {
      return result.authToken
    }
    return null
  }
})
