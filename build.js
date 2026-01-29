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
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    // Skip comments and empty lines
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
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

  // Replace {{AOI_HACKATHON_API_TOKEN}} with actual token
  if (content.includes('{{AOI_HACKATHON_API_TOKEN}}')) {
    if (!envVars.AOI_HACKATHON_API_TOKEN) {
      log(`Error: AOI_HACKATHON_API_TOKEN not found in .env file!`, 'red');
      return false;
    }

    if (envVars.AOI_HACKATHON_API_TOKEN === 'your_api_token_here') {
      log(`Error: Please set a valid API token in .env file!`, 'red');
      return false;
    }

    content = content.replace(/\{\{AOI_HACKATHON_API_TOKEN\}\}/g, envVars.AOI_HACKATHON_API_TOKEN);
    modified = true;
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
  log(`✓ Loaded environment variables from .env`, 'green');

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

