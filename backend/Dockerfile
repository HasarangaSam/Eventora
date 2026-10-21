# ==============================================================================
# STEP 1: The "Builder" Stage
# We install all tools (including TypeScript and Prisma) and compile our code.
# ==============================================================================
FROM node:22-alpine AS builder

# Set the working folder inside the container
WORKDIR /app

# Install OpenSSL (required by Prisma to generate database client engines)
RUN apk add --no-cache openssl

# 1. Copy package files first to take advantage of Docker layer caching.
# If package.json hasn't changed, Docker reuses the installed packages cache!
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts tsconfig*.json ./

# 2. Run a clean install of all dependencies (uses exact versions from package-lock.json)
RUN npm ci

# 3. Generate the Prisma Client code (safe to do without a live database)
RUN npx prisma generate

# 4. Copy the actual backend source code
COPY src ./src

# 5. Compile TypeScript into JavaScript (creates the 'dist' folder)
RUN npm run build

# 6. Remove development-only tools (like test libraries) to keep things lightweight
RUN npm prune --omit=dev

# ==============================================================================
# STEP 2: The "Runner" Stage (Production)
# We only take the compiled JavaScript and production packages.
# This makes our final container very small and secure!
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Install runtime OpenSSL and dumb-init (handles process stop signals cleanly)
RUN apk add --no-cache openssl dumb-init

ENV NODE_ENV=production
ENV PORT=3000

# Security practice: run as standard 'node' user instead of 'root'
USER node

# Copy ONLY the needed files from the builder stage
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/package.json ./package.json

# Tell Docker our NestJS app listens on port 3000
EXPOSE 3000

# Start the NestJS backend
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main"]
