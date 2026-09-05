# Zahlenkönig / Number King – v2 Konzept

**Version:** 2.4
**Stand:** September 2026
**Status:** Abgestimmt – bereit zur Umsetzung

Dieses Dokument beschreibt die Neukonzeption von Eingabe und Gestaltung für v2.
Es ersetzt die Abschnitte 2.4–2.6 sowie Kapitel 4 der Anforderungen v1.5.
Die Sprachumschaltung bleibt unverändert.

**Neu in 2.4:** Die Bank entfällt zugunsten Generierung im Gerät (Abschnitt
15.10), PWA-Anforderungen sind konkretisiert (Abschnitt 19), der
Produktions-Build bekommt ein Größenbudget statt einer zweiten Fassung
(Abschnitt 20).

**Neu in 2.2:** Tipps sind neu gedacht (Abschnitt 10), Bank und Generator werden
ersetzt statt übernommen (Abschnitt 15).

**Neu in 2.3 – die größte Änderung seit 2.0:** **Es gibt keine Level mehr.**
An ihre Stelle tritt eine Auswahl aus drei Angaben – wie viele Zahlen, welche
Rechenzeichen, wie groß das Ziel (Abschnitt 15). Damit erledigt sich die in 2.2
offene Frage, was E1 von F3 unterscheidet: **E1 entfällt ersatzlos**, wie A1 bis
F3 auch. Ein klickbarer Entwurf liegt vor und war die Grundlage dieser
Entscheidungen.

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
- **Keine Verschachtelung.** Eine Gruppe enthält nie eine weitere Gruppe.
  Stattdessen dürfen **mehrere Blöcke nebeneinander** stehen.
- **In der Ablage gibt es genau einen Block-Chip**, dauerhaft und wiederholt
  antippbar wie ein Operator – kein Platzhalter pro Kontingent-Einheit, der
  beim Setzen verschwindet. Wie viele Blöcke im Ausdruck gleichzeitig stehen
  dürfen, folgt weiterhin aus der Zahl der Operanden statt aus einem Level:
  **⌊n/2⌋** – bei zwei oder drei Zahlen einer, bei vier zwei. Mehr wären nicht
  unterzubringen, denn ein Block braucht mindestens zwei Operanden. Ist das
  Kontingent ausgeschöpft, **deaktiviert sich der Chip**, statt zu
  verschwinden – dieselbe Regel wie beim `=`-Knopf vor einem unvollständigen
  Ausdruck. (Revision nach Rückmeldung zum ersten spielbaren Brett: ursprünglich
  ein Platzhalter pro Kontingent-Einheit, siehe Entscheidungen Abschnitt 3.)
- Ein gesetzter Block wird **nie zerlegt**: Antippen oder Herausziehen entfernt
  nur die Klammern, der Inhalt bleibt stehen. Abschnitt 6 beschreibt das
  vollständig.

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

## 6. Der Block: setzen, bewegen, auflösen

Der Block ist das einzige Element, das ein *Behälter* statt eines Zeichens ist.
Dieser Abschnitt beschreibt ihn vollständig.

### 6.1 Wohin ein Block gesetzt werden darf

Während ein Block in der Luft ist, sind vier Arten von Zielen aktiv:

| Ziel | Ergebnis |
|---|---|
| **leere Operandenfläche** | ein leerer Block landet dort |
| **Zahl**, rechts daneben Operator + Nicht-Block-Operand | umschließt diese drei |
| **Zahl**, rechts nichts Brauchbares, links Operator + Nicht-Block-Operand | umschließt diese drei |
| **Operator**, beide Nachbarn belegt und keiner davon ein Block | umschließt das Paar |

Findet sich weder rechts noch links ein vollständiges Paar, umschließt der Block
**die Zahl allein**. Das ist zulässig – der Block ist dann unvollständig, `=`
bleibt ohnehin gedimmt, und der Spieler kann Operator und Zahl anschließend
hineinziehen.

Nichts innerhalb eines Blocks ist je ein Ziel. Genau das hält die
Verschachtelung draußen.

**Rechts vor links**, weil eine angetippte Zahl sich wie „hier beginnt die
Klammer" liest – in Leserichtung.

#### Die nützliche Überschneidung

Zahl und Operator ergeben oft dasselbe. In `6 + 2 × 9`:

| angetippt | Ergebnis |
|---|---|
| `6` | `(6 + 2) × 9` |
| `+` | `(6 + 2) × 9` |
| `2` | `6 + (2 × 9)` |
| `×` | `6 + (2 × 9)` |
| `9` | `6 + (2 × 9)` – kein Paar rechts, fällt nach links |

**Die Umschließung einer Zahl ist stets identisch mit der des Operators rechts
daneben.** Die Zahl ist damit keine zweite Regel, sondern eine *große
Trefferfläche* für dasselbe Ziel. Operatoren müssen beim Ziehen deshalb nicht
vergrößert werden – der Bereich ist bereits groß.

#### Die Vorschau trägt das Ganze

Solange der Block über einem Ziel schwebt, wird **genau die Umschließung, die
entstehen würde, blass als Klammer gezeichnet**. Ohne diese Vorschau wäre die
Rechts-vor-links-Regel Raterei; mit ihr sieht man das Ergebnis vor dem Loslassen.

### 6.2 Umschließen erzeugt immer zwei, nie drei

Die Geste erzeugt höchstens ein Paar. Ein Block mit drei Zahlen entsteht, indem
man zusätzlich Operator und Zahl **hineinzieht** – dieselbe Mechanik wie überall
sonst. Damit braucht `(7×8+1)×3` keine Sonderregel.

### 6.3 Ein Block zeigt immer sein Minimum

Ein leer gesetzter Block wird als `⬚ ○ ⬚` gezeichnet – Operandenfläche,
Operatorfläche, Operandenfläche –, nicht bloß als eine offene Fläche.

Zwei Gründe: er sieht genauso aus wie das Symbol auf dem Knopf, der ihn erzeugt
hat, nur größer; und „ein Block braucht mindestens zwei" ist die einzige Regel
über Blöcke, die man kennen muss – sie zu zeigen kostet nichts. Eine
Allein-Umschließung erscheint entsprechend als `6 ○ ⬚`. Sobald zwei Operanden
darin stehen, verhält sich der Block wie alles andere und zeigt nur noch eine
nachlaufende Fläche.

### 6.4 Das Gerüst im Ausdrucksfeld

Dieselbe Idee für das ganze Feld. Sie funktioniert, weil **die Anzahl der Chips
unveränderlich ist**: bei *n* Zahlen werden immer genau *n* Zahlen und *n − 1*
Operatoren gesetzt, gleich wie die Blöcke fallen. `(6+2)×(9−3)` und `6+2×9−3`
verbrauchen beide vier Zahlen und drei Operatoren.

Ein Gerüst ist damit in der **Anzahl** immer richtig, auch wenn es die Anordnung
nicht kennen kann:

```
Operanden-Platzhalter = Zahlen, die noch in der Ablage liegen
Operator-Platzhalter  = (n − 1) − bereits gesetzte Operatoren
```

Die Platzhalter stehen hinter dem Inhalt und werden weniger, während man füllt.
Und daraus folgt: **wenn keine Platzhalter mehr da sind, ist der Ausdruck
strukturell vollständig** – exakt die Bedingung, die `=` aktiviert. Das Feld
zeigt, was noch fehlt, und der Knopf, dass nichts mehr fehlt: dieselbe Tatsache,
zweimal sichtbar.

Drei Folgen:

- **A1 erklärt sich selbst.** Ein leeres Feld zeigt `⬚ ○ ⬚` – setze eine Zahl,
  einen Operator, eine Zahl. Für Erstklässler die ganze Anleitung, ohne Worte.
  In den A-Levels gibt es keine Blöcke, dort ist das Gerüst nie auch nur
  ungefähr falsch.
- **Ein 3-Zahlen-Rätsel ist ab dem ersten Bild als solches erkennbar.**
- **Das Feld springt nicht mehr.** Der Inhalt hat von Anfang an ungefähr seine
  Endbreite, Chips landen an ihrem Platz statt alles zur Seite zu schieben.

Platzhalter werden in **voller Chipbreite** gezeichnet, aber sehr blass:
Layoutstabilität wiegt schwerer als der erste Eindruck. Sie sind **keine
eigenen Ablageziele** – die gültigen Ziele bleiben die aus 6.1.

### 6.5 Ein Block wird getippt, nicht zerlegt

```
[ 6 + 2 ] × 9        auf den Klammerrand tippen        6 + 2 × 9
```

Die Klammern verschwinden. Die 6, das `+` und die 2 bleiben, in derselben
Reihenfolge, an derselben Stelle. Das Kontingent hat wieder einen Block frei –
war der Chip in der Ablage deaktiviert, wird er wieder aktiv. **Es fällt
nichts heraus.**

Denn wer einen Block entfernt, will fast immer *andere* Klammern, nicht weniger
Zahlen. `(6+2)×9` → `6+(2×9)` kostet so zwei Gesten: tippen, dann den Block auf
die `2` ziehen. Über „erst leeren" wären es acht, und jede Zahl müsste ohne Grund
in die Ablage und zurück.

| Geste | Wirkung |
|---|---|
| Rand tippen | Klammern gehen heim, Inhalt bleibt |
| auf einen anderen Operanden ziehen | die beiden tauschen, Inhalt reist mit |
| aus dem Feld ziehen und loslassen | Klammern gehen heim, Inhalt bleibt |

Drei Einträge, zwei mit demselben Ergebnis – das ist der Punkt: **alle
scheinbar zerstörerischen Gesten laufen auf die harmlose hinaus.**

