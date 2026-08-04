# Project Guidelines

This file outlines the structure of the repo, patterns to follow, and available AI-assisted workflows.

## Available Commands

Invoke these workflows by typing the command or trigger phrase:

| Command | Triggers | Description |
|---------|----------|-------------|
| `/spec` | "spec", "interview me", "what are we building" | Interview-driven specification development |
| `/refactor` | "refactor", "clean up", "improve code quality" | Structured code refactoring workflow |
| `/review` | "review", "code review", "check my code" | Comprehensive code review process |

Skills are located in `.claude/skills/` - read them for detailed workflows.

---

## Project Structure

This template is built with a monorepo structure:

```
├── frontend/          # Next.js/React application
├── backend/           # Express/Node.js API
├── shared/            # Shared types & utilities
│   └── types/         # Request/response types (use DB types)
├── .claude/
│   └── skills/        # AI workflow definitions
├── CLAUDE.md          # This file
└── SPEC.md            # Project specification (generated via /spec)
```

---

## Full Stack Development Pattern

Always split full stack requests into 3-4 sequential tasks:

### 1. Database Layer (if needed)
- Create schemas in the appropriate migration folder
- Run migrations to update the database

### 2. Shared Types
- Create request/response types in `shared/types/`
- Always derive from database types - never duplicate

### 3. Backend Route
- Follow: `route → controller → service → repository` pattern
- See Backend Patterns below

### 4. Frontend Components
- Break into reusable components
- See Frontend Patterns below

---

## Backend Patterns

### Architecture Flow
```
Route → Controller → Service → Repository/Client/Utils
```

### Rules

**Controllers**
- No business logic - only destructure requests and call services
- Type using handler types with `validate` and `merge` utility
- Example:
  ```typescript
  export const getUser: Handler<GetUserRequest, GetUserResponse> = async (req) => {
    const { userId } = validate(req.params, GetUserParamsSchema);
    return userService.getById(userId);
  };
  ```

**Services**
- Keep functions short and focused
- Break complex operations into multiple functions
- Handle business logic and orchestration
- Never make direct database calls

**Repositories**
- All database calls live here - nowhere else
- Use `withIdAndTimestamp` utility on all creates
- Example:
  ```typescript
  export const create = async (data: CreateUserInput): Promise<User> => {
    return db.user.create({ data: withIdAndTimestamp(data) });
  };
  ```

---

## Frontend Patterns

### Component Architecture
- Break everything into small, reusable components
- Use shadcn/ui components with the provided theme
- Prefer Server Components for performance
- Use Client Components only when needed (interactivity, hooks)

### Data Fetching
- Add new endpoints to `config/endpoints.ts`
- Add query keys to `config/queryKeys.ts`
- Create a custom hook for each endpoint:
  ```typescript
  // hooks/useUsers.ts
  export const useUsers = () => {
    return useQuery({
      queryKey: queryKeys.users.all,
      queryFn: () => api.get(endpoints.users.list),
    });
  };
  ```

### File Organization
```
frontend/
├── app/               # Next.js app router pages
├── components/
│   ├── ui/            # shadcn/ui primitives
│   └── features/      # Feature-specific components
├── hooks/             # Custom hooks (one per endpoint)
├── config/
│   ├── endpoints.ts   # API endpoint definitions
│   └── queryKeys.ts   # React Query keys
└── lib/               # Utilities
```

---

## Dependency Management

**Never edit package.json directly.**

Always use the package manager:
```bash
# Install a dependency
pnpm add <package>

# Install a dev dependency
pnpm add -D <package>

# Install in a specific workspace
pnpm add <package> --filter frontend
pnpm add <package> --filter backend
pnpm add <package> --filter shared
```

---

## Quick Reference

| Task | Location | Pattern |
|------|----------|---------|
| New API endpoint | `backend/routes/` | route → controller → service → repository |
| New DB query | `backend/repositories/` | Use `withIdAndTimestamp` on creates |
| New shared type | `shared/types/` | Derive from DB types |
| New component | `frontend/components/` | Server Component default |
| New data hook | `frontend/hooks/` | One hook per endpoint |
| New endpoint config | `frontend/config/` | Add to endpoints.ts + queryKeys.ts |
