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
Reihenfolge, an derselben Stelle. Der Block-Chip kehrt in die Ablage zurück.
**Es fällt nichts heraus.**

Denn wer einen Block entfernt, will fast immer *andere* Klammern, nicht weniger
Zahlen. `(6+2)×9` → `6+(2×9)` kostet so zwei Gesten: tippen, dann den Block auf
die `2` ziehen. Über „erst leeren" wären es acht, und jede Zahl müsste ohne Grund
in die Ablage und zurück.

| Geste | Wirkung |
|---|---|
| Rand tippen | Klammern gehen heim, Inhalt bleibt |
| auf einen anderen Operanden ziehen | die beiden tauschen, Inhalt reist mit |
| aus dem Feld ziehen und loslassen | Klammern gehen heim, Inhalt bleibt |
| Platzhalter in der Ablage tippen | Klammern gehen heim, Inhalt bleibt |

Vier Einträge, drei mit demselben Ergebnis – das ist der Punkt: **alle scheinbar
zerstörerischen Gesten laufen auf die harmlose hinaus.**

**Bewegen ist keine neue Regel.** Ein Block ist ein Operand, und für einen
Operanden auf einer belegten Operandenfläche gilt bereits: tauschen.
`(6+2) − 9` wird durch Ziehen auf die `9` zu `9 − (6+2)` – ein anderer Ausdruck,
also eine sinnvolle Geste. Ob der Block zwei oder drei Zahlen enthält, ändert
nur die Anzahl der Ziele (drei Operanden bieten zwei, zwei Operanden bieten
eines), nicht die Regel.

### 6.6 Treffflächen

Der sichtbare Rand ist dünn, und Daumen sind es nicht. Deshalb hat das Auflösen
**zwei Wege**:

- **Der Rand selbst** – die beiden Klammerstege sowie das Band über und unter den
  Chips. Jeder Steg bekommt eine unsichtbare Trefffläche von etwa 22 px Breite
  über die volle Blockhöhe, nach außen in den Feldabstand und nach innen über die
  Polsterung, ohne je einen Chip zu überlappen. Ein hoher schmaler Streifen ist
  deutlich leichter zu treffen als ein kleines Quadrat.
- **Der Platzhalter in der Ablage** – eine volle Zelle von 64 px, dort wo der
  Daumen ohnehin ist.

Verallgemeinert, statt als Sonderfall: **ein gestrichelter Platzhalter in der
Ablage ist antippbar und holt zurück, was ihn verlassen hat.** Das gilt für
Zahlen genauso wie für den Block, ist eine Regel statt zweier, und gibt jedem
Element eine große Rückholfläche. Der genaue Weg bleibt für alle, die ihn
mögen; niemand ist darauf angewiesen.

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

Da alle anderen Rückmeldungen aus dem Spiel entfernt wurden (Abschnitt 11), trägt
diese Zeile das gesamte Gespräch zwischen Spiel und Spieler.

---

## 10. Tipps neu gedacht

v1 zerlegt Lösungszeichenketten mit regulären Ausdrücken und ignoriert, was der
Spieler bereits gebaut hat. Mit dem Baum geht mehr.

### 9.1 Grundlage: der Restlöser

Statt Zeichenketten zu vergleichen, beantwortet ein kleiner Löser die Frage:
**„Lässt sich der angefangene Ausdruck mit den übrigen Zahlen noch auf die
Zielzahl bringen?"**

Bei höchstens vier Zahlen ist der Suchraum winzig – das Prüfskript aus Abschnitt
4.1 wertet 1500 Rätsel erschöpfend in unter zwei Sekunden aus. **`scripts/checkDepth1.mjs`
ist die Vorlage für `solver.ts`**, nicht `PuzzleGenerator.findSolutions`: Letzteres
arbeitet über Zeichenketten und `Function()`, das Prüfskript rechnet bereits über
Operandenlisten und kennt die Ein-Ebenen-Regel. Robuster als jeder Textvergleich,
weil es auch Lösungen erkennt, die nicht in der Bank stehen.

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

## 12. Layout

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
| gestricheltes graues Feld in der Ablage | dieses Element liegt gerade im Ausdruck – **antippen holt es zurück** (Abschnitt 6.6) |
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

## 13. Design-System

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

## 14. Dateistruktur

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

## 15. Umsetzung in Schritten

| # | Schritt | Ergebnis |
|---|---|---|
| 1 | `core/` schreiben: Baum, Auswertung, Löser | im Terminal prüfbar, ohne UI |
| 2 | Ziehschicht + `Chip`, `Tray`, `Expression`, Blockgesten (Abschnitt 6) | ein fest verdrahtetes Rätsel ist spielbar |
| 3 | Bank, Level, Einstellungen, `=`-Prüfung, Notationszeile | vollständige Spielschleife |
| 4 | Tipps und Sackgassen-Anzeige | Tippleiter steht |
| 5 | Streaks entfernen, Emoji durch SVG ersetzen, Texte anpassen | v1-Reste sind weg |
| 6 | Animationen, Querformat, PWA | Feinschliff |

Nach Schritt 3 ist die App erstmals durchgehend spielbar; die Schritte 1 und 2
tragen das gesamte Risiko. **Abschnitt 17 nennt, was vor dem jeweiligen Schritt
noch fehlt.**

---

## 16. Offene Punkte und Risiken

