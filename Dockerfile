FROM node:slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY *.js ./
CMD exec node exporter.js
ENV ZWAVE_INTERVAL=60
