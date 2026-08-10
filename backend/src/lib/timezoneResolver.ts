/**
 * Offline timezone resolution.
 *
 * Every lookup in this file is a pure, in-process table lookup — no network
 * calls, no API keys, no cost, no rate limits. It is the single source of
 * truth used when leads are created, imported, updated, or backfilled.
 *
 * Signals, in descending order of confidence:
 *   1. An explicit person-level IANA timezone on the record (some vendor
 *      exports carry one)
 *   2. The phone number's NANP area code
 *   3. A free-text person location ("Manhattan, New York, United States")
 *   4. A structured city/state pair from custom fields
 *   5. A country-only field
 *
 * Area code ranks above the address fields deliberately. Call-window
 * compliance follows the number being dialed, not where the prospect's
 * employer is registered — and in this database the City/State columns are
 * demonstrably company-level: one import has 468 leads all stamped
 * "Reading, PA" whose mobile numbers span six different timezones. Trusting
 * the address there would have mis-scheduled every one of them.
 */

/**
 * NANP area code → IANA timezone.
 *
 * Where an area code straddles a timezone boundary it is assigned to the zone
 * holding the majority of its population (noted inline). The worst case is a
 * one-hour error on a small minority of numbers, which only ever reorders the
 * dial queue — it never suppresses a lead.
 *
 * Toll-free (800/833/844/855/866/877/888), premium (900) and non-geographic
 * (211/311/411/511/611/711/811/911) codes are deliberately absent: they carry
 * no location and must resolve to null.
 */
