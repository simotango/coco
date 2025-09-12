-- Azure PostgreSQL Setup Script for Zalagh Plancher
-- Run this script in your Azure PostgreSQL database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the main database schema
\i db/schema.sql

-- Insert initial data
\i db/seed.sql

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_demande_created_at ON demande(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_employee_id ON notification(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_secteur ON employee(secteur);

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zalaghadmin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zalaghadmin;
