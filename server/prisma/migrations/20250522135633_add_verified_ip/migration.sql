-- Add verified_ip field to proxies table
ALTER TABLE proxies ADD COLUMN verified_ip TEXT;
