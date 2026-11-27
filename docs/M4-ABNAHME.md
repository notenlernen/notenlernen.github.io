# Abnahme M4

Die Statistik speichert jede gewertete Antwort lokal. Eine fertig ausgewertete Runde erscheint in der Historie. Bereits beantwortete Aufgaben einer abgebrochenen Runde bleiben in den Summen, ohne eine abgeschlossene Runde zu erzeugen. Eine Session gehört zur Registerkarte und bleibt beim Neuladen erhalten. Der Kalendertag entspricht der beim Antworten aktiven lokalen Zeitzone.

Die Ansicht zeigt Session, Tag und Langzeitverlauf getrennt. Sie enthält die letzten 20 abgeschlossenen Runden, die beste Rundenquote, die schnellste richtige Antwort, 14 Trainingstage mit Trefferquoten sowie Fehler nach Modus, Tonart, Schlüssel und Intervall. Der Filter wirkt auf Ansicht und bereichsspezifische Resets. Ein Timeout zählt als falsch und bleibt bei der Antwortzeit außen vor.

| Reset | Wirkung |
| --- | --- |
| Session | Entfernt die Session-Summe der aktuellen Registerkarte für den ausgewählten Modus. |
| Tag | Entfernt die Tagessumme des aktuellen lokalen Datums für den ausgewählten Modus. |
| Langzeit | Entfernt historische Antworten, Runden und adaptive Profile des ausgewählten Modus. Aktuelle Session- und Tagesaggregate bleiben verfügbar. |
| Gesamt | Leert sämtliche Statistikstores für alle Modi. Die Darstellung bleibt gespeichert. |

Jeder Reset erfordert eine Bestätigung. Langzeit- und Gesamtreset sowie Backup-Ersatz verlangen zusätzlich ein Kontrollkästchen. In Browsern mit Web Locks warten Wartungsaktionen auf in allen Tabs beendete Runden. Schreibvorgänge werden atomar durchgeführt. Ein Backup enthält Statistik aller Modi einschließlich ihrer getrennten Summen und Resetstände. Die Datei bleibt lokal und kann keine Darstellungseinstellungen ändern. Der Import validiert Version, Werte, Schlüssel und Rundensummen vor dem bestätigten atomaren Ersatz. Session-Aggregate aus einem anderen Tab bleiben in dessen mitgesicherter Session-ID abgelegt.

## Prüfungen und Grenzen

- Die Migration von Schema 1 auf 2 legt Indizes an und behält bestehende Datensätze und Einstellungen. In früheren veröffentlichten Ständen wurden Trainingsantworten noch nicht dauerhaft geschrieben. Unvollständige Altdaten bleiben bei der Migration erhalten und erscheinen nicht als reguläre Statistik.
- Integrationstests prüfen parallele und idempotente Schreibvorgänge, Modusisolierung, Tageswechsel, unabhängige Resets, ein ungültiges Backup, einen Transaktions-Rollback und erfolgreiche Wiederherstellung.
- Je Browser prüft ein E2E-Test eine gespeicherte Runde, Reload und Filter, Export, bestätigten Langzeitreset sowie bestätigten Import. Ergebnisse und CI-Links stehen im Pull Request.
- Der Statistikverlauf wird bei Bedarf aus der lokalen Historie berechnet. Sehr große Datenbestände sind Teil der späteren Performance-Abnahme. Physische Mobilgeräte und Desktop-Installationen wurden in M4 nicht erneut geprüft.
