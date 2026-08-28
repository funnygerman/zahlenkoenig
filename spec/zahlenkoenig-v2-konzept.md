# Zahlenkönig / Number King – v2 Konzept

**Version:** 2.0
**Stand:** August 2026
**Status:** Entwurf zur Abstimmung – noch keine Implementierung

Dieses Dokument beschreibt die Neukonzeption der Eingabe für v2. Es ersetzt
in den Punkten „Eingabe", „Validierung", „Tipps" und „Punkte & Streak" die
Abschnitte 2.4–2.6 der Anforderungen v1.5. Level-System, Rätsel-Bank und
Sprachumschaltung bleiben unverändert.

---

## 1. Die zentrale Änderung

Alle gewünschten Neuerungen – Klammer als Block, Drag & Drop, Umsortieren,
Entfernen ohne Knopf – haben dieselbe Ursache: **die flache Token-Liste muss
ein Baum werden.**

v1 speichert `Token[]`, also `[3, ×, (, 7, −, 2, )]`. Die Klammern sind darin
bloße Zeichen. Daraus folgen sämtliche Einschränkungen: Klammern können
unbalanciert sein, Tokens lassen sich nur anhängen und rückwärts löschen, und
es gibt keinen Ort, in den man etwas „hineinziehen" könnte.

v2 speichert einen **Ausdrucksbaum**. Damit lösen sich die übrigen Punkte fast
von selbst.

---

## 2. Datenmodell

```ts
type Operator = '+' | '-' | '*' | '/'

type ExprNode =
  | { id: string; kind: 'number';   value: number; source: number }
  | { id: string; kind: 'operator'; value: Operator }
  | { id: string; kind: 'group';    children: Slot[] }

type Slot = ExprNode | null      // null = sichtbare Lücke

interface Expression {
  root: Extract<ExprNode, { kind: 'group' }>   // wird ohne Klammern gezeichnet
}
```

- `source` ist der Index in `puzzle.numbers`, **nicht** der Wert. Bei Rätseln
  wie `[6, 6, 9]` sind die beiden Sechsen dadurch unterscheidbar; jede Zahl
  wird genau einmal verbraucht.
- `id` ist stabil über die Lebensdauer eines Chips. React benutzt sie als
  `key`, dadurch überleben Chips das Umsortieren und können animiert werden.

### 2.1 Die Invariante

> In `children` steht an **geraden** Positionen ein Operand (Zahl oder Gruppe),
> an **ungeraden** Positionen ein Operator. `null` markiert eine noch offene
> Position.

Diese eine Regel trägt das gesamte Design. Aus ihr ergibt sich, welche
Ablageflächen es gibt, was wo abgelegt werden darf und wann ein Ausdruck
fertig ist.

**Vollständig** ist eine Gruppe, wenn sie kein `null` mehr enthält und ihre
Länge ungerade ist. Eine Klammer-Gruppe braucht zusätzlich mindestens zwei
Operanden, also `children.length >= 3`.

---

## 3. Die vier Baum-Operationen

Mehr als diese vier Funktionen braucht die Eingabe nicht:

| Operation | Wirkung | Beispiel |
|---|---|---|
| **Einfügen** | `splice(i, 0, operand, null)` an gerader Position | `3 + 7` → 5 vor 7 → `3 + 5 ⬚ 7` |
| **Lücke füllen** | `children[i] = node` | `3 ⬚ 7` → `+` → `3 + 7` |
| **Tauschen** | zwei Positionen gleicher Parität vertauschen | `3 + 7` → 3 auf 7 → `7 + 3` |
| **Entfernen** | Operand: `splice(i, 2)` · Operator: `children[i] = null` | `3 + 7` → 7 raus → `3` |

Einfügen und Entfernen sind exakt zueinander invers. Beim Herausziehen einer
Zahl verschwindet der zugehörige Operator gleich mit – man bleibt nie auf einem
losen `+` sitzen. Beim Herausziehen eines Operators bleibt dagegen eine Lücke
stehen, denn wer einen Operator entfernt, will fast immer einen anderen
einsetzen.

