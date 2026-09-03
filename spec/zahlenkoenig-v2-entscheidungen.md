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
Abschnitt 17 des Konzepts, damit die Wahl erhalten bleibt.

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

## 6. Bank und Generierung (Runde 3)

| Entscheidung | Begründung |
|---|---|
| **Generator und Bank werden ersetzt, nicht übernommen** | Geprüft, nicht angenommen: `scripts/checkBankShapes.mjs` zeigt, dass v1 bei `maxBracketDepth: 1` die Formen `2+2` (zwei nebeneinanderliegende Gruppen) und `3+1` (Dreiergruppe) gar nicht erzeugt – genau die zwei, auf denen v2s Blockbedienung beruht. 5874 Vierer-Rätsel sind so für die F3-Bänke unerreichbar. |
| **Ein Modell für Generator und Löser** | Beide auf `checkDepth1.mjs`. Zwei Modelle nebeneinander sind die Ursache des Befunds oben; v1 hatte eins im Generator und eins im Validator. |
| **`levelId` entfällt aus dem Datensatz** (PO) | Der PO fragte, ob das Feld überhaupt entstehen muss. Es muss nicht: `loadBank` kennt das Level an der Ladestelle. Das Feld zusätzlich mitzuführen, in anderer Schreibweise, *war* der Fehler – ihn zu beheben, indem man die Schreibweise angleicht, ließe die Fehlerklasse bestehen. |
| **`solutions` entfallen** | `solver.ts` rechnet sie neu, kennt als Einziges die Ein-Ebenen-Regel und findet auch Lösungen, die nicht in der Bank stehen. Gespeicherte Zeichenketten wären eine zweite, veraltende Wahrheit – die v1-Lösungen von E1 sind zweistufig und in v2 nicht baubar. |
| **Erschöpfend statt Stichprobe** | Je Zahlenmenge einmal alle erreichbaren Ziele aufzählen ist nicht nur vollständig, sondern schneller als würfeln-und-nachrechnen: alle 495 Vierermengen in rund 5 Sekunden. Die Lösungsanzahl fällt als Schwierigkeitsmaß nebenbei ab. |
| **Bänder statt Zufall** (PO) | Nach `rank` sortieren, drei Bänder, innerhalb mischen. Ein Level steigt an und ist trotzdem in jeder Sitzung ein anderes. Nichts wird gespeichert – die Bänder leben in der Sitzung, `Settings` bleibt bei zwei Feldern. |
| **Standard-Level bleibt F2.1** (PO) | Der Widerspruch aus v1 löst sich als Nebenwirkung der Sortierung: 1407 der 1854 F2.1-Rätsel brauchen keinen Block, Band 1 ist also blockfrei. Keine Sonderregel nötig. |

**Verworfen:** die Schreibweise `F2-1`/`F2.1` angleichen (behandelt das Symptom) ·
`solutions` in der Bank behalten · F2.3 auf 500 Rätsel nachgenerieren (es
existieren nur 60) · der Filter „1 bis 5 Lösungen" (willkürlich; er allein kürzte
F2.3 von 60 auf 37) · Bänke unverändert übernehmen.

**Offen:** was E1 künftig von F3 unterscheidet. v2 schafft die Verschachtelung ab
– das war das einzige Trennmerkmal. Siehe Abschnitt 17 des Konzepts; **PO-Frage**,
keine technische.

---

## 7. Tipps (Runde 3)

Der PO zum v1-System: *„nicht immer hilfreich, manchmal zu direkt. Und manchmal
ging es nur um einen Teil des Ausdrucks. Auch schloss Aufgeben das Rätsel, statt
die Lösung zu zeigen."* Drei Mängel, drei Antworten:

