# syntax=docker/dockerfile:1
FROM node:22-alpine AS webbuild
WORKDIR /src
COPY web/package.json web/package-lock.json* ./web/
RUN cd web && npm install
COPY web ./web
COPY content ./content
COPY data ./data
RUN node content/scripts/build-pack.mjs
RUN cd web && npm run build

FROM python:3.12-slim
WORKDIR /app
ARG APP_VERSION=0.0.0
ENV APP_VERSION=$APP_VERSION
COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY db ./db
COPY server ./server
COPY content ./content
COPY --from=webbuild /src/web/dist ./web/dist
COPY --from=webbuild /src/data/blobs ./data/blobs
COPY --from=webbuild /src/content/trips ./content/trips
ENV HOST=0.0.0.0 PORT=8083
WORKDIR /app/server
EXPOSE 8083
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8083"]
