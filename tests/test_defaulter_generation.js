import pool from "../config/db.js";

async function testDefaulterGeneration() {
    console.log("\n🧪 Testing Defaulter Generation Functionality...\n");

    try {
        // Test 1: Check if monthly_attendance_summary has data
        console.log("1️⃣ Checking monthly_attendance_summary table...");
        const [monthlyRecords] = await pool.query(
            "SELECT COUNT(*) as count FROM monthly_attendance_summary"
        );
        console.log(`   ✓ Records found: ${monthlyRecords[0].count}`);

        if (monthlyRecords[0].count === 0) {
            console.log("   ⚠️  No monthly attendance data found!");
            console.log("   💡 You need to mark attendance first to generate defaulters");
        }

        // Test 2: Check if there are any defaulters (below 75%)
        console.log("\n2️⃣ Checking for potential defaulters (below 75%)...");
        const [defaultersBelow75] = await pool.query(`
      SELECT 
        student_id,
        student_name,
        year,
        stream,
        division,
        month,
        attendance_percentage
      FROM monthly_attendance_summary
      WHERE attendance_percentage < 75
      ORDER BY attendance_percentage ASC
      LIMIT 10
    `);

        if (defaultersBelow75.length > 0) {
            console.log(`   ✓ Found ${defaultersBelow75.length} defaulters (showing first 10):`);
            defaultersBelow75.forEach(d => {
                const percentage = parseFloat(d.attendance_percentage) || 0;
                console.log(`      - ${d.student_name} (${d.student_id}): ${percentage.toFixed(2)}% - ${d.year} ${d.stream} ${d.division} - Month ${d.month}`);
            });
        } else {
            console.log("   ✓ No students below 75% threshold");
            console.log("   💡 All students are above the threshold!");
        }

        // Test 3: Check if student_attendance_stats table exists and has data
        console.log("\n3️⃣ Checking student_attendance_stats table...");
        const [statsRecords] = await pool.query(
            "SELECT COUNT(*) as count FROM student_attendance_stats"
        );
        console.log(`   ✓ Records found: ${statsRecords[0].count}`);

        // Test 4: Test actual API query simulation
        console.log("\n4️⃣ Simulating API query for defaulters...");
        const threshold = 75;
        const [apiSimulation] = await pool.query(`
      SELECT 
        mas.student_id,
        mas.student_name,
        mas.roll_no,
        mas.year,
        mas.stream,
        mas.division,
        mas.subject,
        mas.month,
        mas.year_value,
        mas.total_lectures,
        mas.attended_lectures,
        mas.attendance_percentage
      FROM monthly_attendance_summary mas
      WHERE mas.attendance_percentage < ?
      ORDER BY mas.year_value DESC, mas.month DESC, mas.stream, mas.division, mas.student_id
      LIMIT 5
    `, [threshold]);

        if (apiSimulation.length > 0) {
            console.log(`   ✓ API query would return ${apiSimulation.length} results (showing first 5):`);
            apiSimulation.forEach(s => {
                const percentage = parseFloat(s.attendance_percentage) || 0;
                console.log(`      ${s.student_name} - ${s.stream} ${s.division} - ${percentage.toFixed(2)}%`);
            });
        } else {
            console.log("   ✓ API query would return 0 results");
        }

        // Test 5: Check Defaulter_History_Lists table
        console.log("\n5️⃣ Checking Defaulter_History_Lists table...");
        try {
            const [historyCount] = await pool.query(
                "SELECT COUNT(*) as count FROM Defaulter_History_Lists"
            );
            console.log(`   ✓ History records: ${historyCount[0].count}`);
        } catch (histErr) {
            console.log(`   ⚠️  History table error: ${histErr.message}`);
        }

        // Test 6: Check available streams and divisions
        console.log("\n6️⃣ Checking available filters...");
        const [streams] = await pool.query(
            "SELECT DISTINCT stream FROM student_details_db ORDER BY stream"
        );
        const [divisions] = await pool.query(
            "SELECT DISTINCT division FROM student_details_db ORDER BY division"
        );
        const [years] = await pool.query(
            "SELECT DISTINCT year FROM student_details_db ORDER BY year"
        );

        console.log(`   ✓ Available Years: ${years.map(y => y.year).join(", ")}`);
        console.log(`   ✓ Available Streams: ${streams.map(s => s.stream).join(", ")}`);
        console.log(`   ✓ Available Divisions: ${divisions.map(d => d.division).join(", ")}`);

        // Summary
        console.log("\n" + "=".repeat(60));
        console.log("📊 SUMMARY:");
        console.log("=".repeat(60));

        if (monthlyRecords[0].count > 0) {
            console.log("✅ Monthly attendance data exists");
            console.log("✅ Defaulter generation should work");
            console.log("\n💡 Steps to test in browser:");
            console.log("   1. Login as admin");
            console.log("   2. Click 'Generate Defaulter List' button");
            console.log("   3. Select filters (Year, Stream, Division, Month, Threshold)");
            console.log("   4. Click 'View' to see preview");
            console.log("   5. Click 'Export as .xlsx' to download");
        } else {
            console.log("⚠️  No attendance data available");
            console.log("⚠️  Defaulter generation will return 0 results");
            console.log("\n💡 To fix:");
            console.log("   1. Login as a teacher");
            console.log("   2. Mark attendance for your students");
            console.log("   3. Then try generating defaulters");
        }
        console.log("=".repeat(60));

    } catch (error) {
        console.error("\n❌ Test failed:", error.message);
        console.error("Stack:", error.stack);
    } finally {
        await pool.end();
    }
}

testDefaulterGeneration();
