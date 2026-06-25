# ---- Stage 1: build React frontend ----
FROM node:20-slim AS frontend
WORKDIR /app/maker-frontend
COPY maker-frontend/package*.json ./
RUN npm ci
COPY maker-frontend/ ./
RUN npm run build

# ---- Stage 2: Python backend ----
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=frontend /app/maker-frontend-dist ./maker-frontend-dist

RUN mkdir -p data output

EXPOSE 8000

CMD ["uvicorn", "figma_html_maker.webapp.server:app", "--host", "0.0.0.0", "--port", "8000"]
