# Zahlenkönig / Number King – Technische Spezifikation

**Version:** 1.6  
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
│   ├── models/        Puzzle.ts, Level.ts, Token.ts
│   ├── services/      PuzzleGenerator.ts, PuzzleValidator.ts,
│   │                  HintEngine.ts, ScoringService.ts, ProgressService.ts
│   └── storage/       IStorage.ts, LocalStorage.ts
├── data/              puzzles-A1.json, puzzles-A2.json, puzzles-A3.json,
│                      puzzles-F1.json,
│                      puzzles-F2-1.json … puzzles-F2-3.json,
│                      puzzles-F3-1.json … puzzles-F3-3.json,
│                      puzzles-E1-1.json … puzzles-E1-3.json
├── i18n/              de.ts, en.ts, index.ts
├── hooks/             useGame.ts, useHints.ts, useProgress.ts, useTranslation.ts
├── components/
│   ├── GameBoard/     Haupt-Container
│   ├── Header/        ⚙️ | Titel + Level | 💡 ❓ 🔥
│   ├── NumberRow/     Zahlen-Zeile [Z4][Z3][Z1][Z2]
│   ├── InputRow/      [Eingabe] [=Ziel]
│   ├── KeyPad/        Operator-Zeilen
│   ├── HintPopover/   Tipp-Overlay
│   ├── RulesPopover/  Spielregeln-Overlay
│   └── SettingsScreen/
└── main.tsx
scripts/
└── generatePuzzles.mjs
```

---

## 3. SOLID-Prinzipien

| Prinzip | Umsetzung |
|---|---|
| **S** | Jeder Service hat eine Aufgabe |
| **O** | Neues Level/Unterlevel = nur `Level.ts` erweitern |
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
  levelId: string       // z.B. "F2.1"
}

type Token =
  | { type: 'number';   value: number; index: number }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' }
  | { type: 'bracket';  value: '(' | ')' }

interface Level {
  id: string              // z.B. "F2.1"
  baseId: string          // z.B. "F2"
  subLevel: 1 | 2 | 3 | null
  group: 'beginner' | 'advanced' | 'expert'
  numberCount: 2 | 3 | 4
  operators: Operator[]
  maxBracketDepth: 0 | 1 | 2
  targetRange: { min: number; max: number }
  maxTarget: number
}

interface StoredProgress {
  unlockStreaks: Record<string, number>
  pointStreak: number
  language: 'de' | 'en'
  currentLevelId: string   // default: 'F2.1'
}
```

---

## 5. Level-Definitionen

```typescript
const LEVELS: Level[] = [
  { id:'A1',   baseId:'A1', subLevel:null, group:'beginner',  numberCount:2, operators:['+','-'],         maxBracketDepth:0, targetRange:{min:1,   max:18 }, maxTarget:18  },
  { id:'A2',   baseId:'A2', subLevel:null, group:'beginner',  numberCount:3, operators:['+','-'],         maxBracketDepth:0, targetRange:{min:1,   max:27 }, maxTarget:27  },
  { id:'A3',   baseId:'A3', subLevel:null, group:'beginner',  numberCount:4, operators:['+','-'],         maxBracketDepth:0, targetRange:{min:1,   max:36 }, maxTarget:36  },
  { id:'F1',   baseId:'F1', subLevel:null, group:'advanced',  numberCount:2, operators:['+','-','*','/'], maxBracketDepth:0, targetRange:{min:1,   max:81 }, maxTarget:81  },
  { id:'F2.1', baseId:'F2', subLevel:1,    group:'advanced',  numberCount:3, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:1,   max:50 }, maxTarget:162 },
  { id:'F2.2', baseId:'F2', subLevel:2,    group:'advanced',  numberCount:3, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:51,  max:100}, maxTarget:162 },
  { id:'F2.3', baseId:'F2', subLevel:3,    group:'advanced',  numberCount:3, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:101, max:162}, maxTarget:162 },
  { id:'F3.1', baseId:'F3', subLevel:1,    group:'advanced',  numberCount:4, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:1,   max:50 }, maxTarget:171 },
  { id:'F3.2', baseId:'F3', subLevel:2,    group:'advanced',  numberCount:4, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:51,  max:100}, maxTarget:171 },
  { id:'F3.3', baseId:'F3', subLevel:3,    group:'advanced',  numberCount:4, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:101, max:171}, maxTarget:171 },
  { id:'E1.1', baseId:'E1', subLevel:1,    group:'expert',    numberCount:4, operators:['+','-','*','/'], maxBracketDepth:2, targetRange:{min:1,   max:50 }, maxTarget:324 },
  { id:'E1.2', baseId:'E1', subLevel:2,    group:'expert',    numberCount:4, operators:['+','-','*','/'], maxBracketDepth:2, targetRange:{min:51,  max:100}, maxTarget:324 },
  { id:'E1.3', baseId:'E1', subLevel:3,    group:'expert',    numberCount:4, operators:['+','-','*','/'], maxBracketDepth:2, targetRange:{min:101, max:324}, maxTarget:324 },
]

// getLevelById gibt Fallback (F2.1) statt Exception bei ungültiger ID
```

---

## 6. Puzzle-Bank

```
node --max-old-space-size=512 scripts/generatePuzzles.mjs
```

| Datei | Rätsel | Strategie |
|---|---|---|
| `puzzles-A1.json` | ~81 | Exhaustiv |
| `puzzles-A2.json` | ~192 | Exhaustiv |
| `puzzles-A3.json` | ~140 | Exhaustiv |
| `puzzles-F1.json` | ~138 | Exhaustiv |
| `puzzles-F2-{1,2,3}.json` | 300/300/200 | Zufallssampling |
| `puzzles-F3-{1,2,3}.json` | 200/200/150 | Zufallssampling |
| `puzzles-E1-{1,2,3}.json` | 200/200/100 | Zufallssampling |

