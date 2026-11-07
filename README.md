# Portfolio Jan Schober

Persönliche Portfolio-Seite mit reinem HTML, CSS und JavaScript, öffentlich auf GitHub Pages:
https://schoberjan.github.io/portfolio-page/

## Aufbau

| Datei | Aufgabe |
| --- | --- |
| `index.html` | Inhalt und Struktur der Seite |
| `styles.css` | Design-System als Custom Properties, Layout mobile-first |
| `js/main.js` | Einstieg, startet alle Module |
| `js/f1-api.js` | Zugriff auf die F1-API mit Caching und Pagination |
| `js/f1-countdown.js` | Rennkalender, Countdown und Podium |
| `js/circuit-map.js` | Streckenform des gewählten Rennens |
| `js/f1-chart.js` | Punktediagramm mit D3.js und Teamduell |
| `js/f1-telemetry.js` | Live-Daten im Startbereich |
| `js/car-explorer.js` | Klickbares F1-Auto bei «Über mich» |
| `js/header.js`, `js/navigation.js`, `js/scroll-spy.js`, `js/footer.js` | Kopfzeile, Menü, aktiver Abschnitt, Jahreszahl |

## Daten

- **Quelle:** [Jolpica-F1-API](https://api.jolpi.ca/ergast/f1), Streckenformen aus [f1-circuits](https://github.com/bacinger/f1-circuits).
- **Datenkombination:** Das Diagramm führt Wertung, Rennkalender, Rennergebnisse, Sprints und Qualifying zusammen.
- **Caching:** Antworten liegen mit Zeitstempel eine Stunde im `localStorage`. Fällt die API aus, dient ein abgelaufener Eintrag als Ersatz.
- **Pagination:** Lange Ergebnislisten werden über `limit` und `offset` seitenweise geladen.
- **Rate-Limit:** Höchstens 4 Anfragen pro Sekunde, gleichzeitige gleiche Anfragen werden zusammengelegt.

## Warum ohne Authentifizierung

Die Seite verzichtet bewusst auf Authentifizierung. Die F1-API ist öffentlich und verlangt keinen Schlüssel, und die Seite speichert keine Daten von Besuchern. Zudem läuft sie als statische Seite ohne Server: Jeder Schlüssel im Code wäre im öffentlichen Repository für alle lesbar.

## Lokal starten und testen

Die Seite braucht wegen der ES-Module einen lokalen Webserver, zum Beispiel:

```bash
npx serve .
```

Tests:

```bash
node --test "js/*.test.js"
```
