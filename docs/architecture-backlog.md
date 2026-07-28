# Architecture Backlog

Permanent register of architectural improvements that are **intentionally postponed**.

Use this document when a cleaner design is known but deferred for MVP simplicity, risk, or sequencing. Do not silently invent parallel patterns in code — record the deferral here, cite the current decision, and name the trigger that reopens the item.

## How to use

1. Add a new `ARCH-NNN` entry when a design trade-off is accepted as temporary.
2. Keep `Status` accurate: `Deferred` → `In Progress` → `Done` (or `Cancelled` with reason).
3. Link related Prompt IDs so implementation work can reopen the item deliberately.
4. When implementing, update this file and add an ADR in `decision-log.md` if the outcome is a lasting decision.

---

## ARCH-001 — Patch-based Cost Item Update

| Field | Value |
| --- | --- |
| **ID** | ARCH-001 |
| **Title** | Patch-based Cost Item Update |
| **Status** | Deferred |
| **Priority** | Medium |
| **Related Prompt IDs** | PP-0004 |

### Current Decision

Use `CostProfileService.replaceItems()` for the MVP.

The service accepts the full item set for a profile. Add, update, remove, reorder, and active-toggle are expressed as a complete replacement of the aggregate’s items, then persisted through `CostProfileRepository.save()`.

### Why Deferred

Merchant editing is simple in the early product. Full-replace keeps:

- a single write path and transactional boundary
- invariant checks in one place (system items, sort order, value/unit rules)
- no partial-update / merge semantics to design or test yet

### Trigger for Implementation

Revisit patch-based (or item-scoped) updates when any of the following become real:

- Multiple concurrent editors on the same Cost Profile
- Audit history of individual cost-line changes is required
- Partial updates become the common UI/API pattern
- Cost collections grow large enough that full-replace is inefficient or error-prone

### Notes

Until then, feature modules and routes must not introduce ad-hoc `updateItem` / `deleteItem` persistence paths that bypass the aggregate. If those APIs are needed, promote this backlog item first.
