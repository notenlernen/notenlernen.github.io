# Abnahme M5

„Adaptiv trainieren“ ist beim Laden der App ausgeschaltet und lässt sich vor jeder Runde wählen. Alle gewerteten Antworten verbessern das lokale Übungsprofil des jeweiligen Modus, auch in Standardrunden. Ein Timeout zählt als Fehler. Notennamen werden nach geschriebener Tonklasse gruppiert, visuelle Intervalle nach Intervallzahl und Hörintervalle nach Halbtonabstand.

Sobald ein Profil Fehler enthält, erzeugt die Auswahl acht lösbare Kandidaten aus dem bestehenden Fragegenerator. Sie gewichtet jeden Kandidaten mit `1 + 4 × Fehler / (Antworten + 4)`. Die vier zusätzlichen Beobachtungen im Nenner begrenzen frühe Ausschläge. Auch wenig geübte und sicher beantwortete Kategorien behalten eine Auswahlchance. Der Kaltstart und Profile ohne Fehler verwenden die Standardauswahl. Tonarten, Schlüssel, Intervallmodus und Richtung stammen unverändert aus der Rundenauswahl.

Die Statistik zeigt bis zu zwölf Übungsschwerpunkte je aktueller Filterung. Eine Kategorie erscheint ab drei beantworteten Aufgaben mit mindestens einem Fehler. Die Reihenfolge nutzt die geglättete Fehlerrate. Die angezeigte Quote gibt die beobachteten Fehler wieder. Die Anzeige wird bei neuen Antworten aktualisiert. Eine laufende Runde startet mit dem gespeicherten Profil und ergänzt darin ihre eigenen Antworten. Parallel laufende Tabs lesen neue Fremddaten erst beim nächsten Rundenstart.

## Daten und Prüfungen

- Datenbankschema 3 erstellt die ersten Profile aus bestehenden M4-Antworten in der Upgrade-Transaktion. Langzeit- und Gesamtreset entfernen die betroffenen Profile. Session- und Tagesreset behalten sie.
- Das JSON-Backup behält Version 1 und enthält Profile im dafür vorgesehenen Store. Beim Import älterer M4-Backups werden fehlende Profile aus den mitgesicherten Antworten aufgebaut.
- Deterministische Tests prüfen Kaltstart, Häufigkeit, Auswahlgrenzen, eindeutige Antworten, Filterbindung und Timeout-Auswertung. Integrationstests prüfen Migration, Backup und getrennte Resets.
- Die Browser-Matrix prüft das Aktivieren einer adaptiven Runde, das Erscheinen eines Schwerpunkts, Modusfilter und die Wirkung von Session- und Langzeitreset. CI-Ergebnisse stehen im PR.
- Die Wirksamkeit des Trainings auf den Lernerfolg und physische Geräte waren in diesem Meilenstein nicht Gegenstand der technischen Abnahme.
