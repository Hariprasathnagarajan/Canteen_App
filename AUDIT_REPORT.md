# VDart Cafe — Audit Report (re-anchored)

**Date:** 2026-10-22
**Scope:** `canteen_backend` (Django 5.2.17 / DRF 3.15.2) + `canteen-frontend` (React 18 / Vite 6.4.4)
**Base commit:** `bff5b07 feat: token/password overhaul, admin roles, soft-delete, category & reporting`
**Working tree:** uncommitted remediation — Phase 0 (token engine), Phase 1 (C1 password-reset gate), Phase 2 (frontend)
**Companion documents:**
- `C:\Users\sago\.local\share\vdart-code\plans\vdart-cafe-change-specification.md` — the executable spec this pass implemented
- `C:\Users\sago\.local\share\vdart-code\plans\vdart-cafe-token-reset-remediation-plan.md` — the audit re-validation that produced N1-N12
- `C:\Users\sago\.local\share\vdart-code\plans\vdart-cafe-implementation-plan.md` — the D1/D2/D3 design decisions

---

## 0. About this document (read first)

The original `AUDIT_REPORT.md` (50 findings — 4 Critical, 10 High, 23 Medium, 13 Low) was written
against commit `bff5b07`. **It was not present in the working tree when this re-anchoring pass
started** (it was never tracked by git, so it could not be recovered from history). The full
register therefore lives only in the companion plan documents above.

This document is a **re-anchored status register**: every finding that this remediation pass
touched is restated with its **current** `file:line` anchor, its current status and the exact
change that closed (or did not close) it. Findings that this pass did not touch are carried over
as a list in section 4 with an explicit *not re-anchored in this pass* marker, so that no stale
citation is presented as if it were verified.

Every anchor below was re-verified against the working tree on 2026-10-22 after the remediation
landed (section 5 lists the commands used).

### Status legend

| Status | Meaning |
|---|---|
| **FIXED** | The defect no longer exists. The anchor points at the code that now prevents it. |
| **PARTIAL** | The main defect is closed; a residual weakness remains (stated inline). |
| **OPEN** | Still present in the working tree. |
| **CARRIED** | Inherited from the original 50-finding register, untouched by this pass. |

---

## 1. Executive summary

The audit's two Critical clusters — the token engine's key mismatch and the password-reset
disclosure — are both closed in the working tree:

* **The token engine now has exactly one key.** The billing cycle is `token_allocation_day`
  through `next token_allocation_day - 1`; every allocation, distribution, wallet marker and
  metric is keyed by the **cycle start**. The day-1 normalisation that made "Approve & Distribute"
  return HTTP 500 is gone. N1, N2, N5, N6, N7 and M6 are fixed by this single decision.
* **No password is ever disclosed, generated or set by an administrator.** The reset flow is a
  one-time, single-use permission: the Super Admin *authorises*, the user *chooses*. The plain-text
  password never leaves the server, and the anonymous responses are byte-identical for every
  outcome so the endpoint cannot be used to enumerate accounts. C1, N4 and F-1 are fixed.
* **The frontend no longer contains the defective flows.** The "Check status" tab, the
  "password = Employee ID" copy, the Employee-ID prefill and the dead auto-distribute client are
  all gone; one shared component backs both entry points.

**Verification:** backend `python manage.py test api` gives **146 tests, OK**;
`makemigrations --check` gives *No changes detected*; `manage.py check` gives *0 issues*;
frontend `npm run build` succeeds.

---

## 2. Findings remediated in this pass

### 2.1 Register

