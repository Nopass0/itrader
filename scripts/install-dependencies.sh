#!/bin/bash

# Install system dependencies required for the project

echo "Installing system dependencies..."

# Check if we're running as root or have sudo access
if [ "$EUID" -eq 0 ]; then 
    # Running as root
    apt-get update
    apt-get install -y poppler-utils
else
    # Try with sudo
    if command -v sudo &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y poppler-utils
    else
        echo "Error: Need root access or sudo to install dependencies"
        echo "Please run as root: apt-get install poppler-utils"
        exit 1
    fi
fi

echo "Dependencies installed successfully!"
echo "pdftotext is now available for PDF processing"