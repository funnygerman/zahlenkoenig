# Zahlenkönig / Number King – v2 Konzept

**Version:** 2.1
**Stand:** September 2026
**Status:** Abgestimmt – bereit zur Umsetzung

Dieses Dokument beschreibt die Neukonzeption von Eingabe und Gestaltung für v2.
Es ersetzt die Abschnitte 2.4–2.6 sowie Kapitel 4 der Anforderungen v1.5.
Level-System, Rätsel-Bank und Sprachumschaltung bleiben unverändert.

---

## 1. Die zentrale Änderung

Alle Neuerungen – Klammer als Block, Drag & Drop, Umsortieren, Entfernen ohne
Knopf – haben dieselbe Ursache: **die flache Token-Liste muss ein Baum werden.**

v1 speichert `Token[]`, also `[3, ×, (, 7, −, 2, )]`. Die Klammern sind darin
bloße Zeichen. Daraus folgen sämtliche Einschränkungen: Klammern können
unbalanciert sein, Tokens lassen sich nur anhängen und rückwärts löschen, und es
gibt keinen Ort, in den man etwas „hineinziehen" könnte.

---

## 2. Datenmodell

```ts
type Operator = '+' | '-' | '*' | '/'

type Leaf =
  | { id: string; kind: 'number';   value: number; source: number }
  | { id: string; kind: 'operator'; value: Operator }

type Group = { id: string; kind: 'group'; children: (Leaf | null)[] }

type Slot = Leaf | Group | null      // null = sichtbare Lücke

interface Expression {
  root: { id: 'root'; kind: 'group'; children: Slot[] }
}
```

- **Genau zwei Ebenen.** Die Wurzel enthält Zahlen, Operatoren und Gruppen; eine
  Gruppe enthält nur noch Zahlen und Operatoren. **Keine Gruppe in einer Gruppe**
  (siehe Abschnitt 4). Der Typ erzwingt das: `Group.children` kennt kein `Group`.
- `source` ist der Index in `puzzle.numbers`, **nicht** der Wert. Bei Rätseln wie
  `[6, 6, 9]` sind die beiden Sechsen dadurch unterscheidbar.
- `id` ist über die Lebensdauer eines Chips stabil. React nutzt sie als `key`,
  dadurch überleben Chips das Umsortieren und lassen sich animieren.

### 2.1 Die Invariante

> In `children` steht an **geraden** Positionen ein Operand (Zahl oder Gruppe),
> an **ungeraden** Positionen ein Operator. `null` markiert eine offene Position.

Diese eine Regel trägt das gesamte Design: aus ihr ergibt sich, welche
Ablageflächen es gibt, was wo abgelegt werden darf und wann ein Ausdruck fertig
ist.

**Vollständig** ist eine Gruppe, wenn sie kein `null` mehr enthält und ihre Länge
ungerade ist. Eine Klammer-Gruppe braucht zusätzlich mindestens zwei Operanden,
also `children.length >= 3`.

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
Zahl verschwindet der zugehörige Operator mit – man bleibt nie auf einem losen
`+` sitzen. Beim Herausziehen eines Operators bleibt dagegen eine Lücke stehen,
denn wer einen Operator entfernt, will fast immer einen anderen einsetzen.

### 3.1 Ablageflächen

Ablageflächen werden **berechnet, nicht gespeichert**:

- jede `null`-Position ist eine offene Fläche,
- die Position nach dem letzten Kind ist eine offene Fläche,
- jede belegte Position ist eine Tauschfläche für Chips gleicher Art.

Beim Ziehen einer Zahl leuchten nur Operand-Flächen, beim Ziehen eines Operators
nur Operator-Flächen.

**Reihenfolge beim Tippen:** „nächste offene Fläche" ist streng die
Dokumentreihenfolge – die Innenflächen einer Gruppe kommen vor der Fläche hinter
der Gruppe.

---

## 4. Die Klammer als Block

Statt zweier Zeichen `(` und `)` gibt es **einen Chip**. Wird er auf eine
Operand-Fläche gezogen, entsteht dort eine leere Gruppe, die man anschließend
füllt.

