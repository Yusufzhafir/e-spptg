import { router } from '../init';
import { authRouter } from './auth/authrouter';
import { draftsRouter } from './drafts/draftsRouter';
import { documentsRouter } from './document/documentRouter';
import { submissionsRouter } from './submissions/submissionsRouter';
import { prohibitedAreasRouter } from './prohibitedAreas/prohibitedAreasRouter';
import { villagesRouter } from './villages/villagesRouter';
import { usersRouter } from './users/usersRouter';
import { commentsRouter } from './comments/commentsRouter';
import { notificationsRouter } from './notifications/notificationsRouter';

export const appRouter = router({
  auth: authRouter,
  drafts: draftsRouter,
  documents: documentsRouter,
  submissions: submissionsRouter,
  prohibitedAreas: prohibitedAreasRouter,
  villages: villagesRouter,
  users: usersRouter,
  comments: commentsRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;