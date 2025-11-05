FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S justice -u 1001

RUN chown -R justice:nodejs /app
USER justice

EXPOSE 3006

CMD ["npm", "start"]