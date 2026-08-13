# @live-i18n/protocol

Versioned, source-control-neutral contracts shared by the Live i18n staging
editor, private Studio/API, export artifacts, and future local CLI.

The package intentionally contains no GitHub or Azure DevOps domain models.
Future integrations implement `SourceControlProvider` outside the core workflow.

## Building

Run `npm exec -- nx build protocol` to build the library.