### 3.1 Ablageflächen

Ablageflächen werden **berechnet, nicht gespeichert**:

- jede `null`-Position ist eine offene Fläche,
- die Position nach dem letzten Kind ist eine offene Fläche,
- jede belegte Position ist eine Tauschfläche für Chips gleicher Art.

Beim Ziehen einer Zahl leuchten nur Operand-Flächen, beim Ziehen eines
Operators nur Operator-Flächen.

---

## 4. Die Klammer als Block

Statt zweier Zeichen `(` und `)` gibt es **einen Chip `( )`**. Wird er auf eine
Operand-Fläche gezogen, entsteht dort eine leere Gruppe, die man anschließend
füllt.

- **Unbalancierte Klammern sind nicht mehr darstellbar.** Es gibt kein `(`
  ohne `)`.
- „Mindestens zwei Zahlen" ist genauer: **mindestens zwei Operanden**. Eine
  Gruppe darf eine Zahl und eine verschachtelte Gruppe enthalten – E1 braucht
  das.
- Die Ablage enthält genau so viele `( )`-Chips, wie das Level erlaubt
  (F2/F3: einen, E1: zwei). Das Kontingent ist damit sichtbar statt eine
  Regel, die man sich merken muss.
- Die Verschachtelungstiefe begrenzt `maxGroups` / `maxBracketDepth`. Eine
  Ablage in eine zu tiefe Position ist schlicht keine gültige Fläche.
- Wird eine gefüllte Gruppe herausgezogen, wandern die enthaltenen Zahlen
  zurück in die Ablage.

Für Erstklässler ist der Kasten das Konzept selbst – „das gehört zusammen" –
ganz ohne das abstrakte Klammersymbol.

### 4.1 Folge für E1

Die Bank speichert E1-Lösungen voll geklammert, z. B. `((9+9)+9)*9`. Im
Block-Modell genügt dafür **eine** Gruppe mit drei Operanden: `(9+9+9)×9`.

**Einige Experten-Rätsel werden dadurch leichter.** Die Prüfung erfolgt über
den berechneten Wert und nicht über einen Zeichenkettenvergleich, funktioniert
also weiterhin korrekt – aber die Schwierigkeitskurve verschiebt sich bei E1
nach unten. Ob E1 nachjustiert wird, entscheiden wir nach dem ersten Spieltest.

---

## 5. Bedienung: Ziehen und Tippen

Ziehen ist die Hauptbedienung, Tippen die Abkürzung.

| Geste | Wirkung |
|---|---|
| Chip in der Ablage **tippen** | wandert in die nächste offene Fläche |
| Chip im Ausdruck **tippen** | wandert zurück in die Ablage |
| Chip **ziehen** | genaue Ablage, Umsortieren, Tauschen, in eine Gruppe hinein |
| Chip aus dem Ausdruck **herausziehen** | entfernen (Zahlen kehren in die Ablage zurück) |

Tippen kostet fast keinen zusätzlichen Code – es ist dieselbe Operation mit
einem anderen Auslöser – hält aber Sechsjährige, Tastaturbedienung und
Screenreader im Spiel. Tippen auf einen platzierten Chip ist zugleich die
exakte Umkehrung des Platzierens; damit entfällt der Löschen-Knopf.

Zahlen werden **verbraucht**, Operatoren sind **unbegrenzt wiederverwendbar**.
Weil Zahlen die Ablage sichtbar verlassen, wird aus der Regel „jede Zahl genau
einmal" etwas, das man sieht statt es zu lesen.

### 5.1 Technik: Pointer Events

**Kein HTML5-Drag-and-Drop.** Es feuert auf iOS Safari bei Berührung nicht,
und die App ist Mobile First.

- `pointerdown` / `pointermove` / `pointerup` mit `setPointerCapture`
- ein Geisterelement folgt dem Finger über `transform` – ohne React-Render
  pro Bewegung
