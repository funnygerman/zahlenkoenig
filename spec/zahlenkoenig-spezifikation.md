# Zahlenkönig / Number King – Technische Spezifikation

**Version:** 1.3  
**Stand:** März 2026

---

## 1. Technologie-Stack

| Bereich | Technologie |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| App-Typ | PWA (Progressive Web App) |
| Styling | CSS Modules + CSS Variables (Light Mode) |
| Hosting | GitHub Pages via GitHub Actions |
| Datenspeicherung | LocalStorage |

---

## 2. Projektstruktur

```
src/
├── core/
│   ├── models/        Puzzle.ts, Level.ts, Token.ts, GameState.ts
│   ├── services/      PuzzleGenerator.ts, PuzzleValidator.ts,
│   │                  HintEngine.ts, ScoringService.ts, ProgressService.ts
│   └── storage/       IStorage.ts (Interface), LocalStorage.ts
├── data/              puzzles-F2.json, puzzles-F3.json, puzzles-E1.json
├── i18n/              de.ts, en.ts, index.ts
├── hooks/             useGame.ts, useHints.ts, useProgress.ts, useTranslation.ts
├── components/
│   ├── GameBoard/     Haupt-Container
│   ├── Header/        App-Name, Level, Punkte, Streak
│   ├── InputField/    💡 | Ausdruck | [✕] [⌫]
│   ├── KeyPad/        4×3 Tastenfeld (immer gleiche Struktur)
│   ├── HintPopover/   Tipp-Overlay
│   └── SettingsScreen/
└── main.tsx
scripts/
└── generatePuzzles.mjs   Einmalig lokal ausführen → src/data/ befüllen
```

---

## 3. SOLID-Prinzipien

| Prinzip | Umsetzung |
|---|---|
| **S** | Jeder Service hat eine Aufgabe: Generator generiert, Validator validiert, etc. |
| **O** | Neues Level = nur `Level.ts` erweitern, kein bestehender Code ändert sich |
| **L** | Alle Level-Typen verhalten sich nach außen identisch |
| **I** | Kleine Interfaces: `IStorage`, `IPuzzleGenerator`, `IHintEngine` |
| **D** | Services hängen von `IStorage` ab, nicht von `LocalStorage` direkt |

---

## 4. Datenmodelle

```typescript
interface Puzzle {
  numbers: number[]     // z.B. [3, 7, 2]
  target: number        // z.B. 14
  solutions: string[]   // z.B. ["3*(7-2)"] – max. 3
  levelId: string       // z.B. "F2"
}

type Token =
  | { type: 'number';   value: number; index: number }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' }
  | { type: 'bracket';  value: '(' | ')' }

interface Level {
  id: string
  group: 'beginner' | 'advanced' | 'expert'
  numberCount: 2 | 3 | 4
  operators: Operator[]
  maxBracketDepth: 0 | 1 | 2
  targetRange: { min: number; max: number }
  maxTarget: number
  unlockIndex: number
}

interface StoredProgress {
  unlockedLevels: string[]           // immer alle 7 Levels
  unlockStreaks: Record<string, number>
  totalScore: number
  pointStreak: number
  customTargets: Record<string, number>
  language: 'de' | 'en'
  currentLevelId: string             // default: 'F2'
}
```

---

## 5. Level-Definitionen

```typescript
const LEVELS: Level[] = [
  { id: 'A1', group: 'beginner',  numberCount: 2, operators: ['+','-'],           maxBracketDepth: 0, targetRange: { min:1, max:18  }, maxTarget: 18,  unlockIndex: 0 },
  { id: 'A2', group: 'beginner',  numberCount: 3, operators: ['+','-'],           maxBracketDepth: 0, targetRange: { min:1, max:27  }, maxTarget: 27,  unlockIndex: 1 },
  { id: 'A3', group: 'beginner',  numberCount: 4, operators: ['+','-'],           maxBracketDepth: 0, targetRange: { min:1, max:36  }, maxTarget: 36,  unlockIndex: 2 },
  { id: 'F1', group: 'advanced',  numberCount: 2, operators: ['+','-','*','/'],   maxBracketDepth: 0, targetRange: { min:1, max:81  }, maxTarget: 81,  unlockIndex: 3 },
  { id: 'F2', group: 'advanced',  numberCount: 3, operators: ['+','-','*','/'],   maxBracketDepth: 1, targetRange: { min:1, max:100 }, maxTarget: 162, unlockIndex: 4 },
  { id: 'F3', group: 'advanced',  numberCount: 4, operators: ['+','-','*','/'],   maxBracketDepth: 1, targetRange: { min:1, max:100 }, maxTarget: 171, unlockIndex: 5 },
  { id: 'E1', group: 'expert',    numberCount: 4, operators: ['+','-','*','/'],   maxBracketDepth: 2, targetRange: { min:1, max:100 }, maxTarget: 324, unlockIndex: 6 },
]
```

