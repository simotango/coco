-- Seed initial admins (passwords will be hashed at runtime if absent)
-- For safety, we insert only if not exists

INSERT INTO admin (nom, prenom, email, mdp_hash)
SELECT 'Khalid', 'Admin', 'khalid@gmail.com', ''
WHERE NOT EXISTS (SELECT 1 FROM admin WHERE email='khalid@gmail.com');

INSERT INTO admin (nom, prenom, email, mdp_hash)
SELECT 'Lahlou', 'Admin', 'lahlou@gmail.com', ''
WHERE NOT EXISTS (SELECT 1 FROM admin WHERE email='lahlou@gmail.com');