- Ablageflächen werden beim Ziehstart einmal vermessen und danach per
  Rechteck getroffen
- Schwelle von 6 px trennt Tippen von Ziehen
- `touch-action: none` und `user-select: none` auf allen Chips

Das sind rund 150 Zeilen in einem Hook. **Keine Bibliothek** – weder dnd-kit
noch react-dnd.

---

## 6. Gültigkeit durch Bauweise

Weil Ablageflächen typisiert sind, **können ungültige Ausdrücke gar nicht erst
entstehen**. Zwei Zahlen nebeneinander sind unmöglich, wenn hinter einer Zahl
nur eine Operator-Fläche liegt. Ein unzulässiger Zug findet keine Fläche, und
der Chip federt zurück.

Damit entfallen fünf der sechs Fehlermeldungen aus Anforderung 2.4:

| v1-Meldung | v2 |
|---|---|
| Erst einen Operator eingeben | entfällt – keine Fläche vorhanden |
| Erst eine Zahl eingeben | entfällt – keine Fläche vorhanden |
| Klammer hier nicht erlaubt | entfällt – keine Fläche vorhanden |
| Keine offene Klammer vorhanden | entfällt – nicht darstellbar |
| Alle Zahlen müssen verwendet werden | entfällt – ✓ bleibt gedimmt |
| Ungültiger Ausdruck | entfällt – nicht darstellbar |

**Übrig bleibt genau ein Signal: richtig oder falsch.** Nichts im Spiel tadelt
den Spieler noch für einen Zwischenschritt.

---

## 7. Auswerten

Ein rekursiver Auswerter ersetzt `Function('return ' + expr)()` aus
`PuzzleValidator` und `HintEngine`.

Pro Gruppe zwei Durchläufe über die Kinderliste: zuerst `×` und `÷`, dann `+`
und `−`. Verschachtelte Gruppen werden vorher rekursiv aufgelöst.

- Division durch Null (nur über eine Gruppe wie `(3−3)` erreichbar) liefert
  `null` → Ausdruck gilt als falsch
- gerechnet wird in Gleitkomma, verglichen mit Epsilon `1e-9`
- Zwischenergebnisse dürfen wie in v1 gebrochen sein; `9 ÷ 2 × 4 = 18` bleibt
  eine gültige Lösung
- das Endergebnis muss `≥ 0` sein

---

## 8. Abschicken

Ein **eigener ✓-Knopf**, rechts neben der Zielzahl:

```
      ╭─────────────────────╮
      │   3 × ⟨ 7 − 2 ⟩     │
      ╰─────────────────────╯
             = 14      ✓
```

Der Knopf ist **gedimmt und inaktiv**, solange nicht alle Zahlen gesetzt sind
oder noch eine Lücke offen ist. Damit ersetzt sein Zustand die letzten beiden
Validierungsmeldungen: „du bist noch nicht fertig" wird gezeigt statt gesagt.

Er sitzt am rechten Rand, damit der Ziehkorridor von der Ablage nach oben frei
bleibt.

---

## 9. Tipps neu gedacht

v1 zerlegt Lösungszeichenketten mit regulären Ausdrücken und ignoriert dabei,
was der Spieler bereits gebaut hat. Mit dem Baum geht deutlich mehr.

### 9.1 Grundlage: der Restlöser

Statt Lösungszeichenketten zu vergleichen, beantwortet ein kleiner Löser die
Frage: **„Lässt sich der angefangene Ausdruck mit den übrigen Zahlen noch auf
die Zielzahl bringen?"**

Bei höchstens vier Zahlen ist der Suchraum winzig – wenige tausend
Auswertungen, praktisch verzögerungsfrei. Die Suchlogik existiert bereits im
`PuzzleGenerator` und wird nur herausgezogen. Das ist robuster als jeder
Textvergleich, weil es auch Lösungen erkennt, die nicht in der Bank stehen.

### 9.2 Die Leiter

