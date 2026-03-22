# Zahlenkönig / Number King – Technische Spezifikation

**Version:** 1.5  
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
│   └── storage/       IStorage.ts, LocalStorage.ts
├── data/              puzzles-A1.json, puzzles-A2.json, puzzles-A3.json,
│                      puzzles-F1.json,
│                      puzzles-F2-1.json, puzzles-F2-2.json, puzzles-F2-3.json,
│                      puzzles-F3-1.json, puzzles-F3-2.json, puzzles-F3-3.json,
│                      puzzles-E1-1.json, puzzles-E1-2.json, puzzles-E1-3.json
├── i18n/              de.ts, en.ts, index.ts
├── hooks/             useGame.ts, useHints.ts, useProgress.ts, useTranslation.ts
├── components/
│   ├── GameBoard/     Haupt-Container
│   ├── Header/        App-Name, Streak, ⚙️ 💡 ❓
│   ├── NumberRow/     Zahlen-Zeile (Z4 Z3 Z1 Z2)
│   ├── InputRow/      Eingabefeld = Zielzahl
│   ├── KeyPad/        Operator-Tasten (2 Zeilen à 4 Buttons)
│   ├── HintPopover/   Tipp-Overlay
│   ├── RulesPopover/  Spielregeln-Overlay (neu)
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
  baseId: string          // z.B. "F2" (Hauptlevel)
  subLevel: 1 | 2 | 3 | null  // null für A1-F1
  group: 'beginner' | 'advanced' | 'expert'
  numberCount: 2 | 3 | 4
  operators: Operator[]
  maxBracketDepth: 0 | 1 | 2
  targetRange: { min: number; max: number }
  maxTarget: number
}

