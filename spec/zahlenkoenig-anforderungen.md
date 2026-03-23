# Zahlenkönig / Number King – Anforderungen

**Version:** 1.5  
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
- Rätsel können aufgegeben werden (mit Streak-Konsequenz, siehe 2.5)

### 2.2 Puzzle-Generierung
- Nur lösbare Rätsel werden generiert
- Ein gültiges Rätsel hat 1–3 eindeutige Lösungen
- Division akzeptiert nur ganzzahlige Ergebnisse
- Alle Levels nutzen eine vorberechnete Puzzle-Bank (JSON-Dateien)
- A1, A2, A3, F1: exhaustive Bank (alle möglichen Rätsel)
- F2, F3, E1 Unterlevel: 300–500 Rätsel pro Unterlevel
- Bank wird ohne Wiederholung abgespielt (shuffled, wie Kartenstapel)
- Fallback-Strategie: Live-Generierung → vordefinierte Rätsel-Bibliothek

### 2.3 Stufensystem

| # | Level | Gruppe | Zahlen | Ops | Klammern | Unterlevel |
|---|---|---|---|---|---|---|
| 1 | A1 | 🌱 Anfänger | 2 | `+` `−` | — | — (Ziel 1–18) |
| 2 | A2 | 🌱 Anfänger | 3 | `+` `−` | — | — (Ziel 1–27) |
| 3 | A3 | 🌱 Anfänger | 4 | `+` `−` | — | — (Ziel 1–36) |
| 4 | F1 | 🔥 Fortgeschritten | 2 | alle | — | — (Ziel 1–81) |
| 5 | F2 | 🔥 Fortgeschritten | 3 | alle | max. 1× | .1 (1–50) · .2 (51–100) · .3 (101–162) |
| 6 | F3 | 🔥 Fortgeschritten | 4 | alle | max. 1× | .1 (1–50) · .2 (51–100) · .3 (101–171) |
| 7 | E1 | 🧠 Experte | 4 | alle | max. 2× | .1 (1–50) · .2 (51–100) · .3 (101–324) |

- **Standard-Level: F2.1**
- Alle Levels und Unterlevel immer frei wählbar (keine Sperrung)
- Keine automatische Beförderung – Nutzer entscheidet selbst
- Streak-Fortschritt (●●○) pro Level/Unterlevel angezeigt, sperrt nichts
- Kein Zielzahl-Schieberegler

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

| Tipp | Inhalt | Verfügbar | Beispiel |
|---|---|---|---|
| 💡 1 | Nützlicher Zwischenwert | Alle Levels | „Kannst du eine 7 berechnen?" |
| 💡💡 2 | Relevante zwei Zahlen | Fortgeschritten + Experte | „Schau dir 2 und 5 an" |
| 💡💡💡 3 | Operator-Hinweis (bevorzugt × oder ÷) | Experte | „Versuch es mit ×" |
| 🏳️ Aufgeben | Lösungsvorschau + Streak-Reset | Alle, nur nach letztem Tipp | `3×(…` |

- Vollständige Lösung wird **nie** angezeigt
- Erster Tipp wird automatisch beim Öffnen des Popovers angezeigt
- Max. reguläre Tipps: Anfänger 1, Fortgeschritten 2, Experte 3
- 💡 nur im Header (nicht im Eingabefeld)
- Aufgeben erscheint erst **nachdem alle regulären Tipps verbraucht sind**
- Aufgeben erfordert Bestätigung mit Warnung: „⚠️ Beide Streaks werden zurückgesetzt!"
- Nach Bestätigung: neues Rätsel, beide Streaks auf 0

### 2.6 Punkte & Streak

- Punkte-Anzeige entfernt (zu abstrakt)
- Streak 🔥 wird im Header angezeigt, aber nur wenn ≥ 2

| Aktion | Streak |
|---|---|
| Richtig, 1. Versuch, kein Tipp | +1 |
| Richtig, 1. Versuch, mit Tipp | Reset auf 0 |
| Richtig nach Fehlversuch | Reset auf 0 |
| Falsche Antwort | bleibt |
| Aufgeben | Reset auf 0 |

### 2.7 Spielregeln-Popup

Inhalt des ❓-Popups:

```
🎯 Ziel
Berechne die Zielzahl mit deinen Zahlen!

📐 Regeln
• Benutze alle Zahlen genau einmal
• Erlaubte Operationen: + − × ÷ ( )
• Das Ergebnis muss ≥ 0 sein

💡 Tipps
Tippe auf 💡 wenn du nicht weiterkommst
```

---

## 3. Nicht-funktionale Anforderungen

