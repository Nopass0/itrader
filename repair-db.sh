#!/bin/bash

echo "Repairing database..."

# Backup current database
if [ -f "prisma/database.db" ]; then
    echo "Creating backup..."
    cp prisma/database.db prisma/database.db.backup.$(date +%s)
fi

# Remove corrupted database files
echo "Removing corrupted database files..."
rm -f prisma/database.db
rm -f prisma/database.db-journal
rm -f prisma/database.db-shm
rm -f prisma/database.db-wal

# Recreate database
echo "Recreating database..."
bun run db:push

echo "Database repaired successfully!"
echo ""
echo "Note: All data has been lost. You'll need to create a new admin account."