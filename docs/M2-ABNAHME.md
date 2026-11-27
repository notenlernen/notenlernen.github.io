# Abnahme M2

Der visuelle Intervalltrainer verwendet zwei aufeinanderfolgende Noten im gewählten Schlüssel und in der gewählten Tonart. Der Grundmodus fragt die Intervallzahl von Prime bis Oktave ab. Der erweiterte Modus fragt zusätzlich die Qualität ab. Die Richtung bezieht sich auf die Reihenfolge der Noten von links nach rechts. Die reine Prime und enharmonisch gleich klingende verminderte Sekunden sind Grenzfälle ohne Tonhöhenänderung. Die Aufgabe bleibt anhand der Schreibweise lösbar.

- Die diatonische Distanz bestimmt die Zahl. Der chromatische Abstand legt die Qualität innerhalb dieser Zahl fest. Die Fixtures prüfen unter anderem zwei verschieden notierte Tritoni, Primvarianten, Oktavgrenzen und gleiche Tonhöhen bei verschiedener Schreibweise.
- Der Generator prüft die gewählte Richtung bei der Erzeugung. Tests decken alle Tonarten, beide Schlüssel, beide Richtungen, acht Intervallzahlen, fünf Qualitäten und vier eindeutige Antwortoptionen ab.
- Vorzeichen der ersten Note gelten beim erneuten Auftreten auf derselben Position im selben Takt. Die zweite Note erhält ein Auflösungszeichen oder neues Vorzeichen, wenn die Schreibweise es verlangt.
- Die Browser-Matrix umfasst beide Intervallmodi, zwei SVG-Noten, eine korrekte Antwort mit Rundenauswertung und den Wechsel zwischen Bereichen bei laufender Runde. Die M0- und M1-Browsertests bleiben Teil der Abnahme.

## Offene Punkte

Zusammengesetzte Intervalle oberhalb der Oktave sind eine optionale Erweiterung. Doppelte Vorzeichen kommen in M2 nicht vor. Gehörtraining, englische Oberfläche, Statistik und Adaptivität folgen in späteren Schritten. Physische Geräte wurden in der Linux-Testumgebung nicht geprüft. Die verifizierten lokalen und CI-Ergebnisse stehen im Pull Request.
