// Facilitation routes: coaching log, working agreements and the cross-functionality assessment.
//
// All three belong to a specific Scrum Team, so the team context is asserted before any handler
// runs (the module's refusal names that rule). The finer rules -- the coaching log is the Scrum
// Master's alone, the assessment is recorded by the Scrum Master, a working agreement may be
// written by any member -- are asserted in the services, where the resource's own team is known.
import { Router, type Router as RouterType } from 'express';
import {
  getCoachingEntries,
  createCoachingEntry,
  updateCoachingEntry,
  deleteCoachingEntry,
  getWorkingAgreements,
  createWorkingAgreement,
  updateWorkingAgreement,
  getCrossFunctionality,
  getCrossFunctionalityAssessment,
  createCrossFunctionalityAssessment,
} from '../controllers/facilitation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { createRequireTeamContext } from '../middleware/teamContext.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { GATE_CODES } from '@scrumooth/shared';
import {
  assessmentIdSchema,
  coachingEntryIdSchema,
  agreementIdSchema,
  createAssessmentSchema,
  createCoachingEntrySchema,
  createWorkingAgreementSchema,
  teamQuerySchema,
  updateCoachingEntrySchema,
  updateWorkingAgreementSchema,
} from '../validations/facilitation.validation';

const router: RouterType = Router();

const requireFacilitationTeamContext = createRequireTeamContext({
  messageKey: 'errors:facilitation.teamMembersOnly',
  gateCode: GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY,
});

router.use(authenticate);

// References are declared before the `/:id` routes so a literal path is never read as an id.
router.get(
  '/cross-functionality',
  requireFacilitationTeamContext,
  validateQuery(teamQuerySchema),
  getCrossFunctionality
);
router.post(
  '/cross-functionality',
  requireFacilitationTeamContext,
  validateBody(createAssessmentSchema),
  createCrossFunctionalityAssessment
);
router.get(
  '/cross-functionality/:id',
  validateParams(assessmentIdSchema),
  getCrossFunctionalityAssessment
);

router.get(
  '/coaching',
  requireFacilitationTeamContext,
  validateQuery(teamQuerySchema),
  getCoachingEntries
);
router.post(
  '/coaching',
  requireFacilitationTeamContext,
  validateBody(createCoachingEntrySchema),
  createCoachingEntry
);
router.put(
  '/coaching/:id',
  validateParams(coachingEntryIdSchema),
  validateBody(updateCoachingEntrySchema),
  updateCoachingEntry
);
router.delete('/coaching/:id', validateParams(coachingEntryIdSchema), deleteCoachingEntry);

router.get(
  '/working-agreements',
  requireFacilitationTeamContext,
  validateQuery(teamQuerySchema),
  getWorkingAgreements
);
router.post(
  '/working-agreements',
  requireFacilitationTeamContext,
  validateBody(createWorkingAgreementSchema),
  createWorkingAgreement
);
// An agreement is retired, never deleted, so the team's change of mind stays visible.
router.put(
  '/working-agreements/:id',
  validateParams(agreementIdSchema),
  validateBody(updateWorkingAgreementSchema),
  updateWorkingAgreement
);

export default router;
