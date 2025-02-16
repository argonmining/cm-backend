import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test the connection
pool.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Successfully connected to the database');
    }
});

export default pool;
