-- Script de test pour vérifier la messagerie
-- Exécuter ce script dans la base de données Render

-- Vérifier la structure de la table message
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'message' 
ORDER BY ordinal_position;

-- Vérifier les données existantes
SELECT COUNT(*) as total_messages FROM message;

-- Vérifier les admins
SELECT id, nom, prenom, email FROM admin;

-- Vérifier les employés
SELECT id, nom, prenom, email, secteur FROM employee;

-- Tester l'insertion d'un message de test
INSERT INTO message (sender_id, sender_type, recipient_id, recipient_type, content)
VALUES (1, 'admin', 0, 'employee', 'Message de test de l''admin vers l''employé')
RETURNING *;

-- Vérifier que le message a été inséré
SELECT * FROM message ORDER BY created_at DESC LIMIT 5;