- Skript überspringt bereits existierende Dateien
- Shuffled + ohne Wiederholung abgespielt; bei Erschöpfung neu mischen
- **Statische Imports** in `PuzzleGenerator.ts` (kein dynamischer String-Import – Vite-Kompatibilität)

---

## 7. Services

### PuzzleGenerator
- Statische `import()`-Statements für alle 13 Bank-Dateien (Vite bündelt korrekt)
- `generate()` – synchron, nutzt Bank wenn geladen
- `generateAsync()` – lädt Bank lazy, dann aus Bank; try/catch verhindert App-Crash
- Fallback: Live-Generierung → vordefinierte Rätsel

### PuzzleValidator
- `validateToken()` – Echtzeit, gibt i18n-Key zurück
- `validateSolution()` – alle Zahlen verwendet, Klammern geschlossen, Ergebnis ≥ 0

### HintEngine
- Tipp 1: Zwischenwert aus Klammerausdruck
- Tipp 2: Zwei relevante Zahlen
- Tipp 3: Schlüssel-Operator (bevorzugt `×` oder `÷`)
- `getSolutionPreview()`: z.B. `(8…` oder `3×…`

### ScoringService
- Nur Streak-Verwaltung (keine Punkte mehr)
- Falsche Antwort bricht Streak nicht

### ProgressService
- `getLevelById()` gibt Fallback statt Exception
- Aufgeben: `hintsUsed === 99` → beide Streaks auf 0
- Migration: ungültige Level-IDs → reset auf `F2.1`

---

## 8. Hooks

```typescript
useGame(levelId, pointStreak, onResult)
  → puzzle | null, tokens, status, warning
  → addToken, deleteToken, clearTokens, submitSolution, nextPuzzle
  // puzzle ist null während erster Ladephase (→ GameBoard zeigt Loading)
  // Generation-Counter verhindert Race Condition bei schnellem Level-Wechsel

useHints(puzzle: Puzzle | null)
  → hints, hintsRemaining, requestHint, resetHints
  // akzeptiert null, reset via puzzleKey

useProgress()
  → progress, recordResult, setLevel, setLanguage, reset

useTranslation()
  → t(key, params?), language, changeLanguage
  // Subscriber-Pattern: re-render bei Sprachwechsel
```

---

## 9. UI-Komponenten

### Header
```
[ ⚙️ ]  [ Zahlenkönig · F2.1 ]  [ 💡 ] [ ❓ ] [ 🔥3 ]
```
- Streak nur angezeigt wenn ≥ 2
- 💡 öffnet Tipp-Popover (einzige Stelle – nicht mehr im Eingabefeld)

### NumberRow
```
A1: [    ]  [    ]  [ Z1 ]  [ Z2 ]
A2: [    ]  [ Z3 ]  [ Z1 ]  [ Z2 ]
A3: [ Z4 ]  [ Z3 ]  [ Z1 ]  [ Z2 ]
```
- `aspect-ratio: 1/1` für quadratische Buttons
- Weiß mit blauem Rand/Schrift

### InputRow
```
[ Ausdruck ✕ ]  [ = 14 ]
```
- Grid: `1fr auto`
- Eingabefeld: `aspect-ratio: 4/1`, weißer Hintergrund, blauer Rand
- Operator-Symbole im Eingabefeld: `*→×`, `/→÷`, `-→−`
- Zielzahl-Button: `aspect-ratio: 1/1`, dunkelblau, `=` links halbtransparent (20px), Wert rechts
- Kein Placeholder-Text

### KeyPad
```
Zeile 3: [ + ] [ − ] [ ⌫ ] [ = ]   ← immer sichtbar
Zeile 4: [ × ] [ ÷ ] [ ( ] [ ) ]   ← nur wenn Level sie unterstützt
Spacer:  (unsichtbar, füllt verbleibenden Platz)
```
- `aspect-ratio: 1/1` für alle Buttons
- Zeile 4 wird nicht gerendert wenn `!hasMulDiv && !hasBrackets`

### RulesPopover
- Auslöser: ❓ im Header
- Inhalt: Kurzanleitung (3 Abschnitte: Ziel, Regeln, Tipps)

---

## 10. Design-System

```css
/* Spieler-Elemente (Zahlen, Eingabe) */
--num-bg:        #ffffff
--num-border:    rgba(24,95,165,0.35)    /* blau */
--num-color:     #185fa5                 /* blau */
--target-bg:     linear-gradient(135deg,#1e3a5f,#185fa5)  /* dunkelblau */

/* Operatoren */
--op-bg:         #fff8ec
--op-border:     rgba(196,122,26,0.38)   /* gold */
--op-color:      #c47a1a                 /* gold */
--submit-bg:     linear-gradient(135deg,#c47a1a,#a85e0a)

/* Klammern */
--bracket-bg:    #ecf5ff
--bracket-border:rgba(60,140,220,0.30)
--bracket-color: #2a6abf

/* Allgemein */
--bg:            #faf7f2
--bg-card:       #ffffff
--accent:        #c47a1a
--correct:       #16a34a
--wrong:         #dc2626
--warning:       #ea580c
```

Schrift: `Courier New` – Taschenrechner-Ästhetik

---

## 11. i18n

Subscriber-Pattern: `subscribeToLanguage()` benachrichtigt alle `useTranslation`-Hooks bei Sprachwechsel → automatisches Re-render.

---

## 12. GitHub Actions Deployment

```yaml
Trigger: push to main
→ npm install
→ npm run build (tsc + vite build)
→ deploy to GitHub Pages
URL: https://funnygerman.github.io/zahlenkoenig
```