- **Unbalancierte Klammern sind nicht darstellbar.** Es gibt kein `(` ohne `)`.
- Die Regel lautet **mindestens zwei Operanden**. Sinnvoll sind zwei bis drei
  Zahlen; vier wären der ganze Ausdruck in Klammern und damit nutzlos, werden
  aber nicht eigens verboten.
- **Keine Verschachtelung.** Eine Gruppe enthält nie eine weitere Gruppe. E1
  bekommt stattdessen **zwei nebeneinanderliegende** Blöcke.
- Die Ablage enthält genau so viele Block-Chips, wie das Level erlaubt
  (F2/F3: einen, E1: zwei). Das Kontingent ist sichtbar statt eine Regel, die man
  sich merken muss.
- Wird eine gefüllte Gruppe herausgezogen, wandern die enthaltenen Zahlen zurück
  in die Ablage. Weil das mehrere Zahlen auf einmal betrifft, muss der Zug den
  Ausdrucksbereich erst um ~24 px verlassen, bevor er ausgelöst wird.

### 4.1 Verschachtelung entfällt – geprüft

Die Bank speichert E1-Lösungen voll geklammert, etwa `((7*8)+1)*3`. Ohne
Verschachtelung wäre die Sorge, dass Rätsel unlösbar werden.

**Sie werden es nicht.** Ein Prüfskript hat alle **1500** E1-Rätsel gegen einen
erschöpfenden Suchraum aus Ausdrücken mit maximal einer Klammerebene getestet:

```
checked 1500 E1 puzzles
unsolvable with depth<=1: 0
```

Das Skript wurde zusätzlich gegen bekannte Fälle geprüft (`[1,1,1,1] → 1000`
korrekt als unlösbar, `[9,9,9,9] → 243` als lösbar), damit das Ergebnis nicht
bloß ein immer-wahr ist.

Der Grund ist strukturell: **die Punktrechnung innerhalb einer flachen Gruppe
leistet, wofür v1 eine zweite Klammer brauchte.** `((7×8)+1)×3` wird zu
`(7×8+1)×3`, weil × innerhalb der Gruppe ohnehin vor + bindet.

---

## 5. Bedienung: Ziehen und Tippen

Ziehen ist die Hauptbedienung, Tippen die Abkürzung.

| Geste | Wirkung |
|---|---|
| Chip in der Ablage **tippen** | wandert in die nächste offene Fläche |
| Chip im Ausdruck **tippen** | wandert zurück in die Ablage |
| Chip **ziehen** | genaue Ablage, Umsortieren, Tauschen, in eine Gruppe hinein |
| Chip **herausziehen** | entfernen (Zahlen kehren in die Ablage zurück) |

Tippen kostet fast keinen zusätzlichen Code – dieselbe Operation mit einem
anderen Auslöser – hält aber Sechsjährige, Tastaturbedienung und Screenreader im
Spiel. Tippen auf einen platzierten Chip ist zugleich die exakte Umkehrung des
Platzierens; damit entfällt der Löschen-Knopf.

Zahlen werden **verbraucht**, Operatoren sind **unbegrenzt wiederverwendbar**.
Weil Zahlen die Ablage sichtbar verlassen, wird aus der Regel „jede Zahl genau
einmal" etwas, das man sieht statt es zu lesen.

### 5.1 Technik: Pointer Events

**Kein HTML5-Drag-and-Drop.** Es feuert auf iOS Safari bei Berührung nicht, und
die App ist Mobile First.

- `pointerdown` / `pointermove` / `pointerup` mit `setPointerCapture`
- ein Geisterelement folgt dem Finger über `transform` – ohne React-Render pro
  Bewegung
- Ablageflächen werden beim Ziehstart einmal vermessen und danach per Rechteck
  getroffen
- Schwelle von 6 px trennt Tippen von Ziehen
- `touch-action: none` und `user-select: none` auf allen Chips

Rund 150 Zeilen in einem Hook. **Keine Bibliothek** – weder dnd-kit noch
react-dnd.

---

## 6. Gültigkeit durch Bauweise

Weil Ablageflächen typisiert sind, **können ungültige Ausdrücke gar nicht erst
entstehen**. Zwei Zahlen nebeneinander sind unmöglich, wenn hinter einer Zahl nur
eine Operator-Fläche liegt. Ein unzulässiger Zug findet keine Fläche, und der
Chip federt zurück.

Damit entfallen alle sechs Fehlermeldungen aus Anforderung 2.4:

