# User Privileged + Desa Scope Test Plan

## Scope
Validate role/desa authorization and workflow behavior added in the latest changes:
- `Viewer` limited to Step 1 only
- `Admin`/`Verifikator` desa-scoped draft + submission access
- `Superadmin` global access
- Step 1 requires `Desa + KTP + KK + consent`
- Desa moved from Step 2 to Step 1
- Submission ownership split (`ownerUserId`) vs processor (`verifikator`)
- Dashboard list/KPI/monthly stats scoped by role

## Preconditions
1. App is running at `http://localhost:3001`.
2. DB migrations are applied (`pnpm migrate:stag`).
3. At least these users exist:
   - `SUPERADMIN_1`
   - `ADMIN_A` assigned to `DESA_A`
   - `VERIF_A` assigned to `DESA_A`
   - `VIEWER_A`
   - `VIEWER_B`
4. At least these villages exist:
   - `DESA_A`
   - `DESA_B`
5. Test data:
   - Draft `DRAFT_A1` owned by `VIEWER_A`, village `DESA_A`, Step 1 complete
   - Draft `DRAFT_B1` owned by `VIEWER_B`, village `DESA_B`, Step 1 complete
   - Legacy draft `DRAFT_LEGACY_NULL_VILLAGE` with `village_id = null`
   - Submission `SUB_A1` with `owner_user_id = VIEWER_A`, village `DESA_A`
   - Submission `SUB_B1` with `owner_user_id = VIEWER_B`, village `DESA_B`
   - Legacy submission `SUB_LEGACY_NULL_OWNER` with `owner_user_id = null`

## How To Execute
1. Run test cases in order by role blocks (`SUPERADMIN`, `ADMIN/VERIF`, `VIEWER`).
2. For each case:
   - Perform exact steps.
   - Record `PASS/FAIL` and observed behavior.
3. If auth session changes are needed, log out and log in with the specified role account.

## Test Cases

### A. Step 1 Validation + Step Navigation

1. **TC-A01 Viewer blocked from Step 2**
   - Role: `VIEWER_A`
   - Steps:
     1. Open `/app/pengajuan/draft/{new_viewer_draft}`.
     2. Fill `Nama`, valid 16-digit `NIK`, select `Desa`, upload `KTP` and `KK`, check consent.
     3. Click `Berikutnya`.
   - Expected:
     - Draft saves Step 1 successfully.
     - User remains on Step 1 (no transition to Step 2).
     - UI indicates Viewer cannot continue.

2. **TC-A02 Step 1 requires desa**
   - Role: any
   - Steps:
     1. Open Step 1.
     2. Fill all required fields except `Desa`.
     3. Click `Berikutnya`.
   - Expected: blocked with message requiring desa.

3. **TC-A03 Step 1 requires KTP and KK**
   - Role: any
   - Steps:
     1. Open Step 1.
     2. Fill all required fields + desa + consent, but upload only one of KTP/KK.
     3. Click `Berikutnya`.
   - Expected: blocked with message requiring both KTP and KK.

4. **TC-A04 Desa moved out of Step 2**
   - Role: any
   - Steps:
     1. Open Step 2 on any accessible draft.
   - Expected:
     - No editable desa selector in Step 2.
     - Desa displayed as read-only context from Step 1.

### B. Draft Access Scoping

5. **TC-B01 Superadmin sees all drafts**
   - Role: `SUPERADMIN_1`
   - Steps:
     1. Open `/app/pengajuan`.
   - Expected: includes `DRAFT_A1`, `DRAFT_B1`, and can open both.

6. **TC-B02 Admin sees only own + assigned desa drafts**
   - Role: `ADMIN_A`
   - Steps:
     1. Open `/app/pengajuan`.
   - Expected:
     - Can see drafts in `DESA_A` (including `DRAFT_A1`).
     - Cannot see `DESA_B` draft (`DRAFT_B1`).

7. **TC-B03 Verifikator same desa scope as Admin**
   - Role: `VERIF_A`
   - Steps: same as TC-B02.
   - Expected: same scope behavior as admin.

8. **TC-B04 Viewer sees own drafts only**
   - Role: `VIEWER_A`
   - Steps:
     1. Open `/app/pengajuan`.
   - Expected:
     - Sees `VIEWER_A` drafts only.
     - Cannot see `VIEWER_B` drafts.

9. **TC-B05 Legacy draft null village**
   - Role: `ADMIN_A` then `SUPERADMIN_1`
   - Steps:
     1. As admin, open list.
     2. As superadmin, open list.
   - Expected:
     - `ADMIN_A`: does **not** see `DRAFT_LEGACY_NULL_VILLAGE` unless owner is self.
     - `SUPERADMIN_1`: can see it.

