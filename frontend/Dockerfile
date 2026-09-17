# Site do Mais Horas: compila o Vite e entrega pelo Caddy, que também faz o
# HTTPS e repassa /api para a API. Usado pelo deploy em servidor próprio.
FROM node:22-alpine AS compilacao
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# O Vite embute a URL no build: mudar exige compilar de novo.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM caddy:2-alpine
COPY --from=compilacao /app/dist /srv
