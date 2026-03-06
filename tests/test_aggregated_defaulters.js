import pool from "../config/db.js";

async function testAggregatedDefaulters() {
    console.log("\n🧪 Testing Aggregated Defaulter Generation...\n");

    try {
        // Test 1: Check the NEW aggregated query structure
        console.log("1️⃣ Testing NEW aggregated defaulter query (across all subjects)...");
        const threshold = 75;
        const [aggregatedResults] = await pool.query(`
      SELECT 
        s.student_id,
        s.student_name,
        s.roll_no,
        s.year,
        s.stream,
        s.division,
        SUM(mas.total_lectures) as total_lectures,
        SUM(mas.attended_lectures) as attended_lectures,
        ROUND((SUM(mas.attended_lectures) / NULLIF(SUM(mas.total_lectures), 0)) * 100, 2) as attendance_percentage,
        GROUP_CONCAT(DISTINCT mas.subject ORDER BY mas.subject SEPARATOR ', ') as subjects,
        COUNT(DISTINCT mas.subject) as subject_count,
        mas.month,
        mas.year_value
      FROM student_details_db s
      INNER JOIN monthly_attendance_summary mas ON s.student_id = mas.student_id
      WHERE 1=1
      GROUP BY s.student_id, s.student_name, s.roll_no, s.year, s.stream, s.division, mas.month, mas.year_value
      HAVING attendance_percentage < ?
      ORDER BY s.year DESC, mas.month DESC, s.stream, s.division, s.student_name
      LIMIT 5
    `, [threshold]);

        if (aggregatedResults.length > 0) {
            console.log(`   ✓ Found ${aggregatedResults.length} defaulters (showing first 5):`);
            aggregatedResults.forEach(d => {
                const percentage = parseFloat(d.attendance_percentage) || 0;
                console.log(`\n      ${d.student_name} (${d.student_id})`);
                console.log(`         Year: ${d.year} | Stream: ${d.stream} | Division: ${d.division}`);
                console.log(`         Subjects: ${d.subjects}`);
                console.log(`         Subject Count: ${d.subject_count}`);
                console.log(`         Lectures: ${d.attended_lectures}/${d.total_lectures}`);
                console.log(`         Overall Attendance: ${percentage.toFixed(2)}%`);
            });
        } else {
            console.log("   ✓ No defaulters found below 75% threshold");
        }

        // Test 2: Compare OLD vs NEW approach
        console.log("\n2️⃣ Comparing OLD (per-subject) vs NEW (aggregated) approach...");

        // OLD: Per-subject defaulters
        const [oldResults] = await pool.query(`
      SELECT 
        student_id,
        student_name,
        subject,
        attendance_percentage
      FROM monthly_attendance_summary
      WHERE attendance_percentage < ?
      ORDER BY student_id, subject
      LIMIT 10
    `, [threshold]);

        console.log(`   OLD approach: ${oldResults.length} records (one per subject per student)`);
        if (oldResults.length > 0) {
            console.log(`   Example: ${oldResults[0].student_name} - ${oldResults[0].subject}: ${parseFloat(oldResults[0].attendance_percentage).toFixed(2)}%`);
        }

        // NEW: Aggregated defaulters
        const [newResults] = await pool.query(`
      SELECT 
        s.student_id,
        s.student_name,
        COUNT(DISTINCT mas.subject) as subject_count,
        ROUND((SUM(mas.attended_lectures) / NULLIF(SUM(mas.total_lectures), 0)) * 100, 2) as overall_attendance
      FROM student_details_db s
      INNER JOIN monthly_attendance_summary mas ON s.student_id = mas.student_id
      WHERE mas.month = 3
      GROUP BY s.student_id, s.student_name
      HAVING overall_attendance < ?
      LIMIT 10
    `, [threshold]);

        console.log(`   NEW approach: ${newResults.length} records (one per student, all subjects aggregated)`);
        if (newResults.length > 0) {
            console.log(`   Example: ${newResults[0].student_name} - ${newResults[0].subject_count} subjects: ${parseFloat(newResults[0].overall_attendance).toFixed(2)}% overall`);
        }

        // Test 3: Verify overall attendance calculation for a specific student
        console.log("\n3️⃣ Detailed example of overall attendance calculation...");

        const [studentExample] = await pool.query(`
      SELECT 
        mas.student_id,
        mas.student_name,
        mas.subject,
        mas.total_lectures,
        mas.attended_lectures,
        mas.attendance_percentage
      FROM monthly_attendance_summary mas
      WHERE mas.month = 3
      ORDER BY mas.student_id, mas.subject
      LIMIT 10
    `);

        if (studentExample.length > 0) {
            const studentId = studentExample[0].student_id;
            const studentName = studentExample[0].student_name;

            // Get all subjects for this student
            const [allSubjects] = await pool.query(`
        SELECT 
          subject,
          total_lectures,
          attended_lectures,
          attendance_percentage
        FROM monthly_attendance_summary
        WHERE student_id = ? AND month = 3
      `, [studentId]);

            console.log(`\n   Student: ${studentName} (${studentId})`);
            console.log(`   Individual subject attendance:`);

            let totalLectures = 0;
            let attendedLectures = 0;

            allSubjects.forEach(subj => {
                totalLectures += subj.total_lectures || 0;
                attendedLectures += subj.attended_lectures || 0;
                console.log(`      - ${subj.subject}: ${subj.attended_lectures}/${subj.total_lectures} = ${parseFloat(subj.attendance_percentage).toFixed(2)}%`);
            });

            const overallPercentage = totalLectures > 0 ? (attendedLectures / totalLectures * 100) : 0;
            console.log(`\n   📊 OVERALL CALCULATION:`);
            console.log(`      Total Lectures (all subjects): ${totalLectures}`);
            console.log(`      Attended Lectures (all subjects): ${attendedLectures}`);
            console.log(`      Overall Attendance: ${overallPercentage.toFixed(2)}%`);

            if (overallPercentage < threshold) {
                console.log(`      ❌ DEFAULTER (below ${threshold}%)`);
            } else {
                console.log(`      ✅ MEETS THRESHOLD (${threshold}%)`);
            }
        }

        // Summary
        console.log("\n" + "=".repeat(70));
        console.log("📊 SUMMARY:");
        console.log("=".repeat(70));
        console.log("✅ NEW METHOD: Calculates overall attendance across ALL subjects");
        console.log("   - Groups by student (not subject)");
        console.log("   - Sums total and attended lectures across all subjects");
        console.log("   - Calculates one overall percentage per student");
        console.log("\n💡 This ensures defaulters are identified based on their");
        console.log("   performance across ALL subjects in their year-stream-division");
        console.log("=".repeat(70));

    } catch (error) {
        console.error("\n❌ Test failed:", error.message);
        console.error("Stack:", error.stack);
    } finally {
        await pool.end();
    }
}

testAggregatedDefaulters();