| Stufe | Inhalt | Verfügbar |
|---|---|---|
| **kostenlos** | *Sackgassen-Anzeige*: kann das Ziel nicht mehr erreicht werden, färbt sich der Rahmen des Ausdrucks bernstein | alle Level |
| 💡 1 | Zwischenwert: „Kannst du eine 15 bauen?" | alle Level |
| 💡 2 | zwei zusammengehörige Zahlen **pulsieren in der Ablage** | Fortgeschritten, Experte |
| 💡 3 | das Spiel **setzt ein Teil** – meist den `( )`-Block an die richtige Stelle | Experte |
| 🏳️ Aufgeben | eine vollständige Lösung wird als Chips gelegt, dann nächstes Rätsel | nach allen Tipps |

Zwei Punkte sind neu und wichtig:

**Tipps sind sichtbar statt lesbar.** Stufe 2 lässt zwei Chips pulsieren,
statt „Schau dir 2 und 5 an" zu schreiben. Die jüngsten Spieler können den
deutschen Tipptext nicht zuverlässig lesen – zwei leuchtende Chips schon.

**Die Sackgassen-Anzeige ist kostenlos und dauerhaft.** Still in eine Sackgasse
zu laufen ist die häufigste Frustration; für den Ausweg zu bezahlen wäre der
falsche Druck. *(Empfehlung – bitte beim Review bestätigen.)*

Da es keine Streaks mehr gibt, kosten Tipps ohnehin nichts. Die Leiter dient
nur noch der Dosierung. Aufgeben verliert jede Konsequenz und damit auch den
Bestätigungsdialog.

---

## 10. Fortschrittsanzeigen entfallen

Streaks, Punkte und Serien werden **vollständig entfernt**.

Gelöscht wird:

- `ScoringService` komplett
- `pointStreak`, `unlockStreaks`, `recordResult`
- `firstAttempt`-Verfolgung in `useGame` und `PuzzleValidator`
- 🔥 im Header
- ●●○ auf den Level-Karten der Einstellungen
- Aufgeben-Warnung „⚠️ Beide Streaks werden zurückgesetzt!"
- i18n-Abschnitte `streak.*`, `game.streak_bonus`

`StoredProgress` schrumpft von fünf Feldern auf zwei:

```ts
interface Settings {
  language: 'de' | 'en'
  currentLevelId: string   // Vorgabe: 'F2.1'
}
```

**Bewusste Folge:** Ein gelöstes Rätsel hinterlässt nichts Bleibendes. Der
Moment des Lösens ist damit die einzige Belohnung im Spiel – die
Jubel-Animation wird dadurch tragend statt schmückend und verdient
entsprechende Sorgfalt.

---

## 11. Layout

```
┌────────────────────────────────┐
│  ⚙️    Zahlenkönig · F2.1  💡 ❓ │   Kopfzeile
├────────────────────────────────┤
│                                │
│      ╭────────────────────╮    │   Ausdrucksfläche
│      │   3 × ⟨ 7 − 2 ⟩    │    │   (umbricht, wächst)
│      ╰────────────────────╯    │
│                                │
│             = 14      ✓        │   Ziel + Abschicken
├────────────────────────────────┤
│    3     7     2               │   Zahlen (verbraucht)
│    +  −  ×  ÷     ( )          │   Operatoren (wiederverwendbar)
└────────────────────────────────┘
```

**Die Ablage liegt unten, der Ausdruck oben.** Man zieht nach oben – die
bequeme Daumenrichtung – und die Hand verdeckt beim Ziehen nicht das, was man
gerade baut.

- Chips in der Ablage rund 56 px, im Ausdruck rund 44 px
- ab acht Chips umbricht die Ausdrucksfläche in eine zweite Zeile
- die Gruppe zeichnet sich als gerundeter Rahmen; die Klammern *sind* der
  Rahmen
