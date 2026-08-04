---
name: refactor
description: Structured code refactoring workflow with safety checks. Use when improving code quality, reducing duplication, improving architecture, or cleaning up technical debt. Triggers on "refactor", "clean up", "improve code quality", "reduce duplication", or when code smells are identified.
---

# Refactor Workflow

## Purpose

Safely improve code quality while preserving functionality through systematic, incremental changes with verification at each step.

## Process

### 1. Assess Current State

Before any changes:
- Read SPEC.md and CLAUDE.md if they exist
- Identify the scope of refactoring (file, module, feature, system)
- List existing tests and their coverage
- Document current behavior to preserve

### 2. Identify Refactoring Targets

Analyze code for:

**Structural Issues**
- Duplicated code (DRY violations)
- Long functions (>50 lines)
- Deep nesting (>3 levels)
- Large files (>300 lines)
- God classes/modules

**Pattern Violations**
- Business logic in controllers (should be in services)
- Database calls outside repositories
- Mixed concerns in single files
- Inconsistent naming conventions

**Architecture Issues**
- Circular dependencies
- Tight coupling between modules
- Missing abstractions
- Leaky abstractions

### 3. Plan the Refactor

Create a step-by-step plan:
1. List each change as an atomic commit
2. Order changes to minimize risk (small → large)
3. Identify verification method for each step
4. Note any new tests needed

**Example Plan:**
```
1. Extract duplicated validation logic → shared/utils/validation.ts
   Verify: Run existing tests, manual test endpoints
   
2. Split UserService into UserService + UserNotificationService
   Verify: Run user tests, check no circular deps
   
3. Move DB calls from UserService to UserRepository
   Verify: Run integration tests
```

### 4. Execute Incrementally

For each planned change:

1. **Make the change** - Single atomic modification
2. **Verify** - Run tests, type check, lint
3. **Commit mentally** - Only proceed if verification passes
4. **Document** - Note any discoveries or scope changes

If verification fails:
- Revert the change
- Analyze why
- Adjust plan or break into smaller steps

### 5. Verify Final State

After all changes:
- Run full test suite
- Verify no type errors
- Check for new lint warnings
- Compare behavior to documented original state
- Update any affected documentation

## Refactoring Patterns

### Extract Function
```typescript
// Before
function processOrder(order: Order) {
  // 20 lines of validation
  // 30 lines of processing
}

// After
function processOrder(order: Order) {
  validateOrder(order);
  executeOrderProcessing(order);
}
```

### Extract Module
When a file exceeds 300 lines or has multiple concerns:
```
// Before: services/user.ts (500 lines)

// After:
services/
├── user/
│   ├── index.ts           # Public exports
│   ├── user.service.ts    # Core user operations
│   ├── user.auth.ts       # Authentication logic
│   └── user.notifications.ts
```

### Replace Conditional with Polymorphism
```typescript
// Before
function getPrice(type: string) {
  if (type === 'basic') return 10;
  if (type === 'premium') return 20;
}

// After
const pricing: Record<PlanType, number> = {
  basic: 10,
  premium: 20,
};
const getPrice = (type: PlanType) => pricing[type];
```

### Introduce Parameter Object
```typescript
// Before
function createUser(name: string, email: string, role: string, teamId: string)

// After
function createUser(params: CreateUserParams)
```

## Rules

- Never refactor without verification method
- One logical change per step
- If unsure, make smaller changes
- Preserve all existing behavior unless explicitly changing it
- Update SPEC.md if architecture changes significantly
- Ask user before large-scale changes (>10 files)
