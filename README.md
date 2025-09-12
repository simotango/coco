## Zalagh Plancher - Prototype (Login + Admin + Employees)

### Prérequis
- Node.js 18+
- PostgreSQL 13+ (avec pgAdmin 4)

### Base de données (pgAdmin 4)
1. Créer une base `zalagh_plancher`.
2. Dans `Query Tool`, exécuter le contenu de `db/schema.sql`.
   - Si nécessaire: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
3. Toujours dans `Query Tool`, exécuter `db/seed.sql`.

Les comptes admins seedés:
- `khalid@gmail.com`, mot de passe par défaut: `admin123`
- `lahlou@gmail.com`, mot de passe par défaut: `admin123`

Le mot de passe par défaut est défini côté serveur et peut être changé via `DEFAULT_ADMIN_PASSWORD`.

### Configuration (.env)
Créer un fichier `.env` à la racine avec vos paramètres Postgres et l’API Gemini:

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=zalagh_plancher
PGUSER=postgres
PGPASSWORD=postgres
PGSSL=false

# Ou utilisez une URL unique :
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/zalagh_plancher

JWT_SECRET=change-me
DEFAULT_ADMIN_PASSWORD=admin123
PORT=3000

# Clé API Google Gemini (requis pour /api/ai/vision et chatbot)
GEMINI_API_KEY=collez_votre_cle_ici
```

### Installation et lancement
```
npm install
npm run dev
```
Ouvrir `http://localhost:3000` puis se connecter avec un email admin seedé. La page `admin.html` permet d'ajouter des employés (IDs auto-incrémentés à partir de 0) reliés à l'admin connecté.

Pour tester l’agent IA (analyse d’image):
- Définir `GEMINI_API_KEY` dans `.env`
- Démarrer le serveur, puis ouvrir `http://localhost:3000/chatbot.html`
- Importer une image (jpg/png) et cliquer sur « Analyser »

### Endpoints
- `POST /api/auth/login` { email, password }
- `POST /api/employees` (Bearer token) { nom, prenom, secteur }
- `GET /api/employees` (Bearer token)


