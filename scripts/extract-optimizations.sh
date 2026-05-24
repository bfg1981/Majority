#!/bin/bash
set -euo pipefail

tmp_container="majority_gen_tmp"

docker rm -f "${tmp_container}" >/dev/null 2>&1 || true
docker image build -f deploy/docker/Dockerfile --target generator -t majority:generator .

docker create --name "${tmp_container}" majority:generator >/dev/null
trap 'docker rm -f "${tmp_container}" >/dev/null 2>&1 || true' EXIT

docker cp "${tmp_container}:/app/web/config/index.json" web/config/index.json
docker cp "${tmp_container}:/app/web/config/manifest.json" web/config/manifest.json
