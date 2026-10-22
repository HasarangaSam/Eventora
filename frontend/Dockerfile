# ==============================================================================
# STEP 1: The "Builder" Stage
# We install dependencies and run 'vite build' to produce static HTML/CSS/JS.
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Vite needs environment variables at BUILD time because they are baked into the JS
ARG VITE_API_BASE_URL
ARG VITE_CLERK_PUBLISHABLE_KEY

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

# Compile React into static files (outputs to the 'dist' folder)
RUN npm run build

# ==============================================================================
# STEP 2: The "Runner" Stage
# We use Nginx (a fast, lightweight web server) to serve the static files.
# Notice: Node.js is NOT even needed in this final image!
# ==============================================================================
FROM nginx:1.27-alpine AS runner

# Copy our custom Nginx config (with the SPA routing rule)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the static HTML/CSS/JS files from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard HTTP port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
