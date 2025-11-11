FROM node:22-alpine
WORKDIR /usr/src/app

# install
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# build
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npm run build

# ✅ run the compiled file (NOT main.js)
CMD ["node", "dist/index.js"]
