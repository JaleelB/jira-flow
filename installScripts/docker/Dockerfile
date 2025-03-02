FROM golang:1.19-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o jira-flow ./cmd/app/main.go
RUN go build -o commitmsg ./hooks/commitmsg/main.go
RUN go build -o postco ./hooks/post_checkout/main.go

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/jira-flow /usr/local/bin/
COPY --from=builder /app/commitmsg /usr/local/bin/
COPY --from=builder /app/postco /usr/local/bin/
ENTRYPOINT ["jira-flow"]
