// Increment Integration Service
// Ensures each Increment is additive and compatible with all prior Increments.
import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { generateUUIDv7 } from '../utils/uuid';
import { assertIncrementTeamMember } from './incrementAccess';
import type {
  IntegrationTestResult,
  IntegrationVerificationBasis,
} from '../generated/prisma/client';

interface CreateIntegrationTestData {
  currentIncrementId: string;
  priorIncrementId: string;
  testResult: IntegrationTestResult;
  notes?: string;
}

/**
 * Increment statuses considered immutable for integration purposes. Once an
 * Increment is delivered (or archived), its integration test results and
 * verification flag must not change, mirroring the delivered-lock enforced by
 * incrementService.updateIncrement.
 */
const LOCKED_INTEGRATION_STATUSES = ['DELIVERED', 'ARCHIVED'];

export const incrementIntegrationService = {
  /**
   * Create (or update) an integration test between a current and a prior Increment.
   * A unique constraint on (currentIncrementId, priorIncrementId) means a re-run
   * overwrites the previous result rather than creating duplicates.
   */
  async createTest(userId: string, data: CreateIntegrationTestData) {
    const current = await prisma.increment.findUnique({
      where: { id: data.currentIncrementId },
    });
    if (!current) {
      throw new NotFoundError('Increment');
    }

    await assertIncrementTeamMember(userId, current.teamId);

    if (LOCKED_INTEGRATION_STATUSES.includes(current.status)) {
      throw localizedError(
        'errors:increment.deliveredLocked',
        {},
        400,
        GATE_CODES.INCREMENT_LOCKED
      );
    }

    const prior = await prisma.increment.findUnique({
      where: { id: data.priorIncrementId },
    });
    if (!prior) {
      throw new NotFoundError('Prior Increment');
    }

    if (data.currentIncrementId === data.priorIncrementId) {
      throw new BadRequestError('Current and prior increment must be different');
    }

    if (prior.teamId !== current.teamId) {
      throw new BadRequestError('Prior increment must belong to the same team');
    }

    const existing = await prisma.incrementIntegrationTest.findUnique({
      where: {
        currentIncrementId_priorIncrementId: {
          currentIncrementId: data.currentIncrementId,
          priorIncrementId: data.priorIncrementId,
        },
      },
    });

    if (existing) {
      const updated = await prisma.incrementIntegrationTest.update({
        where: { id: existing.id },
        data: {
          testResult: data.testResult,
          testedById: userId,
          testedAt: new Date(),
          notes: data.notes ?? undefined,
          updatedBy: userId,
          updatedAt: new Date(),
        },
        include: {
          currentIncrement: { select: { id: true, name: true } },
          priorIncrement: { select: { id: true, name: true } },
          testedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      await this.refreshVerificationStatus(data.currentIncrementId);
      return this.serializeTest(updated);
    }

    const test = await prisma.incrementIntegrationTest.create({
      data: {
        id: generateUUIDv7(),
        currentIncrementId: data.currentIncrementId,
        priorIncrementId: data.priorIncrementId,
        testResult: data.testResult,
        testedById: userId,
        testedAt: new Date(),
        notes: data.notes,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        currentIncrement: { select: { id: true, name: true } },
        priorIncrement: { select: { id: true, name: true } },
        testedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.refreshVerificationStatus(data.currentIncrementId);
    return this.serializeTest(test);
  },

  async getTestsForIncrement(incrementId: string, userId: string) {
    const increment = await prisma.increment.findUnique({ where: { id: incrementId } });
    if (!increment) {
      throw new NotFoundError('Increment');
    }

    await assertIncrementTeamMember(userId, increment.teamId);

    const tests = await prisma.incrementIntegrationTest.findMany({
      where: { currentIncrementId: incrementId },
      include: {
        currentIncrement: { select: { id: true, name: true } },
        priorIncrement: { select: { id: true, name: true } },
        testedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { testedAt: 'desc' },
    });

    return tests.map((t) => this.serializeTest(t));
  },

  /**
   * Explicitly verify an Increment's integration status. All prior Increments in
   * the team must have PASSED integration tests against the current Increment
   * before integrationVerified becomes true.
   */
  async verifyIntegration(userId: string, incrementId: string) {
    const increment = await prisma.increment.findUnique({ where: { id: incrementId } });
    if (!increment) {
      throw new NotFoundError('Increment');
    }

    await assertIncrementTeamMember(userId, increment.teamId);

    if (LOCKED_INTEGRATION_STATUSES.includes(increment.status)) {
      throw localizedError(
        'errors:increment.deliveredLocked',
        {},
        400,
        GATE_CODES.INCREMENT_LOCKED
      );
    }

    const priorIncrements = await prisma.increment.findMany({
      where: {
        teamId: increment.teamId,
        status: { in: ['VERIFIED', 'DELIVERED', 'ARCHIVED'] },
        NOT: { id: incrementId },
      },
      orderBy: { createdAt: 'asc' },
    });

    // First increment exemption: no prior increments to test against. Recorded as an exemption
    // with its own basis, so it is never presented as a verification against prior Increments.
    //
    // "Prior" means an Increment that carries a verified state — `VERIFIED`, `DELIVERED` or
    // `ARCHIVED`. A `DRAFT` sibling is deliberately excluded: it is an Increment the team has not
    // stood behind yet, so there is nothing for this one to be additive to and a test against it
    // would be evidence about a draft.
    if (priorIncrements.length === 0) {
      await this.setVerified(incrementId, true, userId, 'FIRST_INCREMENT_EXEMPT', 0);
      return { integrationVerified: true, priorCount: 0, allPassed: true };
    }

    const tests = await prisma.incrementIntegrationTest.findMany({
      where: { currentIncrementId: incrementId },
    });

    // Build a map of priorIncrementId -> result for quick lookup.
    const resultByPrior = new Map(tests.map((t) => [t.priorIncrementId, t.testResult]));
    const missing: string[] = [];
    const failed: string[] = [];

    for (const prior of priorIncrements) {
      const result = resultByPrior.get(prior.id);
      if (!result || result === 'PENDING') {
        missing.push(prior.name);
      } else if (result === 'FAILED') {
        failed.push(prior.name);
      }
    }

    const allPassed = missing.length === 0 && failed.length === 0;
    await this.setVerified(
      incrementId,
      allPassed,
      userId,
      allPassed ? 'PRIOR_INCREMENTS' : null,
      allPassed ? priorIncrements.length : 0
    );

    return {
      integrationVerified: allPassed,
      priorCount: priorIncrements.length,
      allPassed,
      missingTests: missing,
      failedTests: failed,
    };
  },

  /**
   * Get the dependency chain of Increments for a team, newest first.
   */
  async getIncrementChain(incrementId: string, userId: string) {
    const increment = await prisma.increment.findUnique({ where: { id: incrementId } });
    if (!increment) {
      throw new NotFoundError('Increment');
    }

    await assertIncrementTeamMember(userId, increment.teamId);

    const increments = await prisma.increment.findMany({
      where: { teamId: increment.teamId },
      orderBy: { createdAt: 'asc' },
      include: {
        sprint: { select: { id: true, name: true } },
      },
    });

    const testCounts = await prisma.incrementIntegrationTest.groupBy({
      by: ['currentIncrementId'],
      _count: { _all: true },
    });
    const testCountMap = new Map(testCounts.map((t) => [t.currentIncrementId, t._count._all]));

    return increments
      .map((inc) => ({
        id: inc.id,
        name: inc.name,
        status: inc.status,
        integrationVerified: inc.integrationVerified,
        // Carried on every node so the chain itself distinguishes a first-Increment exemption from
        // a verification against priors, instead of showing one identical badge.
        integrationVerificationBasis: inc.integrationVerificationBasis,
        integrationVerifiedPriorCount: inc.integrationVerifiedPriorCount,
        deliveredAt: inc.deliveredAt,
        sprintName: inc.sprint.name,
        hasTests: (testCountMap.get(inc.id) ?? 0) > 0,
        isCurrent: inc.id === incrementId,
      }))
      .reverse();
  },

  /**
   * Recompute and persist the integrationVerified flag for an Increment.
   */
  async refreshVerificationStatus(incrementId: string) {
    const increment = await prisma.increment.findUnique({ where: { id: incrementId } });
    if (!increment) {
      return;
    }

    const priorIncrements = await prisma.increment.findMany({
      where: {
        teamId: increment.teamId,
        status: { in: ['VERIFIED', 'DELIVERED', 'ARCHIVED'] },
        NOT: { id: incrementId },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (priorIncrements.length === 0) {
      await this.setVerified(incrementId, true, undefined, 'FIRST_INCREMENT_EXEMPT', 0);
      return;
    }

    const tests = await prisma.incrementIntegrationTest.findMany({
      where: { currentIncrementId: incrementId },
    });
    const resultByPrior = new Map(tests.map((t) => [t.priorIncrementId, t.testResult]));

    const allPassed = priorIncrements.every((prior) => resultByPrior.get(prior.id) === 'PASSED');
    await this.setVerified(
      incrementId,
      allPassed,
      undefined,
      allPassed ? 'PRIOR_INCREMENTS' : null,
      allPassed ? priorIncrements.length : 0
    );
  },

  /**
   * Persist the verification verdict *and the basis it rests on*.
   *
   * A cleared verification drops the basis and the covered count with it, so nothing claims an
   * Increment was verified against work it was never tested with.
   *
   * @param basis - `FIRST_INCREMENT_EXEMPT` when there was nothing to test against, or
   *                `PRIOR_INCREMENTS` when the verification covers the team's prior Increments.
   * @param priorCount - how many prior Increments the verification covered.
   */
  async setVerified(
    incrementId: string,
    value: boolean,
    userId?: string,
    basis?: IntegrationVerificationBasis | null,
    priorCount = 0
  ) {
    await prisma.increment.update({
      where: { id: incrementId },
      data: {
        integrationVerified: value,
        integrationVerificationBasis: value ? (basis ?? null) : null,
        integrationVerifiedPriorCount: value ? priorCount : 0,
        ...(userId ? { updatedBy: userId } : {}),
        updatedAt: new Date(),
      },
    });
  },

  serializeTest(test: {
    id: string;
    currentIncrementId: string;
    priorIncrementId: string;
    testResult: IntegrationTestResult;
    testedById: string;
    testedAt: Date;
    notes?: string | null;
    priorIncrement?: { id: string; name: string } | null;
    testedBy?: { id: string; firstName: string; lastName: string } | null;
  }) {
    return {
      id: test.id,
      currentIncrementId: test.currentIncrementId,
      priorIncrementId: test.priorIncrementId,
      testResult: test.testResult,
      testedById: test.testedById,
      testedAt: test.testedAt.toISOString(),
      notes: test.notes ?? null,
      priorIncrementName: test.priorIncrement?.name ?? null,
      testerName: test.testedBy ? `${test.testedBy.firstName} ${test.testedBy.lastName}` : null,
    };
  },
};