const AREA_CODE_TIMEZONE: Record<string, string> = {
  // ── Eastern ──────────────────────────────────────────────────────────────
  // Connecticut
  '203': 'America/New_York',
  '475': 'America/New_York',
  '860': 'America/New_York',
  '959': 'America/New_York',
  // Delaware
  '302': 'America/New_York',
  // District of Columbia
  '202': 'America/New_York',
  // Florida (peninsula — panhandle codes 850/448 are Central, see below)
  '239': 'America/New_York',
  '305': 'America/New_York',
  '321': 'America/New_York',
  '352': 'America/New_York',
  '386': 'America/New_York',
  '407': 'America/New_York',
  '561': 'America/New_York',
  '656': 'America/New_York',
  '689': 'America/New_York',
  '727': 'America/New_York',
  '754': 'America/New_York',
  '772': 'America/New_York',
  '786': 'America/New_York',
  '813': 'America/New_York',
  '863': 'America/New_York',
  '904': 'America/New_York',
  '941': 'America/New_York',
  '954': 'America/New_York',
  // Georgia
  '229': 'America/New_York',
  '404': 'America/New_York',
  '470': 'America/New_York',
  '478': 'America/New_York',
  '678': 'America/New_York',
  '706': 'America/New_York',
  '762': 'America/New_York',
  '770': 'America/New_York',
  '912': 'America/New_York',
  '943': 'America/New_York',
  // Indiana (Eastern portion — 219 is Central, see below)
  '260': 'America/Indiana/Indianapolis',
  '317': 'America/Indiana/Indianapolis',
  '463': 'America/Indiana/Indianapolis',
  '574': 'America/Indiana/Indianapolis',
  '765': 'America/Indiana/Indianapolis',
  // 812/930 span Bloomington (Eastern) and Evansville (Central); Eastern is larger
  '812': 'America/Indiana/Indianapolis',
  '930': 'America/Indiana/Indianapolis',
  // Kentucky (Eastern portion — 270/364 are Central, see below)
  '502': 'America/Kentucky/Louisville',
  '606': 'America/New_York',
  '859': 'America/Kentucky/Louisville',
  // Maine
  '207': 'America/New_York',
  // Maryland
  '227': 'America/New_York',
  '240': 'America/New_York',
  '301': 'America/New_York',
  '410': 'America/New_York',
  '443': 'America/New_York',
  '667': 'America/New_York',
  // Massachusetts
  '339': 'America/New_York',
  '351': 'America/New_York',
  '413': 'America/New_York',
  '508': 'America/New_York',
  '617': 'America/New_York',
  '774': 'America/New_York',
  '781': 'America/New_York',
  '857': 'America/New_York',
  '978': 'America/New_York',
  // Michigan (906 covers the UP; Menominee County is Central but tiny)
  '231': 'America/Detroit',
  '248': 'America/Detroit',
  '269': 'America/Detroit',
  '313': 'America/Detroit',
  '517': 'America/Detroit',
  '586': 'America/Detroit',
  '616': 'America/Detroit',
  '679': 'America/Detroit',
  '734': 'America/Detroit',
  '810': 'America/Detroit',
  '906': 'America/Detroit',
  '947': 'America/Detroit',
  '989': 'America/Detroit',
  // New Hampshire
  '603': 'America/New_York',
  // New Jersey
  '201': 'America/New_York',
  '551': 'America/New_York',
  '609': 'America/New_York',
  '640': 'America/New_York',
  '732': 'America/New_York',
  '848': 'America/New_York',
  '856': 'America/New_York',
  '862': 'America/New_York',
  '908': 'America/New_York',
  '973': 'America/New_York',
  // New York
  '212': 'America/New_York',
  '315': 'America/New_York',
  '332': 'America/New_York',
  '347': 'America/New_York',
  '516': 'America/New_York',
  '518': 'America/New_York',
  '585': 'America/New_York',
  '607': 'America/New_York',
  '631': 'America/New_York',
  '646': 'America/New_York',
  '680': 'America/New_York',
  '716': 'America/New_York',
  '718': 'America/New_York',
  '838': 'America/New_York',
  '845': 'America/New_York',
  '914': 'America/New_York',
  '917': 'America/New_York',
  '929': 'America/New_York',
  '934': 'America/New_York',
  // North Carolina
  '252': 'America/New_York',
  '336': 'America/New_York',
  '704': 'America/New_York',
  '743': 'America/New_York',
  '828': 'America/New_York',
  '910': 'America/New_York',
  '919': 'America/New_York',
  '980': 'America/New_York',
  '984': 'America/New_York',
  // Ohio
  '216': 'America/New_York',
  '220': 'America/New_York',
  '234': 'America/New_York',
  '326': 'America/New_York',
  '330': 'America/New_York',
  '380': 'America/New_York',
  '419': 'America/New_York',
  '440': 'America/New_York',
  '513': 'America/New_York',
  '567': 'America/New_York',
  '614': 'America/New_York',
  '740': 'America/New_York',
  '937': 'America/New_York',
  // Pennsylvania
  '215': 'America/New_York',
  '223': 'America/New_York',
  '267': 'America/New_York',
  '272': 'America/New_York',
  '412': 'America/New_York',
  '445': 'America/New_York',
  '484': 'America/New_York',
  '570': 'America/New_York',
  '582': 'America/New_York',
  '610': 'America/New_York',
  '717': 'America/New_York',
  '724': 'America/New_York',
  '814': 'America/New_York',
  '835': 'America/New_York',
  '878': 'America/New_York',
  // Rhode Island
  '401': 'America/New_York',
  // South Carolina
  '803': 'America/New_York',
  '821': 'America/New_York',
  '843': 'America/New_York',
  '854': 'America/New_York',
  '864': 'America/New_York',
  // Tennessee (Eastern portion — Knoxville / Chattanooga)
  '423': 'America/New_York',
  '865': 'America/New_York',
  // Vermont
  '802': 'America/New_York',
  // Virginia
  '276': 'America/New_York',
  '434': 'America/New_York',
  '540': 'America/New_York',
  '571': 'America/New_York',
  '703': 'America/New_York',
  '757': 'America/New_York',
  '804': 'America/New_York',
  '826': 'America/New_York',
  '948': 'America/New_York',
  // West Virginia
  '304': 'America/New_York',
  '681': 'America/New_York',
  // Canada — Ontario & Quebec
  '226': 'America/Toronto',
  '249': 'America/Toronto',
  '289': 'America/Toronto',
  '343': 'America/Toronto',
  '365': 'America/Toronto',
  '367': 'America/Toronto',
  '382': 'America/Toronto',
  '416': 'America/Toronto',
  '418': 'America/Toronto',
  '437': 'America/Toronto',
  '438': 'America/Toronto',
  '450': 'America/Toronto',
  '468': 'America/Toronto',
  '514': 'America/Toronto',
  '519': 'America/Toronto',
  '548': 'America/Toronto',
  '579': 'America/Toronto',
  '581': 'America/Toronto',
  '613': 'America/Toronto',
  '647': 'America/Toronto',
  '683': 'America/Toronto',
  '705': 'America/Toronto',
  '742': 'America/Toronto',
  '753': 'America/Toronto',
  '807': 'America/Toronto',
  '819': 'America/Toronto',
  '873': 'America/Toronto',
  '905': 'America/Toronto',
  '942': 'America/Toronto',

  // ── Central ──────────────────────────────────────────────────────────────
  // Alabama
  '205': 'America/Chicago',
  '251': 'America/Chicago',
  '256': 'America/Chicago',
  '334': 'America/Chicago',
  '659': 'America/Chicago',
  '938': 'America/Chicago',
  // Arkansas
  '327': 'America/Chicago',
  '479': 'America/Chicago',
  '501': 'America/Chicago',
  '870': 'America/Chicago',
  // Florida panhandle
  '448': 'America/Chicago',
  '850': 'America/Chicago',
  // Illinois
  '217': 'America/Chicago',
  '224': 'America/Chicago',
  '309': 'America/Chicago',
  '312': 'America/Chicago',
  '331': 'America/Chicago',
  '447': 'America/Chicago',
  '464': 'America/Chicago',
  '618': 'America/Chicago',
  '630': 'America/Chicago',
  '708': 'America/Chicago',
  '730': 'America/Chicago',
  '773': 'America/Chicago',
  '779': 'America/Chicago',
  '815': 'America/Chicago',
  '847': 'America/Chicago',
  '861': 'America/Chicago',
  '872': 'America/Chicago',
  // Indiana (Central portion — Gary / NW Indiana)
  '219': 'America/Chicago',
  // Iowa
  '319': 'America/Chicago',
  '515': 'America/Chicago',
  '563': 'America/Chicago',
  '641': 'America/Chicago',
  '712': 'America/Chicago',
  // Kansas (620 reaches into Mountain in the far west; Central dominates)
  '316': 'America/Chicago',
  '620': 'America/Chicago',
  '785': 'America/Chicago',
  '913': 'America/Chicago',
  // Kentucky (Central portion)
  '270': 'America/Chicago',
  '364': 'America/Chicago',
  // Louisiana
  '225': 'America/Chicago',
  '318': 'America/Chicago',
  '337': 'America/Chicago',
  '504': 'America/Chicago',
  '985': 'America/Chicago',
  // Minnesota
  '218': 'America/Chicago',
  '320': 'America/Chicago',
  '507': 'America/Chicago',
  '612': 'America/Chicago',
  '651': 'America/Chicago',
  '763': 'America/Chicago',
  '952': 'America/Chicago',
  // Mississippi
  '228': 'America/Chicago',
  '601': 'America/Chicago',
  '662': 'America/Chicago',
  '769': 'America/Chicago',
  // Missouri
  '314': 'America/Chicago',
  '417': 'America/Chicago',
  '557': 'America/Chicago',
  '573': 'America/Chicago',
  '636': 'America/Chicago',
  '660': 'America/Chicago',
  '816': 'America/Chicago',
  '975': 'America/Chicago',
  // Nebraska (308 reaches Mountain in the panhandle; Central dominates)
  '308': 'America/Chicago',
  '402': 'America/Chicago',
  '531': 'America/Chicago',
  // North Dakota (701 reaches Mountain in the southwest; Central dominates)
  '701': 'America/Chicago',
  // Oklahoma
  '405': 'America/Chicago',
  '539': 'America/Chicago',
  '572': 'America/Chicago',
  '580': 'America/Chicago',
  '918': 'America/Chicago',
  // South Dakota (605 splits roughly east/west; Central holds the population)
  '605': 'America/Chicago',
  // Tennessee (Central portion — Nashville / Memphis)
  '615': 'America/Chicago',
  '629': 'America/Chicago',
  '731': 'America/Chicago',
  '901': 'America/Chicago',
  '931': 'America/Chicago',
  // Texas (Central — 915 El Paso is Mountain, see below)
  '210': 'America/Chicago',
  '214': 'America/Chicago',
  '254': 'America/Chicago',
  '281': 'America/Chicago',
  '325': 'America/Chicago',
  '346': 'America/Chicago',
  '361': 'America/Chicago',
  '409': 'America/Chicago',
  '430': 'America/Chicago',
  '432': 'America/Chicago',
  '469': 'America/Chicago',
  '512': 'America/Chicago',
  '682': 'America/Chicago',
  '713': 'America/Chicago',
  '726': 'America/Chicago',
  '737': 'America/Chicago',
  '806': 'America/Chicago',
  '817': 'America/Chicago',
  '830': 'America/Chicago',
  '832': 'America/Chicago',
  '903': 'America/Chicago',
  '936': 'America/Chicago',
  '940': 'America/Chicago',
  '945': 'America/Chicago',
  '956': 'America/Chicago',
  '972': 'America/Chicago',
  '979': 'America/Chicago',
  // Wisconsin
  '262': 'America/Chicago',
  '274': 'America/Chicago',
  '353': 'America/Chicago',
  '414': 'America/Chicago',
  '534': 'America/Chicago',
  '608': 'America/Chicago',
  '715': 'America/Chicago',
  '920': 'America/Chicago',
  // Canada — Manitoba
  '204': 'America/Winnipeg',
  '431': 'America/Winnipeg',
  // Canada — Saskatchewan (no DST)
  '306': 'America/Regina',
  '639': 'America/Regina',

  // ── Mountain ─────────────────────────────────────────────────────────────
  // Arizona (no DST)
  '480': 'America/Phoenix',
  '520': 'America/Phoenix',
  '602': 'America/Phoenix',
  '623': 'America/Phoenix',
  '928': 'America/Phoenix',
  // Colorado
  '303': 'America/Denver',
  '719': 'America/Denver',
  '720': 'America/Denver',
  '970': 'America/Denver',
  '983': 'America/Denver',
  // Idaho (the northern panhandle is Pacific; the south holds the population)
  '208': 'America/Boise',
  '986': 'America/Boise',
  // Montana
  '406': 'America/Denver',
  // New Mexico
  '505': 'America/Denver',
  '575': 'America/Denver',
  // Texas — El Paso
  '915': 'America/Denver',
  // Utah
  '385': 'America/Denver',
  '801': 'America/Denver',
  // Wyoming
  '307': 'America/Denver',
  // Canada — Alberta
  '368': 'America/Edmonton',
  '403': 'America/Edmonton',
  '587': 'America/Edmonton',
  '780': 'America/Edmonton',
  '825': 'America/Edmonton',

  // ── Pacific ──────────────────────────────────────────────────────────────
  // California
  '209': 'America/Los_Angeles',
  '213': 'America/Los_Angeles',
  '279': 'America/Los_Angeles',
  '310': 'America/Los_Angeles',
  '323': 'America/Los_Angeles',
  '341': 'America/Los_Angeles',
  '350': 'America/Los_Angeles',
  '369': 'America/Los_Angeles',
  '408': 'America/Los_Angeles',
  '415': 'America/Los_Angeles',
  '424': 'America/Los_Angeles',
  '442': 'America/Los_Angeles',
  '510': 'America/Los_Angeles',
  '530': 'America/Los_Angeles',
  '559': 'America/Los_Angeles',
  '562': 'America/Los_Angeles',
  '619': 'America/Los_Angeles',
  '626': 'America/Los_Angeles',
  '628': 'America/Los_Angeles',
  '650': 'America/Los_Angeles',
  '657': 'America/Los_Angeles',
  '661': 'America/Los_Angeles',
  '669': 'America/Los_Angeles',
  '707': 'America/Los_Angeles',
  '714': 'America/Los_Angeles',
  '738': 'America/Los_Angeles',
  '747': 'America/Los_Angeles',
  '760': 'America/Los_Angeles',
  '764': 'America/Los_Angeles',
  '805': 'America/Los_Angeles',
  '818': 'America/Los_Angeles',
  '820': 'America/Los_Angeles',
  '831': 'America/Los_Angeles',
  '840': 'America/Los_Angeles',
  '858': 'America/Los_Angeles',
  '909': 'America/Los_Angeles',
  '916': 'America/Los_Angeles',
  '925': 'America/Los_Angeles',
  '949': 'America/Los_Angeles',
  '951': 'America/Los_Angeles',
  // Nevada
  '702': 'America/Los_Angeles',
  '725': 'America/Los_Angeles',
  '775': 'America/Los_Angeles',
  // Oregon (541/458 reach into Mountain in the far east; Pacific dominates)
  '458': 'America/Los_Angeles',
  '503': 'America/Los_Angeles',
  '541': 'America/Los_Angeles',
  '971': 'America/Los_Angeles',
  // Washington
  '206': 'America/Los_Angeles',
  '253': 'America/Los_Angeles',
  '360': 'America/Los_Angeles',
  '425': 'America/Los_Angeles',
  '509': 'America/Los_Angeles',
  '564': 'America/Los_Angeles',
  // Canada — British Columbia
  '236': 'America/Vancouver',
  '250': 'America/Vancouver',
  '604': 'America/Vancouver',
  '672': 'America/Vancouver',
  '778': 'America/Vancouver',

  // ── Outside the four dial buckets ────────────────────────────────────────
  // Alaska
  '907': 'America/Anchorage',
  // Hawaii
  '808': 'Pacific/Honolulu',
  // Canada — Atlantic & North
  '506': 'America/Moncton',
  '709': 'America/St_Johns',
  '782': 'America/Halifax',
  '867': 'America/Whitehorse',
  '902': 'America/Halifax',
  // US territories
  '340': 'America/St_Thomas',
  '670': 'Pacific/Saipan',
  '671': 'Pacific/Guam',
  '684': 'Pacific/Pago_Pago',
  '787': 'America/Puerto_Rico',
  '939': 'America/Puerto_Rico',
  // Caribbean NANP
  '242': 'America/Nassau',
  '246': 'America/Barbados',
  '264': 'America/Anguilla',
  '268': 'America/Antigua',
  '284': 'America/Tortola',
  '345': 'America/Cayman',
  '441': 'Atlantic/Bermuda',
  '473': 'America/Grenada',
  '649': 'America/Grand_Turk',
  '658': 'America/Jamaica',
  '664': 'America/Montserrat',
  '721': 'America/Lower_Princes',
  '758': 'America/St_Lucia',
  '767': 'America/Dominica',
  '784': 'America/St_Vincent',
  '809': 'America/Santo_Domingo',
  '829': 'America/Santo_Domingo',
  '849': 'America/Santo_Domingo',
  '868': 'America/Port_of_Spain',
  '869': 'America/St_Kitts',
  '876': 'America/Jamaica',
}