**Bewegen ist keine neue Regel.** Ein Block ist ein Operand, und für einen
Operanden auf einer belegten Operandenfläche gilt bereits: tauschen.
`(6+2) − 9` wird durch Ziehen auf die `9` zu `9 − (6+2)` – ein anderer Ausdruck,
also eine sinnvolle Geste. Ob der Block zwei oder drei Zahlen enthält, ändert
nur die Anzahl der Ziele (drei Operanden bieten zwei, zwei Operanden bieten
eines), nicht die Regel.

### 6.6 Treffflächen

Der sichtbare Rand ist dünn, und Daumen sind es nicht. Deshalb ist die
Trefffläche größer als der sichtbare Steg: die beiden Klammerstege sowie das
Band über und unter den Chips. Jeder Steg bekommt eine unsichtbare Trefffläche
von etwa 22 px Breite über die volle Blockhöhe, nach außen in den Feldabstand
und nach innen über die Polsterung, ohne je einen Chip zu überlappen. Ein hoher
schmaler Streifen ist deutlich leichter zu treffen als ein kleines Quadrat.

**Ein gestrichelter Platzhalter in der Ablage ist antippbar und holt zurück,
was ihn verlassen hat** (Abschnitt 5) – aber das gilt nur für Zahlen. Der Block
hat in der Ablage keinen Platzhalter mehr, der für ein bestimmtes gesetztes
Vorkommen steht: der Chip dort ist einzeln und dauerhaft, wie ein Operator
(Abschnitt 4, Revision), und tippt immer *neu*. Auflösen eines gesetzten
Blocks bleibt deshalb allein Sache des Randes – der einzige Grund, warum
dessen Trefffläche oben eigens vergrößert wird.

### 6.7 Die Animation trägt die Bedeutung

Beim Auflösen **verlassen die Klammern sichtbar das Feld**: die Stege blenden ab
und die getönte Fläche fällt über rund 150 ms in den Feldhintergrund zurück,
während die Chips exakt stehen bleiben – nicht einmal ein Ruck. Geschähe es
schlagartig, läse ein Spieler die Änderung als Löschung. Das Ausblenden sagt:
nur die Klammern sind gegangen, die Zahlen sind alle noch da.

### 6.8 Warum kein Rückgängig nötig ist

**Keine Geste verliert mehr als einen Chip.** Die einzige, die es gekonnt hätte –
einen vollen Block aus dem Feld ziehen –, löst stattdessen auf. Alles Übrige
kostet höchstens eine Platzierung und wird durch Zurücklegen rückgängig gemacht.
Damit entfällt die Anforderung an eine Undo-Funktion, statt sie zu erfüllen.

### 6.9 Im Modell

```ts
wrap(root, index, span)      // span = 3 für ein Paar, 1 für eine Zahl allein
  const group = { id, kind: 'group', children: root.children.slice(index, index + span) }
  root.children.splice(index, span, group)

dissolve(root, index)
  const g = root.children[index]
  root.children.splice(index, 1, ...g.children)
```

Beide erhalten die Invariante: 3-gegen-1 und 1-gegen-1 lassen die Parität der
Folgepositionen unverändert, und eine Gruppe beginnt und endet stets mit einem
Operanden. `A × (6+2) − B` wird zu `A × 6 + 2 − B` – immer noch abwechselnd.

Damit bilden die Baum-Operationen **drei Umkehrpaare** und eine selbstinverse:

| | Umkehrung |
|---|---|
| Operand einfügen | Operand entfernen |
| Operatorfläche füllen | Operator leeren |
| **umschließen** | **auflösen** |
| tauschen | tauschen |

Geste und Datenstruktur haben dieselbe Form – ein gutes Zeichen dafür, dass die
Umsetzung nicht gegen das Modell arbeiten wird.

---

## 7. Gültigkeit durch Bauweise

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

## 8. Auswerten

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

## 9. Abschicken und die Notationszeile

### 9.1 Der `=`-Knopf

Ein eigener **`=`-Knopf** in der Steuerspalte, unter dem Zielfeld.

Er ist **gedimmt und inaktiv**, solange nicht alle Zahlen gesetzt sind oder noch
eine Lücke offen ist. Sein Zustand ersetzt damit die Meldung „alle Zahlen
verwenden": „du bist noch nicht fertig" wird gezeigt statt gesagt.

**Nach einer falschen Antwort bleibt der Knopf aktiv.** Derselbe Ausdruck darf
erneut abgeschickt werden. Der Knopf kennt genau eine Frage – „ist der Ausdruck
vollständig?" –, und die Antwort ändert sich durch eine falsche Lösung nicht.
Ihn zusätzlich auf das Ergebnis reagieren zu lassen wäre eine zweite Regel für
dasselbe Bedienelement; die Notationszeile trägt die Rückmeldung ohnehin schon
und wird beim Bauen laufend aktualisiert.

### 9.2 Die Notationszeile

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

Da alle anderen Rückmeldungen aus dem Spiel entfernt wurden (Abschnitt 11), trägt
diese Zeile das gesamte Gespräch zwischen Spiel und Spieler.

---

## 10. Tipps neu gedacht

Am v1-Tippsystem wurden drei Dinge bemängelt: es war **ungleichmäßig stark**
(mal nichtssagend, mal sofort verraten), es sprach **nur über einen Teil des
Ausdrucks**, und **Aufgeben schloss das Rätsel, statt die Lösung zu zeigen**.

Die ersten beiden teilen eine Ursache: v1 tippte über gespeicherte
Lösungszeichenketten statt über das Brett, das vor dem Spieler liegt. Der dritte
ist davon unabhängig und braucht eine eigene Antwort (10.4).

### 10.1 Grundlage: der Restlöser

Statt Zeichenketten zu vergleichen, beantwortet ein kleiner Löser die Frage:
**„Lässt sich der angefangene Ausdruck mit den übrigen Zahlen noch auf die
Zielzahl bringen?"**

Bei höchstens vier Zahlen ist der Suchraum winzig – das Prüfskript aus Abschnitt
4.1 wertet 1500 Rätsel erschöpfend in unter zwei Sekunden aus. **`scripts/checkDepth1.mjs`
ist die Vorlage für `solver.ts`**, nicht `PuzzleGenerator.findSolutions`: Letzteres
arbeitet über Zeichenketten und `Function()`, das Prüfskript rechnet bereits über
Operandenlisten und kennt die Ein-Ebenen-Regel. Robuster als jeder Textvergleich,
weil es auch Lösungen erkennt, die nicht in der Bank stehen.

### 10.2 Die kanonische Fortsetzung

Jeder Tipp – und die Sackgassen-Anzeige – liest **dasselbe** Ergebnis dieses
Lösers:

> Unter allen Ausdrücken mit höchstens einer Klammerebene, die die **restlichen
> Zahlen aus der Ablage** verwenden und **den bereits gebauten Baum
> fortsetzen**, ist die kanonische Fortsetzung die kleinste bezüglich einer
> festen Ordnung: erst nach Anzahl der Blöcke, dann nach Dokumentreihenfolge.
> Sie wird nach jedem Zug neu berechnet und pro Brettzustand zwischengespeichert.

Zwei Eigenschaften folgen daraus, und beide sind Antworten auf die Kritik:

- **Ein Tipp betrifft nie nur einen Ausschnitt.** v1 las `solutions[0]` aus der
  Bank und beschrieb deren erste Klammer – ein Fragment, das mit dem, was auf
  dem Brett lag, nichts zu tun haben musste. Die kanonische Fortsetzung
  widerspricht dem Gesetzten nie, weil sie es voraussetzt.
- **Derselbe Tipp bleibt derselbe.** Solange sich das Brett nicht ändert, ändert
  sich der Tipp nicht – auch bei Rätseln mit vielen Lösungen.

Gibt es keine Fortsetzung, ist das Ziel nicht mehr erreichbar: **das** ist die
Sackgassen-Anzeige. Ein Löser, drei Funktionen.

### 10.3 Ein Knopf, gleichmäßige Schritte

Es gibt **keine nach Level gestaffelte Tippleiter mehr**. Ein Tippknopf, auf
jedem Level dasselbe Verhalten:

| Druck | Wirkung |
|---|---|
| **kostenlos, dauerhaft** | *Sackgassen-Anzeige*: existiert keine Fortsetzung, färbt sich der Rahmen des Ausdrucks bernstein |
| 1. Druck | die zwei zusammengehörigen Zahlen **pulsieren in der Ablage** |
| jeder weitere | das Spiel **setzt einen weiteren Chip** – einen pro Druck |

Welche zwei Zahlen pulsieren, war bisher offen. Jetzt ist es festgelegt: die
beiden Operanden des **ersten Blocks der kanonischen Fortsetzung**, der noch
vollständig in der Ablage liegt; hat sie keinen Block, die ersten beiden
benachbarten Operanden.

Drei Eigenschaften, jede gegen einen der drei Mängel:

- **Gleichmäßig.** Jeder Druck fügt genau eine Portion Hilfe hinzu. Es gibt
  keinen Sprung mehr von „nichtssagend" zu „verraten"; wie weit es geht,
  entscheidet der Spieler durch Weiterdrücken.
- **Kein Tipptext.** Damit entfallen die `hint.*`-Texte aus der i18n. Ein
  Sechsjähriger und ein Erwachsener bekommen denselben Tipp – der eine muss ihn
  nicht lesen können. Das war schon die Absicht hinter „sichtbar statt lesbar",
  nur zog v1 sie nicht durch.
- **Gleich auf allen Leveln.** `maxHintsPerGroup` entfällt ersatzlos. Damit
  verschwindet auch der v1-Fehler, dass Experten-Level über die Level-Gruppe nur
  zwei statt drei Tipps bekamen – die Regel, die ihn möglich machte, gibt es
  nicht mehr.

### 10.4 Aufgeben ist kein eigener Knopf mehr

