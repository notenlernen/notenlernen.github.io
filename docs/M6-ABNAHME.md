# Abnahme M6 · Version 1.0.0

Die Veröffentlichung umfasst Deutsch und Englisch, drei Trainingsmodi, adaptive Auswahl, lokale Statistik und Offline-Audio. Die Sprachwahl bleibt im lokalen Webspeicher. Antworten und Statistikschlüssel werden weiterhin in ihrem sprachunabhängigen Datenformat gespeichert. Beim Wechsel auf Englisch erscheinen englische Tonbezeichnungen wie B und B♭. Deutsch unterscheidet H und B.

## Browser und Geräte

| Umgebung | Abnahme |
| --- | --- |
| Chromium, Firefox und WebKit unter Linux | Automatisierte Browser-Matrix mit Tastaturfokus, Touch-Emulation, kleinem Hoch- und Querformat, Training, Offline-Start, Audio, Update, IndexedDB, Backup, Sprachwahl und Ressourcentests. |
| Chromium und WebKit unter Linux | Axe-Prüfung nach WCAG-2.0-/2.1-A/AA-Regeln für Einrichtung, aktive Runde im dunklen Design und Statistik. Die automatisierte Axe-Prüfung stürzte im lokalen Firefox-Testprozess ab. Die funktionalen Firefox-Prüfungen liefen separat. |
| Grafischer Linux-Desktop · Chrome for Testing 159 · virtuelle Anzeige | Installation über Chromes Installationsdialog. Nach vollständigem Browserneustart und gestopptem Webserver öffnete sich die installierte App im Standalone-Modus. Englische Oberfläche, nachgeladener Notensatz und Statistik waren offline verfügbar. |
| Physisches Android und iOS | Installieren, Standalone-Neustart und Lautsprecherausgabe bleiben unbestätigt. Die Linux-Tests mit Browser-Engine, Touch-Emulation und virtuellem Audioausgang ersetzen diese Geräteprüfungen nicht. |
| Windows und macOS | Installations- und Desktop-Integration wurden nicht direkt geprüft. WebKit unter Linux ist kein Test von Safari auf einem Mac. |

Axe deckt automatisierbare Regeln ab. Screenreader auf realen Geräten und die vollständige Barrierefreiheitsprüfung wurden nicht durchgeführt. Visuelle Notenaufgaben benötigen das Lesen der Notenschrift. Die Grafik erhält einen lokalisierten Namen mit Schlüssel und Tonart. Der Tonname selbst bleibt Teil der Aufgabe.

## Ladezeit und Offline-Verhalten

Der Notensatz wird erst mit einer visuellen Runde geladen. Der initiale JavaScript-Einstieg sank im Vite-Produktionsbuild von rund **489 kB gzip auf 16 kB gzip**. Die zusätzliche Notensatzdatei belegt rund 474 kB gzip. Der vollständige Offline-Download enthält weiterhin Notensatz, Schriften, Klavieraufnahmen und Hinweise. Das Laden des Einstiegs ist damit entkoppelt, während die Gesamtgröße des Offline-Caches in derselben Größenordnung bleibt.

Der Browsertest verifiziert, dass die Benutzeroberfläche den Notensatz erst bei Bedarf anfordert, dass der JavaScript-Einstieg unter 65 KiB unkomprimiert bleibt und dass die App während des geprüften Ablaufs nur lokale Webressourcen anfragt. Ein bestätigtes Update lädt bereits geöffnete Tabs neu, sobald der Service Worker wechselt. Die Rundensperre schützt aktive Übungen und gespeicherte Antworten.

## Datenschutz und Lizenzen

Der Produktionsablauf verwendet keine Konten, Werbung, Telemetrie oder externen Laufzeitdienste. Die App speichert Trainingsdaten lokal in IndexedDB und überträgt sie nicht. Hinweise zur Browser-Speicherung, zu GitHub Pages und zu Drittanbieter-Lizenzen sind auch offline in der App verlinkt. [Datenschutz und Lizenzen](https://notenlernen.github.io/datenschutz.html)

| Bestandteil | Lizenznachweis |
| --- | --- |
| VexFlow 5.11.0 | MIT, mitgelieferte Lizenz |
| structured-clone-es 1.0.0 | ISC, mitgelieferte Lizenz |
| Bravura und Academico | SIL OFL 1.1, mitgelieferte Schriftlizenzen |
| Salamander Grand Piano v3 | CC BY 3.0 mit Namensnennung, fixierter Quelle und dokumentierten Änderungen |
| App-Icons und weitere Grafiken | Für das Projekt erstellt. Die Oberfläche nutzt zusätzlich Systemschriften. |

`npm audit --omit=dev` meldete zum Prüfzeitpunkt keine bekannten Schwachstellen im Produktions-Abhängigkeitsbaum. Die Test- und CI-Ergebnisse für den freigegebenen Build stehen im Pull Request.
