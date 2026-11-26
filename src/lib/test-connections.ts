import mssql from 'mssql';
import logger from './logger';

export async function testSQLServerConnection(config: {
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  encrypt?: boolean;
}): Promise<{ success: boolean; message: string }> {
  try {
    const pool = await mssql.connect({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: config.encrypt ?? true,
        trustServerCertificate: true,
      },
      connectionTimeout: 10000,
    });
    await pool.request().query('SELECT 1');
    await pool.close();
    return { success: true, message: 'Connection successful' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function testPostgreSQLConnection(config: {
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}): Promise<{ success: boolean; message: string }> {
  try {
    // Dynamic import for pg
    const { Client } = await import('pg' as string);
    const client = new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    });
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return { success: true, message: 'Connection successful' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
