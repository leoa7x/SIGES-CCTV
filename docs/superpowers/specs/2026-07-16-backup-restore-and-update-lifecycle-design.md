# SIGES-CCTV Backup, Restore, and Update Lifecycle Design

Date: 2026-07-16
Status: Draft for review

## Objective

Define the operational lifecycle for backups, restores, and offline software updates in SIGES-CCTV after deployment, with emphasis on:

- daily automatic backups
- customer-selectable backup destination
- restore operations over an already deployed SIGES instance
- offline manual updates through versioned packages
- mandatory pre-update backups
- clear rollback and operator diagnostics

This design assumes SIGES is already deployed and operating in a dedicated environment. It focuses on lifecycle operations, not first-time installation.

## Scope

This design covers:

- backup creation
- backup retention
- backup storage layout
- restore modes
- restore validation
- offline update workflow
- update safety gates
- rollback expectations
- operator-facing controls and status

This design does not cover:

- cloud backup providers
- internet-based update checks
- multi-node distributed backup orchestration
- disaster recovery across multiple sites
- third-party enterprise backup integration in phase 1

## Constraints

- The environment may operate fully offline.
- Backup storage location must be configurable by the customer.
- Restore must work on a SIGES instance that is already deployed.
- Updates will be applied manually from versioned offline packages.
- Every update must create a backup before applying changes.
- The operational model must be understandable by support personnel without repository-level knowledge.

## Design Summary

The recommended model is:

- daily automatic backups
- operator-triggered manual backups
- a distinct class of protected manual backups
- folder-based backup format, not a monolithic zip
- configurable backup path
- retention of the most recent 15 automatic backups
- selective restore support
- offline versioned update packages
- forced pre-update backup before any software change

## Backup Model

### Backup Types

SIGES will support two backup classes:

#### 1. Automatic backups

Created by schedule, once per day.

Characteristics:

- included in rotation
- automatically cleaned according to retention policy
- intended for routine operational safety

#### 2. Protected manual backups

Created by operator action.

Characteristics:

- never deleted by automatic rotation
- intended for high-risk operations such as major updates or manual interventions
- must require explicit operator deletion

This separation avoids accidental loss of important operator-created restore points while keeping routine storage growth under control.

### Backup Frequency

Default schedule:

- one automatic backup per day

The exact execution time should be configurable during deployment or operations setup, but the phase 1 expectation is daily operation with one scheduled run.

### Backup Destination

The backup destination must be configurable by the customer.

Supported locations may include:

- a local drive path
- a dedicated secondary disk
- a mapped network path accessible from the deployed server

The system must not hardcode a single backup directory as the only valid operating mode.

### Backup Format

The base backup format must be a versioned folder structure, not a single compressed archive.

Recommended layout:

```text
YYYY-MM-DD_HH-mm-ss/
  database/
  objects/
  config/
  metadata/
    restore-manifest.json
```

Optional future additions:

- `logs/`
- `checksums/`

### Why Folder-Based Format Is Preferred

Compared with a single `.zip` file, a folder-based backup is preferred because it:

- supports partial validation
- supports selective restore more naturally
- avoids requiring a large decompression step before recovery
- is easier to inspect during support operations
- scales better as backup content evolves between versions

Compressed export can exist later as an additional convenience feature, but not as the primary backup representation.

## Backup Contents

Each backup must include at least:

- database state
- object/file storage state
- runtime/application configuration required for continuity
- restore metadata

### Database

The database section must contain a consistent recoverable representation of the SIGES relational state.

### Objects

The object section must contain stored assets required by the deployed system, such as files persisted through MinIO or equivalent object storage.

### Configuration

The configuration section must include the subset of configuration required for a faithful restoration of the deployed SIGES environment, excluding secrets that are intentionally regenerated or stored under a different security model if the deployment design requires that separation.

### Metadata

Every backup must include a machine-readable manifest.

Minimum fields for `restore-manifest.json`:

- backup id
- backup type
- creation timestamp
- SIGES version
- hostname of source server
- included sections
- status of backup completion
- basic integrity/check information

## Retention Policy

Default automatic retention:

- keep the latest 15 automatic backups

Rationale:

- 7 backups may be too short if an issue is discovered late
- 30 backups may grow too aggressively depending on file/object volume
- 15 provides a practical operational balance

Protected manual backups are excluded from automatic deletion.

## Backup Execution Flow

Recommended automatic backup flow:

1. validate configured backup destination
2. create timestamped target folder
3. capture database backup
4. capture object/file storage backup
5. capture configuration backup
6. write manifest and integrity metadata
7. mark backup success or failure
8. apply automatic retention cleanup only to automatic backups

If any mandatory section fails:

- the backup must not be reported as successful
- the manifest must reflect the failure state
- the operator must be able to distinguish incomplete backups from valid restore points

