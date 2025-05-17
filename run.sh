#!/bin/bash

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project paths
PROJECT_ROOT=$(pwd)
SERVER_DIR="$PROJECT_ROOT/server"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
DOCS_DIR="$PROJECT_ROOT/docs"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE_FILE="$PROJECT_ROOT/.env.example"

# Logo and welcome message
show_logo() {
  clear
  echo -e "${CYAN}"
  echo -e "╭───────────────────────────────────────────────────╮"
  echo -e "│ ✻ AI Trader                                       │"
  echo -e "│                                                   │"
  echo -e "│   Trading Platform for Gate.cx and Bybit          │"
  echo -e "╰───────────────────────────────────────────────────╯"
  echo -e "${NC}"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check requirements
check_requirements() {
  echo -e "${BLUE}Checking requirements...${NC}"
  
  local all_requirements_met=true
  
  # Check if Node.js is installed
  if ! command_exists node; then
    echo -e "${RED}✗ Node.js is not installed. Please install Node.js 18 or later.${NC}"
    all_requirements_met=false
  else
    local node_version=$(node -v | cut -d "v" -f 2 | cut -d "." -f 1)
    if [[ $node_version -lt 18 ]]; then
      echo -e "${RED}✗ Node.js version is too old. Please install Node.js 18 or later.${NC}"
      all_requirements_met=false
    else
      echo -e "${GREEN}✓ Node.js is installed ($(node -v))${NC}"
    fi
  fi
  
  # Check if npm is installed
  if ! command_exists npm; then
    echo -e "${RED}✗ npm is not installed. Please install npm.${NC}"
    all_requirements_met=false
  else
    echo -e "${GREEN}✓ npm is installed ($(npm -v))${NC}"
  fi
  
  # Check if Bun is installed
  if ! command_exists bun; then
    echo -e "${YELLOW}⚠ Bun is not installed. It is required for the server.${NC}"
    echo -e "${YELLOW}  You can install it with: curl -fsSL https://bun.sh/install | bash${NC}"
    all_requirements_met=false
  else
    echo -e "${GREEN}✓ Bun is installed ($(bun -v))${NC}"
  fi
  
  # Check if PostgreSQL is installed (for development mode)
  if ! command_exists psql; then
    echo -e "${YELLOW}⚠ PostgreSQL is not installed. It is required for development mode.${NC}"
    all_requirements_met=false
  else
    echo -e "${GREEN}✓ PostgreSQL is installed${NC}"
  fi
  
  if [[ "$all_requirements_met" == "false" ]]; then
    echo -e "${YELLOW}Some requirements are not met. Please install them and try again.${NC}"
    echo -e "${YELLOW}Do you want to continue anyway? (y/n)${NC}"
    read -r continue_anyway
    if [[ "$continue_anyway" != "y" ]]; then
      exit 1
    fi
  fi
}

# Check and initialize environment variables
check_env() {
  echo -e "${BLUE}Checking environment variables...${NC}"
  
  # Check if .env file exists
  if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${YELLOW}⚠ .env file not found.${NC}"
    
    # Check if .env.example file exists
    if [[ -f "$ENV_EXAMPLE_FILE" ]]; then
      echo -e "${BLUE}Creating .env file from .env.example...${NC}"
      cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
      echo -e "${GREEN}✓ .env file created. Please review and update the variables.${NC}"
      
      # Ask user to edit the file
      echo -e "${YELLOW}Do you want to edit the .env file now? (y/n)${NC}"
      read -r edit_env
      if [[ "$edit_env" == "y" ]]; then
        ${EDITOR:-nano} "$ENV_FILE"
      fi
    else
      echo -e "${RED}✗ .env.example file not found. Cannot create .env file.${NC}"
      return 1
    fi
  fi
  
  # Parse the .env file to check for required variables
  echo -e "${BLUE}Validating environment variables...${NC}"
  
  local required_vars=(
    "NODE_ENV"
    "SERVER_PORT"
    "JWT_SECRET"
    "DATABASE_URL"
    "NEXT_PUBLIC_API_URL"
  )
  
  local missing_vars=()
  
  for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" "$ENV_FILE"; then
      missing_vars+=("$var")
    fi
  done
  
  if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo -e "${RED}✗ Missing required environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
      echo -e "${RED}  - $var${NC}"
    done
    
    echo -e "${YELLOW}Please add these variables to the .env file.${NC}"
    echo -e "${YELLOW}Do you want to edit the .env file now? (y/n)${NC}"
    read -r edit_env
    if [[ "$edit_env" == "y" ]]; then
      ${EDITOR:-nano} "$ENV_FILE"
    else
      return 1
    fi
  else
    echo -e "${GREEN}✓ All required environment variables are set.${NC}"
  fi
  
  # Copy .env to server and frontend directories
  echo -e "${BLUE}Copying .env file to server and frontend directories...${NC}"
  
  if [[ -d "$SERVER_DIR" ]]; then
    cp "$ENV_FILE" "$SERVER_DIR/.env"
    echo -e "${GREEN}✓ .env copied to server directory${NC}"
  fi
  
  if [[ -d "$FRONTEND_DIR" ]]; then
    cp "$ENV_FILE" "$FRONTEND_DIR/.env"
    echo -e "${GREEN}✓ .env copied to frontend directory${NC}"
  fi
  
  return 0
}

# Create necessary directories
create_directories() {
  echo -e "${BLUE}Creating necessary directories...${NC}"
  
  # Create docs directory if it doesn't exist
  if [[ ! -d "$DOCS_DIR" ]]; then
    mkdir -p "$DOCS_DIR"
    echo -e "${GREEN}✓ Created docs directory${NC}"
  fi
  
  # Create docs subdirectories
  mkdir -p "$DOCS_DIR/server"
  mkdir -p "$DOCS_DIR/frontend"
  mkdir -p "$DOCS_DIR/api"
  
  echo -e "${GREEN}✓ Directory structure ready${NC}"
}

# Install server dependencies
install_server_deps() {
  echo -e "${BLUE}Installing server dependencies...${NC}"
  
  if [[ ! -d "$SERVER_DIR" ]]; then
    echo -e "${RED}✗ Server directory not found!${NC}"
    return 1
  fi
  
  # Copy .env to server directory
  cp "$ENV_FILE" "$SERVER_DIR/.env"
  
  cd "$SERVER_DIR"
  
  if command_exists bun; then
    bun install
    echo -e "${GREEN}✓ Server dependencies installed${NC}"
  else
    echo -e "${RED}✗ Bun is required to install server dependencies!${NC}"
    return 1
  fi
  
  cd "$PROJECT_ROOT"
}

# Install frontend dependencies
install_frontend_deps() {
  echo -e "${BLUE}Installing frontend dependencies...${NC}"
  
  if [[ ! -d "$FRONTEND_DIR" ]]; then
    echo -e "${RED}✗ Frontend directory not found!${NC}"
    return 1
  fi
  
  # Copy .env to frontend directory
  cp "$ENV_FILE" "$FRONTEND_DIR/.env"
  
  cd "$FRONTEND_DIR"
  
  if command_exists npm; then
    npm install
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
  else
    echo -e "${RED}✗ npm is required to install frontend dependencies!${NC}"
    return 1
  fi
  
  cd "$PROJECT_ROOT"
}

# Extract database parameters from DATABASE_URL
extract_db_params() {
  local db_url=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
  
  # Parse the URL to extract components
  if [[ $db_url =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASSWORD="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
    
    # Remove any query parameters from DB_NAME
    DB_NAME=$(echo "$DB_NAME" | cut -d'?' -f1)
    
    return 0
  else
    return 1
  fi
}

# Ensure database exists
ensure_database_exists() {
  echo -e "${BLUE}Ensuring database exists...${NC}"
  
  # Extract database parameters
  if ! extract_db_params; then
    echo -e "${RED}✗ Failed to parse DATABASE_URL from .env file${NC}"
    return 1
  fi
  
  echo -e "${BLUE}Checking if database '$DB_NAME' exists...${NC}"
  
  # Check if database exists
  if command_exists psql; then
    # Try to connect to the database with PSQL
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; then
      echo -e "${GREEN}✓ Database '$DB_NAME' exists.${NC}"
    else
      echo -e "${YELLOW}! Database '$DB_NAME' does not exist. Creating it...${NC}"
      
      # Create the database
      if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE \"$DB_NAME\";" 2>/dev/null; then
        echo -e "${GREEN}✓ Database '$DB_NAME' created successfully.${NC}"
      else
        echo -e "${RED}✗ Failed to create database '$DB_NAME'. Make sure your PostgreSQL credentials are correct.${NC}"
        return 1
      fi
    fi
  else
    echo -e "${YELLOW}! psql command not found. Skipping database check.${NC}"
    echo -e "${YELLOW}! The database check script will try to create the database if needed.${NC}"
  fi
  
  return 0
}

# Check database
check_database() {
  echo -e "${BLUE}Checking database...${NC}"
  
  # First ensure the database exists
  ensure_database_exists
  
  if [[ ! -d "$SERVER_DIR" ]]; then
    echo -e "${RED}✗ Server directory not found!${NC}"
    return 1
  fi
  
  cd "$SERVER_DIR"
  
  if command_exists bun; then
    bun run db:check
    local db_check_status=$?
    if [[ $db_check_status -eq 0 ]]; then
      echo -e "${GREEN}✓ Database check completed successfully${NC}"
    else
      echo -e "${RED}✗ Database check failed!${NC}"
      return 1
    fi
  else
    echo -e "${RED}✗ Bun is required to check the database!${NC}"
    return 1
  fi
  
  cd "$PROJECT_ROOT"
}

# Start server in development mode
start_server_dev() {
  echo -e "${BLUE}Starting server in development mode...${NC}"
  
  if [[ ! -d "$SERVER_DIR" ]]; then
    echo -e "${RED}✗ Server directory not found!${NC}"
    return 1
  fi
  
  # Copy .env to server directory
  cp "$ENV_FILE" "$SERVER_DIR/.env"
  
  cd "$SERVER_DIR"
  
  if command_exists bun; then
    bun run dev
  else
    echo -e "${RED}✗ Bun is required to start the server!${NC}"
    return 1
  fi
  
  cd "$PROJECT_ROOT"
}

# Start frontend in development mode
start_frontend_dev() {
  echo -e "${BLUE}Starting frontend in development mode...${NC}"
  
  if [[ ! -d "$FRONTEND_DIR" ]]; then
    echo -e "${RED}✗ Frontend directory not found!${NC}"
    return 1
  fi
  
  # Copy .env to frontend directory
  cp "$ENV_FILE" "$FRONTEND_DIR/.env"
  
  cd "$FRONTEND_DIR"
  
  if command_exists npm; then
    npm run dev
  else
    echo -e "${RED}✗ npm is required to start the frontend!${NC}"
    return 1
  fi
  
  cd "$PROJECT_ROOT"
}

# Start both server and frontend in development mode
start_dev() {
  echo -e "${BLUE}Starting development environment...${NC}"
  
  if [[ ! -d "$SERVER_DIR" || ! -d "$FRONTEND_DIR" ]]; then
    echo -e "${RED}✗ Server or frontend directory not found!${NC}"
    return 1
  fi
  
  # Copy .env to both directories
  cp "$ENV_FILE" "$SERVER_DIR/.env"
  cp "$ENV_FILE" "$FRONTEND_DIR/.env"
  
  # Use the development script
  node scripts/dev.js
}

# Run tests
run_tests() {
  local use_mock=false

  if [[ "$1" == "--mock" ]]; then
    use_mock=true
    echo -e "${BLUE}Running tests with mock data...${NC}"
  else
    echo -e "${BLUE}Running tests with real data...${NC}"

    # Check database before running tests
    echo -e "${BLUE}Checking database for tests...${NC}"

    # Extract database parameters
    if extract_db_params; then
      local TEST_DB_NAME="${DB_NAME}_test"
      echo -e "${BLUE}Using test database: $TEST_DB_NAME${NC}"

      # Check if test database exists
      if command_exists psql; then
        if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -c '\q' 2>/dev/null; then
          echo -e "${YELLOW}! Test database '$TEST_DB_NAME' does not exist. Creating it...${NC}"

          # Create the test database
          if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE \"$TEST_DB_NAME\";" 2>/dev/null; then
            echo -e "${GREEN}✓ Test database '$TEST_DB_NAME' created successfully.${NC}"

            # Create a test-specific .env file with the test database
            local TEST_ENV_FILE="$PROJECT_ROOT/.env.test"
            cp "$ENV_FILE" "$TEST_ENV_FILE"

            # Replace the DATABASE_URL in the test .env file
            local test_db_url=$(grep "^DATABASE_URL=" "$ENV_FILE" | sed "s/$DB_NAME/$TEST_DB_NAME/g")
            sed -i "s|^DATABASE_URL=.*|$test_db_url|g" "$TEST_ENV_FILE"

            echo -e "${GREEN}✓ Created test environment file (.env.test)${NC}"
          else
            echo -e "${RED}✗ Failed to create test database '$TEST_DB_NAME'.${NC}"
            echo -e "${YELLOW}Proceeding with regular database for tests.${NC}"
          fi
        else
          echo -e "${GREEN}✓ Test database '$TEST_DB_NAME' exists.${NC}"

          # Create a test-specific .env file with the test database
          local TEST_ENV_FILE="$PROJECT_ROOT/.env.test"
          cp "$ENV_FILE" "$TEST_ENV_FILE"

          # Replace the DATABASE_URL in the test .env file
          local test_db_url=$(grep "^DATABASE_URL=" "$ENV_FILE" | sed "s/$DB_NAME/$TEST_DB_NAME/g")
          sed -i "s|^DATABASE_URL=.*|$test_db_url|g" "$TEST_ENV_FILE"

          echo -e "${GREEN}✓ Updated test environment file (.env.test)${NC}"
        fi
      fi
    else
      echo -e "${YELLOW}! Could not extract database parameters. Skipping test database setup.${NC}"
    fi
  fi

  # Run server tests
  if [[ -d "$SERVER_DIR" ]]; then
    echo -e "${BLUE}Running server tests...${NC}"

    # Set environment based on mock mode
    local test_env=""
    if [[ "$use_mock" == "true" ]]; then
      test_env="USE_MOCK_DATA=true"
    else
      # Copy .env.test to server directory if it exists, otherwise use regular .env
      if [[ -f "$PROJECT_ROOT/.env.test" ]]; then
        cp "$PROJECT_ROOT/.env.test" "$SERVER_DIR/.env.test"
        test_env="NODE_ENV=test"
      else
        cp "$ENV_FILE" "$SERVER_DIR/.env"
      fi
    fi

    cd "$SERVER_DIR"
    if command_exists bun; then
      $test_env bun test
      local server_test_status=$?
      if [[ $server_test_status -eq 0 ]]; then
        echo -e "${GREEN}✓ Server tests passed${NC}"
      else
        echo -e "${RED}✗ Server tests failed!${NC}"
      fi
    else
      echo -e "${RED}✗ Bun is required to run server tests!${NC}"
    fi
    cd "$PROJECT_ROOT"
  fi

  # Run frontend tests
  if [[ -d "$FRONTEND_DIR" ]]; then
    echo -e "${BLUE}Running frontend tests...${NC}"

    # Set environment based on mock mode
    local test_env=""
    if [[ "$use_mock" == "true" ]]; then
      test_env="USE_MOCK_DATA=true"
    else
      # Copy .env.test to frontend directory if it exists, otherwise use regular .env
      if [[ -f "$PROJECT_ROOT/.env.test" ]]; then
        cp "$PROJECT_ROOT/.env.test" "$FRONTEND_DIR/.env.test"
        test_env="NODE_ENV=test"
      else
        cp "$ENV_FILE" "$FRONTEND_DIR/.env"
      fi
    fi

    cd "$FRONTEND_DIR"
    if command_exists npm; then
      $test_env npm test
      local frontend_test_status=$?
      if [[ $frontend_test_status -eq 0 ]]; then
        echo -e "${GREEN}✓ Frontend tests passed${NC}"
      else
        echo -e "${RED}✗ Frontend tests failed!${NC}"
      fi
    else
      echo -e "${RED}✗ npm is required to run frontend tests!${NC}"
    fi
    cd "$PROJECT_ROOT"
  fi
}

# Show help menu
show_help() {
  echo -e "Usage: ./run.sh [OPTION]"
  echo -e "Run AI Trader in different modes and perform various operations."
  echo -e ""
  echo -e "Options:"
  echo -e "  ${GREEN}--install${NC}    Install all dependencies for server and frontend"
  echo -e "  ${GREEN}--dev${NC}        Start the development environment"
  echo -e "  ${GREEN}--server${NC}     Start only the server in development mode"
  echo -e "  ${GREEN}--frontend${NC}   Start only the frontend in development mode"
  echo -e "  ${GREEN}--tests${NC}      Run all tests with real data"
  echo -e "  ${GREEN}--tests-mock${NC} Run all tests with mock data"
  echo -e "  ${GREEN}--docker${NC}     Start the application using Docker"
  echo -e "  ${GREEN}--check-db${NC}   Check database and run migrations if needed"
  echo -e "  ${GREEN}--status${NC}     Check server and database status"
  echo -e "  ${GREEN}--help${NC}       Show this help message"
  echo -e ""
  echo -e "If no option is specified, the script will launch in interactive mode."
}

# Check server status
check_server_status() {
  echo -e "${BLUE}Checking server status...${NC}"

  # Check if database is available
  ensure_database_exists

  # Check if server is running by sending a request to health endpoint
  local server_url="http://localhost:$(grep "^SERVER_PORT=" "$ENV_FILE" | cut -d= -f2 | tr -d '\"' | tr -d "'")"

  echo -e "${BLUE}Checking server connection at ${server_url}/health...${NC}"

  if command_exists curl; then
    if curl -s -m 5 "${server_url}/health" > /dev/null; then
      echo -e "${GREEN}✓ Server is running and responding${NC}"
    else
      echo -e "${RED}✗ Server is not responding. Make sure it's running.${NC}"
    fi
  else
    if command_exists wget; then
      if wget -q --spider -T 5 "${server_url}/health"; then
        echo -e "${GREEN}✓ Server is running and responding${NC}"
      else
        echo -e "${RED}✗ Server is not responding. Make sure it's running.${NC}"
      fi
    else
      echo -e "${YELLOW}! Could not check server connection. Install curl or wget to enable this check.${NC}"
    fi
  fi

  # Check if frontend is running
  local frontend_url="http://localhost:$(grep "^PORT=" "$FRONTEND_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '\"' | tr -d "'" || echo "3001")"

  echo -e "${BLUE}Checking frontend connection at ${frontend_url}...${NC}"

  if command_exists curl; then
    if curl -s -m 5 "${frontend_url}" > /dev/null; then
      echo -e "${GREEN}✓ Frontend is running and responding${NC}"
    else
      echo -e "${RED}✗ Frontend is not responding. Make sure it's running.${NC}"
    fi
  else
    if command_exists wget; then
      if wget -q --spider -T 5 "${frontend_url}"; then
        echo -e "${GREEN}✓ Frontend is running and responding${NC}"
      else
        echo -e "${RED}✗ Frontend is not responding. Make sure it's running.${NC}"
      fi
    else
      echo -e "${YELLOW}! Could not check frontend connection. Install curl or wget to enable this check.${NC}"
    fi
  fi
}

# Main function for interactive mode
interactive_mode() {
  show_logo
  check_requirements
  check_env
  create_directories

  echo -e "${YELLOW}What would you like to do?${NC}"
  echo -e "1) ${GREEN}Install dependencies${NC}"
  echo -e "2) ${GREEN}Start development environment${NC}"
  echo -e "3) ${GREEN}Start server only${NC}"
  echo -e "4) ${GREEN}Start frontend only${NC}"
  echo -e "5) ${GREEN}Check database${NC}"
  echo -e "6) ${GREEN}Check server status${NC}"
  echo -e "7) ${GREEN}Run tests${NC}"
  echo -e "8) ${GREEN}Run tests with mock data${NC}"
  echo -e "9) ${GREEN}Start with Docker${NC}"
  echo -e "0) ${GREEN}Exit${NC}"

  read -r choice

  case $choice in
    1)
      install_server_deps
      install_frontend_deps
      echo -e "${GREEN}All dependencies installed. Press any key to continue...${NC}"
      read -r
      interactive_mode
      ;;
    2)
      check_database
      start_dev
      ;;
    3)
      check_database
      start_server_dev
      ;;
    4)
      start_frontend_dev
      ;;
    5)
      check_database
      echo -e "${GREEN}Database check completed. Press any key to continue...${NC}"
      read -r
      interactive_mode
      ;;
    6)
      check_server_status
      echo -e "${GREEN}Server status check completed. Press any key to continue...${NC}"
      read -r
      interactive_mode
      ;;
    7)
      run_tests
      echo -e "${GREEN}Tests completed. Press any key to continue...${NC}"
      read -r
      interactive_mode
      ;;
    8)
      run_tests "--mock"
      echo -e "${GREEN}Mock tests completed. Press any key to continue...${NC}"
      read -r
      interactive_mode
      ;;
    9)
      if command_exists docker && command_exists docker-compose; then
        echo -e "${BLUE}Starting with Docker...${NC}"
        npm run docker:build
        npm run docker:up
      else
        echo -e "${RED}Docker and docker-compose are required for this option!${NC}"
        echo -e "${GREEN}Press any key to continue...${NC}"
        read -r
        interactive_mode
      fi
      ;;
    0)
      echo -e "${GREEN}Goodbye!${NC}"
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid choice. Press any key to continue...${NC}"
      read -r
      interactive_mode
      ;;
  esac
}

