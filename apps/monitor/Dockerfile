FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY apps/monitor/go.mod apps/monitor/go.sum ./
RUN go mod download
COPY apps/monitor ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/siges-monitor .

FROM alpine:3.21
RUN apk add --no-cache ca-certificates iputils
COPY --from=builder /out/siges-monitor /usr/local/bin/siges-monitor
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/siges-monitor"]