## Restore Model

### Restore Targets

Restore must support operation over an already deployed SIGES environment.

It must not require full platform reinstallation as the only recovery path.

### Restore Modes

Phase 1 should support selective restore modes:

- full system restore
- database-only restore
- objects/files-only restore
- configuration-only restore

This is preferred over full-only restore because support scenarios often require targeted recovery instead of destructive replacement of everything.

### Restore Safety

Before applying restore actions, the system must:

- validate that the backup is structurally complete for the chosen restore mode
- validate version compatibility rules
- warn when the restore will overwrite current deployed state
- clearly state what components are about to be replaced

### Restore Flow

Recommended restore flow:

1. operator selects backup folder
2. system reads and validates manifest
3. system validates compatibility with deployed SIGES version
4. system displays selected restore scope
5. system stops affected services or places them in controlled maintenance mode
6. system restores selected components
7. system restarts affected services
8. system runs post-restore health checks
9. system writes restore result log

### Restore Error Handling

If restore fails:

- the system must report the failed phase explicitly
- the operator must know whether the deployment is stopped, partially restored, or safely restarted
- the system must preserve diagnostic output for support review

## Update Model

### Update Type

Updates are:

- offline
- manual
- applied from versioned packages

No internet update discovery is assumed in this design.

### Update Package

The expected delivery model is a versioned update artifact such as:

- `SIGES-Update-YYYY.MM.DD.exe`

The package must contain everything required for the update to run in an offline deployment context.

### Mandatory Pre-Update Backup

Every update must automatically create a backup before any software change is applied.

This is mandatory, not optional.

Rationale:

- reduces operator error
- guarantees a rollback baseline
- creates a consistent update audit point

### Update Flow

Recommended update flow:

1. validate current installed version
2. validate package compatibility
3. create automatic pre-update backup
4. stop affected services in controlled order
5. import or install new software artifacts
6. run migrations if required
7. restart services in required order
8. run health checks
9. write update result log

If any blocking validation fails, the update must stop before making changes.

## Version Compatibility Policy

Phase 1 should enforce a simple compatibility model:

- updates within the same major line are supported
- incompatible jumps must be blocked or require an intermediate supported path

This avoids undefined behavior from ungoverned version leaps in offline environments.

## Rollback Expectations

If an update fails after changes begin:

- the system must not silently continue in a degraded unknown state
- the operator must receive a clear failure summary
- the pre-update backup must be available for rollback

Phase 1 rollback expectation:

- operator-guided restore from the automatic pre-update backup

Automatic fully self-healing rollback is not required in phase 1, but the design must not make future automation impossible.

## Operator-Facing Controls

The deployed operational toolkit should expose at least:

- Run backup now
- Create protected manual backup
- List available backups
- Restore from backup
- Apply update package
- View last backup status
- View last update status

## Operator-Facing Status

The deployment should always make visible:

- installed SIGES version
- last successful automatic backup timestamp
- last protected manual backup timestamp
- current backup destination
- last update timestamp
- last update result

These status points reduce support ambiguity and improve operational confidence.

## Logging and Audit

Backup, restore, and update operations must produce clear audit records.

At minimum, logs should capture:

- operation type
- start time
- end time
- operator identity when relevant
- target path
- scope
- result
- failure reason when applicable

## Storage Growth Considerations

Because backups include both database and object/file storage, storage growth may become significant over time.

Phase 1 mitigations:

- automatic rotation for scheduled backups
- protected backups excluded from rotation
- configurable destination path
- visible backup size reporting where practical

Future enhancements may include differential strategies, but that is not required for phase 1.

## Testing Strategy

Validation should cover:

- scheduled automatic backup
- protected manual backup creation
- retention behavior after more than 15 automatic backups
- restore of each supported selective mode
- full restore over an already deployed SIGES instance
- update with successful migration path
- update blocked by compatibility rule
- update failure followed by guided rollback from pre-update backup

## Phased Implementation Recommendation

### Phase 1

- backup service/commands
- configurable destination
- daily automatic schedule
- protected manual backups
- 15-backup automatic retention
- selective restore
- offline manual update flow
- forced pre-update backup
- operator-visible logs and status

### Phase 2

- richer backup validation
- compressed export convenience option
- more advanced compatibility policy
- improved guided rollback UX

### Phase 3

- optional differential/incremental strategies
- enterprise backup integration options
- automated rollback orchestration where justified

## Success Criteria

This lifecycle design is successful when:

- SIGES creates one automatic backup per day to a customer-chosen path
- automatic backups rotate and keep the latest 15 entries
- protected manual backups are preserved until explicit deletion
- operators can restore selectively over a deployed SIGES instance
- every update creates a backup before applying changes
- update failures do not leave operators without a recovery path
- support personnel can understand backup and update state without reading repository internals

