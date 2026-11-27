# Abnahme M1

Die Übungen verwenden deutsche Notennamen. Dur und Moll enthalten jeweils 15 einzeln wählbare Tonarten. Schnellwahlen ersetzen die aktuelle Auswahl. Die Lesebereiche liegen bei C4–A5 im Violin- und E2–E4 im Bassschlüssel. Jede Notenfrage ist eine eigenständige Aufgabe, daher gilt ein explizites Vorzeichen für diese Note. Die auswählbaren benutzerdefinierten Grenzen sind 1–1.000 Aufgaben und 1–3.600 Sekunden.

- Musik-Fixtures prüfen Tonartvorzeichen, H/B, Oktavgrenzen und die Trennung enharmonischer Schreibweisen. Der reproduzierbare Generatorlauf prüft alle 60 Kombinationen aus Tonart und Schlüssel auf vier eindeutige Optionen.
- Die Rundentests prüfen Antwortzeiten, Doppelantworten, den Ablauf der Zeitgrenze und den Ausschluss von Timeouts aus der Berechnung der Antwortzeiten.
- Playwright prüft die 30 UI-Optionen, Schnellwahl, Notensatz einer Bassnote mit sechs Kreuzen, Hilfslinie und abweichendem Vorzeichen, Tastaturantwort und Rundenauswertung. Die Suite prüft auch, dass eine Runde in einem anderen Tab die Update-Aktivierung sperrt.
- Der bestehende Offline-, Update- und IndexedDB-Prüfumfang aus M0 ist weiterhin Teil der Browser-Matrix. Die tatsächlichen Ergebnisse stehen im Pull Request.

## Offene Punkte

- Physische Android- und iOS-Geräte sowie separate Windows- und macOS-Installationen wurden in der Linux-Umgebung nicht geprüft.
- Nach dem M0-Merge meldete GitHub Actions ein erfolgreiches Deployment. Die öffentliche Seite lieferte weiterhin Quell-HTML, während `/version.json` und `/manifest.webmanifest` HTTP 404 lieferten. GitHub Pages war parallel für klassische Builds konfiguriert. Der verfügbare API-Zugang konnte die Pages-Quelle nicht ändern (HTTP 403). Eine Person mit Repository-Adminrechten muss die Quelle auf GitHub Actions stellen und danach den M0-Workflow erneut ausführen. [M0-Deployment](https://github.com/notenlernen/notenlernen.github.io/actions/runs/45966376224)
- Die Visualisierung verwendet VexFlow mit gebündelten Schriften. Vite meldet einen größeren JavaScript-Chunk (rund 480 kB gzip). Optimierung und Messung auf Mobilgeräten bleiben Teil der Performance-Abnahme.
- Englische Oberfläche, visuelle Intervalle, Gehörtraining, persistente Statistik, Backup und Adaptivität folgen separat.
