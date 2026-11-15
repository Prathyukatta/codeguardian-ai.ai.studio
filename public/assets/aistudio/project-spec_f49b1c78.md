# CodeGuardian AI — Product & Technical Specification

## 1. Product Overview
**CodeGuardian AI** is an AI-powered code review and automated test-generation workspace designed for individual developers and engineering teams. It ingests source code (via paste, file upload, or repository snippet), performs multi-dimensional static and semantic analysis (security, performance, maintainability, bug detection), generates runnable unit/integration tests, and provides one-click AI patches with side-by-side diff previews.

### Core Value Proposition
- **Unified Audit & Verification:** Combines deep code review with executable test suite synthesis in a single workflow.
- **Actionable Remediation:** Every flagged issue includes severity grading, root-cause explanation, a ready-to-apply diff patch, and regression tests verifying the fix.
- **Framework-Aware Generation:** Automatically detects language and testing frameworks (e.g., Jest/Vitest, Pytest, JUnit, Go `testing`) to generate idiomatic test suites.

---

## 2. Target Users & User Personas
1. **Full-Stack / Backend Developers:** Want rapid pre-PR sanity checks, edge-case discovery, and automated boilerplate unit tests.
2. **Tech Leads & Code Reviewers:** Need structured security, complexity, and maintainability audits before approving pull requests.
3. **QA & SDET Engineers:** Seek high-coverage unit and boundary-value test suites generated directly from implementation code.

---

## 3. Core Features & Functional Requirements

### 3.1 Code Ingestion & Workspace Setup
- **Multi-Mode Input:**
  - Direct code editor (syntax-highlighted, line numbers, language auto-detect + manual selector).
  - Sample preset loader (e.g., *Vulnerable Auth API*, *Unoptimized Data Pipeline*, *React State Bug*) for instant onboarding/demoing.
  - File upload (`.js`, `.ts`, `.tsx`, `.py`, `.go`, `.java`, `.sql`, `.cpp`).
- **Scan Configuration Controls:**
  - Audit Focus toggles: `Security (OWASP)`, `Bugs & Edge Cases`, `Performance`, `Clean Code & Complexity`.
  - Test Framework selector: `Auto-Detect`, `Jest`, `Vitest`, `Pytest`, `Mocha`, `JUnit 5`, `Go Test`.
  - Coverage Target selector: `Happy Path + Edge Cases`, `Exhaustive (Boundary & Security Fuzzing)`.

### 3.2 AI Code Review Engine
- **Executive Health Scorecard:**
  - Overall Quality Score (`0–100`), Security Grade (`A–F`), Maintainability Index, and Estimated Cyclomatic Complexity.
  - Issue breakdown badges: `Critical`, `High`, `Medium`, `Low / Info`.
- **Categorized Findings Feed:**
  - Filterable by severity and category.
  - Each issue card displays:
    - Severity badge, category tag, rule/CWE identifier (where applicable), and exact line range (`Line 24–31`).
    - Clear explanation of why the issue matters and potential exploit/failure scenario.
    - **Suggested Fix Diff:** Inline unified or split diff showing original vs. patched code.
    - **Actions:** `Apply Fix` (updates the active code buffer), `Copy Patch`, and `Dismiss`.
- **Interactive Line Highlighting:** Clicking an issue scrolls to and highlights the corresponding lines in the code editor.

### 3.3 Automated Test Suite Generator
- **Structured Test Output:**
  - Generates complete, copy-paste-ready test files tailored to the selected framework.
  - Organizes test cases into logical groups: *Happy Path*, *Edge Cases & Null/Boundary Inputs*, *Error Handling*, and *Security / Injection Regression*.
- **Test Case Breakdown Drawer / List:**
  - Lists individual generated test cases with pass/fail simulation status, target function, and assertion summary.
- **Simulated Test Runner ("Run Tests"):**
  - Executes a simulated or sandboxed verification pass against both the *Original Code* and *Patched Code*, displaying execution time, pass/fail counts, and estimated branch/line coverage percentage.
