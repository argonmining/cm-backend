-- Create the database if it doesn't exist
CREATE DATABASE claims_db;

-- Connect to the database
\c claims_db;

-- Create enum for claim status
CREATE TYPE claim_status AS ENUM ('processing', 'completed', 'failed');

-- Create claims table
CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(70) NOT NULL,
    amount VARCHAR(255) NOT NULL,
    status claim_status NOT NULL DEFAULT 'processing',
    transaction_hash VARCHAR(255),
    transaction_error TEXT,
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_wallet_address ON claims(wallet_address);
CREATE INDEX idx_status ON claims(status);
CREATE INDEX idx_created_at ON claims(created_at);
CREATE INDEX idx_ip_address ON claims(ip_address);

-- Create index for 24-hour claim check query
CREATE INDEX idx_wallet_status_created ON claims(wallet_address, status, created_at);
CREATE INDEX idx_ip_status_created ON claims(ip_address, status, created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_claims_updated_at
    BEFORE UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 