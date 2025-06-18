# Itrader PowerShell Starter
# Run with: powershell -ExecutionPolicy Bypass -File start.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Itrader - P2P Trading Automation" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Select startup option:" -ForegroundColor Yellow
Write-Host "1) CLI - Manage accounts and settings" -ForegroundColor Green
Write-Host "2) Run - Start automation" -ForegroundColor Green
Write-Host "3) Setup - First time setup" -ForegroundColor Green
Write-Host "4) Exit" -ForegroundColor Red
Write-Host ""

$choice = Read-Host "Enter your choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host "Starting CLI..." -ForegroundColor Yellow
        bun run src/app.ts --cli
    }
    "2" {
        Write-Host "Starting automation..." -ForegroundColor Yellow
        bun run src/app.ts
    }
    "3" {
        Write-Host "Running first time setup..." -ForegroundColor Yellow
        
        # Check if bun is installed
        try {
            bun --version | Out-Null
        } catch {
            Write-Host "Bun is not installed!" -ForegroundColor Red
            Write-Host "Please install Bun from https://bun.sh" -ForegroundColor Yellow
            Read-Host "Press Enter to exit"
            exit
        }
        
        # Install dependencies
        Write-Host "Installing dependencies..." -ForegroundColor Green
        bun install
        
        # Generate Prisma client
        Write-Host "Setting up database..." -ForegroundColor Green
        bunx prisma generate
        bunx prisma db push
        
        # Create directories
        Write-Host "Creating directories..." -ForegroundColor Green
        New-Item -ItemType Directory -Force -Path "data\cookies" | Out-Null
        New-Item -ItemType Directory -Force -Path "data\temp" | Out-Null
        
        Write-Host ""
        Write-Host "Setup completed!" -ForegroundColor Green
        Write-Host "Now run the CLI to configure accounts." -ForegroundColor Yellow
        Read-Host "Press Enter to continue"
        
        # Start CLI
        bun run src/app.ts --cli
    }
    "4" {
        Write-Host "Exiting..." -ForegroundColor Red
        exit
    }
    default {
        Write-Host "Invalid choice. Exiting..." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit
    }
}

# Keep window open if there's an error
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "An error occurred. Check the output above." -ForegroundColor Red
    Read-Host "Press Enter to exit"
}