- **Export Actions:** `Copy Test File`, `Download .test/.spec File`, and `Regenerate with Custom Prompt` (e.g., *"Add tests for rate limiting and malformed JWTs"*).

### 3.4 Side-by-Side Diff & Full Refactored Code View
- Dedicated tab comparing **Original Code** vs. **Fully Patched Code** with line-by-line additions/deletions highlighted.
- One-click `Accept All Safe Fixes` and `Download Patched File`.

### 3.5 Scan History & Session Persistence
- Local persistence (`localStorage` / IndexedDB) storing recent review runs with timestamp, file name, language, score delta, and issue count so users can revisit past audits.

---

## 4. Information Architecture & Screen Inventory

1. **Top Navigation Bar:**
   - Brand logo (`CodeGuardian AI` with shield/terminal icon), active file/session title, language/framework pills, scan history drawer trigger, and primary CTA (`Run Guardian Audit`).
2. **Left / Primary Pane — Code Editor & Input Hub:**
   - Toolbar: Sample Snippets dropdown, Upload File button, Language selector, Clear button.
   - Monaco-style dark code editor with line numbers, gutter severity markers (red/amber dots on flagged lines), and bottom status bar (line/col, character count, detected framework).
   - Scan Configuration Strip: Audit focus pills + Test framework dropdown.
3. **Right / Analysis Pane — Tabbed Results Workspace:**
   - **Tab 1: Review Findings** (Health score summary cards + severity filter bar + scrollable issue cards with inline mini-diffs and `Apply Fix` buttons).
   - **Tab 2: Generated Tests** (Test summary metrics, coverage meter, `Run Simulated Suite` button, individual test case status list, and syntax-highlighted test code block with copy/download actions).
   - **Tab 3: Full Diff & Patch** (Split/Unified diff viewer comparing original vs. patched code + `Export Patched File`).
4. **Slide-Over Drawer — Audit History:**
   - Chronological list of previous scans with score badges and one-click restore.

---

## 5. Technical Architecture (Google AI Studio Build Target)
- **Frontend Framework:** React 18+ with TypeScript, Vite, and Tailwind CSS.
- **Icons & UI Primitives:** `lucide-react` for crisp developer tooling iconography.
- **AI Engine Integration (`@google/genai`):**
  - Uses Gemini (`gemini-2.5-pro` or `gemini-2.5-flash` via Google AI Studio SDK) with **Structured Outputs (`responseSchema`)** to guarantee deterministic JSON payloads containing:
    - `summaryMetrics` (overallScore, securityGrade, maintainabilityScore, complexityLabel)
    - `issues[]` (id, title, severity, category, lineStart, lineEnd, description, impact, originalSnippet, suggestedSnippet, fixedFullLineBlock)
    - `testSuite` (framework, fileName, estimatedCoverage, testCode, testCases[name, category, description, expectedOutcome, statusBeforeFix, statusAfterFix])
    - `patchedCode` (complete refactored source code)
- **Client-Side State & Storage:** React state + `localStorage` for API key fallback (if run outside AI Studio environment) and scan history persistence.

---

## 6. Design System & Visual Direction
- **Theme:** Precision Developer Dark Mode (`#0B0F17` canvas background, `#111827` elevated panels, `#1E293B` borders).
- **Accent Palette:**
  - Primary Brand Accent: Cyber Emerald / Teal (`#10B981`) for security verification & passing tests.
  - Secondary Action Accent: Electric Indigo (`#6366F1`) for AI analysis triggers.
  - Semantic Severity Colors: Critical (`#EF4444`), High (`#F97316`), Medium (`#F59E0B`), Low/Info (`#38BDF8`).
- **Typography:** `Inter` for clean UI controls and `JetBrains Mono` / `Fira Code` for code editors, diffs, line numbers, and stack badges.
