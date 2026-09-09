# =========================
# Stage 1: Build
# =========================

# Node is needed to build the TypeScript application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency files first so Docker can cache npm install
COPY package*.json ./

# Install all dependencies, including devDependencies needed for building
RUN npm ci

# Copy the application source/configuration
COPY . .

# Compile TypeScript → creates the dist/ directory
RUN npm run build

# Remove devDependencies because they are not required at runtime
# Keep only production dependencies inside node_modules
RUN npm prune --omit=dev


# =========================
# Stage 2: Production
# =========================

# New, clean image for running the application
FROM node:22-alpine

# Tell Node/application that this is a production environment
ENV NODE_ENV=production

WORKDIR /app

# Update Alpine packages to their latest available security-fixed versions.
RUN apk upgrade --no-cache

# Create a dedicated non-root user for running the backend
RUN addgroup -S taskflow && \
    adduser -S taskflow -G taskflow


# Copy only the production dependencies from the builder
#
# npm is NOT needed here because dependencies were already installed
# and pruned in the builder stage.
COPY --from=builder /app/node_modules ./node_modules

# Copy only the compiled application from Stage 1
COPY --from=builder /app/dist ./dist

# Migrations are handled separately by CI/CD,
# so they don't need to be in the runtime image
# COPY migrations ./migrations


# npm is not required to run the application.
#
# The node:22-alpine image contains npm by default.
# Remove npm and npx from the production image so their
# bundled dependencies are not included in the Trivy scan.
RUN rm -rf /usr/local/lib/node_modules/npm && \
    rm -f /usr/local/bin/npm /usr/local/bin/npx


# Run the backend as the non-root taskflow user
USER taskflow

# Backend listens on port 4000
EXPOSE 4000

# Start the compiled backend
CMD ["node", "dist/index.js"]