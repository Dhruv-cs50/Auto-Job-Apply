FROM node:22.14.0-alpine3.21
WORKDIR /opt/job-discovery
COPY --chown=node:node workers/scheduler/lib.mjs workers/scheduler/run.mjs ./
USER node
ENV NODE_ENV=production
ENTRYPOINT ["node", "/opt/job-discovery/run.mjs"]