Wer weiterdrückt, bekommt Chip für Chip die vollständige Lösung gelegt. **Das
ist das Aufgeben** – kein zweiter Knopf, kein Bestätigungsdialog, keine Schwelle
„erst alle Tipps".

Entscheidend ist, was danach passiert: **das gelöste Brett bleibt stehen.** Die
Notationszeile zeigt den vollständigen Ausdruck mit `= Zielzahl`, die Chips
liegen an ihrem Platz, und der Spieler kann sich das ansehen, solange er will.
Weiterzugehen ist eine eigene, bewusste Geste. In v1 schloss Aufgeben das Rätsel
sofort – man bezahlte mit dem Eingeständnis und bekam die Antwort trotzdem nicht
zu sehen.

Da es keine Streaks mehr gibt, kostet all das ohnehin nichts.

---

## 11. Fortschrittsanzeigen entfallen

Streaks, Punkte und Serien werden **vollständig entfernt**.

Gelöscht wird:

- `ScoringService` komplett
- `pointStreak`, `unlockStreaks`, `recordResult`
- `firstAttempt`-Verfolgung in `useGame` und `PuzzleValidator`
- 🔥 im Header
- ●●○ auf den Level-Karten der Einstellungen
- Aufgeben-Warnung „⚠️ Beide Streaks werden zurückgesetzt!"
- i18n-Abschnitte `streak.*`, `game.streak_bonus`
- die i18n-Abschnitte `hint.*` – Tipps haben keinen Text mehr (10.3)
- `maxHintsPerGroup` und die Tippstaffelung nach Level-Gruppe (10.3)

`StoredProgress` verliert alles, was Leistung festhält. Was bleibt, sind
**Einstellungen** – keine davon ist ein Ergebnis:

```ts
interface Settings {
  language:   'de' | 'en'
  numbers:    2 | 3 | 4          // wie viele Zahlen
  ops:        Operator[]         // welche Rechenzeichen, mindestens eines
  band:       0 | 1 | 2          // wie groß das Ziel (Abschnitt 15.5)
  uniqueOnly: boolean            // nur Rätsel mit genau einer Lösung
}
```

Fünf Felder statt zwei, und das ist kein Rückschritt: Abschnitt 11 strich, was
**Fortschritt** aufzeichnet. Eine Schwierigkeits*einstellung* ist kein
Schwierigkeits*protokoll*. `currentLevelId` entfällt mit den Leveln selbst.

Das Level-Freischalten verschwindet mit `unlockStreaks` – ohne Verlust: schon in
v1 zeigte die Serie den Fortschritt nur an und **sperrte nichts** (Anforderungen
1.5, Abschnitt 2.3).

**Bewusste Folge:** Ein gelöstes Rätsel hinterlässt nichts Bleibendes. Der Moment
des Lösens ist die einzige Belohnung – die Notationszeile (9.2) und der
Übergang zum nächsten Rätsel tragen sie allein und verdienen entsprechende
Sorgfalt.

---

## 12. Layout

### 12.1 Das Raster

Fünf Spalten. Spalte 5 ist die Steuerspalte, die Spalten 1–4 tragen oben den
Ausdruck und unten die Ablage.

```
┌────────┬────────┬────────┬──────────┬────────┐
│  Ausdrucksfeld (Spalten 1–4)        │   48   │   Zeile 1
├────────┼────────┼────────┼──────────┼────────┤
│   Z4   │   Z3   │   Z2   │    Z1    │  [ ]   │   Zeile 2  Zahlen + Block
├────────┼────────┼────────┼──────────┼────────┤
│   ×    │   ÷    │   +    │    −     │   =    │   Zeile 3  Operatoren + Absenden
└────────┴────────┴────────┴──────────┴────────┘
              (6 + 2) × (9 − 3)                     Notationszeile
```

**Alle drei Zeilen sind gleich hoch, und zwar genau eine Chiphöhe.** Die Zielzahl
ist **derselbe Chip wie eine Zahl** – gleiches Quadrat, gleiche Rundung, nur in
der Akzentfarbe gefüllt –, und das Ausdrucksfeld ist genauso hoch wie sie. Am
Entwurf gemessen: Ausdrucksfeld 48 px, Zielzahl 48 px, Zahlenchip 48 px.

Ein doppelt hohes Ausdrucksfeld war ein Zwischenstand und ist verworfen: es
verschenkt die Höhe, die `--cell` braucht (12.5), und es lässt die Zielzahl als
Balken statt als Chip erscheinen. Ein v1-Fehler lautete wörtlich „the target
button does not have same height as number buttons" – derselbe Fehler soll nicht
über die Hintertür zurückkommen.

- Zahlen sind **rechtsbündig**: bei zwei oder drei Zahlen bleiben die linken
  Zellen frei, die Position von Z1 und Z2 ändert sich nie.
- **Die Zielzahl passt sich in der Schriftgröße an**, nicht in der Breite: ab
  drei Ziffern eine Stufe kleiner. Der Chip behält seine Kantenlänge, damit das
  Raster steht.
- **Die Ablage liegt unten, der Ausdruck oben.** Man zieht nach oben – die
  bequeme Daumenrichtung – und die Hand verdeckt beim Ziehen nicht, was man baut.
- Der `=`-Knopf sitzt am rechten Rand, damit der Ziehkorridor frei bleibt.

### 12.2 Formen

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

### 12.3 Drei Markierungen, nie vermischt

| Markierung | Bedeutung |
|---|---|
| gestricheltes graues Feld in der Ablage | dieses Element liegt gerade im Ausdruck – **antippen holt es zurück** (Abschnitt 6.6) |
| **nichts** | diese Zelle gehört nicht zu diesem Rätsel (2- oder 3-Zahlen-Level) |
| gestrichelte Fläche in Akzentfarbe | gültiges Ziel, **nur während eines Zuges sichtbar** |

Die ersten beiden dürfen nicht gleich aussehen: sonst lässt sich ein
3-Zahlen-Rätsel nicht von einem 4-Zahlen-Rätsel unterscheiden, bei dem schon eine
Zahl gesetzt ist.

Der Block-Chip trägt keine dieser drei: er ist einzeln und dauerhaft (Abschnitt
4, Revision) und kennt stattdessen nur **aktiv** und **deaktiviert** – dieselbe
Unterscheidung wie beim `=`-Knopf. Wie sich „deaktiviert" von den drei
Markierungen hier abhebt, ist noch offen (visuelle Feinarbeit, kein
Verhaltensthema).

### 12.4 Kontrast des Blocks

Zwei Stufen Trennung, je eine in beide Richtungen: die Gruppe **weicht zurück**
(Akzentfarbe, 17 % Deckung), ihr Inhalt **kommt nach vorn** (Chips darin weiß
statt ablagegrau). Das ist die Konvention, die eine verschachtelte Fläche als
verschachtelt lesbar macht – und nebenbei sieht eine `6` innerhalb eines Blocks
dadurch anders aus als eine `6` daneben.

### 12.5 Größen: eine Zahl, kein Umbruch

Alle Maße sind `calc()` auf einer einzigen Variablen `--cell`. Nichts hat eine
absolute Größe; das Board skaliert aus einer Zahl.

> **Der Ausdruck bricht nie um und scrollt nie.**

Der Inhalt ist beschränkt: der schlimmste Fall sind vier Zahlen, drei Operatoren
und zwei Blöcke, also `(6+2) × (9−3)`. Eine Gruppe mit drei Zahlen ist schmaler.

**Er passt – aber nur mit diesen Anteilen.** `spec/entwurf.html` misst es bei
jedem Rendern selbst und zeigt das Ergebnis an; bei `--cell: 64px` braucht der
Inhalt **268,7 px**, das Feld bietet **275,8 px**.

Die Reserve ist damit **rund 7 px**, bei einem Feld von 276. Das ist kein Zufall,
sondern die Folge davon, dass die Ausdruckszeile im schlimmsten Fall *sieben*
Chips und *zwei* Klammerrahmen in der Breite von vier Zellen tragen muss. Drei
Anteile sind deshalb **tragend und nicht frei wählbar**:

| Anteil | Wert | warum er tragend ist |
|---|---|---|
| Zahl im Ausdruck | `0,52 × --cell` | kleiner als ein Ablage-Chip; das ist der Preis für den schlimmsten Fall |
| Operator im Ausdruck | `0,39 × --cell` | deutlich kleiner als eine Zahl, und nur umrandet statt gefüllt |
| Klammerrand | `position: absolute` | er liegt **über** der Polsterung und kostet **keine Breite** |

**Warnung an spätere Sitzungen.** Werden die Chips im Ausdruck auf Ablagegröße
gebracht oder die Klammerränder als eigene Flex-Kinder gezeichnet, wächst der
schlimmste Fall sofort um 50 bis 80 px und läuft über. Genau das ist in einem
Entwurf passiert und wurde fälschlich als Fehler des Konzepts gedeutet. Wer die
Anteile ändert, misst neu – der Entwurf im Repository rechnet die Reserve selbst
aus und zeigt sie an.

Chips brauchen `flex: none`. Ohne das schrumpfen sie im Flex-Container, und ein
Operatorkreis wird zur Ellipse.

**Die Formel.** `--cell` folgt aus dem Raster aus 12.1 – fünf Spalten breit, drei
Zeilen hoch, dazu Kopfzeile und Notationszeile. Mit `gap = 0,14 × cell` und
`padding = 0,25 × cell`:

```
Breite:  5 cell + 4 gap + 2 padding  ≈ 6,06 cell   ≤ 100vw
Höhe:    Kopfzeile 1,2 + Ausdruck 2 + zwei Ablagezeilen 2
         + Notationszeile 1 + 4 gap + 2 padding    ≈ 7,26 cell   ≤ 100dvh
```

