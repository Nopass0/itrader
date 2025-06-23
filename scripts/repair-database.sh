#!/bin/bash

echo "==================================="
echo "SQLite Database Repair Tool"
echo "==================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database path
DB_PATH="prisma/database.db"
BACKUP_DIR="database_backups"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to create backup
backup_database() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/database_backup_$timestamp.db"
    
    if [ -f "$DB_PATH" ]; then
        echo -e "${YELLOW}Creating backup...${NC}"
        cp "$DB_PATH" "$backup_file"
        echo -e "${GREEN}Backup created: $backup_file${NC}"
        return 0
    else
        echo -e "${RED}Database file not found!${NC}"
        return 1
    fi
}

# Function to check database integrity
check_integrity() {
    echo -e "${YELLOW}Checking database integrity...${NC}"
    result=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1)
    
    if [ "$result" = "ok" ]; then
        echo -e "${GREEN}Database is healthy!${NC}"
        return 0
    else
        echo -e "${RED}Database corruption detected:${NC}"
        echo "$result"
        return 1
    fi
}

# Function to repair database
repair_database() {
    echo -e "${YELLOW}Attempting to repair database...${NC}"
    
    # Create a temporary repaired database
    local temp_db="${DB_PATH}.repaired"
    
    # Export the database to SQL and reimport
    echo "Exporting database to SQL..."
    sqlite3 "$DB_PATH" ".mode insert" ".dump" > database_dump.sql 2>/dev/null
    
    if [ $? -eq 0 ] && [ -s database_dump.sql ]; then
        echo "Creating new database from dump..."
        rm -f "$temp_db"
        sqlite3 "$temp_db" < database_dump.sql
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Database repair successful!${NC}"
            
            # Replace the corrupted database
            mv "$DB_PATH" "${DB_PATH}.corrupted"
            mv "$temp_db" "$DB_PATH"
            
            # Clean up
            rm -f database_dump.sql
            
            return 0
        else
            echo -e "${RED}Failed to create new database from dump${NC}"
            rm -f "$temp_db" database_dump.sql
            return 1
        fi
    else
        echo -e "${RED}Failed to export database${NC}"
        return 1
    fi
}

# Function to reset database
reset_database() {
    echo -e "${YELLOW}This will delete all data and create a fresh database!${NC}"
    read -p "Are you sure? Type 'yes' to continue: " confirm
    
    if [ "$confirm" = "yes" ]; then
        # Backup first
        backup_database
        
        # Remove old database files
        rm -f "$DB_PATH" "${DB_PATH}-shm" "${DB_PATH}-wal"
        
        # Run Prisma migrations
        echo "Running Prisma migrations..."
        bunx prisma migrate deploy
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Database reset successful!${NC}"
            return 0
        else
            echo -e "${RED}Failed to run migrations${NC}"
            return 1
        fi
    else
        echo "Database reset cancelled."
        return 1
    fi
}

# Main menu
echo ""
echo "What would you like to do?"
echo "1) Check database integrity"
echo "2) Backup database"
echo "3) Repair corrupted database"
echo "4) Reset database (delete all data)"
echo "5) Exit"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        check_integrity
        ;;
    2)
        backup_database
        ;;
    3)
        # First backup
        backup_database
        
        # Check integrity
        if check_integrity; then
            echo -e "${GREEN}Database is already healthy, no repair needed.${NC}"
        else
            repair_database
            
            # Check again after repair
            echo ""
            echo "Verifying repaired database..."
            check_integrity
        fi
        ;;
    4)
        reset_database
        ;;
    5)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice!${NC}"
        exit 1
        ;;
esac

echo ""
echo "Done!"