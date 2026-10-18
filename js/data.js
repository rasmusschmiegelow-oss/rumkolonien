'use strict';
// Spildata: varer, afgrøder, opskrifter, bygninger, robotter og kolonister.

const COLS = 10, ROWS = 10;
const SAVE_KEY = 'rumkolonien-save-v1';

const ITEMS = {
  // afgrøder
  kartoffel:  { name: 'Kartoffel',    value: 4 },
  alge:       { name: 'Alger',        value: 7 },
  hvede:      { name: 'Hvede',        value: 10 },
  tomat:      { name: 'Tomat',        value: 16 },
  jordbaer:   { name: 'Jordbær',      value: 20 },
  svamp:      { name: 'Svampe',       value: 24 },
  bomuld:     { name: 'Bomuld',       value: 28 },
  kaffe:      { name: 'Kaffebønner',  value: 34 },
  chili:      { name: 'Chili',        value: 40 },
  druer:      { name: 'Druer',        value: 50 },
  // råstoffer
  vand:       { name: 'Vand',         value: 3 },
  jern:       { name: 'Jernmalm',     value: 12 },
  // varer
  gryde:      { name: 'Rumgryde',     value: 18 },
  suppe:      { name: 'Svampesuppe',  value: 95 },
  ilt:        { name: 'Ilt',          value: 20 },
  braendstof: { name: 'Brændstof',    value: 34 },
  broed:      { name: 'Brød',         value: 34 },
  pizza:      { name: 'Marspizza',    value: 90 },
  taerte:     { name: 'Jordbærtærte', value: 120 },
  batteri:    { name: 'Batteri',      value: 80 },
  stof:       { name: 'Stof',         value: 110 },
  rumdragt:   { name: 'Rumdragt',     value: 420 },
  latte:      { name: 'Mars-latte',   value: 90 },
  chilisauce: { name: 'Chilisauce',   value: 175 },
  vin:        { name: 'Mars-vin',     value: 220 },
  // dyr og mejeri
  foder:      { name: 'Foder',        value: 14 },
  aeg:        { name: 'Æg',           value: 22 },
  maelk:      { name: 'Mælk',         value: 30 },
  ost:        { name: 'Ost',          value: 75 },
  pandekage:  { name: 'Pandekager',   value: 110 },
  // fund fra ekspeditioner (kan kun sælges)
  krystal:    { name: 'Krystal',      value: 150 },
  artefakt:   { name: 'Artefakt',     value: 500 },
};

// Afgrøder i drivhuskuplerne. Høst giver HARVEST_YIELD stk.
const CROPS = {
  kartoffel: { time: 20,   cost: 2,  level: 1,  xp: 1 },
  alge:      { time: 45,   cost: 4,  level: 2,  xp: 2 },
  hvede:     { time: 90,   cost: 6,  level: 3,  xp: 3 },
  tomat:     { time: 150,  cost: 10, level: 4,  xp: 4 },
  jordbaer:  { time: 240,  cost: 14, level: 5,  xp: 5 },
  svamp:     { time: 300,  cost: 16, level: 6,  xp: 6 },
  bomuld:    { time: 420,  cost: 20, level: 8,  xp: 7 },
  kaffe:     { time: 600,  cost: 24, level: 10, xp: 9 },
  chili:     { time: 900,  cost: 30, level: 12, xp: 11 },
  druer:     { time: 1200, cost: 40, level: 13, xp: 13 },
};
const HARVEST_YIELD = 2;

const RECIPES = {
  vand:       { in: {},                                 time: 15,  xp: 1,  level: 1 },
  jern:       { in: {},                                 time: 45,  xp: 2,  level: 6 },
  gryde:      { in: { kartoffel: 2, vand: 1 },          time: 40,  xp: 3,  level: 1 },
  suppe:      { in: { svamp: 3, vand: 1 },              time: 90,  xp: 8,  level: 6 },
  ilt:        { in: { alge: 2 },                        time: 30,  xp: 3,  level: 2 },
  braendstof: { in: { alge: 3, vand: 1 },               time: 60,  xp: 5,  level: 2 },
  broed:      { in: { hvede: 2, vand: 1 },              time: 60,  xp: 5,  level: 3 },
  pizza:      { in: { broed: 1, tomat: 2 },             time: 120, xp: 9,  level: 4 },
  taerte:     { in: { broed: 1, jordbaer: 3 },          time: 150, xp: 11, level: 5 },
  batteri:    { in: { jern: 2, braendstof: 1 },         time: 120, xp: 8,  level: 7 },
  stof:       { in: { bomuld: 3 },                      time: 180, xp: 10, level: 8 },
  rumdragt:   { in: { stof: 2, ilt: 1, batteri: 1 },    time: 300, xp: 25, level: 9 },
  latte:      { in: { kaffe: 2, vand: 1 },              time: 90,  xp: 9,  level: 10 },
  chilisauce: { in: { chili: 3, tomat: 1 },             time: 240, xp: 15, level: 12 },
  vin:        { in: { druer: 3 },                       time: 600, xp: 30, level: 14 },
  foder:      { in: { kartoffel: 2, alge: 1 },          time: 30,  xp: 2,  level: 3 },
  krystal:    { in: { jern: 4 },                        time: 1800, xp: 20, level: 7 },
  ost:        { in: { maelk: 2 },                       time: 120, xp: 8,  level: 6 },
  pandekage:  { in: { aeg: 1, maelk: 1, hvede: 1 },     time: 90,  xp: 9,  level: 6 },
};

