# Agent Instructions

## UI Components

- Never use native browser selection UI for product controls. Do not add native HTML dropdown tags to the app surface.
- Never use browser modal/notification primitives for user feedback. Do not use `window.alert`, `window.confirm`, `window.prompt`, the browser Notification API, or one-off notification libraries.
- Use the shared template components instead: `TemplateSelect` for choice controls and `TemplateNoticeStack` for in-app feedback.
- Keep controls visually custom, keyboard reachable, and consistent with the existing neutral, compact tool UI.
