# Database Configuration Guide

## Overview

The application supports two database types:
- **SQLite** (default) - For local development and small deployments
- **PostgreSQL** - For production environments and cloud deployments (including Neon)

## Quick Setup

### Using SQLite (Default)

1. No additional configuration needed
2. Run setup command:
   ```bash
   bun run setup
   ```

### Using PostgreSQL/Neon

1. Update `.env` file:
   ```env
   # Change database type
   DATABASE_TYPE="postgres"
   
   # Set PostgreSQL connection string
   DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
   
   # For Neon example:
   DATABASE_URL="postgresql://username:password@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```

2. Run setup command:
   ```bash
   bun run setup
   ```

## Authentication

Default admin credentials:
- Username: `admin`
- Password: `admin123`

To reset admin password:
```bash
bun run reset:admin
```

## Switching Between Databases

The system automatically detects which database type to use based on `DATABASE_TYPE` environment variable.

### From SQLite to PostgreSQL:
1. Update `DATABASE_TYPE="postgres"` in `.env`
2. Set `DATABASE_URL` to your PostgreSQL connection string
3. Run `bun run setup:db`

### From PostgreSQL to SQLite:
1. Update `DATABASE_TYPE="sqlite"` in `.env`
2. Ensure `DATABASE_URL="file:./database.db"`
3. Run `bun run setup:db`

## Database Commands

- `bun run setup` - Complete setup (database + admin account)
- `bun run setup:db` - Database setup only
- `bun run reset:admin` - Reset admin password
- `bun run db:generate` - Generate Prisma client
- `bun run db:push` - Push schema to database
- `bun run db:migrate` - Run migrations

## Troubleshooting

### "Invalid credentials" error
1. Run `bun run reset:admin` to reset the admin password
2. Make sure you're using the correct username/password
3. Check that the database is properly initialized

### Database connection errors
1. Verify your `DATABASE_URL` is correct
2. For PostgreSQL, ensure the database exists
3. Check network connectivity to database server
4. Verify SSL settings match your database requirements