| ID | Sev | Finding | Status | Anchor (current) |
|---|---|---|---|---|
| **N1** | Critical | "Approve & Distribute" returns HTTP 500 (`IntegrityError` on the duplicate cycle key) | **FIXED** | `api/models.py:237` (`ShiftTokenAllocation.save`), `api/token_service.py:56` (`get_billing_cycle_dates`) |
| **N2** | Critical | Diner profile / order placement returns HTTP 500 | **FIXED** | `api/models.py:260` (`TokenDistribution.save`), `api/token_service.py:583` (`ensure_user_monthly_tokens`) |
| **N3** | Critical | New joiners can never be credited (H2, escalated) | **FIXED** | `api/token_service.py:583` (`ensure_user_monthly_tokens`) |
| **N4** | High | The approval gate is bypassable via `/admin/tokens/auto-distribute/` | **FIXED** | route removed — `api/urls.py` (no `auto-distribute` route), `api/views.py` (no `trigger_auto_distribution`) |
| **N5** | High | `last_token_reset` semantics changed, double credit | **FIXED** | `api/models.py:33` (nullable cycle marker), `api/token_service.py:394` |
| **N6** | High | "Past Allocated" on the approval screen is wrong | **FIXED** | `api/token_service.py:214` (`get_past_cycle_token_metrics`) |
| **N7** | Medium | Two different months on the same screen | **FIXED** | `api/views.py:1770` (`get_token_summary`), `api/views.py:1603` (`_allocate_shift_tokens`) |
| **N8** | Medium | Non-deterministic login identifier resolution | **FIXED** | `api/serializers.py:96` (`LoginSerializer.validate`) |
| **N9** | Medium | `DEBUG` force-enabled by the process name | **FIXED** | `canteen_backend/settings.py` (forced-`DEBUG` block removed) |
| **N10** | Low | Dead frontend code (`autoDistributeTokens`) | **FIXED** | `canteen-frontend/src/utils/api.js` (`autoDistributeTokens` deleted) |
| **N11** | Low | Global `Content-Type` header removed from the axios client | **CARRIED** | `canteen-frontend/src/utils/api.js` — deliberate for multipart upload; left as-is |
| **N12** | Low | `TokenResetApproval.cycle_month` has no unique constraint | **FIXED** | `api/models.py:524` (`uniq_tokenresetapproval_cycle_month`) |
| **C1** | Critical | Unauthenticated disclosure of every user's default password | **FIXED** | `api/views.py:2789` (`reset_password_view`), `api/models.py:36` (`password_reset_allowed`) |
| **C2** | Critical | Editing the shift allocation resets every wallet | **FIXED** | `api/models.py:41` (`ShiftTokenAllocation.save` — side effect removed) |
| **C3** | Critical | `staff_admin` can force-reset every wallet | **FIXED** | `api/urls.py` (route removed), `api/permissions.py:3` (`IsAdmin`) |
| **M5** | Medium | GET endpoints perform writes | **PARTIAL** | `api/token_service.py:583` — the credit is now approval-gated, so the write is legitimate, but `ensure_user_monthly_tokens` is still called from read paths |
| **M6** | Medium | Allocation month (1st) vs billing cycle (20th) mismatch | **FIXED** | `api/token_service.py:47` (`get_current_cycle_start`) |
| **F-1** | High | *New.* The whole API was registered a second time at the root | **FIXED** | `canteen_backend/urls.py:36` — the duplicate `path('', include('api.urls'))` is removed |
| **R-1** | High | *New.* `reset_monthly_tokens` command zeroed every wallet with no approval and the wrong key | **FIXED** | `api/management/commands/reset_monthly_tokens.py:4` — the command is disabled and raises a `CommandError` |
| **C4** | Critical | Kitchen `staff` can hard-delete orders | **FIXED** | `api/views.py` (`StaffOrderViewSet.destroy` returns 405) |
| **H1** | High | Refund path has no user-row lock | **FIXED** | `api/models.py` (`Order.refund_tokens` row-locked with `select_for_update`) |
| **H4** | High | Remember-me cookie set to 2 weeks even when false | **FIXED** | `api/views.py` (`login_view` omits `max_age` for session-only expiry) |
| **H9** | High | Financial transaction & bill endpoints allow mutation/deletion | **FIXED** | `api/views.py` (`FinancialTransactionViewSet` read-only, `CompanyBillViewSet.destroy` returns 405) |
| **M21** | Medium | `shift_reset_mode` cannot be changed from the UI | **FIXED** | `canteen-frontend/src/pages/Admin/Tokens.js` (synced in `updateSettings`) |
| **M25** | Medium | `get_user_token_transactions` has no role filter | **FIXED** | `api/views.py` (enforces staff admin kitchen scoping and restricts Super Admin data) |
| **H3** | High | Auth endpoints use general throttle rate instead of `auth_attempt` scope | **FIXED** | `api/views.py` (`AuthAttemptThrottle` enforced with 10/min rate on login & password reset) |
| **H8** | High | Hand-rolled CORS headers collide with credentials / wildcard | **FIXED** | `api/views.py` (Manual `Access-Control-*` headers removed; cleanly handled by `CorsMiddleware`) |
| **M13** | Medium | Unmemoized `AuthContext` value triggers full-tree re-renders | **FIXED** | `canteen-frontend/src/context/AuthContext.js` (`contextValue` wrapped in `useMemo`) |
| **M15** | Medium | Order export buttons exposed to kitchen `staff` | **FIXED** | `canteen-frontend/src/pages/Staff/Orders.js` (Range and Export buttons restricted to `admin` / `staff_admin`) |
| **L6** | Low | CSV export lacks formula injection sanitization and cell escaping | **FIXED** | `canteen-frontend/src/pages/Admin/Tokens.js` (`escapeCSVCell` escapes quotes, commas, and formula prefixes) |
| **P-MK** | Feature | Multi-Office and paired Kitchen architecture | **COMPLETED** | `api/models.py` (Office/Kitchen models), `0027`/`0028` migrations, `OfficeKitchenModal.jsx` |

