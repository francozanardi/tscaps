# Two-stage build for the static tscaps web app.
#
# Build context: the workspace root (the repo where this app sits as a
# pnpm workspace member alongside `packages/engine`). Invoke with
#   docker build -f apps/studio/Dockerfile -t tscaps-web .
# from the repo root.

# Debian rather than Alpine, and only here: installing compiles the
# templates, which reaches `onnxruntime-node`'s native binding through the
# engine's entry point, and that library is linked against glibc. The
# runtime stage below is untouched, so the published image is the same
# Alpine one either way — this buys the build a libc and costs the
# artifact nothing.
FROM node:22-slim AS build

RUN corepack enable

WORKDIR /workspace

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/engine ./packages/engine
COPY presets ./presets
COPY apps/studio ./apps/studio

RUN pnpm install --frozen-lockfile
RUN pnpm --filter ./apps/studio build

FROM nginx:1.27-alpine AS runtime

COPY --from=build /workspace/apps/studio/dist /usr/share/nginx/html
COPY apps/studio/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
