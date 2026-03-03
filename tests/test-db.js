import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function testConnection() {
    try {
        console.log("Testing MySQL connection with:");
        console.log(`Host: ${process.env.DB_HOST}`);
        console.log(`Port: ${process.env.DB_PORT}`);
        console.log(`User: ${process.env.DB_USER}`);
        console.log(`Database: ${process.env.DB_NAME}`);

        // First try to connect without database
        const poolNoDb = mysql.createPool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            authPlugins: {
                mysql_native_password: () => () => Buffer.from('')
            }
        });

        console.log("\n1. Testing connection without database...");
        await poolNoDb.query("SELECT 1");
        console.log("✅ Connection to server successful!");

        // Now try with database
        console.log("\n2. Testing connection with database...");
        await poolNoDb.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        console.log(`✅ Database '${process.env.DB_NAME}' is ready!`);

        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        await pool.query("SELECT 1");
        console.log("✅ Connection with database successful!");

        await poolNoDb.end();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error("❌ Connection failed:");
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("SQL state:", error.sqlState);
        console.error("\nFull error:", error);
        process.exit(1);
    }
}

testConnection();
