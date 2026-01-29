// Job Post Content Script
// Extracts company name, job title, and job description from multiple job board sites
// Supports: LinkedIn, ZipRecruiter, Indeed, Handshake

;(function () {
  "use strict"

  const LOGIN_API =
    "https://staging-seekr-adaptive-api.projectbasta.com/auth/login"

  function getBaseJobData() {
    return {
      companyName: "",
      jobTitle: "",
      jobDescription: "",
      location: "",
      compensation: "",
      url: window.location.href,
      timestamp: new Date().toISOString(),
    }
  }

  function extractFromLinkedIn() {
    const jobData = getBaseJobData()

    // Scope to current job detail container so title, company, compensation all come from the same job (SPA navigation).
    const root =
      document.querySelector(".job-details-jobs-unified-top-card") ||
      document.querySelector(".jobs-details-top-card") ||
      document.querySelector(".jobs-unified-top-card") ||
      document.querySelector("main") ||
      document
    function q(s) {
      return root.querySelector(s)
    }
    function qa(s) {
      return root.querySelectorAll(s)
    }

    // Extract job title
    const titleSelectors = [
      ".jobs-details-top-card__job-title",
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      'h1[data-test-id="job-title"]',
      'h1[data-testid="job-title"]',
      ".jobs-details__main-content h1",
      "h1.job-title",
      ".jobs-search-results__content-container h1",
      "main h1",
    ]

    for (const selector of titleSelectors) {
      const titleElement = q(selector)
      if (titleElement) {
        const text = titleElement.textContent.trim()
        if (text && text.length > 0 && text.length < 200) {
          jobData.jobTitle = text
          break
        }
      }
    }

    // Extract company name
    const companySelectors = [
      ".jobs-details-top-card__company-name a",
      ".jobs-details-top-card__company-name",
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name",
      'a[data-test-id="job-poster"]',
      'a[data-testid="job-poster"]',
      ".jobs-details__main-content .jobs-details__company-name",
      ".jobs-company__box a",
      'main a[href*="/company/"]',
    ]

    for (const selector of companySelectors) {
      const companyElement = q(selector)
      if (companyElement) {
        const text = companyElement.textContent.trim()
        if (text && text.length > 0 && text.length < 150) {
          jobData.companyName = text
          break
        }
      }
    }

    // Extract job description
    const descriptionSelectors = [
      ".jobs-description__text",
      ".jobs-description-content__text",
      ".jobs-box__html-content",
      '[data-test-id="job-description"]',
      '[data-testid="job-description"]',
      ".jobs-details__main-content .jobs-description",
      ".jobs-description",
      '.jobs-search-results__content-container [class*="description"]',
      'main [class*="jobs-description"]',
    ]

    for (const selector of descriptionSelectors) {
      const descElement = q(selector)
      if (descElement) {
        const text =
          descElement.textContent.trim() || descElement.innerText.trim()
        if (text && text.length > 50) {
          jobData.jobDescription = text
          break
        }
      }
    }

    // If description is still empty, try to get from multiple sections
    if (!jobData.jobDescription) {
      const descSections = qa(
        ".jobs-description__text, .jobs-description-content__text, .jobs-box__html-content",
      )
      if (descSections.length > 0) {
        jobData.jobDescription = Array.from(descSections)
          .map((el) => el.textContent.trim() || el.innerText.trim())
          .join("\n\n")
      }
    }

    // Extract location
    const locationSelectors = [
      ".jobs-details-top-card__bullet",
      ".job-details-jobs-unified-top-card__primary-description-without-tagline",
      ".jobs-details-top-card__primary-description-without-tagline",
      '[data-test-id="job-location"]',
      ".jobs-unified-top-card__primary-description",
      ".jobs-details__main-content .jobs-details__job-details",
      '[class*="job-location"]',
      '[class*="location"]',
    ]

    for (const selector of locationSelectors) {
      const locationElement = q(selector)
      if (locationElement) {
        const locationText = locationElement.textContent.trim()
        // Filter out compensation info from location
        if (
          locationText &&
          !locationText.includes("$") &&
          !locationText.includes("USD") &&
          !locationText.includes("salary")
        ) {
          jobData.location = locationText
          break
        }
      }
    }

    // Extract compensation - be very specific to avoid JSON data
    // Helper function to check if text looks like valid compensation (not JSON)
    function isValidCompensationText(text) {
      if (!text || text.length > 200) return false // Too long, likely JSON
      if (
        text.includes("{") ||
        text.includes("}") ||
        text.includes('"data"') ||
        text.includes('"entityUrn"')
      )
        return false // JSON markers
      // Check for compensation patterns: $, K, /yr, /hr, range with dash, etc.
      const hasDollarSign = text.includes("$")
      const hasCompensationPattern =
        text.match(/\$[\d,]+[KMB]?/i) || // $150K, $100,000
        text.match(/\d+[KMB]?\s*\/\s*(yr|year|hr|hour)/i) || // 150K/yr, 50/hr
        text.includes("USD") ||
        text.toLowerCase().includes("salary") ||
        text.toLowerCase().includes("compensation")

      return hasDollarSign || hasCompensationPattern
    }

    // Helper function to check if element is visible
    function isElementVisible(element) {
      if (!element) return false
      const style = window.getComputedStyle(element)
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      )
    }

    // Try specific LinkedIn compensation selectors first (LinkedIn often changes class names)
    const compensationSelectors = [
      '[data-testid="job-salary"]',
      '[data-test-id="job-salary"]',
      ".jobs-details-top-card__job-insight",
      ".job-details-jobs-unified-top-card__job-insight",
      ".jobs-unified-top-card__job-insight",
      ".jobs-details-top-card__salary",
      ".jobs-unified-top-card__job-insight-text",
      '[class*="salary"]',
      '[class*="compensation"]',
      ".job-details-jobs-unified-top-card__job-insight-view-model-secondary",
      'section[class*="salary"]',
      'div[class*="salary"]',
    ]

    for (const selector of compensationSelectors) {
      try {
        const compElements = qa(selector)
        for (const compElement of compElements) {
          if (!isElementVisible(compElement)) continue
          const compText = compElement.textContent.trim().replace(/\s+/g, " ")
          if (!compText || compText.length > 300) continue
          if (isValidCompensationText(compText)) {
            const m =
              compText.match(
                /\$[\d,]+[KMB]?\s*\/?\s*(yr|year|hr|hour)?\s*-?\s*\$?[\d,]*[KMB]?\s*\/?\s*(yr|year|hr|hour)?/i,
              ) || compText.match(/\$[\d,]+[KMB]?/)
            jobData.compensation = m
              ? m[0].trim()
              : compText.slice(0, 150).trim()
            break
          }
        }
      } catch (e) {
        /* ignore selector errors */
      }
      if (jobData.compensation) break
    }

    // Primary description (top card)
    if (!jobData.compensation) {
      const primaryDesc = q(
        ".jobs-details-top-card__primary-description, .job-details-jobs-unified-top-card__primary-description, .jobs-unified-top-card__primary-description",
      )
      if (primaryDesc && isElementVisible(primaryDesc)) {
        const descText = primaryDesc.textContent.trim()
        if (isValidCompensationText(descText) && descText.length < 150) {
          const m = descText.match(
            /\$[\d,]+[KMB]?\s*\/?\s*(yr|year|hr|hour)?\s*-?\s*\$?[\d,]*[KMB]?/i,
          )
          jobData.compensation = m ? m[0].trim() : descText
        }
      }
    }

    // Job insights: walk all insight-like nodes and collect text
    if (!jobData.compensation) {
      const insightSelectors = [
        ".jobs-details-top-card__job-insight",
        ".job-details-jobs-unified-top-card__job-insight",
        ".jobs-unified-top-card__job-insight",
        '[class*="job-insight"]',
      ]
      for (const sel of insightSelectors) {
        const nodes = qa(sel)
        for (const el of nodes) {
          if (!isElementVisible(el)) continue
          const fullText = el.textContent.trim().replace(/\s+/g, " ")
          if (isValidCompensationText(fullText) && fullText.length < 250) {
            const m = fullText.match(
              /\$[\d,]+[KMB]?\s*\/?\s*(yr|year|hr|hour)?\s*-?\s*\$?[\d,]*[KMB]?\s*\/?\s*(yr|year|hr|hour)?/i,
            )
            jobData.compensation = m
              ? m[0].trim()
              : fullText.slice(0, 120).trim()
            break
          }
        }
        if (jobData.compensation) break
      }
    }

    // Fallback: scan job description for salary/compensation patterns (first clear match)
    if (!jobData.compensation && jobData.jobDescription) {
      const desc = jobData.jobDescription
      // Match $X - $Y (yr/hr), $X/yr, $X - $Y per year, $X per hour, etc.
      const patterns = [
        /\$\s*[\d,]+[KMB]?\s*-\s*\$\s*[\d,]+[KMB]?\s*\/?\s*(yr|year|hr|hour)?/gi,
        /\$\s*[\d,]+[KMB]?\s*\/\s*(yr|year|hr|hour)/gi,
        /\$\s*[\d,]+[KMB]?\s+per\s+(year|yr|hour|hr)/gi,
        /\$\s*[\d,]+[KMB]?\s*\/?\s*(yr|year|hr|hour)?/g,
      ]
      for (const re of patterns) {
        const m = desc.match(re)
        if (m && m[0]) {
          const candidate = m[0].trim()
          if (isValidCompensationText(candidate) && candidate.length < 100) {
            jobData.compensation = candidate
            break
          }
        }
        if (jobData.compensation) break
      }
    }

    // Last resort: scan visible main content for first $ amount that looks like salary
    if (!jobData.compensation) {
      const mainDesc = q(
        '.jobs-description__text, .jobs-description-content__text, .jobs-box__html-content, [data-testid="job-description"]',
      )
      if (mainDesc && isElementVisible(mainDesc)) {
        const text = mainDesc.textContent.trim().replace(/\s+/g, " ")
        const m = text.match(
          /\$[\d,]+[KMB]?\s*\/?\s*(yr|year|hr|hour)?\s*-?\s*\$?[\d,]*[KMB]?\s*\/?\s*(yr|year|hr|hour)?/i,
        )
        if (m && isValidCompensationText(m[0])) {
          jobData.compensation = m[0].trim()
        }
      }
    }

    // Fallback: parse document.title when LinkedIn DOM has changed (e.g. "Principal Software Engineer | Microsoft | LinkedIn")
    if ((!jobData.jobTitle || !jobData.companyName) && document.title) {
      const parts = document.title.split(/\s*\|\s*/).map((s) => s.trim())
      if (
        parts.length >= 3 &&
        parts[parts.length - 1].toLowerCase() === "linkedin"
      ) {
        if (!jobData.jobTitle) jobData.jobTitle = parts[0]
        if (!jobData.companyName) jobData.companyName = parts[1]
      } else if (
        parts.length >= 2 &&
        parts[parts.length - 1].toLowerCase() === "linkedin"
      ) {
        if (!jobData.jobTitle) jobData.jobTitle = parts[0]
      }
    }

    return jobData
  }

  function extractFromZipRecruiter() {
    const jobData = getBaseJobData()

    // Extract job title
    const titleSelectors = [
      'h1[data-testid="job-title"]',
      "h1.job-title",
      "h1.jobTitle",
      ".job_title h1",
      "h1.jobTitleHeader",
      '[class*="jobTitle"] h1',
      "h1",
    ]

    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector)
      if (titleElement && titleElement.textContent.trim()) {
        jobData.jobTitle = titleElement.textContent.trim()
        break
      }
    }

    // Extract company name
    const companySelectors = [
      '[data-testid="company-name"]',
      ".company_name",
      ".companyName",
      '[class*="companyName"]',
      '[class*="company-name"]',
      'a[data-testid="company-link"]',
      ".job_company_name",
      '[itemprop="hiringOrganization"] [itemprop="name"]',
    ]

    for (const selector of companySelectors) {
      const companyElement = document.querySelector(selector)
      if (companyElement) {
        jobData.companyName = companyElement.textContent.trim()
        break
      }
    }

    // Extract job description
    const descriptionSelectors = [
      '[data-testid="job-description"]',
      ".job_description",
      ".jobDescription",
      '[class*="jobDescription"]',
      '[class*="job-description"]',
      "#job_description",
      '[itemprop="description"]',
      ".job_detail_description",
    ]

    for (const selector of descriptionSelectors) {
      const descElement = document.querySelector(selector)
      if (descElement) {
        jobData.jobDescription =
          descElement.textContent.trim() || descElement.innerText.trim()
        break
      }
    }

    // Extract location
    const locationSelectors = [
      '[data-testid="job-location"]',
      ".job_location",
      ".jobLocation",
      '[class*="jobLocation"]',
      '[class*="job-location"]',
      '[class*="location"]',
      '[itemprop="jobLocation"] [itemprop="address"]',
      ".location",
    ]

    for (const selector of locationSelectors) {
      const locationElement = document.querySelector(selector)
      if (locationElement) {
        const locationText = locationElement.textContent.trim()
        if (
          locationText &&
          !locationText.includes("$") &&
          !locationText.includes("USD")
        ) {
          jobData.location = locationText
          break
        }
      }
    }

    // Extract compensation
    const compensationSelectors = [
      '[data-testid="job-salary"]',
      ".job_salary",
      ".jobSalary",
      '[class*="salary"]',
      '[class*="compensation"]',
      '[class*="pay"]',
      '[itemprop="baseSalary"]',
    ]

    for (const selector of compensationSelectors) {
      const compElement = document.querySelector(selector)
      if (compElement) {
        const compText = compElement.textContent.trim()
        if (
          compText &&
          (compText.includes("$") ||
            compText.includes("USD") ||
            compText.includes("salary"))
        ) {
          jobData.compensation = compText
          break
        }
      }
    }

    return jobData
  }

  function extractFromIndeed() {
    const jobData = getBaseJobData()

    // Scope to job detail (right) panel so we get the selected job, not the first card in the left list.
    const root =
      document.querySelector("#jobsearch-ViewjobPaneWrapper") ||
      document.querySelector(".jobsearch-RightPane") ||
      document.querySelector(".jobsearch-JobComponent") ||
      document
    function q(s) {
      return root.querySelector(s)
    }
    function qa(s) {
      return root.querySelectorAll(s)
    }

    // Extract job title - prefer right-panel header first
    const titleSelectors = [
      "h2.jobsearch-JobInfoHeader-title",
      ".jobsearch-JobInfoHeader-title",
      ".jobsearch-JobInfoHeader-title-container h2",
      'h2[data-testid="job-title"]',
      "h2.jobTitle",
      'h2[class*="jobTitle"]',
      '[class*="jobTitle"] h2',
      "h1.jobTitle",
      'h1[data-testid="job-title"]',
      ".jobsearch-DesktopStickyContainer h2",
      "h2",
    ]

    for (const selector of titleSelectors) {
      const titleElement = q(selector)
      if (titleElement && titleElement.textContent.trim()) {
        const titleText = titleElement.textContent.trim()
        const clean = titleText.replace(/\s*-\s*job\s*post\s*$/i, "").trim()
        if (
          clean &&
          clean.length > 3 &&
          !clean.toLowerCase().includes("indeed")
        ) {
          jobData.jobTitle = clean
          break
        }
      }
    }

    // Extract company name
    const companySelectors = [
      '[data-testid="inlineHeader-companyName"]',
      'a[data-testid="inlineHeader-companyName"]',
      ".jobsearch-InlineCompanyRating a",
      ".jobsearch-InlineCompanyRating",
      ".companyName",
      '[class*="companyName"]',
      ".jobsearch-CompanyReview--heading",
      ".jobsearch-CompanyReview--heading a",
      '[itemprop="hiringOrganization"] [itemprop="name"]',
      ".jobsearch-JobInfoHeader-companyName",
      'a[data-testid="company-link"]',
      '[data-testid="company-name"]',
    ]

    for (const selector of companySelectors) {
      const companyElement = q(selector)
      if (companyElement) {
        const companyText = companyElement.textContent.trim()
        if (
          companyText &&
          companyText.length > 1 &&
          !companyText.toLowerCase().includes("indeed")
        ) {
          jobData.companyName = companyText
          break
        }
      }
    }

    // Extract job description
    const descriptionSelectors = [
      "#jobDescriptionText",
      ".jobsearch-jobDescriptionText",
      '[data-testid="job-description"]',
      ".jobsearch-JobComponent-description",
      '[id*="jobDescription"]',
      '[class*="jobDescription"]',
      '[itemprop="description"]',
      ".jobsearch-JobComponent-descriptionText",
      "#job-description-container",
      ".jobsearch-job-description-section",
    ]

    for (const selector of descriptionSelectors) {
      const descElement = q(selector)
      if (descElement) {
        const descText =
          descElement.textContent.trim() || descElement.innerText.trim()
        if (descText && descText.length > 50) {
          jobData.jobDescription = descText
          break
        }
      }
    }

    if (!jobData.jobDescription) {
      const descSections = qa(
        '#jobDescriptionText, .jobsearch-jobDescriptionText, [data-testid="job-description"]',
      )
      if (descSections.length > 0) {
        const combinedText = Array.from(descSections)
          .map((el) => el.textContent.trim() || el.innerText.trim())
          .filter((text) => text.length > 10)
          .join("\n\n")
        if (combinedText.length > 50) {
          jobData.jobDescription = combinedText
        }
      }
    }

    // Extract location
    const locationSelectors = [
      '[data-testid="inlineHeader-companyLocation"]',
      ".jobsearch-InlineCompanyRating + div",
      ".css-89aoy7",
      '[data-testid="job-location"]',
      ".jobsearch-JobInfoHeader-subtitle",
      ".jobsearch-JobInfoHeader-subtitle-item",
      '[class*="jobLocation"]',
      '[class*="location"]',
      '[itemprop="jobLocation"] [itemprop="addressLocality"]',
      '[itemprop="jobLocation"]',
      ".jobsearch-JobInfoHeader-companyName + div",
    ]

    for (const selector of locationSelectors) {
      const locationElement = q(selector)
      if (locationElement) {
        const locationText = locationElement.textContent.trim()
        if (
          locationText &&
          locationText.length > 2 &&
          !locationText.includes("$") &&
          !locationText.includes("USD") &&
          !locationText.toLowerCase().includes("salary") &&
          !locationText.toLowerCase().includes("hour") &&
          !locationText.toLowerCase().includes("year") &&
          !locationText.match(/\$\d/)
        ) {
          jobData.location = locationText
          break
        }
      }
    }

    if (!jobData.location) {
      const metadataItems = qa(".jobsearch-JobMetadataHeader-item")
      for (const item of metadataItems) {
        const text = item.textContent.trim()
        if (
          text &&
          text.length > 2 &&
          !text.includes("$") &&
          !text.includes("USD") &&
          !text.toLowerCase().includes("salary") &&
          !text.toLowerCase().includes("hour") &&
          !text.toLowerCase().includes("year") &&
          !text.match(/\$\d/)
        ) {
          jobData.location = text
          break
        }
      }
    }

    // Extract compensation - right panel uses #salaryInfoAndJobType and Pay section
    const compensationSelectors = [
      "#salaryInfoAndJobType",
      "#jobDetailsSection [aria-label='Pay'] span",
      ".js-match-insights-provider-18uwqyc",
      '[data-testid="job-salary"]',
      '.jobsearch-JobMetadataHeader-item[data-testid="job-salary"]',
      ".css-1oc7tea",
      '[class*="salary"]',
      '[class*="compensation"]',
      '[class*="pay"]',
      '[itemprop="baseSalary"]',
    ]

    for (const selector of compensationSelectors) {
      const compElement = q(selector)
      if (compElement) {
        const compText = compElement.textContent.trim()
        const salaryPart = compText
          .split(/\s*-\s*Full-time|\s*-\s*Part-time/i)[0]
          .trim()
        if (
          salaryPart &&
          (salaryPart.includes("$") ||
            salaryPart.includes("USD") ||
            salaryPart.toLowerCase().includes("salary") ||
            salaryPart.toLowerCase().includes("hour") ||
            salaryPart.toLowerCase().includes("year"))
        ) {
          jobData.compensation = salaryPart
          break
        }
      }
    }

    if (!jobData.compensation) {
      const metadataItems = qa(".jobsearch-JobMetadataHeader-item")
      for (const item of metadataItems) {
        const text = item.textContent.trim()
        if (
          text &&
          (text.includes("$") ||
            text.includes("USD") ||
            text.toLowerCase().includes("salary") ||
            text.toLowerCase().includes("hour") ||
            text.toLowerCase().includes("year") ||
            text.toLowerCase().includes("per") ||
            text.match(/\$\d/) ||
            text.match(/\d+\s*(K|k|M|m)/))
        ) {
          jobData.compensation = text
          break
        }
      }
    }

    if (!jobData.compensation) {
      const subtitleItems = qa(".jobsearch-JobInfoHeader-subtitle-item")
      for (const item of subtitleItems) {
        const text = item.textContent.trim()
        if (
          text &&
          (text.includes("$") ||
            text.match(/\$\d/) ||
            text.toLowerCase().includes("salary") ||
            text.toLowerCase().includes("hour") ||
            text.toLowerCase().includes("year"))
        ) {
          jobData.compensation = text
          break
        }
      }
    }

    return jobData
  }

  function extractFromHandshake() {
    const jobData = getBaseJobData()

    // Extract job title
    const titleSelectors = [
      'h1[data-testid="job-title"]',
      "h1.job-title",
      ".job-title h1",
      "h1.jobTitle",
      '[class*="jobTitle"] h1',
      "h1",
    ]

    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector)
      if (titleElement && titleElement.textContent.trim()) {
        jobData.jobTitle = titleElement.textContent.trim()
        break
      }
    }

    // Extract company name
    const companySelectors = [
      '[data-testid="company-name"]',
      ".company-name",
      ".companyName",
      '[class*="companyName"]',
      '[class*="company-name"]',
      ".employer-name",
      '[itemprop="hiringOrganization"] [itemprop="name"]',
    ]

    for (const selector of companySelectors) {
      const companyElement = document.querySelector(selector)
      if (companyElement) {
        jobData.companyName = companyElement.textContent.trim()
        break
      }
    }

    // Extract job description
    const descriptionSelectors = [
      '[data-testid="job-description"]',
      ".job-description",
      ".jobDescription",
      '[class*="jobDescription"]',
      '[class*="job-description"]',
      "#job-description",
      '[itemprop="description"]',
      ".job-details-description",
    ]

    for (const selector of descriptionSelectors) {
      const descElement = document.querySelector(selector)
      if (descElement) {
        jobData.jobDescription =
          descElement.textContent.trim() || descElement.innerText.trim()
        break
      }
    }

    // Extract location
    const locationSelectors = [
      '[data-testid="job-location"]',
      ".job-location",
      ".jobLocation",
      '[class*="jobLocation"]',
      '[class*="location"]',
      '[itemprop="jobLocation"]',
      ".location",
    ]

    for (const selector of locationSelectors) {
      const locationElement = document.querySelector(selector)
      if (locationElement) {
        const locationText = locationElement.textContent.trim()
        if (
          locationText &&
          !locationText.includes("$") &&
          !locationText.includes("USD")
        ) {
          jobData.location = locationText
          break
        }
      }
    }

    // Extract compensation
    const compensationSelectors = [
      '[data-testid="job-salary"]',
      ".job-salary",
      ".jobSalary",
      '[class*="salary"]',
      '[class*="compensation"]',
      '[class*="pay"]',
      '[itemprop="baseSalary"]',
    ]

    for (const selector of compensationSelectors) {
      const compElement = document.querySelector(selector)
      if (compElement) {
        const compText = compElement.textContent.trim()
        if (
          compText &&
          (compText.includes("$") ||
            compText.includes("USD") ||
            compText.includes("salary"))
        ) {
          jobData.compensation = compText
          break
        }
      }
    }

    return jobData
  }

  function extractJobInfo() {
    const url = window.location.href
    const hostname = window.location.hostname

    // Determine which site we're on and extract accordingly
    if (hostname.includes("linkedin.com")) {
      return extractFromLinkedIn()
    } else if (hostname.includes("ziprecruiter.com")) {
      return extractFromZipRecruiter()
    } else if (hostname.includes("indeed.com")) {
      return extractFromIndeed()
    } else if (
      hostname.includes("joinhandshake.com") ||
      hostname.includes("app.joinhandshake.com")
    ) {
      return extractFromHandshake()
    }

    // Fallback: try generic selectors
    const jobData = getBaseJobData()

    // Try to find job title in common h1/h2 tags
    const titleElement = document.querySelector("h1, h2")
    if (titleElement) {
      jobData.jobTitle = titleElement.textContent.trim()
    }

    // Try to find company name
    const companyElement = document.querySelector(
      '[itemprop="hiringOrganization"] [itemprop="name"], .company-name, .companyName',
    )
    if (companyElement) {
      jobData.companyName = companyElement.textContent.trim()
    }

    // Try to find description
    const descElement = document.querySelector(
      '[itemprop="description"], .job-description, .jobDescription',
    )
    if (descElement) {
      jobData.jobDescription =
        descElement.textContent.trim() || descElement.innerText.trim()
    }

    // Try to find location
    const locationElement = document.querySelector(
      '[itemprop="jobLocation"], [itemprop="address"], .location, [class*="location"]',
    )
    if (locationElement) {
      const locationText = locationElement.textContent.trim()
      if (
        locationText &&
        !locationText.includes("$") &&
        !locationText.includes("USD")
      ) {
        jobData.location = locationText
      }
    }

    // Try to find compensation
    const compensationElement = document.querySelector(
      '[itemprop="baseSalary"], [class*="salary"], [class*="compensation"]',
    )
    if (compensationElement) {
      const compText = compensationElement.textContent.trim()
      if (
        compText &&
        (compText.includes("$") ||
          compText.includes("USD") ||
          compText.includes("salary"))
      ) {
        jobData.compensation = compText
      }
    }

    return jobData
  }

  function saveJobInfo(jobData) {
    if (jobData.jobTitle || jobData.companyName) {
      chrome.runtime.sendMessage(
        {
          action: "saveJobInfo",
          data: jobData,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error saving job info:", chrome.runtime.lastError)
          } else {
            console.log("Job info saved successfully")
          }
        },
      )
    }
  }

  // Helper function to escape HTML (same as popup)
  function escapeHtml(text) {
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

  // Parse page compensation string to low-end yearly number (for comparison with API wage)
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
    // If hourly, convert to yearly (~2080 hours) for calculation
    if (/\d+\s*\/\s*(hr|hour)|\s+per\s+(hour|hr)/i.test(s))
      num = Math.round(num * 2080)
    return num
  }

  // Format compensation for display: if hourly, append yearly equivalent e.g. "$30/hr (~$62,400/yr)"
  function formatCompensationForDisplay(str) {
    if (!str || typeof str !== "string") return ""
    const s = str.trim()
    if (!s) return ""
    const isHourly = /\d+\s*\/\s*(hr|hour)|\s+per\s+(hour|hr)/i.test(s)
    if (!isHourly) return s
    const yearly = parseCompensationToNumber(s)
    if (yearly == null) return s
    return s + " (~$" + yearly.toLocaleString() + "/yr)"
  }

  // Compare page comp low to API low (percentile_25); return 'higher' | 'average' | 'lower'
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

  // Render only the single badge that matches the indicator (higher / average / lower); icon 2em
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

  // Sidebar functionality
  const SIDEBAR_ID = "basta-job-assistant-sidebar"
  const SIDEBAR_EXPAND_TAB_ID = "basta-sidebar-expand-tab"
  const SIDEBAR_WRAPPER_ID = "basta-sidebar-wrapper"
  let sidebarInitialized = false

  function removeSidebar() {
    const wrapper = document.getElementById(SIDEBAR_WRAPPER_ID)
    if (wrapper) wrapper.remove()
    const expandTab = document.getElementById(SIDEBAR_EXPAND_TAB_ID)
    if (expandTab) expandTab.remove()
    const sidebar = document.getElementById(SIDEBAR_ID)
    if (sidebar) sidebar.remove()
    document.body.classList.remove(
      "basta-sidebar-active",
      "basta-sidebar-hidden-body",
    )
  }
  let apiCallMadeForCurrentPage = false
  let currentPageUrl = location.href

  function createSidebarHTML(jobData, mobilityData) {
    if (!jobData || (!jobData.jobTitle && !jobData.companyName)) {
      return `
        <div class="basta-sidebar-empty">
          <p>No Job information available.</p>
        </div>
      `
    }

    const companyName = escapeHtml(jobData.companyName || "Not available")
    const companyLink = companySearchUrl(jobData.companyName)
    const overallBadgeHtml = mobilityData?.job_mobility
      ? renderBadgeHtml(mobilityData.job_mobility.overall_badge)
      : renderBadgeHtml(null)

    // Show available data even when status is in_progress
    let mobilityHTML = ""
    if (mobilityData && mobilityData.job_mobility) {
      // Show available data even if status is in_progress
      mobilityHTML = createMobilityHTML(
        mobilityData,
        companyName,
        companyLink,
        jobData.compensation,
      )

      // Show loading indicator if still in progress
      if (mobilityData.job_mobility.status === "in_progress") {
        mobilityHTML +=
          '<div class="basta-sidebar-spinner"><span class="basta-sidebar-spinner-circle"></span><span>Loading more data...</span></div>'
      }
    } else if (
      !mobilityData ||
      (mobilityData.status && mobilityData.status === "in_progress")
    ) {
      // Show spinner only if no data at all
      mobilityHTML =
        '<div class="basta-sidebar-spinner"><span class="basta-sidebar-spinner-circle"></span><span>Loading job mobility data...</span></div>'
    }

    return `
      <div class="basta-sidebar-content">
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Company</div>
          <div class="basta-sidebar-value basta-company-with-badge">
            ${companyLink ? `<a href="${companyLink}" target="_blank" class="basta-company-link">${companyName}</a>` : companyName}
            ${overallBadgeHtml}
          </div>
        </div>
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Title</div>
          <div class="basta-sidebar-value">${escapeHtml(jobData.jobTitle || "Not available")}</div>
        </div>
        ${mobilityHTML}
      </div>
    `
  }

  function createMobilityHTML(
    mobilityData,
    companyName,
    companyLink,
    pageCompensation,
  ) {
    // Handle both direct job_mobility object and nested structure
    const data = mobilityData.job_mobility || mobilityData || {}
    let html = ""

    if (data.primary_industry) {
      html += `
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Industry</div>
          <div class="basta-sidebar-value">${escapeHtml(data.primary_industry)}</div>
        </div>
      `
    }

    if (data.skills && data.skills.length > 0) {
      html += `
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Skills that will help you succeed in this role</div>
          <div class="basta-sidebar-value">${data.skills.map((skill) => escapeHtml(skill)).join(", ")}</div>
        </div>
      `
    }

    // Always show Required Education (even if empty)
    html += `
      <div class="basta-sidebar-field">
        <div class="basta-sidebar-label">Required Education:</div>
        <div class="basta-sidebar-value">${escapeHtml(data.education || "Not available")}</div>
      </div>
    `

    // Always show Compensation: fetched page compensation + single comparison icon (no wage data)
    const wage = data.wage || {}
    const pageCompDisplay = formatCompensationForDisplay(pageCompensation || "")
    const pageCompText = pageCompDisplay ? escapeHtml(pageCompDisplay) : ""
    const compIndicator = getCompensationIndicator(pageCompensation, wage)
    const compIndicatorHtml = renderCompensationIndicatorHtml(compIndicator)
    html += `
      <div class="basta-sidebar-field">
        <div class="basta-sidebar-label">Compensation:</div>
        <div class="basta-sidebar-value basta-compensation-row">
          <span class="basta-compensation-text">${pageCompText || "Not on page"}</span>
          ${compIndicatorHtml}
        </div>
      </div>
    `

    // Always show What this company is known for (badges; overall is next to company name)
    html += `
      <div class="basta-sidebar-field">
        <div class="basta-sidebar-label">What this company is known for</div>
        <div class="basta-sidebar-value basta-badges-wrap">
          <div class="basta-badges-row"><span class="basta-badges-row-label">Early Career</span>${renderBadgeHtml(data.badge_early_career)}</div>
          <div class="basta-badges-row"><span class="basta-badges-row-label">Growth</span>${renderBadgeHtml(data.badge_growth)}</div>
          <div class="basta-badges-row"><span class="basta-badges-row-label">Stability</span>${renderBadgeHtml(data.badge_stability)}</div>
        </div>
      </div>
    `

    // Always show Early Career Companies (even if empty)
    html += `
      <div class="basta-sidebar-field">
        <div class="basta-sidebar-label">Early Career Companies:</div>
        <div class="basta-sidebar-value">${
          data.badge_early_career_company &&
          data.badge_early_career_company.length > 0
            ? data.badge_early_career_company
                .map((c) => {
                  const companyName = escapeHtml(c)
                  const companyLink = companySearchUrl(c)
                  return `<a href="${companyLink}" target="_blank" class="basta-company-link">${companyName}</a>`
                })
                .join(", ")
            : "Not available"
        }</div>
      </div>
    `

    // Always show Growth Companies (even if empty)
    html += `
      <div class="basta-sidebar-field">
        <div class="basta-sidebar-label">Growth Companies:</div>
        <div class="basta-sidebar-value">${
          data.badge_growth_company && data.badge_growth_company.length > 0
            ? data.badge_growth_company
                .map((c) => {
                  const companyName = escapeHtml(c)
                  const companyLink = companySearchUrl(c)
                  return `<a href="${companyLink}" target="_blank" class="basta-company-link">${companyName}</a>`
                })
                .join(", ")
            : "Not available"
        }</div>
      </div>
    `

    // Always show Stability Companies (even if empty)
    html += `
      <div class="basta-sidebar-field">
        <div class="basta-sidebar-label">Stability Companies:</div>
        <div class="basta-sidebar-value">${
          data.badge_stability_company &&
          data.badge_stability_company.length > 0
            ? data.badge_stability_company
                .map((c) => {
                  const companyName = escapeHtml(c)
                  const companyLink = companySearchUrl(c)
                  return `<a href="${companyLink}" target="_blank" class="basta-company-link">${companyName}</a>`
                })
                .join(", ")
            : "Not available"
        }</div>
      </div>
    `

    // Always show Pathways (even if empty)
    html += `
      <div class="basta-sidebar-field">
        <div class="basta-sidebar-label">Pathways:</div>
        <div class="basta-sidebar-value">${
          data.pathways && data.pathways.length > 0
            ? data.pathways.map((p) => escapeHtml(p)).join(", ")
            : "Not available"
        }</div>
      </div>
    `

    if (data.recommendation) {
      html += `
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Recommendation:</div>
          <div class="basta-sidebar-value">${escapeHtml(data.recommendation)}</div>
        </div>
      `
    }

    if (data.works && data.works.length > 0) {
      html += `
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">What works well:</div>
          <div class="basta-sidebar-value">
            <ul class="basta-sidebar-list">
              ${data.works.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}
            </ul>
          </div>
        </div>
      `
    }

    if (data.consider && data.consider.length > 0) {
      html += `
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Things to consider:</div>
          <div class="basta-sidebar-value">
            <ul class="basta-sidebar-list">
              ${data.consider.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
            </ul>
          </div>
        </div>
      `
    }

    return html
  }

  function injectSidebarStyles() {
    // Check if styles already injected
    if (document.getElementById("basta-sidebar-styles")) {
      return
    }

    const style = document.createElement("style")
    style.id = "basta-sidebar-styles"
    style.textContent = `
      #${SIDEBAR_ID} {
        position: fixed;
        top: 0;
        right: 0;
        width: 360px;
        height: 100vh;
        background: #F8FAFC;
        border-left: 1px solid #E2E8F0;
        border-radius: 12px 0 0 12px;
        z-index: 999999;
        overflow-y: auto;
        box-shadow: -8px 0 24px rgba(15, 23, 42, 0.12);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      #${SIDEBAR_ID} .basta-sidebar-header {
        background: linear-gradient(180deg, #131F39 0%, #233B48 100%);
        color: white;
        padding: 18px 20px;
        text-align: center;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.02em;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        position: relative;
        flex-wrap: wrap;
        border-radius: 12px 0 0 0;
      }

      #${SIDEBAR_ID} .basta-sidebar-title {
        flex: 1;
        text-align: center;
      }

      #${SIDEBAR_ID} .basta-sidebar-menu-btn {
        background: rgba(255, 255, 255, 0.12);
        border: none;
        color: white;
        cursor: pointer;
        padding: 8px 12px;
        font-size: 14px;
        border-radius: 8px;
        transition: all 0.2s ease;
        position: absolute;
        left: 14px;
      }

      #${SIDEBAR_ID} .basta-sidebar-menu-btn:hover {
        background: rgba(255, 255, 255, 0.22);
      }

      #${SIDEBAR_ID} .basta-sidebar-hide-btn {
        background: rgba(255, 255, 255, 0.12);
        border: none;
        color: white;
        cursor: pointer;
        padding: 8px 12px;
        font-size: 12px;
        border-radius: 8px;
        transition: all 0.2s ease;
        position: absolute;
        right: 14px;
      }

      #${SIDEBAR_ID} .basta-sidebar-hide-btn:hover {
        background: rgba(255, 255, 255, 0.22);
      }

      #${SIDEBAR_ID} .basta-sidebar-menu-dropdown {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: #fff;
        border: 1px solid #E2E8F0;
        border-top: none;
        border-radius: 0 0 12px 12px;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
        z-index: 1000001;
        max-height: 300px;
        overflow-y: auto;
        padding: 18px;
      }

      #${SIDEBAR_ID} .basta-sidebar-menu-dropdown.basta-sidebar-menu-open {
        display: block;
      }

      #${SIDEBAR_ID} .basta-sidebar-menu-user .basta-sidebar-menu-user-name {
        font-weight: 700;
        color: #0F172A;
        margin-bottom: 4px;
        font-size: 15px;
      }

      #${SIDEBAR_ID} .basta-sidebar-menu-user .basta-sidebar-menu-user-email {
        font-size: 13px;
        color: #64748B;
        margin-bottom: 14px;
      }

      #${SIDEBAR_ID} .basta-sidebar-menu-logout {
        background: linear-gradient(180deg, #131F39 0%, #233B48 100%);
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        width: 100%;
        transition: opacity 0.2s;
      }

      #${SIDEBAR_ID} .basta-sidebar-menu-logout:hover {
        opacity: 0.9;
      }

      #${SIDEBAR_ID} .basta-sidebar-menu-login-title {
        font-weight: 700;
        color: #0F172A;
        margin-bottom: 12px;
        font-size: 15px;
      }

      #${SIDEBAR_ID} .basta-sidebar-login-form input {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        margin-bottom: 10px;
        font-size: 14px;
        box-sizing: border-box;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      #${SIDEBAR_ID} .basta-sidebar-login-form input:focus {
        outline: none;
        border-color: #65E4EF;
        box-shadow: 0 0 0 3px rgba(101, 228, 239, 0.2);
      }

      #${SIDEBAR_ID} .basta-sidebar-login-error {
        font-size: 12px;
        color: #DC2626;
        margin-bottom: 8px;
      }

      #${SIDEBAR_ID} .basta-sidebar-login-submit {
        width: 100%;
        background: #65E4EF;
        color: #131F39;
        border: none;
        padding: 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: background 0.2s, transform 0.15s;
      }

      #${SIDEBAR_ID} .basta-sidebar-login-submit:hover {
        background: #4dd4e0;
        transform: translateY(-1px);
      }

      #${SIDEBAR_ID}.basta-sidebar-hidden {
        transform: translateX(100%);
        transition: transform 0.3s ease;
      }

      #${SIDEBAR_ID}.basta-sidebar-hidden .basta-sidebar-hide-btn {
        display: none !important;
      }

      #${SIDEBAR_EXPAND_TAB_ID}.basta-sidebar-expand-tab {
        position: fixed;
        right: 0;
        top: 20px;
        z-index: 1000000;
        background: linear-gradient(180deg, #131F39 0%, #233B48 100%);
        border: none;
        border-radius: 8px 0 0 8px;
        padding: 12px 14px;
        color: white;
        font-size: 16px;
        cursor: pointer;
        box-shadow: -2px 2px 8px rgba(0,0,0,0.15);
        transition: opacity 0.2s, background 0.2s;
      }

      #${SIDEBAR_EXPAND_TAB_ID}.basta-sidebar-expand-tab:hover {
        opacity: 0.95;
      }

      #${SIDEBAR_ID} .basta-sidebar-content {
        padding: 20px;
      }

      #${SIDEBAR_ID} .basta-sidebar-field {
        margin-bottom: 18px;
        overflow: visible;
      }
      #${SIDEBAR_ID} .basta-badge,
      #${SIDEBAR_ID} .basta-comp-indicator {
        overflow: visible;
      }

      #${SIDEBAR_ID} .basta-sidebar-field:last-child {
        margin-bottom: 0;
      }

      #${SIDEBAR_ID} .basta-sidebar-label {
        font-size: 11px;
        font-weight: 800;
        color: #64748B;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 6px;
      }

      #${SIDEBAR_ID} .basta-sidebar-value {
        font-size: 14px;
        color: #0F172A;
        line-height: 1.5;
        word-wrap: break-word;
      }

      #${SIDEBAR_ID} .basta-sidebar-value.basta-company-with-badge {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      #${SIDEBAR_ID} .basta-sidebar-value.basta-sidebar-description {
        max-height: 300px;
        overflow-y: auto;
        padding: 14px;
        background: #F1F5F9;
        border: 1px solid #E2E8F0;
        font-size: 13px;
        border-radius: 8px;
      }

      #${SIDEBAR_ID} .basta-sidebar-empty {
        padding: 40px 24px;
        text-align: center;
        color: #64748B;
        font-size: 14px;
        line-height: 1.6;
      }

      #${SIDEBAR_ID} .basta-sidebar-loading {
        padding: 40px 24px;
        text-align: center;
        color: #64748B;
        font-size: 14px;
      }

      #${SIDEBAR_ID} .basta-sidebar-spinner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 20px;
        text-align: center;
        color: #64748B;
        font-size: 14px;
        min-height: 24px;
      }

      #${SIDEBAR_ID} .basta-sidebar-spinner-circle {
        display: inline-block;
        width: 22px;
        height: 22px;
        border: 3px solid #E2E8F0;
        border-top-color: #233B48;
        border-radius: 50%;
        flex-shrink: 0;
        animation: basta-spin 0.85s linear infinite;
        transform: translateZ(0);
        will-change: transform;
      }

      @keyframes basta-spin {
        from { transform: translateZ(0) rotate(0deg); }
        to { transform: translateZ(0) rotate(360deg); }
      }

      #${SIDEBAR_ID} .basta-company-link {
        color: #233B48;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s;
      }

      #${SIDEBAR_ID} .basta-company-link:hover {
        color: #65E4EF;
      }

      #${SIDEBAR_ID} .basta-sidebar-list {
        margin: 8px 0;
        padding-left: 24px;
        list-style-type: disc;
        list-style-position: outside;
      }

      #${SIDEBAR_ID} .basta-sidebar-list li {
        margin-bottom: 6px;
        display: list-item;
      }

      #${SIDEBAR_ID} .basta-badges-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      #${SIDEBAR_ID} .basta-badges-row:last-child { margin-bottom: 0; }
      #${SIDEBAR_ID} .basta-badges-row-label {
        flex: 0 0 100px;
        font-size: 13px;
        color: #64748B;
      }
      #${SIDEBAR_ID} .basta-badge {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        cursor: default;
      }
      #${SIDEBAR_ID} .basta-badge-platinum {
        background: linear-gradient(135deg, #E5E4E2 0%, #C0C0C0 100%);
        color: #2d2d2d;
        border: 1px solid rgba(0,0,0,0.08);
      }
      #${SIDEBAR_ID} .basta-badge-gold {
        background: linear-gradient(135deg, #FFD700 0%, #D4AF37 100%);
        color: #2d2d2d;
        border: 1px solid rgba(0,0,0,0.1);
      }
      #${SIDEBAR_ID} .basta-badge-na {
        background: transparent;
        color: #64748B;
        border: 1px solid #E2E8F0;
      }
      #${SIDEBAR_ID} .basta-badge-tooltip {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(-6px) translateZ(0);
        background: #131F39;
        color: #fff;
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
        padding: 6px 10px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        opacity: 0;
        pointer-events: none;
        z-index: 1000;
        transition: opacity 0.2s ease-out;
      }
      #${SIDEBAR_ID} .basta-badge:hover .basta-badge-tooltip {
        opacity: 1;
      }

      #${SIDEBAR_ID} .basta-compensation-row {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      #${SIDEBAR_ID} .basta-compensation-text { font-weight: 500; }
      #${SIDEBAR_ID} .basta-comp-indicator {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 2em;
        line-height: 1;
        margin-left: 4px;
        cursor: default;
      }
      #${SIDEBAR_ID} .basta-comp-indicator svg { vertical-align: middle; }
      #${SIDEBAR_ID} .basta-comp-indicator.basta-comp-higher { color: #16a34a; }
      #${SIDEBAR_ID} .basta-comp-indicator.basta-comp-average { color: #ca8a04; }
      #${SIDEBAR_ID} .basta-comp-indicator.basta-comp-lower { color: #dc2626; }
      #${SIDEBAR_ID} .basta-comp-indicator .basta-comp-indicator-tooltip {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(-4px) translateZ(0);
        background: #131F39;
        color: #fff;
        font-size: 11px;
        white-space: nowrap;
        padding: 4px 8px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        opacity: 0;
        pointer-events: none;
        z-index: 1000;
        transition: opacity 0.2s ease-out;
      }
      #${SIDEBAR_ID} .basta-comp-indicator:hover .basta-comp-indicator-tooltip {
        opacity: 1;
      }

      body.basta-sidebar-active:not(.basta-sidebar-hidden-body) {
        margin-right: 360px;
      }
    `
    document.head.appendChild(style)
  }

  function renderMenuContent(isLoggedIn, userFirstName, userEmail) {
    if (isLoggedIn) {
      return `
        <div class="basta-sidebar-menu-user">
          <div class="basta-sidebar-menu-user-name">${escapeHtml(userFirstName || "User")}</div>
          ${userEmail ? `<div class="basta-sidebar-menu-user-email">${escapeHtml(userEmail)}</div>` : ""}
          <button type="button" class="basta-sidebar-menu-logout" id="basta-sidebar-logout">Logout</button>
        </div>
      `
    }
    return `
      <div class="basta-sidebar-menu-login">
        <div class="basta-sidebar-menu-login-title">Sign in</div>
        <form id="basta-sidebar-login-form" class="basta-sidebar-login-form">
          <input type="text" id="basta-sidebar-username" placeholder="Username" required autocomplete="username">
          <input type="password" id="basta-sidebar-password" placeholder="Password" required autocomplete="current-password">
          <div id="basta-sidebar-login-error" class="basta-sidebar-login-error" style="display: none;"></div>
          <button type="submit" class="basta-sidebar-login-submit" id="basta-sidebar-login-btn">Login</button>
        </form>
      </div>
    `
  }

  function openMenuDropdown(sidebar) {
    const dropdown = sidebar.querySelector(".basta-sidebar-menu-dropdown")
    if (!dropdown) return
    chrome.storage.local.get(
      ["authToken", "tokenExpiration", "userFirstName", "userEmail"],
      (result) => {
        const isLoggedIn =
          result.authToken &&
          result.tokenExpiration &&
          Date.now() < result.tokenExpiration
        dropdown.innerHTML = renderMenuContent(
          isLoggedIn,
          result.userFirstName,
          result.userEmail,
        )
        dropdown.classList.add("basta-sidebar-menu-open")

        if (isLoggedIn) {
          const logoutBtn = dropdown.querySelector("#basta-sidebar-logout")
          if (logoutBtn)
            logoutBtn.addEventListener("click", handleSidebarLogout)
        } else {
          const form = dropdown.querySelector("#basta-sidebar-login-form")
          if (form) form.addEventListener("submit", handleSidebarLogin)
        }
      },
    )
  }

  function closeMenuDropdown(sidebar) {
    const dropdown =
      sidebar && sidebar.querySelector(".basta-sidebar-menu-dropdown")
    if (dropdown) dropdown.classList.remove("basta-sidebar-menu-open")
  }

  function handleSidebarLogin(e) {
    e.preventDefault()
    const sidebar = document.getElementById(SIDEBAR_ID)
    const usernameEl = document.getElementById("basta-sidebar-username")
    const passwordEl = document.getElementById("basta-sidebar-password")
    const errorEl = document.getElementById("basta-sidebar-login-error")
    const submitBtn = document.getElementById("basta-sidebar-login-btn")
    if (!usernameEl || !passwordEl || !errorEl || !submitBtn) return

    const username = usernameEl.value.trim()
    const password = passwordEl.value.trim()
    if (!username || !password) {
      errorEl.textContent = "Please enter username and password"
      errorEl.style.display = "block"
      return
    }

    errorEl.style.display = "none"
    submitBtn.disabled = true
    submitBtn.textContent = "Logging in..."

    const formData = new URLSearchParams()
    formData.append("username", username)
    formData.append("password", password)

    fetch(LOGIN_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    })
      .then((res) =>
        res.ok
          ? res.json()
          : res
              .json()
              .then((j) =>
                Promise.reject(new Error(j.message || "Login failed")),
              ),
      )
      .then((responseData) => {
        if (!responseData.success || !responseData.data?.token?.access_token) {
          throw new Error(responseData.message || "Invalid response")
        }
        const tokenData = responseData.data.token
        const expiry = tokenData.expiry * 1000
        return chrome.storage.local.set({
          authToken: tokenData.access_token,
          tokenExpiration: expiry,
          username,
          userFirstName: responseData.data.user?.first_name || "",
          userEmail: responseData.data.user?.email || "",
          userId: responseData.data.user?.id || null,
          responseId: responseData.data.user?.response_id || null,
        })
      })
      .then(() => {
        chrome.runtime.sendMessage({
          action: "updateBadgeForLogin",
          loggedIn: true,
        })
        closeMenuDropdown(sidebar)
        loadSidebarContent()
        submitBtn.disabled = false
        submitBtn.textContent = "Login"
      })
      .catch((err) => {
        errorEl.textContent = err.message || "Login failed"
        errorEl.style.display = "block"
        submitBtn.disabled = false
        submitBtn.textContent = "Login"
      })
  }

  function handleSidebarLogout() {
    chrome.storage.local.remove([
      "authToken",
      "tokenExpiration",
      "username",
      "userFirstName",
      "userEmail",
      "userId",
      "responseId",
    ])
    chrome.runtime.sendMessage({
      action: "updateBadgeForLogin",
      loggedIn: false,
    })
    const sidebar = document.getElementById(SIDEBAR_ID)
    closeMenuDropdown(sidebar)
    loadSidebarContent()
  }

  function ensureExpandTabExists() {
    if (document.getElementById(SIDEBAR_EXPAND_TAB_ID)) return
    const sidebar = document.getElementById(SIDEBAR_ID)
    if (!sidebar) return
    const expandTab = document.createElement("button")
    expandTab.id = SIDEBAR_EXPAND_TAB_ID
    expandTab.className = "basta-sidebar-expand-tab"
    expandTab.innerHTML = "☰"
    expandTab.title = "Show sidebar"
    expandTab.setAttribute("aria-label", "Show sidebar")
    expandTab.style.display = sidebar.classList.contains("basta-sidebar-hidden")
      ? "block"
      : "none"
    expandTab.addEventListener("click", (e) => {
      e.stopPropagation()
      toggleSidebar(true, true)
    })
    document.body.appendChild(expandTab)
  }

  function createSidebar() {
    chrome.storage.local.get(["sidebarVisible"], (result) => {
      if (result.sidebarVisible === false) {
        removeSidebar()
        return
      }
      createSidebarInner()
    })
  }

  function createSidebarInner() {
    const existingSidebar = document.getElementById(SIDEBAR_ID)
    if (existingSidebar) {
      ensureExpandTabExists()
      const menuBtn = existingSidebar.querySelector("#basta-sidebar-menu-btn")
      const toggleBtn = existingSidebar.querySelector("#basta-sidebar-hide-btn")
      if (menuBtn && !menuBtn.hasAttribute("data-listener-attached")) {
        menuBtn.setAttribute("data-listener-attached", "true")
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation()
          const dropdown = existingSidebar.querySelector(
            ".basta-sidebar-menu-dropdown",
          )
          const isOpen =
            dropdown && dropdown.classList.toggle("basta-sidebar-menu-open")
          if (isOpen) openMenuDropdown(existingSidebar)
        })
      }
      if (toggleBtn && !toggleBtn.hasAttribute("data-listener-attached")) {
        toggleBtn.setAttribute("data-listener-attached", "true")
        toggleBtn.addEventListener("click", () => toggleSidebar(false, true))
      }
      loadSidebarContent()
      return
    }

    injectSidebarStyles()

    const wrapper = document.createElement("div")
    wrapper.id = SIDEBAR_WRAPPER_ID

    const sidebar = document.createElement("div")
    sidebar.id = SIDEBAR_ID
    sidebar.innerHTML = `
      <div class="basta-sidebar-header">
        <button class="basta-sidebar-menu-btn" id="basta-sidebar-menu-btn" title="Menu">☰</button>
        <span class="basta-sidebar-title">Basta Job Assistant</span>
        <button class="basta-sidebar-hide-btn" id="basta-sidebar-hide-btn" title="Hide sidebar">◀</button>
        <div class="basta-sidebar-menu-dropdown" id="basta-sidebar-menu-dropdown"></div>
      </div>
      <div class="basta-sidebar-body">
        <div class="basta-sidebar-loading">Loading...</div>
      </div>
    `

    const expandTab = document.createElement("button")
    expandTab.id = SIDEBAR_EXPAND_TAB_ID
    expandTab.className = "basta-sidebar-expand-tab"
    expandTab.innerHTML = "☰"
    expandTab.title = "Show sidebar"
    expandTab.setAttribute("aria-label", "Show sidebar")
    expandTab.style.display = "none"

    wrapper.appendChild(sidebar)
    wrapper.appendChild(expandTab)
    document.body.appendChild(wrapper)
    document.body.classList.add("basta-sidebar-active")

    document.addEventListener("click", (e) => {
      if (!sidebar.contains(e.target) && e.target !== expandTab)
        closeMenuDropdown(sidebar)
    })

    const menuBtn = sidebar.querySelector("#basta-sidebar-menu-btn")
    const hideBtn = sidebar.querySelector("#basta-sidebar-hide-btn")
    if (menuBtn) {
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        const dropdown = sidebar.querySelector(".basta-sidebar-menu-dropdown")
        const isOpen =
          dropdown && dropdown.classList.toggle("basta-sidebar-menu-open")
        if (isOpen) openMenuDropdown(sidebar)
      })
    }
    if (hideBtn)
      hideBtn.addEventListener("click", () => toggleSidebar(false, true))

    expandTab.addEventListener("click", (e) => {
      e.stopPropagation()
      toggleSidebar(true, true)
    })

    chrome.storage.local.get(["sidebarExpanded"], (result) => {
      const isExpanded = result.sidebarExpanded !== false
      toggleSidebar(isExpanded, false)
    })

    loadSidebarContent()
  }

  function toggleSidebar(isVisible, saveState) {
    const sidebar = document.getElementById(SIDEBAR_ID)
    if (!sidebar) return

    const expandTab = document.getElementById(SIDEBAR_EXPAND_TAB_ID)
    const menuBtn = sidebar.querySelector("#basta-sidebar-menu-btn")
    const hideBtn = sidebar.querySelector("#basta-sidebar-hide-btn")

    if (isVisible) {
      sidebar.classList.remove("basta-sidebar-hidden")
      document.body.classList.remove("basta-sidebar-hidden-body")
      document.body.classList.add("basta-sidebar-active")
      closeMenuDropdown(sidebar)
      if (expandTab) expandTab.style.display = "none"
      if (menuBtn) {
        menuBtn.textContent = "☰"
        menuBtn.title = "Menu"
      }
      if (hideBtn) {
        hideBtn.style.display = ""
        hideBtn.title = "Hide sidebar"
      }
    } else {
      sidebar.classList.add("basta-sidebar-hidden")
      document.body.classList.add("basta-sidebar-hidden-body")
      document.body.classList.remove("basta-sidebar-active")
      closeMenuDropdown(sidebar)
      if (expandTab) expandTab.style.display = "block"
      if (menuBtn) {
        menuBtn.textContent = "☰"
        menuBtn.title = "Menu"
      }
      if (hideBtn) hideBtn.style.display = "none"
    }

    if (saveState) {
      chrome.storage.local.set({ sidebarExpanded: isVisible })
    }
  }

  function loadSidebarContent(forceApiCall = false) {
    chrome.storage.local.get(["authToken", "tokenExpiration"], (authResult) => {
      const isLoggedIn =
        authResult.authToken &&
        authResult.tokenExpiration &&
        Date.now() < authResult.tokenExpiration
      const sidebar = document.getElementById(SIDEBAR_ID)
      if (!sidebar) return

      const bodyElement = sidebar.querySelector(".basta-sidebar-body")
      if (!bodyElement) return

      if (!isLoggedIn) {
        bodyElement.innerHTML = `
          <div class="basta-sidebar-empty">
            <p>Sign in to see job insights.</p>
            <p style="margin-top: 12px; font-size: 13px; color: #666;">Click <strong>☰ Menu</strong> above to log in.</p>
          </div>
        `
        return
      }

      // Always extract fresh job data from current page (including salary/compensation) when job may have changed
      const freshJobData = extractJobInfo()
      if (location.href !== currentPageUrl) {
        currentPageUrl = location.href
        apiCallMadeForCurrentPage = false
      }

      if (
        !freshJobData ||
        (!freshJobData.jobTitle && !freshJobData.companyName)
      ) {
        bodyElement.innerHTML = `
          <div class="basta-sidebar-empty">
            <p>No Job information available.</p>
          </div>
        `
        return
      }

      // Save fresh job data so popup and storage stay in sync (compensation included)
      saveJobInfo(freshJobData)

      // Get mobility for this tab and render with fresh job data
      chrome.runtime.sendMessage(
        { action: "getMobilityForCurrentTab" },
        (mobilityData) => {
          if (!sidebar.isConnected) return
          const bodyEl = sidebar.querySelector(".basta-sidebar-body")
          if (!bodyEl) return
          bodyEl.innerHTML = createSidebarHTML(
            freshJobData,
            mobilityData || { status: "in_progress" },
          )
        },
      )

      // Trigger API call for job mobility only if not already made for this page
      if (!apiCallMadeForCurrentPage || forceApiCall) {
        apiCallMadeForCurrentPage = true
        chrome.runtime.sendMessage({
          action: "fetchJobMobility",
          jobData: freshJobData,
        })
      }
    })
  }

  function initSidebar() {
    if (sidebarInitialized) return
    sidebarInitialized = true

    // Create sidebar after a short delay to ensure page is ready
    setTimeout(() => {
      createSidebar()
    }, 1000)

    // Listen for storage changes to update sidebar
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        // Handle logout - update sidebar to show sign-in prompt (sidebar stays)
        if (changes.authToken && !changes.authToken.newValue) {
          const sidebar = document.getElementById(SIDEBAR_ID)
          if (sidebar) loadSidebarContent()
          return
        }

        // Handle login or job info updates
        // Only update UI, don't trigger new API calls on storage changes
        if (changes.jobMobilityByTab || changes.lastJobMobility) {
          // Update UI with fresh job data (including compensation) + new mobility data
          const sidebar = document.getElementById(SIDEBAR_ID)
          if (sidebar) {
            const bodyElement = sidebar.querySelector(".basta-sidebar-body")
            if (bodyElement) {
              const freshJobData = extractJobInfo()
              chrome.runtime.sendMessage(
                { action: "getMobilityForCurrentTab" },
                (mobilityData) => {
                  if (
                    freshJobData &&
                    (freshJobData.jobTitle || freshJobData.companyName) &&
                    mobilityData
                  ) {
                    bodyElement.innerHTML = createSidebarHTML(
                      freshJobData,
                      mobilityData,
                    )
                  }
                },
              )
            }
          }
        } else if (
          changes.sidebarVisible &&
          changes.sidebarVisible.newValue === false
        ) {
          removeSidebar()
        } else if (
          changes.jobInfoByTab ||
          changes.lastJobInfo ||
          changes.authToken ||
          changes.tokenExpiration
        ) {
          // Check if sidebar exists, if not create it (only when sidebar is enabled)
          chrome.storage.local.get(["sidebarVisible"], (r) => {
            if (r.sidebarVisible === false) return
            const sidebar = document.getElementById(SIDEBAR_ID)
            if (sidebar) {
              loadSidebarContent(false)
            } else {
              createSidebar()
            }
          })
        }
      }
    })

    // Also listen for URL changes (for SPA navigation)
    let lastUrl = location.href
    new MutationObserver(() => {
      const url = location.href
      if (url !== lastUrl) {
        lastUrl = url
        currentPageUrl = url
        apiCallMadeForCurrentPage = false // Reset flag on URL change
        setTimeout(() => {
          const sidebar = document.getElementById(SIDEBAR_ID)
          if (sidebar) {
            loadSidebarContent(true) // Force API call on URL change (page refresh/navigation)
          }
        }, 2000)
      }
    }).observe(document, { subtree: true, childList: true })
  }

  // Listen for messages from popup to parse current page
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "parseCurrentPage") {
      // Parse the current page immediately
      const jobData = extractJobInfo()
      sendResponse({ success: true, data: jobData })
      return true // Indicates we will send a response asynchronously
    }

    if (request.action === "setSidebarVisible") {
      const visible = request.visible !== false
      chrome.storage.local.set({ sidebarVisible: visible })
      if (!visible) {
        removeSidebar()
      } else {
        const sidebar = document.getElementById(SIDEBAR_ID)
        if (sidebar) {
          toggleSidebar(true, true)
        } else {
          createSidebar()
        }
      }
      sendResponse({ success: true })
      return false
    }

    if (request.action === "jobMobilityUpdate") {
      // Update sidebar with fresh job data (including compensation) + mobility data
      const sidebar = document.getElementById(SIDEBAR_ID)
      if (!sidebar) return

      const bodyElement = sidebar.querySelector(".basta-sidebar-body")
      if (!bodyElement) return

      const freshJobData = extractJobInfo()
      if (
        !freshJobData ||
        (!freshJobData.jobTitle && !freshJobData.companyName)
      )
        return

      if (request.success && request.data) {
        const mobilityData = request.data.job_mobility
          ? request.data
          : { job_mobility: request.data }
        bodyElement.innerHTML = createSidebarHTML(freshJobData, mobilityData)
      } else if (request.error) {
        bodyElement.innerHTML =
          createSidebarHTML(freshJobData, { status: "in_progress" }) +
          `<div class="basta-sidebar-error" style="padding: 10px; color: #d32f2f; font-size: 12px;">Error: ${escapeHtml(request.error)}</div>`
      }
    }
  })

  // Extract and save job info when page loads
  function init() {
    // Reset API call flag on page load
    currentPageUrl = location.href
    apiCallMadeForCurrentPage = false

    // Wait for page to fully load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
          const jobData = extractJobInfo()
          saveJobInfo(jobData)
        }, 2000) // Wait 2 seconds for dynamic content
      })
    } else {
      setTimeout(() => {
        const jobData = extractJobInfo()
        saveJobInfo(jobData)
      }, 2000)
    }

    // Also listen for URL changes (LinkedIn uses SPA navigation)
    let lastUrl = location.href
    new MutationObserver(() => {
      const url = location.href
      if (url !== lastUrl) {
        lastUrl = url
        currentPageUrl = url
        apiCallMadeForCurrentPage = false // Reset flag on URL change
        setTimeout(() => {
          const jobData = extractJobInfo()
          saveJobInfo(jobData)
        }, 2000)
      }
    }).observe(document, { subtree: true, childList: true })

    // Initialize sidebar
    initSidebar()
  }

  init()
})()