```css
--cell: min(16vw, 13dvh, 88px);
@media (min-aspect-ratio: 1 / 1) { --cell: min(16vw, 15dvh, 104px); }
```

Im Hochformat bindet der Höhenterm, im Querformat der Breitenterm – deshalb die
eine Umschaltung aus 12.6 und kein Breakpoint.

> Die beiden Konstanten – der Deckel (88 px / 104 px) und der dvh-Faktor – sind
> **am Gerät zu bestätigen**, am schlimmsten Fall aus vier Zahlen, drei
> Operatoren und zwei Blöcken. Die Formel gibt den Ausgangspunkt; gemessen wird
> trotzdem.

### 12.6 Hoch- und Querformat

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

### 12.7 Die Kopfzeile

Nach dem Vorbild von *flashcards*, und mehr nicht:

```
┌──────────────────────────────────────────────┐
│  ☰                  F2.1                  ?  │
└──────────────────────────────────────────────┘
```

| Platz | Inhalt |
|---|---|
| links | ein Symbol: Menü (Sprache, Regeln) |
| Mitte | **der Auswahl-Chip** – zugleich Anzeige und Bedienelement (15.6) |
| rechts | ein Symbol: Tipp (Abschnitt 10.3) |

Die Mitte trägt **kein Kürzel wie `F2.1` mehr**. Sie trägt eine Miniatur der
Ablage, die die aktuelle Auswahl erzeugt: so viele kleine Quadrate wie Zahlen, so
viele Kreise wie Rechenzeichen, dahinter der Zielbereich. Wer sie antippt, öffnet
die Auswahl (15.6) – **das anzeigende Element ist das ändernde**.

Der Titel „Zahlenkönig" entfällt – wer die App offen hat, weiß, welche es ist,
und die Zeile ist die knappste Fläche im Layout. Die Krone bleibt dem App-Symbol
vorbehalten. Kein 🔥, keine Punkte (Abschnitt 11); die Symbole sind Inline-SVG,
nicht Emoji (13.2).

Der Auswahl-Chip steht in der Mitte, weil er das Einzige ist, was sich ändert,
und weil damit beide Symbole am Rand liegen, wo der Daumen sie erreicht, ohne
über das Ausdrucksfeld zu wandern.

### 12.8 Der Rhythmus zwischen zwei Rätseln

| Ereignis | Was passiert |
|---|---|
| richtige Antwort | die Notationszeile zeigt `… = Ziel`, nach **1200 ms** kommt das nächste Rätsel |
| falsche Antwort | nichts wechselt; die Chips bleiben liegen, `=` bleibt aktiv (9.1) |
| aufgegeben | **kein automatischer Wechsel** – das gelöste Brett bleibt stehen (10.4) |

1200 ms ist der Wert aus v1; er hat sich bewährt und wird nicht ohne Anlass
geändert. Er gilt ausschließlich nach einer richtigen Antwort: dort ist der
Wechsel eine Belohnung. Nach dem Aufgeben wäre derselbe Wechsel das Gegenteil –
er nähme dem Spieler die Lösung weg, die er gerade erst bekommen hat.

---

## 13. Design-System

### 13.1 Eine Zahl steuert die Farben

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

### 13.2 Schrift und Symbole

- **`system-ui`, sonst nichts.** Keine Webschrift. Damit ist das Nebeneinander
  verschiedener Schriften aus v1 an der Wurzel erledigt. Courier New entfällt.
- Drei Größen, zwei Schnitte – mehr nicht.
- `font-variant-numeric: tabular-nums` überall dort, wo Ziffern stehen.
- **Keine Emoji.** ⚙️ 💡 ❓ 🔥 🌱 🧠 werden durch **inline-SVG-Strichsymbole**
  ersetzt: ein 24-px-Feld, 1,5 px Strich, Farbe über `currentColor`. Emoji sehen
  auf jedem Gerät anders aus und sind mehrfarbig – beides widerspricht dem
  Entwurf. (Dieselbe Begründung wie im Stylesheet von *flashcards*.)
- Die Krone bleibt als einzige illustrative Marke (`public/crown.svg`).

### 13.3 Bewegung

Ein zurückhaltender Entwurf braucht Bewegung, weil keine Farbcodierung mehr
erklärt, was gerade passiert: Chip hebt beim Greifen ab, Flächen öffnen sich,
der Chip setzt sich federnd. Wege zwischen Ablage und Ausdruck laufen als
FLIP-Animation über die stabile `id`. `prefers-reduced-motion` wird respektiert.

---

## 14. Dateistruktur

```
src/
├── core/                      rein, ohne React-Import
│   ├── expression.ts          Baum + die vier Operationen + Flächen
│   ├── evaluate.ts            Baum → Zahl (Präzedenz, kein eval)
│   ├── solver.ts              „ist das Ziel noch erreichbar?" + kanonische Fortsetzung
│   ├── hints.ts               Tippschritte über die kanonische Fortsetzung
│   ├── puzzles.ts             Generierung + 45-Zeilen-Tabelle, ziehen (15.10)
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

**Unverändert übernommen:** i18n und der GitHub-Actions-Deploy. Bank und
Generator **nicht** – siehe Abschnitt 15. `models/Level.ts` und `LEVELS`
entfallen ersatzlos (15.4).

---

## 15. Auswahl statt Level: Bank und Generierung

Die Bank galt lange als unveränderter Bestand. Sie ist es nicht: der v1-Generator
kennt v2s Gruppenmodell nicht.

### 15.1 Der Befund

v1 zählt **Klammern**, v2 zählt **Verschachtelung**. Das ist nicht dieselbe
Regel. Bei `maxBracketDepth: 1` zählt `generatePuzzles.mjs` eine feste Liste von
Formen auf – und es fehlen genau die, auf denen v2 aufbaut.
`scripts/checkBankShapes.mjs` rechnet es aus:

```
  4 Zahlen
    v1 bei maxBracketDepth 1 : 1+1+1+1  2+1+1  1+2+1  1+1+2
    v2 (eine Ebene, ohne Verschachtelung): 1+1+1+1  1+1+2  1+2+1  1+3  2+1+1  2+2  3+1  4
    v1 fehlen                : 1+3  2+2  3+1  4

4-Zahlen-Rätsel, die v2 lösen kann und v1 bei Tiefe 1 nicht ausdrücken kann: 5874
  1,1,1,2 → 6    (braucht Gruppengrößen 2+2)
  1,1,1,3 → 9    (braucht Gruppengrößen 3+1)
