# Design Notes

## Browser UI Rule

Product UI should not expose default browser chrome for interaction patterns that need app polish. In particular, do not use native browser dropdown controls or browser alert/confirm/prompt/notification surfaces.

Use custom templates for these patterns:

- `TemplateSelect`: app-styled listbox/dropdown controls.
- `TemplateNoticeStack`: in-app feedback messages rendered in the app shell.

Native text, number, checkbox, range, color, and file inputs may be used when they are visually styled to match the app and remain accessible.
