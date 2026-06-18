// Curated Lebanon locality gazetteer for the property location typeahead.
// Each entry maps a town/area to its caza (district) and mohafazat (region).
// Not exhaustive — covers the common localities; admins can still edit fields
// manually. Extend freely.
export interface LebanonLocation {
  name: string
  caza: string
  mohafazat: string // enum value
}

export const MOHAFAZAT_LABEL: Record<string, string> = {
  BEIRUT: 'Beirut', MOUNT_LEBANON: 'Mount Lebanon', NORTH: 'North Lebanon',
  SOUTH: 'South Lebanon', BEKAA: 'Bekaa', NABATIEH: 'Nabatieh',
  AKKAR: 'Akkar', BAALBEK_HERMEL: 'Baalbek-Hermel',
}

export const LEBANON_LOCATIONS: LebanonLocation[] = [
  // Beirut
  ...['Beirut', 'Achrafieh', 'Hamra', 'Verdun', 'Ras Beirut', 'Mazraa', 'Badaro', 'Sodeco', 'Gemmayze', 'Mar Mikhael', 'Saifi', 'Ain El Mreisseh', 'Manara', 'Raouche', 'Tallet El Khayat', 'Mathaf']
    .map((name) => ({ name, caza: 'Beirut', mohafazat: 'BEIRUT' })),

  // Mount Lebanon — Jbeil (Byblos)
  ...['Jbeil (Byblos)', 'Amchit', 'Halat', 'Fidar', 'Blat', 'Mastita', 'Edde', 'Aaqoura', 'Laqlouq', 'Kartaba']
    .map((name) => ({ name, caza: 'Jbeil', mohafazat: 'MOUNT_LEBANON' })),
  // Mount Lebanon — Keserwan
  ...['Jounieh', 'Kaslik', 'Zouk Mosbeh', 'Zouk Mikael', 'Adma', 'Ghazir', 'Kfardebian', 'Faraya', 'Ajaltoun', 'Ballouneh', 'Jeita', 'Harissa', 'Sahel Alma', 'Daraoun', 'Bouar']
    .map((name) => ({ name, caza: 'Keserwan', mohafazat: 'MOUNT_LEBANON' })),
  // Mount Lebanon — Metn
  ...['Jdeideh', 'Sin El Fil', 'Dekwaneh', 'Mansourieh', 'Beit Mery', 'Broumana', 'Antelias', 'Naccache', 'Rabieh', 'Dbayeh', 'Zalka', 'Jal El Dib', 'Bikfaya', 'Baabdat', 'Dhour Choueir', 'Bauchrieh', 'Mtayleb']
    .map((name) => ({ name, caza: 'Metn', mohafazat: 'MOUNT_LEBANON' })),
  // Mount Lebanon — Baabda
  ...['Baabda', 'Hazmieh', 'Furn El Chebbak', 'Hadath', 'Chiyah', 'Yarze', 'Louaize', 'Kfarshima', 'Wadi Chahrour']
    .map((name) => ({ name, caza: 'Baabda', mohafazat: 'MOUNT_LEBANON' })),
  // Mount Lebanon — Aley
  ...['Aley', 'Bhamdoun', 'Sofar', 'Bchamoun', 'Choueifat', 'Kahale', 'Souk El Gharb', 'Aaramoun']
    .map((name) => ({ name, caza: 'Aley', mohafazat: 'MOUNT_LEBANON' })),
  // Mount Lebanon — Chouf
  ...['Beiteddine', 'Deir El Qamar', 'Baakline', 'Moukhtara', 'Damour', 'Barouk', 'Maaser El Chouf', 'Jdeidet El Chouf']
    .map((name) => ({ name, caza: 'Chouf', mohafazat: 'MOUNT_LEBANON' })),

  // North — Tripoli
  ...['Tripoli', 'El Mina', 'Beddawi', 'Qalamoun']
    .map((name) => ({ name, caza: 'Tripoli', mohafazat: 'NORTH' })),
  // North — Koura
  ...['Amioun', 'Anfeh', 'Chekka', 'Kousba', 'Kfaraakka']
    .map((name) => ({ name, caza: 'Koura', mohafazat: 'NORTH' })),
  // North — Batroun
  ...['Batroun', 'Tannourine', 'Douma', 'Kfifane', 'Chatine']
    .map((name) => ({ name, caza: 'Batroun', mohafazat: 'NORTH' })),
  // North — Zgharta / Bcharre / Danniyeh
  ...['Zgharta', 'Ehden'].map((name) => ({ name, caza: 'Zgharta', mohafazat: 'NORTH' })),
  ...['Bcharre', 'Hasroun', 'The Cedars'].map((name) => ({ name, caza: 'Bcharre', mohafazat: 'NORTH' })),
  ...['Sir El Danniyeh', 'Minieh', 'Bakhoun'].map((name) => ({ name, caza: 'Minieh-Danniyeh', mohafazat: 'NORTH' })),

  // Akkar
  ...['Halba', 'Qoubaiyat', 'Bebnine', 'Chadra', 'Rahbe', 'Michmich']
    .map((name) => ({ name, caza: 'Akkar', mohafazat: 'AKKAR' })),

  // Bekaa
  ...['Zahle', 'Chtaura', 'Ksara', 'Taanayel', 'Qabb Elias', 'Bar Elias']
    .map((name) => ({ name, caza: 'Zahle', mohafazat: 'BEKAA' })),
  ...['Jib Jannine', 'Saghbine', 'Kamed El Loz', 'Machghara']
    .map((name) => ({ name, caza: 'Western Bekaa', mohafazat: 'BEKAA' })),
  ...['Rachaya', 'Aiha'].map((name) => ({ name, caza: 'Rachaya', mohafazat: 'BEKAA' })),

  // Baalbek-Hermel
  ...['Baalbek', 'Douris', 'Ras Baalbek', 'Deir El Ahmar', 'Brital', 'Chmistar']
    .map((name) => ({ name, caza: 'Baalbek', mohafazat: 'BAALBEK_HERMEL' })),
  ...['Hermel', 'Qasr'].map((name) => ({ name, caza: 'Hermel', mohafazat: 'BAALBEK_HERMEL' })),

  // South
  ...['Saida (Sidon)', 'Ghazieh', 'Haret Saida', 'Abra', 'Miye Ou Miye']
    .map((name) => ({ name, caza: 'Saida', mohafazat: 'SOUTH' })),
  ...['Jezzine', 'Bkassine', 'Roum'].map((name) => ({ name, caza: 'Jezzine', mohafazat: 'SOUTH' })),
  ...['Tyre (Sour)', 'Abbassiyeh', 'Qana', 'Naqoura', 'Bourj El Chemali']
    .map((name) => ({ name, caza: 'Tyre', mohafazat: 'SOUTH' })),

  // Nabatieh
  ...['Nabatieh', 'Kfar Roummane', 'Habbouch', 'Zefta']
    .map((name) => ({ name, caza: 'Nabatieh', mohafazat: 'NABATIEH' })),
  ...['Marjeyoun', 'Khiam', 'Kfar Kila'].map((name) => ({ name, caza: 'Marjeyoun', mohafazat: 'NABATIEH' })),
  ...['Hasbaya', 'Chebaa', 'Kfarchouba'].map((name) => ({ name, caza: 'Hasbaya', mohafazat: 'NABATIEH' })),
  ...['Bint Jbeil', 'Aitaroun', 'Ainata', 'Maroun El Ras'].map((name) => ({ name, caza: 'Bint Jbeil', mohafazat: 'NABATIEH' })),
]

/** Search localities by town, caza, or region label. Returns up to `limit`. */
export function searchLocations(query: string, limit = 12): LebanonLocation[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return LEBANON_LOCATIONS.filter((l) =>
    l.name.toLowerCase().includes(q) ||
    l.caza.toLowerCase().includes(q) ||
    (MOHAFAZAT_LABEL[l.mohafazat] ?? '').toLowerCase().includes(q)
  ).slice(0, limit)
}