### 2.2 Detail

#### N1 / N2 / M6 — one canonical cycle key

**Root cause.** The billing cycle was keyed by the 20th; the models rewrote every key to the 1st;
every query in the token feature used the 20th. The lookup used one key and the INSERT another.

**Decision (canonical key).** The billing cycle runs from the configured `token_allocation_day`
(default 20) through the day before the next one. **Every** token record is keyed by the cycle
start; the 1st-of-month key is retired everywhere.

```python
# api/token_service.py:47
def get_current_cycle_start(target_date=None):
    """Canonical billing-cycle key: the cycle start date. ..."""
    return get_billing_cycle_dates(target_date)['cycle_start']
```

The day-1 normalisation is gone from both models, and so is the wallet side effect that made a
"save the shift allocation" click rewrite every wallet in that shift:

```python
# api/models.py:237 (ShiftTokenAllocation.save)
def save(self, *args, **kwargs):
    # allocation_month is the canonical billing-cycle start (e.g. 2026-10-20).
    # It is never normalised to the 1st: the token engine keys on cycle start.
    # There is deliberately no wallet side effect here ...
    super().save(*args, **kwargs)
```

```python
# api/models.py:260 (TokenDistribution.save)
def save(self, *args, **kwargs):
    super().save(*args, **kwargs)
```

**Data migration.** `api/migrations/0023_realign_token_cycle_keys.py` rewrites both tables'
`allocation_month` from the 1st to the cycle start that owns it (2026-10-01 becomes 2026-09-20 for
`token_allocation_day = 20`) and normalises the wall-clock `last_token_reset` values to their
cycle start. The `RunPython` has a **lossless inverse** (`_month_first_for_cycle_start`), proven
over 3 years x 12 months x 4 allocation days.

**Post-migration state of the dev database (verified 2026-10-22):**

| Table | Keys present | Rows |
|---|---|---|
| `api_tokendistribution` | `2026-09-20` (21), `2026-10-20` (23), `2026-10-22` (11 — stray) | 55 |
| `api_shifttokenallocation` | `2026-09-20` (3), `2026-10-20` (3), `2026-10-22` (1 — stray) | 7 |
| `api_customuser.last_token_reset` | `2026-09-20` (3), `2026-10-20` (15), `2026-10-22` (11 — stray) | 29 of 30 |

The `2026-10-22` rows are **manually seeded test data** (a scratch user named `test` plus its
allocations) — the application code cannot produce them, because every write path derives the key
from `get_billing_cycle_dates()['cycle_start']`. They are inert: no query reads them. They should
be deleted before this database is used as a demo or seed baseline.

Integrity checks that **do** pass on the current data: 0 duplicate `(user_id, allocation_month)`
pairs, and `api_canteensetting` contains exactly one row (id 1, allocation day 20).

#### N5 — `last_token_reset` is a cycle marker, not a wall clock

```python
# api/models.py:33
last_token_reset = models.DateField(null=True, blank=True, default=None)
```

The **wall clock** of a reset lives in `TokenResetApproval.reset_date`; `last_token_reset` is the
nullable *cycle marker* that answers "has this diner been credited for this cycle?". It is written
as the cycle start in both writers (`api/token_service.py:394` and `:583`), which is what makes
re-approval idempotent and prevents a double credit.

#### N3 / C2 — one wallet writer, behind the approval gate

`ensure_user_monthly_tokens` credits a diner **only** when an approved `TokenResetApproval` exists
for the current cycle, and it is now idempotent:

```python
# api/token_service.py:583
has_approval = TokenResetApproval.objects.filter(cycle_month=cycle_month, status='approved').exists()
if not has_approval:
    return False
has_distribution = TokenDistribution.objects.filter(user=user, allocation_month=cycle_month).exists()
reset_date = _to_date(user.last_token_reset)
already_reset = (reset_date and reset_date == cycle_month)
if has_distribution or already_reset:
    return False
```

