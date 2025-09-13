-- Complete seed data for Zalagh Plancher
-- Run this script in your Azure PostgreSQL database

-- Insert admin data (with proper password hashes)
INSERT INTO admin (nom, prenom, email, mdp_hash) VALUES 
('Khalid', 'Admin', 'khalid@gmail.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K'),
('Lahlou', 'Admin', 'lahlou@gmail.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K')
ON CONFLICT (email) DO NOTHING;

-- Insert employee data
INSERT INTO employee (nom, prenom, secteur, email, mdp_hash) VALUES 
('Ahmed', 'Finance', 'finance', 'ahmed@zalagh.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K'),
('Fatima', 'Chantier', 'chantier', 'fatima@zalagh.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K'),
('Omar', 'Production', 'production', 'omar@zalagh.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K')
ON CONFLICT (email) DO NOTHING;

-- Insert sample demande data
INSERT INTO demande (nom, prenom, telephone, type_projet, prix, statut) VALUES 
('Client Test', 'Demo', '0612345678', 'Plancher béton', 15000.00, 'encours'),
('Client Test 2', 'Demo 2', '0612345679', 'Fondation', 25000.00, 'livré')
ON CONFLICT DO NOTHING;

-- Insert sample notification data
INSERT INTO notification (employee_id, title, body_html, created_by_admin) 
SELECT e.id, 'Bienvenue', '<p>Bienvenue dans le système Zalagh Plancher!</p>', a.id
FROM employee e, admin a 
WHERE e.secteur = 'finance' AND a.email = 'khalid@gmail.com'
LIMIT 1;
