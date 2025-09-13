-- Render PostgreSQL Setup Script for Zalagh Plancher
-- Run this script in your Render PostgreSQL database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admins table (using gen_random_uuid() instead of uuid-ossp)
CREATE TABLE IF NOT EXISTS admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  mdp_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees table with custom id via sequence and trigger starting at 0
CREATE SEQUENCE IF NOT EXISTS employee_id_seq
  MINVALUE 0
  START 0
  INCREMENT 1;

CREATE TABLE IF NOT EXISTS employee (
  id INTEGER PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  secteur VARCHAR(50) NOT NULL CHECK (secteur IN ('finance','chantier','production')),
  email VARCHAR(255) UNIQUE,
  mdp_hash TEXT,
  adminref UUID REFERENCES admin(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION employee_id_assign()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := nextval('employee_id_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employee_id_trigger ON employee;
CREATE TRIGGER employee_id_trigger
BEFORE INSERT ON employee
FOR EACH ROW
EXECUTE PROCEDURE employee_id_assign();

-- Matiere Premiere table
CREATE TABLE IF NOT EXISTS matiere_premiere (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_matiere VARCHAR(150) NOT NULL,
  date_entree DATE NOT NULL,
  qte NUMERIC(12,2) NOT NULL CHECK (qte >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Demande table
CREATE TABLE IF NOT EXISTS demande (
  iddemande UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  telephone VARCHAR(30),
  type_projet VARCHAR(150) NOT NULL,
  plan_jpg TEXT,
  prix NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
  statut VARCHAR(20) NOT NULL CHECK (statut IN ('livré', 'encours')) DEFAULT 'encours',
  pdf_path TEXT,
  pdf_signe_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table for all communications (replaces notifications)
CREATE TABLE IF NOT EXISTS message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id INTEGER NOT NULL,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('employee','admin')),
  recipient_id INTEGER NOT NULL,
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('employee','admin')),
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'chat' CHECK (message_type IN ('chat','notification','system')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Insert sample admin data
INSERT INTO admin (nom, prenom, email, mdp_hash) VALUES 
('Khalid', 'Admin', 'khalid@gmail.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K'),
('Lahlou', 'Admin', 'lahlou@gmail.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K')
ON CONFLICT (email) DO NOTHING;

-- Insert sample employee data
INSERT INTO employee (id, nom, prenom, secteur, email, mdp_hash) VALUES 
(0, 'Soumia', 'Test', 'finance', 'Soumia@gmail.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K'),
(1, 'Ahmed', 'Finance', 'finance', 'ahmed@zalagh.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K'),
(2, 'Fatima', 'Chantier', 'chantier', 'fatima@zalagh.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K'),
(3, 'Omar', 'Production', 'production', 'omar@zalagh.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K')
ON CONFLICT (email) DO NOTHING;

-- Note: Mot de passe par défaut pour tous les employés: "employee123"

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_demande_created_at ON demande(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_employee_id ON notification(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_secteur ON employee(secteur);

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zalaghadmin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zalaghadmin;
