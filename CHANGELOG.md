# Changelog

## [1.0.0](https://github.com/JaleelB/jira-flow/compare/v0.5.0...v1.0.0) (2026-09-27)


### Features

* **build:** compile standalone jira-flow binary with injected version ([517a2eb](https://github.com/JaleelB/jira-flow/commit/517a2eb400ed94f1f80fb2fd1ed23dc32c3af02f))
* **cli:** add init --yes, status, and doctor ([a1d6e02](https://github.com/JaleelB/jira-flow/commit/a1d6e021dea3f0c5a794b51f1a2b54c416412b7b))
* **cli:** bootstrap Bun TypeScript entry with help and version ([e0368bd](https://github.com/JaleelB/jira-flow/commit/e0368bd8a674de0670573b0cde5dc4b8fe5f413e))
* **cli:** complete remaining M2 doctor and headless command surface ([4d40635](https://github.com/JaleelB/jira-flow/commit/4d40635114a2b5890d8ba1804f38420c0c09fa1f))
* **cli:** style human output and TUI with ticket-desk theme ([df29beb](https://github.com/JaleelB/jira-flow/commit/df29beb4424f52f865342b935946409ac0c6ebcf))
* **config:** persist JiraFlow workflow config in git config --local ([2655569](https://github.com/JaleelB/jira-flow/commit/265556962281fa5d89dbb754a835692d936c987a))
* **config:** persist remaining jiraflow Git-local keys ([9696f96](https://github.com/JaleelB/jira-flow/commit/9696f9686e403186f4e6bbd6eb6663c5bcbbe6f2))
* **control-plane:** complete SQLite registry and global settings ([53f2e42](https://github.com/JaleelB/jira-flow/commit/53f2e42e0aca4dc0cc839547ce53686c6789eec7))
* **domain:** add Hybrid active-issue resolution and footer format ([bbd541a](https://github.com/JaleelB/jira-flow/commit/bbd541ae0de379e8494ae5f875e95a3802c8e9a0))
* **domain:** add suffix, prefix, and scope commit formats ([a569405](https://github.com/JaleelB/jira-flow/commit/a5694055d6607b00fabb6403d1966e476bee3b9e))
* **git:** add GitRunner and isolated temp repository helpers ([a1d4255](https://github.com/JaleelB/jira-flow/commit/a1d4255dbab33f09117ed0b5c593f2e4ce34a665))
* **git:** discover repositories through Git CLI ([939809f](https://github.com/JaleelB/jira-flow/commit/939809f80e2606da62f5b33d9d6a8fa3f2beeddd))
* **git:** time out Git invocations and surface missing executables ([eb2bfc9](https://github.com/JaleelB/jira-flow/commit/eb2bfc96fbf2b0a77440ebbb70f81e2047d68008))
* **hook:** apply configured commit format during commit-msg ([9f6fc24](https://github.com/JaleelB/jira-flow/commit/9f6fc24b6f95a8180606e5107b5ae46487e8c013))
* **hook:** process commit messages through internal hook command ([7407ac2](https://github.com/JaleelB/jira-flow/commit/7407ac2d982b68571dc696c683c9a5daa609b568))
* **hooks:** classify, compose, back up, and safely remove commit-msg integration ([4f4c979](https://github.com/JaleelB/jira-flow/commit/4f4c9796285531b902981e3280ae06643226d379))
* **hooks:** install owned commit-msg integration and refuse conflicts ([49c650a](https://github.com/JaleelB/jira-flow/commit/49c650a54be1570313ece92fdb1de96c03c1fcb0))
* **migration:** safely migrate JiraFlow v0.5 hooks ([3339d53](https://github.com/JaleelB/jira-flow/commit/3339d53bbbe6179800f23bbcfeea53db1baa9357))
* **packaging:** add native npm distribution ([8ea3f66](https://github.com/JaleelB/jira-flow/commit/8ea3f6638d7023200725025df581aeddfe5f1dc3))
* **pr-title:** add local title generation and caching ([1ddca65](https://github.com/JaleelB/jira-flow/commit/1ddca650b043b26b745767b0dde99c928cd23cd1))
* **release:** prepare direct stable v1.0.0 publishing ([812579e](https://github.com/JaleelB/jira-flow/commit/812579ed31eeef0b227e980e92b70cde9986e7e0))
* **sqlite:** prove bun:sqlite in tests and compiled binary ([4a22b2f](https://github.com/JaleelB/jira-flow/commit/4a22b2f3ae4e90a4201dd4d1ae7c601ed6e9daf7))
* **sqlite:** register repositories without owning commit behavior ([72e47d0](https://github.com/JaleelB/jira-flow/commit/72e47d05e5d8ba4b32dadf659da7d01d7f6971a5))
* **state:** store linked issue in worktree-local JiraFlow state ([b575414](https://github.com/JaleelB/jira-flow/commit/b575414d98022c7aa4f1ee38d732f4820d8ccfc3))
* **tui:** add OpenTUI toolchain smoke screen ([1e86e63](https://github.com/JaleelB/jira-flow/commit/1e86e63a0d41d8bcea85fb42495ca528e9fc8cae))
* **tui:** complete OpenTUI control plane ([ffd78c5](https://github.com/JaleelB/jira-flow/commit/ffd78c5c06907dd44796d3aa72aae39d24798d0a))
* **tui:** redesign control plane as ticket workbench ([da986c4](https://github.com/JaleelB/jira-flow/commit/da986c404ac6ee48b6f83bb892633577a7c67acd))
* **tui:** render repository status from the application layer ([03fdebd](https://github.com/JaleelB/jira-flow/commit/03fdebdbc756b84baf9c73b4ad37cd04f3bdad94))


### Bug Fixes

* **ci:** build binary before SQLite smoke ([2c45259](https://github.com/JaleelB/jira-flow/commit/2c45259bc21a1bfe6ce37e1463493313ca7ec505))
* **ci:** model published metadata in Windows Bun smoke ([d5caa51](https://github.com/JaleelB/jira-flow/commit/d5caa51365547f1027fb6c1a43d8b048f88af7a3))
* **ci:** validate prebuilt native package on Windows ([f6fc65a](https://github.com/JaleelB/jira-flow/commit/f6fc65a684f39a15801bfc23192b89627019457c))
* **ci:** wait for TUI readiness in package smoke ([45fe9e5](https://github.com/JaleelB/jira-flow/commit/45fe9e5eaa6ecc3ec182d07d6f96edc521bd1fac))
* **hooks:** harden composition rollback and shared consent ([05aa806](https://github.com/JaleelB/jira-flow/commit/05aa806698571c3f96ed0306f7983bcd6ecaae55))
* **hooks:** remove owned hooks after binary moves ([5c073a2](https://github.com/JaleelB/jira-flow/commit/5c073a21c81dff26deda89e08b806ff45b7a1739))
* **packaging:** expose only the universal command shim ([bb5d836](https://github.com/JaleelB/jira-flow/commit/bb5d8369f022a95564409a9c57d38ff55c636e48))
* **packaging:** harden Windows manager smoke ([34f705a](https://github.com/JaleelB/jira-flow/commit/34f705abe62ab57f5fb73eca97305e312991511a))
* **packaging:** launch native Windows paths safely ([3f44397](https://github.com/JaleelB/jira-flow/commit/3f4439791e24f790bb85da71299e9cabeae036c1))
* **packaging:** retry transient Windows smoke cleanup locks ([0049ff0](https://github.com/JaleelB/jira-flow/commit/0049ff08a7057d2696fb8d4d414c58c6b40800ec))
* **packaging:** retry transient Windows smoke cleanup locks ([c454425](https://github.com/JaleelB/jira-flow/commit/c454425e4ce0157e36c1fbe99a8a153711b565e8))
* **packaging:** sequence Bun fixture uninstall ([36b9403](https://github.com/JaleelB/jira-flow/commit/36b9403d420306a465e8c805fd434759d43b5fc4))
* **packaging:** stop Windows TUI process tree cleanly ([5b6d336](https://github.com/JaleelB/jira-flow/commit/5b6d336c1d9a1f25539afb4ea75391b15c139842))
* **platform:** canonicalize repository and hook paths ([741604b](https://github.com/JaleelB/jira-flow/commit/741604b717472e8023d38441623261a883974784))
* **release:** base v1 changelog on the v0.5 release ([819d0ec](https://github.com/JaleelB/jira-flow/commit/819d0ec7b8e4fa726b9dbf36bfa95777c2cee4b7))
* **release:** enforce initial v1.0.0 tag and changelog ([358ee66](https://github.com/JaleelB/jira-flow/commit/358ee66502de6132be48da605a552af47bc9362e))
* **release:** keep initial v1.0.0 release exact ([06204aa](https://github.com/JaleelB/jira-flow/commit/06204aa78fde7800fd7fb37b35303ad63b193933))
* **release:** use v0.5.0 as the first v1 release baseline ([d2f8779](https://github.com/JaleelB/jira-flow/commit/d2f8779f61a06af26359fda70b61d69fe236e6a4))
* **tui:** show repository identity and contain doctor checks ([a589063](https://github.com/JaleelB/jira-flow/commit/a589063bbd7da05f69f9421095b127b25bba2bd5))
* **windows:** enable OpenTUI on Windows ARM64 ([c086508](https://github.com/JaleelB/jira-flow/commit/c086508a421ba4761fce38f60b01dcbece883691))

## Changelog

Notable JiraFlow changes are recorded here by Release Please from Conventional
Commits. The v1 rewrite is not published until its protected release workflow
has passed all native package gates.
