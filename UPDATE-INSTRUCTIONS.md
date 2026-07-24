# HIT v97.21.43 update instructions

1. Stop HIT with `Ctrl + C`.
2. Extract this ZIP.
3. Copy everything inside `hit-v97.21.43-all-in-one-update` into the live HIT folder.
4. Choose **Replace the files in the destination**.
5. Keep the live `.env` file and `data` folder.
6. Run `install-and-check.bat`.
7. After checks pass, run `taskkill /F /IM node.exe`.
8. Run `npm run register`.
9. Run `npm start` and keep that one terminal open.

Configure the new module with `/community setup`, then run `/community diagnose`.