---

## 6. Services

### PuzzleGenerator
- **A1, A2, A3, F1:** Live-Generierung (schnell, 2–3 Zahlen)
- **F2, F3, E1:** Lazy-loaded JSON-Bank (`src/data/puzzles-{levelId}.json`)
- `generate()` – synchron, nutzt Bank wenn geladen, sonst Live
- `generateAsync()` – lädt Bank zuerst, dann aus Bank
- Nur ganzzahlige Divisionsergebnisse akzeptiert
- Fallback-Strategie: Strict (1–3 Lösungen) → Relaxed (1–5) → vordefinierte Rätsel

### PuzzleValidator
- `validateToken()` – Echtzeit-Validierung, gibt i18n-Key zurück
- `validateSolution()` – prüft: alle Zahlen verwendet, Klammern geschlossen, Ergebnis ≥ 0

### HintEngine
- Tipp 1: Zwischenwert aus Klammerausdruck oder erstem Teilausdruck
- Tipp 2: Zwei relevante Zahlen identifizieren
- Tipp 3: Schlüssel-Operator (bevorzugt `×` oder `÷`)

### ScoringService
- Eingabe: `SolutionResult` + aktueller `pointStreak`
- Ausgabe: `points` + `newPointStreak`
- Falsche Antwort bricht Streak **nicht** (nur Tipps und Fehlversuche)

### ProgressService
- Alle Levels immer freigeschaltet (`isUnlocked()` → immer `true`)
- Standard-Level: `F2`
- Migration: ungültige Level-IDs (z.B. alte A4, E2) → reset auf F2
- Speichert via `IStorage` (Dependency Inversion)

---

## 7. Hooks

```typescript
useGame(levelId, customTarget, pointStreak, onResult)
  → puzzle, tokens, status, warning
  → addToken, deleteToken, clearTokens, submitSolution, nextPuzzle
  // Nutzt generateAsync() – lädt Puzzle-Bank beim ersten Level-Wechsel

useHints(puzzle)
  → hints, hintsRemaining, requestHint, resetHints
  // Reset via puzzleKey (levelId-target-numbers) statt Objekt-Referenz

useProgress()
  → progress, recordResult, setLevel, setCustomTarget, setLanguage, reset

useTranslation()
  → t(key, params?), language, changeLanguage
```

---

## 8. Puzzle-Bank (Pre-computed)

```
scripts/generatePuzzles.mjs   Generierungs-Skript (einmalig lokal ausführen)
src/data/puzzles-F2.json      500 Rätsel
src/data/puzzles-F3.json      500 Rätsel
src/data/puzzles-E1.json      500 Rätsel
```

**Ausführen:**
```bash
node --max-old-space-size=512 scripts/generatePuzzles.mjs
```

- Lazy loading: Bank wird beim ersten Aufruf von `generateAsync()` für ein Level geladen
- Bei `customTarget`: sucht passendes Rätsel in der Bank, sonst Live-Generierung
- Deduplizierung: gleiche Zahlen + Ziel nur einmal in der Bank

---

## 9. Design-System (Light Mode)

```css
--bg-primary:      #faf7f2   /* Seitenhintergrund */
--bg-card:         #ffffff   /* Button-Hintergrund */
--accent:          #c47a1a   /* Hauptfarbe (warmes Gold) */
--num-color:       #2a1f0a   /* Zahl-Buttons */
--op-color:        #c47a1a   /* Operator-Buttons */
--bracket-color:   #2a6abf   /* Klammer-Buttons */
--correct:         #16a34a   /* Grün */
--wrong:           #dc2626   /* Rot */
--warning:         #ea580c   /* Orange */
```

Schrift: `Courier New` (Monospace – Taschenrechner-Ästhetik)

---

## 10. KeyPad-Layout (immer stabil, unabhängig vom Level)

```
Row 1: [  (  ]  [  )  ]  [  =  ]   ← Klammern (leer wenn nicht erlaubt) + Submit
Row 2: [  +  ]  [ Z3  ]  [  −  ]   ← Z3 leer wenn numberCount < 3
Row 3: [ Z1  ]  [Ziel ]  [ Z2  ]   ← Ziel immer sichtbar, nicht klickbar
Row 4: [  ×  ]  [ Z4  ]  [  ÷  ]   ← Z4 leer wenn numberCount < 4, × ÷ leer wenn nicht erlaubt
```

---

## 11. i18n

Eigener `useTranslation`-Hook, keine externe Bibliothek. Übersetzungen als TypeScript-Objekte. Sprache aus `navigator.language`, manuell überschreibbar in Settings.

---

## 12. GitHub Actions Deployment

```yaml
Trigger: push to main
→ npm install (ohne cache, keine package-lock.json nötig)
→ npm run build (tsc + vite build)
→ upload dist/
→ deploy to GitHub Pages
URL: https://funnygerman.github.io/zahlenkoenig
```
