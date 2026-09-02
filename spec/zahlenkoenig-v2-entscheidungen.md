# Zahlenkönig v2 – Entscheidungen und Verworfenes

**Stand:** September 2026

Das Konzeptdokument (`zahlenkoenig-v2-konzept.md`) beschreibt, **was** gebaut
wird. Dieses hier hält fest, **warum** – und vor allem, **was bereits verworfen
wurde**. Es existiert, damit eine spätere Sitzung nicht erneut Vorschläge macht,
die schon geprüft und abgelehnt sind.

**Lesehinweis:** Einträge mit **PO** hat der Produktverantwortliche selbst
entschieden. Sie sind keine Empfehlungen, sondern Vorgaben – bitte nicht
„verbessern", ohne zu fragen.

---

## 1. Technik

| Entscheidung | Begründung |
|---|---|
| **TypeScript + React** (PO, nach Abwägung) | Das Ausdrucksfeld ordnet Chips um, verschachtelt und entfernt sie – jede Änderung soll animiert werden. Das verlangt *keyed reconciliation*: DOM-Knoten müssen über Zustandswechsel hinweg ihre Identität behalten. In React ist das `key={node.id}`. In Vanilla wären es 40–60 Zeilen handgeschriebener Abgleich an der fehleranfälligsten Stelle der App. |
| **Pointer Events, selbst geschrieben** | HTML5-Drag-and-Drop feuert auf iOS Safari bei Berührung nicht. Die App ist Mobile First. |
| **Keine Drag-Bibliothek** | ~150 Zeilen in einem Hook gegen eine Abhängigkeit mit eigener Modellvorstellung. |
| **`core/` ohne React-Import** | Baum, Auswertung, Löser und Tipps sind reine Funktionen und im Terminal prüfbar. Sie tragen das gesamte Risiko von v2 und sollen ohne UI testbar sein. |

**Verworfen:** Vanilla JS ohne Framework · reines JS statt TypeScript · dnd-kit ·
react-dnd · HTML5-Drag-and-Drop.

Zur Einordnung: Das Schwesterprojekt `funnygerman/flashcards` ist bewusst Vanilla
ohne Build-Schritt. Für dessen eine, sich nicht umordnende Karte ist das richtig;
für ein Feld voll umsortierbarer Chips nicht.

---

## 2. Spielmodell

| Entscheidung | Begründung |
|---|---|
| **Ausdrucksbaum statt Token-Liste** | Ursache aller v1-Grenzen: unbalancierte Klammern, nur Anhängen und Rücklöschen, kein Ort zum Hineinziehen. |
| **Genau zwei Ebenen, keine Verschachtelung** (PO) | Geprüft, nicht angenommen: `scripts/checkDepth1.mjs` zeigt alle 1500 E1-Rätsel als weiterhin lösbar. Punktrechnung in einer flachen Gruppe leistet, wofür v1 eine zweite Klammer brauchte. |
| **Block = mindestens zwei Operanden** | Zwei bis drei Zahlen sind sinnvoll, vier wären der ganze Ausdruck in Klammern. Nicht eigens verboten. |
| **Kein `eval`** | Ein rekursiver Auswerter über den Baum ersetzt `Function('return …')` in Validator und Tipp-Engine. |
| **Typisierte Ablageflächen** | Ungültige Ausdrücke werden unbaubar statt nachträglich getadelt. Alle sechs Echtzeit-Fehlermeldungen aus v1 entfallen. |

**Verworfen:** verschachtelte Blöcke · `(` und `)` als getrennte Zeichen ·
Fehlermeldungen beim Bauen.

---

## 3. Bedienung

| Entscheidung | Begründung |
|---|---|
| **Ziehen und Tippen** (PO) | Reines Ziehen schließt Sechsjährige, Tastatur und Screenreader aus. Tippen ist dieselbe Operation mit anderem Auslöser. |
| **Kein Löschen-Knopf** (PO) | Tippen auf einen platzierten Chip ist die exakte Umkehrung des Platzierens. |
| **Kein Alles-löschen** (PO) | Nach einer falschen Antwort will man fast immer *eine* Sache ändern, nicht neu anfangen. |
| **Block: antippen löst auf** | Wer einen Block entfernt, will andere Klammern, nicht weniger Zahlen. Zwei Gesten statt acht. |
| **Platzhalter in der Ablage sind antippbar** | Der Klammerrand ist schmal, Daumen sind es nicht. Große Zweitfläche für dieselbe Aufgabe – als allgemeine Regel, nicht als Sonderfall für den Block. |
| **Kein Undo** | Keine Geste verliert mehr als einen Chip. Die Anforderung entfällt, statt erfüllt zu werden. |

**Verworfen:** nur Drag-and-Drop · Löschen-/Clear-Knopf · langes Drücken
(Modalität, die es sonst nirgends gibt und die nichts ankündigt) · „Block erst
leeren, dann entfernen" · einen vollen Block aus dem Feld ziehen und den Inhalt
in die Ablage schütten.

---

## 4. Fortschritt und Rückmeldung

