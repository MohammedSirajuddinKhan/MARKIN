import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/authMiddleware.js";
import {
  studentDashboard,
  markAttendance,
  studentActivity,
  getAllSessions,
  getPresentSessions,
  getAbsentSessions,
  getAttendanceCalendar,
} from "../controllers/studentController.js";

const router = Router();

router.use(requireAuth, requireRole("student"));

router.get("/dashboard", studentDashboard);
router.post("/attendance/mark", markAttendance);
router.get("/activity", studentActivity);
router.get("/sessions/all", getAllSessions);
router.get("/sessions/present", getPresentSessions);
router.get("/sessions/absent", getAbsentSessions);
router.get("/attendance/calendar", getAttendanceCalendar);

export default router;