| v1-Meldung | v2 |
|---|---|
| Erst einen Operator eingeben | entfällt – keine Fläche vorhanden |
| Erst eine Zahl eingeben | entfällt – keine Fläche vorhanden |
| Klammer hier nicht erlaubt | entfällt – keine Fläche vorhanden |
| Keine offene Klammer vorhanden | entfällt – nicht darstellbar |
| Ungültiger Ausdruck | entfällt – nicht darstellbar |
| Alle Zahlen müssen verwendet werden | entfällt – `=` bleibt gedimmt |

**Übrig bleibt genau ein Signal: richtig oder falsch.** Nichts im Spiel tadelt
den Spieler noch für einen Zwischenschritt.

---

## 7. Auswerten

Ein rekursiver Auswerter ersetzt `Function('return ' + expr)()` aus
`PuzzleValidator` und `HintEngine`.

Pro Gruppe zwei Durchläufe über die Kinderliste: zuerst `×` und `÷`, dann `+` und
`−`. Gruppen werden vorher aufgelöst.

- Division durch Null (nur über eine Gruppe wie `(3−3)` erreichbar) liefert
  `null` → Ausdruck gilt als falsch
- gerechnet wird in Gleitkomma, verglichen mit Epsilon `1e-9`
- Zwischenergebnisse dürfen wie in v1 gebrochen sein; `9 ÷ 2 × 4 = 18` bleibt
  gültig
- das Endergebnis muss `≥ 0` sein

---

## 8. Abschicken und die Notationszeile

### 8.1 Der `=`-Knopf

Ein eigener **`=`-Knopf** in der Steuerspalte, unter dem Zielfeld.

Er ist **gedimmt und inaktiv**, solange nicht alle Zahlen gesetzt sind oder noch
eine Lücke offen ist. Sein Zustand ersetzt damit die Meldung „alle Zahlen
verwenden": „du bist noch nicht fertig" wird gezeigt statt gesagt.

### 8.2 Die Notationszeile

Unter dem Board steht eine ruhige Zeile mit **echter mathematischer Notation**,
die beim Bauen mitwächst:

```
(6 + 2) × (9 − 3)
```

Auf `=` wird das Ergebnis angehängt:

```
(6 + 2) × (9 − 3) = 48
```

Der Block erklärt jüngeren Spielern, was zusammengehört; die Zeile zeigt älteren
die Klammerschreibweise, die sie eigentlich lernen. Beide Gruppen werden bedient,
ohne dass eine davon Kompromisse macht.

**Bei einer falschen Antwort zeigt die Zeile das eigene Ergebnis** neben der
Zielzahl – `… = 69` bei Ziel 48. Der Spieler sieht seine eigene Rechnung und wie
weit daneben sie lag, statt bloß ein rotes Kreuz. Die Chips bleiben liegen und
können korrigiert werden.

Da alle anderen Rückmeldungen aus dem Spiel entfernt wurden (Abschnitt 10), trägt
diese Zeile das gesamte Gespräch zwischen Spiel und Spieler.

---

## 9. Tipps neu gedacht

v1 zerlegt Lösungszeichenketten mit regulären Ausdrücken und ignoriert, was der
Spieler bereits gebaut hat. Mit dem Baum geht mehr.

### 9.1 Grundlage: der Restlöser

Statt Zeichenketten zu vergleichen, beantwortet ein kleiner Löser die Frage:
**„Lässt sich der angefangene Ausdruck mit den übrigen Zahlen noch auf die
Zielzahl bringen?"**

Bei höchstens vier Zahlen ist der Suchraum winzig – das Prüfskript aus Abschnitt
4.1 wertet 1500 Rätsel erschöpfend in unter zwei Sekunden aus. Die Suchlogik
existiert bereits im `PuzzleGenerator` und wird nur herausgezogen. Robuster als
jeder Textvergleich, weil sie auch Lösungen erkennt, die nicht in der Bank
stehen.

### 9.2 Die Leiter