const BUILDINGS = {
  isbor:         { name: 'Isbor',          level: 1,  cost: 40,   recipes: ['vand'] },
  madprinter:    { name: 'Madprinter',     level: 1,  cost: 60,   recipes: ['gryde', 'suppe'] },
  bioreaktor:    { name: 'Bioreaktor',     level: 2,  cost: 150,  recipes: ['ilt', 'braendstof'] },
  bageri:        { name: 'Rumbageri',      level: 3,  cost: 300,  recipes: ['broed', 'pizza', 'taerte', 'pandekage'] },
  foderfabrik:   { name: 'Foderfabrik',    level: 3,  cost: 200,  recipes: ['foder'] },
  mejeri:        { name: 'Mejeri',         level: 6,  cost: 600,  recipes: ['ost'] },
  mine:          { name: 'Mine',           level: 6,  cost: 450,  recipes: ['jern'] },
  skjold:        { name: 'Stormskjold',    level: 6,  cost: 500,  recipes: [], desc: 'Beskytter kuplerne mod støvstorme.' },
  batterifabrik: { name: 'Batterifabrik',  level: 7,  cost: 700,  recipes: ['batteri'] },
  tekstil:       { name: 'Tekstilfabrik',  level: 8,  cost: 900,  recipes: ['stof', 'rumdragt'] },
  kaffebar:      { name: 'Kaffebar',       level: 10, cost: 1200, recipes: ['latte'] },
  krydderilab:   { name: 'Krydderilab',    level: 12, cost: 1600, recipes: ['chilisauce'] },
  garage:        { name: 'Rovergarage',    level: 7,  cost: 1000, recipes: [], garage: true, desc: 'Send roveren på ekspedition efter krystaller og artefakter.' },
  lab:           { name: 'Forskningslab',  level: 8,  cost: 1500, recipes: [], lab: true, desc: 'Forsk i teknologier, der gør kolonien bedre for altid.' },
  krystalbor:    { name: 'Krystalbor',     level: 7,  cost: 2000, recipes: ['krystal'], needs: 'crystal', desc: 'Kan kun bygges på en krystalåre.' },
  solpanel:      { name: 'Solpanel',       level: 2,  cost: 120,  recipes: [], multi: true, power: true, desc: 'Giver strøm om dagen. Mindre om vinteren og i støvstorme.' },
  vindmolle:     { name: 'Vindmølle',      level: 4,  cost: 300,  recipes: [], multi: true, power: true, desc: 'Giver strøm døgnet rundt og meget mere i støvstorme.' },
  batteribank:   { name: 'Batteribank',    level: 7,  cost: 800,  recipes: [], multi: true, power: true, items: { batteri: 3 }, desc: 'Gemmer solstrøm og giver den tilbage om natten og i storme.' },
  habitat:       { name: 'Habitat',        level: 3,  cost: 400,  recipes: [], multi: true, desc: 'Boliger til 6 kolonister mere.' },
  monolit:       { name: 'Monolitten',     level: 9,  cost: 3000, recipes: [], monolith: true, desc: 'De Førstes efterladenskab. Kan bøje tiden én gang i døgnet.' },
  vinkaelder:    { name: 'Vinkælder',      level: 14, cost: 2500, recipes: ['vin'] },
};
const QUEUE_MAX = 3;

// Bygningsopgraderinger: hvert niveau giver én plads mere i køen og 15 % hurtigere produktion.
const UPGRADE_MAX = 3;
const upgradeCost = (b, lvl) => ({ credits: Math.round(b.cost * 1.5 * lvl), jern: lvl === 1 ? 4 : 10 });
const queueMax = (tile) => QUEUE_MAX + ((tile.lvl || 1) - 1);
const speedOf = (tile) => 1 - 0.15 * ((tile.lvl || 1) - 1);

// Dyr bor i indhegninger med plads til 3. De skal fodres for at give noget.
const ANIMALS = {
  hoensehus: { name: 'Hønsehus',  animal: 'hone', animalName: 'Rumhøns',   product: 'aeg',   time: 90,  level: 3, cost: 250, xp: 3 },
  gedestald: { name: 'Gedestald', animal: 'ged',  animalName: 'Marsgeder', product: 'maelk', time: 180, level: 5, cost: 500, xp: 5 },
};
const PEN_SIZE = 3;