/** Metro / city name → IANA timezone. Matched after normalization. */
const CITY_TIMEZONE_MAP: Record<string, string> = {
  // US — Eastern
  'new york': 'America/New_York',
  'new york city': 'America/New_York',
  nyc: 'America/New_York',
  manhattan: 'America/New_York',
  brooklyn: 'America/New_York',
  queens: 'America/New_York',
  bronx: 'America/New_York',
  'staten island': 'America/New_York',
  boston: 'America/New_York',
  cambridge: 'America/New_York',
  philadelphia: 'America/New_York',
  miami: 'America/New_York',
  'miami beach': 'America/New_York',
  'fort lauderdale': 'America/New_York',
  'west palm beach': 'America/New_York',
  'boca raton': 'America/New_York',
  atlanta: 'America/New_York',
  washington: 'America/New_York',
  'washington dc': 'America/New_York',
  'washington, dc': 'America/New_York',
  dc: 'America/New_York',
  arlington: 'America/New_York',
  alexandria: 'America/New_York',
  charlotte: 'America/New_York',
  raleigh: 'America/New_York',
  durham: 'America/New_York',
  greensboro: 'America/New_York',
  pittsburgh: 'America/New_York',
  detroit: 'America/Detroit',
  'detroit metropolitan': 'America/Detroit',
  'ann arbor': 'America/Detroit',
  troy: 'America/Detroit',
  cleveland: 'America/New_York',
  columbus: 'America/New_York',
  akron: 'America/New_York',
  dayton: 'America/New_York',
  toledo: 'America/New_York',
  jacksonville: 'America/New_York',
  orlando: 'America/New_York',
  tampa: 'America/New_York',
  'st petersburg': 'America/New_York',
  sarasota: 'America/New_York',
  naples: 'America/New_York',
  richmond: 'America/New_York',
  norfolk: 'America/New_York',
  'virginia beach': 'America/New_York',
  baltimore: 'America/New_York',
  hartford: 'America/New_York',
  stamford: 'America/New_York',
  'new haven': 'America/New_York',
  greenwich: 'America/New_York',
  providence: 'America/New_York',
  buffalo: 'America/New_York',
  rochester: 'America/New_York',
  syracuse: 'America/New_York',
  albany: 'America/New_York',
  'grand rapids': 'America/Detroit',
  indianapolis: 'America/Indiana/Indianapolis',
  cincinnati: 'America/New_York',
  louisville: 'America/Kentucky/Louisville',
  lexington: 'America/Kentucky/Louisville',
  knoxville: 'America/New_York',
  chattanooga: 'America/New_York',
  greenville: 'America/New_York',
  columbia: 'America/New_York',
  charleston: 'America/New_York',
  savannah: 'America/New_York',
  augusta: 'America/New_York',
  portland_me: 'America/New_York',
  princeton: 'America/New_York',
  newark: 'America/New_York',
  'jersey city': 'America/New_York',
  trenton: 'America/New_York',
  wilmington: 'America/New_York',
  allentown: 'America/New_York',
  harrisburg: 'America/New_York',
  scranton: 'America/New_York',
  // US — Central
  chicago: 'America/Chicago',
  naperville: 'America/Chicago',
  evanston: 'America/Chicago',
  dallas: 'America/Chicago',
  'fort worth': 'America/Chicago',
  plano: 'America/Chicago',
  irving: 'America/Chicago',
  houston: 'America/Chicago',
  austin: 'America/Chicago',
  'san antonio': 'America/Chicago',
  minneapolis: 'America/Chicago',
  'st paul': 'America/Chicago',
  'saint paul': 'America/Chicago',
  'st. louis': 'America/Chicago',
  'saint louis': 'America/Chicago',
  'st louis': 'America/Chicago',
  'kansas city': 'America/Chicago',
  milwaukee: 'America/Chicago',
  madison: 'America/Chicago',
  memphis: 'America/Chicago',
  nashville: 'America/Chicago',
  'new orleans': 'America/Chicago',
  'baton rouge': 'America/Chicago',
  'oklahoma city': 'America/Chicago',
  tulsa: 'America/Chicago',
  omaha: 'America/Chicago',
  lincoln: 'America/Chicago',
  'des moines': 'America/Chicago',
  wichita: 'America/Chicago',
  birmingham: 'America/Chicago',
  huntsville: 'America/Chicago',
  montgomery: 'America/Chicago',
  mobile: 'America/Chicago',
  jackson: 'America/Chicago',
  'little rock': 'America/Chicago',
  fargo: 'America/Chicago',
  'sioux falls': 'America/Chicago',
  springfield: 'America/Chicago',
  peoria: 'America/Chicago',
  'green bay': 'America/Chicago',
  // US — Mountain
  denver: 'America/Denver',
  boulder: 'America/Denver',
  aurora: 'America/Denver',
  'colorado springs': 'America/Denver',
  'fort collins': 'America/Denver',
  phoenix: 'America/Phoenix',
  scottsdale: 'America/Phoenix',
  mesa: 'America/Phoenix',
  chandler: 'America/Phoenix',
  tempe: 'America/Phoenix',
  tucson: 'America/Phoenix',
  'salt lake city': 'America/Denver',
  provo: 'America/Denver',
  ogden: 'America/Denver',
  albuquerque: 'America/Denver',
  'santa fe': 'America/Denver',
  boise: 'America/Boise',
  billings: 'America/Denver',
  bozeman: 'America/Denver',
  missoula: 'America/Denver',
  cheyenne: 'America/Denver',
  'el paso': 'America/Denver',
  // US — Pacific
  'los angeles': 'America/Los_Angeles',
  hollywood: 'America/Los_Angeles',
  'santa monica': 'America/Los_Angeles',
  pasadena: 'America/Los_Angeles',
  burbank: 'America/Los_Angeles',
  'long beach': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  oakland: 'America/Los_Angeles',
  berkeley: 'America/Los_Angeles',
  'palo alto': 'America/Los_Angeles',
  'mountain view': 'America/Los_Angeles',
  sunnyvale: 'America/Los_Angeles',
  'santa clara': 'America/Los_Angeles',
  'redwood city': 'America/Los_Angeles',
  'menlo park': 'America/Los_Angeles',
  'san mateo': 'America/Los_Angeles',
  orinda: 'America/Los_Angeles',
  'walnut creek': 'America/Los_Angeles',
  seattle: 'America/Los_Angeles',
  bellevue: 'America/Los_Angeles',
  redmond: 'America/Los_Angeles',
  tacoma: 'America/Los_Angeles',
  spokane: 'America/Los_Angeles',
  portland: 'America/Los_Angeles',
  eugene: 'America/Los_Angeles',
  salem: 'America/Los_Angeles',
  beaverton: 'America/Los_Angeles',
  'san diego': 'America/Los_Angeles',
  'san jose': 'America/Los_Angeles',
  sacramento: 'America/Los_Angeles',
  fresno: 'America/Los_Angeles',
  bakersfield: 'America/Los_Angeles',
  irvine: 'America/Los_Angeles',
  anaheim: 'America/Los_Angeles',
  'newport beach': 'America/Los_Angeles',
  'costa mesa': 'America/Los_Angeles',
  'santa ana': 'America/Los_Angeles',
  'santa barbara': 'America/Los_Angeles',
  riverside: 'America/Los_Angeles',
  'las vegas': 'America/Los_Angeles',
  henderson: 'America/Los_Angeles',
  reno: 'America/Los_Angeles',
  'bay area': 'America/Los_Angeles',
  'san francisco bay': 'America/Los_Angeles',
  'silicon valley': 'America/Los_Angeles',
  'greater los angeles': 'America/Los_Angeles',
  'greater seattle': 'America/Los_Angeles',
  // US — Other
  honolulu: 'Pacific/Honolulu',
  anchorage: 'America/Anchorage',
  'san juan': 'America/Puerto_Rico',
  // Canada
  toronto: 'America/Toronto',
  mississauga: 'America/Toronto',
  brampton: 'America/Toronto',
  hamilton: 'America/Toronto',
  'greater toronto': 'America/Toronto',
  vancouver: 'America/Vancouver',
  burnaby: 'America/Vancouver',
  victoria: 'America/Vancouver',
  montreal: 'America/Toronto',
  'quebec city': 'America/Toronto',
  calgary: 'America/Edmonton',
  edmonton: 'America/Edmonton',
  ottawa: 'America/Toronto',
  winnipeg: 'America/Winnipeg',
  saskatoon: 'America/Regina',
  regina: 'America/Regina',
  halifax: 'America/Halifax',
  // UK & Europe
  london: 'Europe/London',
  manchester: 'Europe/London',
  birmingham_uk: 'Europe/London',
  leeds: 'Europe/London',
  glasgow: 'Europe/London',
  edinburgh: 'Europe/London',
  bristol: 'Europe/London',
  paris: 'Europe/Paris',
  lyon: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  hamburg: 'Europe/Berlin',
  frankfurt: 'Europe/Berlin',
  cologne: 'Europe/Berlin',
  amsterdam: 'Europe/Amsterdam',
  rotterdam: 'Europe/Amsterdam',
  'the hague': 'Europe/Amsterdam',
  dublin: 'Europe/Dublin',
  madrid: 'Europe/Madrid',
  barcelona: 'Europe/Madrid',
  valencia: 'Europe/Madrid',
  rome: 'Europe/Rome',
  milan: 'Europe/Rome',
  zurich: 'Europe/Zurich',
  geneva: 'Europe/Zurich',
  munich: 'Europe/Berlin',
  stockholm: 'Europe/Stockholm',
  copenhagen: 'Europe/Copenhagen',
  oslo: 'Europe/Oslo',
  helsinki: 'Europe/Helsinki',
  vienna: 'Europe/Vienna',
  brussels: 'Europe/Brussels',
  lisbon: 'Europe/Lisbon',
  porto: 'Europe/Lisbon',
  warsaw: 'Europe/Warsaw',
  krakow: 'Europe/Warsaw',
  prague: 'Europe/Prague',
  budapest: 'Europe/Budapest',
  bucharest: 'Europe/Bucharest',
  athens: 'Europe/Athens',
  istanbul: 'Europe/Istanbul',
  // Asia-Pacific
  singapore: 'Asia/Singapore',
  'hong kong': 'Asia/Hong_Kong',
  tokyo: 'Asia/Tokyo',
  osaka: 'Asia/Tokyo',
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
  brisbane: 'Australia/Brisbane',
  perth: 'Australia/Perth',
  auckland: 'Pacific/Auckland',
  mumbai: 'Asia/Kolkata',
  bangalore: 'Asia/Kolkata',
  bengaluru: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  'new delhi': 'Asia/Kolkata',
  gurgaon: 'Asia/Kolkata',
  noida: 'Asia/Kolkata',
  hyderabad: 'Asia/Kolkata',
  chennai: 'Asia/Kolkata',
  pune: 'Asia/Kolkata',
  shanghai: 'Asia/Shanghai',
  beijing: 'Asia/Shanghai',
  shenzhen: 'Asia/Shanghai',
  dubai: 'Asia/Dubai',
  'abu dhabi': 'Asia/Dubai',
  'tel aviv': 'Asia/Jerusalem',
  jerusalem: 'Asia/Jerusalem',
  seoul: 'Asia/Seoul',
  taipei: 'Asia/Taipei',
  bangkok: 'Asia/Bangkok',
  jakarta: 'Asia/Jakarta',
  manila: 'Asia/Manila',
  'ho chi minh city': 'Asia/Ho_Chi_Minh',
  hanoi: 'Asia/Ho_Chi_Minh',
  'kuala lumpur': 'Asia/Kuala_Lumpur',
  // Latin America
  'sao paulo': 'America/Sao_Paulo',
  'são paulo': 'America/Sao_Paulo',
  'rio de janeiro': 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'mexico city': 'America/Mexico_City',
  guadalajara: 'America/Mexico_City',
  monterrey: 'America/Monterrey',
  bogota: 'America/Bogota',
  bogotá: 'America/Bogota',
  medellin: 'America/Bogota',
  lima: 'America/Lima',
  santiago: 'America/Santiago',
  montevideo: 'America/Montevideo',
  'san jose costa rica': 'America/Costa_Rica',
  panama: 'America/Panama',
  // Africa & Middle East
  cairo: 'Africa/Cairo',
  johannesburg: 'Africa/Johannesburg',
  'cape town': 'Africa/Johannesburg',
  lagos: 'Africa/Lagos',
  nairobi: 'Africa/Nairobi',
}

