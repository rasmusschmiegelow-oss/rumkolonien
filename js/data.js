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
};

const BUILDINGS = {
  isbor:         { name: 'Isbor',          level: 1,  cost: 40,   recipes: ['vand'] },
  madprinter:    { name: 'Madprinter',     level: 1,  cost: 60,   recipes: ['gryde', 'suppe'] },
  bioreaktor:    { name: 'Bioreaktor',     level: 2,  cost: 150,  recipes: ['ilt', 'braendstof'] },
  bageri:        { name: 'Rumbageri',      level: 3,  cost: 300,  recipes: ['broed', 'pizza', 'taerte'] },
  mine:          { name: 'Mine',           level: 6,  cost: 450,  recipes: ['jern'] },
  skjold:        { name: 'Stormskjold',    level: 6,  cost: 500,  recipes: [], desc: 'Beskytter kuplerne mod støvstorme.' },
  batterifabrik: { name: 'Batterifabrik',  level: 7,  cost: 700,  recipes: ['batteri'] },
  tekstil:       { name: 'Tekstilfabrik',  level: 8,  cost: 900,  recipes: ['stof', 'rumdragt'] },
  kaffebar:      { name: 'Kaffebar',       level: 10, cost: 1200, recipes: ['latte'] },
  krydderilab:   { name: 'Krydderilab',    level: 12, cost: 1600, recipes: ['chilisauce'] },
  vinkaelder:    { name: 'Vinkælder',      level: 14, cost: 2500, recipes: ['vin'] },
};
const QUEUE_MAX = 3;

const ROBOTS = {
  hoster: { name: 'Høsterobot', level: 5, cost: 400, items: {},
            desc: 'Høster modne kupler og planter samme afgrøde igen.' },
  pakker: { name: 'Pakkedrone', level: 9, cost: 800, items: { batteri: 3 },
            desc: 'Henter færdige varer fra bygningerne.' },
};

// Ting der låses op, som ikke står i tabellerne ovenfor.
const PERKS = {
  3: 'Ekspresordrer med dobbelt belønning',
  4: 'Begivenheder: støvstorme og meteorregn',
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
