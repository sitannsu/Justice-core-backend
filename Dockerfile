# --- BUILD STAGE ---
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install ALL dependencies
RUN npm install

# Copy everything for building (if needed)
COPY . .

# --- FINAL STAGE ---
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Add tini for better process handling (reaps zombie processes, handles signals)
RUN apk add --no-cache tini

# Copy only production files
# We only copy the directories and files that are essential for the app to run.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/app.js ./
COPY --from=builder /app/index.js ./
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/models ./models
COPY --from=builder /app/middleware ./middleware
COPY --from=builder /app/config ./config
COPY --from=builder /app/services ./services
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/api-endpoints.js ./
# We skip 'app' and 'src' based on our investigation that root-level folders are preferred.

# Set environment
ENV NODE_ENV=production
ENV PORT=3006

# Create a non-root user for security
RUN addgroup -S nodejs && adduser -S justice -G nodejs
RUN chown -R justice:nodejs /app

# Switch to the non-root user
USER justice

# Expose the application port
EXPOSE 3006

# Use tini to manage the process correctly (PID 1)
ENTRYPOINT ["/sbin/tini", "--"]

# Default command to start the application
CMD ["node", "app.js"]