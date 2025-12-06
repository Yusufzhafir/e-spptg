import { z } from 'zod';
import { baseProcedure, router } from '../init';
import { authRouter } from './auth/authrouter';
import { draftsRouter } from './drafts/draftsRouter';
import { documentsRouter } from './document/documentRouter';
import { submissionsRouter } from './submissions/submissionsRouter';
import { prohibitedAreasRouter } from './prohibitedAreas/prohibitedAreasRouter';
import { villagesRouter } from './villages/villagesRouter';
export const appRouter = router({
  hello: baseProcedure
    .input(
      z.object({
        text: z.string(),
      }),
    )
    .query((opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
  auth: authRouter,
  drafts: draftsRouter,
  documents: documentsRouter,
  submissions: submissionsRouter,
  prohibitedAreas: prohibitedAreasRouter,
  villages: villagesRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;