# Use official Node.js 18 Alpine image as the base
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy package.json and package-lock.json to install dependencies first (for better caching)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy the rest of the application code
# Local node_modules, .git, etc. are excluded via .dockerignore
COPY . .

# Create a non-root user for security (Alpine specific)
RUN addgroup -S nodejs && adduser -S justice -G nodejs
RUN chown -R justice:nodejs /app

# Switch to the non-root user
USER justice

# Expose the application port
EXPOSE 3006

# Start the application
CMD ["node", "app.js"]