#!/usr/bin/env node

/**
 * iTrader API Server Test Script
 * 
 * This script tests the backend server functionality including:
 * - Server startup
 * - Route accessibility
 * - API endpoint responses
 * - Error handling
 */

const http = require('node:http');
const { exec, spawn } = require('node:child_process');
const path = require('node:path');
const { setTimeout } = require('node:timers/promises');

// Configuration
const config = {
  serverUrl: 'http://localhost',
  port: process.env.PORT || 3000,
  timeout: 10000, // 10 seconds
  startCommand: 'bun run src/index.ts',
  routesToTest: [
    { path: '/', method: 'GET', expectedStatus: 200 },
    { path: '/health', method: 'GET', expectedStatus: 200 },
    { path: '/swagger', method: 'GET', expectedStatus: 200 },
    { path: '/auth/login', method: 'OPTIONS', expectedStatus: 204 },
    { path: '/auth/register', method: 'OPTIONS', expectedStatus: 204 },
    // Add more routes as needed
  ]
};

// Console styling
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

// Test results
const results = {
  serverStart: false,
  routeTests: [],
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
};

/**
 * Print formatted message to console
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  let prefix = '';
  
  switch (type) {
    case 'success':
      prefix = `${colors.green}✓ SUCCESS${colors.reset}`;
      break;
    case 'error':
      prefix = `${colors.red}✗ ERROR${colors.reset}`;
      break;
    case 'warning':
      prefix = `${colors.yellow}⚠ WARNING${colors.reset}`;
      break;
    case 'info':
    default:
      prefix = `${colors.blue}ℹ INFO${colors.reset}`;
      break;
  }
  
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

/**
 * Print test header
 */
function printHeader(title) {
  console.log('\n' + colors.bold + colors.cyan + '╭───────────────────────────────────────────────────╮');
  console.log('│ ' + title.padEnd(51) + '│');
  console.log('╰───────────────────────────────────────────────────╯' + colors.reset + '\n');
}

/**
 * Print test summary
 */
function printSummary() {
  console.log('\n' + colors.bold + '╭───────────────────────────────────────────────────╮');
  console.log('│ TEST SUMMARY                                      │');
  console.log('├───────────────────────────────────────────────────┤');
  
  if (results.serverStart) {
    console.log('│ ' + colors.green + '✓ Server started successfully' + colors.reset + ' '.repeat(25) + '│');
  } else {
    console.log('│ ' + colors.red + '✗ Server failed to start' + colors.reset + ' '.repeat(29) + '│');
  }
  
  console.log('│                                                   │');
  console.log(`│ Total route tests: ${results.totalTests.toString().padEnd(32)}│`);
  console.log(`│ ${colors.green}Passed: ${results.passedTests}${colors.reset}${' '.repeat(41)}│`);
  console.log(`│ ${colors.red}Failed: ${results.failedTests}${colors.reset}${' '.repeat(41)}│`);
  
  const passRate = results.totalTests > 0 
    ? Math.round((results.passedTests / results.totalTests) * 100) 
    : 0;
  
  let statusMessage;
  let statusColor;
  
  if (passRate === 100) {
    statusMessage = 'ALL TESTS PASSED';
    statusColor = colors.green;
  } else if (passRate >= 80) {
    statusMessage = 'MOST TESTS PASSED';
    statusColor = colors.yellow;
  } else {
    statusMessage = 'TESTS FAILED';
    statusColor = colors.red;
  }
  
  console.log('│                                                   │');
  console.log(`│ ${statusColor}${statusMessage}${colors.reset}${' '.repeat(51 - statusMessage.length)}│`);
  console.log('╰───────────────────────────────────────────────────╯\n');
}

/**
 * Check if server is already running
 */
async function isServerRunning() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: config.port,
      path: '/health',
      method: 'GET',
      timeout: 2000,
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Start the server
 */