// Ekspeditioner med roveren. loot: [vare, min, maks, chance]
const EXPEDITIONS = [
  { id: 'gale',    name: 'Gale-krateret',    level: 7,  time: 5 * 60,  cost: { braendstof: 2, gryde: 2 },
    desc: 'Et gammelt søbund tæt på kolonien.',      loot: [['jern', 3, 6, 1], ['krystal', 1, 1, 0.35]] },
  { id: 'valles',  name: 'Valles Marineris', level: 9,  time: 15 * 60, cost: { braendstof: 3, pizza: 1, batteri: 1 },
    desc: 'Solsystemets største kløft.',             loot: [['jern', 2, 4, 1], ['krystal', 1, 2, 1], ['artefakt', 1, 1, 0.3]] },
  { id: 'olympus', name: 'Olympus Mons',     level: 11, time: 30 * 60, cost: { braendstof: 5, rumdragt: 1 },
    desc: 'Den højeste vulkan i solsystemet.',       loot: [['krystal', 2, 4, 1], ['artefakt', 1, 1, 0.65]] },
];

// Medaljer: test() kører løbende, og belønningen udbetales første gang den er sand.
const MEDALS = [
  { id: 'h1',    name: 'Første høst',        desc: 'Høst din første afgrøde.',            test: () => S.stats.harvest >= 1,   reward: 20 },
  { id: 'h100',  name: 'Grøn finger',        desc: 'Høst 100 gange.',                      test: () => S.stats.harvest >= 100, reward: 150 },
  { id: 'h500',  name: 'Mars-landmand',      desc: 'Høst 500 gange.',                      test: () => S.stats.harvest >= 500, reward: 500 },
  { id: 'd10',   name: 'Fragtfører',         desc: 'Lever 10 ordrer.',                     test: () => S.stats.deliver >= 10,  reward: 80 },
  { id: 'd50',   name: 'Handelsstation',     desc: 'Lever 50 ordrer.',                     test: () => S.stats.deliver >= 50,  reward: 250 },
  { id: 'd200',  name: 'Rumhavn',            desc: 'Lever 200 ordrer.',                    test: () => S.stats.deliver >= 200, reward: 800 },
  { id: 'p50',   name: 'Fabriksarbejder',    desc: 'Producér 50 varer.',                   test: () => S.stats.produce >= 50,  reward: 120 },
  { id: 'p250',  name: 'Industrimagnat',     desc: 'Producér 250 varer.',                  test: () => S.stats.produce >= 250, reward: 500 },
  { id: 'l5',    name: 'Nybygger',           desc: 'Nå niveau 5.',                         test: () => S.level >= 5,   reward: 100 },
  { id: 'l10',   name: 'Pioner',             desc: 'Nå niveau 10.',                        test: () => S.level >= 10,  reward: 400 },
  { id: 'l15',   name: 'Koloniborgmester',   desc: 'Nå niveau 15.',                        test: () => S.level >= 15,  reward: 1000 },
  { id: 'dome',  name: 'Kuppelby',           desc: 'Hav 12 drivhuskupler.',                test: () => S.tiles.filter((t) => t.t === 'plot').length >= 12, reward: 200 },
  { id: 'pen',   name: 'Dyreven',            desc: 'Byg din første indhegning.',           test: () => S.tiles.some((t) => t.t === 'pen'), reward: 80 },
  { id: 'robot', name: 'Automatiseret',      desc: 'Køb en robot.',                        test: () => S.robots.hoster || S.robots.pakker, reward: 100 },
  { id: 'up',    name: 'Ingeniørkunst',      desc: 'Opgradér en bygning til niveau 3.',    test: () => S.tiles.some((t) => t.lvl >= 3), reward: 300 },
  { id: 'story', name: 'God nabo',           desc: 'Hør en kolonists hele historie.',      test: () => Object.keys(COLONISTS).some((k) => S.story[k] >= COLONISTS[k].lines.length), reward: 250 },
  { id: 'exp1',  name: 'Opdagelsesrejsende', desc: 'Gennemfør en ekspedition.',            test: () => S.stats.expeditions >= 1,  reward: 100 },
  { id: 'exp10', name: 'Marsforsker',        desc: 'Gennemfør 10 ekspeditioner.',          test: () => S.stats.expeditions >= 10, reward: 500 },
  { id: 'art',   name: 'Arkæolog',           desc: 'Find et artefakt.',                    test: () => S.stats.artefakter >= 1, reward: 300 },
  { id: 'rich',  name: 'Kreditkonge',        desc: 'Hav 10.000 kreditter på én gang.',     test: () => S.credits >= 10000, reward: 500 },
  { id: 'ship',  name: 'Moderskibets ven',   desc: 'Fyld alle containere på moderskibet.', test: () => S.stats.ships >= 1, reward: 300 },
  { id: 'res',   name: 'Videnskabsfolk',     desc: 'Gennemfør et forskningsprojekt.',      test: () => Object.keys(S.research.done).length >= 1, reward: 200 },
  { id: 'resall',name: 'Fremtidens koloni',  desc: 'Gennemfør al forskning.',              test: () => Object.keys(S.research.done).length >= Object.keys(RESEARCH).length, reward: 2000 },
  { id: 'happy', name: 'Lykkelig koloni',    desc: 'Nå 30 lykkepoint med pynt.',           test: () => happiness() >= HAPPY_MAX, reward: 500 },
  { id: 'trade', name: 'Børshaj',            desc: 'Sælg 100 varer på Rumbørsen.',         test: () => S.stats.sold >= 100, reward: 250 },
  { id: 'arc',   name: 'Asteroidejæger',     desc: 'Få 40 point i asteroidejagt.',          test: () => S.arcade.best >= 40, reward: 200 },
  { id: 'nabo',  name: 'Nabohjælper',           desc: 'Hjælp 10 naboer.',                      test: () => S.stats.helped >= 10, reward: 300 },
  { id: 'miss',  name: 'Missionen fuldført', desc: 'Gennemfør alle missioner.',              test: () => S.mission >= MISSIONS.length, reward: 2000 },
  { id: 'phobos', name: 'Månekolonist',     desc: 'Start en ny koloni på Phobos.',          test: () => S.prestige >= 1, reward: 1000 },
  { id: 'post',  name: 'Postmester',         desc: 'Sælg en vare til en anden spiller.',    test: () => S.stats.postSold >= 1, reward: 150 },
  { id: 'pet',   name: 'Bølles bedste ven',  desc: 'Lad Bølle finde 20 ting.',               test: () => S.stats.petFinds >= 20, reward: 300 },
  { id: 'terra', name: 'Terraformer',        desc: 'Bidrag med 1000 point til terraformingen.', test: () => (S.terraMine || 0) >= 1000, reward: 500 },
  { id: 'map',   name: 'Kortlægger',         desc: 'Udforsk 15 sektorer af Mars.',          test: () => Object.keys(S.explore.done).length >= 15, reward: 400 },
  { id: 'myst',  name: 'De Førstes arv',     desc: 'Byg Monolitten.',                       test: () => owns('monolit'), reward: 1500 },
  { id: 'pop',   name: 'Lille by',           desc: 'Nå 20 indbyggere.',                     test: () => S.pop.n >= 20, reward: 400 },
  { id: 'fest',  name: 'Festabe',            desc: 'Sæt festivalpynt op.',                  test: () => S.tiles.some((t) => t.t === 'deco' && DECOR[t.id].fest), reward: 150 },
];