| Stufe | Inhalt | Verfügbar |
|---|---|---|
| **kostenlos** | *Sackgassen-Anzeige*: ist das Ziel nicht mehr erreichbar, färbt sich der Rahmen des Ausdrucks bernstein | alle Level |
| 💡 1 | Zwischenwert: „Kannst du eine 15 bauen?" | alle Level |
| 💡 2 | zwei zusammengehörige Zahlen **pulsieren in der Ablage** | Fortgeschritten, Experte |
| 💡 3 | das Spiel **setzt ein Teil** – meist den Block an die richtige Stelle | Experte |
| 🏳️ Aufgeben | eine Lösung wird als Chips gelegt, dann nächstes Rätsel | nach allen Tipps |

**Tipps sind sichtbar statt lesbar.** Stufe 2 lässt zwei Chips pulsieren, statt
„Schau dir 2 und 5 an" zu schreiben. Die jüngsten Spieler lesen den deutschen
Tipptext nicht zuverlässig – zwei leuchtende Chips schon.

**Die Sackgassen-Anzeige ist kostenlos und dauerhaft.** Still in eine Sackgasse
zu laufen ist die häufigste Frustration; für den Ausweg zu bezahlen wäre der
falsche Druck.

Da es keine Streaks mehr gibt, kosten Tipps ohnehin nichts. Die Leiter dient nur
der Dosierung. Aufgeben verliert jede Konsequenz und damit den
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

**Bewusste Folge:** Ein gelöstes Rätsel hinterlässt nichts Bleibendes. Der Moment
des Lösens ist die einzige Belohnung – die Notationszeile (8.2) und der
Übergang zum nächsten Rätsel tragen sie allein und verdienen entsprechende
Sorgfalt.

---

## 11. Layout

### 11.1 Das Raster

Fünf Spalten. Spalte 5 ist die Steuerspalte, die Spalten 1–4 tragen oben den
Ausdruck und unten die Ablage.

```
┌─────────────────────────────────────┬────────┐
│  Ausdrucksfeld                      │  = 48  │   Zeile 1
├────────┬────────┬────────┬──────────┼────────┤
│   Z4   │   Z3   │   Z2   │    Z1    │  [ ]   │   Zeile 2  Zahlen + Block
├────────┼────────┼────────┼──────────┼────────┤
│   ×    │   ÷    │   +    │    −     │   =    │   Zeile 3  Operatoren + Absenden
└────────┴────────┴────────┴──────────┴────────┘
              (6 + 2) × (9 − 3)                     Notationszeile
```

- Zahlen sind **rechtsbündig**: bei zwei oder drei Zahlen bleiben die linken
  Zellen frei, die Position von Z1 und Z2 ändert sich nie.
- **Die Ablage liegt unten, der Ausdruck oben.** Man zieht nach oben – die
  bequeme Daumenrichtung – und die Hand verdeckt beim Ziehen nicht, was man baut.
- Der `=`-Knopf sitzt am rechten Rand, damit der Ziehkorridor frei bleibt.

### 11.2 Formen

| Element | Form |
|---|---|
| Zahl | Quadrat mit leicht gerundeten Ecken |
| Operator | Kreis |
| Block | **eckige Klammern** `[ ]` – ein Stamm mit Serifen oben und unten |
| Zielzahl, `=` | Quadrat, in der Akzentfarbe gefüllt |

Der Block-Chip in der Ablage ist ein **ganz normaler Chip** – gleiche Füllung,
gleiche Zelle wie jeder andere Knopf – mit einem **Symbol darin** und Luft
ringsum. Das Symbol ist die Miniatur seines Inhalts: **Quadrat, offener Kreis,
Quadrat**. Es ist wahrheitsgemäß, weil auf diesem Board ein Quadrat eine Zahl und
ein Kreis einen Operator bedeutet; der offene statt gefüllte Kreis in der Mitte
verhindert, dass die drei Formen als Gesicht gelesen werden.

### 11.3 Drei Markierungen, nie vermischt

| Markierung | Bedeutung |
|---|---|
| gestricheltes graues Feld in der Ablage | diese Zahl liegt gerade im Ausdruck – und hier kommt sie zurück |
| **nichts** | diese Zelle gehört nicht zu diesem Rätsel (2- oder 3-Zahlen-Level) |
| gestrichelte Fläche in Akzentfarbe | gültiges Ziel, **nur während eines Zuges sichtbar** |

Die ersten beiden dürfen nicht gleich aussehen: sonst lässt sich ein
3-Zahlen-Rätsel nicht von einem 4-Zahlen-Rätsel unterscheiden, bei dem schon eine
Zahl gesetzt ist.

