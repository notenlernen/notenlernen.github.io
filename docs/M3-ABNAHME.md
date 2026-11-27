# Abnahme M3

Der Hörtrainer bietet alle klingenden Abstände von der Prime bis zur Oktave mit vier Antwortoptionen und aufwärts-, abwärts- oder gemischt gespielten Tonpaaren. Der Grundmodus fasst kleine und große Varianten zusammen. Der erweiterte Modus unterscheidet sie. Sechs Halbtöne heißen im Hörmodus Tritonus. Enharmonische Schreibweisen wären ohne sichtbare Notation oder harmonischen Kontext am Klang allein nicht unterscheidbar.

Die erste Wiedergabe startet mit einer Nutzeraktion. Ein gewähltes Zeitlimit pro Frage läuft ab dem Ende des ersten Hörens. Wiederholungen spielen dieselben beiden Töne und setzen den Timer nicht zurück. Beim Verlassen der Hörübung, beim Antworten oder beim Rundenabbruch endet die laufende Wiedergabe. Das Ergebnis bleibt bis M4 im Arbeitsspeicher.

## Quelle und Verarbeitung

Die Klavieraufnahmen stammen aus **Salamander Grand Piano v3** von Alexander Holm. Die verwendete FLAC-Distribution ist kinwies Remapping, fixiert auf Commit `3382bf9496bba2486f5ab0de55a264d1dfc38404`. Die Aufnahmen stehen unter CC BY 3.0 Unported. Attribution und Lizenztext werden lokal mit den Samples ausgeliefert. [Originalveröffentlichung](https://archive.org/details/SalamanderGrandPianoV3) · [Fixierte Quelle](https://github.com/sfzinstruments/SalamanderGrandPiano/tree/3382bf9496bba2486f5ab0de55a264d1dfc38404) · [Lizenztext](https://creativecommons.org/licenses/by/3.0/)

| MIDI | Quelldatei |
| --- | --- |
| 57 | A3v8.flac |
| 60 | C4v8.flac |
| 63 | D#4v8.flac |
| 66 | F#4v8.flac |
| 69 | A4v8.flac |
| 72 | C5v8.flac |
| 75 | D#5v8.flac |

Die WAV-Dateien ergeben zusammen rund 317 KiB. Halbtöne zwischen Aufnahmen verwenden die jeweils nächste Aufnahme mit einer Verschiebung von höchstens einem Halbton.

```sh
ffmpeg -i <input.flac> -t 1.05 -ac 1 -ar 22050 \
  -af 'afade=t=out:st=0.85:d=0.20' -map_metadata -1 \
  -codec:a pcm_s16le <midi.wav>
```

## Prüfungen und offene Punkte

- Unit-Tests prüfen Antwortoptionen, Richtungen, Abstände, Wiedergaberaten und alle sieben WAV-Grundfrequenzen. Eine zusätzliche FFT-Messung fand maximale Abweichungen von 3,3 Cent zu A4 = 440 Hz.
- Die Browser-Matrix prüft den Neustart ohne Netzwerk, Freigabe nach Klick, zwei tatsächlich geplante Web-Audio-Samplequellen, Wiederholung, Countdown und Rundenauswertung. Ergebnis und CI-Lauf stehen im zugehörigen Pull Request.
- Der Service Worker speichert jedes Sample beim vollständigen Versionsdownload und prüft dessen SHA-256-Hash. Das Statusfeld meldet die Offline-Bereitschaft nach dem vollständigen Cacheaufbau.
- Die Geräteabnahme auf physischem Android und iOS steht aus. Linux verwendet für automatisierte Tests einen virtuellen PulseAudio-Ausgang. Die Browser erzeugen und planen echte AudioBuffer-Quellen, die Prüfungen erfassen jedoch keine physische Lautsprecherausgabe. Die verwaltete lokale Umgebung benötigte für Firefox beschreibbare XDG-Pfade und für den Loopback-Test abweichende Firefox-Sandbox-Einstellungen. GitHub Actions verwendet reguläre Browser-Sandbox-Einstellungen.