const ROBOTS = {
  hoster: { name: 'Høsterobot', level: 5, cost: 400, items: {},
            desc: 'Høster modne kupler og planter samme afgrøde igen.' },
  pakker: { name: 'Pakkedrone', level: 9, cost: 800, items: { batteri: 3 },
            desc: 'Henter færdige varer fra bygningerne.' },
};

// Ting der låses op, som ikke står i tabellerne ovenfor.
const PERKS = {
  3: 'Ekspresordrer med dobbelt belønning · Marsfestivalen',
  4: 'Begivenheder: støvstorme og meteorregn · Asteroidejagt',
  5: 'Moderskibet kommer på besøg',
  6: 'Bygningsopgraderinger: flere pladser i køen og hurtigere produktion',
  11: 'Flere ordrepladser',
  15: 'Titlen Koloniborgmester 🏅 og 1000 kreditter',
};

const COLONISTS = {
  ida: {
    name: 'Ingeniør Ida', level: 1,
    lines: [
      'Hej! Jeg er Ida, og jeg holder maskinerne kørende. Kan du skaffe lidt mad? Printeren og jeg har arbejdet hele natten.',
      'Isboret hoster igen. Jeg tror, det savner Jorden. Har du noget, jeg kan bestikke det med?',
      'Jeg har bygget en lille drone af reservedele. Den hedder Bølle. Den spiser åbenbart også.',
      'Bølle stak af. Jeg fandt den ved landingspladsen, hvor den kiggede op mod Jorden. Vi har vist alle lidt hjemve.',
      'Ved du hvad? Det her er begyndt at føles som hjemme. Tak, fordi du holder os i live.',
    ],
  },
  bo: {
    name: 'Botaniker Bo', level: 2,
    lines: [
      'Bo her. Jeg taler med planterne, og de siger, at du gør det godt. Jeg mangler forsyninger til mine forsøg.',
      'Mine alger har lært at vokse i rødt lys. Den bedste har jeg kaldt Gertrud.',
      'Gertrud har fået unger! Altså, hun har delt sig. Det er det samme på Mars.',
      'Jeg prøver at dyrke en rose til Dina. Sig det ikke til nogen.',
      'Rosen blomstrede! Den er lidt orange, men det er alting på Mars. Tak for hjælpen.',
    ],
  },
  kim: {
    name: 'Kaptajn Kim', level: 3,
    lines: [
      'Kaptajn Kim, pilot på fragtskibet Ørnen. Jeg skal have proviant til den lange tur.',
      'Turen fra Jorden tager syv måneder. Jeg har set alle film om bord tre gange.',
      'Næste gang tager jeg min kat med. Hun hedder Kaptajn Mis og har mere flyvetid end mig.',
      'Der er en ny koloni på Phobos, der vil handle med os. Du er ved at blive berømt.',
      'Når jeg ser jeres lys fra kredsløb, ved jeg, at jeg er kommet hjem.',
    ],
  },
  dina: {
    name: 'Doktor Dina', level: 5,
    lines: [
      'Doktor Dina. Alle her spiser for lidt grønt. Vil du hjælpe mig med at holde kolonien sund?',
      'Ida har forstuvet en finger på isboret. Igen. Jeg har brug for forsyninger.',
      'Nogen har stillet en orange rose på mit kontor. Ved du, hvem det kan være?',
      'Kolonien er den sundeste i solsystemet. Det står i rapporten, som jeg selv har skrevet.',
      'Bo og jeg skal spise middag i kuppel 3 i aften. Bare så du ved det.',
    ],
  },
};
const COLONIST_DONE_LINE = 'Tak! Du er den bedste nabo på hele planeten.';

