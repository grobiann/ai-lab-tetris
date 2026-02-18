---
description: Create a conventional commit for changes in this project
---

Create a git commit for the current changes in this Tetris project.

Follow these steps:
1. Run `git status` and `git diff` to understand what changed
2. Run `git log --oneline -5` to see recent commit style
3. Write a conventional commit message:
   - `feat(game): description` — new gameplay feature
   - `fix(game): description` — bug fix
   - `fix(ui): description` — UI/visual fix
   - `style(ui): description` — styling only
   - `refactor(game): description` — code refactor, no behavior change
   - `chore: description` — tooling, config, deps
4. Stage relevant files (avoid committing .env or secrets)
5. Commit with the message

If the user provided a message hint, use it: $ARGUMENTS
