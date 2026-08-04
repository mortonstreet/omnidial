---
name: spec
description: Interview-driven specification development. Use when starting a new project, after context compaction, when SPEC.md is missing or stale, or when the user needs to clarify project architecture. Triggers on "spec", "interview me", "what are we building", or when substantial work is requested without clear requirements.
---

# Specification Interview

## Purpose

Prevent wrong assumptions and context loss across compactions by building a comprehensive, persistent specification through structured interviewing.

## Process

### 1. Read Existing State

If SPEC.md exists, read it first. Also read CLAUDE.md if present.

### 2. Interview Protocol

Ask detailed, non-obvious questions about:

**Architecture & Design**
- Core data structures and their representations
- Performance constraints and optimization parameters
- Tradeoffs: acceptable vs. non-negotiable
- System boundaries and interfaces

**Scope & Requirements**
- What is explicitly OUT of scope
- Concrete success criteria ("done" looks like...)
- Edge cases to handle vs. ignore
- External dependencies

**Implementation Strategy**
- Preferred patterns or anti-patterns for this codebase
- What to preserve vs. rewrite
- Scaling considerations (batch sizes, parallelism, memory)
- Testing and validation approach

**Unknowns & Risks**
- What needs benchmarking vs. assuming
- Technical risks or uncertainties
- Failure modes

### 3. Question Style

- Skip anything derivable from code
- Use concrete examples: "If batch_size=1024, does each element represent X or Y?"
- Challenge assumptions: "You said X, but that conflicts with Y - which wins?"
- Offer adversarial interpretations to surface hidden requirements
- Request ASCII diagrams for spatial/visual concepts

### 4. Iterative Refinement

- Continue until user signals completion
- Summarize understanding after each round
- Explicitly identify remaining ambiguities

### 5. Write SPEC.md

Create/update `./SPEC.md` at project root:

```markdown
# Project: [Name]

## Objective
[1-2 sentence core goal]

## Success Criteria
- [ ] Concrete measurable outcome 1
- [ ] Concrete measurable outcome 2

## Architecture

### Core Data Structures
[Concrete representations with example shapes/values]

### System Boundaries
[What's in scope, external interfaces]

## Constraints & Tradeoffs

### Non-negotiable
- [Hard requirements]

### Acceptable Tradeoffs
- [What can be sacrificed for what]

### Out of Scope
- [Explicitly excluded]

## Implementation Strategy

### Optimization Parameters
[Batch sizes, memory limits, performance targets - MEASURED not guessed]

### Preferred Patterns
[How to structure code in this project]

### Anti-patterns
[What to avoid]

## Open Questions
[Things needing measurement or decision]

## Reference Examples
[ASCII diagrams, example data, concrete values]
```

## Rules

- Never guess numerical values - mark as "TBD: needs benchmarking"
- Comprehensiveness beats brevity (spec can be 1000+ lines)
- Update incrementally as project evolves
- Remind user to review and correct after writing