/** US state / Canadian province → IANA timezone (dominant zone). */
const STATE_TIMEZONE_MAP: Record<string, string> = {
  // Eastern
  connecticut: 'America/New_York',
  ct: 'America/New_York',
  delaware: 'America/New_York',
  de: 'America/New_York',
  florida: 'America/New_York',
  fl: 'America/New_York',
  georgia: 'America/New_York',
  ga: 'America/New_York',
  maine: 'America/New_York',
  me: 'America/New_York',
  maryland: 'America/New_York',
  md: 'America/New_York',
  massachusetts: 'America/New_York',
  ma: 'America/New_York',
  michigan: 'America/Detroit',
  mi: 'America/Detroit',
  'new hampshire': 'America/New_York',
  nh: 'America/New_York',
  'new jersey': 'America/New_York',
  nj: 'America/New_York',
  'new york': 'America/New_York',
  ny: 'America/New_York',
  'north carolina': 'America/New_York',
  nc: 'America/New_York',
  ohio: 'America/New_York',
  oh: 'America/New_York',
  pennsylvania: 'America/New_York',
  pa: 'America/New_York',
  'rhode island': 'America/New_York',
  ri: 'America/New_York',
  'south carolina': 'America/New_York',
  sc: 'America/New_York',
  vermont: 'America/New_York',
  vt: 'America/New_York',
  virginia: 'America/New_York',
  va: 'America/New_York',
  'west virginia': 'America/New_York',
  wv: 'America/New_York',
  'district of columbia': 'America/New_York',
  dc: 'America/New_York',
  // Central
  alabama: 'America/Chicago',
  al: 'America/Chicago',
  arkansas: 'America/Chicago',
  ar: 'America/Chicago',
  illinois: 'America/Chicago',
  il: 'America/Chicago',
  iowa: 'America/Chicago',
  ia: 'America/Chicago',
  kansas: 'America/Chicago',
  ks: 'America/Chicago',
  louisiana: 'America/Chicago',
  la: 'America/Chicago',
  minnesota: 'America/Chicago',
  mn: 'America/Chicago',
  mississippi: 'America/Chicago',
  ms: 'America/Chicago',
  missouri: 'America/Chicago',
  mo: 'America/Chicago',
  nebraska: 'America/Chicago',
  ne: 'America/Chicago',
  'north dakota': 'America/Chicago',
  nd: 'America/Chicago',
  oklahoma: 'America/Chicago',
  ok: 'America/Chicago',
  'south dakota': 'America/Chicago',
  sd: 'America/Chicago',
  tennessee: 'America/Chicago',
  tn: 'America/Chicago',
  texas: 'America/Chicago',
  tx: 'America/Chicago',
  wisconsin: 'America/Chicago',
  wi: 'America/Chicago',
  // Mountain
  arizona: 'America/Phoenix',
  az: 'America/Phoenix',
  colorado: 'America/Denver',
  co: 'America/Denver',
  idaho: 'America/Boise',
  id: 'America/Boise',
  montana: 'America/Denver',
  mt: 'America/Denver',
  'new mexico': 'America/Denver',
  nm: 'America/Denver',
  utah: 'America/Denver',
  ut: 'America/Denver',
  wyoming: 'America/Denver',
  wy: 'America/Denver',
  // Pacific
  california: 'America/Los_Angeles',
  ca: 'America/Los_Angeles',
  nevada: 'America/Los_Angeles',
  nv: 'America/Los_Angeles',
  oregon: 'America/Los_Angeles',
  or: 'America/Los_Angeles',
  washington: 'America/Los_Angeles',
  wa: 'America/Los_Angeles',
  // Non-contiguous
  alaska: 'America/Anchorage',
  ak: 'America/Anchorage',
  hawaii: 'Pacific/Honolulu',
  hi: 'Pacific/Honolulu',
  'puerto rico': 'America/Puerto_Rico',
  pr: 'America/Puerto_Rico',
  // Split states, assigned to their dominant zone
  indiana: 'America/Indiana/Indianapolis',
  in: 'America/Indiana/Indianapolis',
  kentucky: 'America/Kentucky/Louisville',
  ky: 'America/Kentucky/Louisville',
  // Canadian provinces
  ontario: 'America/Toronto',
  on: 'America/Toronto',
  quebec: 'America/Toronto',
  qc: 'America/Toronto',
  'british columbia': 'America/Vancouver',
  bc: 'America/Vancouver',
  alberta: 'America/Edmonton',
  ab: 'America/Edmonton',
  manitoba: 'America/Winnipeg',
  mb: 'America/Winnipeg',
  saskatchewan: 'America/Regina',
  sk: 'America/Regina',
  'nova scotia': 'America/Halifax',
  ns: 'America/Halifax',
  'new brunswick': 'America/Moncton',
  nb: 'America/Moncton',
  newfoundland: 'America/St_Johns',
  nl: 'America/St_Johns',
}

