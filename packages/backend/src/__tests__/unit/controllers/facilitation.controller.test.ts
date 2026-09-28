import { describe, it, expect, beforeEach, vi } from 'vitest';
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
} from '../../../controllers/facilitation.controller';
import { coachingEntryService } from '../../../services/coachingEntry.service';
import { workingAgreementService } from '../../../services/workingAgreement.service';
import { crossFunctionalityService } from '../../../services/crossFunctionality.service';
import { createMockRequest, createMockResponse, createMockNext, wait } from '../../setup/testSetup';

vi.mock('../../../services/coachingEntry.service', () => ({
  coachingEntryService: {
    getCoachingEntries: vi.fn(),
    createCoachingEntry: vi.fn(),
    updateCoachingEntry: vi.fn(),
    deleteCoachingEntry: vi.fn(),
  },
}));

vi.mock('../../../services/workingAgreement.service', () => ({
  workingAgreementService: {
    getWorkingAgreements: vi.fn(),
    createWorkingAgreement: vi.fn(),
    updateWorkingAgreement: vi.fn(),
  },
}));

vi.mock('../../../services/crossFunctionality.service', () => ({
  crossFunctionalityService: {
    getCrossFunctionality: vi.fn(),
    getAssessmentById: vi.fn(),
    createAssessment: vi.fn(),
  },
}));

const coaching = coachingEntryService as unknown as Record<string, ReturnType<typeof vi.fn>>;
const agreements = workingAgreementService as unknown as Record<string, ReturnType<typeof vi.fn>>;
const crossFunctionality = crossFunctionalityService as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

