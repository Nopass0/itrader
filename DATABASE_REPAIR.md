# Database Repair Guide

## Quick Fix for Corrupted Database

If you encounter the error "database disk image is malformed", follow these steps:

### Option 1: Automatic Repair (Recommended)

```bash
# Run the repair script
./scripts/repair-database.sh
```

This script will:
1. Create a backup of your current database
2. Attempt to repair the database using SQLite tools
3. If repair fails, offer to reset the database

### Option 2: Manual Reset

If you want to quickly reset the database:

```bash
# 1. Remove corrupted database
rm -f prisma/database.db prisma/database.db-*

# 2. Generate Prisma client
bunx prisma generate

# 3. Create new database with schema
bunx prisma db push

# 4. Recreate admin account
./server.sh
# Choose option 6 -> 1 to create admin account
```

### Option 3: Restore from Backup

If you have a backup:

```bash
# List available backups
ls -la prisma/*.backup.*

# Restore from backup
cp prisma/database.db.backup.YYYYMMDD_HHMMSS prisma/database.db

# Regenerate Prisma client
bunx prisma generate
```

## Preventing Database Corruption

1. **Always stop the server gracefully**
   - Use Ctrl+C or `systemctl stop itrader`
   - Don't kill -9 the process

2. **Regular backups**
   ```bash
   # Add to crontab
   0 */6 * * * cp /path/to/prisma/database.db /path/to/backup/database.db.$(date +\%Y\%m\%d_\%H\%M\%S)
   ```

3. **Monitor disk space**
   - SQLite can corrupt if disk is full
   - Keep at least 10% free space

4. **Use WAL mode** (already enabled in our setup)
   - Better concurrency and crash recovery

## After Database Reset

You'll need to recreate:

1. **Admin/Operator accounts**
   ```bash
   ./server.sh
   # Option 6 -> 1 for admin
   # Option 6 -> 2 for operators
   ```

2. **Platform accounts** (Gate, Bybit, Gmail, MailSlurp)
   - Use the web panel or CLI to add accounts

3. **Settings** (exchange rates, etc.)
   - Reconfigure through the web panel

## Common Errors and Solutions

### Error: "Unknown argument apiKey"
This means Prisma client is outdated:
```bash
bunx prisma generate
```

### Error: "Cannot find module './generated/prisma'"
```bash
bunx prisma generate
```

### Error: "P2002: Unique constraint failed"
This means you're trying to create a duplicate record. Check existing data first.

### Error: "database is locked"
Stop all running instances of the application:
```bash
pkill -f "bun.*app.ts"
systemctl stop itrader
```

## Emergency Recovery

If all else fails:

1. **Export critical data** (if possible)
   ```bash
   sqlite3 prisma/database.db ".dump" > emergency_backup.sql
   ```

2. **Start fresh**
   ```bash
   rm -rf prisma/database.db* generated/
   bunx prisma generate
   bunx prisma db push
   ```

3. **Contact support** with:
   - Error messages
   - Last working backup
   - Recent changes made