- Bewegungen zwischen Ablage und Ausdruck laufen als FLIP-Animation
- Farbwelt, Schrift (`Courier New`) und die 430-px-Begrenzung auf Desktop
  bleiben unverändert

---

## 12. Dateistruktur

```
src/
├── core/                      rein, ohne React-Import
│   ├── expression.ts          Baum + die vier Operationen + Flächen
│   ├── evaluate.ts            Baum → Zahl (Präzedenz, kein eval)
│   ├── solver.ts              „ist das Ziel noch erreichbar?"
│   ├── hints.ts               Tippleiter über den Baum
│   ├── levels.ts              aus models/Level.ts, plus maxGroups
│   ├── puzzles.ts             Bank laden, mischen, ziehen
│   └── settings.ts            LocalStorage
├── ui/
│   ├── useDrag.ts             Pointer-Events-Ziehschicht
│   ├── useGame.ts             Spielzustand
│   ├── Game.tsx               Layout
│   ├── Expression.tsx         rekursives Zeichnen + Flächen
│   ├── Tray.tsx               Ablage
│   ├── Chip.tsx               ein Chip
│   ├── Header.tsx
│   ├── Settings.tsx
│   └── Popover.tsx            Basis für Tipps und Regeln
├── i18n/
└── main.tsx
```

Die Dateizahl bleibt in etwa gleich wie in v1 – der Gewinn liegt woanders:

- Die Schichtung **Services → Hooks → Components** verschwindet. Es gibt nur
  noch **`core/` (rein und testbar)** und **`ui/` (React)**.
- Der interessante Teil – Baum, Auswertung, Löser, Tipps – hat **keinen
  einzigen React-Import** und ist im Terminal testbar.
- Ersatzlos gestrichen: `ScoringService`, `PuzzleValidator`, `useProgress`,
  `useHints`, `NumberRow`, `KeyPad`, `InputRow`.
- Netto etwa ein Drittel weniger Code als v1.

**Unverändert übernommen:** die 13 Bank-Dateien und `generatePuzzles.mjs`,
die Level-Definitionen, i18n, das Farbsystem, der GitHub-Actions-Deploy.

---

## 13. Umsetzung in Schritten

| # | Schritt | Ergebnis |
|---|---|---|
| 1 | `core/` schreiben: Baum, Auswertung, Löser | im Terminal prüfbar, ohne UI |
| 2 | Ziehschicht + `Chip`, `Tray`, `Expression` | ein fest verdrahtetes Rätsel ist spielbar |
| 3 | Bank, Level, Einstellungen, ✓-Prüfung | vollständige Spielschleife |
| 4 | Tipps und Sackgassen-Anzeige | Tippleiter steht |
| 5 | Streaks überall entfernen, Texte anpassen | v1-Reste sind weg |
| 6 | Animationen, Größen, PWA | Feinschliff |

Nach Schritt 3 ist die App erstmals durchgehend spielbar; die Schritte 1 und 2
tragen das gesamte Risiko.

---

## 14. Offene Punkte und Risiken

| Punkt | Bewertung |
|---|---|
| **E1 wird leichter** (Abschnitt 4.1) | nach dem ersten Spieltest entscheiden, ob nachjustiert wird |
| **`puzzles-F2-3.json` enthält nur 35 Rätsel** | Wiederholung setzt schnell ein – Altlast aus v1, sollte nachgeneriert werden |
| **Sackgassen-Anzeige kostenlos?** | Empfehlung ja, bitte bestätigen |
| **Ziehen auf iOS Safari** | `touch-action: none` nötig; die App scrollt ohnehin nicht |
| **Gleiche Zahlen** wie `[6, 6, 9]` | über `source` unterschieden, nicht über den Wert – im Test abdecken |
| **Gruppe um den ganzen Ausdruck** | `(3+4)` als Gesamtausdruck ist erlaubt, verbraucht aber das Kontingent ohne Nutzen |
| **Verschachtelung auf kleinen Geräten** | E1 mit Tiefe 2 wird eng; Chips auf Tiefe 2 verkleinern |
