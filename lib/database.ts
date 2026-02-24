import sql from 'mssql';

// First database configuration
const config1: sql.config = {
  server: process.env.DB_HOST || '',
  database: process.env.DB_NAME || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false, // Set to true if using Azure
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Second database configuration
const config2: sql.config = {
  server: process.env.DB2_HOST || '',
  database: process.env.DB2_NAME || '',
  user: process.env.DB2_USER || '',
  password: process.env.DB2_PASSWORD || '',
  options: {
    encrypt: false, // Set to true if using Azure
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool1: sql.ConnectionPool | null = null;
let pool2: sql.ConnectionPool | null = null;

export async function getConnection(database: 'db1' | 'db2' = 'db1') {
  try {
    if (database === 'db1') {
      if (!pool1) {
        pool1 = new sql.ConnectionPool(config1);
        await pool1.connect();
      }
      return pool1;
    } else {
      if (!pool2) {
        pool2 = new sql.ConnectionPool(config2);
        await pool2.connect();
      }
      return pool2;
    }
  } catch (error) {
    console.error(`Database connection failed for ${database}:`, error);
    throw error;
  }
}

// Legacy function for backward compatibility
export async function getDB1Connection() {
  return getConnection('db1');
}

export async function getDB2Connection() {
  return getConnection('db2');
}

export async function closeConnection(database?: 'db1' | 'db2') {
  try {
    if (!database) {
      // Close both connections
      if (pool1) {
        await pool1.close();
        pool1 = null;
      }
      if (pool2) {
        await pool2.close();
        pool2 = null;
      }
    } else if (database === 'db1' && pool1) {
      await pool1.close();
      pool1 = null;
    } else if (database === 'db2' && pool2) {
      await pool2.close();
      pool2 = null;
    }
  } catch (error) {
    console.error(`Error closing database connection for ${database}:`, error);
  }
}