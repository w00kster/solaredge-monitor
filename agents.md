# Agents Documentation

This file documents the agents used in this repository and provides guidelines for proper git workflow.

## Git Workflow Guidelines

We follow a trunk-based development model:

1. **Main Branch**: The `main` branch is always deployable and passes all CI checks.
2. **Feature Branches**: All work starts from a new branch created from `main`.
3. **Pull Requests**: Changes are submitted via PRs targeting `main`.
4. **CI/CD**: PRs must pass all checks before merging.
5. **Branch Lifetime**: Branches should be short-lived (hours to days, not weeks).

### Typical Workflow:
```bash
# Start new work
git checkout main
git pull origin main
git checkout -b feature/description

# Make changes, commit frequently
git add .
git commit -m "Descriptive commit message"

# Push and open PR
git push -u origin feature/description
# Open PR targeting main

# After approval and checks pass
git checkout main
git pull origin main
git delete-branch feature/description  # or delete via GitHub
```

## Agent Usage

When using agents for concurrent work:
- Each agent should work on its own branch
- Agents should not make direct changes to `main` without PR review
- Coordinate agent work to avoid conflicts

Current agents in use:
- (List agents as they are created)

Last updated: $(date)