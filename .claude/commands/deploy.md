---
description: Deploy the game to GitHub Pages by pushing to main
---

Deploy this Tetris game to GitHub Pages.

Steps:
1. Run `git status` to confirm everything is committed
2. If there are uncommitted changes, warn the user and ask if they want to commit first
3. Run `git push origin main` to trigger the GitHub Actions deployment
4. Tell the user the deployment workflow will run automatically via `.github/workflows/deploy.yml`
5. The live URL will be at the GitHub Pages URL configured for this repository

$ARGUMENTS