const TUTORIAL = [
  { text: 'Tryk på en drivhuskuppel, og plant en kartoffel.', target: 'emptyPlot' },
  { text: 'Når kartoflerne er modne, trykker du for at høste. Tip: Træk fingeren hen over flere kupler for at høste dem alle på én gang.', target: 'cropPlot' },
  { text: 'Tryk på Isboret, og producér vand.', target: 'b:isbor' },
  { text: 'Tryk på Isboret igen, når vandet er færdigt, for at samle det.', target: 'b:isbor' },
  { text: 'Tryk på landingspladsen, og lever en ordre til et fragtskib.', target: 'pad' },
  { text: 'Flot! Ryd nu et klippefelt for at få plads til mere.', target: 'rock' },
];

const xpNeeded = (lvl) => 15 + (lvl - 1) * 20 + (lvl - 1) ** 2 * 5;
const orderSlots = (lvl) => Math.min(9, 3 + Math.ceil(lvl / 2));
const plotCost = (n) => 20 + n * 10;
const clearCost = (n) => 15 + n * 10;
const siloCap = (lvl) => 50 + (lvl - 1) * 30;
const siloCost = (lvl) => Math.round(80 * lvl ** 1.5);

const DAY_MS = 8 * 60 * 1000; // én Mars-dag (sol) i spillet
const STORM_MS = 90 * 1000;
const METEOR_MS = 25 * 1000;

// ---------- Version 4 ----------

// Moderskibet kommer på besøg med 6 containere, der skal fyldes, før det flyver igen.
const SHIP = { level: 5, crates: 6, stayMs: 3 * 60 * 60 * 1000, gapMs: 20 * 60 * 1000 };

// Forskning: krystaller og artefakter fra ekspeditionerne bliver til varige fordele.
const RESEARCH = {
  vaekst1: { name: 'Hurtigere vækst', desc: 'Afgrøder gror 15 % hurtigere.',            cost: { krystal: 2 },              credits: 500,  time: 10 * 60, level: 8 },
  hoest:   { name: 'Rig høst',        desc: '25 % chance for en ekstra afgrøde.',        cost: { krystal: 3 },              credits: 800,  time: 20 * 60, level: 8 },
  handel:  { name: 'Forhandling',     desc: 'Ordrer betaler 15 % mere.',                 cost: { krystal: 3, artefakt: 1 }, credits: 1000, time: 30 * 60, level: 9 },
  lager:   { name: 'Komprimering',    desc: 'Lageret får 60 pladser mere.',              cost: { krystal: 4 },              credits: 1200, time: 30 * 60, level: 9 },
  dyr:     { name: 'Glade dyr',       desc: 'Dyrene producerer 30 % hurtigere.',         cost: { krystal: 3 },              credits: 900,  time: 20 * 60, level: 10 },
  rover:   { name: 'Turbo-rover',     desc: 'Ekspeditioner tager 40 % kortere tid.',     cost: { krystal: 4, artefakt: 1 }, credits: 1500, time: 40 * 60, level: 10 },
  robotai: { name: 'Robot-AI',        desc: 'Robotterne arbejder dobbelt så hurtigt.',   cost: { krystal: 5, artefakt: 1 }, credits: 2000, time: 45 * 60, level: 11 },
  vaekst2: { name: 'Superfrø',        desc: 'Afgrøder gror yderligere 15 % hurtigere.',  cost: { krystal: 6, artefakt: 2 }, credits: 3000, time: 60 * 60, level: 12, needs: 'vaekst1' },
};

