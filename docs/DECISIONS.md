# Architekturentscheidungen
- ADR-001: Statische PWA statt nativer Android-App; gemeinsame responsive Codebasis.
- ADR-002: Öffentliches Organisationsrepository und GitHub Pages; keine eigene Domain erforderlich.
- ADR-003: Ausschließlich lokale IndexedDB, keine Konten, Cloud, Telemetrie oder Backend.
- ADR-004: Unabhängige Session-/Tages-/Langzeitresets; Gesamtreset und Modusfilter; Einstellungen bleiben.
- ADR-005: TypeScript strict und Vite; lokale Laufzeitassets; Frameworkwahl und Notensatzbibliothek in M0 begründen.
- ADR-006: Frei lizenzierte natürliche Klaviersamples, Lizenznachweis vor Veröffentlichung.
- ADR-007: Lokaler Backup-Export/Import vorgesehen, keine automatische Synchronisierung.

## Konkretisierung für M0

- ADR-005: Die kompakte Shell nutzt Vite, TypeScript und DOM-APIs. Damit bleiben die Laufzeitabhängigkeiten auf die Browser-APIs begrenzt. Für M1 wird VexFlow als lokal zu bündelnde Notensatzbibliothek geprüft. Die Einführung hängt von Fixtures für Hilfslinien, Vorzeichen, Tonartvorzeichnungen, beide Schlüssel und enharmonische Schreibweisen sowie der Prüfung des Lizenzhinweises für die gewählte Version ab. Die Entscheidung über die Aufnahme fällt mit den M1-Fixtures.
- ADR-006: M0 liefert eigens für die Shell erstellte App-Icons und verwendet Systemschriften. Vor Aufnahme fremder Assets werden Ursprung, Version, Lizenz, Weitergaberecht und erforderliche Attribution erfasst. M3 liefert nur geprüfte, frei weiterverteilbare natürliche Klaviersamples gemeinsam mit den zugehörigen Lizenztexten und Credits lokal aus.
- ADR-008: Jeder Build veröffentlicht eine Versionskennung und einen Service Worker mit inhaltsadressiertem Dateinamen. Die Kennung kann online abgefragt werden. Die Registrierung einer neuen Worker-URL erfolgt bei bestehender Installation erst nach Zustimmung. Das verhindert den automatischen Versionswechsel beim Schließen aller Tabs. Beim Download prüft der Worker die SHA-256-Prüfsummen der Shell-Dateien. Erst nach vollständigem Download wechselt der Cache. Der Worker greift nie auf IndexedDB zu.
- ADR-009: Ein Linux-Job nutzt Lockfile-Paketcache, eine Installation und einen Produktionsbuild für alle Prüfungen. E2E führt die vollständige Browser-Matrix auf demselben Build aus. Chromium wird in CI als Headless Shell geladen. Bei Folgeständen eines PR werden überholte Läufe abgebrochen. Push-Checks beschränken sich auf `main`. Nur dort wird das geprüfte Pages-Artefakt hochgeladen. Der separate Deploy-Job erhält ausschließlich die nötigen erhöhten Rechte.

## Konkretisierung für M1

- ADR-005: VexFlow 5.11.0 mit Bravura rendert die Noten lokal als skalierbares SVG. Die Fixtures prüfen die Tonarten, enharmonische Schreibweisen und die sichtbare Kombination aus Bassschlüssel, Vorzeichnung, Vorzeichen und Hilfslinie. VexFlow, die Schriftlizenzen und der Hinweis zur transitiven Laufzeitabhängigkeit liegen im Build unter `/licenses/`.
- ADR-010: Der Notengenerator unterscheidet Buchstabe, Oktave und Alteration. Aufgaben nutzen die Vorzeichnung der ausgewählten Tonart. Ein Teil der Noten erhält ein explizites Kreuz, Be oder Auflösungszeichen. Die Antwort nennt die notierte Tonklasse auf Deutsch.
- ADR-011: Runden nutzen eine monotone Uhr. Die letzte Wertung beendet die gemessene Rundendauer. Timeouts zählen zu den falschen Antworten und bleiben bei den Antwortzeiten außen vor. Runden bleiben bis M4 im Arbeitsspeicher. Web Locks schützen aktive Runden über Tabs hinweg vor einem bestätigten Update. Browser ohne Web Locks können trainieren, aber in M1 keine Updates über die Oberfläche anwenden.
- ADR-012: Der Veröffentlichungsjob verifiziert vor dem Deploy die GitHub-Actions-Quelle und danach die öffentliche Build-Kennung. Beim M0-Merge liefen klassisches Pages und der Actions-Deploy parallel. Trotz erfolgreichem Workflow meldete die öffentliche URL 404 für die Build-Kennung. Das API-Konto konnte die Repository-Einstellung nicht ändern.

## Konkretisierung für M2

- ADR-013: Intervallfragen erzeugen zwei notierte Einzelnoten innerhalb eines Takts. Die Position auf dem System und die klingende Tonhöhe bleiben getrennt. Prime und enharmonische Grenzfälle folgen ihrer Schreibweise.
- ADR-014: Der M2-PR basierte während der Entwicklung auf dem offenen M1-Branch. Nach dem M1-Merge wurde er auf `main` umgestellt. Die Prüfpipeline läuft für PRs gegen `main`. Nur Pushes auf `main` können veröffentlichen.

## Konkretisierung für M3

- ADR-006: Sieben Aufnahmen aus Salamander Grand Piano v3 decken mit maximal einem Halbton Verschiebung den Bereich A3 bis Es5 ab. CC-BY-Attribution und Lizenzdatei liegen unter `/licenses/`. [Herkunft, Umwandlung und Prüfungen](M3-ABNAHME.md)
- ADR-015: Das Gehörtraining fragt klingende Halbtonabstände ab. Der Tritonus erhält eine eindeutige Hörbezeichnung. Klaviersamples werden vom Service Worker gemeinsam mit dem Build vorgehalten. Web Audio startet beim expliziten Abspielen der Frage.
