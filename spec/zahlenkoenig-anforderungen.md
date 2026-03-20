# Zahlenkönig / Number King – Anforderungen

**Version:** 1.1  
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
- Duplikate werden herausgefiltert (`3+5` = `5+3`)
- Fallback: Constraints lockern → vordefinierte Rätsel-Bibliothek

### 2.3 Stufensystem

| Stufe | Level | Zahlen | Operationen | Klammern | Zielbereich |
|---|---|---|---|---|---|
| 🌱 Anfänger | A1 | 2 | `+` `−` | — | 1–10 |
| | A2 | 2 | `+` `−` | — | 1–20 |
| | A3 | 3 | `+` `−` | — | 1–20 |
| | A4 | 4 | `+` `−` | — | 1–30 |
| 🔥 Fortgeschritten | F1 | 2 | `+` `−` `×` `÷` | — | 1–20 |
| | F2 | 3 | `+` `−` `×` `÷` | max. 1× | 1–50 |
| | F3 | 4 | `+` `−` `×` `÷` | max. 1× | 1–50 |
| 🧠 Experte | E1 | 3 | alle | max. 1× | 1–100 |
| | E2 | 4 | alle | max. 2× | 1–100 |

- **Standard-Level: F2**
- Alle Levels sind immer frei wählbar (keine Sperrung)
- Streak-Fortschritt wird angezeigt (3 Punkte = Level gemeistert), sperrt aber nichts

### 2.4 Tipp-System

| Tipp | Inhalt | Beispiel |
|---|---|---|
| 💡 1 | Nützlicher Zwischenwert | „Kannst du eine 7 berechnen?" |
| 💡💡 2 | Relevante zwei Zahlen | „Schau dir 2 und 5 an" |
| 💡💡💡 3 | Operator-Hinweis | „Versuch es mit ×" |

- Vollständige Lösung wird **nie** angezeigt
- Max. Tipps: Anfänger 1, Fortgeschritten 2, Experte 3
- 💡-Button immer aktiv; zeigt bisherige Tipps wenn alle verbraucht

### 2.5 Punkte & Feedback

| Aktion | Punkte | Streak |
|---|---|---|
| Richtig, 1. Versuch, kein Tipp, Streak < 3 | +10 | +1 |
| Richtig, 1. Versuch, kein Tipp, Streak ≥ 3 | +20 | +1 |
| Richtig, 1. Versuch, mit Tipp | +5 | 0 |
| Richtig nach Fehlversuch | +5 | 0 |
| Minimum | 0 | — |

---

## 3. Nicht-funktionale Anforderungen

- **Mobile First** – optimiert für Smartphones
- **PWA** – installierbar, offline-fähig
- **Mehrsprachig** – Deutsch und Englisch (automatisch per Gerätesprache)
- **Kein Sound**
- **Lokale Datenspeicherung** (LocalStorage, kein Account)
- **Light Mode** Design

---

## 4. UI-Anforderungen

### 4.1 Layout (Taschenrechner-Prinzip)
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
- Nicht verfügbare Operatoren: unsichtbar, inaktiv (Platz bleibt)
- Nicht vorhandene Zahlen (Z3/Z4 bei 2er-Levels): leer, inaktiv
- Verwendete Zahlen: ausgegraut, inaktiv
- Submit-Button: `=`

### 4.3 Einstellungs-Screen
- Erreichbar über `⋮` oben links
- Level-Auswahl mit Streak-Anzeige (3 Punkte)
- Zielzahl-Schieberegler pro Level (max. 500)
- Sprache umschalten
- Reset-Button

### 4.4 Tipp-Popover
- 💡 links im Eingabefeld
- Schließbar durch Tippen außerhalb
