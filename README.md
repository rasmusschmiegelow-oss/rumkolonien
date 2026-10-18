# Rumkolonien

Et hyggeligt spil i browseren, hvor du bygger en koloni på Mars. Du dyrker afgrøder i drivhuskupler, laver varer i bygninger og leverer ordrer til fragtskibe og kolonister.

**Spil her:** https://rasmusschmiegelow-oss.github.io/rumkolonien/

## Det kan spillet

- **Isometrisk kort** som du kan trække i og zoome på (knib eller scroll).
- **Swipe-høst:** Træk fingeren hen over modne kupler for at høste dem alle, eller hen over tomme kupler for at plante igen.
- **15 niveauer** med 10 afgrøder, 11 bygninger og 15 varer i produktionskæder (fx bomuld → stof → rumdragt).
- **Kolonister med historier:** Ida, Bo, Kim og Dina beder om varer og fortæller lidt mere om livet på Mars, hver gang du hjælper dem.
- **Robotter:** Høsterobotten høster og planter igen. Pakkedronen henter færdige varer. De arbejder også, mens du er væk.
- **Begivenheder:** Støvstorme forsinker afgrøderne, medmindre du har et stormskjold. Ved meteorregn kan du samle jernmalm op.
- **Ekspresordrer** med dobbelt belønning og tidsfrist.
- **Lager med begrænset plads**, som kan udvides.
- **Daglig belønning og ugens mål.**
- **Dag og nat:** En sol varer 8 minutter. Solnedgangen er blå på Mars, og kuplerne lyser om natten.
- **Lyd og vibration**, genereret i browseren.
- **Tutorial** de første minutter.

### Nyt i version 3

- **Mars-dyr:** Rumhøns og marsgeder i indhegninger. Fodr dem med foder fra foderfabrikken, og få æg og mælk. Mejeriet laver ost, og bageriet laver pandekager.
- **Bygningsopgraderinger** (fra niveau 6): op til 5 pladser i køen og 30 % hurtigere produktion for jernmalm og kreditter.
- **Rover-ekspeditioner** (fra niveau 7): send roveren til Gale-krateret, Valles Marineris eller Olympus Mons efter krystaller og artefakter.
- **20 medaljer** med belønninger.
- **App og gemmekode:** Spillet kan installeres på hjemmeskærmen og virker offline. Med en gemmekode kan kolonien flyttes til en anden enhed.

Spillet gemmes automatisk i browseren (`localStorage`).

### Nyt i version 4

- **Moderskibet** (fra niveau 5): et stort fragtskib svæver over landingspladsen med 6 containere, der skal fyldes inden for 3 timer. Hver container betaler, og fylder du dem alle, får du en stor bonus og krystaller.
- **Forskningslab** (fra niveau 8): 8 teknologier, der koster krystaller og artefakter, fx hurtigere vækst, rig høst, forhandling, større lager, glade dyr, turbo-rover og Robot-AI.
- **Pynt og kolonilykke:** gadelamper, flag, marstræer, statuer og springvand. Hvert lykkepoint giver 1 % mere for alle ordrer (højst 30 %). Lamperne lyser om natten.
- **Rumbørsen:** priserne skifter hver time, tre varer er i høj kurs hver dag, og du kan købe råvarer, når du mangler dem.
- **Musik:** stille ambient-musik genereret i browseren. Den skifter mellem en lys skala om dagen og en dybere om natten og kan slås til og fra for sig.

### Nyt i version 5

- **Redigeringstilstand:** tryk på flyt-knappen, vælg en bygning, kuppel, indhegning eller pynt, og tryk hvor den skal stå. To ting kan bytte plads, og afgrøder, køer og dyr flytter med.
- **Asteroidejagt** (fra niveau 4): et minispil på 30 sekunder, hvor du trykker asteroiderne væk, før de rammer Mars. Det giver kreditter og jernmalm, og de sjældne krystaller giver ekstra. Man kan spille 3 runder om dagen.
- **Marsfestivalen** (fra niveau 3): hver torsdag til søndag. Ordrer, kolonister og moderskibet giver festbilletter, der kan bruges på eksklusiv pynt (lanternebue, stjernekikkert og raketmonument), krystaller og kreditter.
- **Rådgiveren "Hvad nu?":** Ida foreslår de bedste næste træk ud fra koloniens tilstand. Kameraet glider hen til det rigtige felt, og en pil viser hvor.
- **Beskeder og app-badge:** Spillet kan give besked, når afgrøder, bygninger, dyr, roveren eller forskningen er klar, og viser antallet af ting, der venter, på app-ikonet. Uden server virker det kun, mens spillet er åbent i baggrunden.