// Pynt gør kolonisterne glade. Hvert lykkepoint giver 1 % mere for ordrer (højst 30 %).
const DECOR = {
  'deco-lampe':      { name: 'Gadelampe',       cost: 80,   happy: 1,  level: 2 },
  'deco-flag':       { name: 'Koloniflag',      cost: 150,  happy: 2,  level: 3 },
  'deco-trae':       { name: 'Marstræ',         cost: 300,  happy: 3,  level: 4 },
  'deco-statue':     { name: 'Astronautstatue', cost: 800,  happy: 6,  level: 7 },
  'deco-springvand': { name: 'Springvand',      cost: 1500, happy: 10, level: 9 },
  // festivalpynt kan kun købes for festbilletter
  'deco-lanterne':      { name: 'Lanternebue',    cost: 0, happy: 4,  level: 3, fest: true },
  'deco-teleskop':      { name: 'Stjernekikkert', cost: 0, happy: 6,  level: 3, fest: true },
  'deco-raketmonument': { name: 'Raketmonument',  cost: 0, happy: 12, level: 3, fest: true },
};
const HAPPY_MAX = 30;

// Rumbørsen: priserne skifter hver time, og tre varer er i høj kurs hver dag.
const MARKET_HOUR = 60 * 60 * 1000;
const MARKET_BUY = ['kartoffel', 'alge', 'hvede', 'tomat', 'jordbaer', 'svamp', 'bomuld', 'kaffe', 'chili', 'druer', 'vand', 'jern', 'foder'];

// ---------- Version 5 ----------

// Marsfestivalen holdes torsdag til søndag. Ordrer giver festbilletter til festivalbutikken.
const FESTIVAL = { level: 3, days: [4, 5, 6, 0] };
const FEST_SHOP = [
  { id: 'deco-lanterne',      kind: 'decor', tickets: 15 },
  { id: 'deco-teleskop',      kind: 'decor', tickets: 30 },
  { id: 'deco-raketmonument', kind: 'decor', tickets: 60 },
  { id: 'krystal',            kind: 'item',  tickets: 10, n: 1 },
  { id: 'jern',               kind: 'item',  tickets: 6,  n: 5 },
  { id: 'coin',               kind: 'credits', tickets: 8, n: 400 },
];

// Asteroidejagt: et minispil på 30 sekunder, 3 gange om dagen.
const ARCADE = { level: 4, plays: 3, seconds: 30 };

// ---------- Version 6 ----------

// Årstider: hver varer to døgn, så et Mars-år tager otte dage.
const SEASON_MS = 2 * 24 * 60 * 60 * 1000;
const SEASONS = [
  { id: 'foraar',   name: 'Forår',   desc: 'Afgrøderne gror 15 % hurtigere.' },
  { id: 'sommer',   name: 'Sommer',  desc: 'Solpanelerne giver strøm nok til, at bygningerne producerer 15 % hurtigere.' },
  { id: 'efteraar', name: 'Efterår', desc: 'Høsttid: 20 % chance for en ekstra afgrøde, når du høster.' },
  { id: 'vinter',   name: 'Vinter',  desc: 'Afgrøderne gror 20 % langsommere, men isboret laver vand dobbelt så hurtigt.' },
];

// Særlige felter gemmer sig under klipperne.
const SPECIALS = {
  ice:     { name: 'Iskrater',   sprite: 'iskrater',    desc: 'Et isbor her laver vand dobbelt så hurtigt.' },
  crystal: { name: 'Krystalåre', sprite: 'krystalaare', desc: 'Her kan du bygge et krystalbor, der laver krystaller.' },
  ruin:    { name: 'Ruin',       sprite: 'ruin',        desc: 'Ryd den, og find et artefakt og krystaller.' },
};

// Naboer: belønning for at hjælpe og for at blive hjulpet.
const HELP_REWARD = (lvl) => 30 + 5 * lvl;
const GIFT_REWARD = { credits: 50, xp: 5 };

// Ugens konkurrence: leverancer (ordrer, kolonister og containere) fra mandag til søndag.
const WEEK_PRIZES = [
  { upTo: 1,  credits: 1500, krystal: 3, text: '1. plads' },
  { upTo: 3,  credits: 800,  krystal: 2, text: 'Top 3' },
  { upTo: 10, credits: 400,  krystal: 1, text: 'Top 10' },
  { upTo: Infinity, credits: 100, krystal: 0, text: 'Deltager' },
];

