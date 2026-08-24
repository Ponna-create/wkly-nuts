# Official Playwright image already has Chromium + every system dependency
# it needs pre-installed — far simpler and more reliable than installing
# browser deps by hand on a generic node:slim image.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]