/** Country name → IANA timezone, for locations that name only a country. */
const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  'united kingdom': 'Europe/London',
  uk: 'Europe/London',
  england: 'Europe/London',
  scotland: 'Europe/London',
  wales: 'Europe/London',
  ireland: 'Europe/Dublin',
  france: 'Europe/Paris',
  germany: 'Europe/Berlin',
  netherlands: 'Europe/Amsterdam',
  spain: 'Europe/Madrid',
  italy: 'Europe/Rome',
  switzerland: 'Europe/Zurich',
  sweden: 'Europe/Stockholm',
  denmark: 'Europe/Copenhagen',
  norway: 'Europe/Oslo',
  finland: 'Europe/Helsinki',
  austria: 'Europe/Vienna',
  belgium: 'Europe/Brussels',
  portugal: 'Europe/Lisbon',
  poland: 'Europe/Warsaw',
  'czech republic': 'Europe/Prague',
  czechia: 'Europe/Prague',
  israel: 'Asia/Jerusalem',
  india: 'Asia/Kolkata',
  singapore: 'Asia/Singapore',
  japan: 'Asia/Tokyo',
  china: 'Asia/Shanghai',
  'south korea': 'Asia/Seoul',
  australia: 'Australia/Sydney',
  'new zealand': 'Pacific/Auckland',
  brazil: 'America/Sao_Paulo',
  argentina: 'America/Argentina/Buenos_Aires',
  mexico: 'America/Mexico_City',
  colombia: 'America/Bogota',
  chile: 'America/Santiago',
  peru: 'America/Lima',
  philippines: 'Asia/Manila',
  vietnam: 'Asia/Ho_Chi_Minh',
  thailand: 'Asia/Bangkok',
  indonesia: 'Asia/Jakarta',
  malaysia: 'Asia/Kuala_Lumpur',
  'united arab emirates': 'Asia/Dubai',
  uae: 'Asia/Dubai',
  'south africa': 'Africa/Johannesburg',
  nigeria: 'Africa/Lagos',
  kenya: 'Africa/Nairobi',
  egypt: 'Africa/Cairo',
}