| Entscheidung | Begründung |
|---|---|
| **Alles hängt an der kanonischen Fortsetzung** | Gegen *„nur ein Teil des Ausdrucks"*: v1 las `solutions[0]` aus der Bank und beschrieb deren erste Klammer – ein Fragment ohne Bezug zum Brett. Die kanonische Fortsetzung setzt das Gebaute voraus, kann ihm also nie widersprechen. Sie ist zugleich die Sackgassen-Anzeige: ein Löser, drei Funktionen. |
| **Ein Knopf, ein Schritt pro Druck** | Gegen *„ungleichmäßig, manchmal zu direkt"*: jeder Druck fügt genau eine Portion hinzu, der Spieler bestimmt durch Weiterdrücken, wie weit es geht. Kein Sprung von nichtssagend zu verraten. |
| **Kein Tipptext mehr** | Ein Sechsjähriger und ein Erwachsener bekommen denselben Tipp; der eine muss ihn nicht lesen können. „Sichtbar statt lesbar" stand schon in 2.1 – v1 zog es nur nicht durch. Die `hint.*`-Texte entfallen. |
| **Keine Staffelung nach Level** | `maxHintsPerGroup` entfällt. Damit verschwindet auch der Ort, an dem der `levelId`-Fehler wirkte: die Regel, die ihn möglich machte, gibt es nicht mehr. |
| **Aufgeben ist Weiterdrücken** | Kein zweiter Knopf, kein Bestätigungsdialog, keine Schwelle „erst alle Tipps". |
| **Das gelöste Brett bleibt stehen** (PO) | Gegen *„Aufgeben schloss das Rätsel"*: die Lösung liegt als Chips da, die Notationszeile zeigt `… = Ziel`, Weitergehen ist eine eigene Geste. In v1 bezahlte man mit dem Eingeständnis und bekam die Antwort trotzdem nicht zu sehen. |

**Verworfen:** die dreistufige Leiter nach Level-Gruppe · Tipptexte in beiden
Sprachen · Tipps aus `puzzle.solutions` ableiten · Aufgeben als eigener Knopf mit
Bestätigung · Aufgeben mit automatischem Wechsel zum nächsten Rätsel.

---

## 8. Arbeitsweise

- **Erst besprechen, dann bauen.** Die gesamte Planung lief über Diskussion und
  klickbare Entwürfe, nicht über Code.
- **Entwürfe als Artefakt.** Layoutfragen wurden an gerenderten Boards
  entschieden, nicht in Prosa. Wo zwei Möglichkeiten bestanden, wurden beide
  nebeneinander gezeigt statt eine beschrieben.
- **Behauptungen prüfen.** Die Verschachtelungsfrage wurde nicht abgeschätzt,
  sondern mit einem Skript beantwortet, das selbst gegen bekannte Fälle
  abgesichert ist. Es liegt im Repository und ist wiederholbar.
  In Runde 3 hat sich das ein zweites Mal ausgezahlt: `checkBankShapes.mjs`
  widerlegt zwei Sätze, die in 2.1 als selbstverständlich standen – die Bank sei
  unverändert übernehmbar, und F2.3 sei bloß nachzugenerieren. Beide klangen
  plausibel; beide waren falsch. **Auch die eigenen Dokumente sind zu prüfen,
  nicht nur der Code.**
- **Spezifikationen auf Deutsch**, passend zu den beiden v1-Dokumenten.
- **Branch:** `claude/zahlenkoenig-v2-planning-jcsi4d`, PR #1.
  Runde 3: `claude/v2-docs-missing-requirements-2pybh9`.

---

## 9. Nebenbefunde aus v1

Nicht von v2 verursacht, aber beim Lesen aufgefallen. Alle drei sind in Runde 3
erledigt – zwei davon anders als zunächst gedacht:

| Befund | Stand |
|---|---|
| **Standard-Level ist F2.1** | Ein neuer Spieler landete direkt auf dem ersten Level mit Klammern, ohne A1–A3 gespielt zu haben. **Erledigt ohne Änderung am Standard:** die Bandsortierung stellt blockfreie Rätsel nach vorn (Abschnitt 6). |
| **`puzzles-F2-3.json` enthält nur 35 Rätsel** | **Falsch diagnostiziert.** Es sah nach Nachlässigkeit aus, ist aber die Obergrenze der Aufgabe: für drei Zahlen mit Zielen 101–162 existieren überhaupt nur 60 lösbare Paare. Erschöpfende Generierung hebt 35 auf 60 – mehr gibt es nicht. Wiederholung ließe sich nur über den Zielbereich vermeiden. |
| **`levelId` der Bank (`E1-3`) passt nicht zu `LEVELS` (`E1.3`)** | **Erledigt, indem beide Seiten verschwinden:** das Feld entfällt aus dem Datensatz, und mit `maxHintsPerGroup` entfällt der einzige Ort, an dem der Fehler wirkte. |

Neu in Runde 3 dazugekommen, und gewichtiger als alle drei: **v1s Generator kennt
v2s Gruppenmodell nicht** (Abschnitt 6), und **v2 hebt den Unterschied zwischen
F3 und E1 auf** – die einzige noch offene PO-Frage.
