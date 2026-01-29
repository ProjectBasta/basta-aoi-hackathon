# Basta Job Assistant - Chrome Extension

A Chrome extension that collects job information from multiple job board sites including LinkedIn, ZipRecruiter, Indeed, and Handshake. Features user authentication, tab-specific job tracking, and automatic job information extraction.

## Features

- **Multi-Platform Job Collection**: Automatically extracts job information from:
  - **LinkedIn**: Job posting pages
  - **ZipRecruiter**: Job detail pages
  - **Indeed**: Job listing pages
  - **Handshake**: Job posting pages
- **Extracted Information**: 
  - Job Title
  - Company Name
  - Job Description
  - Location (when available)
  - Compensation (when available)
- **User Authentication**: Secure login/logout functionality with API integration
- **Tab-Specific Tracking**: Each tab maintains its own job information independently
- **Visual Badge Indicators**: 
  - Grey badge (default): No job information collected
  - Green badge with ✓: Job information successfully parsed
  - Red badge with !: User not logged in
- **Automatic Parsing**: Automatically collects job information when switching tabs or navigating to job pages
- **Clean Popup Interface**: Modern UI with sharp corners and organized job information display

## Installation

1. **Download or Clone** this repository to your local machine

2. **Set up Environment Variables**:
   - Copy `.env.example` to `.env`: `cp .env.example .env`
   - Open `.env` and replace `your_api_token_here` with your actual API token for `AOI_HACKATHON_API_TOKEN`
   - **Important**: Never commit the `.env` file to version control (it's already in `.gitignore`)

3. **Build the Extension**:
   - Run the build script to inject the API token into the source code:
     ```bash
     npm run build
     ```
   - Or directly: `node build.js`
   - This will replace the placeholder `{{AOI_HACKATHON_API_TOKEN}}` in the code with your actual token

4. **Open Chrome Extensions Page**:
   - Navigate to `chrome://extensions/` in your Chrome browser
   - Or go to Chrome Menu → More Tools → Extensions

5. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top right corner

6. **Load the Extension**:
   - Click "Load unpacked"
   - Select the folder containing this extension (the folder with `manifest.json`)

7. **Add Extension Icons** (Optional):
   - The extension requires icon files at `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png`
   - You can create simple icons or use placeholder images
   - If icons are missing, the extension will still work but may show default Chrome icons

8. **Pin the Extension** (Recommended):
   - Click the puzzle piece icon (🧩) in the Chrome toolbar to open the extensions menu
   - Find "Basta Job Assistant" in the list
   - Click the pin icon (📌) next to the extension name
   - The extension icon will now always be visible in your Chrome toolbar
   - **Note**: Chrome extensions cannot programmatically pin themselves; this must be done manually by the user

## Usage

### First Time Setup

1. **Login**: 
   - Click the extension icon in your Chrome toolbar
   - Enter your username and password in the login form
   - Click "Login" to authenticate
   - Your first name will appear in the top right of the header when logged in

2. **Pin the Extension** (Recommended):
   - Click the puzzle piece icon (🧩) in the Chrome toolbar
   - Find "Basta Job Assistant" and click the pin icon (📌)
   - The extension icon will now always be visible in your toolbar

### Collecting Job Information

The extension automatically collects job information when you visit job posting pages on supported sites:

1. **LinkedIn**: Visit any LinkedIn job posting page (e.g., `https://www.linkedin.com/jobs/view/1234567890`)
2. **ZipRecruiter**: Visit any ZipRecruiter job detail page (e.g., `https://www.ziprecruiter.com/jobs/...`)
3. **Indeed**: Visit any Indeed job listing page (e.g., `https://www.indeed.com/viewjob?jk=...`)
4. **Handshake**: Visit any Handshake job posting page (e.g., `https://app.joinhandshake.com/jobs/...`)

The extension will automatically:
- Detect which job board site you're on
- Extract job information (title, company, description, location, compensation)
- Save the information for the current tab
- Update the badge icon (green ✓ when information is collected)

**Note**: Job information is collected automatically when:
- You navigate to a job posting page
- You switch to a tab with a job posting page
- The page finishes loading

### Viewing Collected Information

1. Click the extension icon in your Chrome toolbar
2. If you're logged in, the popup will display:
   - Job Title
   - Company Name
   - Job Description
   - Location (if available)
   - Compensation (if available)
3. If no job information is available for the current tab, you'll see "No Job information available."
4. Each tab maintains its own job information independently

### Logout

- Click the "Logout" button next to your name in the top right of the header
- You'll be returned to the login screen

## File Structure

```
├── manifest.json              # Extension manifest (Manifest V3)
├── package.json               # Node.js package file with build scripts
├── build.js                   # Build script to inject environment variables
├── .env.example               # Example environment file (copy to .env)
├── .env                        # Environment variables (not committed, add your token here)
├── .gitignore                  # Git ignore file (includes .env)
├── content/
│   └── process.js           # Content script for multiple job board sites
├── background/
│   └── background.js         # Service worker for message handling and storage
├── popup/
│   ├── popup.html            # Popup UI HTML
│   ├── popup.css             # Popup styling
│   └── popup.js              # Popup functionality
├── icons/
│   ├── icon16.png            # 16x16 icon (required)
│   ├── icon48.png            # 48x48 icon (required)
│   └── icon128.png           # 128x128 icon (required)
└── README.md                 # This file
```

## How It Works

1. **Job Board Content Script** (`content/process.js`):
   - Runs on multiple job board sites (LinkedIn, ZipRecruiter, Indeed, Handshake)
   - Automatically detects which site you're on using the page's hostname
   - Uses site-specific CSS selectors to extract job information:
     - Job Title
     - Company Name
     - Job Description
     - Location (when available)
     - Compensation (when available)
   - Handles dynamic UI changes and SPA navigation using MutationObserver
   - Sends extracted data to the background service worker for tab-specific storage

2. **Background Service Worker** (`background/background.js`):
   - Handles message passing between content scripts and popup
   - Manages storage using Chrome's `chrome.storage.local` API
   - Stores job information per tab (`jobInfoByTab`)
   - Monitors tab changes and automatically triggers parsing for supported job boards
   - Manages badge states (grey/green/red) based on login status and job information availability
   - Cleans up job information when tabs are closed

3. **Popup UI** (`popup/`):
   - **Login Screen**: Authenticates users with the API endpoint
   - **Job Info Screen**: Displays saved job information for the current active tab
   - Shows user's first name in the header when logged in
   - Provides logout functionality
   - Automatically updates when job information changes for the current tab

## Permissions

The extension requires the following permissions:
- `storage`: To save and retrieve job information and user authentication tokens
- `activeTab`: To access the current tab's content
- `tabs`: To monitor tab changes and manage tab-specific job information
- Host permissions for:
  - `linkedin.com`: LinkedIn job pages
  - `ziprecruiter.com`: ZipRecruiter job pages
  - `indeed.com`: Indeed job pages
  - `joinhandshake.com`: Handshake job pages
  - `staging-seekr-adaptive-api.projectbasta.com`: Authentication API endpoint

## Troubleshooting

### Login Issues
- Make sure you're using the correct username and password
- Check your internet connection
- Verify the API endpoint is accessible
- Check the browser console for any error messages (F12 → Console)
- If your token expires, you'll need to log in again

### Job information not being collected
- **Make sure you're logged in**: The extension requires authentication to collect job information
- **Check the badge**: 
  - Red badge with "!" means you're not logged in
  - Grey badge means no job information has been collected for this tab
  - Green badge with "✓" means job information was successfully collected
- **Verify you're on a supported job board page**:
  - LinkedIn: URL contains `/jobs/view/` or `/jobs/`
  - ZipRecruiter: URL contains `/jobs/`
  - Indeed: URL contains `/viewjob` or `/jobs`
  - Handshake: URL contains `/jobs/`
- **Wait for page to load**: Dynamic content may take a few seconds to appear
- **Check the current tab**: Each tab maintains its own job information. Make sure you're viewing the correct tab
- **Try refreshing the page**: Some job boards use dynamic loading
- **Check browser console**: Open Developer Tools (F12) → Console tab for any errors

### Badge not updating
- Make sure you're logged in (badge should be red if not logged in)
- Switch to the tab with the job posting page
- Wait a few seconds for the page to fully load
- The badge is tab-specific, so each tab will show its own status

### Extension not loading
- Make sure Developer Mode is enabled in `chrome://extensions/`
- Check that all files are in the correct locations
- Verify `manifest.json` is valid JSON
- Try reloading the extension (click the refresh icon on the extension card)

## Development

### Building the Extension

Before loading the extension in Chrome, you must build it to inject the API token:

1. **Set up your environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your API token
   ```

2. **Run the build script**:
   ```bash
   npm run build
   # or
   node build.js
   ```

3. **Load/Reload the extension**:
   - Go to `chrome://extensions/`
   - Click the refresh icon on the extension card
   - Test your changes

**Note**: You must run the build script every time you change the API token in `.env` or after pulling changes that modify `background.js`.

### Making Changes

1. Make changes to the relevant files
2. If you modified `background.js` or changed the API token, run `npm run build`
3. Go to `chrome://extensions/`
4. Click the refresh icon on the extension card
5. Test your changes

## Notes

- **Tab-Specific Storage**: Each tab maintains its own job information independently. Switching tabs will show the job information for that specific tab.
- **Authentication**: User credentials and tokens are stored locally using Chrome's storage API. Tokens expire based on the API response.
- **Privacy**: The extension respects user privacy and only stores data locally. No job information is sent to external servers except for authentication.
- **Dynamic Content**: Job board UIs change frequently, so selectors may need updates if sites change their HTML structure.
- **Supported Sites**: LinkedIn, ZipRecruiter, Indeed, and Handshake
- **Badge Indicators**: 
  - The extension badge provides visual feedback about the current state
  - Badge status is tab-specific and updates automatically
- **Location and Compensation**: These fields are only displayed when available on the job posting page

## License

This project is provided as-is for educational and personal use.

