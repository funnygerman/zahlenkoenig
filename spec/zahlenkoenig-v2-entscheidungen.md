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
| **Platzhalter in der Ablage sind antippbar – für Zahlen** | Der Klammerrand ist schmal, Daumen sind es nicht. Große Zweitfläche für dieselbe Aufgabe. Galt ursprünglich auch für den Block; entfällt dort mit der Revision unten, weil der Block keinen Platzhalter mehr hat, der für ein bestimmtes Vorkommen steht. |
| **Block-Chip ist einzeln und dauerhaft, wie ein Operator** (Revision, nach Rückmeldung zum ersten spielbaren Brett) | Ursprünglich ein Platzhalter pro Kontingent-Einheit (⌊n/2⌋ Chips, jeder verschwindet beim Setzen wie bei einer Zahl) – bei vier Zahlen liefen zwei davon im Layout aus dem Raster, das Abschnitt 12.1 ohnehin nur für einen einzigen `[Block]` vorsieht. Ein einzelner Chip behebt beides zugleich: er passt in die eine reservierte Spalte, und „wie viele Blöcke passen noch" wird eine einzige Ja/Nein-Frage statt eines Zählens über mehrere Chips. Deaktiviert sich, sobald ⌊n/2⌋ erreicht ist – dieselbe Behandlung wie beim `=`-Knopf, kein Sonderfall. |
| **Kein Undo** | Keine Geste verliert mehr als einen Chip. Die Anforderung entfällt, statt erfüllt zu werden. |

**Verworfen:** nur Drag-and-Drop · Löschen-/Clear-Knopf · langes Drücken
(Modalität, die es sonst nirgends gibt und die nichts ankündigt) · „Block erst
leeren, dann entfernen" · einen vollen Block aus dem Feld ziehen und den Inhalt
in die Ablage schütten · ein Platzhalter pro Block-Kontingent-Einheit (siehe
Revision oben).


### 3.1 Die Zeigerschicht, nach dem ersten Test auf echten Geräten

Das erste spielbare Brett war per Ziehen **gar nicht** bedienbar – auf Android
(Chrome, DuckDuckGo) wie auf dem Mac (Firefox, Chrome). Drei Ursachen, alle
drei unabhängig voneinander ausreichend, um jedes Ablegen scheitern zu lassen:

| Befund | Ursache | Entscheidung |
|---|---|---|
| **Das Geisterelement klebte oben links am Bildschirmrand**, weit über dem Ausdrucksfeld | Es stand auf `position: fixed; top: 0; left: 0` und bekam als `transform` die **Wegstrecke** des Fingers seit dem Aufsetzen, nicht dessen Position. Bei 20px Bewegung steht es 20px unter der linken oberen Ecke – egal, wo gezogen wird. | Der `transform` ist die Zeigerposition im Sichtfenster, plus `translate(-50%, -50%)`. Beides schreibt der Hook, nicht das Stylesheet: ein Inline-`transform` überschreibt ein Regel-`transform`, die beiden lassen sich nicht mischen. |
| **Nichts sah nach Ziehen aus** | Das Geisterelement war ein leeres graues Quadrat. Der aufgenommene Chip blieb unverändert liegen. | Der Hook meldet den gezogenen Chip nach außen (`draggingItem`); `Game.tsx` zeichnet ihn im Geist noch einmal – gleiche Art, gleiche Größe wie das Original (Ablage- oder Feldmaßstab). Der Quell-Chip wird für die Dauer gedimmt, direkt am Knoten, ohne Render. |
| **Kein Ablegen kam an** | Im leeren Feld war die einzige angemeldete Fläche der nachlaufende Rand, und der zeichnete **nichts**: ein 0×0-Element, das per Rechteck nie zu treffen ist. Das Gerüst aus Abschnitt 6.4 war nie verdrahtet. | `useGame` leitet die Gerüstzahlen her (offene Zahlen der Ablage abzüglich der bereits gezeichneten Lücken; *n* Zahlen brauchen immer *n−1* Operatoren) und `Game.tsx` reicht sie durch. Damit hat jede offene Position sichtbare Fläche. |

Dazu zwei Regeln, die aus demselben Test folgen:

