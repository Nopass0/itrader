#!/bin/bash

# Quick script to create admin account

echo "Creating admin account..."

# Use the manage-webserver-accounts.ts script directly
bun run manage-webserver-accounts.ts create admin admin admin123

echo ""
echo "Admin account created!"
echo "Username: admin"
echo "Password: admin123"
echo ""
echo "You can now login at http://$(hostname -I | awk '{print $1}'):3000"