#!/usr/bin/env node

import inquirer from 'inquirer';
import { exec, spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import shell from 'shelljs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ASCII art logo
const logo = `
╭───────────────────────────────────────────────────╮
│ ✻ AI Trader Development                           │
│                                                   │
│   Start development servers with custom options   │
╰───────────────────────────────────────────────────╯
`;

console.log(chalk.cyan(logo));

// Development configuration
const devConfig = {
  useMockData: false,
  serverPort: 3000,
  frontendPort: 3001,
};

// Environment variables for the server
const serverEnv = {
  PORT: devConfig.serverPort,
  NODE_ENV: 'development',
};

// Environment variables for the frontend
const frontendEnv = {
  NEXT_PUBLIC_API_URL: `http://localhost:${devConfig.serverPort}`,
  NEXT_PUBLIC_SOCKET_URL: `http://localhost:${devConfig.serverPort}`,
};

// Check if the required services are available
async function checkPrerequisites() {
  const spinner = ora('Checking prerequisites...').start();

  try {
    // Check if Bun is installed
    if (!shell.which('bun')) {
      spinner.fail('Bun is not installed. Please install Bun to run the server.');
      process.exit(1);
    }

    // Check if npm is installed
    if (!shell.which('npm')) {
      spinner.fail('npm is not installed. Please install npm to run the frontend.');
      process.exit(1);
    }

    // Check if the server directory exists
    if (!shell.test('-d', './server')) {
      spinner.fail('Server directory not found. Please ensure you\'re in the project root.');
      process.exit(1);
    }

    // Check if the frontend directory exists
    if (!shell.test('-d', './frontend')) {
      spinner.fail('Frontend directory not found. Please ensure you\'re in the project root.');
      process.exit(1);
    }

    spinner.succeed('All prerequisites are met.');
  } catch (error) {
    spinner.fail(`Error checking prerequisites: ${error.message}`);
    process.exit(1);
  }
}

// Prompt the user for development options
async function promptOptions() {
  const questions = [
    {
      type: 'confirm',
      name: 'useMockData',
      message: 'Do you want to use mock data?',
      default: false,
    },
    {
      type: 'list',
      name: 'startOption',
      message: 'What do you want to start?',
      choices: [
        { name: 'Both server and frontend', value: 'both' },
        { name: 'Server only', value: 'server' },
        { name: 'Frontend only', value: 'frontend' },
      ],
      default: 'both',
    },
    {
      type: 'input',
      name: 'serverPort',
      message: 'Server port:',
      default: '3000',
      validate: (value) => {
        const port = parseInt(value, 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
          return 'Please enter a valid port number (1024-65535)';
        }
        return true;
      },
      when: (answers) => answers.startOption !== 'frontend',
    },
    {
      type: 'input',
      name: 'frontendPort',
      message: 'Frontend port:',
      default: '3001',
      validate: (value) => {
        const port = parseInt(value, 10);
        if (isNaN(port) || port < 1024 || port > 65535) {
          return 'Please enter a valid port number (1024-65535)';
        }
        return true;
      },
      when: (answers) => answers.startOption !== 'server',
    },
    {
      type: 'confirm',
      name: 'checkDatabase',
      message: 'Do you want to check the database before starting?',
      default: true,
      when: (answers) => answers.startOption !== 'frontend',
    },
  ];

  return inquirer.prompt(questions);
}

// Check the database
async function checkDatabase() {
  const spinner = ora('Checking database...').start();

  return new Promise((resolve, reject) => {
    const dbCheck = spawn('bun', ['run', 'db:check'], {
      cwd: './server',
      stdio: 'inherit',
    });

    dbCheck.on('exit', (code) => {
      if (code === 0) {
        spinner.succeed('Database check completed successfully.');
        resolve();
      } else {
        spinner.fail('Database check failed.');
        reject(new Error('Database check failed with exit code ' + code));
      }
    });

    dbCheck.on('error', (err) => {
      spinner.fail(`Failed to start database check: ${err.message}`);
      reject(err);
    });
  });
}

// Start the server
function startServer(options) {
  console.log(chalk.cyan('\nStarting server...'));

  // Set environment variables
  const env = {
    ...process.env,
    ...serverEnv,
    PORT: options.serverPort,
    USE_MOCK_DATA: options.useMockData ? 'true' : 'false',
  };

  // Start the server
  const server = spawn('bun', ['run', 'dev'], {
    cwd: './server',
    env,
    stdio: 'inherit',
  });

  console.log(chalk.green(`Server started on port ${options.serverPort}`));

  server.on('error', (err) => {
    console.error(chalk.red(`Failed to start server: ${err.message}`));
    process.exit(1);
  });

  return server;
}

// Start the frontend
function startFrontend(options) {
  console.log(chalk.cyan('\nStarting frontend...'));

  // Set environment variables
  const env = {
    ...process.env,
    ...frontendEnv,
    NEXT_PUBLIC_API_URL: `http://localhost:${options.serverPort}`,
    PORT: options.frontendPort,
  };

  // Start the frontend
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: './frontend',
    env,
    stdio: 'inherit',
  });

  console.log(chalk.green(`Frontend started on port ${options.frontendPort}`));

  frontend.on('error', (err) => {
    console.error(chalk.red(`Failed to start frontend: ${err.message}`));
    process.exit(1);
  });

  return frontend;
}

// Main function
async function main() {
  // Check prerequisites
  await checkPrerequisites();

  // Prompt for options
  const options = await promptOptions();

  // Update config
  Object.assign(devConfig, options);

  // Check database if required
  if (options.checkDatabase && options.startOption !== 'frontend') {
    try {
      await checkDatabase();
    } catch (error) {
      console.error(chalk.red(`\nDatabase check failed: ${error.message}`));
      const { continueAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Do you want to continue anyway?',
          default: false,
        },
      ]);

      if (!continueAnyway) {
        process.exit(1);
      }
    }
  }

  // Start the processes based on user selection
  const processes = [];

  if (options.startOption === 'both' || options.startOption === 'server') {
    processes.push(startServer(devConfig));
  }

  if (options.startOption === 'both' || options.startOption === 'frontend') {
    processes.push(startFrontend(devConfig));
  }

  // Handle process termination
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\nShutting down development servers...'));
    processes.forEach((proc) => {
      proc.kill('SIGINT');
    });
    process.exit(0);
  });

  console.log(chalk.cyan('\nDevelopment servers are running. Press Ctrl+C to stop.\n'));
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red(`\nError: ${error.message}`));
  process.exit(1);
});