async function startServer() {
  log(`Starting server with command: ${config.startCommand}`);
  
  return new Promise((resolve) => {
    const serverProcess = spawn('bun', ['run', 'src/index.ts'], {
      cwd: path.resolve(process.cwd()),
      stdio: 'pipe',
      detached: true,
    });
    
    let output = '';
    let errorOutput = '';
    let isStarted = false;
    
    // Handle stdout
    serverProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      
      // Check for server started message
      if (chunk.includes('Server running at') && !isStarted) {
        isStarted = true;
        log('Server successfully started', 'success');
        resolve(true);
      }
    });
    
    // Handle stderr
    serverProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Handle process exit
    serverProcess.on('exit', (code) => {
      if (code !== 0 && !isStarted) {
        log(`Server process exited with code ${code}`, 'error');
        log(`Error output: ${errorOutput}`, 'error');
        resolve(false);
      }
    });
    
    // Set timeout for server start
    setTimeout(config.timeout).then(() => {
      if (!isStarted) {
        serverProcess.kill();
        log(`Server failed to start within ${config.timeout / 1000} seconds`, 'error');
        log(`Output: ${output}`, 'info');
        log(`Error output: ${errorOutput}`, 'error');
        resolve(false);
      }
    });
    
    // Clean up the server process on script exit
    process.on('exit', () => {
      try {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill();
        }
      } catch (e) {
        // Ignore errors on cleanup
      }
    });
  });
}

/**
 * Test a specific route
 */
async function testRoute(route) {
  const { path, method, expectedStatus } = route;
  const url = `${config.serverUrl}:${config.port}${path}`;
  
  log(`Testing ${method} ${url}`);
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: config.port,
      path: path,
      method: method,
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
      },
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const status = res.statusCode;
        const passed = status === expectedStatus;
        let responseBody = '';
        
        try {
          if (data && data.length > 0) {
            responseBody = JSON.stringify(JSON.parse(data), null, 2);
          }
        } catch (e) {
          responseBody = data;
        }
        
        const result = {
          path,
          method,
          expectedStatus,
          actualStatus: status,
          passed,
          response: responseBody
        };
        
        if (passed) {
          log(`${method} ${path} - ${status} - ${colors.green}PASS${colors.reset}`, 'success');
        } else {
          log(`${method} ${path} - ${status} (expected ${expectedStatus}) - ${colors.red}FAIL${colors.reset}`, 'error');
          if (responseBody) {
            log(`Response: ${responseBody}`, 'info');
          }
        }
        
        resolve(result);
      });
    });
    
    req.on('error', (error) => {
      log(`Request error for ${method} ${path}: ${error.message}`, 'error');
      
      const result = {
        path,
        method,
        expectedStatus,
        actualStatus: 'Error',
        passed: false,
        error: error.message
      };
      
      resolve(result);
    });
    
    req.on('timeout', () => {
      req.destroy();
      log(`Request timeout for ${method} ${path}`, 'error');
      
      const result = {
        path,
        method,
        expectedStatus,
        actualStatus: 'Timeout',
        passed: false,
        error: 'Request timed out'
      };
      
      resolve(result);
    });
    
    req.end();
  });
}

/**
 * Run all tests
 */
async function runTests() {
  printHeader('🤖 iTrader API Server Test');
  
  // Check if server is already running
  log('Checking if server is already running...');
  const isRunning = await isServerRunning();
  
  // Start server if not running
  if (!isRunning) {
    log('Server is not running, attempting to start it...');
    results.serverStart = await startServer();
    
    if (!results.serverStart) {
      log('Failed to start server, aborting tests', 'error');
      printSummary();
      process.exit(1);
    }
  } else {
    log('Server is already running', 'success');
    results.serverStart = true;
  }
  
  // Wait a bit for the server to fully initialize
  log('Waiting for server to initialize...');
  await setTimeout(2000);
  
  // Test routes
  log(`Testing ${config.routesToTest.length} routes...`);
  
  for (const route of config.routesToTest) {
    const result = await testRoute(route);
    results.routeTests.push(result);
    results.totalTests++;
    
    if (result.passed) {
      results.passedTests++;
    } else {
      results.failedTests++;
    }
  }
  
  // Print summary
  printSummary();
  
  // Exit with appropriate code
  if (results.failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Start tests
runTests().catch((error) => {
  log(`Unhandled error: ${error.message}`, 'error');
  process.exit(1);
});