- **Treffen mit Toleranz statt reinem Rechteck.** Eine Feldfläche ist ~32px
  breit in einem 64px hohen Feld; der Rand eines vollen Blocks ist weiterhin
  0px breit. Wer 10px über der Fläche loslässt, meint sie trotzdem. Getroffen
  wird zuerst per Rechteck, danach die **nächstgelegene** Fläche innerhalb von
  28px. Darüber hinaus bleibt Loslassen ein echtes „Herausziehen" (Abschnitt 5)
  – die Ablage liegt weit außerhalb dieser 28px.
- **Der nachlaufende Rand ist eine Fläche, nicht sieben.** Das angemeldete
  Element umfasst die vorderste Gerüstfläche, alle dekorativen dahinter und den
  leeren Rest des Feldes. Das widerspricht 6.4 nicht, sondern führt es aus: nur
  die vorderste Position ist überhaupt lebendig („keine eigenen Ablageziele"),
  und Loslassen im leeren rechten Teil des Feldes kann nichts anderes heißen als
  „hinten anstellen". Hervorgehoben wird weiterhin nur die eine Fläche, in der
  der Chip landet.

**Eine Zahl aus der Ablage auf eine belegte Fläche** ersetzt, was dort liegt;
der verdrängte Chip fällt in die Ablage zurück. Vorher passierte nichts – die
einzige Geste, die stumm ins Leere lief.

**Nebenbefund, nicht von der Zeigerschicht verursacht:** der nachlaufende Rand
ist ein Flex-Element und kostete den `gap` der Zeile (4px), auch wenn er leer
war. Der schlimmste Ausdruck `(6+2) × (9−3)` hat laut 12.5 rund 7px übrig – er
lief also um 4px über und wurde beschnitten. Ein leerer Rand hebt den `gap` per
negativem Rand wieder auf; gemessen bleiben 7,7px übrig. **Verworfen:** dem Rand
eine Mindestbreite geben (kostet genau die Breite, die 12.5 nicht hat).

**Verworfen:** HTML5-Drag-and-Drop (löst auf iOS-Safari bei Berührung nicht
aus) · Zonen während des Ziehens neu vermessen · das Geisterelement über
React-State bewegen · dekorative Gerüstflächen zu eigenen Ablagezielen machen.


### 3.2 Jede Fläche ist ein Ziel (zweiter Gerätetest)

Mit reparierter Zeigerschicht war die erste Rückmeldung: „Ich kann nur auf den
ersten freien Platzhalter ablegen. **Damit ergibt Ziehen wenig Sinn, ich könnte
genauso gut tippen.**" Das trifft den Kern – 6.4 hatte die Gerüstflächen
absichtlich als Deko geführt, und genau das nahm dem Ziehen seinen Zweck. **PO:
jede freie Fläche ist ein Ablageziel**, Zahl in jede Zahl-Fläche, Operator in
jede Operator-Fläche. 6.4 ist entsprechend geändert.

| Entscheidung | Begründung |
|---|---|
| **Ablegen jenseits des bisherigen Endes füllt die übersprungenen Positionen als offene Lücken** (`placeAt`) | Wer auf die dritte Zahl-Fläche ablegt, meint die dritte. Der Baum reicht dort noch nicht hin, also wächst er – mit `null` an allen Stellen dazwischen, was genau das ist, was das Feld ohnehin schon zeichnet. Nichts wird verschoben: `children[index]` ist vorher und nachher dieselbe Position. |
| **Nachlaufende Lücken werden nie gespeichert** (`trimTrailingGaps`) | Das Gerüst leitet sie ohnehin aus der Ablage her; gespeichert stünden sie doppelt. Vor allem aber lässt eine gespeicherte Schlusslücke einen **fertigen** Ausdruck unfertig aussehen: `3 + 7 ⬚` hat gerade Länge, `isExpressionComplete` sagt nein, und `=` bliebe grau. |
| **Getippte Zahl → nächste freie Zahl-Position, getippter Operator → nächste freie Operator-Position** (PO) | Vorher ließ sich keine zweite Zahl hintereinander tippen: die Suche gab für „Operand" nichts zurück, sobald die nächste Position eine Operator-Position war. `entwurf.html`s `nextOpenOperand` hat seit jeher das `+ 1`, das darüber hinweggeht – der Entwurf konnte es, die App nicht. |
| **Auch der erste Chip darf ein Operator sein** | Über den Entwurf hinaus (dort ist es ein No-op). Sobald jede Fläche ein Ziel ist, wäre Tippen sonst strenger als Ziehen, und die Regel „nächste freie Fläche dieser Art" hätte eine Ausnahme, die man dem Feld nicht ansieht. Rückgängig zu machen ist eine Zeile, falls der PO die Entwurfsfassung will. |
| **Das Budget prüft `useGame`, nicht der Baum** | `nextOpenSurface` kennt jetzt immer eine Position – die Folge kann ja immer wachsen. Dass ein 4-Zahlen-Rätsel genau drei Operatoren hat, weiß die Spielschicht; sie lehnt den vierten Tipp ab, statt den Ausdruck wachsen zu lassen. Derselbe Deckel, den der Block-Chip durch Deaktivieren zieht. |
| **Zwei getippte Blöcke stehen nebeneinander statt einer davon ins Leere zu laufen** | Fällt als Nebenwirkung derselben Regel an, und ist besser als das vorherige No-op: zweimal tippen legt direkt die Form aus 12.5 hin, `(⬚○⬚) ○ (⬚○⬚)`. Was weiterhin nicht passieren darf – der zweite Tipp findet die *Innenfläche* des ersten Blocks und überschreibt ihn – verhindert `nextOpenRootSurface` wie bisher. |

Zwei Regeln der Zeigerschicht mussten dafür schärfer werden:

- **Eine Fläche der anderen Art ist eine Absage, kein Beinahe-Treffer.** Wer
  einen Operator mitten auf einer leeren *Zahl*-Fläche loslässt, greift sonst
  über sie hinweg zum Operator 20px daneben und ersetzt den – man zielt auf
  eine Fläche und trifft die Nachbarin. Getroffen wird jetzt: Rechteck der
  passenden Art → Rechteck der anderen Art (dann: nichts) → nächstgelegene
  passende innerhalb der Toleranz.
- **Toleranz von 28px auf 8px.** Jede Wurzelposition ist jetzt so hoch wie ihre
  Zeile (offene *und* belegte), also muss die Toleranz nicht mehr senkrecht zu
  einer Fläche *hinaufreichen*, sondern nur die waagerechten Nähte schließen:
  4px Flex-Abstand, 5px Feldrand, der 0px breite Rand einer Gruppe. Das ist
  auch nötig: die Ablage beginnt 11px unter den Flächen, und mit 28px landete
  ein Loslassen am oberen Rand eines Ablage-Chips noch im Feld – „herausziehen"
  wurde unzuverlässig. Die letzte Fläche nimmt sich den freien Rest der
  Feldbreite (`flex-grow`), damit der leere rechte Teil des Feldes zu ihr
  gehört statt zu nichts; wachsen kann sie nur in Platz, den das Feld übrig
  hat, und im schlimmsten Fall aus 12.5 hat es keinen.

**Zur Frage, ob der Entwurf Drag-and-Drop hatte: nein.** `spec/entwurf.html`
hört ausschließlich auf `click`; seine `.ghost`-Klasse ist die blasse
Gerüstfläche aus 6.4, nicht ein Geisterelement am Finger. Er war nie ein
Beleg dafür, dass Ziehen funktioniert – nur dafür, wie Tippen sich anfühlt.

**Verworfen:** die Gerüstflächen als Deko belassen (nimmt dem Ziehen den Zweck
– der Befund, der diese Runde ausgelöst hat) · eine einzige große Ablagefläche
über das ganze Gerüst (macht aus sieben sichtbaren Zielen wieder eines) ·
nachlaufende Lücken speichern (siehe oben) · die Toleranz senkrecht großzügig
lassen (frisst den Abstand zur Ablage).


### 3.3 Antippen heißt zurücknehmen — auf beiden Seiten (dritter Gerätetest)

„Tippe ich auf den Operator im Ausdruck, verschwindet er nicht. Schlimmer: es
kommt derselbe Operator an der nächsten freien Stelle dazu."

Die Tipp-Weiche in `Game.tsx` verzweigte nach **was** ein Chip ist (`role`) und
nie danach, **wo** er liegt. Ein gesetzter Operator sah damit exakt aus wie der
in der Ablage, und `onTapOperator` kann nur setzen. Zahlen entkamen dem nur
durch Zufall: `onTapNumber` prüft ohnehin, ob die Id schon platziert ist.

| Entscheidung | Begründung |
|---|---|
| **Die Nutzlast trägt `origin: 'tray' \| 'field'`** | Tippen bedeutet auf den beiden Seiten das Gegenteil – die Ablage setzt, das Feld nimmt zurück (6.6). Welche Komponente den Chip gezeichnet hat, ist keine ableitbare Zustandsgröße, die driften könnte, sondern schlicht bekannt. Ersetzt das bisherige `scale`, weil es dieselbe Tatsache ist: Feld-Chips sind kleiner als Ablage-Chips (12.5). |
| **Ein Block behält immer seine Mindestform** (`withMinimumShape`, konzept 6.3) | Beim Prüfen der Reparatur aufgefallen: `removeOperand` nimmt den Nachbaroperator mit, also wurde aus `(6+2)` ohne `+` und `6` ein `(2)` – eine Klammer ohne offene Fläche darin, aus der nur Auflösen herausführt. Gleiches Bild über einen zweiten Weg: ein Block auf eine **einzelne** Zahl gezogen (6.1, span 1) ergab `(6)`. Beide gehen jetzt durch dieselbe Regel und zeigen `⬚ ○ ⬚`. |

**Der eigentliche Befund ist aber, dass 453 Tests grün blieben.** Der Fehler
sitzt in der Verdrahtung zwischen `useGame` und `Expression`/`Tray`; beide Hooks
für sich waren korrekt, und `Game.test.tsx` spielte nur eine Partie durch, in
der nie ein gesetzter Chip angetippt wird. Die neuen Tests dort greifen genau da
an – und fallen ohne die Reparatur mit dem gemeldeten Symptom durch (zwei
Operatoren statt keinem), bevor sie als Absicherung gelten.

**Verworfen:** die Herkunft im Spielzustand nachschlagen (`findLeaf` über den
Baum, um „liegt schon" zu erkennen) – die zeichnende Komponente weiß es
sicher, eine Suche kann nur falsch liegen · `scale` für die Weiche
zweckentfremden · `wrapGroup` im Kern auffüllen lassen (bräche die in 6.9
getestete Umkehrbarkeit von wrap/dissolve).

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
| **Ausdruck bricht nie um und scrollt nie** | Der Inhalt ist beschränkt (vier Zahlen, drei Operatoren, zwei Blöcke), also wird auf den schlimmsten Fall dimensioniert – gemessen, nicht geschätzt: 268,7 px Inhalt in 275,8 px Feld. Die Reserve ist rund 7 px, was drei Anteile in 12.5 unantastbar macht. `spec/entwurf.html` rechnet sie bei jedem Rendern neu aus. |
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

## 8. Level entfallen (Runde 4)

| Entscheidung | Begründung |
|---|---|
| **Keine Level mehr** (PO) | Die 13 Kürzel kodierten drei Angaben, von denen zwei echt waren. Der Spieler setzt sie jetzt direkt: wie viele Zahlen, welche Rechenzeichen, wie groß das Ziel. Nichts zu entschlüsseln. |
| **E1 entfällt ersatzlos** (PO) | `maxBracketDepth` war sein einziges Merkmal, und v2 schafft Verschachtelung ab. Der PO kam selbst darauf, dass verschachtelte Blöcke bei vier Zahlen immer überflüssig sind und „zwei Blöcke nötig" stets auf `(a ± b) ×/÷ (c ± d)` hinausläuft. Nachgerechnet: nur 911 von 29 648 Rätseln (3 %) brauchen zwei Blöcke, gehäuft auf entarteten Mengen. |
| **Zielbereich abgeleitet, nicht fest** | Der PO fand die Lücke: 2 Zahlen mit `+ −` und Ziel 100–324 ergibt nichts. Ausgezählt waren 38 von 180 Kombinationen leer. Relative Bänder über die tatsächlich erreichbaren Ziele machen jede Auswahl nicht-leer – geprüft über alle 45 Auswahlen. |
| **Rechenzeichen einzeln, nicht paarweise** | Der PO fragte, ob `(+ −)` und `(× ÷)` als Gruppen reichen. Nein: die dünnen Fälle waren fast alle Einzelauswahlen, und die sind jetzt abgesichert. „Nur `+`, zwei Zahlen" ist zugleich der sanfteste Einstieg, den es je gab – Paare könnten ihn nicht ausdrücken. |
| **Stufe entfällt** (PO) | Zwei Schwierigkeitsregler nebeneinander, und keiner weiß, welchen er drehen soll. Das Zielband gewinnt, weil man seine Wirkung sieht; die Suchschwierigkeit bleibt als innere Reihenfolge. |
| **Bank bleibt, mit Filterspalten** (PO) | Der PO wollte die Bank behalten. Sie trägt jetzt einen 15-Bit-Operator-Vektor je Rätsel (nur 61 verschiedene im ganzen Raum, also ein Byte) und eine 45-Zeilen-Tabelle mit Bandgrenzen, zusammen 2,7 KB. Damit muss auf dem Gerät nichts gerechnet werden. |
| **Eindeutigkeit als Schalter, zwei Bänke** (PO) | Der Vorschlag des PO ist tragfähig, und mein Einwand war überzogen: Rechenzeichen wegzunehmen kann Lösungen nur entfernen, nie hinzufügen. Eine Bank „genau eine Lösung über alle vier Zeichen" bleibt daher unter jeder Teilmenge gültig. |
| **Zielzahl höchstens 999** | Drei Ziffern passen in den Zielchip mit einer Schriftstufe kleiner, vier nicht. Kostet 148 von 31 527 Rätseln. |
| **Zeile 1 ist eine Chiphöhe hoch** (PO) | Die Zielzahl ist derselbe Chip wie eine Zahl, das Ausdrucksfeld genauso hoch. Ein doppelt hohes Feld war ein Zwischenstand und wiederholte einen v1-Fehler. |
| **Letztes Rechenzeichen: gesperrt, nicht ausgegraut** (PO) | Ausgegraut liest sich wie unbenutzbar; es ist bloß das letzte. Es bleibt gewählt, der Druck läuft ins Leere, die Berührung erklärt es. |

**Verworfen:** Level in jeder Form · E1 mit neuem Merkmal · „zwei Blöcke nötig"
als Level · „nur eindeutige Rätsel" als Level (93 bzw. 0 Rätsel in den Ecken) ·
feste Zielbereiche · Rechenzeichen nur paarweise · Stufe als eigener Regler ·
Zielzahl über 999 · doppelt hohes Ausdrucksfeld · ausgegrautes letztes
Rechenzeichen.

**Offen:** die Breite der Ausdruckszeile (Abschnitt 17 des Konzepts).

---

## 9. PWA, Bank und Build (Runde 5)

Drei Anstöße kamen diesmal vom PO in einer Sitzung, nicht aus dem Review eines
Entwurfs: die PWA-Anforderung explizit machen, eine „minimierte Version zum
Einbetten von der Website" und ein erneuter Zweifel an der Bank-Entscheidung
aus Runde 4.

| Entscheidung | Begründung |
|---|---|
| **Bank entfällt, Rätsel werden im Gerät erzeugt** (PO, widerruft Runde 4) | Der PO nannte zwei Gründe: man muss nicht alle Rätsel einer Auswahl laden, wenn nur eines gebraucht wird; und die Generierung eines einzelnen Rätsels ist schnell genug, um sie bei Bedarf statt im Voraus zu rechnen. Beides stimmt – `checkDepth1.mjs` prüft eine einzelne Zahlenmenge in unter 10 ms, die „5 Sekunden" aus 15.3 sind die Summe über alle 495 Vierermengen, nicht die Kosten eines Zugs. Die 45-Zeilen-Tabelle (Bandgrenzen, Anzahl, Eindeutigkeits-Verfügbarkeit) bleibt, weil sie über den *gesamten* Suchraum einer Auswahl Auskunft gibt – das kann ein einzelner generierter Versuch nicht. Details in Konzept 15.10. |
| **„Minimierte Version" ist der normale Produktions-Build, keine zweite Fassung** | Nachgefragt: gemeint war eine kleine, minifizierte Datei „wie `zahlenkoenig.min.js`, aber mit der ganzen Funktionalität" – nicht ein eigener Embed-Modus mit reduziertem Funktionsumfang. Das leistet `vite build` bereits (Minifizierung, Tree-Shaking, Hashing); neu ist nur ein Größenbudget und dessen Prüfung im Build, siehe Konzept 20. |
| **PWA-Anforderungen konkretisiert statt nur benannt** | Die v1-Spezifikation nennt „PWA" bereits als App-Typ, ohne Manifest, Icons oder Service-Worker-Strategie festzulegen. Konzept 19 macht das für v2 konkret: Manifest mit festen Farbwerten (CSS-Variablen kann ein Manifest nicht lesen), zwei Icon-Großen plus maskable-Variante aus der Krone, ein App-Shell-Service-Worker ohne Daten-Caching – Letzteres eine direkte Folge der Bank-Entscheidung: es gibt nichts mehr zu cachen außer dem Shell selbst. |

**Verworfen:** Bank als vorab erzeugte JSON-Datei (Runde 4, jetzt widerrufen) ·
ein eigener `/embed`-Build oder Iframe-Modus (nicht angefragt; siehe Konzept
20.3, falls später doch gewollt) · Runtime-Caching von Rätseldaten im Service
Worker (gegenstandslos ohne Bank) · ein selbstgebauter
„Installieren"-Knopf für v2.0 (der native Browser-Dialog genügt zunächst).

**Erledigt seit dieser Sitzung:** die Versuchsverteilung von `nextPuzzle()`
ist gemessen (`scripts/checkNextPuzzle.mjs`, Konzept 15.10) – synchron auf
dem Hauptthread reicht. Zwei Auswahlen (4 Zahlen nur `−`, 4 Zahlen nur `÷`)
brauchten mit `uniqueOnly` eine Ausnahmeliste statt blinden Neuziehens;
diese ist jetzt erschöpfend erzeugt und in Konzept 15.11 eingetragen
(`scripts/dumpUniqueExceptions.mjs`). Eine dritte, anfangs verdächtige
Auswahl (3 Zahlen nur `÷`) blieb ohne Liste – ihre Fehlerquote war niedrig
genug für ein höheres Versuchslimit statt einer vorab gezogenen Liste.

**Offen:** das konkrete Größenbudget für den Produktions-Build (Konzept
20.2); ob `public/crown.svg` genug Innenabstand für ein maskable Icon hat
(Konzept 19.2).

---

## 10. Arbeitsweise

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
  Runde 4 zeigt die andere Richtung derselben Regel: dort wurde 12.5 als falsch
  gemeldet, weil ein **neuer** Entwurf überlief. Nachgemessen lag es am Entwurf,
  nicht am Konzept – er hatte die Anteile stillschweigend geändert. **Wer eine
  Messung gegen ein Dokument stellt, muss prüfen, ob er dasselbe gemessen hat.**
- **Am Entwurf entscheiden.** Runde 4 lief über einen klickbaren Entwurf, der die
  Rätsel live nach der v2-Regel erzeugt. Drei Befunde – die leeren Kombinationen,
  die zu hohe Ausdruckszeile, die überlaufende Klammerzeile – fielen erst auf,
  weil man sie sehen konnte.
- **Spezifikationen auf Deutsch**, passend zu den beiden v1-Dokumenten.
- **Branch:** `claude/zahlenkoenig-v2-planning-jcsi4d`, PR #1.
  Runde 3: `claude/v2-docs-missing-requirements-2pybh9`.
  Runde 5: `claude/v2-pwa-requirements-qs1xi7`.

---

## 11. Nebenbefunde aus v1

Nicht von v2 verursacht, aber beim Lesen aufgefallen. Alle drei sind in Runde 3
erledigt – zwei davon anders als zunächst gedacht:

| Befund | Stand |
|---|---|
| **Standard-Level ist F2.1** | Ein neuer Spieler landete direkt auf dem ersten Level mit Klammern, ohne A1–A3 gespielt zu haben. **Seit Runde 4 gegenstandslos:** es gibt keine Level mehr (Abschnitt 8). Die Vorgabe ist eine Auswahl, und ihr unterstes Zielband kommt ohne Block aus. |
| **`puzzles-F2-3.json` enthält nur 35 Rätsel** | **Falsch diagnostiziert.** Es sah nach Nachlässigkeit aus, ist aber die Obergrenze der Aufgabe: für drei Zahlen mit Zielen 101–162 existieren überhaupt nur 60 lösbare Paare. Erschöpfende Generierung hebt 35 auf 60 – mehr gibt es nicht. Wiederholung ließe sich nur über den Zielbereich vermeiden. |
| **`levelId` der Bank (`E1-3`) passt nicht zu `LEVELS` (`E1.3`)** | **Erledigt, indem beide Seiten verschwinden:** das Feld entfällt aus dem Datensatz, und mit `maxHintsPerGroup` entfällt der einzige Ort, an dem der Fehler wirkte. |

Neu in Runde 3 dazugekommen, und gewichtiger als alle drei: **v1s Generator kennt
v2s Gruppenmodell nicht** (Abschnitt 6), und **v2 hebt den Unterschied zwischen
F3 und E1 auf** – die einzige noch offene PO-Frage.
