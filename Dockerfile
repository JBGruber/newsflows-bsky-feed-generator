FROM node:18-slim

WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source files
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV FEEDGEN_LISTENHOST=0.0.0.0

# Expose the port that the application listens on
EXPOSE 3000

# Command to run the application
CMD ["yarn", "start"]
