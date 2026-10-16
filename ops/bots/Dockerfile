FROM mcr.microsoft.com/playwright@sha256:68456172e8d99f42cf391e835f5d566b3ab0a2c6a745decd9590c4d73c54d2fb
WORKDIR /opt/lyra
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY config.mjs browser-session.mjs runner.mjs healthcheck.mjs ./
USER 1000:1000
HEALTHCHECK --interval=5s --timeout=3s --start-period=120s --retries=3 CMD ["node", "healthcheck.mjs"]
CMD ["node", "runner.mjs"]
