// Curated Lebanon locality gazetteer for the property location typeahead.
// An entry maps a town (or a sub-area/neighborhood of a town) to its parent
// town (`city`, when applicable), caza (district) and mohafazat (region).
// Picking a sub-area fills BOTH the city and the neighborhood fields.
// Not exhaustive; admins can still edit fields manually. Extend freely.
export interface LebanonLocation {
  name: string       // town, OR a sub-area/neighborhood when `city` is set
  caza: string
  mohafazat: string  // enum value
  city?: string      // parent town/area when `name` is a sub-area
}

export const MOHAFAZAT_LABEL: Record<string, string> = {
  BEIRUT: 'Beirut', MOUNT_LEBANON: 'Mount Lebanon', NORTH: 'North Lebanon',
  SOUTH: 'South Lebanon', BEKAA: 'Bekaa', NABATIEH: 'Nabatieh',
  AKKAR: 'Akkar', BAALBEK_HERMEL: 'Baalbek-Hermel',
}

const ML = 'MOUNT_LEBANON'
const town = (names: string[], caza: string, mohafazat: string): LebanonLocation[] =>
  names.map((name) => ({ name, caza, mohafazat }))
// Sub-areas/neighborhoods of a parent town — picking one fills city + neighborhood.
const sub = (city: string, names: string[], caza: string, mohafazat: string): LebanonLocation[] =>
  names.map((name) => ({ name, caza, mohafazat, city }))

export const LEBANON_LOCATIONS: LebanonLocation[] = [
  // ── Beirut ─────────────────────────────────────────────────────────────────
  ...town([
    'Beirut', 'Achrafieh', 'Hamra', 'Ras Beirut', 'Verdun', 'Mazraa', 'Msaytbeh', 'Badaro', 'Sodeco',
    'Gemmayze', 'Mar Mikhael', 'Saifi', 'Downtown', 'Manara', 'Raouche', 'Ain El Mreisseh', 'Clemenceau',
    'Qantari', 'Mathaf', 'Tallet El Khayat', 'Ras El Nabaa', 'Bachoura', 'Zqaq El Blat', 'Basta',
    'Tariq El Jdideh', 'Ain El Tineh', 'Karantina', 'Corniche El Nahr',
  ], 'Beirut', 'BEIRUT'),
  // Achrafieh sub-neighborhoods → city = Achrafieh, neighborhood = the sub-area
  ...sub('Achrafieh', ['Sassine', 'Sioufi', 'Karm El Zeitoun', 'Geitawi', 'Rmeil', 'Furn El Hayek', 'Adlieh', 'Nasra', 'Monot'], 'Beirut', 'BEIRUT'),

  // ── Mount Lebanon — Metn ───────────────────────────────────────────────────
  ...town([
    'Jdeideh', 'Bauchrieh', 'Sed El Bauchrieh', 'Sin El Fil', 'Dekwaneh', 'Fanar', 'Sabtieh',
    'Bourj Hammoud', 'Dora', 'Mkalles', 'Mansourieh', 'Beit Mery', 'Broumana', 'Baabdat', 'Bikfaya',
    'Dhour Choueir', 'Antelias', 'Naccache', 'Rabieh', 'Rabweh', 'Mtayleb', 'Dbayeh', 'Zalka',
    'Jal El Dib', 'Bsalim', 'Mazraat Yachouh', 'Aoukar', 'Roumieh', 'Ain Saadeh', 'Ain Aar',
    'Qornet El Hamra', 'Cornet Chehwane', 'Beit El Chaar', 'Monteverde', 'Elissar', 'Mar Roukoz', 'New Rawda',
  ], 'Metn', ML),

  // ── Mount Lebanon — Keserwan ───────────────────────────────────────────────
  ...town([
    'Jounieh', 'Zouk Mosbeh', 'Zouk Mikael', 'Adma', 'Ghazir', 'Tabarja', 'Safra', 'Bouar', 'Kfardebian',
    'Faraya', 'Hrajel', 'Mayrouba', 'Reyfoun', 'Ajaltoun', 'Ballouneh', 'Jeita', 'Harissa', 'Daraoun',
    'Sahel Alma', 'Kleiat',
  ], 'Keserwan', ML),
  // Greater Jounieh sub-areas → city = Jounieh, neighborhood = the sub-area
  ...sub('Jounieh', ['Kaslik', 'Sarba', 'Haret Sakher', 'Ghadir', 'Maameltein'], 'Keserwan', ML),

  // ── Mount Lebanon — Jbeil (Byblos) ─────────────────────────────────────────
  ...town(['Jbeil (Byblos)', 'Amchit', 'Halat', 'Fidar', 'Blat', 'Mastita', 'Edde', 'Hboub', 'Aaqoura', 'Laqlouq', 'Kartaba', 'Mechmech', 'Berbara', 'Maad'], 'Jbeil', ML),

  // ── Mount Lebanon — Baabda ─────────────────────────────────────────────────
  ...town(['Baabda', 'Hazmieh', 'Furn El Chebbak', 'Hadath', 'Chiyah', 'Ghobeiry', 'Haret Hreik', 'Bir Hassan', 'Jnah', 'Yarze', 'Louaize', 'Kfarshima', 'Wadi Chahrour', 'Bsaba'], 'Baabda', ML),

  // ── Mount Lebanon — Aley ───────────────────────────────────────────────────
  ...town(['Aley', 'Bhamdoun', 'Sofar', 'Bchamoun', 'Choueifat', 'Aaramoun', 'Kahale', 'Souk El Gharb', 'Bsous', 'Ainab', 'Kaifoun'], 'Aley', ML),

  // ── Mount Lebanon — Chouf ──────────────────────────────────────────────────
  ...town(['Beiteddine', 'Deir El Qamar', 'Baakline', 'Moukhtara', 'Damour', 'Barouk', 'Maaser El Chouf', 'Jdeidet El Chouf', 'Kfarhim', 'Semqanieh'], 'Chouf', ML),

  // ── North ──────────────────────────────────────────────────────────────────
  ...town(['Tripoli', 'El Mina', 'Beddawi', 'Qalamoun', 'Dahr El Ain'], 'Tripoli', 'NORTH'),
  ...town(['Amioun', 'Anfeh', 'Chekka', 'Kousba', 'Kfaraakka', 'Btouratij'], 'Koura', 'NORTH'),
  ...town(['Batroun', 'Tannourine', 'Douma', 'Kfifane', 'Chatine', 'Kfar Abida'], 'Batroun', 'NORTH'),
  ...town(['Zgharta', 'Ehden', 'Kfardlakos'], 'Zgharta', 'NORTH'),
  ...town(['Bcharre', 'Hasroun', 'The Cedars', 'Hadchit'], 'Bcharre', 'NORTH'),
  ...town(['Sir El Danniyeh', 'Minieh', 'Bakhoun', 'Bqaa Safrine'], 'Minieh-Danniyeh', 'NORTH'),

  // ── Akkar ──────────────────────────────────────────────────────────────────
  ...town(['Halba', 'Qoubaiyat', 'Bebnine', 'Chadra', 'Rahbe', 'Michmich', 'Berqayel', 'Aabde'], 'Akkar', 'AKKAR'),

  // ── Bekaa ──────────────────────────────────────────────────────────────────
  ...town(['Zahle', 'Chtaura', 'Ksara', 'Taanayel', 'Qabb Elias', 'Bar Elias', 'Ablah', 'Riyaq'], 'Zahle', 'BEKAA'),
  ...town(['Jib Jannine', 'Saghbine', 'Kamed El Loz', 'Machghara', 'Joub Jannine'], 'Western Bekaa', 'BEKAA'),
  ...town(['Rachaya', 'Aiha', 'Kfarmechki'], 'Rachaya', 'BEKAA'),

  // ── Baalbek-Hermel ─────────────────────────────────────────────────────────
  ...town(['Baalbek', 'Douris', 'Ras Baalbek', 'Deir El Ahmar', 'Brital', 'Chmistar', 'Iaat'], 'Baalbek', 'BAALBEK_HERMEL'),
  ...town(['Hermel', 'Qasr', 'Fissan'], 'Hermel', 'BAALBEK_HERMEL'),

  // ── South ──────────────────────────────────────────────────────────────────
  ...town(['Saida (Sidon)', 'Ghazieh', 'Haret Saida', 'Abra', 'Miye Ou Miye', 'Hlaliyeh'], 'Saida', 'SOUTH'),
  ...town(['Jezzine', 'Bkassine', 'Roum'], 'Jezzine', 'SOUTH'),
  ...town(['Tyre (Sour)', 'Abbassiyeh', 'Qana', 'Naqoura', 'Bourj El Chemali', 'Maaroub'], 'Tyre', 'SOUTH'),

  // ── Nabatieh ───────────────────────────────────────────────────────────────
  ...town(['Nabatieh', 'Kfar Roummane', 'Habbouch', 'Zefta', 'Doueir'], 'Nabatieh', 'NABATIEH'),
  ...town(['Marjeyoun', 'Khiam', 'Kfar Kila'], 'Marjeyoun', 'NABATIEH'),
  ...town(['Hasbaya', 'Chebaa', 'Kfarchouba'], 'Hasbaya', 'NABATIEH'),
  ...town(['Bint Jbeil', 'Aitaroun', 'Ainata', 'Maroun El Ras'], 'Bint Jbeil', 'NABATIEH'),
]