```

Es fehlen also **zwei nebeneinanderliegende Gruppen** (`(1+1)×(1+2)`) und die
**Dreiergruppe** (`(1+1+1)×3`) – ausgerechnet die beiden Formen, die Abschnitt 4
und 6.2 zum Kern der Bedienung machen. v1 verbucht `2+2` als *zwei* Klammern und
liefert es deshalb nur an E1 aus; die Dreiergruppe erzeugt es überhaupt nie.

**Folge:** die F3-Bänke wurden nach einer engeren Regel erzeugt, als der Spieler
in v2 bauen darf, und die gespeicherten `solutions` sind für v2 unbrauchbar – die
von E1 sind zweistufig und gar nicht baubar.

### 15.2 Der Datensatz schrumpft

```ts
interface Puzzle {
  numbers: number[]
  target: number
  rank: number      // Schwierigkeitsrang innerhalb des Levels
}
```

- **`levelId` entfällt.** `loadBank` bildet ohnehin schon `F2.1` auf
  `puzzles-F2-1.json` ab – das Level ist an der Ladestelle bekannt. Dass jeder
  Datensatz es zusätzlich mitführte, *in anderer Schreibweise*, war die Ursache
  des Tippfehlers aus v1 (`E1-3` gegen `E1.3`). Das Feld zu streichen beseitigt
  die ganze Fehlerklasse, nicht einen Fall davon.
- **`solutions` entfällt.** `solver.ts` rechnet sie neu und ist das Einzige, was
  die Ein-Ebenen-Regel kennt. Tipps (Abschnitt 10) und Aufgeben lesen ohnehin den
  Löser; gespeicherte Zeichenketten wären eine zweite, veraltende Wahrheit.

### 15.3 Der Generator

`scripts/generatePuzzles.mjs` wird auf das Modell aus `scripts/checkDepth1.mjs`
umgeschrieben – Kompositionen, Permutationen, Operatorbelegungen –, das v2s Regel
bereits korrekt umsetzt. Abschnitt 10.1 nennt dasselbe Skript als Vorlage für
`solver.ts`: **Generator und Löser teilen ein Modell**, sonst entsteht der
Befund aus 15.1 erneut.

Statt zu würfeln und dann nachzurechnen, zählt der Generator **je Zahlenmenge
einmal** alle erreichbaren Ziele auf und sortiert sie nach Ergebnis ein. Das
macht ihn erschöpfend statt stichprobenhaft, und die Lösungsanzahl fällt als
Nebenprodukt ab. Gemessen: alle 495 Vierermengen in **rund 5 Sekunden**.

Der Filter „1 bis 5 Lösungen" entfällt – er war willkürlich und hat F2.3 von 60
auf 37 gekürzt.

### 15.4 Level entfallen – es gibt nur noch eine Auswahl

Die 13 Level kodierten drei unabhängige Angaben in ein Kürzel, das man erst
entschlüsseln musste. Zwei davon sind echte Angaben, die dritte war ein Notbehelf:

| v1-Bestandteil | in v2 |
|---|---|
| Anzahl der Zahlen (2/3/4) | **bleibt, als Auswahl** |
| Rechenzeichen (`+−` gegen alle vier) | **bleibt, als Auswahl – jetzt einzeln** |
| Unterlevel `.1/.2/.3` (Zielbereich) | wird zum **Band** (15.5) |
| `maxBracketDepth` 1 gegen 2 | **entfällt** – v2 kennt keine Verschachtelung |

Die letzte Zeile ist der Grund, warum **E1 ersatzlos entfällt**. `maxBracketDepth`
war das einzige Merkmal, das E1 von F3 trennte; ohne Verschachtelung sind beide
bei gleichem Zielbereich dieselbe Rätselmenge. Geprüft wurden auch die Auswege:

- **„E1 verlangt zwei Blöcke"** trägt nicht. Nur **911 von 29 648**
  Vierer-Rätseln (3 %) brauchen zwingend zwei Blöcke, sie häufen sich auf
  entarteten Mengen wie `1,1,1,7`, und beide Blöcke sind praktisch nur in einer
  einzigen Form tragend: `(a ± b) ×/÷ (c ± d)`. Das ist eine Schablone, keine
  Fähigkeit.
- **„E1 verlangt eindeutige Lösungen"** trägt auch nicht – siehe 15.7.

Übrig bleiben **drei Angaben**, die der Spieler direkt setzt und die alle drei
auf dem Brett sichtbar sind:

1. **wie viele Zahlen** – 2, 3 oder 4
2. **welche Rechenzeichen** – `+ − × ÷` einzeln, mindestens eines
3. **wie groß das Ziel** – klein, mittel, groß (15.5)

Kein Kürzel mehr, das man lernen muss. Und der jüngste Spieler gewinnt dabei:
„nur `+`, zwei Zahlen" ist ein sanfterer Anfang, als A1 ihn je bot.

### 15.5 Der Zielbereich wird abgeleitet, nicht festgesetzt

Ein fester Bereich wie `100–324` ist mit mancher Auswahl **leer**: zwei Zahlen
mit nur `+` und `−` kommen nie über 18. Erschöpfend ausgezählt sind von den
180 Kombinationen aus 3 Zahlenanzahlen × 15 Rechenzeichenmengen × 4 festen
Bereichen **38 leer** und 23 weitere dünner als 40 Rätsel – ein Drittel unbrauchbar.

**Deshalb ist der Zielbereich relativ.** Für jede Auswahl werden die erreichbaren
Ziele in **drei gleich große Bänder** geteilt – *klein · mittel · groß*. Die
Chips zeigen die tatsächlichen Zahlen darunter:

| Auswahl | klein | mittel | groß |
|---|---|---|---|
| 2 Zahlen, `+` | 2–8 | 8–12 | 12–18 |
| 4 Zahlen, `+ −` | 1–6 | 6–13 | 13–36 |
| 4 Zahlen, alle vier | 1–26 | 26–73 | 73–980 |

Nachgezählt: über alle 45 Auswahlen × 3 Bänder ist **kein einziges Band leer**;
das dünnste hält 7 Rätsel. Eine leere Auswahl ist damit nicht mehr *wählbar*,
statt bloß hinterher gemeldet zu werden.

**Obergrenze 999.** Erreichbar wären 6561 (9⁴), aber vier Ziffern sprengen den
Zielchip – drei passen mit einer Schriftstufe kleiner (12.1). Der Deckel kostet
148 von 31 527 Vierer-Rätseln.

**Die Stufe entfällt.** Ein zweiter Regler „Stufe" neben dem Zielband hieße zwei
Knöpfe für dasselbe Versprechen, und der Spieler wüsste nicht, welchen er drehen
soll. Das Band gewinnt, weil es etwas ändert, das man **sieht** (größere Zahlen);
die Suchschwierigkeit bleibt als **innere Reihenfolge** erhalten: innerhalb einer
Auswahl kommen die leichteren Rätsel zuerst. Das ist Mechanik, kein Bedienelement.

### 15.6 Die Auswahl als Bedienelement

Sie hängt unter dem Auswahl-Chip der Kopfzeile (12.7) und legt sich über das
Ausdrucksfeld – kein eigener Bildschirm, keine Navigation:

| Zeile | Inhalt |
|---|---|
| 1 | drei Chips: `▪▪` `▪▪▪` `▪▪▪▪` |
| 2 | vier Chips: `+` `−` `×` `÷`, einzeln an- und abwählbar |
| 3 | drei Chips: klein · mittel · groß, mit den echten Zahlen darunter |
| Fuß | Schalter „nur Rätsel mit **einer** Lösung" |

Drei Regeln halten sie ehrlich:

- **Sie bleibt offen.** Eine Änderung schließt sie nicht; wer drei Dinge ändern
  will, tippt dreimal. Geschlossen wird durch Tippen daneben oder `Esc`.
- **Das letzte Rechenzeichen lässt sich nicht abwählen** – aber es wird **nicht
  ausgegraut**. Es bleibt sichtbar gewählt, der Druck läuft ins Leere, und die
  Berührung sagt, warum. Ein ausgegrauter Knopf sähe aus, als wäre er unbenutzbar;
  er ist bloß der letzte.
- **Der Eindeutigkeits-Schalter schaltet sich ab**, wenn es für die Auswahl keine
  eindeutigen Rätsel gibt (15.7), mit sichtbarer Begründung.

Jedes Element ist eine Form, kein Text – dieselbe Sprache wie das Brett darunter.
Ein Sechsjähriger nimmt das `÷` weg und **sieht**, wie die Ablage schrumpft.

### 15.7 Eindeutigkeit ist eine Einstellung

Ob ein Rätsel eine oder mehrere Lösungen hat, ist Geschmackssache und deshalb ein
Schalter. Zwei Bänke: eine mit genau einer Lösung, eine mit mehreren; ist der
Schalter aus, wird aus beiden gezogen.

Als **gleich** gelten Lösungen, die sich nur durch Vertauschen unterscheiden:
`5+6` und `6+5` sind dieselbe Lösung, `4×2×3×1` und `(1+2+3)×4` sind zwei. Der
Vergleich läuft über eine kanonische Form (sortierte Summen und Produkte), nicht
über Zeichenketten. So gezählt sind eindeutig:

| Zahlen | Rätsel gesamt | davon eindeutig |
|---|---|---|
| 2 | 138 | 127 (92 %) |
| 3 | 2 205 | 1 740 (79 %) |
| 4 | 29 648 | 15 350 (52 %) |

**Warum zwei Bänke genügen.** Rechenzeichen wegzunehmen kann Lösungen nur
*entfernen*, nie hinzufügen. Ein Rätsel mit genau einer Lösung über alle vier
Zeichen hat also unter jeder Teilmenge eine oder keine – nie zwei. Die
Eindeutigkeits-Bank bleibt damit unter jeder Auswahl gültig; man filtert nur noch
die unlösbar gewordenen über den Operator-Vektor heraus.

Der Preis ist Vollständigkeit, nicht Richtigkeit: Rätsel, die *erst durch*
Einschränkung eindeutig werden, liegen in der anderen Bank und werden nicht
angeboten. Das ist verschmerzbar – **17 169** Vierer-Rätsel bleiben. Leer wird es
nur in Ecken wie „3 Zahlen, nur `÷`" (0 eindeutige), und dort schaltet sich der
Schalter ab.

**Nicht zu verwechseln mit den Tipps.** Mehrere Lösungen erschweren das Tippen
nicht: die kanonische Fortsetzung (10.2) wählt deterministisch. Eindeutigkeit ist
Geschmack, keine technische Notwendigkeit.

### 15.8 Superseded – Bank entfällt (siehe 15.10)

Dieser Abschnitt beschrieb ursprünglich, was eine Bank-Datei speichern muss.
Runde 5 ersetzt die Bank durch Generierung im Gerät (15.10); die
Puzzle-Struktur unten ist nur noch als Zwischenergebnis der Generierung
gültig, nicht mehr als Dateiformat.

```ts
interface Puzzle {
  numbers: number[]
  target:  number
  ops:     number   // 15 Bit: unter welchen Rechenzeichen-Auswahlen lösbar
  rank:    number   // Suchschwierigkeit innerhalb des Bandes
}
```

```ts
interface Puzzle {
  numbers: number[]
  target:  number
  ops:     number   // 15 Bit: unter welchen Rechenzeichen-Auswahlen lösbar
  rank:    number   // Suchschwierigkeit innerhalb des Bandes
}
```

`ops` ist der einzige Zusatz gegenüber 15.2 und der Grund, warum die Auswahl
**nicht rechnen muss**: das Bit zu einer Auswahl sagt, ob dieses Rätsel unter
genau diesen Rechenzeichen lösbar ist. Über den ganzen Vierer-Raum gibt es nur
**61 verschiedene** solcher Vektoren – als Index in eine 61er-Tabelle ist das ein
Byte je Rätsel.

Dazu eine **Nachschlagetabelle mit 45 Zeilen**, je eine pro (Zahlenanzahl,
Rechenzeichenmenge), erzeugt beim Bauen der Bank:

```ts
{ n: 31379, u: 17021, b: [[1,26,10460],[26,73,10460],[73,980,10459]] }
//  Rätsel   eindeutig  die drei Bänder als [von, bis, Anzahl]
```

**2,7 KB für alle 45 Zeilen.** Sie trägt die Bandgrenzen (15.5) und die
Verfügbarkeit des Eindeutigkeits-Schalters (15.7) – beides ohne Löser auf dem
Gerät. Damit gilt allgemein: **jede Einstellung wird gegen die anderen an einer
kleinen, vorberechneten Tabelle geprüft**, sodass sich nichts wählen lässt, was
nichts ergibt.

### 15.9 Absicherung

Neu erzeugte Bänke werden nicht auf Zuruf übernommen. `checkBankShapes.mjs` muss
zeigen:

- jedes Rätsel jeder neuen Bank ist unter der v2-Regel lösbar,
- kein Rätsel der alten Bank, das noch im Zielbereich liegt, ist verloren
  gegangen,
- die Anzahl je Level entspricht der erschöpfenden Zählung.

Zusätzlich für die Auswahl (15.4–15.8):

- **kein Band ist leer** – über alle 45 Auswahlen × 3 Bänder,
- die 45-Zeilen-Tabelle stimmt mit der erzeugten Bank überein,
- der Operator-Vektor stimmt: unter jeder der 15 Rechenzeichenmengen ist genau
  die Teilmenge lösbar, die das Bit behauptet.

`checkDepth1.mjs` muss weiterhin `unsolvable with depth<=1: 0` melden. Die alten
Bänke bleiben in der Git-Historie; `solutions` wieder mitzuschreiben wäre ein
Schalter im Generator, keine Rückabwicklung.

Dieser Abschnitt (15.9) beschreibt die Absicherung einer *gebauten* Bank und
ist damit ebenfalls historisch – 15.10 ersetzt das Bauen durch Generieren zur
Laufzeit, die Absicherung verschiebt sich entsprechend auf den Generator
selbst (siehe dort).

### 15.10 Runde 5: die Bank entfällt zugunsten Generierung im Gerät

**PO-Entscheidung, widerruft Runde 4** (Entscheidungen, Abschnitt 6: „Bank
bleibt, mit Filterspalten"). Zwei Gründe waren ausschlaggebend:

- Eine PWA muss nicht alle Rätsel einer Auswahl auf Vorrat laden, wenn zu
  jedem Zeitpunkt nur eines gebraucht wird.
- Ein einzelnes Rätsel zu erzeugen ist **schnell genug für den Spielzug**:
  `checkDepth1.mjs` prüft eine Zahlenmenge (bis zu 4! Permutationen ×
  Kompositionen × 4^(n−1) Operatorbelegungen) in deutlich unter 10 ms; die
  „5 Sekunden für alle 495 Vierermengen" aus 15.3 sind die Summe über *alle*
  Mengen, nicht die Kosten eines einzelnen Rätsels.

**Was bleibt:** die 45-Zeilen-Tabelle aus 15.8 (Bandgrenzen, Anzahl,
verfügbare Eindeutigkeit) – sie wird weiterhin einmalig vorab berechnet und
als Konstante ausgeliefert, denn sie beantwortet Fragen über den *gesamten*
Suchraum einer Auswahl (wie viele Rätsel gibt es, ist Eindeutigkeit
verfügbar), die ein einzelner Zug nicht beantworten kann. Ebenso bleibt der
15-Bit-Operator-Vektor als Idee erhalten, nur wird er nicht mehr gespeichert,
sondern bei Bedarf berechnet.

**Was entfällt:** jede Puzzle-JSON-Datei. `core/puzzles.ts` lädt nichts mehr,
es rechnet.

**Der Ablauf pro Rätsel** (`nextPuzzle(settings)` in `core/puzzles.ts`,
dasselbe Modell wie `checkDepth1.mjs` und `solver.ts` – Abschnitt 15.3 gilt
unverändert: **ein Modell für Generator und Löser**):

1. `numbers.length` Zufallszahlen 1–9 ziehen (mit Wiederholung).
2. Mit dem Löser **alle** unter `settings.ops` erreichbaren Ziele dieser
   Zahlenmenge aufzählen (ist ohnehin `solver.ts`s Grundoperation).
3. Gegen das Band aus der 45-Zeilen-Tabelle filtern; bei `uniqueOnly` zugleich
   auf genau eine kanonische Lösung filtern (15.7 gilt unverändert).
4. Bleibt nichts übrig, **zurück zu Schritt 1** – nicht jede Zahlenmenge
   deckt jedes Band ab, auch wenn kein Band über den ganzen Suchraum leer ist
   (15.5). Ein Zähler begrenzt die Versuche.
5. Sonst eine der verbliebenen Zielzahlen ziehen (gewichtet nach `rank`, wie
   die Bänder es in 15.6 taten) → `{ numbers, target }`.

**Verifiziert, nicht geschätzt** (Vorlage: `checkBankShapes.mjs`):
`scripts/checkNextPuzzle.mjs` zieht für jede der 45 Auswahlen 1500 Runden
dieses Ablaufs (3 Bänder × mit/ohne `uniqueOnly`, je bis zu 200 Versuche) und
protokolliert die Verteilung. Ergebnis:

- **Fast überall einstellig, meist Versuch 1.** Ohne `uniqueOnly` liegt der
  Median bei 1–3 Versuchen, das Maximum über alle 45×3 Bänder bei niedrigen
  zweistelligen Werten. Ein synchroner Aufruf im Hauptthread ist dafür
  unbedenklich.
- **Drei Auswahlen brechen mit `uniqueOnly` ein:** 3 Zahlen nur `÷`, 4 Zahlen
  nur `−`, 4 Zahlen nur `÷`. Dort ist die Eindeutigkeits-Bank zwar nicht leer
  (25–65 eindeutige Ziele bei 177–2222 erreichbaren insgesamt), aber dünn
  genug, dass blindes Neuziehen bis zu 200 Versuche braucht und in einem
  spürbaren Teil der Läufe **gar nicht** trifft (bis zu 74 % Fehlerquote bei
  „4 Zahlen, nur ÷, Band klein"). Genau der Fall, den 15.10 vorausgesehen
  hatte. Bei „3 Zahlen, nur ÷" bleibt die Fehlerquote niedrig (2–3 %, Median
  36 Versuche) – ein höheres Versuchslimit genügt dort, eine Liste lohnt sich
  nicht. Die beiden 4-Zahlen-Auswahlen brechen deutlich häufiger (bis 74 %)
  und bekommen die Ausnahmeliste unten.
- **Ein Nebenbefund beim Bau des Skripts:** die „Gruppe um den ganzen
  Ausdruck" (Abschnitt 17) duplizierte anfangs jede Lösung um eine
  bedeutungslose Klammer-Variante und drückte die gemessene Eindeutigkeit auf
  0 bei allen 2-Zahlen-Auswahlen. Sie hat nie einen äußeren Operator, gegen
  den die Klammer schützen müsste, ist also wertgleich zur flachen Variante
  und wurde aus der Eindeutigkeits-Zählung ausgeschlossen – ändert nichts an
  den erreichbaren Werten, nur an der Zählung distinkter Lösungen.

Diese Prüfung war eine Voraussetzung vor Schritt 2b (Abschnitt 18) und ist
jetzt erledigt.

### 15.11 Die beiden Ausnahmelisten

Für „4 Zahlen, nur `−`" und „4 Zahlen, nur `÷`" ist die vollständige
`uniqueOnly`-Lösungsmenge selbst schon klein genug, um sie **erschöpfend**
statt kuratiert auszuliefern – kein Ziehen mehr nötig, `nextPuzzle()` wählt
bei diesen zwei Auswahlen mit `uniqueOnly` direkt aus der Liste. Erzeugt
durch denselben Löser wie 15.10 und reproduzierbar über
`node scripts/dumpUniqueExceptions.mjs`. Randziele wie `5` bei „nur `−`"
tauchen in zwei Nachbarbändern auf; das ist dieselbe Einschluss-Konvention
wie beim 45-Zeilen-Beispiel in 15.8 (`26` als „bis" von Band 1 und „von" von
Band 2), keine doppelte Zählung im Datensatz.

**4 Zahlen, nur `−` (65 eindeutige Ziele):**

```ts
const exceptions_4_minus = {
  klein: [ // [1,5]
    [[1,1,1,1],2], [[1,2,2,2],5], [[2,2,2,2],4], [[2,2,2,3],3], [[2,2,2,5],1],
    [[3,3,3,4],5], [[3,3,3,5],4], [[3,3,3,7],2], [[3,3,3,8],1], [[4,4,4,7],5],
    [[4,4,4,9],3],
  ],
  mittel: [ // [5,10]
    [[1,2,2,2],5], [[1,3,3,3],8], [[2,3,3,3],7], [[2,4,4,4],10], [[3,3,3,3],6],
    [[3,3,3,4],5], [[3,4,4,4],9], [[4,4,4,4],8], [[4,4,4,5],7], [[4,4,4,6],6],
    [[4,4,4,7],5], [[5,5,5,5],10], [[5,5,5,6],9], [[5,5,5,7],8], [[5,5,5,8],7],
    [[5,5,5,9],6], [[6,6,6,8],10], [[6,6,6,9],9],
  ],
  groß: [ // [11,26]
    [[1,4,4,4],11], [[1,5,5,5],14], [[1,6,6,6],17], [[1,7,7,7],20], [[1,8,8,8],23],
    [[1,9,9,9],26], [[2,5,5,5],13], [[2,6,6,6],16], [[2,7,7,7],19], [[2,8,8,8],22],
    [[2,9,9,9],25], [[3,5,5,5],12], [[3,6,6,6],15], [[3,7,7,7],18], [[3,8,8,8],21],
    [[3,9,9,9],24], [[4,5,5,5],11], [[4,6,6,6],14], [[4,7,7,7],17], [[4,8,8,8],20],
    [[4,9,9,9],23], [[5,6,6,6],13], [[5,7,7,7],16], [[5,8,8,8],19], [[5,9,9,9],22],
    [[6,6,6,6],12], [[6,6,6,7],11], [[6,7,7,7],15], [[6,8,8,8],18], [[6,9,9,9],21],
    [[7,7,7,7],14], [[7,7,7,8],13], [[7,7,7,9],12], [[7,8,8,8],17], [[7,9,9,9],20],
    [[8,8,8,8],16], [[8,8,8,9],15], [[8,9,9,9],19], [[9,9,9,9],18],
  ],
}
```

Auffällig: jede Zahlenmenge hat die Form `[a,b,b,b]` – drei gleiche Zahlen und
eine andere (der Sonderfall `a=b`, also `[b,b,b,b]`, eingeschlossen). Folgt
aus der Rechnung selbst: `b−(a−b−b) = 3b−a`, und das ist über alle 65
Einträge die einzige Form, die bei reinem `−` je eine eindeutige Lösung
ergibt. Nichts davon ist kuratiert, es ist die vollständige Menge – mehr
eindeutige Ziele gibt es für diese Auswahl nicht.

**4 Zahlen, nur `÷` (26 eindeutige Ziele):**

```ts
const exceptions_4_divide = {
  klein: [ // [1,12]
    [[1,2,2,2],8], [[2,2,2,2],4], [[3,3,3,3],9], [[4,4,4,8],8],
  ],
  mittel: [ // [12,42]
    [[1,3,3,3],27], [[2,4,4,4],32], [[4,4,4,4],16], [[5,5,5,5],25],
    [[6,6,6,6],36], [[6,6,6,8],27], [[6,6,6,9],24],
  ],
  groß: [ // [42,729]
    [[1,4,4,4],64], [[1,5,5,5],125], [[1,6,6,6],216], [[1,7,7,7],343],
    [[1,8,8,8],512], [[1,9,9,9],729], [[2,6,6,6],108], [[2,8,8,8],256],
    [[3,6,6,6],72], [[3,9,9,9],243], [[4,6,6,6],54], [[4,8,8,8],128],
    [[7,7,7,7],49], [[8,8,8,8],64], [[9,9,9,9],81],
  ],
}
```

Dieselbe Beobachtung spiegelbildlich: jede Zahlenmenge hat wieder die Form
`[a,b,b,b]`, weil `b÷(a÷b÷b) = b³÷a` dieselbe Rolle für `÷` spielt wie
`3b−a` für `−` – die einzige Anordnung, die unter einem einzelnen,
nicht-kommutativen Rechenzeichen eine eindeutige Lösung erzwingt, ist die,
die drei der vier Zahlen zu einer Klammer bündelt und die vierte davor
stellt.

Für „3 Zahlen, nur ÷" (25 eindeutige Ziele, Fehlerquote 2–3 % bei 200
Versuchen) lohnt sich keine Liste – aber **150 war eine falsche erste
Schätzung, nicht gemessen**: 150 liegt *unter* 200 und wäre damit schlechter,
nicht besser. Nachgemessen (20 000 Läufe je Deckel, `core/puzzles.ts` selbst,
nicht nur die Modellkopie im Skript):

| Deckel | Fehlerquote (von 20 000 Läufen) |
|---|---|
| 200 | 303 (1,52 %) |
| 300 | 49 (0,25 %) |
| 500 | 1 (0,005 %) |

`core/puzzles.ts` verwendet **500**, nicht 300 – bei 300 lag die Fehlerquote
nachweisbar über null. 500 ist empirisch klein, nicht bewiesen null; ein
Rest-Risiko bleibt (die Verteilung hat einen langen Schwanz: 1 von 20 000
schlug selbst bei 500 fehl), aber um den Faktor 300 kleiner als beim
ursprünglich angenommenen Wert von 300. Der Fehler kam daher, dass diese
Sitzung den Deckel im Code aufschrieb, ohne ihn nachzumessen –
`checkNextPuzzle.mjs` hatte bei seinem eigenen Deckel von 200 die Fehlerquote
bereits korrekt gezeigt (48 von 1500 bei Band *klein*), das wurde beim
Übertragen in den echten Code nur nicht zu Ende gedacht.

**Folge für die PWA:** Der Service Worker muss nur den App-Shell (JS, CSS,
Manifest, Icons) cachen, kein Datensatz. Offline-Spielbarkeit ist damit ein
Abfallprodukt, nicht ein eigenes Cachingproblem – `core/` hat ohnehin keine
Netzwerkabhängigkeit.

**Folge für Abschnitt 14 (Dateistruktur):** `puzzles.ts` „Bank + 45-Zeilen-
Tabelle, Bänder, ziehen" wird zu „Generierung + 45-Zeilen-Tabelle, ziehen" –
kein Laden mehr, nur Rechnen.

**Verworfen:** Bank als JSON-Datei · Vorabladen aller Rätsel einer Auswahl ·
Deckel „1500 Rätsel je Zahlenanzahl" (Abschnitt 18) – gegenstandslos, es gibt
nichts mehr zu deckeln.

---

## 16. Umsetzung in Schritten

| # | Schritt | Ergebnis |
|---|---|---|
| 0 | vitest einrichten | `npm test` läuft |
| 1 | `core/` schreiben: Baum, Auswertung, Löser | im Terminal prüfbar, ohne UI |
| 2 | Ziehschicht + `Chip`, `Tray`, `Expression`, Blockgesten (Abschnitt 6) | ein fest verdrahtetes Rätsel ist spielbar |
| 2b | Generator umschreiben zu `nextPuzzle()` (Abschnitt 15.10), 45-Zeilen-Tabelle berechnen, Versuchsverteilung verifizieren | Rätsel werden im Gerät erzeugt, kein Bank-JSON |
| 3 | Generierung, Auswahl (Abschnitt 15), Einstellungen, `=`-Prüfung, Notationszeile | vollständige Spielschleife |
| 4 | Tipps und Sackgassen-Anzeige | ein Tippknopf steht |
| 5 | Streaks entfernen, Emoji durch SVG ersetzen, Texte anpassen | v1-Reste sind weg |
| 6 | Animationen, Querformat, PWA (Abschnitt 19) | Feinschliff |

Nach Schritt 3 ist die App erstmals durchgehend spielbar; die Schritte 1 und 2
tragen das gesamte Risiko. **Abschnitt 18 nennt, was vor dem jeweiligen Schritt
noch fehlt.**

Schritt 2b steht bewusst *hinter* Schritt 1: der Generator teilt sein Modell mit
`solver.ts` (Abschnitt 15.3), und das entsteht in Schritt 1. Er steht *vor*
Schritt 3, weil dort die Bank angebunden wird. Bis dahin genügt für Schritt 2 ein
fest verdrahtetes Rätsel, das ohnehin vorgesehen ist.

---

## 17. Offene Punkte und Risiken

| Punkt | Stand |
|---|---|
| **Die Reserve der Ausdruckszeile** | Der schlimmste Fall passt mit rund 7 px Reserve (12.5) – knapp gegenüber den 50 bis 80 px, die eine Änderung der Anteile sofort kostet. Am Gerät zu prüfen, ob Schriftmetriken das kippen; `spec/entwurf.html` zeigt die Reserve laufend an. |
| **Zwischenschritt beim Auflösen** | Optional. Die Notationszeile könnte die Klammern erst zu ihren Werten zusammenfallen lassen (`(6+2) × (9−3)` → `8 × 6` → `= 48`), bevor das Ergebnis erscheint. Das ist die einzige Stelle, an der das Spiel *Punkt vor Strich* zeigt. Vorgabe ist derzeit ohne diesen Schritt. |
| **Dunkles Farbschema** | „Nice to have". Die Token-Struktur trägt es; entschieden ist nichts. |
| **Trefffläche des Klammerrands** | Der Rand ist schmal, Daumen sind es nicht. Abgesichert durch den antippbaren Platzhalter in der Ablage (6.6) – der genaue Weg darf nie der einzige sein. Am Gerät prüfen. |
| **Gleiche Zahlen** wie `[6, 6, 9]` | über `source` unterschieden, nicht über den Wert – im Test abdecken. |
| **Gruppe um den ganzen Ausdruck** | erlaubt, verbraucht aber das Kontingent ohne Nutzen. |
| **Ziehen auf iOS Safari** | `touch-action: none` nötig; die App scrollt ohnehin nicht. |

### 17.1 Erledigt in dieser Runde

| Punkt | Wie er erledigt wurde |
|---|---|
| **Kopfzeile** | Entschieden, siehe 12.7: Menüsymbol links, Tippsymbol rechts, dazwischen der Auswahl-Chip. |
| **Standard-Level ist F2.1** | Gegenstandslos: es gibt keine Level mehr (15.4). Die Vorgabe ist eine Auswahl – 3 Zahlen, alle vier Rechenzeichen, Band *klein*. |
| **`levelId` passt nicht zu `LEVELS`** | Das Feld entfällt (15.2). Zugleich entfällt mit `maxHintsPerGroup` (10.3) der einzige Ort, an dem der Fehler wirkte. |
| **`puzzles-F2-3.json` hat nur 35 Rätsel** | Kein Versäumnis: es existieren nur 60 lösbare Paare überhaupt (15.4). Erschöpfende Generierung hebt 35 auf 60, mehr ist nicht möglich. |
| **Regel für Tipp 2** | Festgelegt über die kanonische Fortsetzung (10.2, 10.3). |
| **Verhalten von `=` nach falscher Antwort** | Der Knopf bleibt aktiv (9.1). |
| **Verzögerung bis zum nächsten Rätsel** | 1200 ms nach richtiger Antwort (12.8); nach Aufgeben gar keine. |
| **Formel für `--cell`** | Ausgangsformel steht in 12.5. |
| **Was E1 von F3 unterscheidet** (offen in 2.2) | Nichts – **E1 entfällt, mit allen anderen Leveln** (15.4). Beide Auswege, „zwei Blöcke nötig" und „nur eindeutige Lösungen", wurden gerechnet und tragen nicht. |
| **Leere Kombinationen** (in 2.2 übersehen) | Feste Zielbereiche ließen 38 der 180 Kombinationen leer. Der Zielbereich wird jetzt aus der Auswahl **abgeleitet**; kein Band ist mehr leer (15.5). |
| **Obergrenze der Zielzahl** | 999. Drei Ziffern passen mit einer Schriftstufe kleiner, vier nicht (12.1, 15.5). |
| **Stufe als eigenes Bedienelement** | Entfällt – zwei Schwierigkeitsregler nebeneinander (15.5). |

---

## 18. Voraussetzungen vor der Umsetzung

Was fehlt, bevor der jeweilige Schritt aus Abschnitt 16 beginnen kann.

### Vor Schritt 0 – der Test-Runner

`package.json` kennt nur `dev`, `build`, `preview`. Die gesamte Begründung für
ein reines `core/` ist, dass es im Terminal prüfbar ist – ohne Runner bleibt das
eine Behauptung. Deshalb ist das Einrichten jetzt Schritt 0 statt einer
Vorbedingung.

- **vitest**, wie im Schwesterprojekt *flashcards*
- Tests als `*.test.ts` **neben** den Quellen, nicht in einem eigenen Baum
- `npm test` in `package.json`

Die ersten Tests, in dieser Reihenfolge:

1. `wrap` und `dissolve` sind exakte Umkehrungen – für `span = 3` und `span = 1`
2. die Invariante aus 2.1 hält nach jeder der sechs Operationen
3. `[6, 6, 9]`: zwei gleiche Zahlen bleiben über `source` unterscheidbar, auch
   nach Tauschen und Auflösen

### Vor Schritt 2b – Generierung im Gerät

Nichts mehr offen. `scripts/checkNextPuzzle.mjs` misst die
Versuchsverteilung von `nextPuzzle()` über alle 45 Auswahlen (Ergebnis in
15.10): ein synchroner Aufruf im Hauptthread reicht, kein Web Worker nötig.
Die beiden Auswahlen, die dabei mit `uniqueOnly` zu häufig leer ausgingen –
4 Zahlen nur `−`, 4 Zahlen nur `÷` – haben ihre erschöpfende Ausnahmeliste
(15.11, `scripts/dumpUniqueExceptions.mjs`). „3 Zahlen, nur `÷`" bleibt ohne
Liste, die Fehlerquote ist dort niedrig genug für ein höheres Versuchslimit.

Nicht mehr offen: das Merkmal für E1 (E1 entfällt, 15.4), die Bank-Obergrenze
(entfällt mit der Bank selbst, 15.10) und die Versuchsverteilung samt ihrer
beiden Ausnahmefälle.

### Vor Schritt 3 – Generierung, Auswahl, Einstellungen

Nichts mehr offen. Zur Erinnerung, was jetzt festliegt: Verzögerung 1200 ms nach
richtiger Antwort (12.8), `=` bleibt nach falscher Antwort aktiv (9.1), die
Kopfzeile steht in 12.7, die Auswahl in 15.6, das Einstellungsobjekt in
Abschnitt 11.

### Vor Schritt 4 – Tipps

Nichts mehr offen. Die Tipp-Regel steht vollständig in Abschnitt 10; sie hängt
an `solver.ts` aus Schritt 1 und an keiner Level-Eigenschaft mehr.

### Vor Schritt 6 – Feinschliff

| Fehlt | Warum es blockiert |
|---|---|
| **Die beiden Konstanten in `--cell`** | Die Formel steht in 12.5, ihre zwei Konstanten sind am Gerät zu bestätigen – am schlimmsten Fall aus vier Zahlen, drei Operatoren und zwei Blöcken. |
| **App-Icons in allen Größen** | Abschnitt 19.2 nennt die Größen; erzeugt werden sie aus `public/crown.svg` (13.2), das bislang keine gefüllte, für kleine Icon-Größen taugliche Fassung hat. |

---

## 19. PWA

Die Anforderungen (Abschnitt 1) legen den App-Typ bereits als PWA fest; dieser
Abschnitt macht daraus konkrete, prüfbare Punkte für Schritt 6.

### 19.1 Web App Manifest

`public/manifest.webmanifest`, verlinkt aus `index.html`:

```json
{
  "name": "Zahlenkönig",
  "short_name": "Zahlenkönig",
  "start_url": "/",
  "display": "standalone",
  "background_color": "hsl(214 20% 98.5%)",
  "theme_color": "hsl(214 62% 42%)",
  "orientation": "any",
  "icons": [ /* siehe 19.2 */ ]
}
```

`background_color`/`theme_color` sind `--zk-bg`/`--zk-accent` aus 13.1 als
feste Werte – das Manifest kann keine CSS-Variable lesen. Ändert sich `--hue`,
müssen beide Stellen von Hand synchron bleiben; ein Kommentar im CSS verweist
auf das Manifest.

`orientation: any`, nicht `portrait`: 12.6 unterstützt Quer- und Hochformat
gleichwertig, das Manifest darf das nicht einschränken.

### 19.2 Icons

Aus `public/crown.svg` (13.2) erzeugt, als PNG in `192×192` und `512×512`
sowie einer `512×512`-Variante mit `"purpose": "maskable"` (sicherer
Innenabstand, damit Android-Launcher nicht beschneiden). Die Krone braucht
dafür einen ausreichenden Rand im SVG – zu prüfen, nicht anzunehmen (18,
„App-Icons in allen Größen").

### 19.3 Service Worker

Ein Cache-first App-Shell-Worker (HTML, JS, CSS, Manifest, Icons), kein
Runtime-Caching von Daten – denn es gibt seit 15.10 keine Daten mehr zu
cachen, `core/` erzeugt Rätsel offline aus reinem JS. Registrierung:

```ts
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')
```

**Update-Strategie:** `skipWaiting` + `clients.claim`, mit einem knappen
Hinweis in der Kopfzeile („Aktualisieren", 12.7-Menü) statt eines
Popup-Dialogs – konsistent mit Abschnitt 11: die App drängt sich nicht auf.
Vite bietet dafür `vite-plugin-pwa` an, das Manifest, Service Worker und
Precache-Liste aus dem Build ableitet, statt beides von Hand zu pflegen; die
Alternative ist ein von Hand geschriebener, ca. 20-zeiliger Worker. Beides ist
mit „keine Bibliothek für den Kern" (Entscheidungen, Abschnitt 1) vereinbar,
weil es Build-Tooling ist, keine Laufzeitabhängigkeit im Spielcode.

### 19.4 Installierbarkeit

Folgt aus 19.1–19.3 ohne weiteren Code: HTTPS (GitHub Pages liefert das),
Manifest mit den Pflichtfeldern, ein registrierter Service Worker. Kein
eigener „Installieren"-Knopf in v2.0 – der Browser bietet den eigenen
Installationsdialog (`beforeinstallprompt`) an; ein selbstgebauter Knopf ist
ein Ausbauschritt, keine Voraussetzung.

### 19.5 Offline-Verhalten

Weil Rätsel im Gerät erzeugt werden (15.10) und `core/` keine
Netzwerkabhängigkeit hat, ist Offline-Spielbarkeit nach dem ersten Laden
vollständig: der Service Worker liefert den App-Shell aus dem Cache, der Rest
läuft ohnehin lokal. Nichts davon ist eine neue Anforderung an `core/` –
Abschnitt 1 der Entscheidungen verlangte das bereits, hier wird nur sichtbar,
dass es sich auszahlt.

---

## 20. Produktions-Build: klein statt eine zweite Fassung

Auf die Frage nach einer „minimierten Version zum Einbetten von der Website"
gibt es **keine zweite Fassung** – gemeint war der normale Produktions-Build,
nur bewusst klein gehalten, nicht ein eingebetteter Widget-Modus (der wäre
eine eigene Funktionsanforderung, siehe 20.3).

### 20.1 Was bereits dafür sorgt

`npm run build` läuft über Vite/esbuild und minifiziert, tree-shaked und
hasht die Dateinamen ohnehin. Die Entscheidungen, die die Bundle-Größe klein
halten, stehen bereits fest, nur nicht unter diesem Namen:

- **keine Drag-Bibliothek** (Entscheidungen, Abschnitt 1) – ~150 Zeilen statt
  einer Abhängigkeit mit eigenem Modell,
- **`system-ui`, keine Webschrift** (13.2) – kein Font-Download,
- **Inline-SVG statt Emoji-Bibliothek** (13.2),
- **keine Bank-JSON mehr** (15.10) – der bisher größte einzelne Netzwerk-
  Request entfällt vollständig, nicht nur verkleinert sich,
- zwei Laufzeitabhängigkeiten insgesamt: `react`, `react-dom`.

### 20.2 Was noch fehlt

Keine Vorgabe existiert bisher für ein **Budget** und seine **Prüfung**:

| Zu ergänzen | Vorschlag |
|---|---|
| Größenbudget | z. B. **< 60 KB** JS gzip für den kritischen Pfad (App-Shell ohne Icons) – am Gerät zu bestätigen wie die `--cell`-Konstanten (17), nicht zu raten |
| Prüfung im Build | `vite-bundle-visualizer` oder ein einfaches `ls -la dist/assets | gzip -c | wc -c`-Skript, das bei Überschreitung fehlschlägt – dasselbe Prinzip wie `checkBankShapes.mjs`: eine Behauptung, die sich selbst nachrechnet |
| `React.StrictMode`/Dev-Only-Code | sicherstellen, dass `import.meta.env.DEV`-Zweige aus dem Produktions-Build fallen (Vite tut das automatisch, aber unverifiziert) |

Dieser Punkt gehört vor Schritt 6 (Feinschliff, Abschnitt 18) – erst dort
existiert ein vollständiger Build, den man messen kann.

### 20.3 Falls doch ein Embed-Modus gemeint war

Offen gelassen, falls sich die Anforderung später doch als eigener
Einbettungsmodus (z. B. ein `<iframe>` mit einem einzelnen Rätsel ohne
Kopfzeile) herausstellt: das wäre kein Bundle-Größen-Thema mehr, sondern eine
eigene Route mit eigenem Layout, und bräuchte eine eigene PO-Entscheidung.
Nicht Teil dieser Runde.