- **Mobile First** – optimiert für Smartphones, kein Scrollen
- **PWA** – installierbar, offline-fähig
- **Mehrsprachig** – Deutsch und Englisch (automatisch per Gerätesprache, manuell umschaltbar)
- **Kein Sound**
- **Light Mode** Design
- **Lokale Datenspeicherung** (LocalStorage, kein Account)
- **Desktop** – App zentriert dargestellt, max. 430px Breite

---

## 4. UI-Anforderungen

### 4.1 Layout (Mobile First, Screen-füllend)

```
┌──────────────────────────────────┐
│  ⚙️      Zahlenkönig    💡  ❓  🔥3│  Header
├──────────────────────────────────┤
│  [    ] [    ] [ Z1 ] [ Z2 ]    │  Zahlen-Zeile (quadratisch)
├──────────────────────────────────┤
│  [ Eingabe...      ] [ = 14 ]   │  Eingabe + Zielzahl
├──────────────────────────────────┤
│  [  +  ] [  −  ] [  ⌫  ] [  = ]│  Basis-Operatoren (quadratisch)
├──────────────────────────────────┤
│  [  ×  ] [  ÷  ] [  (  ] [  ) ]│  Erweiterte Ops (nur wenn Level)
├──────────────────────────────────┤
│  (unsichtbarer Spacer)           │  Füllt verbleibenden Platz
└──────────────────────────────────┘
```

### 4.2 Zahlen-Zeile

```
A1 (2 Zahlen):  [    ]  [    ]  [ Z1 ]  [ Z2 ]
A2 (3 Zahlen):  [    ]  [ Z3 ]  [ Z1 ]  [ Z2 ]
A3 (4 Zahlen):  [ Z4 ]  [ Z3 ]  [ Z1 ]  [ Z2 ]
```

- Z1 und Z2 immer rechts (stabile Position)
- Z3 und Z4 wachsen nach links
- Leere Plätze: unsichtbar, Layout bleibt stabil
- Alle Buttons quadratisch (`aspect-ratio: 1/1`)
- Verwendete Zahlen: ausgegraut + inaktiv
- Farbe: weißer Hintergrund, blauer Rand und blaue Schrift

### 4.3 Eingabe-Zeile

- Layout: `[Eingabefeld] [= Ziel]` – zwei Spalten
- Eingabefeld: gleiche Höhe wie Zahlen-Buttons, wächst in der Breite
- Zielzahl-Button: quadratisch, gleiche Größe wie Zahlen-Buttons
- `=` steht links im Zielzahl-Button (horizontal, halbtransparent)
- Farbe Eingabefeld: weißer Hintergrund, blauer Rand, blaue Zahlen
- Farbe Zielzahl-Button: dunkelblau, weiße Schrift
- `✕` löscht die gesamte Eingabe (erscheint wenn Tokens vorhanden)
- Kein Placeholder-Text
- Operatoren werden als `+`, `−`, `×`, `÷` angezeigt (nicht `*`, `/`)

### 4.4 Operator-Zeilen

- Zeile 3 (`+`, `−`, `⌫`, `=`): immer sichtbar
- Zeile 4 (`×`, `÷`, `(`, `)`): **nur angezeigt wenn Level `×`/`÷` oder Klammern unterstützt**
- Alle Buttons quadratisch (`aspect-ratio: 1/1`)
- Nicht verfügbare Buttons: unsichtbar (`opacity: 0`), Platz bleibt erhalten

### 4.5 Farbkonzept

| Element | Hintergrund | Rand | Schrift |
|---|---|---|---|
| Zahlen-Buttons | `#ffffff` | `rgba(24,95,165,0.35)` blau | `#185fa5` blau |
| Eingabefeld | `#ffffff` | `rgba(24,95,165,0.35)` blau | `#185fa5` blau |
| Zielzahl-Button | `#1e3a5f→#185fa5` dunkelblau | — | `#ffffff` weiß |
| Operator-Buttons | `#fff8ec` hellgold | `rgba(196,122,26,0.38)` gold | `#c47a1a` gold |
| Klammer-Buttons | `#ecf5ff` hellblau | `rgba(60,140,220,0.30)` blau | `#2a6abf` blau |
| `=` Submit | `#c47a1a→#a85e0a` gold | — | `#ffffff` weiß |

### 4.6 Einstellungs-Screen

- Erreichbar über ⚙️ oben links
- Level-Auswahl mit kompakten Karten (ID, Anzahl Zahlen, Zielbereich, Streak)
- Sprache umschalten (DE / EN)
- Reset-Button (mit Bestätigungsdialog)

### 4.7 Popover-Übersicht

| Popover | Auslöser | Inhalt |
|---|---|---|
| Tipps 💡 | 💡 im Header | Gestuftes Tipp-System + Aufgeben |
| Spielregeln ❓ | ❓ im Header | Kurzanleitung (siehe 2.7) |
| Einstellungen ⚙️ | ⚙️ im Header | Level-Auswahl, Sprache, Reset |
