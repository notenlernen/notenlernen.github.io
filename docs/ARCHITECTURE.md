# Architektur
Statische PWA mit TypeScript strict und Vite, modularer UI, Musikdomäne, Trainingsengine, Audio, Statistik/Storage und Service Worker. Keine Serverkomponenten. GitHub Pages am Root der Organisationsdomain. Abhängigkeiten lokal bündeln und per Lockfile fixieren. Notenmodell trennt diatonische Schreibweise, Oktave und chromatische Tonhöhe; enharmonische Schreibweisen nicht unzulässig zusammenlegen. Notenrendering mit lokal gebündelter Notensatzbibliothek oder geprüftem SVG.
## Datenmodell
IndexedDB versioniert: settings, attempts (ID, Runde, Session, Zeitpunkt, Modus, Fragekategorie, Ergebnis, Antwortdauer), round summaries, adaptive profiles, reset epochs pro Modus und Ebene. Tages-/Sessionreset setzt unabhängige Filtergrenzen, ohne historische Versuche zu löschen. Langzeitreset entfernt betroffene historische Daten und Profile; aktuelle Tages-/Sessionaggregate separat halten, damit unabhängige Resets möglich sind. Gesamtreset löscht alle Statistikstores, Einstellungen bleiben. Transaktionen und Schema-Migrationen atomar. Keine Netzwerkübertragung von Trainingsdaten. Backupformat versionieren, Import validieren und vor Ersetzen bestätigen.
## PWA
Manifest, Icons, versionierte Caches, vollständiger Offline-Download inklusive Audio mit Statusanzeige. Service-Worker-Update erst nach Zustimmung außerhalb aktiver Runde; Cachewechsel ohne IndexedDB-Löschung. Audio erst nach Nutzerinteraktion starten. Samples samt Lizenz und Attribution lokal ausliefern.

## Implementierter Stand M0

`src/main.ts` verbindet die per Hash verlinkten Ansichten, die Darstellung und die Browser-APIs. `src/storage.ts` eröffnet Datenbankversion 1 und gibt bei einem Versionswechsel die Verbindung frei. Die Schemaerstellung läuft in der IndexedDB-Upgrade-Transaktion. M0 liest und schreibt ausschließlich den Darstellungsschlüssel im Store `settings`. Die Stores für Versuche, Rundenzusammenfassungen, adaptive Profile, Resetgrenzen und unabhängige Session-/Tagesaggregate bilden die Grundlage für die fachlichen Folgemeilensteine.

Das Build-Skript erzeugt `version.json` und einen Worker mit Hash im Dateinamen. Ein verfügbarer Build bleibt bis zur Bestätigung separiert. Die alte Shell bleibt bei einem fehlgeschlagenen Download nutzbar. Der bestätigende Tab lädt nach dem Controllerwechsel neu. Bereits geöffnete andere Tabs bleiben bis zur eigenen Navigation auf ihrer geladenen Oberfläche. Vor Einführung von Trainingsrunden muss der bestehende Freigabepunkt an den tatsächlichen Rundenstatus über alle Tabs angebunden werden. Geprüfte Audioassets und deren vollständiger Offline-Download folgen in M3.

## Implementierter Stand M1

`src/music.ts` enthält das Notenmodell, die Tonarten und den injizierbaren Zufallsgenerator. `src/round.ts` wertet Antworten, Zeitgrenzen und die Rundensumme anhand übergebener Zeitpunkte aus. `src/trainer.ts` verbindet beide Module mit dem Formular und dem SVG-Notensatz aus `src/notation.ts`. `src/round-lock.ts` synchronisiert aktive Runden und Service-Worker-Updates über Tabs hinweg. Der IndexedDB-Stand aus M0 bleibt gültig.

## Implementierter Stand M2

`src/intervals.ts` trennt diatonische Schrittweite und chromatischen Abstand. Der Generator wählt zuerst die Intervallzahl und danach eine der darstellbaren Qualitäten und Schreibweisen. `src/notation.ts` stellt das Paar als zwei aufeinanderfolgende Noten eines Takts dar. Notennamen und visuelle Intervalle teilen sich den Rundendialog und die Updatesperre. Die Navigation lässt eine begonnene Runde im ursprünglichen Trainingsbereich weiterlaufen.

## Implementierter Stand M3

`src/ear.ts` erzeugt klingende Intervallfragen und wählt Aufnahmen nach MIDI-Tonhöhe. `src/piano.ts` dekodiert die lokalen Dateien einmal pro Tab und plant beide Tonereignisse mit Web Audio. Der bestehende Rundendialog startet den Antwort-Countdown nach der ersten vollständigen Wiedergabe. Statistikpersistenz folgt in M4.

## Implementierter Stand M4

IndexedDB-Schema 2 ergänzt Modusindizes für Versuche, Runden und adaptive Profile. `src/statistics.ts` schreibt Versuch, Session- und Tagessumme in einer Transaktion. Eine Rundensumme wird nur für vollständig gespeicherte Runden angelegt. Session und Tag sind getrennte Aggregate, der Langzeitverlauf liest die historischen Antworten. `src/backup.ts` exportiert ein versioniertes Statistikformat und ersetzt validierte Daten in einer gemeinsamen Transaktion. `src/statistics-ui.ts` verbindet die Ansicht, Bestätigung und Aktualisierung zwischen Tabs. Schreibvorgänge bleiben lokal.

## Implementierter Stand M5

`src/adaptive.ts` bildet je Modus und Kategorie Antwortzähler und gewichtet einen begrenzten Satz gültiger Fragen aus den bestehenden Generatoren. IndexedDB-Schema 3 erzeugt die initialen Profile aus der vorhandenen Historie. Danach werden Profile, Versuche und Session-/Tagesaggregate atomar aktualisiert. Die Backupversion bleibt kompatibel. Fehlende Profile älterer Backups werden beim Import aus enthaltenen Antworten rekonstruiert.

## Implementierter Stand M6

Die Sprachwahl ändert die Anzeige von Texten und Notenbezeichnungen. Musikmodell, Antwortwertung und gespeicherte Schlüssel behalten ihr bisheriges Format. Der visuelle Trainer lädt den Notensatz als eigenes Modul. Der Service Worker speichert dieses Modul mit den übrigen Offline-Dateien. Nach einem bestätigten Wechsel des Service Workers laden kontrollierte Tabs ohne aktive Runde ihre Oberfläche neu.
