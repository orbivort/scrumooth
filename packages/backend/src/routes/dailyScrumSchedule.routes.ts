// Daily Scrum Schedule Routes
import { Router, type Router as RouterType } from 'express';
import * as dailyScrumScheduleController from '../controllers/dailyScrumSchedule.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireTeamContext, requireTeamRoles } from '../middleware/teamContext.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { z } from 'zod';

const router: RouterType = Router();

router.use(authenticate);
router.use(requireTeamContext);

// The Scrum Master is accountable for ensuring the Scrum events take place, so the standing
// commitment behind the Daily Scrum is theirs to set -- the same split the event timebox uses.
// Reading it is open to every team member: a cadence nobody can see is not a commitment.
const smOnly = requireTeamRoles('SCRUM_MASTER');

/**
 * The start is an offset into a day, not a formatted string, so the API has one unambiguous
 * shape and the interface owns how it is displayed. The event's length is the fixed 15-minute
 * timebox and is deliberately not configurable here.
 */
const scheduleBodySchema = z.object({
  timezone: z.string().min(1).max(100).optional(),
  startMinute: z.number().int().min(0).max(1439),
  location: z.string().max(200).nullish(),
  locationUrl: z.string().max(2048).nullish(),
  // Whole ISO weekday numbers, Monday first; the service re-checks the set so a caller cannot
  // persist a working week it never meant to send.
  workingDays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
});

const nonWorkingDayBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation:dailyScrumSchedule.dateInvalid'),
  name: z.string().max(120).nullish(),
});

const nonWorkingDayQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const nonWorkingDayParamSchema = z.object({
  id: z.string().uuid('Invalid non-working day ID'),
});

/**
 * @route   GET /api/v1/daily-scrum-schedule
 * @desc    Get the team's standing Daily Scrum commitment
 * @access  Private (team members)
 */
router.get('/', dailyScrumScheduleController.getSchedule);

/**
 * @route   PUT /api/v1/daily-scrum-schedule
 * @desc    Record or revise the team's Daily Scrum time and place
 * @access  Private (Scrum Master)
 */
router.put(
  '/',
  smOnly,
  validateBody(scheduleBodySchema),
  dailyScrumScheduleController.saveSchedule
);

/**
 * @route   GET /api/v1/daily-scrum-schedule/non-working-days
 * @desc    List dated exceptions to the team's weekly working pattern
 * @access  Private (team members)
 */
router.get(
  '/non-working-days',
  validateQuery(nonWorkingDayQuerySchema),
  dailyScrumScheduleController.listNonWorkingDays
);

/**
 * @route   POST /api/v1/daily-scrum-schedule/non-working-days
 * @desc    Record a non-working day (holiday, company day off, team offsite)
 * @access  Private (Scrum Master)
 */
router.post(
  '/non-working-days',
  smOnly,
  validateBody(nonWorkingDayBodySchema),
  dailyScrumScheduleController.addNonWorkingDay
);

/**
 * @route   DELETE /api/v1/daily-scrum-schedule/non-working-days/:id
 * @desc    Remove a recorded non-working day
 * @access  Private (Scrum Master)
 */
router.delete(
  '/non-working-days/:id',
  smOnly,
  validateParams(nonWorkingDayParamSchema),
  dailyScrumScheduleController.deleteNonWorkingDay
);

export default router;
