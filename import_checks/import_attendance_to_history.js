/**
 * Import generated attendance sheets into attendance_backup table
 * This makes them visible in View History
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ATTENDANCE_FOLDER = path.join(__dirname, 'attendance_sheets_2022_2024');

// Month name to number mapping
const monthNameToNumber = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
};

/**
 * Parse filename to extract metadata
 * Format: Attendance_{STREAM}_{SUBJECT}_{MONTH}_{YEAR}.xlsx
 */
function parseFilename(filename) {
    const parts = filename.replace('.xlsx', '').split('_');

    // Find indices
    const streamIndex = 1;
    const yearIndex = parts.length - 1;
    const monthIndex = parts.length - 2;

    const year = parseInt(parts[yearIndex]);
    const monthName = parts[monthIndex];
    const month = monthNameToNumber[monthName];
    const stream = parts[streamIndex];

    // Subject is everything between stream and month
    const subject = parts.slice(streamIndex + 1, monthIndex).join(' ');

    return {
        stream,
        subject,
        month,
        monthName,
        year,
        filename
    };
}

/**
 * Read and parse Excel file
 */
function readExcelFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    return data;
}

/**
 * Convert Excel file to base64
 */
function fileToBase64(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return fileBuffer.toString('base64');
}

/**
 * Get teacher ID from subject (simplified mapping)
 */
const teacherMapping = {
    'Database Management Systems': 'TCH001',
    'Web Development': 'TCH002',
    'Operating Systems': 'TCH003',
    'Computer Networks': 'TCH004',
    'AI Fundamentals': 'TCH008',
    'Machine Learning': 'TCH009',
    'Statistics for Data Science': 'TCH010',
    'Big Data Analytics': 'TCH011'
};

/**
 * Process single file and insert into database
 */
async function processFile(filePath, filename) {
    try {
        // Parse filename
        const metadata = parseFilename(filename);

        // Read Excel data
        const excelData = readExcelFile(filePath);

        if (!excelData || excelData.length === 0) {
            console.log(`⚠️  Skipping ${filename} - No data found`);
            return false;
        }

        // Get teacher ID
        const teacherId = teacherMapping[metadata.subject] || 'TCH001';

        // Get division from first student record
        const division = excelData[0]?.Division || 'A';

        // Convert to base64
        const fileContent = fileToBase64(filePath);

        // Create records JSON (simplified format)
        const records = excelData.map(row => ({
            studentId: row['Student ID'],
            name: row['Name'],
            rollNo: row['Roll No'],
            status: row['Attendance Percentage'] >= 75 ? 'P' : 'A',
            attendancePercentage: row['Attendance Percentage']
        }));

        // Create started_at timestamp
        const startedAt = new Date(metadata.year, metadata.month - 1, 15, 10, 0, 0);

        // Create session ID
        const sessionId = `SESSION_${metadata.year}_${metadata.month}_${metadata.stream}_${metadata.subject.replace(/\s+/g, '_')}`;

        // Insert into database
        await pool.query(
            `INSERT INTO attendance_backup 
        (filename, session_id, teacher_id, subject, year, stream, division, started_at, records, file_content, saved_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                filename,
                sessionId,
                teacherId,
                metadata.subject,
                'FY', // Academic year
                metadata.stream,
                division,
                startedAt,
                JSON.stringify(records),
                fileContent,
                new Date(metadata.year, metadata.month - 1, 20, 14, 30, 0) // Saved a few days after session
            ]
        );

        return true;
    } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error.message);
        return false;
    }
}

/**
 * Main function
 */
async function importToHistory() {
    console.log('\n========================================');
    console.log('IMPORTING ATTENDANCE SHEETS TO HISTORY');
    console.log('========================================\n');

    try {
        // Check if folder exists
        if (!fs.existsSync(ATTENDANCE_FOLDER)) {
            console.error(`❌ Folder not found: ${ATTENDANCE_FOLDER}`);
            process.exit(1);
        }

        // Get all Excel files
        const files = fs.readdirSync(ATTENDANCE_FOLDER)
            .filter(file => file.endsWith('.xlsx'));

        console.log(`📁 Found ${files.length} Excel files\n`);

        if (files.length === 0) {
            console.log('⚠️  No Excel files found in the folder');
            process.exit(0);
        }

        let successCount = 0;
        let errorCount = 0;

        // Process each file
        for (let i = 0; i < files.length; i++) {
            const filename = files[i];
            const filePath = path.join(ATTENDANCE_FOLDER, filename);

            console.log(`[${i + 1}/${files.length}] Processing: ${filename}`);

            const success = await processFile(filePath, filename);

            if (success) {
                successCount++;
                console.log(`✅ Imported successfully\n`);
            } else {
                errorCount++;
                console.log(`❌ Failed to import\n`);
            }

            // Brief pause to avoid overwhelming the database
            if (i % 10 === 0 && i > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log('\n========================================');
        console.log('IMPORT COMPLETE');
        console.log('========================================\n');
        console.log(`✅ Successfully imported: ${successCount} files`);
        if (errorCount > 0) {
            console.log(`❌ Failed to import: ${errorCount} files`);
        }
        console.log(`\n📊 Total records in attendance_backup table`);

        // Count total records
        const [result] = await pool.query('SELECT COUNT(*) as count FROM attendance_backup');
        console.log(`   ${result[0].count} entries\n`);

        console.log('✅ All attendance sheets are now visible in View History!\n');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await pool.end();
    }
}

// Run the import
importToHistory();
