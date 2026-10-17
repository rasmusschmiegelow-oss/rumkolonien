# Rumkolonien

Et hyggeligt spil i browseren, hvor du bygger en koloni på Mars. Du dyrker afgrøder i drivhuskupler, laver varer i bygninger og leverer ordrer til fragtskibe og kolonister.

**Spil her:** https://rasmusschmiegelow-oss.github.io/rumkolonien/

## Det kan spillet

- **Isometrisk kort** som du kan trække i og zoome på (knib eller scroll).
- **Swipe-høst:** Træk fingeren hen over modne kupler for at høste dem alle, eller hen over tomme kupler for at plante igen.
- **15 niveauer** med 10 afgrøder, 11 bygninger og 15 varer i produktionskæder (fx bomuld → stof → rumdragt).
- **Kolonister med historier:** Ida, Bo, Kim og Dina beder om varer og fortæller lidt mere om livet på Mars, hver gang du hjælper dem.
- **Robotter:** Høsterobotten høster og planter igen. Pakkedronen henter færdige varer. De arbejder også, mens du er væk.
- **Begivenheder:** Støvstorme forsinker afgrøderne, med mindre du har et stormskjold. Ved meteorregn kan du samle jernmalm op.
- **Ekspresordrer** med dobbelt belønning og tidsfrist.
- **Lager med begrænset plads**, som kan udvides.
- **Daglig belønning og ugens mål.**
- **Dag og nat:** En sol varer 8 minutter. Solnedgangen er blå på Mars, og kuplerne lyser om natten.
- **Lyd og vibration**, genereret i browseren.
- **Tutorial** de første minutter.

Spillet gemmes automatisk i browseren (`localStorage`).

## Grafik

Alle ikoner er tegnet i [Paper](https://paper.design) som ét samlet sæt: SVG på et gitter på 64 × 64 (bygninger 96 × 96 isometrisk) med en kontur på 3 px. De ligger i `assets/icons/`.

## Kør lokalt

Ren HTML, CSS og JavaScript. Der er ingen afhængigheder og intet byggetrin.

```bash
python3 -m http.server 8000
```

Åbn derefter http://localhost:8000.

## Filer

| Fil | Indhold |
|---|---|
| `js/data.js` | Varer, afgrøder, opskrifter, bygninger, robotter, kolonister og tutorial |
| `js/state.js` | Spilregler, gemning og alle handlinger |
| `js/map.js` | Isometrisk kort, kamera, input, dag/nat, vejr og robotter |
| `js/ui.js` | HUD, dialoger og beskeder |
| `js/audio.js` | Lydeffekter med Web Audio |
| `js/sprites.js` | Indlæsning af SVG-grafikken |
| `js/main.js` | Opstart og hovedløkke |
