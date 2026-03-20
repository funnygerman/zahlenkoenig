# Zahlenkönig / Number King – Anforderungen

**Version:** 1.2  
**Stand:** März 2026

---

## 1. Produktvision

**Zahlenkönig** (EN: **Number King**) ist ein mathematisches Rätselspiel für Mobile. Der Spieler erhält Zahlen und muss durch Rechenoperationen eine vorgegebene Zielzahl erreichen. Zielgruppe: Erstklässler bis Mathe-Enthusiasten.

---

## 2. Funktionale Anforderungen

### 2.1 Spielregeln
- Der Spieler erhält 2–4 zufällige Zahlen (1–9, je nach Level)
- Alle Zahlen müssen verwendet werden, jede genau einmal
- Erlaubte Operationen: `+`, `−`, `×`, `÷`, `(`, `)` (je nach Level)
- Zielzahl ist immer ≥ 0
- Es gibt kein Überspringen von Rätseln

### 2.2 Puzzle-Generierung
- Nur lösbare Rätsel werden generiert
- Ein gültiges Rätsel hat 1–3 eindeutige Lösungen
- Division akzeptiert nur ganzzahlige Ergebnisse
- Für F2, F3, E1: Rätsel werden aus einer vorgenerierten Bank geladen (500 Rätsel pro Level)
- Für A1, A2, A3, F1: Live-Generierung (schnell genug)
- Fallback-Strategie: Constraints lockern → vordefinierte Rätsel-Bibliothek

### 2.3 Stufensystem

| # | Level | Gruppe | Zahlen | Operationen | Klammern | Zielbereich | Max (Schieberegler) |
|---|---|---|---|---|---|---|---|
| 1 | A1 | 🌱 Anfänger | 2 | `+` `−` | — | 1–18 | 18 |
| 2 | A2 | 🌱 Anfänger | 3 | `+` `−` | — | 1–27 | 27 |
| 3 | A3 | 🌱 Anfänger | 4 | `+` `−` | — | 1–36 | 36 |
| 4 | F1 | 🔥 Fortgeschritten | 2 | alle | — | 1–81 | 81 |
| 5 | F2 | 🔥 Fortgeschritten | 3 | alle | max. 1× | 1–100 | 162 |
| 6 | F3 | 🔥 Fortgeschritten | 4 | alle | max. 1× | 1–100 | 171 |
| 7 | E1 | 🧠 Experte | 4 | alle | max. 2× | 1–100 | 324 |

- **Standard-Level: F2**
- Alle Levels sind immer frei wählbar (keine Sperrung)
- Streak-Fortschritt wird angezeigt (3 Punkte pro Level = gemeistert), sperrt aber nichts

### 2.4 Eingabe-Validierung (Echtzeit)

| Fehler | Meldung (DE) | Meldung (EN) |
|---|---|---|
| Zwei Zahlen hintereinander | „Erst einen Operator eingeben" | „Enter an operator first" |
| Operator ohne vorherige Zahl | „Erst eine Zahl eingeben" | „Enter a number first" |
| Öffnende Klammer an falscher Stelle | „Klammer hier nicht erlaubt" | „Bracket not allowed here" |
| Schließende Klammer ohne offene | „Keine offene Klammer vorhanden" | „No open bracket found" |
| Nicht alle Zahlen verwendet | „Alle Zahlen müssen verwendet werden" | „Use all numbers" |
| Ungültiger Ausdruck | „Ungültiger Ausdruck" | „Invalid expression" |
| Nicht geschlossene Klammer | Wird beim Prüfen abgefangen | — |
| Ergebnis < 0 | Wird als falsch gewertet | — |

### 2.5 Tipp-System

| Tipp | Inhalt | Beispiel (Lösung: `3*(2+5)−1=20`) |
|---|---|---|
| 💡 1 | Nützlicher Zwischenwert | „Kannst du eine 7 berechnen?" |
| 💡💡 2 | Relevante zwei Zahlen | „Schau dir 2 und 5 an" |
| 💡💡💡 3 | Operator-Hinweis (bevorzugt × oder ÷) | „Versuch es mit ×" |

- Vollständige Lösung wird **nie** angezeigt
- Erster Tipp wird automatisch beim Öffnen des Popovers angezeigt
- Max. Tipps: Anfänger 1, Fortgeschritten 2, Experte 3
- 💡-Button immer aktiv; zeigt bisherige Tipps wenn alle verbraucht

### 2.6 Punkte & Feedback

| Aktion | Punkte | Punkt-Streak |
|---|---|---|
| Richtig, 1. Versuch, kein Tipp, Streak < 3 | +10 | +1 |
| Richtig, 1. Versuch, kein Tipp, Streak ≥ 3 | +20 | +1 |
| Richtig, 1. Versuch, mit Tipp | +5 | Reset auf 0 |
| Richtig nach Fehlversuch | +5 | Reset auf 0 |
| Falsche Antwort | 0 | bleibt |
| Minimum | 0 (nie negativ) | — |

---

## 3. Nicht-funktionale Anforderungen

- **Mobile First** – optimiert für Smartphones
- **PWA** – installierbar, offline-fähig
- **Mehrsprachig** – Deutsch und Englisch (automatisch per Gerätesprache, manuell umschaltbar)
- **Kein Sound**
- **Light Mode** Design (warme Cremeton-Palette)
- **Lokale Datenspeicherung** (LocalStorage, kein Account)

---

## 4. UI-Anforderungen

### 4.1 Layout (Taschenrechner-Prinzip, Mobile First)
```
┌─────────────────────────────────┐
│  ⋮   Zahlenkönig – F2      🔥3  │  Header
├─────────────────────────────────┤
│  [ 💡  3 + 5 · · · · ]  [✕] [⌫]│  Eingabefeld
├─────────────────────────────────┤
│       [  (  ]  [  )  ]  [  =  ]│  Klammern + Submit
├─────────────────────────────────┤
│   [  +  ]   [ Z3 ]   [  −  ]   │
├─────────────────────────────────┤
│   [ Z1  ]   [Ziel]   [ Z2  ]   │
├─────────────────────────────────┤
│   [  ×  ]   [ Z4 ]   [  ÷  ]   │
└─────────────────────────────────┘
```

### 4.2 Button-Regeln
- Layout bleibt immer gleich, unabhängig vom Level
- Nicht verfügbare Operatoren (`×`, `÷` bei Anfänger): leer + inaktiv (`pointer-events: none`)
- Nicht vorhandene Zahlen (Z3 bei 2 Zahlen, Z4 bei 2–3 Zahlen): leer + inaktiv
- Klammern bei `maxBracketDepth === 0`: leer + inaktiv
- Verwendete Zahlen: ausgegraut + inaktiv
- Submit-Button: `=`

### 4.3 Einstellungs-Screen
- Erreichbar über `⋮` oben links
- Level-Auswahl mit Streak-Anzeige (3 Punkte)
- Zielzahl-Schieberegler pro Level (Minimum 1, Maximum = kleinerer Wert aus mathematischem Maximum und 500)
- Sprache umschalten (DE / EN)
- Reset-Button (mit Bestätigungsdialog)

### 4.4 Tipp-Popover
- 💡 links im Eingabefeld öffnet Popover
- Erster Tipp wird sofort beim Öffnen angezeigt
- Schließbar durch Tippen außerhalb