10. **TC-B06 Admin without assigned village is blocked**
   - Role: admin/verifikator account with `assigned_village_id = null`
   - Steps:
     1. Open `/app/pengajuan` and `/app`.
   - Expected:
     - Requests fail with forbidden behavior.
     - UI shows data-load error (not silent success).

### C. Submission Access + Ownership

11. **TC-C01 Viewer submission list scoped by owner_user_id**
   - Role: `VIEWER_A`
   - Steps:
     1. Open dashboard `/app`.
   - Expected:
     - Submissions list contains `SUB_A1`.
     - Does not contain `SUB_B1`.

12. **TC-C02 Viewer cannot access legacy submission null owner**
   - Role: `VIEWER_A`
   - Steps:
     1. Open detail `/app/pengajuan/{SUB_LEGACY_NULL_OWNER}`.
   - Expected: 404/not found behavior.

13. **TC-C03 Admin submission scope by assigned desa**
   - Role: `ADMIN_A`
   - Steps:
     1. Open dashboard `/app`.
   - Expected:
     - Sees submissions in `DESA_A` only.
     - Cannot access `SUB_B1` detail directly.

14. **TC-C04 Superadmin can access all submission details**
   - Role: `SUPERADMIN_1`
   - Steps:
     1. Open `SUB_A1` and `SUB_B1` detail URLs.
   - Expected: both accessible.

15. **TC-C05 Processor vs owner after submitDraft**
   - Role: `ADMIN_A` (processing `VIEWER_A` draft)
   - Steps:
     1. Continue `DRAFT_A1` to submit.
     2. Inspect resulting submission row/API.
   - Expected:
     - `owner_user_id = VIEWER_A`
     - `verifikator = ADMIN_A`

### D. Dashboard Scope (List/KPI/Monthly)

16. **TC-D01 Viewer KPI and monthly scoped**
   - Role: `VIEWER_A`
   - Steps:
     1. Open `/app`.
     2. Compare list count with KPI totals and chart trends.
   - Expected: totals reflect viewer-owned data only.

17. **TC-D02 Admin KPI and monthly scoped by desa**
   - Role: `ADMIN_A`
   - Steps:
     1. Open `/app`.
   - Expected: totals/trends reflect `DESA_A` scope only.

18. **TC-D03 Superadmin KPI/monthly global**
   - Role: `SUPERADMIN_1`
   - Steps:
     1. Open `/app`.
   - Expected: totals/trends reflect all data.

### E. Documents Authorization

19. **TC-E01 Draft documents follow draft access scope**
   - Role: `ADMIN_A`
   - Steps:
     1. Access documents on `DRAFT_A1`.
     2. Try on `DRAFT_B1`.
   - Expected:
     - Allowed for `DESA_A` draft.
     - Denied for `DESA_B` draft.

20. **TC-E02 Submission documents follow submission access scope**
   - Role: `VIEWER_A`, `ADMIN_A`, `SUPERADMIN_1`
   - Steps:
     1. Attempt document listing/download on `SUB_A1` and `SUB_B1`.
   - Expected:
     - Viewer: own only.
     - Admin: desa-scoped only.
     - Superadmin: all.

### F. User Management / Assignment Policy

21. **TC-F01 Only superadmin can assign desa to admin/verifikator**
   - Role: `SUPERADMIN_1` then `ADMIN_A`
   - Steps:
     1. As superadmin, edit user role `Admin/Verifikator` and set desa.
     2. As admin, attempt to change `assignedVillageId`.
   - Expected:
     - Superadmin change succeeds.
     - Admin attempt is blocked (`FORBIDDEN` or disabled UI).

22. **TC-F02 Admin cannot elevate user role to admin/verifikator**
   - Role: `ADMIN_A`
   - Steps:
     1. Try changing a Viewer to Admin/Verifikator.
   - Expected: blocked by backend.

23. **TC-F03 Admin/verifikator must have desa assignment**
   - Role: `SUPERADMIN_1`
   - Steps:
     1. Try setting role to Admin/Verifikator with null desa.
   - Expected: validation error.

## Playwright Execution Notes
1. Use seeded account credentials per role.
2. Keep one browser profile per role or explicitly log out before switching role.
3. Always test direct URL access, not only menu navigation:
   - `/app`
   - `/app/pengajuan`
   - `/app/pengajuan/draft/{id}`
   - `/app/pengajuan/{id}`
4. Record API errors from browser console/network for each failed access case.

## Result Template

| Case ID | Role | Result | Evidence (URL + message) |
|---------|------|--------|---------------------------|
| TC-A01 | Viewer | PASS/FAIL | ... |
| ... | ... | ... | ... |

## Execution Log (2026-02-16)