| Entscheidung | Begründung |
|---|---|
| **Alle Fortschrittsanzeigen entfernt** (PO) | Der PO wählte diese Option ausdrücklich vor der Empfehlung, einen nicht bestrafenden Zähler zu behalten. Streaks, Punkte, `ScoringService`, `firstAttempt`, Aufgeben-Warnung: alles weg. |
| **`=` statt ✓** (PO) | Gedimmt, bis der Ausdruck vollständig ist – ersetzt die Meldung „alle Zahlen verwenden". |
| **Notationszeile** (PO) | Zeigt echte Klammerschreibweise beim Bauen, hängt auf `=` das Ergebnis an. Bei falscher Antwort das *eigene* Ergebnis neben der Zielzahl – der Spieler sieht seine Rechnung statt eines roten Kreuzes. |
| **Zielzahl bleibt neben dem Feld** (PO) | Der Vorschlag, sie als größtes Element nach oben zu setzen, wurde abgelehnt. |

**Verworfen:** Streaks in jeder Form · Punkteanzeige · ✓ als Absende-Symbol ·
automatisches Prüfen ohne Knopf · Zielzahl als größtes Element oben.

**Offen:** der Zwischenschritt in der Notationszeile (Klammern fallen erst zu
ihren Werten zusammen). Vorgabe ist *aus*; die Begründung dafür steht in
Abschnitt 16 des Konzepts, damit die Wahl erhalten bleibt.

---

## 5. Gestaltung

| Entscheidung | Begründung |
|---|---|
| **Eckige Klammern** (PO, nach direktem Vergleich) | Die Serifen schließen die Form oben und unten, sie liest sich als Behälter statt als Umarmung, und sie ist schmaler – wichtig, weil die Breite knapp ist. |
| **Block-Symbol `□ ○ □`** (PO, Variante D von vier) | Ein Quadrat ist eine Zahl, ein Kreis ein Operator – das Symbol beschreibt also wahrheitsgemäß, was ein Block enthält. Der *offene* Kreis in der Mitte verhindert, dass die drei Formen als Gesicht gelesen werden. |
| **Block-Knopf ist ein normaler Chip mit Symbol darin** (PO) | Zwischenstand, bei dem der Klammerrand zugleich der Knopfrand war, las sich als gefüllter Block statt als Bedienelement. |
| **Zahlen quadratisch, Operatoren rund** (PO) | Aber *keine* starke Formkodierung: Ziffern und Operatorzeichen unterscheiden sich schon durch ihre Glyphen. Das Unterscheidungsbudget gehört ganz dem Block, dem einzigen Element ohne eigene Glyphe. |
| **Zwei Stufen Kontrast am Block** | Behälter tritt zurück, Inhalt tritt vor – die Konvention, die verschachtelte Flächen lesbar macht. |
| **Eine Zahl steuert die Farben** (PO) | Alle Token aus `--hue`; Neutrale derselbe Farbton mit sehr geringer Sättigung. Schema wechseln = eine Zeile. |
| **`system-ui`, keine Webschrift** | Erledigt das Nebeneinander mehrerer Schriften aus v1 an der Wurzel. |
| **Inline-SVG statt Emoji** | Emoji sehen auf jedem Gerät anders aus und sind mehrfarbig. Dieselbe Begründung steht bereits im Stylesheet von *flashcards*. |
| **Nur eine Umschaltung: `min-aspect-ratio: 1/1`** | Ein quer gehaltenes Telefon und ein kleines Desktop-Fenster sind derselbe Fall; eine Breiten-Abfrage behauptet das Gegenteil. |
| **Ausdruck bricht nie um und scrollt nie** | Der Inhalt ist beschränkt (vier Zahlen, drei Operatoren, zwei Blöcke), also wird auf den schlimmsten Fall dimensioniert – gemessen, nicht geschätzt. |
| **Zwei verschiedene Leer-Markierungen** | Gestrichelt = diese Zahl liegt im Feld. Gar nichts = diese Zelle gehört nicht zu diesem Rätsel. Sähen sie gleich aus, wäre ein 3-Zahlen-Rätsel nicht von einem angefangenen 4-Zahlen-Rätsel zu unterscheiden. |

**Verworfen:** Courier New · Webschriften · Emoji als Symbole · Breakpoints nach
Breite · runde Klammern · drei Quadrate oder drei Kreise als Block-Symbol · das
v1-Farbkonzept mit vier Farbfamilien (blau für Zahlen, gold für Operatoren, …) ·
starke Formkodierung von Zahlen gegen Operatoren.

---

## 6. Arbeitsweise

- **Erst besprechen, dann bauen.** Die gesamte Planung lief über Diskussion und
  klickbare Entwürfe, nicht über Code.
- **Entwürfe als Artefakt.** Layoutfragen wurden an gerenderten Boards
  entschieden, nicht in Prosa. Wo zwei Möglichkeiten bestanden, wurden beide
  nebeneinander gezeigt statt eine beschrieben.
- **Behauptungen prüfen.** Die Verschachtelungsfrage wurde nicht abgeschätzt,
  sondern mit einem Skript beantwortet, das selbst gegen bekannte Fälle
  abgesichert ist. Es liegt im Repository und ist wiederholbar.
- **Spezifikationen auf Deutsch**, passend zu den beiden v1-Dokumenten.
- **Branch:** `claude/zahlenkoenig-v2-planning-jcsi4d`, PR #1.

---

## 7. Nebenbefunde aus v1

Nicht von v2 verursacht, aber beim Lesen aufgefallen:

| Befund | Warum es zählt |
|---|---|
| **Standard-Level ist F2.1** | Ein neuer Spieler landet direkt auf dem ersten Level mit Klammern, ohne A1–A3 gespielt zu haben. Der Standard widerspricht dem Aufbau, den die Level abbilden. |
| **`puzzles-F2-3.json` enthält nur 35 Rätsel** | Wiederholung setzt schnell ein. |
