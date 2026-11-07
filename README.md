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
| `js/f1-season.js` | Auswahl zwischen laufender und letzter Saison |
| `js/f1-countdown.js` | Rennkalender, Countdown und Podium |
| `js/circuit-map.js` | Streckenform des gewählten Rennens |
| `js/f1-chart.js` | Punktediagramm mit D3.js und Teamduell |
| `js/f1-telemetry.js` | Live-Daten im Startbereich |
| `js/car-explorer.js` | Klickbares F1-Auto bei «Über mich» |
| `js/header.js`, `js/navigation.js`, `js/scroll-spy.js`, `js/footer.js` | Kopfzeile, Menü, aktiver Abschnitt, Jahreszahl |

## Daten

- **Quelle:** [Jolpica-F1-API](https://api.jolpi.ca/ergast/f1), Streckenformen aus [f1-circuits](https://github.com/bacinger/f1-circuits).
- **Datenkombination:** Das Diagramm führt Wertung, Rennkalender, Rennergebnisse, Sprints und Qualifying zusammen.
- **Caching:** Antworten liegen mit Zeitstempel im `localStorage`, die laufende Saison eine Stunde, die abgeschlossene eine Woche. Fällt die API aus, dient ein abgelaufener Eintrag als Ersatz.
- **Pagination:** Lange Ergebnislisten werden über `limit` und `offset` seitenweise geladen.
- **Rate-Limit:** Höchstens 4 Anfragen in 1,2 Sekunden, gleichzeitige gleiche Anfragen werden zusammengelegt. Lehnt die API eine Anfrage ab (Status 429, Sperre von rund 10 Sekunden), pausieren alle Anfragen 12 Sekunden und die abgelehnte wird bis zu zweimal wiederholt.

## Saisonwechsel

**Problem:** Die API führt die laufende Saison unter `current`. Wann dieser Wert auf das neue Jahr wechselt, gibt sie nicht bekannt. Sobald das passiert, gibt es noch keine Ergebnisse: Das Diagramm wäre leer, und die abgeschlossene Saison wäre auf der Seite nicht mehr zu sehen.

**Lösung:** Eine Auswahl neben dem Titel «Formel 1» schaltet Rennkalender und Diagramm zwischen der laufenden und der letzten Saison um. Die letzte Saison berechnet die Seite aus dem Jahr, das `current` meldet. Wechselt die API auf 2027, stehen ohne Änderung am Code 2027 und 2026 zur Auswahl. Der Live-Streifen im Startbereich zeigt immer die laufende Saison.

**Offen:** Nach dem letzten Rennen von 2026 am 6. Dezember gibt es keinen Countdown mehr, bis die API den Kalender 2027 liefert. Am 7. November 2026 lieferte sie für 2027 noch keine Rennen, obwohl der offizielle Kalender bereits veröffentlicht war.

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
