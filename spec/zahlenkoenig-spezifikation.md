# Zahlenkönig / Number King – Spezifikation

**Version:** 1.2  
**Stand:** März 2026

---

## 1. Technologie-Stack

| Bereich | Technologie |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| App-Typ | PWA (Progressive Web App) |
| Styling | CSS Modules + CSS Variables |
| Hosting | GitHub Pages via GitHub Actions |
| Datenspeicherung | LocalStorage |

---

## 2. Projektstruktur

```
src/
├── core/
│   ├── models/        Puzzle, Level, Token, GameState
│   ├── services/      PuzzleGenerator, PuzzleValidator,
│   │                  HintEngine, ScoringService, ProgressService
│   └── storage/       IStorage (Interface), LocalStorage
├── i18n/              de.ts, en.ts, index.ts
├── hooks/             useGame, useHints, useProgress, useTranslation
├── components/
│   ├── GameBoard/     Haupt-Container
│   ├── Header/        App-Name, Level, Punkte
│   ├── InputField/    Eingabezeile mit 💡, ✕, ⌫
│   ├── KeyPad/        Tastenfeld (4×3 Grid)
│   ├── HintPopover/   Tipp-Overlay
│   └── SettingsScreen/
└── main.tsx
```

---

## 3. SOLID-Prinzipien

| Prinzip | Umsetzung |
|---|---|
| **S** | Jeder Service hat eine Aufgabe |
| **O** | Neues Level = nur `Level.ts` erweitern |
| **L** | Alle Level-Typen verhalten sich gleich nach außen |
| **I** | Kleine Interfaces: `IStorage`, `IPuzzleGenerator`, `IHintEngine` |
| **D** | Services hängen von `IStorage` ab, nicht von `LocalStorage` direkt |

---

## 4. Datenmodelle

```typescript
interface Puzzle {
  numbers: number[]     // z.B. [3, 7, 2]
  target: number        // z.B. 14
  solutions: string[]   // z.B. ["3*(7-2)"]  – max. 3
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
  maxTarget: number      // nie über 500
  unlockIndex: number
}

interface StoredProgress {
  unlockedLevels: string[]          // immer alle
  unlockStreaks: Record<string, number>
  totalScore: number
  pointStreak: number
  customTargets: Record<string, number>
  language: 'de' | 'en'
  currentLevelId: string            // default: 'F2'
}
```

---

## 5. Services

### PuzzleGenerator
- `findSolutions2/3/4()` – separate Funktionen je nach Zahlenanzahl
- Kanonische Normalisierung: bei `+` und `×` Operanden alphabetisch sortieren
- Strict: 500 Versuche (1–3 Lösungen) → Relaxed: 200 Versuche (1–5) → Fallback-Bibliothek

### PuzzleValidator
- `validateToken()` – Echtzeit, gibt `errorKey` für i18n zurück
- `validateSolution()` – prüft Ergebnis + alle Zahlen verwendet

### HintEngine
- Tipp 1: Zwischenwert aus Teil-Ausdruck berechnen
- Tipp 2: Zwei relevante Zahlen benennen
- Tipp 3: Schlüssel-Operator benennen

### ScoringService
- Eingabe: `SolutionResult` + aktueller `pointStreak`
- Ausgabe: `points` + `newPointStreak`

### ProgressService
- Alle Levels immer freigeschaltet (`isUnlocked()` gibt immer `true`)
- Standard-Level: `F2`
- Speichert via `IStorage` (Dependency Inversion)

---

## 6. Hooks

```typescript
useGame(levelId, customTarget, pointStreak, onResult)
  → puzzle, tokens, status, warning, addToken,
     deleteToken, clearTokens, submitSolution, nextPuzzle

useHints(puzzle)
  → hints, hintsRemaining, requestHint, resetHints

useProgress()
  → progress, recordResult, setLevel, setCustomTarget,
     setLanguage, reset, isUnlocked, getUnlockStreak

useTranslation()
  → t(), language, changeLanguage
```

---

## 7. Design-System

- **Theme:** Light Mode, warme Cremeton-Palette
- **CSS Variables:** alle Farben in `:root` definiert
- **Schrift:** `Courier New` (Monospace – passt zum Taschenrechner-Konzept)
- **Hauptfarbe:** `#c47a1a` (warmes Orange/Gold)

### Farb-Tokens
```css
--bg-primary:     #faf7f2   /* Seitenhintergrund */
--bg-card:        #ffffff   /* Button-Hintergrund */
--accent:         #c47a1a   /* Hauptfarbe */
--num-color:      #2a1f0a   /* Zahl-Buttons */
--op-color:       #c47a1a   /* Operator-Buttons */
--bracket-color:  #2a6abf   /* Klammer-Buttons */
--correct:        #16a34a   /* Grün */
--wrong:          #dc2626   /* Rot */
--warning:        #ea580c   /* Orange */
```

---

## 8. KeyPad-Layout (immer stabil)

```
Row 1: [  (  ]  [  )  ]  [  =  ]
Row 2: [  +  ]  [ Z3  ]  [  −  ]
Row 3: [ Z1  ]  [Ziel ]  [ Z2  ]
Row 4: [  ×  ]  [ Z4  ]  [  ÷  ]
```

- Nicht verfügbare Operatoren (`×`, `÷` bei Anfänger): Button leer + `pointer-events: none`
- Nicht vorhandene Zahlen (Z3 bei 2 Zahlen, Z4 bei 2–3 Zahlen): Button leer + `pointer-events: none`
- Klammern bei `maxBracketDepth === 0`: leer + inaktiv

---

## 9. i18n

Eigener `useTranslation`-Hook, keine externe Bibliothek. Übersetzungen als typisierte TypeScript-Objekte. Sprache aus `navigator.language`, manuell überschreibbar.

---

## 10. GitHub Actions Deployment

```yaml
on: push to main
→ npm install
→ npm run build  (tsc + vite build)
→ upload dist/
→ deploy to GitHub Pages
URL: https://funnygerman.github.io/zahlenkoenig
```