### Nyt i version 6

- **Naboer:** Besøg andre spilleres kolonier fra nabolisten eller ranglisten, og se deres kort. Hjælp op til 10 naboer om dagen. Du får kreditter og en festbillet, og de får en gave, næste gang de spiller.
- **Ugens konkurrence:** Ordrer, kolonister og containere tæller på ugens rangliste. Når ugen er slut, får alle deltagere en præmie, og top 1, 3 og 10 får mest.
- **Missioner:** 20 missioner i 5 kapitler, fortalt af Ida, Bo, Kim og Dina. Den aktuelle mission står øverst på kortet.
- **Særlige felter:** Under klipperne gemmer der sig iskratere (isboret laver vand dobbelt så hurtigt), krystalårer (krystalboret laver krystaller af jernmalm) og ruiner (artefakt og krystaller).
- **Årstider:** forår, sommer, efterår og vinter med hver sin fordel. Hver årstid varer to døgn. Om vinteren ligger der frost og sne på kortet.

### Nyt i version 7

- **Rumposten** *(Supabase)*: Sæt varer til salg for andre spillere til din egen pris, mellem halv og tredobbelt markedsværdi. Du kan købe fra andres annoncer under **Lager → Rumposten**. Varerne forlader lageret med det samme, og pengene venter på dig, når nogen har købt. Annoncer gælder i 2 døgn, og du kan have 6 ad gangen.
- **Saml alt:** én knap, der høster alle modne kupler, samler færdige varer og dyreprodukter, fodrer dyrene og planter det samme igen.
- **Fotomodus:** et billede af hele kolonien med navn, niveau og årstid. Det kan gemmes eller deles direkte fra telefonen.
- **Phobos:** Når du har nået niveau 15, kan du starte en ny, grå koloni på Mars' måne. Hver rejse giver en stjerne med +10 % på alle ordrer og 5 % hurtigere vækst. Du beholder medaljer, missioner, statistik og festivalpynt.
- **Bølle:** Idas lille drone flyver rundt på kortet og finder kreditter, råvarer, festbilletter og en sjælden gang krystaller eller artefakter. Tryk på den, når den har en taleboble.

### Sky og ranglister (Supabase)

- **Sky-gemning:** Kolonien gemmes automatisk i Supabase hvert minut, og når appen lukkes. Under **?** finder du dit hemmelige link. Åbn det på en anden telefon eller computer for at spille videre der. Har en anden enhed gemt en nyere udgave, spørger spillet, hvilken du vil beholde.
- **Ranglister:** niveau, asteroidejagt og medaljer under **Koloni → Rangliste**. Du vælger selv dit navn.

Hver koloni har en hemmelig kolonikode, som kun findes på spillerens enheder. Databasen gemmer en sha256-hash af koden. Tabellerne har Row Level Security uden policies, så de kan ikke læses direkte. Alt går gennem funktioner: `save_colony`, `load_colony`, `submit_score`, `get_leaderboard`, `list_neighbors`, `visit_colony`, `help_colony`, `claim_gifts` og Rumpostens `market_*`-funktioner. Et besøg viser kun navn, niveau og kortet, aldrig lager eller kreditter. Scorer med urealistiske værdier afvises, og en ældre enhed kan ikke overskrive en nyere gemning. Nøglen i `js/cloud.js` er Supabases offentlige *publishable* nøgle, som er beregnet til at ligge i browseren.

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
| `js/music.js` | Genereret ambient-musik til dag og nat |
| `js/arcade.js` | Minispillet Asteroidejagt |
| `js/notify.js` | Beskeder og tal på app-ikonet |
| `js/cloud.js` | Sky-gemning og ranglister i Supabase |
| `js/main.js` | Opstart og hovedløkke |
| `sw.js`, `manifest.webmanifest` | Installérbar app og offline-cache |
