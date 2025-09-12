// Azure App Service Startup Script
// This ensures the database is properly initialized before starting the server

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function initializeDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD !== undefined ? String(process.env.PGPASSWORD) : undefined,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    
    // Test connection
    await client.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    
    // Check if tables exist
    const { rows } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('admin', 'employee', 'demande', 'notification')
    `);
    
    if (rows.length < 4) {
      console.log('⚠️  Database schema incomplete. Please run the migration script.');
    } else {
      console.log('✅ Database schema verified');
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('Please check your database configuration and try again.');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Initialize database before starting the server
initializeDatabase()
  .then(() => {
    console.log('🚀 Starting Zalagh Plancher server...');
    // Import and start the main server
    import('./server.js');
  })
  .catch((error) => {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  });
