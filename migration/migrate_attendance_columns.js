import pool from "../config/db.js";

async function addMissingColumns() {
    const connection = await pool.getConnection();

    try {
        console.log("🔧 Adding missing columns to attendance_records table...");

        const columnsToAdd = [
            { name: 'subject', definition: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'year', definition: 'VARCHAR(10) DEFAULT NULL' },
            { name: 'stream', definition: 'VARCHAR(64) DEFAULT NULL' },
            { name: 'division', definition: 'VARCHAR(10) DEFAULT NULL' },
            { name: 'session_date', definition: 'DATE DEFAULT NULL' }
        ];

        for (const col of columnsToAdd) {
            try {
                await connection.query(
                    `ALTER TABLE attendance_records ADD COLUMN ${col.name} ${col.definition}`
                );
                console.log(`✅ Added column: ${col.name}`);
            } catch (error) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    console.log(`ℹ️  Column ${col.name} already exists`);
                } else {
                    console.error(`❌ Error adding column ${col.name}:`, error.message);
                }
            }
        }

        console.log("✅ Migration completed!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    } finally {
        connection.release();
        await pool.end();
    }
}

addMissingColumns();