### Fixture IDs used
- `villageAId=1`, `villageBId=34`
- `draftOwnAId=117`, `draftOtherAId=118`, `draftOtherBId=119`, `draftLegacyNullId=120`, `existingDraftForStepUi=116`
- `subOwnAId=164`, `subOtherBId=165`, `legacyNullOwnerSubId=131`
- `submitDraft` output submission: `166`

### Results

| Case ID | Role | Result | Evidence (URL + message) |
|---------|------|--------|---------------------------|
| TC-A01 | Viewer | PASS | `/app/pengajuan/draft/117` -> toast: `Step 1 tersimpan. Peran Viewer tidak dapat melanjutkan ke Step 2.` |
| TC-A02 | Superadmin | PASS | `/app/pengajuan/draft/116` Step 1 -> click `Berikutnya` -> toast: `Harap pilih desa terlebih dahulu` |
| TC-A03 | Superadmin | PASS | `/app/pengajuan/draft/116` Step 1 (desa selected, no KTP/KK upload) -> toast: `Dokumen KTP dan KK wajib diunggah sebelum lanjut` |
| TC-A04 | Superadmin | PASS | `/app/pengajuan/draft/116` Step 2 shows `Desa (ditentukan pada Step 1)` as read-only, no editable desa select |
| TC-B01 | Superadmin | PASS | `/app/pengajuan` shows drafts across all scopes including `AUTOTEST_DRAFT_OTHER_B` and `AUTOTEST_DRAFT_LEGACY_NULL` |
| TC-B02 | Admin (`assignedVillageId=1`) | PASS | `/app/pengajuan` shows `AUTOTEST_DRAFT_OWN_A`, `AUTOTEST_DRAFT_OTHER_A`; excludes desa B draft `AUTOTEST_DRAFT_OTHER_B` |
| TC-B03 | Verifikator (`assignedVillageId=1`) | PASS | `drafts.listMy` returns draft IDs `117`, `118`, `116`; excludes `119` |
| TC-B04 | Viewer | PASS | `/app/pengajuan` shows only own drafts (`117`, `116`); direct `/app/pengajuan/draft/118` denied |
| TC-B05 | Admin + Superadmin | PASS | Admin cannot access `draft 120` (legacy null village, not owner). Superadmin list includes `AUTOTEST_DRAFT_LEGACY_NULL` |
| TC-B06 | Admin (`assignedVillageId=null`) | PASS | `/app/pengajuan` and `/app` show: `Admin/Verifikator harus ditetapkan ke desa sebelum mengakses pengajuan.` |
| TC-C01 | Viewer | PASS | `submissions.list` returns only `AUTOTEST_SUB_OWN_A` (`ownerUserId=35`, total `1`) |
| TC-C02 | Viewer | PASS | `submissions.byId(131)` returns `404 NOT_FOUND` (`Pengajuan tidak ditemukan`) |
| TC-C03 | Admin (`assignedVillageId=1`) | PASS | `submissions.list` contains only `villageId=1`; `submissions.byId(165)` (desa B) returns `404 NOT_FOUND` |
| TC-C04 | Superadmin | PASS | `submissions.byId(164)` and `submissions.byId(165)` both `200`; legacy `131` also `200` |
| TC-C05 | Verifikator (`assignedVillageId=1`) | PASS | `POST /api/trpc/submissions.submitDraft?batch=1` body `{0:{draftId:118}}` -> creates `submissionId=166`; DB check: `owner_user_id=1`, `verifikator=35`, draft `118` deleted |
| TC-D01 | Viewer | PASS | `kpi`: total `1`, `monthlyStats`: `2026-02 => 1`, aligns with viewer-scoped `list` |
| TC-D02 | Admin (`assignedVillageId=1`) | PASS | `kpi/monthly/list` are desa-1 scoped; desa-B submission `165` excluded |
| TC-D03 | Superadmin | PASS | `kpi/monthly/list` global; includes desa-B submission `165` and all others |
| TC-E01 | Admin (`assignedVillageId=1`) | PASS | `documents.listByDraft(118)` returns docs; `documents.listByDraft(119)` returns `404 Draft tidak ditemukan` |
| TC-E02 | Viewer/Admin/Superadmin | PASS | Viewer: own submission docs allowed, other denied. Admin: desa-scope only. Superadmin: `documents.listBySubmission(165)` returns `200` |
| TC-F01 | Superadmin + Admin | PASS | Superadmin `users.update` can set `peran=Admin, assignedVillageId=1` for user `68` (`200`). Admin `users.update` with role/assignment change returns `403 FORBIDDEN` |
| TC-F02 | Admin | PASS | Admin `users.update` attempting role elevation (`peran=Superadmin`) returns `403 FORBIDDEN` |
| TC-F03 | Superadmin | PASS | Superadmin `users.update` with `peran=Admin, assignedVillageId=null` returns `400 BAD_REQUEST` (`Admin/Verifikator wajib memiliki satu desa penugasan.`) |
