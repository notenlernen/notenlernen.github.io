# Teststrategie
Unit: Tonarten, deutsche Notennamen, Vorzeichen, Oktaven, Intervalle, Generator, eindeutige Optionen, Timer und Timeout-Auswertung. Deterministische Zufallsquelle und injizierbare Uhr. Integration: IndexedDB, unabhängige Reset-Ebenen, Modusfilter, Tageswechsel, Migrationen, Backup und Rollback. E2E: Training, Tastatur/Touch, responsive Viewports, Offline-Neustart, Update ohne Datenverlust, Audio nach Nutzerinteraktion. Browser Chromium, Firefox, WebKit; reale Android/iOS-Installation und Desktop separat prüfen, Emulation nicht als reale Geräteabnahme ausgeben. CI: npm ci, Lint, Typecheck, Unit/Integration, Build und E2E; Cache für Paketdownloads, keine redundanten Läufe, Deployment nur nach erfolgreichen Checks auf main. Keine Qualitätsabsenkung zur Laufzeitoptimierung.

## Umsetzung in M0

Die Node-Tests prüfen die Theme-Validierung, das IndexedDB-Schema und den Erhalt von Einstellungen bei erneutem Öffnen und einem simulierten Versionswechsel. Playwright prüft den Produktionsbuild in Chromium, Firefox und WebKit. Die Suite deckt Tastaturfokus, Touch-Navigation im Hoch- und Querformat, Manifest und Icons, Offline-Neustart und ein Update zwischen zwei Buildständen ab. Der Update-Test prüft ausdrücklich den Abschluss aller Tabs ohne Zustimmung, einen fehlgeschlagenen Download und den Erhalt von Einstellungen und Testversuchen. Chromium prüft zusätzlich die Installierbarkeit über das DevTools-Protokoll. Reale Geräte und die Installation als eigenständige Desktop-App werden separat ausgewiesen. [M0-Abnahme](M0-ABNAHME.md)

## Umsetzung in M1

Die Tests ergänzen deterministische Musik- und Timer-Fixtures sowie drei Browserfälle je Engine. Das [M1-Abnahmeprotokoll](M1-ABNAHME.md) hält Umfang, Betriebsprüfung und verbleibende Geräteprüfungen fest.

## Umsetzung in M2

Deterministische Fixtures prüfen Intervallzahl, Qualität, Richtung, Wiederholung von Vorzeichen im selben Takt und Eindeutigkeit der Antworten. Ein Browserfall pro Engine führt beide Modi und den Bereichswechsel während einer aktiven Runde aus. [M2-Abnahmeprotokoll](M2-ABNAHME.md)

## Umsetzung in M3

Unit-Tests validieren die chromatischen Hörintervalle, Sample-Wiedergaberaten und WAV-Grundfrequenzen. Je Browser prüft ein E2E-Fall die nutzerinitiierte Offline-Wiedergabe mit echten AudioBuffer-Quellen, Wiederholung und Auswertung. [M3-Abnahmeprotokoll](M3-ABNAHME.md)

## Umsetzung in M4

Die Integration prüft die Migration von Schema 1, atomare Speicherung, Modus- und Reset-Isolierung, Kalendertag, Backup-Validierung und Rollback. Die Browser-Matrix prüft Persistenz nach Reload und die bestätigte Wiederherstellung per lokaler Datei. [M4-Abnahmeprotokoll](M4-ABNAHME.md)