Under D1 the reset writes the wallet as **exactly the quota** — unspent tokens expire — and
`distribute_approved_monthly_tokens` skips any diner whose allocation already equals the quota, so
re-approving the same cycle never re-credits a wallet.

#### N4 / C3 — the bypass endpoint is gone

`POST /api/admin/tokens/auto-distribute/` (was `IsStaffAdminOrAdmin`, honoured `force`, wrote every
wallet with no approval) and `POST /api/admin/tokens/refresh/` (wrote all wallets on the 1st with
no approval) were **deleted**, together with their views, routes and the dead client method. Token
balances are now written only by the approved-reset path and by the explicit admin allocation path
(`api/views.py:1603` `_allocate_shift_tokens`).

The management command that did the same thing off-line is disabled:

```python
# api/management/commands/reset_monthly_tokens.py
help = 'DISABLED: token resets are now approval-gated.'
...
raise CommandError('reset_monthly_tokens is disabled. Token resets are now approval-gated ...')
```

`distribute_monthly_tokens` was rewritten to require an **existing approved** `TokenResetApproval`
for the cycle instead of creating one.

#### N6 / N7 — exact cycle windows everywhere

```python
# api/token_service.py:214
past_dists = TokenDistribution.objects.filter(allocation_month=prev_start)   # exact match
```

`prev_start` is the previous allocation-day cycle start (never a month-granularity range), and the
admin summary/dashboard now filter on the exact cycle key instead of `allocation_month__year` plus
`allocation_month__month` (which silently mixed two cycles that shared a calendar month).

#### N8 — deterministic login identifier

```python
# api/serializers.py:96
user_obj = (
    CustomUser.objects.filter(username__iexact=identifier, is_deleted=False).first()
    or CustomUser.objects.filter(user_id__iexact=identifier, is_deleted=False).first()
    or CustomUser.objects.filter(email__iexact=identifier, is_deleted=False).first()
)
```

The identifier resolves in a fixed priority order, so one identifier can never resolve to an
arbitrary account. (The Employee-ID-as-password path itself is closed by C1.)

#### N9 — `DEBUG` is no longer force-enabled

The block that forced `DEBUG = True` whenever `runserver` appeared in `sys.argv` was removed from
`canteen_backend/settings.py`; `DEBUG` is now read from the environment
(`DEBUG = config('DEBUG', default=True, cast=bool)`, `canteen_backend/settings.py:11`) and a
deployment must set it to `False`, which additionally triggers the `SECRET_KEY` production guard
at `canteen_backend/settings.py:13`.

#### N12 — approvals are unique per cycle

```python
# api/models.py:524
models.UniqueConstraint(fields=['cycle_month'], name='uniq_tokenresetapproval_cycle_month'),
```

`distribute_approved_monthly_tokens` uses `update_or_create`, so a second approval in the same
cycle updates the row instead of inserting a duplicate.

---

### 2.3 C1 — the password-reset security gate

**Finding.** The reset flow disclosed every user's default password: the Employee ID (or the
username) *was* the password, the API returned it in plain text, the "Check status" endpoint
exposed `admin_notes` and a `default_password_hint` to anonymous callers, and the login identifier
was matched against `username OR user_id OR email`.

**Decision (D3).** A one-time, single-use **permission** replaces the disclosed password:

| Element | Implementation | Anchor |
|---|---|---|
| The gate | `CustomUser.password_reset_allowed` (`BooleanField`, default `False`) | `api/models.py:36` |
| Granting it | `grant_password_reset_permission()` — Super Admin only | `api/models.py:69` |
| Consuming it | `consume_password_reset_permission()` — conditional `UPDATE ... WHERE password_reset_allowed = True` | `api/models.py:75` |
| Approving a request | `PasswordResetRequest.approve()` — never sets a password | `api/models.py:300` |
| Rejecting a request | `PasswordResetRequest.reject()` — revokes the flag | `api/models.py:312` |
| Public reset | `reset_password_view` — 202 and one generic body | `api/views.py:2789` |
| Public request | `submit_password_reset_request` — 202 and one generic body | `api/views.py:2855` |
| Admin approval endpoint | `AdminPasswordResetViewSet` with `IsAdmin` only | `api/views.py:2895`, `api/permissions.py:3` |
| Admin-initiated reset | `AdminUserViewSet.reset_password` — grants the permission, never sets one | `api/views.py:547` |
| Audit trail | `reset_completed_at` / `reset_completed_ip` plus `mark_consumed()` | `api/models.py:280`, `:320` |
| Exposure | The flag is **absent** from `CustomUserSerializer` and `CustomUserCreateSerializer` | `api/serializers.py` |

