#!/bin/bash
set -euo pipefail

tmp_container="majority_gen_tmp"
deployment_version="$(git rev-parse --short HEAD 2>/dev/null || true)"

docker rm -f "${tmp_container}" >/dev/null 2>&1 || true
docker image build -f deploy/docker/Dockerfile --target generator -t majority:generator .

if [[ -n "${deployment_version}" ]]; then
  docker create --name "${tmp_container}" -e "DEPLOYMENT_VERSION=${deployment_version}" majority:generator npm run generate:cache >/dev/null
else
  docker create --name "${tmp_container}" majority:generator npm run generate:cache >/dev/null
fi
trap 'docker rm -f "${tmp_container}" >/dev/null 2>&1 || true' EXIT

docker start -a "${tmp_container}"

docker cp "${tmp_container}:/app/web/config/index.json" web/config/index.json
docker cp "${tmp_container}:/app/web/config/manifest.json" web/config/manifest.json
if ! docker cp "${tmp_container}:/app/web/deployment-version.json" web/deployment-version.json >/dev/null 2>&1; then
  rm -f web/deployment-version.json
fi
