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
