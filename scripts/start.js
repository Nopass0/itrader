#!/usr/bin/env node

import inquirer from 'inquirer';
import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import shell from 'shelljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ASCII art logo
const logo = `
╭───────────────────────────────────────────────────╮
│ ✻ AI Trader Production                            │
│                                                   │
│   Start production servers with custom options    │
╰───────────────────────────────────────────────────╯
`;

console.log(chalk.cyan(logo));

// Production configuration
const prodConfig = {
  useDocker: false,
  serverPort: 3000,
  frontendPort: 3001,
  useHttps: false,
  sslCertPath: '',
  sslKeyPath: '',
};

// Check if we have built files
async function checkBuildFiles() {
  const spinner = ora('Checking build files...').start();

  try {
    // Check server build
    if (!shell.test('-d', './server/dist')) {
      spinner.warn('Server build not found. You need to build the server first.');
      const { buildServer } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'buildServer',
          message: 'Do you want to build the server now?',
          default: true,
        },
      ]);

      if (buildServer) {
        spinner.text = 'Building server...';
        shell.cd('./server');
        if (shell.exec('bun run build').code !== 0) {
          spinner.fail('Server build failed.');
          process.exit(1);
        }
        shell.cd('..');
        spinner.succeed('Server built successfully.');
      } else {
        spinner.fail('Server build required to start in production mode.');
        process.exit(1);
      }
    }

    // Check frontend build
    if (!shell.test('-d', './frontend/.next')) {
      spinner.warn('Frontend build not found. You need to build the frontend first.');
      const { buildFrontend } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'buildFrontend',
          message: 'Do you want to build the frontend now?',
          default: true,
        },
      ]);

      if (buildFrontend) {
        spinner.text = 'Building frontend...';
        shell.cd('./frontend');
        if (shell.exec('npm run build').code !== 0) {
          spinner.fail('Frontend build failed.');
          process.exit(1);
        }
        shell.cd('..');
        spinner.succeed('Frontend built successfully.');
      } else {
        spinner.fail('Frontend build required to start in production mode.');
        process.exit(1);
      }
    } else {
      spinner.succeed('Build files found.');
    }
  } catch (error) {
    spinner.fail(`Error checking build files: ${error.message}`);
    process.exit(1);
  }
}

