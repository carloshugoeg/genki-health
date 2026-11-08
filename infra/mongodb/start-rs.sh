#!/bin/bash
# Authenticated single-member MongoDB replica set rs0.
# Keyfile is generated inside the container only (mode 0600); never commit it.
set -euo pipefail

KEYFILE=/data/configdb/mongo-keyfile
mkdir -p /data/configdb /data/db

if [[ ! -f "$KEYFILE" ]]; then
  openssl rand -base64 756 >"$KEYFILE"
fi
chmod 600 "$KEYFILE"
chown mongodb:mongodb "$KEYFILE" 2>/dev/null || true

wait_mongod() {
  for _ in $(seq 1 90); do
    if mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_mongod_auth() {
  for _ in $(seq 1 90); do
    if mongosh --quiet -u root -p "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin \
      --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if [[ ! -f /data/db/.genki_rs_bootstrapped ]]; then
  mongod --dbpath /data/db --bind_ip_all --port 27017 --fork --logpath /var/log/mongodb-init.log
  wait_mongod
  mongosh --quiet --eval "
    db.getSiblingDB('admin').createUser({
      user: 'root',
      pwd: '${MONGO_ROOT_PASSWORD}',
      roles: [ { role: 'root', db: 'admin' } ]
    });
  "
  mongosh --quiet --eval 'db.adminCommand({ shutdown: 1, force: true })' || true
  for _ in $(seq 1 60); do
    if ! mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  touch /data/db/.genki_rs_bootstrapped
fi

mongod \
  --dbpath /data/db \
  --bind_ip_all \
  --port 27017 \
  --replSet rs0 \
  --keyFile "$KEYFILE" \
  --auth \
  --fork \
  --logpath /var/log/mongodb-rs.log

wait_mongod_auth

STATUS="$(mongosh --quiet -u root -p "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin \
  --eval 'try { rs.status().ok } catch (e) { 0 }' || echo 0)"
if [[ "$STATUS" != "1" ]]; then
  mongosh --quiet -u root -p "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin --eval '
    rs.initiate({ _id: "rs0", members: [ { _id: 0, host: "127.0.0.1:27017" } ] });
  '
fi

for _ in $(seq 1 90); do
  IS_PRIMARY="$(mongosh --quiet -u root -p "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin \
    --eval 'db.hello().isWritablePrimary === true' || echo false)"
  if [[ "$IS_PRIMARY" == "true" ]]; then
    echo "mongo rs0 primary ready"
    exec tail -F /var/log/mongodb-rs.log
  fi
  sleep 1
done

echo "mongo rs0 failed to become primary" >&2
exit 1
