---
description: Start a local HTTP server to preview the game in the browser
---

Start a local HTTP server for this Tetris project so the user can preview it in a browser.

Run the following command in the project root (`c:/Projects/ai-lab-tetris`):

```bash
python -m http.server 8080
```

If Python is not available, try:
```bash
npx serve . -p 8080
```

After starting the server, tell the user to open **http://localhost:8080** in their browser.
Keep the server running until the user asks to stop it.

$ARGUMENTS
