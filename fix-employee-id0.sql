-- Script de correction pour ajouter l'employé avec ID 0
-- Exécuter ce script dans la base de données Render

-- Vérifier si l'employé avec ID 0 existe
SELECT id, nom, prenom, email FROM employee WHERE id = 0;

-- Si l'employé n'existe pas, l'ajouter
INSERT INTO employee (id, nom, prenom, secteur, email, mdp_hash) VALUES 
(0, 'Soumia', 'Test', 'finance', 'Soumia@gmail.com', '$2a$10$rQZ8K9L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K')
ON CONFLICT (id) DO UPDATE SET
  nom = EXCLUDED.nom,
  prenom = EXCLUDED.prenom,
  secteur = EXCLUDED.secteur,
  email = EXCLUDED.email,
  mdp_hash = EXCLUDED.mdp_hash;

-- Vérifier que l'employé a été ajouté
SELECT id, nom, prenom, email, secteur FROM employee WHERE id = 0;
