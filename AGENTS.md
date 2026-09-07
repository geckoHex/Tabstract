Use IndexedDB for all data storage. Never use localstorage. Ensure data can be imported and exported via the import/ export feature.

## After Every Change

Complete all of the following before finishing:

1. Verify the app compiles without errors or warnings introduced by the change.
2. Run `git add .`
3. Create an unsigned commit:
   `git -c commit.gpgsign=false commit -m "<message> - By Codex"`
4. Run `git push`

## Git Rules

* Do not modify global, local, or project Git configuration.
* Do not use the Xcode app or Simulator.
* Only create unsigned commits.
* Commit messages must be a single concise sentence.
* End every Codex commit message with ` - By Codex`.
* The official remote is verified and safe to push to:
  `https://github.com/geckoHex/Tabstract.git`