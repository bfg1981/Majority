#!/bin/bash

docker build -f deploy/docker/Dockerfile --target generator -t majority:generator .


docker create --name majority_gen_tmp majority:generator >/dev/null && \
docker cp majority_gen_tmp:/app/web/config/index.json web/config/index.json && \
docker cp majority_gen_tmp:/app/web/config/manifest.json web/config/manifest.json && \
docker rm majority_gen_tmp >/dev/null

