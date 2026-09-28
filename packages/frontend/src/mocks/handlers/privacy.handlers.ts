import { http, type RequestHandler } from 'msw';

import type {
  ActiveExport,
  ActiveExportsResponse,
  ExportStatusResponse,
  InitiateExportResponse,
} from '../../types/dataExport.types';
import type { ExportJob } from '../../types';
import { blob, inner, ok, problems } from '../support/envelope';
import { apiUrl } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database } from '../store';

/**
 * The GDPR Article 20 data export.
 *
 * These endpoints answer with the payload's own shape rather than the standard
 * envelope, because that is what the client parses: `{ data: … }` for the job
 * documents and a real file body for the download. A handler that "helpfully"
 * enveloped them would be a handler the export could not read.
 *
 * A job is genuinely asynchronous: it is created `processing` and completes a
 * moment later, so polling, the progress state and the expiry are all exercised
 * rather than short-circuited into an instant download.
 */

/** How long a generated export stays downloadable. */
const EXPORT_TTL_DAYS = 7;

/** How long the demo takes to produce the file. Short: it is a demo. */
const PROCESSING_MS = 1_200;

/** Everything the deployment holds about one person, as the export document. */
function exportPayloadOf(userId: string): Record<string, unknown> {
  const db = database();
  const user = db.users.find((candidate) => candidate.id === userId);
  const teams = db.teams.filter((team) => team.members?.some((member) => member.userId === userId));
  const tasks = db.tasks.filter((task) => task.assigneeId === userId);
  const notifications = db.notifications.filter((notification) => notification.userId === userId);
  const barriers = db.barriers.filter(
    (barrier) => barrier.ownerId === userId || barrier.raisedById === userId
  );

  return {
    exportMetadata: {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      userId,
      format: 'json',
      dataController: 'Self-hosted deployment',
      // The address is the demo universe's reserved domain: nothing here is real.
      contactEmail: 'privacy@example.com',
      exportId: crypto.randomUUID(),
    },
    profile: user
      ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          locale: user.locale ?? null,
          termsAcceptedAt: user.termsAcceptedAt ?? null,
          createdAt: user.createdAt,
        }
      : null,
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      role: team.members?.find((member) => member.userId === userId)?.role.toUpperCase() ?? null,
      joinedAt: team.members?.find((member) => member.userId === userId)?.joinedAt ?? null,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      sprintId: task.sprintId,
      createdAt: task.createdAt,
    })),
    notifications: notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    })),
    impediments: db.impediments
      .filter((impediment) => impediment.reportedById === userId || impediment.ownerId === userId)
      .map((impediment) => ({
        id: impediment.id,
        title: impediment.title,
        status: impediment.status,
        createdAt: impediment.createdAt,
      })),
    barriers: barriers.map((barrier) => ({
      id: barrier.id,
      title: barrier.title,
      status: barrier.status,
      createdAt: barrier.createdAt,
    })),
    coachingEntries: db.coachingEntries
      .filter((entry) => entry.authorId === userId)
      .map((entry) => ({ id: entry.id, topic: entry.topic, createdAt: entry.createdAt })),
    recordCounts: {
      teams: teams.length,
      tasks: tasks.length,
      notifications: notifications.length,
      impediments: db.impediments.length,
    },
  };
}

/** The exports this person may still see: theirs, and not expired. */
function myJobs(userId: string): ExportJob[] {
  return database()
    .exportJobs.filter((job) => job.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function statusOf(job: ExportJob): ExportStatusResponse {
  const expiresAt = job.completedAt
    ? new Date(new Date(job.completedAt).getTime() + EXPORT_TTL_DAYS * 86_400_000).toISOString()
    : null;

  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    fileSize:
      job.status === 'completed' ? JSON.stringify(exportPayloadOf(job.userId)).length : null,
    completedAt: job.completedAt ?? null,
    expiresAt,
    errorMessage: job.error ?? null,
  };
}

export const privacyHandlers: RequestHandler[] = [
  // Before `/user/export-data/:jobId`: the literal segments would otherwise be
  // read as a job id.
  http.get(apiUrl('/user/export-data/status/:jobId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const job = database().exportJobs.find(
      (candidate) => candidate.id === String(params.jobId ?? '')
    );
    if (job?.userId !== user.id) {
      return problems.notFound('Export job');
    }

    return inner({ data: statusOf(job) });
  }),

  http.get(apiUrl('/user/export-data/download/:jobId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const job = database().exportJobs.find(
      (candidate) => candidate.id === String(params.jobId ?? '')
    );
    if (job?.userId !== user.id) {
      return problems.notFound('Export job');
    }
    if (job.status !== 'completed') {
      return problems.conflict('That export is not ready yet');
    }

    // A real file body, because the client asks for a blob and hands it to the
    // browser as a download.
    return blob(
      JSON.stringify(exportPayloadOf(user.id), null, 2),
      `scrumooth-export-${job.id}.json`
    );
  }),

  http.get(apiUrl('/user/export-data/active'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const active: ActiveExport[] = myJobs(user.id)
      .filter((job) => job.status === 'pending' || job.status === 'processing')
      .map((job) => ({
        jobId: job.id,
        status: job.status,
        startedAt: job.createdAt,
        createdAt: job.createdAt,
      }));

    const response: ActiveExportsResponse = { exports: active, count: active.length };
    return inner({ data: response });
  }),

  http.post(apiUrl('/user/export-data'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    // One export at a time: two jobs would produce two files with the same
    // content and leave the interface polling both.
    const running = myJobs(user.id).find(
      (job) => job.status === 'pending' || job.status === 'processing'
    );
    if (running) {
      return problems.conflict('An export is already being prepared');
    }

    const now = new Date().toISOString();
    const job: ExportJob = {
      id: crypto.randomUUID(),
      userId: user.id,
      status: 'processing',
      progress: 0,
      createdAt: now,
    };
    database().exportJobs.push(job);

    // The job completes on its own, which is what makes the progress state and
    // the polling loop real rather than decorative. A cancelled job is left
    // cancelled: producing the file anyway would ignore the request.
    const target = job;
    setTimeout(() => {
      if (target.status !== 'processing') {
        return;
      }
      target.status = 'completed';
      target.progress = 100;
      target.completedAt = new Date().toISOString();
      target.downloadUrl = `/user/export-data/download/${target.id}`;
    }, PROCESSING_MS);

    const response: InitiateExportResponse = {
      jobId: job.id,
      status: 'processing',
      estimatedCompletionTime: new Date(Date.now() + PROCESSING_MS).toISOString(),
      message: 'Your data export is being prepared.',
    };

    return inner({ data: response });
  }),

  http.delete(apiUrl('/user/export-data/:jobId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const id = String(params.jobId ?? '');
    const job = database().exportJobs.find((candidate) => candidate.id === id);
    if (job?.userId !== user.id) {
      return problems.notFound('Export job');
    }
    // Cancelling is a request the running job honours: the file is never
    // produced, which is what the caller asked for.
    if (job.status === 'processing' || job.status === 'pending') {
      job.status = 'failed';
      job.error = 'Cancelled by the account holder';
    }

    return ok(null);
  }),
];
