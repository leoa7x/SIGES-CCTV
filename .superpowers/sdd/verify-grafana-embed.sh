#!/usr/bin/env bash
set -euo pipefail

LOGIN=$(curl -s -X POST http://127.0.0.1:4001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sigescctv.co","password":"Admin1234!"}')

TOKEN=$(printf "%s" "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "missing access token"
  exit 1
fi

NODES=$(curl -s http://127.0.0.1:4001/nodes -H "Authorization: Bearer $TOKEN")
NODE_ID=$(printf "%s" "$NODES" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n 1)
if [ -z "$NODE_ID" ]; then
  echo "missing node id"
  exit 1
fi

echo "NODE_ID=$NODE_ID"
echo "-- node embed --"
curl -s "http://127.0.0.1:4001/observability/embed/node/$NODE_ID" -H "Authorization: Bearer $TOKEN"
echo
echo "-- global embed --"
curl -s "http://127.0.0.1:4001/observability/embed/network-command-view" -H "Authorization: Bearer $TOKEN"
echo
echo "-- routes --"
curl -I -s http://127.0.0.1:3001/admin/nodes | head -n 1
curl -I -s http://127.0.0.1:3001/monitoring/network | head -n 1
