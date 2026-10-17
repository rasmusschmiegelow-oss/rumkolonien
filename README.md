# 🪐 Rumkolonien

Et hyggeligt spil i browseren, hvor du bygger en koloni på Mars. Du dyrker afgrøder i drivhuskupler, laver varer i bygninger og leverer ordrer til fragtskibe i kredsløb.

**Spil her:** https://rasmusschmiegelow-oss.github.io/rumkolonien/

## Sådan spiller du

- 🫙 **Drivhuskupler:** Tryk for at plante. Når afgrøden er moden, trykker du igen og høster 2 stk.
- 🧊 🖨️ ⚗️ 🏭 **Bygninger:** De laver varer af dine råvarer. Hver bygning har en kø med plads til 3 ting.
- 🚀 **Landingsplads:** Lever det, skibene bestiller, og få kreditter og erfaring.
- 🪨 **Udvid:** Ryd klipper og byg nye kupler og bygninger. Når du stiger i niveau, låser du op for nye afgrøder, bygninger og flere ordrer.

Spillet gemmes automatisk i browseren (`localStorage`), og det du har plantet eller sat i gang, bliver færdigt, mens du er væk.

## Indhold

| Niveau | Nyt |
|---|---|
| 1 | 🥔 Kartofler, 🧊 Isbor (💧 vand), 🖨️ Madprinter (🍲 rumgryde) |
| 2 | 🌿 Alger, ⚗️ Bioreaktor (💨 ilt, ⛽ brændstof) |
| 3 | 🌾 Hvede, 🏭 Rumbageri (🍞 brød) |
| 4 | 🍅 Tomater, 🍕 Marspizza |

## Kør lokalt

Ren HTML, CSS og JavaScript. Der er ingen afhængigheder og intet byggetrin.

```bash
python3 -m http.server 8000
```

Åbn derefter http://localhost:8000.

## Filer

- `index.html`: HUD, kort og dialoger
- `style.css`: udseende
- `game.js`: spildata, logik, gemning og tegning af kortet på canvas