/**
 * Country suffixes that carry no sub-national information and should be
 * stripped before city/state matching, but remembered as a last-resort signal.
 */
const STRIPPABLE_COUNTRY_SUFFIXES = [
  'united states of america',
  'united states',
  'usa',
  'u.s.a.',
  'u.s.',
  'us',
  'canada',
]

const normalizeLocation = (location: string): string =>
  location
    .toLowerCase()
    .trim()
    // LinkedIn-style metro qualifiers
    .replace(/\bgreater\s+/g, '')
    .replace(/\s*metropolitan\s+area\b/g, '')
    .replace(/\s*metro\s+area\b/g, '')
    .replace(/\s*metropolitan\s+region\b/g, '')
    .replace(/\s+area\s*$/, '')
    .replace(/\s+region\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Match a free-text location string to an IANA timezone using the static
 * tables. Handles the shapes this database actually contains, e.g.
 * "Manhattan, New York, United States" and "California, United States".
 */
export const lookupTimezoneFromLocation = (location: string): string | null => {
  if (!location) return null

  const normalized = normalizeLocation(location)
  if (!normalized) return null

  const rawParts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  // Peel trailing country tokens, keeping the last one seen as a fallback.
  const parts = [...rawParts]
  let countryHint: string | null = null
  while (
    parts.length > 1 &&
    STRIPPABLE_COUNTRY_SUFFIXES.includes(parts[parts.length - 1])
  ) {
    countryHint = parts.pop() as string
  }

  // Whole-string city match ("bay area", "silicon valley")
  const rejoined = parts.join(', ')
  if (CITY_TIMEZONE_MAP[rejoined]) return CITY_TIMEZONE_MAP[rejoined]

  // Leading token is usually the city: "manhattan, new york"
  if (parts.length && CITY_TIMEZONE_MAP[parts[0]]) {
    return CITY_TIMEZONE_MAP[parts[0]]
  }

  // Any remaining token may be a state/province: "orinda, california"
  for (let i = parts.length - 1; i >= 0; i--) {
    const candidate = parts[i]
    if (STATE_TIMEZONE_MAP[candidate]) return STATE_TIMEZONE_MAP[candidate]
  }

  // Any remaining token may still be a city we know ("... , san francisco")
  for (let i = parts.length - 1; i >= 1; i--) {
    const candidate = parts[i]
    if (CITY_TIMEZONE_MAP[candidate]) return CITY_TIMEZONE_MAP[candidate]
  }

  // Country-only locations ("United Kingdom") — check both the surviving
  // tokens and any suffix we peeled off.
  for (const candidate of [...parts, countryHint].filter(Boolean) as string[]) {
    if (COUNTRY_TIMEZONE_MAP[candidate]) {
      return COUNTRY_TIMEZONE_MAP[candidate]
    }
  }

  return null
}

/**
 * Derive a timezone from a phone number's NANP area code.
 *
 * Accepts any common formatting (E.164, dashed, parenthesised). Returns null
 * for non-NANP numbers, toll-free/premium codes, and anything malformed.
 */
export const lookupTimezoneFromPhone = (
  phone?: string | null,
): string | null => {
  if (!phone) return null

  let digits = phone.replace(/\D/g, '')

  // Strip the NANP country code when present.
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1)
  }

  // Anything that isn't a bare 10-digit NANP number is out of scope —
  // an international number's country code says nothing we can index here.
  if (digits.length !== 10) return null

  const areaCode = digits.slice(0, 3)

  // Valid NANP area codes never start with 0 or 1, and N11 codes are services.
  if (areaCode[0] === '0' || areaCode[0] === '1') return null
  if (areaCode[1] === '1' && areaCode[2] === '1') return null

  return AREA_CODE_TIMEZONE[areaCode] ?? null
}

