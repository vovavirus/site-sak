#!/usr/bin/env bash
# Выкладывает лендинг САКУРЫ на VPS с nginx. HTTPS включается, когда DNS домена указывает на сервер.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${SAKURA_DOMAIN:-sakura.ruvv.su}"
REMOTE="${SAKURA_REMOTE:-root@5.129.230.22}"
DEST="${SAKURA_DEST:-/opt/sakura}"
SSH_KEY="${SAKURA_SSH_KEY:-$HOME/.ssh/id_ed25519}"
SERVER_IP="${REMOTE#*@}"
SSH_OPTS=(-F /dev/null -o StrictHostKeyChecking=accept-new)
if [[ -f "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

ssh_remote() {
  ssh "${SSH_OPTS[@]}" "$REMOTE" "$@"
}

echo "Тесты…"
node --test "$ROOT/tests/"

echo "Копирую сайт на $REMOTE:$DEST/public"
ssh_remote "mkdir -p '$DEST/public' '$DEST/scripts'"
rsync -a --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.DS_Store' \
  "$ROOT/index.html" "$ROOT/assets" "$REMOTE:$DEST/public/"
rsync -a \
  -e "ssh ${SSH_OPTS[*]}" \
  "$ROOT/scripts/sakura.nginx.conf" "$REMOTE:$DEST/scripts/sakura.nginx.conf"

ssh_remote "DOMAIN='$DOMAIN' DEST='$DEST' SERVER_IP='$SERVER_IP' bash -s" <<'REMOTE'
set -euo pipefail

chmod -R a+rX "$DEST/public"
install -d /var/www/letsencrypt

# Повторный деплой не должен затирать блок HTTPS, который дописал certbot.
if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" || ! -f /etc/nginx/sites-available/sakura ]]; then
  install -m 644 "$DEST/scripts/sakura.nginx.conf" /etc/nginx/sites-available/sakura
fi
ln -sf /etc/nginx/sites-available/sakura /etc/nginx/sites-enabled/sakura
nginx -t
systemctl reload nginx

resolved="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}' || true)"
# Кэш резолвера может помнить отсутствие записи; Let's Encrypt спрашивает авторитетный DNS зоны.
if [[ "$resolved" != "$SERVER_IP" ]] && command -v dig >/dev/null 2>&1; then
  ns="$(dig +short NS "${DOMAIN#*.}" | head -1)"
  if [[ -n "$ns" ]]; then
    resolved="$(dig +short "$DOMAIN" A @"$ns" | tail -1)"
  fi
fi
if [[ "$resolved" == "$SERVER_IP" ]]; then
  if ! command -v certbot >/dev/null 2>&1; then
    apt-get install -y certbot python3-certbot-nginx
  fi
  certbot --nginx -d "$DOMAIN" \
    --non-interactive --agree-tos --email ruvv@ruvv.ru \
    --redirect --keep-until-expiring
  # Второй vhost на 443 не должен ставить ipv6only=on — слот уже занят другим сайтом.
  sed -i 's/listen \[::\]:443 ssl ipv6only=on;/listen [::]:443 ssl;/' /etc/nginx/sites-available/sakura
  nginx -t
  systemctl reload nginx
  code="$(curl -sS -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" || true)"
  echo "HTTPS: https://$DOMAIN/ → $code"
else
  echo "DNS: $DOMAIN → '${resolved:-нет записи}', а нужен $SERVER_IP. HTTPS пропущен."
  echo "Добавьте A-запись $DOMAIN → $SERVER_IP и запустите деплой ещё раз."
fi

code="$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" http://127.0.0.1/ || true)"
echo "HTTP: http://$DOMAIN/ → $code"
REMOTE

echo "Деплой завершён: $DOMAIN"