// Missioner: en kampagne i fem kapitler, fortalt af kolonisterne.
const MISSION_CHAPTERS = [
  { title: 'Landingen', col: 'ida', intro: 'Velkommen til Mars! Lad os få kolonien til at stå på egne ben.' },
  { title: 'Det grønne', col: 'bo', intro: 'Planter og dyr er livet herude. Lad os gøre kolonien grønnere.' },
  { title: 'Handel', col: 'kim', intro: 'Skibene kommer oftere nu. Kolonien skal kunne handle med hele solsystemet.' },
  { title: 'Ud i det ukendte', col: 'dina', intro: 'Der er mere på Mars end rødt støv. Lad os udforske planeten.' },
  { title: 'Fremtiden', col: 'ida', intro: 'Det sidste skridt: en koloni, man kan være stolt af.' },
];
const plots = () => S.tiles.filter((t) => t.t === 'plot').length;
const decoCount = () => S.tiles.filter((t) => t.t === 'deco').length;
const MISSIONS = [
  { ch: 0, text: 'Høst 10 gange',                   p: () => [S.stats.harvest, 10],                         reward: 60 },
  { ch: 0, text: 'Lever 3 ordrer',                  p: () => [S.stats.deliver, 3],                          reward: 80 },
  { ch: 0, text: 'Hav 8 drivhuskupler',             p: () => [plots(), 8],                                  reward: 100 },
  { ch: 0, text: 'Nå niveau 3',                     p: () => [S.level, 3],                                  reward: 150, krystal: 1 },
  { ch: 1, text: 'Byg en foderfabrik',              p: () => [+owns('foderfabrik'), 1],                     reward: 120 },
  { ch: 1, text: 'Byg et hønsehus',                 p: () => [+S.tiles.some((t) => t.t === 'pen'), 1],      reward: 150 },
  { ch: 1, text: 'Producér 30 varer',               p: () => [S.stats.produce, 30],                         reward: 200 },
  { ch: 1, text: 'Sæt 3 stykker pynt op',           p: () => [decoCount(), 3],                              reward: 250, krystal: 1 },
  { ch: 2, text: 'Fyld alle containere på moderskibet', p: () => [S.stats.ships, 1],                        reward: 300 },
  { ch: 2, text: 'Sælg 30 varer på Rumbørsen',      p: () => [S.stats.sold, 30],                            reward: 250 },
  { ch: 2, text: 'Lever 25 ordrer',                 p: () => [S.stats.deliver, 25],                         reward: 350 },
  { ch: 2, text: 'Hjælp 3 naboer',                  p: () => [S.stats.helped, 3],                           reward: 300, krystal: 2 },
  { ch: 3, text: 'Byg rovergaragen',                p: () => [+owns('garage'), 1],                          reward: 400 },
  { ch: 3, text: 'Gennemfør 3 ekspeditioner',       p: () => [S.stats.expeditions, 3],                      reward: 500 },
  { ch: 3, text: 'Byg forskningslabbet',            p: () => [+owns('lab'), 1],                             reward: 500 },
  { ch: 3, text: 'Gennemfør 2 forskningsprojekter', p: () => [Object.keys(S.research.done).length, 2],      reward: 600, krystal: 2 },
  { ch: 4, text: 'Byg et krystalbor på en krystalåre', p: () => [+owns('krystalbor'), 1],                   reward: 800 },
  { ch: 4, text: 'Opgradér 3 bygninger',            p: () => [S.tiles.filter((t) => t.lvl >= 2).length, 3], reward: 800 },
  { ch: 4, text: 'Nå 20 i lykke',                   p: () => [happiness(), 20],                             reward: 1000 },
  { ch: 4, text: 'Nå niveau 15',                    p: () => [S.level, 15],                                 reward: 3000, krystal: 5 },
];

// ---------- Version 7 ----------
// Rumposten: priser pr. annonce skal ligge mellem halv og tredobbelt markedsværdi.
const POST_MIN = 0.5, POST_MAX = 3;
// Phobos: hver ny koloni giver varige bonusser.
const PRESTIGE_LEVEL = 15;
const prestigePay = (n) => 0.1 * n;                    // +10 % for ordrer pr. stjerne
const prestigeGrowth = (n) => Math.max(0.75, 1 - 0.05 * n); // afgrøder gror 5 % hurtigere pr. stjerne
// Bølle finder noget nyt hvert 6.-12. minut.
const PET_LEVEL = 2;

// ---------- Version 8: terraforming ----------
// Hele planetens fælles fremskridt (point fra alle spillere i Supabase).
const TERRA_STAGES = [
  { at: 0,     name: 'Rød og død',     desc: 'En tynd atmosfære af kuldioxid og minus 60 grader.' },
  { at: 500,   name: 'Tyndt slør',     desc: 'Atmosfæren bliver tykkere, og himlen får et blåt skær.' },
  { at: 2500,  name: 'Lav på klipperne', desc: 'De første lav vokser uden for kuplerne. Afgrøder gror 5 % hurtigere.' },
  { at: 10000, name: 'Smeltevand',     desc: 'Iskraterne bliver til små søer. Afgrøder gror 10 % hurtigere.' },
  { at: 30000, name: 'Grønne sletter', desc: 'Græs breder sig over sletterne. Dyrene producerer 15 % hurtigere.' },
  { at: 80000, name: 'Blå planet',     desc: 'Mars har blå himmel og regn igen. Alt går 15 % hurtigere.' },
];
const TERRA_ITEMS = { ilt: 3, vand: 1, alge: 1, krystal: 20 };

// ---------- Version 8: energi ----------
// Forbrug i kW pr. felt. Producenter står i BUILDINGS med power: true.
const POWER_USE = { b: 2, lab: 3, krystalbor: 4, garage: 1, skjold: 2, pen: 1, habitat: 1 };
const landerPower = (lvl) => 6 + lvl; // landingsfartøjets reaktor

