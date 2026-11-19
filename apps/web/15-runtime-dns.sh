#!/bin/sh
set -eu

# The Railway private-network DNS server is injected into the container.
# Resolve it at every Web container start instead of baking in an IP.
dns_server="$(awk '$1 == "nameserver" { print $2; exit }' /etc/resolv.conf)"
if [ -z "$dns_server" ]; then
  echo "sysadv-web: no DNS resolver in /etc/resolv.conf" >&2
  exit 1
fi

case "$dns_server" in
  *:*) dns_server="[$dns_server]" ;;
esac

sed "s|__DNS_RESOLVER__|$dns_server|g" \
  /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

nginx -t
