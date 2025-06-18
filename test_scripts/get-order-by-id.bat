@echo off
echo Getting order details by ID...
bun run get-order-by-id.ts %1
pause