| Punkt | Stand |
|---|---|
| **Kopfzeile** | Noch nicht entschieden. Vorschlag nach dem Vorbild von *flashcards*: ein ruhiges Symbol oben rechts für das Menü, eines für Tipps, sonst nichts. |
| **Zwischenschritt beim Auflösen** | Optional. Die Notationszeile könnte die Klammern erst zu ihren Werten zusammenfallen lassen (`(6+2) × (9−3)` → `8 × 6` → `= 48`), bevor das Ergebnis erscheint. Das ist die einzige Stelle, an der das Spiel *Punkt vor Strich* zeigt. Vorgabe ist derzeit ohne diesen Schritt. |
| **Dunkles Farbschema** | „Nice to have". Die Token-Struktur trägt es; entschieden ist nichts. |
| **Standard-Level ist F2.1** | **Widerspruch aus v1:** ein neuer Spieler landet direkt auf dem ersten Level mit Klammern, ohne A1–A3 gespielt zu haben. Entweder beim ersten Start auf A1 setzen oder sicherstellen, dass das erste F2.1-Rätsel ohne Block lösbar ist. |
| **Trefffläche des Klammerrands** | Der Rand ist schmal, Daumen sind es nicht. Abgesichert durch den antippbaren Platzhalter in der Ablage (6.6) – der genaue Weg darf nie der einzige sein. Am Gerät prüfen. |
| **`levelId` in der Bank passt nicht zu `LEVELS`** | **Fehler aus v1, blockiert die Tippleiter.** Die Bank schreibt `"E1-3"`, `LEVELS` kennt `"E1.3"`. `getLevelById` findet nichts und liefert den Fallback F2.1 – `useHints` liest deshalb für fast alle Level die Gruppe `advanced`. Folge: **Experten-Level bieten 2 statt 3 Tipps, Stufe 3 ist unerreichbar.** Vor Schritt 4 zu beheben: entweder die Bank auf Punkte umstellen oder beim Laden normalisieren. |
| **`puzzles-F2-3.json` enthält nur 35 Rätsel** | Altlast aus v1; Wiederholung setzt schnell ein. Sollte nachgeneriert werden. |
| **Gleiche Zahlen** wie `[6, 6, 9]` | über `source` unterschieden, nicht über den Wert – im Test abdecken. |
| **Gruppe um den ganzen Ausdruck** | erlaubt, verbraucht aber das Kontingent ohne Nutzen. |
| **Ziehen auf iOS Safari** | `touch-action: none` nötig; die App scrollt ohnehin nicht. |

---

## 17. Voraussetzungen vor der Umsetzung

Was fehlt, bevor der jeweilige Schritt aus Abschnitt 15 beginnen kann. Nach
Dringlichkeit geordnet.

### Vor Schritt 1 – `core/`

| Fehlt | Warum es blockiert |
|---|---|
| **Kein Test-Runner** | `package.json` kennt nur `dev`, `build`, `preview`. Es gibt weder vitest noch eine Konfiguration. Die gesamte Begründung für ein reines `core/` ist, dass es im Terminal prüfbar ist – ohne Runner bleibt das eine Behauptung. Das Schwesterprojekt *flashcards* nutzt vitest mit `*.test.js` neben den Quellen; dasselbe Vorgehen hier. Erster Test: `wrap` und `dissolve` sind exakte Umkehrungen, und die Invariante aus 2.1 hält nach jeder der sechs Operationen. |

### Vor Schritt 3 – Bank, Level, Einstellungen

| Fehlt | Warum es blockiert |
|---|---|
| **`levelId`-Abgleich** | Die Bank schreibt `E1-3`, `LEVELS` kennt `E1.3` (siehe Abschnitt 16). `puzzles.ts` und `hints.ts` lesen beide dieses Feld. Entweder beim Laden normalisieren oder die Bank auf Punkte umstellen – aber entschieden sein, bevor darauf gebaut wird. |
| **Verzögerung bis zum nächsten Rätsel** | v1 nutzte 1200 ms. Nicht festgelegt. |
| **Verhalten von `=` nach einer falschen Antwort** | Bleibt der Knopf aktiv, lässt sich derselbe Ausdruck erneut abschicken? Nicht festgelegt. |

### Vor Schritt 4 – Tipps

| Fehlt | Warum es blockiert |
|---|---|
| **Regel für Tipp 2** | „Zwei zusammengehörige Zahlen pulsieren" – aber *welche* zwei, wenn ein Rätsel mehrere Lösungen hat? Braucht eine eindeutige Vorschrift, sonst ist der Tipp bei jedem Aufruf ein anderer. |
| **`levelId`-Abgleich** | Solange er offen ist, liefert `getLevelById` fast überall die Gruppe `advanced`, und Stufe 3 der Leiter ist unerreichbar. |

### Vor Schritt 6 – Feinschliff

| Fehlt | Warum es blockiert |
|---|---|
| **Die Formel für `--cell`** | Abschnitt 12.5 legt fest, dass alle Maße aus einer Variablen folgen, und nennt die inneren Anteile – aber nicht die Formel für die Variable selbst. *flashcards* hat `min(75vw, 900px, (75dvh − footer) × 4/3)`; hier fehlt das Gegenstück. Das ist zu Recht eine Frage für den Feinschliff am echten Gerät, sollte aber nicht dort erst auffallen. |
| **Die Kopfzeile** | Weiterhin offen (Abschnitt 16). Betrifft schon Schritt 3, weil sie Platz im Raster braucht. |

### Nicht blockierend

`puzzles-F2-3.json` mit nur 35 Rätseln und das Standard-Level F2.1 (beide
Abschnitt 16) sind Altlasten aus v1. Sie sollten behoben werden, halten aber
keinen Schritt auf.
