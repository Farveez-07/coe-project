# ── Stage 1: Build the Vite React frontend ──────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --silent

# Copy frontend source and build
COPY index.html vite.config.js ./
COPY src/ ./src/

# Build static assets (production bundle)
RUN npm run build


# ── Stage 2: Python backend + serve static frontend ─────────────────────────
FROM python:3.11-slim AS production

LABEL maintainer="COE Project Team"
LABEL description="Tenant-Aware Storage Capacity Forecaster — Public Benefits Systems"
LABEL version="1.0.0"

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python backend source
COPY data_generator.py forecaster_engine.py governance_engine.py server.py ./
COPY experiment_analysis.py failure_mode_tests.py ./

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/dist ./static/

# Pre-generate telemetry dataset at build time for faster cold starts
RUN python3 data_generator.py

# Pre-run backtest benchmark
RUN python3 forecaster_engine.py

# Expose the API server port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health')" || exit 1

# Run the production server
CMD ["python3", "server.py"]