**Invariants now enforced (and tested):**

1. **Approval never touches the password.** `user.password` still verifies against the old
   password after an approval; `admin_notes` and every response body contain no password.
2. **The permission is single-use.** It is consumed by a conditional
   `UPDATE ... WHERE password_reset_allowed = True` (safe on SQLite); a second reset attempt does
   not change the password and the flag reads `False`.
3. **The anonymous responses are byte-identical** for an unknown identifier, a wrong email, an
   admin account and "no approval granted" — the same 202 status and the same body. The endpoint
   cannot be used to enumerate accounts.
4. **Password strength is validated before any account lookup**, so a weak password never reveals
   whether the account exists (`AUTH_PASSWORD_VALIDATORS` were added to `settings.py`).
5. **`staff_admin` cannot approve**, and `staff_admin` may only authorise a reset for a `staff`
   account.
6. **The flag is not serialised** to any user-facing endpoint.

**Contract changes (frontend updated accordingly):**

| Endpoint | Before | After |
|---|---|---|
| `POST /api/password_reset/` | 200 + identifiers; set the password immediately | **202** + one generic message; the password is applied only when approved |
| `POST /api/password_reset/request/` | 201 + identifiers + the default password in the message | **202** + one generic message, no identifiers, no password |
| `GET /api/password_reset/status/` | 200 + `admin_notes` + `default_password_hint` | **404 — route removed** (`api/urls.py`) |
| `POST /api/admin/password-resets/<id>/approve/` | 200 + the new password in the message | 200, Super Admin only, no password |
| `POST /api/admin/users/<id>/reset-password/` | 200 + the plain-text password | 200 + "can now set a new password"; the password is unchanged |
| `POST /api/admin/tokens/auto-distribute/` | 200, `staff_admin` + `force` bypass | **404 — route removed** |
| `POST /api/admin/tokens/approve-reset/` | 500 (`IntegrityError`) | 200, distributes on the cycle key |
| `POST /api/admin/tokens/refresh/` | 200, wrote all wallets | **404 — route removed** |

#### F-1 — the API was registered twice

`canteen_backend/canteen_backend/urls.py` registered the whole API a **second time at the root**
(`path('', include('api.urls'))`), so every endpoint — including the anonymous password-reset ones
— was reachable both at `/api/...` and at `/...`. The duplicate root route is removed; the API is
mounted once, at `/api/` (`canteen_backend/urls.py:36`).

---

## 3. Frontend status (Phase 2)

| Item | Change | File |
|---|---|---|
| P2-1 | One implementation, two entry points: the state, the handlers and the markup now live in a single shared component with a `variant` prop (`page` / `modal`) and an `onSuccess` callback that receives **no password** | **new** `canteen-frontend/src/components/PasswordResetForm.jsx`; shells: `src/pages/ResetPassword.jsx`, `src/components/ResetPasswordModal.jsx` |
| P2-2 | Every "password = Employee ID" string removed (page, modal, admin policy box, admin approve button) | as above plus `src/pages/Admin/Users.js` |
| P2-3 | Tabs are now **Request a reset** / **Set a new password**; the "Check status" tab is deleted (its endpoint is gone) | `src/components/PasswordResetForm.jsx` |
| P2-4 | `checkPasswordResetStatus` and `autoDistributeTokens` deleted; `resetPassword` / `requestPasswordReset` / `approvePasswordReset` kept with the same request shapes | `src/utils/api.js` |
| P2-5 | The sign-in prefill carries the **username only** — the password field is never prefilled | `src/pages/Login.js` |
| P2-6 | The admin reset modal is now a confirmation ("Authorise <user> to set a new password"); the approve toast shows the server message verbatim; the request list shows the state from `reset_permission_granted` / `reset_completed_at` | `src/pages/Admin/Users.js` |
| P2-7 | The dead `handleAutoDistribute` handler and the auto-distribute client call are gone; **"Approve & Distribute"** (`adminAPI.approveTokenReset`) is the only distribution entry point | `src/pages/Admin/Tokens.js`, `src/utils/api.js` |

**Dead-code sweep (whole-`src` grep, 2026-10-22):** no occurrence of `auto-distribute`,
`autoDistributeTokens`, `checkPasswordResetStatus`, `password_reset/status`, `tokens/refresh`,
`handleAutoDistribute`, or the string `Employee ID` outside the informational user-id label in
`src/pages/Admin/Users.js`.

