FROM golang:1.20-alpine AS build
WORKDIR /app
COPY go.mod .
RUN go env -w GOPROXY=https://proxy.golang.org
COPY . .
RUN go build -o /bizcalc-server ./main.go

FROM alpine:3.18
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /bizcalc-server /app/bizcalc-server
COPY migrate.sql /app/migrate.sql
RUN mkdir -p /app/uploads /app/data
EXPOSE 3000
CMD ["/app/bizcalc-server"]
