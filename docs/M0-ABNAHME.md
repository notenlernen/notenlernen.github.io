# Abnahme M0

## Lokale Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Abhängigkeiten, Lint, Typecheck und Produktionsbuild | `npm ci`, `npm run lint`, `npm run typecheck` und `npm run build` bestanden. |
| Unit und IndexedDB-Integration | `npm test` bestanden, 3 Tests. Geprüft wurden Validierung, Anlage des Schemas, Persistenz beim erneuten Öffnen und ein simulierter Versionswechsel. |
| Browser-Matrix | `npm run test:e2e` bestanden, 15 Tests, je 5 in Chromium, Firefox und WebKit. Geprüft wurden Tastatur, Fokus, System-/Hell-/Dunkeldarstellung, Touch, kleine Viewports in Hoch- und Querformat, Manifest mit Icons und Offline-Start in einem neuen Tab. |
| Bestätigtes Update | In allen drei Browsern blieb die alte Oberfläche nach dem Schließen des Tabs ohne Zustimmung und nach einem fehlgeschlagenen Download erhalten. Nach Zustimmung und erfolgreichem Download startete die neue Shell auch offline. Die Darstellung und ein Testversuch in IndexedDB blieben erhalten. |
| Installierbarkeit auf Linux Desktop | Chromium meldete keine Installationsfehler. Chrome for Testing 159 zeigte im grafischen Linux-Test den Installationsdialog und erzeugte einen Desktop-Starter. Nach Beenden des Browsers und Stoppen des Webservers startete die installierte App über ihre App-ID im Standalone-Modus mit der zuvor gespeicherten Darstellung. |

Getestet wurde mit Node.js 24.22.3 und Playwright 1.65.1. Im verwalteten lokalen Testsystem lagen Firefox-Profildaten in beschreibbaren XDG-Verzeichnissen. Für den lokalen Firefox-Lauf gegen Loopback wurde die innere Content-Sandbox wegen des schreibgeschützten `/proc/self/uid_map` deaktiviert. WebKit nutzte lokal entpackte Debian-Laufzeitbibliotheken, die über den lokalen Loader erreichbar waren. GitHub Actions installiert die Browser-Systemabhängigkeiten regulär und verwendet die Standard-Browserkonfiguration.

## Offene Abnahmen und Folgemeilensteine

- Auf physischen Android- und iOS-Geräten stehen Installieren, Standalone-Start und Offline-Neustart aus. Linux-WebKit und emulierter Touch zählen als Browserprüfungen. Windows und macOS wurden separat noch nicht geprüft.
- In den Repository-Einstellungen ist Pages derzeit auf klassische Veröffentlichung eingestellt. Für das erste produktive Deployment muss die Source auf GitHub Actions umgestellt werden. Der erfolgreiche `main`-Check, das tatsächliche Deployment und der HTTPS-Smoke-Test auf der Organisationsdomain sind erst mit der Veröffentlichung prüfbar. Der PR-Check und sein Ergebnis werden im Pull Request festgehalten.
- M1 bis M5 liefern Notensatz und Training, Rundenauswertung, visuelle und gehörte Intervalle, lizenzierte Samples mit Offline-Audio, Statistik, Resets, Backup und Adaptivität. Die englische Oberfläche steht ebenfalls aus.
- Sobald Runden aktiv sein können, muss die Update-Freigabe den Status über alle offenen Tabs berücksichtigen. Schema 1 führt keine Datenmigration aus. Jeder spätere Schemawechsel benötigt Tests mit Daten der Vorgängerversion.
- Die CI führt jede Prüfung einmal pro relevantem Stand aus. Abgerechnete Minuten hängen vom Runner, den verfügbaren Caches und dem tatsächlichen Workflow-Lauf ab. Eine belastbare Vergleichsmessung setzt mehrere vergleichbare GitHub-Läufe voraus.

[Technische Entscheidungen](DECISIONS.md) · [Teststrategie](TEST_STRATEGY.md)
