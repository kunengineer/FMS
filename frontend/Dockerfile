# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Run Stage
FROM nginx:alpine

# Copy built assets to Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration if needed
# By default, Nginx default configuration is fine since we use HashRouter
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
