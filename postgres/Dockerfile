FROM docker.io/library/golang:1.25-alpine AS walg
ARG WALG_VERSION=v3.0.9
RUN apk add --no-cache git
RUN git clone --depth 1 --branch ${WALG_VERSION} https://github.com/wal-g/wal-g /src
WORKDIR /src/main/pg
RUN GOEXPERIMENT=jsonv2 CGO_ENABLED=0 go build -ldflags "-s -w" -o /wal-g .

FROM docker.io/library/postgres:16-alpine
COPY --from=walg /wal-g /usr/local/bin/wal-g