/**
 * True when the picked value corresponds to a real entry in the gazetteer.
 * - A sub-area value (neighborhood set) must match a `sub()` entry whose parent
 *   town === city and name === neighborhood.
 * - A town value (no neighborhood) must match a town entry whose name === city.
 * Region/district are auto-filled from the pick, so we match on city/neighborhood.
 * An empty value (nothing chosen yet) is NOT considered known.
 */
export function isKnownLocation(value: { city?: string; neighborhood?: string }): boolean {
  const city = (value.city ?? '').trim().toLowerCase()
  const neighborhood = (value.neighborhood ?? '').trim().toLowerCase()
  if (!city) return false
  if (neighborhood) {
    return LEBANON_LOCATIONS.some(
      (l) => !!l.city && l.city.toLowerCase() === city && l.name.toLowerCase() === neighborhood,
    )
  }
  return LEBANON_LOCATIONS.some((l) => !l.city && l.name.toLowerCase() === city)
}

/**
 * Search localities by town/sub-area, parent town, caza, or region label.
 * Returns up to `limit` (kept small to nudge admins toward typing a specific
 * place rather than scrolling a long list). Name matches rank first.
 */
export function searchLocations(query: string, limit = 6): LebanonLocation[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const nameMatches = LEBANON_LOCATIONS.filter((l) => l.name.toLowerCase().includes(q))
  const otherMatches = LEBANON_LOCATIONS.filter(
    (l) => !l.name.toLowerCase().includes(q) &&
      ((l.city ?? '').toLowerCase().includes(q) ||
        l.caza.toLowerCase().includes(q) ||
        (MOHAFAZAT_LABEL[l.mohafazat] ?? '').toLowerCase().includes(q))
  )
  return [...nameMatches, ...otherMatches].slice(0, limit)
}
