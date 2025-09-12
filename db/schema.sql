-- PostgreSQL schema for Zalagh Plancher minimal system

-- Create extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admins table
CREATE TABLE IF NOT EXISTS admin (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_matiere VARCHAR(150) NOT NULL,
  date_entree DATE NOT NULL,
  qte NUMERIC(12,2) NOT NULL CHECK (qte >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Demande table
CREATE TABLE IF NOT EXISTS demande (
  iddemande UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  telephone VARCHAR(30),
  type_projet VARCHAR(150) NOT NULL,
  plan_jpg TEXT, -- path under uploads/
  prix NUMERIC(12,2) NOT NULL CHECK (prix >= 0),
  statut VARCHAR(20) NOT NULL CHECK (statut IN ('livré', 'encours')) DEFAULT 'encours',
  pdf_path TEXT, -- generated quote PDF path under pdfs/
  pdf_signe_path TEXT, -- uploaded signed/validated PDF path under pdfs/
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications to employees
CREATE TABLE IF NOT EXISTS notification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id INTEGER REFERENCES employee(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body_html TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  taken_at TIMESTAMP WITH TIME ZONE,
  created_by_admin UUID REFERENCES admin(id)
);

-- Notification replies
CREATE TABLE IF NOT EXISTS notification_reply (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID REFERENCES notification(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('employee','admin')),
  sender_employee_id INTEGER,
  sender_admin_id UUID,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


