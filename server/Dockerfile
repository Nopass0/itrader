FROM oven/bun:1.0 as base

WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source files
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1.0-slim

WORKDIR /app

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy build files and dependencies
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma

# Expose the port
EXPOSE 3000

# Run the application
CMD ["bun", "run", "start"]