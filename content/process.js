// Job Post Content Script
// Extracts company name, job title, and job description from multiple job board sites
// Supports: LinkedIn, ZipRecruiter, Indeed, Handshake

(function() {
  'use strict';

  function getBaseJobData() {
    return {
      companyName: '',
      jobTitle: '',
      jobDescription: '',
      location: '',
      compensation: '',
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
  }

  function extractFromLinkedIn() {
    const jobData = getBaseJobData();

    // Extract job title
    const titleSelectors = [
      '.jobs-details-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title',
      'h1[data-test-id="job-title"]',
      '.jobs-details__main-content h1',
      'h1.job-title'
    ];

    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement) {
        jobData.jobTitle = titleElement.textContent.trim();
        break;
      }
    }

    // Extract company name
    const companySelectors = [
      '.jobs-details-top-card__company-name a',
      '.jobs-details-top-card__company-name',
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      'a[data-test-id="job-poster"]',
      '.jobs-details__main-content .jobs-details__company-name',
      '.jobs-company__box a'
    ];

    for (const selector of companySelectors) {
      const companyElement = document.querySelector(selector);
      if (companyElement) {
        jobData.companyName = companyElement.textContent.trim();
        break;
      }
    }

    // Extract job description
    const descriptionSelectors = [
      '.jobs-description__text',
      '.jobs-description-content__text',
      '.jobs-box__html-content',
      '[data-test-id="job-description"]',
      '.jobs-details__main-content .jobs-description',
      '.jobs-description'
    ];

    for (const selector of descriptionSelectors) {
      const descElement = document.querySelector(selector);
      if (descElement) {
        jobData.jobDescription = descElement.textContent.trim() || descElement.innerText.trim();
        break;
      }
    }

    // If description is still empty, try to get from multiple sections
    if (!jobData.jobDescription) {
      const descSections = document.querySelectorAll('.jobs-description__text, .jobs-description-content__text, .jobs-box__html-content');
      if (descSections.length > 0) {
        jobData.jobDescription = Array.from(descSections)
          .map(el => el.textContent.trim() || el.innerText.trim())
          .join('\n\n');
      }
    }

    // Extract location
    const locationSelectors = [
      '.jobs-details-top-card__bullet',
      '.job-details-jobs-unified-top-card__primary-description-without-tagline',
      '.jobs-details-top-card__primary-description-without-tagline',
      '[data-test-id="job-location"]',
      '.jobs-unified-top-card__primary-description',
      '.jobs-details__main-content .jobs-details__job-details',
      '[class*="job-location"]',
      '[class*="location"]'
    ];

    for (const selector of locationSelectors) {
      const locationElement = document.querySelector(selector);
      if (locationElement) {
        const locationText = locationElement.textContent.trim();
        // Filter out compensation info from location
        if (locationText && !locationText.includes('$') && !locationText.includes('USD') && !locationText.includes('salary')) {
          jobData.location = locationText;
          break;
        }
      }
    }

    // Extract compensation - be very specific to avoid JSON data
    // Helper function to check if text looks like valid compensation (not JSON)
    function isValidCompensationText(text) {
      if (!text || text.length > 200) return false; // Too long, likely JSON
      if (text.includes('{') || text.includes('}') || text.includes('"data"') || text.includes('"entityUrn"')) return false; // JSON markers
      // Check for compensation patterns: $, K, /yr, /hr, range with dash, etc.
      const hasDollarSign = text.includes('$');
      const hasCompensationPattern = text.match(/\$[\d,]+[KMB]?/i) || // $150K, $100,000
                                    text.match(/\d+[KMB]?\s*\/\s*(yr|year|hr|hour)/i) || // 150K/yr, 50/hr
                                    text.includes('USD') || 
                                    text.toLowerCase().includes('salary') || 
                                    text.toLowerCase().includes('compensation');
      
      return hasDollarSign || hasCompensationPattern;
    }

    // Helper function to check if element is visible
    function isElementVisible(element) {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    // Try specific LinkedIn compensation selectors first
    // Look for elements that contain compensation patterns
    const compensationSelectors = [
      '.jobs-details-top-card__job-insight',
      '.job-details-jobs-unified-top-card__job-insight',
      '.jobs-unified-top-card__job-insight',
      '[data-test-id="job-salary"]',
      '.jobs-details-top-card__salary',
      '.jobs-unified-top-card__job-insight-text'
    ];

    for (const selector of compensationSelectors) {
      const compElements = document.querySelectorAll(selector);
      for (const compElement of compElements) {
        if (!isElementVisible(compElement)) continue;
        
        // Get full text content (handles text split across multiple child elements)
        const compText = compElement.textContent.trim().replace(/\s+/g, ' ');
        
        // Check if this element contains compensation info
        if (isValidCompensationText(compText)) {
          // Extract just the compensation part if there's other text
          // Look for patterns like "$150K/yr - $160K/" or "$100,000 - $150,000"
          const compensationMatch = compText.match(/\$[\d,]+[KMB]?\s*\/?\s*(yr|year|hr|hour)?\s*-?\s*\$?[\d,]*[KMB]?\s*\/?\s*(yr|year|hr|hour)?/i);
          if (compensationMatch) {
            jobData.compensation = compensationMatch[0].trim();
          } else {
            jobData.compensation = compText;
          }
          break;
        }
      }
      if (jobData.compensation) break;
    }

    // Also check in the primary description for compensation (but be careful)
    if (!jobData.compensation) {
      const primaryDesc = document.querySelector('.jobs-details-top-card__primary-description, .job-details-jobs-unified-top-card__primary-description');
      if (primaryDesc && isElementVisible(primaryDesc)) {
        const descText = primaryDesc.textContent.trim();
        // Only extract if it's a short text that looks like compensation
        if (isValidCompensationText(descText) && descText.length < 100) {
          jobData.compensation = descText;
        }
      }
    }

    // Check job insights section more carefully - get full text content
    if (!jobData.compensation) {
      const insightElements = document.querySelectorAll('.jobs-details-top-card__job-insight, .job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight');
      for (const insight of insightElements) {
        if (!isElementVisible(insight)) continue;
        
        // Get the full text content of the element (handles cases where text is split across spans)
        const fullText = insight.textContent.trim();
        
        // Check if this looks like compensation
        if (isValidCompensationText(fullText)) {
          // Clean up the text - remove extra whitespace and normalize
          jobData.compensation = fullText.replace(/\s+/g, ' ').trim();
          break;
        }
        
        // Also check individual spans in case the full text includes other info
        const spans = insight.querySelectorAll('span');
        for (const span of spans) {
          if (!isElementVisible(span)) continue;
          const spanText = span.textContent.trim();
          if (isValidCompensationText(spanText)) {
            jobData.compensation = spanText.replace(/\s+/g, ' ').trim();
            break;
          }
        }
        
        if (jobData.compensation) break;
      }
    }

    return jobData;
  }

  function extractFromZipRecruiter() {
    const jobData = getBaseJobData();

    // Extract job title
    const titleSelectors = [
      'h1[data-testid="job-title"]',
      'h1.job-title',
      'h1.jobTitle',
      '.job_title h1',
      'h1.jobTitleHeader',
      '[class*="jobTitle"] h1',
      'h1'
    ];

    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent.trim()) {
        jobData.jobTitle = titleElement.textContent.trim();
        break;
      }
    }

    // Extract company name
    const companySelectors = [
      '[data-testid="company-name"]',
      '.company_name',
      '.companyName',
      '[class*="companyName"]',
      '[class*="company-name"]',
      'a[data-testid="company-link"]',
      '.job_company_name',
      '[itemprop="hiringOrganization"] [itemprop="name"]'
    ];

    for (const selector of companySelectors) {
      const companyElement = document.querySelector(selector);
      if (companyElement) {
        jobData.companyName = companyElement.textContent.trim();
        break;
      }
    }

    // Extract job description
    const descriptionSelectors = [
      '[data-testid="job-description"]',
      '.job_description',
      '.jobDescription',
      '[class*="jobDescription"]',
      '[class*="job-description"]',
      '#job_description',
      '[itemprop="description"]',
      '.job_detail_description'
    ];

    for (const selector of descriptionSelectors) {
      const descElement = document.querySelector(selector);
      if (descElement) {
        jobData.jobDescription = descElement.textContent.trim() || descElement.innerText.trim();
        break;
      }
    }

    // Extract location
    const locationSelectors = [
      '[data-testid="job-location"]',
      '.job_location',
      '.jobLocation',
      '[class*="jobLocation"]',
      '[class*="job-location"]',
      '[class*="location"]',
      '[itemprop="jobLocation"] [itemprop="address"]',
      '.location'
    ];

    for (const selector of locationSelectors) {
      const locationElement = document.querySelector(selector);
      if (locationElement) {
        const locationText = locationElement.textContent.trim();
        if (locationText && !locationText.includes('$') && !locationText.includes('USD')) {
          jobData.location = locationText;
          break;
        }
      }
    }

    // Extract compensation
    const compensationSelectors = [
      '[data-testid="job-salary"]',
      '.job_salary',
      '.jobSalary',
      '[class*="salary"]',
      '[class*="compensation"]',
      '[class*="pay"]',
      '[itemprop="baseSalary"]'
    ];

    for (const selector of compensationSelectors) {
      const compElement = document.querySelector(selector);
      if (compElement) {
        const compText = compElement.textContent.trim();
        if (compText && (compText.includes('$') || compText.includes('USD') || compText.includes('salary'))) {
          jobData.compensation = compText;
          break;
        }
      }
    }

    return jobData;
  }

  function extractFromIndeed() {
    const jobData = getBaseJobData();

    // Extract job title - Indeed uses various structures
    const titleSelectors = [
      'h2[data-testid="job-title"]',
      'h2.jobTitle',
      'h2.jobsearch-JobInfoHeader-title',
      '.jobsearch-JobInfoHeader-title',
      '.jobsearch-JobInfoHeader-title-container h2',
      'h2[class*="jobTitle"]',
      '[class*="jobTitle"] h2',
      'h1.jobTitle',
      'h1[data-testid="job-title"]',
      '.jobsearch-DesktopStickyContainer h2',
      'h2'
    ];

    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent.trim()) {
        const titleText = titleElement.textContent.trim();
        // Filter out generic headings
        if (titleText && titleText.length > 3 && !titleText.toLowerCase().includes('indeed')) {
          jobData.jobTitle = titleText;
          break;
        }
      }
    }

    // Extract company name - Indeed has multiple possible locations
    const companySelectors = [
      '[data-testid="inlineHeader-companyName"]',
      '[data-testid="company-name"]',
      'a[data-testid="inlineHeader-companyName"]',
      '.jobsearch-InlineCompanyRating a',
      '.jobsearch-InlineCompanyRating',
      '.companyName',
      '[class*="companyName"]',
      '.jobsearch-CompanyReview--heading',
      '.jobsearch-CompanyReview--heading a',
      '[itemprop="hiringOrganization"] [itemprop="name"]',
      '.jobsearch-JobInfoHeader-companyName',
      'a[data-testid="company-link"]'
    ];

    for (const selector of companySelectors) {
      const companyElement = document.querySelector(selector);
      if (companyElement) {
        const companyText = companyElement.textContent.trim();
        // Filter out empty or invalid company names
        if (companyText && companyText.length > 1 && !companyText.toLowerCase().includes('indeed')) {
          jobData.companyName = companyText;
          break;
        }
      }
    }

    // Extract job description - Indeed uses #jobDescriptionText as the main container
    const descriptionSelectors = [
      '#jobDescriptionText',
      '.jobsearch-jobDescriptionText',
      '[data-testid="job-description"]',
      '.jobsearch-JobComponent-description',
      '[id*="jobDescription"]',
      '[class*="jobDescription"]',
      '[itemprop="description"]',
      '.jobsearch-JobComponent-descriptionText',
      '#job-description-container',
      '.jobsearch-job-description-section'
    ];

    for (const selector of descriptionSelectors) {
      const descElement = document.querySelector(selector);
      if (descElement) {
        const descText = descElement.textContent.trim() || descElement.innerText.trim();
        // Make sure we got actual description content
        if (descText && descText.length > 50) {
          jobData.jobDescription = descText;
          break;
        }
      }
    }

    // If description is still empty, try to get from multiple sections
    if (!jobData.jobDescription) {
      const descSections = document.querySelectorAll('#jobDescriptionText, .jobsearch-jobDescriptionText, [data-testid="job-description"]');
      if (descSections.length > 0) {
        const combinedText = Array.from(descSections)
          .map(el => el.textContent.trim() || el.innerText.trim())
          .filter(text => text.length > 10)
          .join('\n\n');
        if (combinedText.length > 50) {
          jobData.jobDescription = combinedText;
        }
      }
    }

    // Extract location - Indeed often shows location in subtitle or metadata
    const locationSelectors = [
      '[data-testid="job-location"]',
      '.jobsearch-JobInfoHeader-subtitle',
      '.jobsearch-JobInfoHeader-subtitle-item',
      '[class*="jobLocation"]',
      '[class*="location"]',
      '[itemprop="jobLocation"] [itemprop="addressLocality"]',
      '[itemprop="jobLocation"]',
      '.jobsearch-InlineCompanyRating + div',
      '.jobsearch-JobInfoHeader-companyName + div'
    ];

    for (const selector of locationSelectors) {
      const locationElement = document.querySelector(selector);
      if (locationElement) {
        const locationText = locationElement.textContent.trim();
        // Filter out compensation and other non-location text
        if (locationText && 
            locationText.length > 2 && 
            !locationText.includes('$') && 
            !locationText.includes('USD') && 
            !locationText.toLowerCase().includes('salary') &&
            !locationText.toLowerCase().includes('hour') &&
            !locationText.toLowerCase().includes('year') &&
            !locationText.match(/\$\d/)) {
          jobData.location = locationText;
          break;
        }
      }
    }

    // Also check metadata items but filter out compensation
    if (!jobData.location) {
      const metadataItems = document.querySelectorAll('.jobsearch-JobMetadataHeader-item');
      for (const item of metadataItems) {
        const text = item.textContent.trim();
        // Only use if it looks like location (not compensation)
        if (text && 
            text.length > 2 && 
            !text.includes('$') && 
            !text.includes('USD') && 
            !text.toLowerCase().includes('salary') &&
            !text.toLowerCase().includes('hour') &&
            !text.toLowerCase().includes('year') &&
            !text.match(/\$\d/)) {
          jobData.location = text;
          break;
        }
      }
    }

    // Extract compensation - Indeed shows salary in metadata items
    const compensationSelectors = [
      '[data-testid="job-salary"]',
      '.jobsearch-JobMetadataHeader-item[data-testid="job-salary"]',
      '[class*="salary"]',
      '[class*="compensation"]',
      '[class*="pay"]',
      '[itemprop="baseSalary"]'
    ];

    for (const selector of compensationSelectors) {
      const compElement = document.querySelector(selector);
      if (compElement) {
        const compText = compElement.textContent.trim();
        if (compText && (compText.includes('$') || compText.includes('USD') || compText.toLowerCase().includes('salary') || compText.toLowerCase().includes('hour'))) {
          jobData.compensation = compText;
          break;
        }
      }
    }

    // Check metadata header items for salary - Indeed often puts salary here
    if (!jobData.compensation) {
      const metadataItems = document.querySelectorAll('.jobsearch-JobMetadataHeader-item');
      for (const item of metadataItems) {
        const text = item.textContent.trim();
        // Look for salary patterns: $, USD, salary, hour, year, per
        if (text && (
          text.includes('$') || 
          text.includes('USD') || 
          text.toLowerCase().includes('salary') || 
          text.toLowerCase().includes('hour') ||
          text.toLowerCase().includes('year') ||
          text.toLowerCase().includes('per') ||
          text.match(/\$\d/) ||
          text.match(/\d+\s*(K|k|M|m)/)
        )) {
          jobData.compensation = text;
          break;
        }
      }
    }

    // Also check in the job info header subtitle items
    if (!jobData.compensation) {
      const subtitleItems = document.querySelectorAll('.jobsearch-JobInfoHeader-subtitle-item');
      for (const item of subtitleItems) {
        const text = item.textContent.trim();
        if (text && (
          text.includes('$') || 
          text.match(/\$\d/) ||
          text.toLowerCase().includes('salary') ||
          text.toLowerCase().includes('hour') ||
          text.toLowerCase().includes('year')
        )) {
          jobData.compensation = text;
          break;
        }
      }
    }

    return jobData;
  }

  function extractFromHandshake() {
    const jobData = getBaseJobData();

    // Extract job title
    const titleSelectors = [
      'h1[data-testid="job-title"]',
      'h1.job-title',
      '.job-title h1',
      'h1.jobTitle',
      '[class*="jobTitle"] h1',
      'h1'
    ];

    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent.trim()) {
        jobData.jobTitle = titleElement.textContent.trim();
        break;
      }
    }

    // Extract company name
    const companySelectors = [
      '[data-testid="company-name"]',
      '.company-name',
      '.companyName',
      '[class*="companyName"]',
      '[class*="company-name"]',
      '.employer-name',
      '[itemprop="hiringOrganization"] [itemprop="name"]'
    ];

    for (const selector of companySelectors) {
      const companyElement = document.querySelector(selector);
      if (companyElement) {
        jobData.companyName = companyElement.textContent.trim();
        break;
      }
    }

    // Extract job description
    const descriptionSelectors = [
      '[data-testid="job-description"]',
      '.job-description',
      '.jobDescription',
      '[class*="jobDescription"]',
      '[class*="job-description"]',
      '#job-description',
      '[itemprop="description"]',
      '.job-details-description'
    ];

    for (const selector of descriptionSelectors) {
      const descElement = document.querySelector(selector);
      if (descElement) {
        jobData.jobDescription = descElement.textContent.trim() || descElement.innerText.trim();
        break;
      }
    }

    // Extract location
    const locationSelectors = [
      '[data-testid="job-location"]',
      '.job-location',
      '.jobLocation',
      '[class*="jobLocation"]',
      '[class*="location"]',
      '[itemprop="jobLocation"]',
      '.location'
    ];

    for (const selector of locationSelectors) {
      const locationElement = document.querySelector(selector);
      if (locationElement) {
        const locationText = locationElement.textContent.trim();
        if (locationText && !locationText.includes('$') && !locationText.includes('USD')) {
          jobData.location = locationText;
          break;
        }
      }
    }

    // Extract compensation
    const compensationSelectors = [
      '[data-testid="job-salary"]',
      '.job-salary',
      '.jobSalary',
      '[class*="salary"]',
      '[class*="compensation"]',
      '[class*="pay"]',
      '[itemprop="baseSalary"]'
    ];

    for (const selector of compensationSelectors) {
      const compElement = document.querySelector(selector);
      if (compElement) {
        const compText = compElement.textContent.trim();
        if (compText && (compText.includes('$') || compText.includes('USD') || compText.includes('salary'))) {
          jobData.compensation = compText;
          break;
        }
      }
    }

    return jobData;
  }

  function extractJobInfo() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    // Determine which site we're on and extract accordingly
    if (hostname.includes('linkedin.com')) {
      return extractFromLinkedIn();
    } else if (hostname.includes('ziprecruiter.com')) {
      return extractFromZipRecruiter();
    } else if (hostname.includes('indeed.com')) {
      return extractFromIndeed();
    } else if (hostname.includes('joinhandshake.com') || hostname.includes('app.joinhandshake.com')) {
      return extractFromHandshake();
    }

    // Fallback: try generic selectors
    const jobData = getBaseJobData();
    
    // Try to find job title in common h1/h2 tags
    const titleElement = document.querySelector('h1, h2');
    if (titleElement) {
      jobData.jobTitle = titleElement.textContent.trim();
    }

    // Try to find company name
    const companyElement = document.querySelector('[itemprop="hiringOrganization"] [itemprop="name"], .company-name, .companyName');
    if (companyElement) {
      jobData.companyName = companyElement.textContent.trim();
    }

    // Try to find description
    const descElement = document.querySelector('[itemprop="description"], .job-description, .jobDescription');
    if (descElement) {
      jobData.jobDescription = descElement.textContent.trim() || descElement.innerText.trim();
    }

    // Try to find location
    const locationElement = document.querySelector('[itemprop="jobLocation"], [itemprop="address"], .location, [class*="location"]');
    if (locationElement) {
      const locationText = locationElement.textContent.trim();
      if (locationText && !locationText.includes('$') && !locationText.includes('USD')) {
        jobData.location = locationText;
      }
    }

    // Try to find compensation
    const compensationElement = document.querySelector('[itemprop="baseSalary"], [class*="salary"], [class*="compensation"]');
    if (compensationElement) {
      const compText = compensationElement.textContent.trim();
      if (compText && (compText.includes('$') || compText.includes('USD') || compText.includes('salary'))) {
        jobData.compensation = compText;
      }
    }

    return jobData;
  }

  function saveJobInfo(jobData) {
    if (jobData.jobTitle || jobData.companyName) {
      chrome.runtime.sendMessage({
        action: 'saveJobInfo',
        data: jobData
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error saving job info:', chrome.runtime.lastError);
        } else {
          console.log('Job info saved successfully');
        }
      });
    }
  }

  // Helper function to escape HTML (same as popup)
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Sidebar functionality
  const SIDEBAR_ID = 'basta-job-assistant-sidebar';
  let sidebarInitialized = false;

  function createSidebarHTML(jobData) {
    if (!jobData || (!jobData.jobTitle && !jobData.companyName)) {
      return `
        <div class="basta-sidebar-empty">
          <p>No Job information available.</p>
        </div>
      `;
    }

    return `
      <div class="basta-sidebar-content">
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Job Title</div>
          <div class="basta-sidebar-value">${escapeHtml(jobData.jobTitle || 'Not available')}</div>
        </div>
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Company Name</div>
          <div class="basta-sidebar-value">${escapeHtml(jobData.companyName || 'Not available')}</div>
        </div>
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Job Description</div>
          <div class="basta-sidebar-value basta-sidebar-description">${escapeHtml(jobData.jobDescription || 'Not available')}</div>
        </div>
        ${jobData.location ? `
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Location</div>
          <div class="basta-sidebar-value">${escapeHtml(jobData.location)}</div>
        </div>
        ` : ''}
        ${jobData.compensation ? `
        <div class="basta-sidebar-field">
          <div class="basta-sidebar-label">Compensation</div>
          <div class="basta-sidebar-value">${escapeHtml(jobData.compensation)}</div>
        </div>
        ` : ''}
      </div>
    `;
  }

  function injectSidebarStyles() {
    // Check if styles already injected
    if (document.getElementById('basta-sidebar-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'basta-sidebar-styles';
    style.textContent = `
      #${SIDEBAR_ID} {
        position: fixed;
        top: 0;
        right: 0;
        width: 350px;
        height: 100vh;
        background-color: #F7F5EE;
        border-left: 2px solid #131F39;
        z-index: 999999;
        overflow-y: auto;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
        font-family: Arial, sans-serif;
      }

      #${SIDEBAR_ID} .basta-sidebar-header {
        background-color: #131F39;
        color: white;
        padding: 20px;
        text-align: center;
        font-size: 18px;
        font-weight: 600;
        border-bottom: 2px solid #131F39;
      }

      #${SIDEBAR_ID} .basta-sidebar-content {
        padding: 20px;
      }

      #${SIDEBAR_ID} .basta-sidebar-field {
        margin-bottom: 20px;
      }

      #${SIDEBAR_ID} .basta-sidebar-field:last-child {
        margin-bottom: 0;
      }

      #${SIDEBAR_ID} .basta-sidebar-label {
        font-size: 12px;
        font-weight: 600;
        color: #111928;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }

      #${SIDEBAR_ID} .basta-sidebar-value {
        font-size: 14px;
        color: #111928;
        line-height: 1.5;
        word-wrap: break-word;
      }

      #${SIDEBAR_ID} .basta-sidebar-value.basta-sidebar-description {
        max-height: 300px;
        overflow-y: auto;
        padding: 12px;
        background: #e5e7eb;
        border: 1px solid #d1d5db;
        font-size: 13px;
        border-radius: 4px;
      }

      #${SIDEBAR_ID} .basta-sidebar-empty {
        padding: 40px 20px;
        text-align: center;
        color: #111928;
        font-size: 14px;
      }

      #${SIDEBAR_ID} .basta-sidebar-loading {
        padding: 40px 20px;
        text-align: center;
        color: #111928;
        font-size: 14px;
      }

      /* Adjust body margin to prevent content overlap */
      body.basta-sidebar-active {
        margin-right: 350px;
      }
    `;
    document.head.appendChild(style);
  }

  function createSidebar() {
    // Check if user is logged in first
    chrome.storage.local.get(['authToken', 'tokenExpiration'], (result) => {
      const isLoggedIn = result.authToken && result.tokenExpiration && Date.now() < result.tokenExpiration;

      // Remove existing sidebar if user is not logged in
      const existingSidebar = document.getElementById(SIDEBAR_ID);
      if (!isLoggedIn) {
        if (existingSidebar) {
          existingSidebar.remove();
        }
        document.body.classList.remove('basta-sidebar-active');
        return; // Don't show sidebar if not logged in
      }

      // If sidebar already exists and user is logged in, just update content
      if (existingSidebar) {
        loadSidebarContent();
        return;
      }

      // Inject styles
      injectSidebarStyles();

      // Create sidebar element
      const sidebar = document.createElement('div');
      sidebar.id = SIDEBAR_ID;
      sidebar.innerHTML = `
        <div class="basta-sidebar-header">Basta Job Assistant</div>
        <div class="basta-sidebar-body">
          <div class="basta-sidebar-loading">Loading job information...</div>
        </div>
      `;

      // Add to page
      document.body.appendChild(sidebar);
      document.body.classList.add('basta-sidebar-active');

      // Load and display job info
      loadSidebarContent();
    });
  }

  function loadSidebarContent() {
    chrome.runtime.sendMessage({ action: 'getJobInfo' }, (response) => {
      const sidebar = document.getElementById(SIDEBAR_ID);
      if (!sidebar) return;

      const bodyElement = sidebar.querySelector('.basta-sidebar-body');
      if (!bodyElement) return;

      if (chrome.runtime.lastError) {
        bodyElement.innerHTML = `
          <div class="basta-sidebar-empty">
            <p>No Job information available.</p>
          </div>
        `;
        return;
      }

      // Check if response has valid job information
      if (response && (response.jobTitle || response.companyName)) {
        bodyElement.innerHTML = createSidebarHTML(response);
      } else {
        bodyElement.innerHTML = `
          <div class="basta-sidebar-empty">
            <p>No Job information available.</p>
          </div>
        `;
      }
    });
  }

  function initSidebar() {
    if (sidebarInitialized) return;
    sidebarInitialized = true;

    // Create sidebar after a short delay to ensure page is ready
    setTimeout(() => {
      createSidebar();
    }, 1000);

    // Listen for storage changes to update sidebar
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        // Handle logout - remove sidebar if authToken is removed
        if (changes.authToken && !changes.authToken.newValue) {
          const sidebar = document.getElementById(SIDEBAR_ID);
          if (sidebar) {
            sidebar.remove();
          }
          document.body.classList.remove('basta-sidebar-active');
          return;
        }

        // Handle login or job info updates
        if (changes.jobInfoByTab || changes.lastJobInfo || changes.authToken || changes.tokenExpiration) {
          // Check if sidebar exists, if not create it
          const sidebar = document.getElementById(SIDEBAR_ID);
          if (sidebar) {
            loadSidebarContent();
          } else {
            createSidebar();
          }
        }
      }
    });

    // Also listen for URL changes (for SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => {
          const sidebar = document.getElementById(SIDEBAR_ID);
          if (sidebar) {
            loadSidebarContent();
          }
        }, 2000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // Listen for messages from popup to parse current page
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'parseCurrentPage') {
      // Parse the current page immediately
      const jobData = extractJobInfo();
      sendResponse({ success: true, data: jobData });
      return true; // Indicates we will send a response asynchronously
    }
  });

  // Extract and save job info when page loads
  function init() {
    // Wait for page to fully load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          const jobData = extractJobInfo();
          saveJobInfo(jobData);
        }, 2000); // Wait 2 seconds for dynamic content
      });
    } else {
      setTimeout(() => {
        const jobData = extractJobInfo();
        saveJobInfo(jobData);
      }, 2000);
    }

    // Also listen for URL changes (LinkedIn uses SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => {
          const jobData = extractJobInfo();
          saveJobInfo(jobData);
        }, 2000);
      }
    }).observe(document, { subtree: true, childList: true });

    // Initialize sidebar
    initSidebar();
  }

  init();
})();