/** True when a string is a timezone the runtime's ICU data recognises. */
export const isValidIanaTimezone = (value?: string | null): boolean => {
  if (!value || !value.includes('/')) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/**
 * Custom-field keys that may already hold an IANA timezone, in priority order.
 * Matched case-insensitively against the lead's custom fields.
 */
const TIMEZONE_FIELD_KEYS = [
  'person time zone',
  'person timezone',
  'timezone',
  'time zone',
  'tz',
  'iana timezone',
]

/**
 * Custom-field keys holding a free-text *person* location, in priority order.
 * Deliberately excludes 'city' — that column is handled by the city/state path
 * below, which is ranked lower because it usually describes the company.
 */
const LOCATION_FIELD_KEYS = [
  'location',
  'person location',
  'personal location',
  'metro',
  'metro area',
  'geo',
]

const STATE_FIELD_KEYS = [
  'state/province',
  'state',
  'province',
  'region',
  'company state',
]

const CITY_FIELD_KEYS = ['city', 'company city', 'town']

const COUNTRY_FIELD_KEYS = ['country', 'company country', 'mobile country']

/** Case-insensitive lookup across a custom-fields object. */
const pickField = (
  fields: Record<string, unknown>,
  keys: string[],
): string | null => {
  const lowered = new Map<string, string>()
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed) continue
    const lowerKey = key.toLowerCase().trim()
    if (!lowered.has(lowerKey)) lowered.set(lowerKey, trimmed)
  }

  for (const key of keys) {
    const hit = lowered.get(key)
    if (hit) return hit
  }
  return null
}

