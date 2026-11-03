# Contributing to Wise Laundry

Thank you for collaborating on Wise Laundry! Please review the guidelines below to ensure a smooth workflow.

## Workspace Guidelines

- **Frontend Scope:** All customer frontend development work takes place strictly inside the `frontend/` directory.
- **Backend Scope:** Backend work is handled separately. The `backend/` directory is currently reserved and should remain untouched during this phase.

## Git & Collaboration Workflow

- **Branching Strategy:** Create descriptive feature branches for new work and submit pull requests to the original repository.
- **Protected Files & Secrets:** Never commit `node_modules`, `dist`, real `.env` files, or any secret credentials to version control.
- **Lockfile Integrity:** Always commit `package-lock.json` whenever dependencies are added, updated, or removed.
- **Directory Structure:** Do not reorganize or alter the agreed folder structure without prior discussion.

## Architectural Conventions

- **Pages (`src/pages/`):** Keep page files focused purely on routing and assembling feature components. Avoid putting complex business logic or heavy inline styling in page files.
- **Shared vs Feature UI:**
  - Place reusable, domain-agnostic UI elements in `src/components/` (e.g., `ui/`, `navigation/`, `feedback/`).
  - Place feature-specific components and business hooks inside `src/features/` under their respective domain folder (e.g., `auth/`, `orders/`, `services/`, `tracking/`, `addresses/`, `profile/`).
- **Backend Integration:** Route all future API communication and backend requests through `src/services/api-client.js`.
- **Demo Data:** Keep all temporary mock data and prototype fixtures within `src/demo/`.