interface StoredProgress {
  unlockStreaks: Record<string, number>  // per levelId
  pointStreak: number
  customTargets: Record<string, number>  // entfernt (kein Slider mehr)
  language: 'de' | 'en'
  currentLevelId: string   // default: 'F2.1'
}
```

---

## 5. Level-Definitionen

```typescript
const LEVELS: Level[] = [
  // Anfänger (keine Unterlevel)
  { id:'A1', baseId:'A1', subLevel:null, group:'beginner',  numberCount:2, operators:['+','-'],         maxBracketDepth:0, targetRange:{min:1,max:18},  maxTarget:18  },
  { id:'A2', baseId:'A2', subLevel:null, group:'beginner',  numberCount:3, operators:['+','-'],         maxBracketDepth:0, targetRange:{min:1,max:27},  maxTarget:27  },
  { id:'A3', baseId:'A3', subLevel:null, group:'beginner',  numberCount:4, operators:['+','-'],         maxBracketDepth:0, targetRange:{min:1,max:36},  maxTarget:36  },
  // Fortgeschritten – F1 ohne Unterlevel
  { id:'F1', baseId:'F1', subLevel:null, group:'advanced',  numberCount:2, operators:['+','-','*','/'], maxBracketDepth:0, targetRange:{min:1,max:81},  maxTarget:81  },
  // Fortgeschritten – F2 mit Unterleveln
  { id:'F2.1', baseId:'F2', subLevel:1, group:'advanced',  numberCount:3, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:1,  max:50 }, maxTarget:162 },
  { id:'F2.2', baseId:'F2', subLevel:2, group:'advanced',  numberCount:3, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:51, max:100}, maxTarget:162 },
  { id:'F2.3', baseId:'F2', subLevel:3, group:'advanced',  numberCount:3, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:101,max:162}, maxTarget:162 },
  // Fortgeschritten – F3 mit Unterleveln
  { id:'F3.1', baseId:'F3', subLevel:1, group:'advanced',  numberCount:4, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:1,  max:50 }, maxTarget:171 },
  { id:'F3.2', baseId:'F3', subLevel:2, group:'advanced',  numberCount:4, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:51, max:100}, maxTarget:171 },
  { id:'F3.3', baseId:'F3', subLevel:3, group:'advanced',  numberCount:4, operators:['+','-','*','/'], maxBracketDepth:1, targetRange:{min:101,max:171}, maxTarget:171 },
  // Experte – E1 mit Unterleveln
  { id:'E1.1', baseId:'E1', subLevel:1, group:'expert',    numberCount:4, operators:['+','-','*','/'], maxBracketDepth:2, targetRange:{min:1,  max:50 }, maxTarget:324 },
  { id:'E1.2', baseId:'E1', subLevel:2, group:'expert',    numberCount:4, operators:['+','-','*','/'], maxBracketDepth:2, targetRange:{min:51, max:100}, maxTarget:324 },
  { id:'E1.3', baseId:'E1', subLevel:3, group:'expert',    numberCount:4, operators:['+','-','*','/'], maxBracketDepth:2, targetRange:{min:101,max:324}, maxTarget:324 },
]
```

---

## 6. Puzzle-Bank

```
scripts/generatePuzzles.mjs    Einmalig lokal ausführen
node --max-old-space-size=512 scripts/generatePuzzles.mjs
```

| Datei | Inhalt | Strategie |
|---|---|---|
| `puzzles-A1.json` | ~81 Rätsel | Exhaustiv |
| `puzzles-A2.json` | ~192 Rätsel | Exhaustiv |
| `puzzles-A3.json` | ~140 Rätsel | Exhaustiv |
| `puzzles-F1.json` | ~138 Rätsel | Exhaustiv |
| `puzzles-F2-1.json` | 500 Rätsel | Zufallssampling (Ziel 1–50) |
| `puzzles-F2-2.json` | 500 Rätsel | Zufallssampling (Ziel 51–100) |
| `puzzles-F2-3.json` | 500 Rätsel | Zufallssampling (Ziel 101–162) |
| `puzzles-F3-{1,2,3}.json` | je 500 | Zufallssampling |
| `puzzles-E1-{1,2,3}.json` | je 500 | Zufallssampling |

- Skript überspringt bereits existierende Dateien
- Bank wird shuffled + ohne Wiederholung abgespielt
- Bei Erschöpfung: neu mischen und von vorne

---

## 7. Services

### PuzzleGenerator
- `generate()` – synchron, nutzt Bank wenn geladen
- `generateAsync()` – lädt Bank zuerst (lazy), dann aus Bank
- Bank-Dateiname: `puzzles-{levelId}.json` mit `.` → `-` (z.B. `puzzles-F2-1.json`)
- Fallback: Live-Generierung → vordefinierte Rätsel

### PuzzleValidator
- `validateToken()` – Echtzeit, gibt i18n-Key zurück
- `validateSolution()` – alle Zahlen verwendet, Klammern geschlossen, Ergebnis ≥ 0

### HintEngine
- Tipp 1: Zwischenwert
- Tipp 2: Zwei relevante Zahlen
- Tipp 3: Schlüssel-Operator
- `getSolutionPreview()`: z.B. `(8…` oder `3*…`

### ScoringService
- Kein Punktesystem mehr
- Nur noch Streak-Verwaltung

### ProgressService
- Kein `customTargets` mehr (Slider entfernt)
- Standard-Level: `F2.1`
- Alle Levels immer freigeschaltet
- Aufgeben: `hintsUsed === 99` → Streak auf 0

---

## 8. Hooks

```typescript
useGame(levelId, pointStreak, onResult)
  → puzzle, tokens, status, warning
  → addToken, deleteToken, clearTokens, submitSolution, nextPuzzle

useHints(puzzle)
  → hints, hintsRemaining, requestHint, resetHints

useProgress()
  → progress, recordResult, setLevel, setLanguage, reset

useTranslation()
  → t(key, params?), language, changeLanguage
  // Subscriber-Pattern: re-render bei Sprachwechsel
```

---

## 9. UI-Komponenten

### Header
- Links: ⚙️ → Einstellungs-Screen
- Mitte: „Zahlenkönig" + aktuelles Level (z.B. „F2.1")
- Rechts: 💡 → Tipp-Popover, ❓ → Spielregeln-Popover, 🔥3 (nur wenn Streak ≥ 2)

### NumberRow
```
A1: [    ]  [    ]  [ Z1 ]  [ Z2 ]
A2: [    ]  [ Z3 ]  [ Z1 ]  [ Z2 ]
A3: [ Z4 ]  [ Z3 ]  [ Z1 ]  [ Z2 ]
```
- Leere Slots: unsichtbar, Platz bleibt erhalten
- Verwendete Zahlen: ausgegraut

### InputRow
```
[ Ausdruck ··· ]  =  [ Ziel ]
```
- `=` ist statischer Text, kein Button
- Zielzahl: prominent, nicht klickbar
- ✕ zum Löschen (links im Eingabefeld oder daneben)

### KeyPad (2 Zeilen, immer stabil)
```
Zeile 3: [ + ] [ − ] [ ⌫ ] [ = ]
Zeile 4: [ × ] [ ÷ ] [ ( ] [ ) ]
```
- `×`, `÷` bei Anfänger: leer + inaktiv
- `(`, `)` bei maxBracketDepth=0: leer + inaktiv

### RulesPopover (neu)
- Auslöser: ❓ im Header
- Inhalt: Kurzanleitung (siehe Anforderungen 2.7)
- Schließbar durch Tippen außerhalb

---

## 10. Design-System (Light Mode)

```css
--bg-primary:      #faf7f2
--bg-card:         #ffffff
--accent:          #c47a1a
--num-color:       #2a1f0a
--op-color:        #c47a1a
--bracket-color:   #2a6abf
--correct:         #16a34a
--wrong:           #dc2626
--warning:         #ea580c
```

Schrift: `Courier New` – Taschenrechner-Ästhetik

---

## 11. i18n

Eigener `useTranslation`-Hook mit Subscriber-Pattern. Sprache aus `navigator.language`, manuell überschreibbar. Übersetzungen als TypeScript-Objekte.

---

## 12. GitHub Actions Deployment

```yaml
Trigger: push to main
→ npm install
→ npm run build
→ deploy to GitHub Pages
URL: https://funnygerman.github.io/zahlenkoenig
```
