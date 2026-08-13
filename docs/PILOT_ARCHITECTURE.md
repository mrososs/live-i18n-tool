# Live i18n Business Pilot

The Pilot validates the protected in-context workflow before any source-control
automation is built:

1. An Azure Pipeline publishes an immutable, allowlisted nested-JSON catalog
   snapshot and deploys the matching protected staging build.
2. An invited editor launches staging from Studio with a short-lived,
   origin-bound session stored in `sessionStorage`.
3. Existing source or target values become versioned Change Entries.
4. Deterministic QA runs before submission. AI suggestions are optional and
   require an explicit human Apply action.
5. A different reviewer approves or requests changes.
6. Approval produces an immutable manifest and per-file RFC 6902 `test` plus
   `replace` patches.
7. A developer applies the artifact and commits through the existing Azure
   DevOps workflow. Live i18n never commits, pushes, or creates a pull request.

The public repository owns the hardened local editor, staging bridge, protocol,
and future CLI. Authentication, organizations/projects, roles, edit sessions,
Change Set persistence, AI, review, audit, metrics, and exports are implemented
as a private Nx modular monolith.

Core workflow services must not import SCM-specific types. The neutral
`SourceControlProvider` contract in `@live-i18n/protocol` is reserved for a
future adapter. Azure DevOps is implemented first only after repeated Pilot use
shows that manual post-approval application is the primary remaining friction.
