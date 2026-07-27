---
name: ai-prose-node-modules-usb-transfer
description: "User periodically removes node_modules/ from AI-Prose to fit the repo on a USB stick (~1.3 GB otherwise), then forgets to run npm install after restoring. If a build command fails with \"command not found\" for a local binary, suspect missing node_modules first before assuming a code regression."
metadata: 
  node_type: memory
  type: project
  originSessionId: f953a117-cb83-47a1-b3a9-befcdefa0987
---

In the AI-Prose repo (`/Users/dlattka/Code/dlattka/AI-Prose`), the user regularly deletes `node_modules/` to keep the directory portable for USB transfer (full tree is ~1.3 GB). When they pick up work again, they sometimes forget to `npm install`.

**Why:** node_modules is too large for casual USB transfer; deleting it is the user's working pattern, not a sign of repo corruption.

**How to apply:** When a build / typecheck / dev command in this repo fails with `command not found` (electron-vite, electron-builder, tsc, etc.) or any "missing module" error, check whether `node_modules/` exists before debugging code. If it's missing, the fix is just `npm install` — not a code change, not a dependency conflict, not a regression on whatever branch you're on. The lock file is authoritative; reinstalling restores the exact tree.