# Handle command line arguments
if [[ $# -gt 0 ]]; then
  case $1 in
    --install)
      show_logo
      check_requirements
      check_env
      create_directories
      install_server_deps
      install_frontend_deps
      ;;
    --dev)
      show_logo
      check_requirements
      check_env
      check_database
      start_dev
      ;;
    --server)
      show_logo
      check_requirements
      check_env
      check_database
      start_server_dev
      ;;
    --frontend)
      show_logo
      check_requirements
      check_env
      start_frontend_dev
      ;;
    --tests)
      show_logo
      check_requirements
      check_env
      run_tests
      ;;
    --tests-mock)
      show_logo
      check_requirements
      check_env
      run_tests "--mock"
      ;;
    --docker)
      show_logo
      check_requirements
      check_env
      if command_exists docker && command_exists docker-compose; then
        npm run docker:build
        npm run docker:up
      else
        echo -e "${RED}Docker and docker-compose are required for this option!${NC}"
        exit 1
      fi
      ;;
    --check-db)
      show_logo
      check_requirements
      check_env
      check_database
      ;;
    --status)
      show_logo
      check_requirements
      check_env
      check_server_status
      ;;
    --help)
      show_help
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      show_help
      exit 1
      ;;
  esac
else
  # No arguments provided, go to interactive mode
  interactive_mode
fi