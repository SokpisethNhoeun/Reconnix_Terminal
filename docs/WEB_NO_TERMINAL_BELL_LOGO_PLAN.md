# Web: no terminal, no bell, no sidebar logo

Status: in progress (2026-10-22). Branch `r10/web-trim` off `feature/next-update`.

## Owner's decisions

- **The whole web terminal goes.** That means the sidebar's Terminal item, the Terminal view
  (`?view=terminal`, `/terminal`), the AI Assistant cards' "Open Terminal" buttons, the
  ticket/key routes (`/api/terminal/*`, the terminal key cookie), `reconix/webterm/`, the part of
  `web/scripts/serve.mjs` that starts it, `--no-terminal`, their tests, e2e and docs. The TUI
  itself and `/web` stay.
- **The notification bell goes** from the top bar, with its panel.
- **The logo goes** from the left sidebar.
- **Code and Figma change together.** In Figma that means the components (Sidebar, TopBar,
  SidebarItem) and every frame.

## Checks

`pytest -q`, ruff, the web's `npm test`, lint, typecheck, build and full e2e. Figma: the offline
check and audit (0 url, missing or unreachable), then W50/W91 in the file.