// Prompt the user for production options
async function promptOptions() {
  const questions = [
    {
      type: 'confirm',
      name: 'useDocker',
      message: 'Do you want to use Docker?',
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
      when: (answers) => !answers.useDocker,
    },
    {
      type: 'input',
      name: 'serverPort',
      message: 'Server port:',
      default: '3000',
      validate: (value) => {
        const port = parseInt(value, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return 'Please enter a valid port number (1-65535)';
        }
        return true;
      },
      when: (answers) => !answers.useDocker && answers.startOption !== 'frontend',
    },
    {
      type: 'input',
      name: 'frontendPort',
      message: 'Frontend port:',
      default: '3001',
      validate: (value) => {
        const port = parseInt(value, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return 'Please enter a valid port number (1-65535)';
        }
        return true;
      },
      when: (answers) => !answers.useDocker && answers.startOption !== 'server',
    },
    {
      type: 'confirm',
      name: 'useHttps',
      message: 'Do you want to use HTTPS?',
      default: false,
      when: (answers) => !answers.useDocker,
    },
    {
      type: 'input',
      name: 'sslCertPath',
      message: 'Path to SSL certificate:',
      default: './ssl/cert.pem',
      when: (answers) => !answers.useDocker && answers.useHttps,
      validate: (value) => {
        if (!fs.existsSync(value)) {
          return 'Certificate file not found. Do you want to create a self-signed certificate?';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'sslKeyPath',
      message: 'Path to SSL key:',
      default: './ssl/key.pem',
      when: (answers) => !answers.useDocker && answers.useHttps && answers.sslCertPath,
      validate: (value) => {
        if (!fs.existsSync(value)) {
          return 'Key file not found. Do you want to create a self-signed certificate?';
        }
        return true;
      },
    },
    {
      type: 'confirm',
      name: 'createSelfSigned',
      message: 'Create a self-signed SSL certificate?',
      default: true,
      when: (answers) => {
        return (
          !answers.useDocker &&
          answers.useHttps &&
          (!fs.existsSync(answers.sslCertPath) || !fs.existsSync(answers.sslKeyPath))
        );
      },
    },
  ];

  return inquirer.prompt(questions);
}

// Create self-signed SSL certificate
async function createSelfSignedCert(certPath, keyPath) {
  const spinner = ora('Creating self-signed SSL certificate...').start();

  try {
    // Create directory if it doesn't exist
    const certDir = path.dirname(certPath);
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    // Generate self-signed certificate
    const command = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`;
    
    if (shell.exec(command).code !== 0) {
      spinner.fail('Failed to create self-signed certificate.');
      process.exit(1);
    }

    spinner.succeed('Self-signed SSL certificate created successfully.');
  } catch (error) {
    spinner.fail(`Error creating SSL certificate: ${error.message}`);
    process.exit(1);
  }
}

// Start using Docker
async function startWithDocker() {
  const spinner = ora('Starting with Docker...').start();

  try {
    // Check if docker-compose is installed
    if (!shell.which('docker-compose')) {
      spinner.fail('docker-compose is not installed. Please install it to use Docker.');
      process.exit(1);
    }

    // Build and start containers
    spinner.text = 'Building Docker containers...';
    if (shell.exec('docker-compose build').code !== 0) {
      spinner.fail('Docker build failed.');
      process.exit(1);
    }

    spinner.text = 'Starting Docker containers...';
    if (shell.exec('docker-compose up -d').code !== 0) {
      spinner.fail('Docker compose up failed.');
      process.exit(1);
    }

    spinner.succeed('Docker containers started successfully.');
    console.log(chalk.green('Services are running at:'));
    console.log(chalk.cyan('- Server: http://localhost:3000'));
    console.log(chalk.cyan('- Frontend: http://localhost:3001'));
    console.log(chalk.cyan('- Check logs with: npm run docker:logs'));

    // Watch logs
    const { watchLogs } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'watchLogs',
        message: 'Do you want to watch the logs?',
        default: true,
      },
    ]);

    if (watchLogs) {
      const logs = spawn('docker-compose', ['logs', '-f'], {
        stdio: 'inherit',
      });

      process.on('SIGINT', () => {
        logs.kill('SIGINT');
        console.log(chalk.yellow('\nStopped watching logs. Containers are still running.'));
        console.log(chalk.cyan('To stop containers, run: npm run docker:down'));
        process.exit(0);
      });
    } else {
      console.log(chalk.cyan('To stop containers, run: npm run docker:down'));
    }
  } catch (error) {
    spinner.fail(`Error starting Docker: ${error.message}`);
    process.exit(1);
  }
}

// Start the server
function startServer(options) {
  console.log(chalk.cyan('\nStarting server...'));

  // Set environment variables
  const env = {
    ...process.env,
    PORT: options.serverPort,
    NODE_ENV: 'production',
    USE_HTTPS: options.useHttps ? 'true' : 'false',
  };

  if (options.useHttps) {
    env.SSL_CERT_PATH = options.sslCertPath;
    env.SSL_KEY_PATH = options.sslKeyPath;
  }

  // Start the server
  const server = spawn('bun', ['run', 'start'], {
    cwd: './server',
    env,
    stdio: 'inherit',
  });

  console.log(chalk.green(`Server started on ${options.useHttps ? 'https' : 'http'}://localhost:${options.serverPort}`));

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
    PORT: options.frontendPort,
    NODE_ENV: 'production',
    NEXT_PUBLIC_API_URL: `${options.useHttps ? 'https' : 'http'}://localhost:${options.serverPort}`,
  };

  // Start the frontend
  const frontend = spawn('npm', ['run', 'start'], {
    cwd: './frontend',
    env,
    stdio: 'inherit',
  });

  console.log(chalk.green(`Frontend started on http://localhost:${options.frontendPort}`));

  frontend.on('error', (err) => {
    console.error(chalk.red(`Failed to start frontend: ${err.message}`));
    process.exit(1);
  });

  return frontend;
}

// Main function
async function main() {
  // Check build files
  await checkBuildFiles();

  // Prompt for options
  const options = await promptOptions();

  // Update config
  Object.assign(prodConfig, options);

  // Handle SSL certificate creation if needed
  if (options.useHttps && options.createSelfSigned) {
    await createSelfSignedCert(options.sslCertPath, options.sslKeyPath);
    prodConfig.sslCertPath = options.sslCertPath;
    prodConfig.sslKeyPath = options.sslKeyPath;
  }

  // Start services
  if (options.useDocker) {
    await startWithDocker();
  } else {
    const processes = [];

    if (options.startOption === 'both' || options.startOption === 'server') {
      processes.push(startServer(prodConfig));
    }

    if (options.startOption === 'both' || options.startOption === 'frontend') {
      processes.push(startFrontend(prodConfig));
    }

    // Handle process termination
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nShutting down production servers...'));
      processes.forEach((proc) => {
        proc.kill('SIGINT');
      });
      process.exit(0);
    });

    console.log(chalk.cyan('\nProduction servers are running. Press Ctrl+C to stop.\n'));
  }
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red(`\nError: ${error.message}`));
  process.exit(1);
});