#!/usr/bin/env node

/**
 * Build script to replace environment variable placeholders in source files
 * Reads .env file and replaces {{AOI_HACKATHON_API_TOKEN}} with actual token value
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    log('Error: .env file not found!', 'red');
    log('Please copy .env.example to .env and add your API token.', 'yellow');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach((line, index) => {
    line = line.trim();
    // Skip comments and empty lines
    if (line && !line.startsWith('#')) {
      const equalIndex = line.indexOf('=');
      if (equalIndex > 0) {
        const key = line.substring(0, equalIndex).trim();
        const value = line.substring(equalIndex + 1).trim();
        if (key && value) {
          // Remove surrounding quotes if present
          let cleanValue = value;
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            cleanValue = value.slice(1, -1);
          }
          envVars[key] = cleanValue;
        }
      }
    }
  });

  // Debug: log loaded env vars (without showing values)
  log(`Loaded ${Object.keys(envVars).length} environment variable(s)`, 'green');
  Object.keys(envVars).forEach(key => {
    if (key === 'AOI_HACKATHON_API_TOKEN') {
      log(`  ${key}: ${envVars[key] ? '***' + envVars[key].substring(Math.max(0, envVars[key].length - 4)) : 'NOT SET'}`, 'green');
    } else {
      log(`  ${key}: ${envVars[key] ? 'SET' : 'NOT SET'}`, 'green');
    }
  });

  return envVars;
}

function replacePlaceholders(filePath, envVars) {
  if (!fs.existsSync(filePath)) {
    log(`Warning: File not found: ${filePath}`, 'yellow');
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const placeholderCount = (content.match(/\{\{AOI_HACKATHON_API_TOKEN\}\}/g) || []).length;

  // Replace {{AOI_HACKATHON_API_TOKEN}} with actual token
  if (placeholderCount > 0) {
    log(`Found ${placeholderCount} placeholder(s) in ${path.basename(filePath)}`, 'green');
    
    if (!envVars.AOI_HACKATHON_API_TOKEN) {
      log(`Error: AOI_HACKATHON_API_TOKEN not found in .env file!`, 'red');
      log(`Available env vars: ${Object.keys(envVars).join(', ')}`, 'yellow');
      return false;
    }

    if (envVars.AOI_HACKATHON_API_TOKEN === 'your_api_token_here') {
      log(`Error: Please set a valid API token in .env file!`, 'red');
      return false;
    }

    // Remove quotes if present (handles cases like AOI_HACKATHON_API_TOKEN="token" or AOI_HACKATHON_API_TOKEN='token')
    let tokenValue = envVars.AOI_HACKATHON_API_TOKEN;
    if ((tokenValue.startsWith('"') && tokenValue.endsWith('"')) || 
        (tokenValue.startsWith("'") && tokenValue.endsWith("'"))) {
      tokenValue = tokenValue.slice(1, -1);
    }

    content = content.replace(/\{\{AOI_HACKATHON_API_TOKEN\}\}/g, tokenValue);
    modified = true;
    log(`Replaced ${placeholderCount} placeholder(s) with token`, 'green');
  } else {
    log(`No placeholders found in ${path.basename(filePath)}`, 'yellow');
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    log(`✓ Updated: ${filePath}`, 'green');
    return true;
  }

  return false;
}

function main() {
  log('Building extension with environment variables...', 'green');
  log('');

  // Load environment variables
  const envVars = loadEnvFile();

  // Files that may contain placeholders
  const filesToProcess = [
    path.join(__dirname, 'background', 'background.js'),
  ];

  let updatedCount = 0;
  filesToProcess.forEach(filePath => {
    if (replacePlaceholders(filePath, envVars)) {
      updatedCount++;
    }
  });

  log('');
  if (updatedCount > 0) {
    log(`✓ Build complete! Updated ${updatedCount} file(s).`, 'green');
  } else {
    log('No files were updated.', 'yellow');
  }
}

// Run the build script
main();

