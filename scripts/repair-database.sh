#\!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Database Repair Script${NC}"
echo "========================"

# Check if database exists
if [ \! -f "prisma/database.db" ]; then
    echo -e "${RED}Database file not found\!${NC}"
    echo -e "${YELLOW}Creating new database...${NC}"
    bunx prisma db push
    exit 0
fi

# Create backup
BACKUP_NAME="prisma/database.db.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${YELLOW}Creating backup: $BACKUP_NAME${NC}"
cp prisma/database.db "$BACKUP_NAME"

# Try to repair using SQLite tools
echo -e "${BLUE}Attempting to repair database...${NC}"

# Method 1: Using sqlite3 to dump and restore
if command -v sqlite3 &> /dev/null; then
    echo -e "${YELLOW}Using sqlite3 to repair...${NC}"
    
    # Dump the database
    sqlite3 prisma/database.db ".dump" > prisma/database_dump.sql 2>/dev/null
    
    if [ $? -eq 0 ] && [ -s prisma/database_dump.sql ]; then
        # Move corrupted database
        mv prisma/database.db prisma/database.db.corrupted
        
        # Create new database from dump
        sqlite3 prisma/database.db < prisma/database_dump.sql
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Database repaired successfully\!${NC}"
            rm prisma/database_dump.sql
            
            # Regenerate Prisma client
            echo -e "${YELLOW}Regenerating Prisma client...${NC}"
            bunx prisma generate
            
            # Apply any pending migrations
            echo -e "${YELLOW}Applying schema...${NC}"
            bunx prisma db push
            
            echo -e "${GREEN}Database repair completed\!${NC}"
            exit 0
        else
            echo -e "${RED}Failed to create new database from dump${NC}"
            # Restore backup
            cp "$BACKUP_NAME" prisma/database.db
        fi
    else
        echo -e "${RED}Failed to dump database${NC}"
    fi
else
    echo -e "${YELLOW}sqlite3 not found, trying alternative method...${NC}"
fi

# Method 2: Reset database if repair failed
echo -e "${RED}Database repair failed. Do you want to reset the database?${NC}"
echo -e "${YELLOW}WARNING: This will delete all data\!${NC}"
read -p "Reset database? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Remove corrupted database
    rm -f prisma/database.db
    rm -f prisma/database.db-*
    
    # Create new database
    echo -e "${YELLOW}Creating new database...${NC}"
    bunx prisma db push
    
    # Run seed if exists
    if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.js" ]; then
        echo -e "${YELLOW}Running seed...${NC}"
        bunx prisma db seed
    fi
    
    echo -e "${GREEN}New database created\!${NC}"
    echo -e "${YELLOW}Note: You'll need to recreate all accounts and data${NC}"
else
    echo -e "${YELLOW}Database reset cancelled. Restoring backup...${NC}"
    cp "$BACKUP_NAME" prisma/database.db
    echo -e "${GREEN}Backup restored${NC}"
fi
EOF < /dev/null