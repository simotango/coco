# Zalagh Plancher - Docker Setup
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p uploads pdfs pdfsigne planjpg

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV JWT_SECRET=zalagh-plancher-super-secret-key-2024
ENV PGHOST=db
ENV PGPORT=5432
ENV PGDATABASE=zalagh_plancher
ENV PGUSER=postgres
ENV PGPASSWORD=your-postgres-password
ENV PGSSL=false
ENV DEFAULT_ADMIN_PASSWORD=admin123
ENV GEMINI_API_KEY=your-gemini-api-key-here

# Start the application
CMD ["node", "server.js"]
