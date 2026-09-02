FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY config.js dashboard.js highlevel.js meta.js scheduler.js server.js supabase.js template-matcher.js utils.js ./src/
COPY skeleton.jpg mr-bean.png ./public/
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
