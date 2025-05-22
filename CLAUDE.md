# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AITrader is a platform for integration with Gate.cx and Bybit trading exchanges, featuring a modern user interface with a glassmorphism design style. The project consists of a Node.js/Bun backend and a Next.js frontend.

## Development Commands

### Installation

```bash
# Full installation with PostgreSQL (requires sudo)
./run.sh --install

# Installation with SQLite (for development)
./run.sh --install --sqlite3

# Non-interactive installation (answers yes to all prompts)
./run.sh --install --yes
```

### Development

```bash
# Start both server and frontend in development mode
./run.sh --dev
# or
npm run dev

# Start only server
./run.sh --server
# or
npm run dev:server

# Start only frontend
./run.sh --frontend
# or
npm run dev:frontend

# Development with SQLite
npm run dev:sqlite
```

### Testing

```bash
# Run all tests
npm run test

# Run server tests
npm run test:server

# Run frontend tests
npm run test:frontend

# Run tests with mock data
./run.sh --tests-mock
```

### Linting

```bash
# Lint all code
npm run lint

# Lint server code
npm run lint:server

# Lint frontend code
npm run lint:frontend
```

### Database

```bash
# Check database connection
npm run db:check

# Generate Prisma client
cd server && bun run prisma:generate

# Run migrations
cd server && bun run prisma:migrate

# Open Prisma Studio
cd server && bun run prisma:studio
```

### Production

```bash
# Build for production
npm run build

# Start in production mode
npm run start

# Docker deployment
npm run docker:build
npm run docker:up
```

## Architecture

### Backend

The backend is structured as a modular API with the following components:

1. **Routes**: API endpoints grouped by resource type:
   - `/auth` - Authentication endpoints
   - `/gate` - Gate.cx integration endpoints
   - `/bybit` - Bybit integration endpoints
   - `/admin` - Admin management endpoints

2. **Services**: Core business logic implementation:
   - `gateService.ts` - Gate.cx API integration
   - `bybitService.ts` - Bybit API integration
   - `sessions.ts` - Session management
   - `mockService.ts` - Mock data for testing

3. **Middleware**: Request processing:
   - `auth.ts` - Authentication via JWT, API token or URL param

4. **Database**: Prisma ORM with PostgreSQL

### Frontend

The frontend uses Next.js with the following structure:

1. **Pages**: Page components in `/app` directory
2. **Components**: Reusable UI components
3. **Hooks**: Custom React hooks
4. **Store**: Zustand state management
5. **API**: API client using Axios

## Database Schema

The database uses Prisma ORM with the following models:

1. **Admin**: System administrators who can create user accounts
2. **User**: End users of the system
3. **GateCredentials**: Stores Gate.cx credentials (email/password)
4. **BybitCredentials**: Stores Bybit API keys
5. **GateSession**: Tracks active Gate.cx sessions with cookies
6. **BybitSession**: Tracks active Bybit sessions with account info
7. **TransactionLog**: Logs all API transactions for auditing

## Authentication

The system supports multiple authentication methods:

1. JWT token in `Authorization` header
2. API token in `X-API-Token` header
3. Token as URL parameter (`?token=`)

## API Structure

The API follows a consistent format for responses:

```typescript
// Success response
{
  success: true,
  data: T,
  error: null
}

// Error response
{
  success: false,
  data: null,
  error: "Error message"
}

// Paginated response
{
  success: true,
  data: {
    items: T[],
    meta: {
      page: number,
      limit: number,
      total: number,
      has_next: boolean
    }
  },
  error: null
}
```

## Code Style Guidelines

1. **TypeScript**: Use TypeScript for all code with strict typing
2. **Naming Conventions**:
   - camelCase for variables, functions, and methods
   - PascalCase for classes, interfaces, and React components
   - UPPER_SNAKE_CASE for constants
   
3. **Frontend Components**:
   - Use functional components with hooks
   - Apply glassmorphism design style using provided Tailwind classes
   - Support dark/light themes
   
4. **Backend**:
   - Use async/await for asynchronous code
   - Validate all input data
   - Follow a consistent response format
   - Log significant events

## UI Design

The project uses a glassmorphism design style with the following characteristics:

1. Semi-transparent backgrounds
2. Blur effects (backdrop-filter)
3. Light borders
4. Layered elements for depth
5. Soft shadows

Use these Tailwind classes for consistency:
- `glassmorphism` for card-like containers
- `glass-button` for buttons
- Support for both dark and light themes

## Key Files and Directories

- `/server/src/routes/` - API endpoints
- `/server/src/services/` - Core business logic
- `/server/prisma/` - Database schema and migrations
- `/frontend/app/` - Next.js pages
- `/frontend/components/` - Reusable UI components
- `/frontend/hooks/` - Custom React hooks
- `/frontend/store/` - Zustand state management
- `/docs/` - Project documentation

## Best Practices

1. **Security**:
   - Never expose credentials in the frontend
   - Validate all inputs
   - Use proper authentication for all API requests
   - Don't commit sensitive data or .env files

2. **Documentation**:
   - Document all API endpoints
   - Add JSDoc comments to functions
   - Update the documentation in `/docs` when making changes

3. **Testing**:
   - Write tests for new functionality
   - Run tests before committing

4. **Error Handling**:
   - Use try/catch blocks
   - Return appropriate error messages
   - Log errors properly

5. **Performance**:
   - Use appropriate caching strategies
   - Optimize database queries
   - Minimize unnecessary API calls