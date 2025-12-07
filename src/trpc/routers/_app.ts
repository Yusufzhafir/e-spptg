import { router } from '../init';
import { authRouter } from './auth/authrouter';
import { draftsRouter } from './drafts/draftsRouter';
import { documentsRouter } from './document/documentRouter';
import { submissionsRouter } from './submissions/submissionsRouter';
import { prohibitedAreasRouter } from './prohibitedAreas/prohibitedAreasRouter';
import { villagesRouter } from './villages/villagesRouter';

export const appRouter = router({
  auth: authRouter,
  drafts: draftsRouter,
  documents: documentsRouter,
  submissions: submissionsRouter,
  prohibitedAreas: prohibitedAreasRouter,
  villages: villagesRouter,
});

export type AppRouter = typeof appRouter;