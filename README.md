# Notenlernen

Kostenloser, werbefreier Noten- und Intervalltrainer als responsive Offline-PWA für Smartphone, Tablet und PC. Trainingsdaten bleiben im Browserprofil. Die Anwendung benötigt weder ein Konto noch einen Server für Trainingsdaten.

Zieladresse [notenlernen.github.io](https://notenlernen.github.io/)

## Status

Version 0.1.0 legt mit M0 das technische Fundament. Die Startoberfläche verbindet die drei vorgesehenen Trainingsbereiche und die Statistik. Sie speichert die Darstellung (Hell, Dunkel oder System) lokal. Die Navigation weist auf den jeweiligen Folgemeilenstein hin.

## Lokal entwickeln

Mit Node.js 24 LTS und npm im Repository ausführen.

```sh
npm ci
npm run dev
```

Der Entwicklungsserver registriert keinen Service Worker. Für die installierbare Offline-Shell einen Produktionsbuild erzeugen und die Vorschau auf einem separaten lokalen Port öffnen.

```sh
npm run build
npm run preview
```

Die Vorschau läuft standardmäßig unter `http://localhost:4173`. Für Service Worker und Installation auf einem anderen Gerät ist HTTPS erforderlich. Ein lokaler Dev-Server über eine unverschlüsselte LAN-IP genügt dafür in der Regel nicht.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

Fehlende Linux-Systembibliotheken lassen sich mit `npx playwright install --with-deps chromium firefox webkit` ergänzen. Der E2E-Testserver serviert den fertigen Build aus `dist/` auf lokalen Ports. [Prüfumfang und Abnahme](docs/M0-ABNAHME.md)

## Veröffentlichung und Nutzung

In GitHub unter **Settings → Pages → Build and deployment → Source** für die erste M0-Veröffentlichung **GitHub Actions** auswählen. Der Workflow prüft Pull Requests gegen `main`. Bei einem erfolgreichen Push-Check auf `main` übernimmt die Pages-Veröffentlichung genau das getestete Artefakt. Vite, Manifest und Service Worker verwenden den Root-Pfad der Organisationsdomain.

Die Shell ist nach dem ersten vollständigen Download auf demselben Ursprung und im selben Browserprofil offline verfügbar. Die Statusanzeige meldet, wann der Service Worker die Seite kontrolliert. Für ein Update online **Nach Updates suchen** und anschließend **Update anwenden** wählen. Die Einstellung zur Darstellung bleibt erhalten.

Die Installation hängt von Browser und Betriebssystem ab. Chromium-basierte Browser können eine Installationsoption anbieten. Auf iOS erfolgt die Installation über Safaris Teilen-Menü und **Zum Home-Bildschirm**. Firefox-Desktop wurde für die Website und Offline-Funktion vorgesehen. Einschränkungen wie privates Surfen, Speicherbereinigung und Browserprofile können Installation, Cache und lokale Einstellungen beeinflussen. Das Löschen der Websitedaten entfernt gegebenenfalls lokale Daten. Zwischen Geräten findet keine Synchronisierung statt.

## Projektdokumentation

- [Anforderungen](docs/REQUIREMENTS.md)
- [Architektur](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Teststrategie](docs/TEST_STRATEGY.md)
- [Architekturentscheidungen und Lizenzstrategie](docs/DECISIONS.md)
- [Arbeitsauftrag M0](docs/M0.md)
- [Abnahme und offene Punkte M0](docs/M0-ABNAHME.md)
- [Entwicklungsregeln](AGENTS.md)
- [Changelog](CHANGELOG.md)