// ---------- Version 8: udforskning ----------
// Et kort over Mars i 7 x 5 sektorer. Kolonien ligger i midten.
const SECTOR_TYPES = {
  home:    { name: 'Kolonien',      icon: 'rocket' },
  krater:  { name: 'Krater',        icon: 'jern',     loot: [['jern', 3, 6, 1], ['krystal', 1, 1, 0.25]] },
  isfelt:  { name: 'Isfelt',        icon: 'iskrater', loot: [['vand', 8, 15, 1], ['ilt', 2, 4, 0.5]] },
  krystal: { name: 'Krystalfelt',   icon: 'krystal',  loot: [['krystal', 1, 3, 1]] },
  vrag:    { name: 'Vrag',          icon: 'vrag',     loot: [['batteri', 1, 2, 1], ['stof', 1, 1, 0.4], ['coin', 200, 600, 1]] },
  ruin:    { name: 'Ruin',          icon: 'ruin',     loot: [['artefakt', 1, 1, 1], ['krystal', 1, 2, 0.6]] },
  vulkan:  { name: 'Vulkan',        icon: 'vulkan',   loot: [['jern', 4, 8, 1], ['krystal', 1, 2, 0.7], ['artefakt', 1, 1, 0.3]] },
  storm:   { name: 'Stormfelt',     icon: 'storm',    loot: [['jern', 1, 2, 0.5]] },
};
const SECTORS_W = 7, SECTORS_H = 5, SECTOR_HOME = 2 * 7 + 3;
// Rækkefølge: rækker fra nord til syd. Navngivne steder fra rigtige Mars-kort.
const SECTORS = [
  ['isfelt', 'Nordpolens iskappe'], ['krater', ''], ['vrag', 'Phoenix-landeren'], ['isfelt', 'Utopia Planitia'], ['storm', ''], ['krystal', ''], ['isfelt', ''],
  ['krater', ''], ['ruin', 'Cydonia'], ['krater', ''], ['vrag', 'Viking 1'], ['ruin', ''], ['krater', 'Jezero-krateret'], ['storm', ''],
  ['vulkan', 'Olympus Mons'], ['krystal', ''], ['krater', 'Gale-krateret'], ['home', 'Kolonien'], ['krater', ''], ['vrag', 'Opportunity'], ['krystal', ''],
  ['storm', ''], ['krystal', 'Valles Marineris'], ['vulkan', 'Arsia Mons'], ['krater', ''], ['ruin', 'Hellas-bassinet'], ['krater', ''], ['vulkan', 'Elysium Mons'],
  ['isfelt', ''], ['storm', ''], ['krater', ''], ['isfelt', 'Sydpolens iskappe'], ['krystal', ''], ['storm', ''], ['ruin', 'Argyre'],
].map(([type, name], i) => ({ i, type, name: name || SECTOR_TYPES[type].name }));
const sectorDist = (i) => Math.abs((i % SECTORS_W) - (SECTOR_HOME % SECTORS_W)) + Math.abs(Math.floor(i / SECTORS_W) - Math.floor(SECTOR_HOME / SECTORS_W));
const sectorTrip = (i) => ({ min: 4 * Math.max(1, sectorDist(i)), cost: { braendstof: Math.max(1, sectorDist(i)), ...(sectorDist(i) >= 3 ? { gryde: 2 } : {}) } });
const REVISIT_MS = 6 * 60 * 60 * 1000;

// ---------- Version 8: Mars-mysteriet ----------
const MYSTERY = [
  { who: 'dina', text: 'Signalet er en tælling. 2, 3, 5, 7, 11 ... primtal. Nogen ville vise, at de kunne regne.' },
  { who: 'ida',  text: 'Det er et kort over solsystemet. Men Mars har have, og Jorden er dækket af is. Kortet er over en milliard år gammelt.' },
  { who: 'dina', text: 'De kaldte sig noget, vi bedst kan oversætte til "De Første". De boede her, da Mars var blå.' },
  { who: 'bo',   text: 'Da atmosfæren forsvandt, byggede de kupler som vores. Men de kunne ikke holde på varmen.' },
  { who: 'kim',  text: 'De sendte frø ud i rummet. Nogle af dem landede måske på en ung, blå planet tæt ved solen.' },
  { who: 'ida',  text: 'Det sidste fragment er en byggevejledning til noget, der kan bøje tiden. De efterlod den til dem, der kom efter.' },
];
const DECODE = { cost: { artefakt: 1, krystal: 2 }, min: 15 };
const MONOLITH_DONE = 'Monolitten summer. Mars husker, hvordan det var at være levende. Nu er det vores tur.';

// ---------- Version 8: befolkning og livsstøtte ----------
// Landingsfartøjet holder 4 kolonister i live. Flere kræver habitater, ilt og mad hver sol.
const POP_BASE = 4, POP_PER_HABITAT = 6;
const FOOD = { aeg: 1, maelk: 1, gryde: 2, broed: 2, ost: 2, pandekage: 3, suppe: 4, pizza: 4, taerte: 4, latte: 1 };
const FOOD_BASIC = ['aeg', 'maelk', 'gryde', 'broed'];
