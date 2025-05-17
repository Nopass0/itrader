#!/bin/bash

# Create SSL directory if it doesn't exist
mkdir -p nginx/ssl

# Generate self-signed SSL certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/C=RU/ST=Moscow/L=Moscow/O=AITrader/OU=IT/CN=localhost"

echo "Self-signed SSL certificates have been generated."
echo "Key: nginx/ssl/key.pem"
echo "Certificate: nginx/ssl/cert.pem"