### 11.4 Kontrast des Blocks

Zwei Stufen Trennung, je eine in beide Richtungen: die Gruppe **weicht zurück**
(Akzentfarbe, 17 % Deckung), ihr Inhalt **kommt nach vorn** (Chips darin weiß
statt ablagegrau). Das ist die Konvention, die eine verschachtelte Fläche als
verschachtelt lesbar macht – und nebenbei sieht eine `6` innerhalb eines Blocks
dadurch anders aus als eine `6` daneben.

### 11.5 Größen: eine Zahl, kein Umbruch

Alle Maße sind `calc()` auf einer einzigen Variablen `--cell`. Nichts hat eine
absolute Größe; das Board skaliert aus einer Zahl.

> **Der Ausdruck bricht nie um und scrollt nie.**

Das ist erzwingbar, weil der Inhalt beschränkt ist: der schlimmste Fall sind vier
Zahlen, drei Operatoren und zwei Blöcke. Eine Gruppe mit drei Zahlen ist
schmaler. Die Anteile sind so gewählt, dass dieser Fall passt – gemessen, nicht
geschätzt.

Chips brauchen `flex: none`. Ohne das schrumpfen sie im Flex-Container, und ein
Operatorkreis wird zur Ellipse.

### 11.6 Hoch- und Querformat

**Kein Breakpoint auf die Breite.** Wie bei *flashcards* gibt es genau eine
Umschaltung, und zwar auf das Seitenverhältnis:

```css
@media (min-aspect-ratio: 1 / 1) { /* mehr Raum für --cell */ }
```

Damit sind ein quer gehaltenes Telefon und ein kleines Desktop-Fenster derselbe
Fall – was bei einer Breiten-Abfrage nicht stimmen würde.

Kein Scrollen: `100dvh` (nicht `vh` – die einfahrende Adressleiste ist genau die
Ursache des ungewollten Scrollens), dazu `overflow: hidden` und
`overscroll-behavior: none`.

---

## 12. Design-System

### 12.1 Eine Zahl steuert die Farben

Alle Farbtoken leiten sich aus **einem Farbwinkel** ab. Die Neutralen sind
derselbe Farbton mit sehr geringer Sättigung – deshalb wirken die Grautöne
gewählt statt tot. Das Schema zu wechseln ist eine Zeile.

```css
--hue: 214;
--zk-bg:         hsl(var(--hue) 20% 98.5%);   /* Grundfläche              */
--zk-surface:    hsl(var(--hue) 24% 100%);    /* Ausdrucksfeld            */
--zk-chip:       hsl(var(--hue) 26% 95%);     /* Chip-Füllung             */
--zk-group-bg:   hsl(var(--hue) 48% 42% / .17); /* Block-Füllung          */
--zk-group-chip: hsl(var(--hue) 30% 100%);    /* Chip innerhalb eines Blocks */
--zk-line:       hsl(var(--hue) 22% 85%);     /* Haarlinien, Platzhalter  */
--zk-ink:        hsl(var(--hue) 30% 18%);     /* Ziffern                  */
--zk-muted:      hsl(var(--hue) 14% 58%);     /* Nebentext                */
--zk-accent:     hsl(var(--hue) 62% 42%);     /* Klammern, Ziel, Absenden */
```

### 12.2 Schrift und Symbole

- **`system-ui`, sonst nichts.** Keine Webschrift. Damit ist das Nebeneinander
  verschiedener Schriften aus v1 an der Wurzel erledigt. Courier New entfällt.
- Drei Größen, zwei Schnitte – mehr nicht.
- `font-variant-numeric: tabular-nums` überall dort, wo Ziffern stehen.
- **Keine Emoji.** ⚙️ 💡 ❓ 🔥 🌱 🧠 werden durch **inline-SVG-Strichsymbole**
  ersetzt: ein 24-px-Feld, 1,5 px Strich, Farbe über `currentColor`. Emoji sehen
  auf jedem Gerät anders aus und sind mehrfarbig – beides widerspricht dem
  Entwurf. (Dieselbe Begründung wie im Stylesheet von *flashcards*.)
- Die Krone bleibt als einzige illustrative Marke (`public/crown.svg`).