describe('Facilitation Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    mockReq.userId = 'user-123';
    mockReq.user = { id: 'user-123' };
    mockReq.currentTeamId = 'team-123';
    mockReq.query = {};
  });

  describe('coaching log', () => {
    it('should read the log with paging bounds', async () => {
      mockReq.query = { limit: '10', offset: '5' };
      coaching.getCoachingEntries!.mockResolvedValue({
        entries: [],
        total: 0,
        limit: 10,
        offset: 5,
      });

      await getCoachingEntries(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(coaching.getCoachingEntries).toHaveBeenCalledWith('team-123', 'user-123', {
        limit: 10,
        offset: 5,
      });
    });

    it('should fall back to the paging defaults for unusable bounds', async () => {
      mockReq.query = { limit: 10, offset: '-1' };
      coaching.getCoachingEntries!.mockResolvedValue({ entries: [], total: 0 });

      await getCoachingEntries(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(coaching.getCoachingEntries).toHaveBeenCalledWith('team-123', 'user-123', {
        limit: 50,
        offset: 0,
      });
    });

    it('should require a team', async () => {
      mockReq.currentTeamId = undefined;

      await getCoachingEntries(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('should create an entry', async () => {
      mockReq.body = { teamId: 'team-123', topic: 'OTHER', note: 'Coaching note' };
      coaching.createCoachingEntry!.mockResolvedValue({ id: 'entry-1' });

      await createCoachingEntry(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(coaching.createCoachingEntry).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ topic: 'OTHER' })
      );
      expect(mockRes._status).toBe(201);
    });

    it('should update and delete an entry by id', async () => {
      mockReq.params = { id: 'entry-123' };
      mockReq.body = { note: 'Updated' };
      coaching.updateCoachingEntry!.mockResolvedValue({ id: 'entry-123' });
      coaching.deleteCoachingEntry!.mockResolvedValue({ id: 'entry-123' });

      await updateCoachingEntry(mockReq as any, mockRes as any, mockNext);
      await wait(0);
      expect(coaching.updateCoachingEntry).toHaveBeenCalledWith('entry-123', 'user-123', {
        note: 'Updated',
      });

      await deleteCoachingEntry(mockReq as any, mockRes as any, mockNext);
      await wait(0);
      expect(coaching.deleteCoachingEntry).toHaveBeenCalledWith('entry-123', 'user-123');
    });

    it('should require an entry id', async () => {
      mockReq.params = {};

      await updateCoachingEntry(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('should require an id to delete a coaching entry', async () => {
      mockReq.params = {};

      await deleteCoachingEntry(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(coaching.deleteCoachingEntry).not.toHaveBeenCalled();
    });
  });

  describe('working agreements', () => {
    it('should read the team agreements', async () => {
      agreements.getWorkingAgreements!.mockResolvedValue([]);

      await getWorkingAgreements(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(agreements.getWorkingAgreements).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockRes._json).toEqual({ success: true, data: [] });
    });

    it('should create an agreement', async () => {
      mockReq.body = {
        teamId: 'team-123',
        title: 'No meetings before 10:00',
        description: 'Focus',
      };
      agreements.createWorkingAgreement!.mockResolvedValue({ id: 'agreement-1' });

      await createWorkingAgreement(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(agreements.createWorkingAgreement).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ title: 'No meetings before 10:00' })
      );
      expect(mockRes._status).toBe(201);
    });

    it('should retire an agreement through an update', async () => {
      mockReq.params = { id: 'agreement-123' };
      mockReq.body = { status: 'RETIRED' };
      agreements.updateWorkingAgreement!.mockResolvedValue({ id: 'agreement-123' });

      await updateWorkingAgreement(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(agreements.updateWorkingAgreement).toHaveBeenCalledWith('agreement-123', 'user-123', {
        status: 'RETIRED',
      });
    });

    it('should require an id to update an agreement', async () => {
      mockReq.params = {};

      await updateWorkingAgreement(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(agreements.updateWorkingAgreement).not.toHaveBeenCalled();
    });

    it('should resolve the team from the query when context is absent', async () => {
      mockReq.currentTeamId = undefined;
      mockReq.query = { teamId: 'team-from-query' };
      agreements.getWorkingAgreements!.mockResolvedValue([]);

      await getWorkingAgreements(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(agreements.getWorkingAgreements).toHaveBeenCalledWith('team-from-query', 'user-123');
    });

    it('should resolve the team from the body when context and query are absent', async () => {
      mockReq.currentTeamId = undefined;
      mockReq.query = {};
      mockReq.body = { teamId: 'team-from-body' };
      agreements.getWorkingAgreements!.mockResolvedValue([]);

      await getWorkingAgreements(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(agreements.getWorkingAgreements).toHaveBeenCalledWith('team-from-body', 'user-123');
    });
  });

  describe('cross-functionality', () => {
    it('should read the current assessment and history', async () => {
      crossFunctionality.getCrossFunctionality!.mockResolvedValue({ latest: null, history: [] });

      await getCrossFunctionality(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(crossFunctionality.getCrossFunctionality).toHaveBeenCalledWith('team-123', 'user-123');
    });

    it('should read one assessment by id', async () => {
      mockReq.params = { id: 'assessment-123' };
      crossFunctionality.getAssessmentById!.mockResolvedValue({ id: 'assessment-123' });

      await getCrossFunctionalityAssessment(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(crossFunctionality.getAssessmentById).toHaveBeenCalledWith(
        'assessment-123',
        'user-123'
      );
    });

    it('should require an id to read an assessment', async () => {
      mockReq.params = {};

      await getCrossFunctionalityAssessment(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(crossFunctionality.getAssessmentById).not.toHaveBeenCalled();
    });

    it('should record an assessment', async () => {
      mockReq.body = {
        teamId: 'team-123',
        skills: [{ name: 'React', coverage: 'COVERED' }],
      };
      crossFunctionality.createAssessment!.mockResolvedValue({ id: 'assessment-1' });

      await createCrossFunctionalityAssessment(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(crossFunctionality.createAssessment).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ teamId: 'team-123' })
      );
      expect(mockRes._status).toBe(201);
    });

    it('should refuse an unauthenticated write', async () => {
      mockReq.userId = undefined;
      mockReq.user = undefined;
      mockReq.body = { teamId: 'team-123', skills: [{ name: 'React', coverage: 'COVERED' }] };

      await createCrossFunctionalityAssessment(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(crossFunctionality.createAssessment).not.toHaveBeenCalled();
    });
  });
});