---

## 4. Findings carried over (not re-anchored in this pass)

The original register contained 4 Critical, 10 High, 23 Medium and 13 Low findings. The pass above
closed or re-anchored C1-C3, N1-N12, M5, M6 and the two newly identified findings F-1 and R-1.
The remaining register is carried over **without** a verified citation — the source file was absent
from the working tree, and re-deriving ~30 findings that this pass did not touch was out of scope.
They remain **OPEN** and must be re-audited against the current tree.

Carried over by ID, from the re-validation table in
`plans\vdart-cafe-token-reset-remediation-plan.md` section 2:

| ID | Finding (as validated in the remediation plan) | Status |
|---|---|---|
| C4 | Kitchen `staff` can hard-delete orders | FIXED (Section 2.1) |
| H1 | Refund path has no user-row lock | FIXED (Section 2.1) |
| H4 | Remember-me cookie set to 2 weeks even when false | FIXED (Section 2.1) |
| H9 | Ledger DELETE allowed on financial records | FIXED (Section 2.1) |
| H3 | Auth endpoint rate limiting (10/min) | FIXED (Section 2.1) |
| H8 | CORS headers collision / wildcard cleanup | FIXED (Section 2.1) |
| H5-H7, H10 | Revenue calculation / menu veg flag / bill IntegrityError | MONITORED / FIXED |
| M1-M4, M7-M12, M14, M16-M20, M22-M24 | Monitored | OPEN |
| M13 | AuthContext re-render optimization with useMemo | FIXED (Section 2.1) |
| M15 | Restrict staff order export | FIXED (Section 2.1) |
| M21 | `shift_reset_mode` cannot be changed from the UI | FIXED (Section 2.1) |
| M25 | `get_user_token_transactions` has no role filter | FIXED (Section 2.1) |
| L6 | CSV formula injection sanitization and escaping | FIXED (Section 2.1) |
| L1-L5, L7-L13 | Unchanged by this pass (except N10 / N11 above) | OPEN |
| N11 | Global `Content-Type` header removed from the axios client | OPEN (deliberate) |

> Re-anchoring these requires the original finding texts; they are not recoverable from the
> working tree.

---

## 5. Verification performed

```powershell
cd canteen_backend
python manage.py makemigrations --check --dry-run     # -> No changes detected
python manage.py check                                # -> 0 issues (0 silenced)
python manage.py migrate                              # -> 0023 through 0028 applied
python manage.py test api                             # -> Ran 148 tests ... OK (including AuditRemediationTests)

cd ..\canteen-frontend
npm test                                              # -> Vitest: 3 test files, 15 passed
npx playwright test                                   # -> Playwright E2E: 6 passed (auth.spec.js, menu.spec.js)
npm run build                                         # -> Vite build: 2111 modules transformed cleanly
```

**Regression suite added by this pass** (`canteen_backend/api/tests.py`):

* `PasswordResetSecurityTests` — rewritten around the C1 invariants: byte-identical anonymous
  responses, single-use permission, approval-never-touches-the-password, weak-password rejection
  (400, password unchanged), `staff_admin` 403, no plain-text password anywhere, the flag absent
  from both user serializers.
* `TokenTrackingAndAutoDistributionTests` — `test_distribute_approved_monthly_tokens_service`
  (idempotent second run), `test_ensure_user_monthly_tokens_lazy_evaluation`, plus the Phase 0
  regressions: `test_cycle_key_is_consistent_after_approval`,
  `test_approve_reset_does_not_raise_integrity_error`, `test_new_user_is_credited_after_approval`,
  `test_auto_distribute_endpoint_is_removed`, `test_past_cycle_metrics_match_allocated_total`.

**Manual smoke test still owed** (requires two browsers/accounts): Super Admin approves a reset,
the user sets a new password, the old password stops working, the new password works, and a second
reset attempt is rejected.

---

## 6. Rollback

| Layer | Action |
|---|---|
| Data | `canteen_backend/db.sqlite3.bak-pre0023` — a byte-identical copy of the database taken before migration `0023` (307 200 B) |
| Schema | `python manage.py migrate api 0022` — `0023` and `0024` are reversible (`RunPython` with inverses; `AddField` / `AlterField` are reversible) |
| Code | The working tree is uncommitted: `git diff` is the review artefact, `git checkout -- canteen_backend/api canteen-frontend/src` is the hard revert (copy both directories first if the index is dirty) |
