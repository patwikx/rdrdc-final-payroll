import sql from "mssql"

const config1: sql.config = {
  server: process.env.DB_HOST || "",
  database: process.env.DB_NAME || "",
  user: process.env.DB_USER || "",
  password: process.env.DB_PASSWORD || "",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

const config2: sql.config = {
  server: process.env.DB2_HOST || "",
  database: process.env.DB2_NAME || "",
  user: process.env.DB2_USER || "",
  password: process.env.DB2_PASSWORD || "",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

const config3: sql.config = {
  server: process.env.DB3_HOST || "",
  database: process.env.DB3_NAME || "",
  user: process.env.DB3_USER || "",
  password: process.env.DB3_PASSWORD || "",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

let pool1: sql.ConnectionPool | null = null
let pool2: sql.ConnectionPool | null = null
let pool3: sql.ConnectionPool | null = null

export async function getConnection(database: "db1" | "db2" | "db3" = "db1") {
  try {
    if (database === "db1") {
      if (!pool1) {
        pool1 = new sql.ConnectionPool(config1)
        await pool1.connect()
      }

      return pool1
    }

    if (database === "db2") {
      if (!pool2) {
        pool2 = new sql.ConnectionPool(config2)
        await pool2.connect()
      }

      return pool2
    }

    if (!pool3) {
      pool3 = new sql.ConnectionPool(config3)
      await pool3.connect()
    }

    return pool3
  } catch (error) {
    console.error(`Database connection failed for ${database}:`, error)
    throw error
  }
}

export async function getDB1Connection() {
  return getConnection("db1")
}

export async function getDB2Connection() {
  return getConnection("db2")
}

export async function getDB3Connection() {
  return getConnection("db3")
}

export async function closeConnection(database?: "db1" | "db2" | "db3") {
  try {
    if (!database) {
      if (pool1) {
        await pool1.close()
        pool1 = null
      }

      if (pool2) {
        await pool2.close()
        pool2 = null
      }

      if (pool3) {
        await pool3.close()
        pool3 = null
      }

      return
    }

    if (database === "db1" && pool1) {
      await pool1.close()
      pool1 = null
      return
    }

    if (database === "db2" && pool2) {
      await pool2.close()
      pool2 = null
      return
    }

    if (database === "db3" && pool3) {
      await pool3.close()
      pool3 = null
    }
  } catch (error) {
    console.error(`Error closing database connection for ${database}:`, error)
  }
}
