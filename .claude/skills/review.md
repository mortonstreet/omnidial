---
name: review
description: Comprehensive code review process for quality assurance. Use when reviewing PRs, checking code before commit, validating implementations, or when user asks for feedback on their code. Triggers on "review", "code review", "check my code", "look over this", or when presenting completed work.
---

# Code Review Workflow

## Purpose

Provide thorough, actionable code review feedback that catches bugs, improves quality, and maintains consistency with project patterns.

## Process

### 1. Gather Context

Before reviewing:
- Read SPEC.md for requirements context
- Read CLAUDE.md for project patterns
- Understand what the code is supposed to do
- Check if this is new code or modifications

### 2. Review Layers

Review in this order (critical → style):

#### Layer 1: Correctness
- Does it do what it's supposed to do?
- Are there logic errors or edge cases?
- Are error cases handled?
- Could it crash or throw unexpected errors?

#### Layer 2: Security
- Input validation present?
- SQL injection / XSS vulnerabilities?
- Sensitive data exposed?
- Authentication/authorization correct?

#### Layer 3: Architecture
- Follows project patterns (route → controller → service → repository)?
- Proper separation of concerns?
- Database calls only in repositories?
- Types in shared folder using DB types?

#### Layer 4: Performance
- N+1 queries?
- Missing indexes for queries?
- Unnecessary re-renders (frontend)?
- Large payloads or memory issues?

#### Layer 5: Maintainability
- Clear naming?
- Appropriate comments (why, not what)?
- Functions reasonably sized?
- DRY violations?

#### Layer 6: Testing
- Are there tests?
- Do tests cover edge cases?
- Are tests meaningful or just coverage padding?

#### Layer 7: Style & Consistency
- Matches project conventions?
- Consistent formatting?
- No dead code or commented-out code?

### 3. Format Feedback

Structure feedback clearly:

```markdown
## Summary
[1-2 sentence overall assessment]

## Critical Issues (must fix)
- [ ] **[File:Line]** Description of issue
  ```suggestion
  // Suggested fix
  ```

## Improvements (should fix)
- [ ] **[File:Line]** Description and why it matters

## Suggestions (nice to have)
- [ ] **[File:Line]** Optional improvement

## Questions
- [File:Line] Why was X approach chosen over Y?

## Positive Notes
- Good job on X
- Nice pattern usage in Y
```

### 4. Severity Levels

**Critical** - Must fix before merge:
- Security vulnerabilities
- Data loss potential
- Crashes or breaking errors
- Incorrect business logic

**Improvement** - Should fix:
- Performance issues
- Pattern violations
- Missing error handling
- Poor maintainability

**Suggestion** - Nice to have:
- Style preferences
- Minor optimizations
- Alternative approaches

### 5. Review Checklist

Use this for thoroughness:

**Backend Checklist**
- [ ] Controllers only destructure and call services
- [ ] Services contain business logic, no DB calls
- [ ] Repositories handle all DB operations
- [ ] `withIdAndTimestamp` used on creates
- [ ] Types use handler types with validate/merge
- [ ] Error responses are consistent
- [ ] No sensitive data in logs

**Frontend Checklist**
- [ ] Server Components used where possible
- [ ] Client Components only where needed
- [ ] Endpoints in config
- [ ] Query keys in config
- [ ] Custom hook for data fetching
- [ ] Components are reasonably sized
- [ ] Loading and error states handled

**Shared Checklist**
- [ ] Types derive from DB types
- [ ] No duplicate type definitions
- [ ] Proper exports

## Rules

- Be specific - reference exact lines
- Explain why, not just what
- Provide suggestions, not just criticism
- Acknowledge good work
- Prioritize feedback by severity
- Ask questions instead of assuming intent
- Consider the author's experience level
- One review pass for initial feedback, then respond to discussion
