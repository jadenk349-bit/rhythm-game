# Rhythm Game — Docker image for Render.
# No npm dependencies: build-config.js and serve.js use only Node built-ins.
FROM node:22-alpine

WORKDIR /app
COPY index.html build-config.js serve.js ./

# Render sets PORT at runtime; 10000 is Render's default.
ENV PORT=10000
EXPOSE 10000

# Run as the unprivileged "node" user that the base image provides.
RUN chown -R node:node /app
USER node

# Supabase settings (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) are environment
# variables available only at runtime, so config.js is written at container start.
# build-config.js exits with an error if they're missing or a secret key is given.
CMD ["sh", "-c", "node build-config.js && exec node serve.js"]