export type TimezoneSource =
  | 'custom-field-timezone'
  | 'custom-field-city-state'
  | 'custom-field-location'
  | 'area-code'
  | 'country-field'

export interface OfflineTimezoneInput {
  /**
   * The lead's custom fields: a parsed object, the raw JSON string stored in
   * the column, or anything else (typed `unknown` by the query builder) —
   * values that aren't an object or parseable JSON are treated as absent.
   */
  customFields?: unknown
  phone?: string | null
  normalizedPhone?: string | null
}

export interface OfflineTimezoneResult {
  timezone: string | null
  source: TimezoneSource | null
  /** The raw signal the timezone was derived from, for debugging/audit. */
  signal: string | null
}

const parseCustomFields = (input: unknown): Record<string, unknown> => {
  if (!input) return {}
  if (typeof input === 'object') return input as Record<string, unknown>
  if (typeof input !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(input)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/**
 * Resolve a lead's timezone entirely offline.
 *
 * Returns the first confident answer, along with the signal that produced it
 * so callers can log or audit the decision.
 */
export const resolveTimezoneOffline = (
  input: OfflineTimezoneInput,
): OfflineTimezoneResult => {
  const fields = parseCustomFields(input.customFields)

  // 1. An explicit IANA timezone on the record beats everything else.
  const explicit = pickField(fields, TIMEZONE_FIELD_KEYS)
  if (explicit) {
    if (isValidIanaTimezone(explicit)) {
      return {
        timezone: explicit,
        source: 'custom-field-timezone',
        signal: explicit,
      }
    }
    // Some exports use legacy short names ("America/Indianapolis").
    const viaLocation = lookupTimezoneFromLocation(
      explicit.split('/').pop()?.replace(/_/g, ' ') ?? '',
    )
    if (viaLocation) {
      return {
        timezone: viaLocation,
        source: 'custom-field-timezone',
        signal: explicit,
      }
    }
  }

  // 2. Phone area code — the zone that governs when this number may be dialed.
  const phoneSignal = input.normalizedPhone || input.phone
  const fromPhone = lookupTimezoneFromPhone(phoneSignal)
  if (fromPhone) {
    return {
      timezone: fromPhone,
      source: 'area-code',
      signal: phoneSignal ?? null,
    }
  }

  // 3. Free-text person location.
  const location = pickField(fields, LOCATION_FIELD_KEYS)
  if (location) {
    const timezone = lookupTimezoneFromLocation(location)
    if (timezone) {
      return { timezone, source: 'custom-field-location', signal: location }
    }
  }

  // 4. Structured city + state pair. Ranked last among positional signals
  // because these columns usually describe the company, not the prospect.
  const city = pickField(fields, CITY_FIELD_KEYS)
  const state = pickField(fields, STATE_FIELD_KEYS)
  if (city || state) {
    const combined = [city, state].filter(Boolean).join(', ')
    const timezone = lookupTimezoneFromLocation(combined)
    if (timezone) {
      return {
        timezone,
        source: 'custom-field-city-state',
        signal: combined,
      }
    }
  }

  // 5. Country-only fallback, better than nothing for international leads.
  const country = pickField(fields, COUNTRY_FIELD_KEYS)
  if (country) {
    const timezone =
      COUNTRY_TIMEZONE_MAP[normalizeLocation(country)] ??
      lookupTimezoneFromLocation(country)
    if (timezone) {
      return { timezone, source: 'country-field', signal: country }
    }
  }

  return { timezone: null, source: null, signal: null }
}