### 12.3 Bewegung

Ein zurückhaltender Entwurf braucht Bewegung, weil keine Farbcodierung mehr
erklärt, was gerade passiert: Chip hebt beim Greifen ab, Flächen öffnen sich,
der Chip setzt sich federnd. Wege zwischen Ablage und Ausdruck laufen als
FLIP-Animation über die stabile `id`. `prefers-reduced-motion` wird respektiert.

---

## 13. Dateistruktur

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
│   ├── Expression.tsx         Ausdrucksfeld + Flächen
│   ├── Tray.tsx               Ablage
│   ├── Chip.tsx               ein Chip
│   ├── Header.tsx
│   ├── Settings.tsx
│   └── Popover.tsx            Basis für Tipps und Regeln
├── i18n/
└── main.tsx
```

Die Dateizahl bleibt etwa gleich wie in v1 – der Gewinn liegt woanders:

- Die Schichtung **Services → Hooks → Components** verschwindet. Es gibt nur noch
  **`core/` (rein und testbar)** und **`ui/` (React)**.
- Der interessante Teil – Baum, Auswertung, Löser, Tipps – hat **keinen einzigen
  React-Import** und ist im Terminal testbar.
- Ersatzlos gestrichen: `ScoringService`, `PuzzleValidator`, `useProgress`,
  `useHints`, `NumberRow`, `KeyPad`, `InputRow`.
- Netto etwa ein Drittel weniger Code als v1.

**Unverändert übernommen:** die 13 Bank-Dateien und `generatePuzzles.mjs`, die
Level-Definitionen (ergänzt um `maxGroups`), i18n, der GitHub-Actions-Deploy.

---

## 14. Umsetzung in Schritten

| # | Schritt | Ergebnis |
|---|---|---|
| 1 | `core/` schreiben: Baum, Auswertung, Löser | im Terminal prüfbar, ohne UI |
| 2 | Ziehschicht + `Chip`, `Tray`, `Expression` | ein fest verdrahtetes Rätsel ist spielbar |
| 3 | Bank, Level, Einstellungen, `=`-Prüfung, Notationszeile | vollständige Spielschleife |
| 4 | Tipps und Sackgassen-Anzeige | Tippleiter steht |
| 5 | Streaks entfernen, Emoji durch SVG ersetzen, Texte anpassen | v1-Reste sind weg |
| 6 | Animationen, Querformat, PWA | Feinschliff |

Nach Schritt 3 ist die App erstmals durchgehend spielbar; die Schritte 1 und 2
tragen das gesamte Risiko.

---

## 15. Offene Punkte und Risiken

| Punkt | Stand |
|---|---|
| **Kopfzeile** | Noch nicht entschieden. Vorschlag nach dem Vorbild von *flashcards*: ein ruhiges Symbol oben rechts für das Menü, eines für Tipps, sonst nichts. |
| **Zwischenschritt beim Auflösen** | Optional. Die Notationszeile könnte die Klammern erst zu ihren Werten zusammenfallen lassen (`(6+2) × (9−3)` → `8 × 6` → `= 48`), bevor das Ergebnis erscheint. Das ist die einzige Stelle, an der das Spiel *Punkt vor Strich* zeigt. Vorgabe ist derzeit ohne diesen Schritt. |
| **Dunkles Farbschema** | „Nice to have". Die Token-Struktur trägt es; entschieden ist nichts. |
| **Standard-Level ist F2.1** | **Widerspruch aus v1:** ein neuer Spieler landet direkt auf dem ersten Level mit Klammern, ohne A1–A3 gespielt zu haben. Entweder beim ersten Start auf A1 setzen oder sicherstellen, dass das erste F2.1-Rätsel ohne Block lösbar ist. |
| **`puzzles-F2-3.json` enthält nur 35 Rätsel** | Altlast aus v1; Wiederholung setzt schnell ein. Sollte nachgeneriert werden. |
| **Gleiche Zahlen** wie `[6, 6, 9]` | über `source` unterschieden, nicht über den Wert – im Test abdecken. |
| **Gruppe um den ganzen Ausdruck** | erlaubt, verbraucht aber das Kontingent ohne Nutzen. |
| **Ziehen auf iOS Safari** | `touch-action: none` nötig; die App scrollt ohnehin nicht. |
