import type { CityMap } from './types'

/**
 * Batumi, for the sales team.
 *
 * WHAT IS CHECKED AND WHAT IS NOT
 * - Landmark, airport, station and mall positions come from OpenStreetMap
 *   (looked up 2026-11-11) and are accurate to the building.
 * - Region OUTLINES are sketched by hand between those landmarks. They show
 *   where a district sits, not its legal boundary — do not quote a street as
 *   "inside" or "outside" a district from this map.
 * - The verdicts and notes are a starting brief, deliberately without prices,
 *   yields or occupancy figures: those change by the quarter and must come from
 *   the developer's current list or our own closed deals, never from here.
 *   Whoever knows the city best should correct this file and bump `reviewed`.
 */
export const BATUMI: CityMap = {
  slug: 'batumi',
  city: 'Batumi',
  country: 'Georgia',
  countryCode: 'GEORGIA',
  cityMatches: ['batumi', 'gonio', 'kvariati', 'makhinjauri', 'chakvi'],
  centre: [41.632, 41.628],
  zoom: 12,
  reviewed: '2026-11-11',
  intro:
    'Batumi is a Black Sea resort city of low-rise old streets at the tip of a cape and a long line of new towers running south-west along the beach towards the airport. Almost everything sold to foreign investors is a new-build apartment bought to rent to tourists, so two questions decide a purchase: how far it is from the sea and the Old Town, and who will manage it when the season ends.',
  howItWorks: [
    'The city is a strip. The beach and its boulevard run about 7 km from the port (north-east) to the airport (south-west). Value falls as you move inland from the boulevard, and along it as you move away from the Old Town.',
    'There are two seafronts. The old boulevard (Old Batumi, Rustaveli) is finished, walkable and lets all year. The new boulevard (Khimshiashvili, then the airport end) is where the towers and the off-plan stock are — more choice, more competition for the same summer guests.',
    'Behind the seafront is where Batumi lives. Bagrationi, Javakhishvili and Aghmashenebeli rent to residents and students by the year, not to tourists by the night.',
    'The east side is the working side: port, oil terminal, rail yard. The resorts are outside the city proper — Gonio and Kvariati to the south, Makhinjauri and Green Cape to the north.',
    'The season is the risk. Summer fills everything; winter separates a well-run building near the centre from an empty one. Always ask what the building earns from November to April.',
  ],

  regions: [
    {
      id: 'old-batumi',
      name: 'Old Batumi',
      alsoCalled: ['Old Town', 'Dzveli Batumi', 'Piazza / Europe Square area'],
      type: 'historic',
      verdict: 'strong',
      summary: 'The historic low-rise core on the cape: Europe Square, Piazza, the port promenade.',
      about:
        'The part of Batumi tourists come to see. Nineteenth-century streets, restaurants, casinos and hotels, the seafront park with the Alphabet Tower and Ali & Nino, and the passenger port. Building height is restricted, so there is very little new supply — what sells is resale flats in older buildings and the occasional boutique project.',
      bestFor: ['Short-let investors who want year-round bookings', 'Buyers who will use it themselves', 'Small retail and food-and-drink premises'],
      strengths: [
        'The only area with real demand outside the summer',
        'Supply cannot grow much — heritage and height limits',
        'Everything is on foot: sea, restaurants, port, cable car',
      ],
      watchOuts: [
        'Old buildings: check the roof, wiring, plumbing and the stairwell, not just the flat',
        'Parking is scarce and streets are noisy at night in season',
        'Highest entry price in the city for the space you get',
        'Title history on old flats needs a proper check',
      ],
      stock: 'Mostly resale apartments in older low-rise buildings; few new projects, small ones.',
      rental: 'Tourists all year, strongest in summer; also business and casino visitors in winter.',
      outline: [
        [41.6565, 41.64], [41.6555, 41.644], [41.651, 41.649], [41.646, 41.648],
        [41.645, 41.64], [41.6465, 41.633], [41.6515, 41.63], [41.6545, 41.633],
      ],
      matches: ['old batumi', 'batumi old town', 'old town', 'batumi seafront'],
    },
    {
      id: 'rustaveli',
      name: 'Rustaveli — Old Boulevard',
      alsoCalled: ['Batumi Boulevard', 'First line, old boulevard', '6 May Park area'],
      type: 'seafront',
      verdict: 'strong',
      summary: 'The established first line: the original boulevard, the big hotels, the park and the university.',
      about:
        'West of the Old Town along Rustaveli Avenue. This is the mature seafront — the international hotels, 6 May Park and its lake, the dolphinarium, the university — with the beach across the road. It is largely built out, so new projects are rare and expensive, and what exists holds its value best.',
      bestFor: ['Investors who put safety ahead of the highest headline yield', 'Buyers wanting a sea view within walking distance of the Old Town'],
      strengths: [
        'Finished neighbourhood: nothing left to wait for',
        'Walkable to the Old Town and directly on the boulevard',
        'Longest letting season after the Old Town',
      ],
      watchOuts: [
        'Little new stock, and it is priced accordingly',
        'A "sea view" here can be lost to the next tower — check what is planned in front',
        'Older towers vary a lot in management and upkeep',
      ],
      stock: 'Completed towers and hotel-branded residences; occasional new infill project.',
      rental: 'Tourists most of the year; some long-term demand from university and hospital staff.',
      outline: [
        [41.6545, 41.633], [41.6515, 41.63], [41.6465, 41.633], [41.642, 41.625],
        [41.64, 41.619], [41.643, 41.614], [41.648, 41.62], [41.6515, 41.626],
      ],
      matches: ['rustaveli', 'rustaveli batumi', 'batumi boulevard', 'old boulevard'],
    },
    {
      id: 'khimshiashvili',
      name: 'Khimshiashvili — New Boulevard',
      alsoCalled: ['New Boulevard', 'Sherif Khimshiashvili Street', 'Orbi / Grand Mall area'],
      type: 'highrise',
      verdict: 'selective',
      summary: 'The tower district on the new seafront — where most off-plan apartments are sold.',
      about:
        'The line of high-rises south-west of the old boulevard, along Sherif Khimshiashvili Street: Orbi City, Grand Mall, the stadium behind, and one new tower after another. This is the heart of the investor market and where most of what we sell is. It is also where supply is largest, so the building and its operator matter far more than the address.',
      bestFor: ['Investors buying off-plan on a payment plan', 'Buyers who want a managed apartment with hotel services', 'First-time buyers with a smaller budget who still want the sea'],
      strengths: [
        'First-line sea views at a lower price than the old boulevard',
        'Most choice of developers, layouts and payment plans',
        'New infrastructure: malls, beach, boulevard extension',
        'Managed rental programmes are common',
      ],
      watchOuts: [
        'The most competition in the city: thousands of similar studios chasing the same summer guests',
        'Winter occupancy is weak in buildings without a real hotel operator',
        'Very large towers of small studios are hard to resell — every owner is selling the same thing',
        'Quality and delivery record differ sharply between developers: check what they have already handed over',
        'Service charges and the management contract decide the net return — read them',
      ],
      stock: 'New-build and off-plan towers; studios and one-bedrooms dominate; many aparthotel schemes.',
      rental: 'Short-let to summer tourists; managed-hotel income where an operator runs the building.',
      outline: [
        [41.643, 41.614], [41.639, 41.6095], [41.635, 41.605], [41.629, 41.599], [41.622, 41.592],
        [41.618, 41.598], [41.625, 41.605], [41.631, 41.611], [41.635, 41.6155], [41.639, 41.62],
      ],
      matches: ['khimshiashvili', 'sherif khimshiashvili', 'new boulevard', 'new boulevard batumi'],
    },
    {
      id: 'airport',
      name: 'Airport district',
      alsoCalled: ['Adlia', 'Airport highway', 'End of the New Boulevard'],
      type: 'emerging',
      verdict: 'caution',
      summary: 'The far end of the new seafront around the airport — the newest land, still being built.',
      about:
        'Where the new boulevard runs out, around Batumi International Airport and down to the Chorokhi river. Land here is the cheapest on the coast, so the newest and largest schemes are announced here. It is a bet on the city growing this far: today it is a building site a long way from the Old Town.',
      bestFor: ['Patient buyers who want the lowest entry price on the coast', 'Long holds rather than rental income from year one'],
      strengths: [
        'Lowest prices with a sea view',
        'Two minutes from the airport and on the road to Gonio and Turkey',
        'Large plots allow resort-style projects with real facilities',
      ],
      watchOuts: [
        'Under the flight path: ask to hear a landing from the balcony',
        'Years of construction around any building you buy',
        'Low-lying ground near the Chorokhi delta — ask about drainage and the ground floor',
        'Too far to walk anywhere; guests need a car or taxi',
        'More off-plan risk: newer developers, later delivery dates',
      ],
      stock: 'Off-plan and recently delivered large complexes; resort-style schemes.',
      rental: 'Summer only for now; depends heavily on the complex having its own facilities.',
      outline: [
        [41.622, 41.592], [41.618, 41.598], [41.625, 41.605], [41.62, 41.608], [41.613, 41.614],
        [41.605, 41.61], [41.601, 41.59], [41.606, 41.576], [41.615, 41.585],
      ],
      matches: ['airport', 'batumi airport area', 'adlia', 'angisa'],
    },
    {
      id: 'javakhishvili',
      name: 'Javakhishvili',
      alsoCalled: ['Stadium area', 'Second and third line behind the boulevard'],
      type: 'residential',
      verdict: 'selective',
      summary: 'Residential blocks just behind the seafront — ten minutes on foot to the beach.',
      about:
        'The streets behind Rustaveli and the start of the new boulevard, around the stadium and the hospital. Mostly where residents live, in a mix of Soviet-era blocks and newer mid-rise buildings. A few streets back from the sea, prices drop noticeably while the beach is still walkable.',
      bestFor: ['Buyers who want long-term tenants rather than tourists', 'Budget buyers who still want to walk to the sea', 'People relocating to live in Batumi'],
      strengths: [
        'Real year-round demand from residents',
        'Lower price per square metre than the first line',
        'Schools, hospital, shops — a working neighbourhood',
      ],
      watchOuts: [
        'No sea view and little tourist appeal: do not sell it as a short-let',
        'Older blocks need the building checked, not just the apartment',
        'Yearly rents are lower than tourist income looks on paper',
      ],
      stock: 'Resale apartments in older blocks; some new mid-rise residential projects.',
      rental: 'Long-term to residents, students and medical staff.',
      outline: [
        [41.6465, 41.633], [41.639, 41.633], [41.635, 41.626], [41.635, 41.6155],
        [41.639, 41.62], [41.64, 41.619], [41.642, 41.625],
      ],
      matches: ['javakhishvili'],
    },
    {
      id: 'bagrationi',
      name: 'Bagrationi',
      alsoCalled: ['Central Batumi', 'Chavchavadze / market area'],
      type: 'residential',
      verdict: 'selective',
      summary: 'The dense everyday centre behind the Old Town: markets, bus station, local shops.',
      about:
        'South of the Old Town, the city centre as residents use it — the main streets, the market, the bus station. Busy and practical rather than pretty. Close enough to the Old Town to borrow some of its demand, at a fraction of its price.',
      bestFor: ['Long-term rental investors', 'Small commercial units on busy streets', 'Buyers who want central but cannot afford the Old Town'],
      strengths: [
        'Walking distance to the Old Town and the port',
        'Constant local demand, every month of the year',
        'Street-level retail has real footfall',
      ],
      watchOuts: [
        'Traffic, noise and little green space',
        'Mostly older stock; new projects are small infill sites',
        'Not what a holiday guest imagines when they book "Batumi seaside"',
      ],
      stock: 'Older apartments, some new infill buildings, ground-floor commercial.',
      rental: 'Long-term to residents; some budget short-let near the Old Town edge.',
      outline: [
        [41.646, 41.633], [41.646, 41.648], [41.644, 41.654], [41.638, 41.652],
        [41.637, 41.64], [41.639, 41.633],
      ],
      matches: ['bagrationi'],
    },
    {
      id: 'aghmashenebeli',
      name: 'Aghmashenebeli',
      alsoCalled: ['Inner residential belt'],
      type: 'residential',
      verdict: 'caution',
      summary: 'Inland residential belt — local housing, well back from the sea.',
      about:
        'Further inland again, a belt of apartment blocks and local streets. It is ordinary housing for people who work in the city. Sensible for someone who will live there or wants a modest long-term rental; it has nothing to offer a tourist.',
      bestFor: ['Owner-occupiers', 'Low-budget long-term rental'],
      strengths: ['Among the lowest apartment prices inside the city', 'Stable local tenants'],
      watchOuts: [
        'Too far from the sea for short-let',
        'Slow to resell to a foreign buyer — the market here is local',
        'Do not present as an investment product to an overseas client',
      ],
      stock: 'Older blocks and modest new residential buildings.',
      rental: 'Long-term local only.',
      outline: [
        [41.639, 41.633], [41.637, 41.64], [41.638, 41.652], [41.63, 41.65],
        [41.628, 41.635], [41.63, 41.623], [41.635, 41.626],
      ],
      matches: ['aghmashenebeli', 'aghmashenebeli batumi'],
    },
    {
      id: 'tamar',
      name: 'Tamar',
      alsoCalled: ['Tamaris Dasakhleba', 'East hillside'],
      type: 'residential',
      verdict: 'caution',
      summary: 'East side, climbing the hill behind the port — views, but beside the working harbour.',
      about:
        'The residential district east of the centre, running up towards the hills. Higher streets have wide views over the bay; lower ones sit next to the port and the rail line. A local market with occasional projects sold on the view.',
      bestFor: ['Buyers who want a bay view at a low price and accept the surroundings', 'Local long-term rental'],
      strengths: ['Elevated plots with open views', 'Short drive to the Old Town', 'Low prices for the distance to the centre'],
      watchOuts: [
        'Port, oil terminal and freight rail are the neighbours on the low side',
        'The beach is not walkable from most of it',
        'Steep streets; check access and parking in winter rain',
      ],
      stock: 'Local housing, a few hillside view projects.',
      rental: 'Long-term local; weak short-let.',
      outline: [
        [41.646, 41.648], [41.651, 41.649], [41.648, 41.656], [41.647, 41.659],
        [41.64, 41.659], [41.638, 41.652], [41.644, 41.654],
      ],
      matches: ['tamar', 'tamar district'],
    },
    {
      id: 'industrial',
      name: 'Boni-Gorodok and the industrial east',
      alsoCalled: ['Port zone', 'Oil terminal', 'Batumi Industrial'],
      type: 'industrial',
      verdict: 'avoid',
      summary: 'Port, oil terminal and rail yards. Not residential investment.',
      about:
        'The working east of the city: the cargo port, the oil terminal with its tank farm, freight sidings and the central railway station. It keeps the city running and it is useful to know where the station is — but it is not somewhere to place a client’s apartment.',
      bestFor: ['Nobody buying a home or a rental', 'Possibly logistics or warehouse users — a different business from ours'],
      strengths: ['The main railway station (trains to Tbilisi) is here', 'Good road access north'],
      watchOuts: [
        'Heavy industry, tanker and freight traffic, smell and noise',
        'No tourist demand at all',
        'An apartment advertised as "near the station, sea view" is probably here — check the map before quoting it',
      ],
      stock: 'Industrial and logistics; scattered old housing.',
      rental: 'None worth underwriting.',
      outline: [
        [41.648, 41.656], [41.652, 41.665], [41.659, 41.676], [41.664, 41.683],
        [41.656, 41.686], [41.644, 41.68], [41.64, 41.659], [41.647, 41.659],
      ],
      matches: ['boni gorodok', 'boni-gorodok', 'industrial', 'batumi industrial'],
    },
    {
      id: 'kakhaberi',
      name: 'Kakhaberi',
      alsoCalled: ['Inland plain', 'Kakhaberi lowland'],
      type: 'emerging',
      verdict: 'caution',
      summary: 'The flat inland plain south of the centre — houses, plots and farmland turning suburban.',
      about:
        'Behind the new boulevard and the airport, a wide flat area of private houses and small plots. It is where the city can spread next, which makes it interesting for land and for buyers who want a house rather than an apartment — and irrelevant for a tourist rental.',
      bestFor: ['Land buyers taking a long view', 'Families who want a house with a garden'],
      strengths: ['Land and houses at prices the coast cannot offer', 'Room for the city to grow into'],
      watchOuts: [
        'No sea, no tourist demand',
        'Roads, drainage and services are uneven street by street',
        'Land needs proper due diligence: zoning, access, registered boundaries',
        'Resale depends on local buyers',
      ],
      stock: 'Private houses, land plots, a few low-rise schemes.',
      rental: 'Local long-term only.',
      outline: [
        [41.631, 41.611], [41.635, 41.6155], [41.635, 41.626], [41.63, 41.623], [41.628, 41.635],
        [41.63, 41.65], [41.618, 41.648], [41.609, 41.633], [41.613, 41.614], [41.62, 41.608], [41.625, 41.605],
      ],
      matches: ['kakhaberi'],
    },
    {
      id: 'gonio-kvariati',
      name: 'Gonio – Kvariati – Sarpi',
      alsoCalled: ['South coast', 'Gonio', 'Kvariati', 'Sarpi'],
      type: 'resort',
      verdict: 'selective',
      summary: 'Resort villages south of the river: cleaner sea, green hills, villas and low-rise.',
      about:
        'Across the Chorokhi, the coast road runs past Gonio and its Roman fortress to Kvariati and the Turkish border at Sarpi. Mountains come down to the beach and the water is the clearest near Batumi. It is a different product from the city: villas, boutique complexes, a quiet holiday rather than a night out.',
      bestFor: ['Lifestyle and second-home buyers', 'Villa and boutique-hotel investors', 'Clients who dislike towers'],
      strengths: [
        'Best beaches and scenery on this coast',
        'Low-rise, green, far less crowded',
        'Scarce buildable land between the hills and the sea',
        'Ten to fifteen minutes from the airport',
      ],
      watchOuts: [
        'Sharply seasonal: quiet from October to May',
        'Almost no services in winter — restaurants and shops close',
        'One coast road, with lorry queues for the border',
        'Hillside plots: check access, slope stability and utilities',
        'A car is essential',
      ],
      stock: 'Villas, townhouses, small resort complexes, land.',
      rental: 'Summer holiday lets at good nightly rates; little else.',
      outline: [
        [41.6, 41.574], [41.599, 41.585], [41.58, 41.582], [41.56, 41.576], [41.54, 41.568],
        [41.52, 41.554], [41.521, 41.547], [41.548, 41.56], [41.573, 41.5665], [41.59, 41.569],
      ],
      matches: ['gonio', 'kvariati', 'sarpi'],
    },
    {
      id: 'green-cape',
      name: 'Makhinjauri – Green Cape',
      alsoCalled: ['Mtsvane Kontskhi', 'Botanical Garden coast', 'North coast'],
      type: 'resort',
      verdict: 'selective',
      summary: 'The green north coast: hillside sea views and the Botanical Garden.',
      about:
        'North-east of the port, the coast rises into wooded hills at Makhinjauri and Green Cape, home of the Batumi Botanical Garden. Projects here sell the view back across the bay to the city skyline, and the quiet. Popular with buyers who want nature and are happy to drive into town.',
      bestFor: ['Second-home buyers who want quiet and a view', 'Wellness and eco-stay concepts'],
      strengths: [
        'Views over the whole bay and the city',
        'Greenest part of the coast; the Botanical Garden next door',
        'Makhinjauri has its own railway stop',
      ],
      watchOuts: [
        'The railway and the main highway run along the shore — check noise and how you reach the beach',
        'Seasonal, with few shops and restaurants',
        'Steep sites: access, parking and retaining walls',
        'Fifteen to twenty minutes from the Old Town',
      ],
      stock: 'Hillside apartment complexes, villas, some hotels.',
      rental: 'Summer holiday lets; weak winter.',
      outline: [
        [41.664, 41.683], [41.67, 41.688], [41.679, 41.696], [41.695, 41.706], [41.706, 41.717],
        [41.7, 41.726], [41.685, 41.712], [41.672, 41.702], [41.66, 41.693], [41.656, 41.686],
      ],
      matches: ['makhinjauri', 'green cape', 'mtsvane kontskhi'],
    },
    {
      id: 'chakvi',
      name: 'Chakvi',
      alsoCalled: ['Chakvi resort', 'Towards Kobuleti'],
      type: 'resort',
      verdict: 'caution',
      summary: 'A separate resort village up the coast — big self-contained complexes, outside the city.',
      about:
        'Past Green Cape, Chakvi is its own village in the next municipality, known for tea terraces and a few very large resort developments. A buyer here is buying into one complex and its operator, not into Batumi: everything they need has to be inside the gates.',
      bestFor: ['Buyers choosing a specific resort complex for its facilities', 'Holiday use by the owner'],
      strengths: ['Wide, quieter beach', 'Resort complexes with pools, restaurants and management on site', 'Lower prices than the city seafront'],
      watchOuts: [
        'Not Batumi: twenty-five minutes or more to the Old Town',
        'Entirely dependent on the complex and its management company',
        'Hard to resell outside the developer’s own channel',
        'Closed season is long',
      ],
      stock: 'Large resort complexes; little else.',
      rental: 'Summer, through the complex’s own programme.',
      outline: [
        [41.706, 41.717], [41.725, 41.73], [41.733, 41.74], [41.725, 41.748], [41.71, 41.735], [41.7, 41.726],
      ],
      matches: ['chakvi'],
    },
  ],

  points: [
    // ── Getting there ──────────────────────────────────────────────────────
    { id: 'airport', kind: 'airport', name: 'Batumi International Airport (BUS)', at: [41.6093, 41.6012], note: 'The city’s own airport, about 10 minutes from the new boulevard and 20 from the Old Town. Direct flights are seasonal — more routes in summer. When a client says "there are no flights to Batumi": Kutaisi, the low-cost hub, is about two hours by road, and Tbilisi about five by train.' },
    { id: 'station', kind: 'transport', name: 'Batumi Central railway station', at: [41.6584, 41.6778], note: 'Trains to Tbilisi. It is on the industrial east side, a taxi ride from everything a buyer will look at.' },
    { id: 'port', kind: 'transport', name: 'Batumi Sea Port', at: [41.6505, 41.648], note: 'Passenger and cargo port beside the Old Town. The passenger side and the cable car are an attraction; the cargo and oil side to the east is why we do not sell there.' },
    { id: 'bus', kind: 'transport', name: 'Bus station', at: [41.6436, 41.6505], note: 'Intercity buses and minibuses. Useful for staff and long-term tenants.' },
    { id: 'makhinjauri-st', kind: 'transport', name: 'Makhinjauri station', at: [41.6774, 41.6964], note: 'Suburban rail stop serving the north coast and the Botanical Garden.' },
    { id: 'sarpi', kind: 'transport', name: 'Sarpi border crossing (Turkey)', at: [41.5208, 41.5478], note: 'The main land border with Turkey. Brings Turkish visitors and shoppers all year — and lorry queues on the coast road through Kvariati and Gonio.' },

    // ── Landmarks a client will name ───────────────────────────────────────
    { id: 'alphabet', kind: 'landmark', name: 'Alphabetic Tower', at: [41.656, 41.6394], note: 'The landmark at the tip of the cape, in the seafront park. "Near the Alphabet Tower" means the best of the Old Town.' },
    { id: 'ali-nino', kind: 'landmark', name: 'Ali & Nino statue', at: [41.6556, 41.6431], note: 'The moving statue on the port promenade — the most photographed spot in the city.' },
    { id: 'europe-sq', kind: 'landmark', name: 'Europe Square', at: [41.651, 41.6361], note: 'The centre of the Old Town. Distances in a listing are best given from here.' },
    { id: 'piazza', kind: 'landmark', name: 'Batumi Piazza', at: [41.6502, 41.6402], note: 'Restaurant square in the Old Town; live music most evenings in season.' },
    { id: 'park', kind: 'landmark', name: '6 May Park and lake', at: [41.6477, 41.6292], note: 'The city’s main park, with the dolphinarium. Marks where the Old Town ends and the old boulevard begins.' },
    { id: 'university', kind: 'landmark', name: 'Batumi State University', at: [41.6499, 41.6275], note: 'On the old boulevard. A steady source of long-term tenants nearby.' },
    { id: 'stadium', kind: 'landmark', name: 'Batumi Stadium', at: [41.6352, 41.6192], note: 'The football arena behind the new boulevard — a useful marker for "second line".' },
    { id: 'orbi', kind: 'landmark', name: 'Orbi City', at: [41.6389, 41.6142], note: 'The largest aparthotel complex in the city and the reference point for the start of the tower district. Clients often know the name.' },
    { id: 'grand-mall', kind: 'landmark', name: 'Grand Mall', at: [41.6355, 41.608], note: 'The main shopping mall on the new boulevard.' },
    { id: 'botanical', kind: 'landmark', name: 'Batumi Botanical Garden', at: [41.7014, 41.7199], note: 'At Green Cape — one of the largest botanical gardens in the region and the reason people know the north coast.' },
    { id: 'gonio-fort', kind: 'landmark', name: 'Gonio Fortress', at: [41.5733, 41.5738], note: 'Roman fortress on the coast road; the centre of Gonio.' },
    { id: 'kvariati', kind: 'landmark', name: 'Kvariati beach', at: [41.5476, 41.5638], note: 'The clearest water near Batumi, under green cliffs; popular for diving.' },

    // ── Where the business is ──────────────────────────────────────────────
    { id: 'op-oldtown', kind: 'opportunity', name: 'Old Town: short-lets and street-level units', at: [41.6488, 41.6375], note: 'Year-round visitors and almost no new supply. Small renovated flats let well; ground-floor units suit cafés and shops. Worth sourcing resale stock here for clients who ask for "safe".' },
    { id: 'op-managed', kind: 'opportunity', name: 'New Boulevard: operator-run apartments', at: [41.633, 41.6045], note: 'The apartments that earn in winter are the ones run by a real hotel operator. Lead with the operator and its track record, not with the view. This is where our off-plan sales belong.' },
    { id: 'op-retail', kind: 'opportunity', name: 'Shops and services under the towers', at: [41.6372, 41.6118], note: 'Tens of thousands of apartments and their guests need groceries, pharmacies, laundry, car hire and restaurants. Ground-floor commercial in the tower district is undersold to our investor base.' },
    { id: 'op-longterm', kind: 'opportunity', name: 'Year-round renting behind the boulevard', at: [41.641, 41.628], note: 'Students, medical staff and relocating families rent by the year here. Lower income than a summer short-let on paper, but twelve months of it — a good second purchase for an existing client.' },
    { id: 'op-villas', kind: 'opportunity', name: 'Gonio and Kvariati: villas and boutique stays', at: [41.565, 41.571], note: 'Buildable land between hill and sea is scarce. Villas and small boutique hotels command high summer rates; suits lifestyle buyers and clients who refuse a tower.' },
    { id: 'op-wellness', kind: 'opportunity', name: 'Green Cape: view and wellness concepts', at: [41.69, 41.708], note: 'Quiet, green, with the whole bay in front. Fits retreat, wellness and long-stay concepts better than nightly tourist lets.' },
    { id: 'op-land', kind: 'opportunity', name: 'Airport end: land and long holds', at: [41.6135, 41.591], note: 'The boulevard is being extended this way. For a client with patience and no need of income, this is where the city’s next seafront is being drawn — at today’s lowest coastal prices.' },

    // ── Where not to put a client ──────────────────────────────────────────
    { id: 'risk-oil', kind: 'risk', name: 'Oil terminal and tank farm', at: [41.6442, 41.6621], note: 'Heavy industry with tanker and rail traffic. Avoid residential purchases around it, whatever the view from the brochure.' },
    { id: 'risk-rail', kind: 'risk', name: 'Freight rail yard', at: [41.655, 41.672], note: 'Shunting and freight day and night between the port and the station.' },
    { id: 'risk-flight', kind: 'risk', name: 'Runway approach', at: [41.6145, 41.608], note: 'Buildings in line with the runway get aircraft noise at low altitude. Summer brings the most flights — exactly when guests are in the apartment.' },
    { id: 'risk-delta', kind: 'risk', name: 'Chorokhi river delta', at: [41.6035, 41.578], note: 'Low, wet ground at the river mouth, and a protected wetland. Be careful with ground floors, basements and parking, and with any plot sold as "next to the sea" here.' },
    { id: 'risk-studios', kind: 'risk', name: 'Mega-towers of small studios', at: [41.6395, 41.6165], note: 'Not a place but a product. Where one building holds thousands of near-identical studios, owners undercut each other on rent and on resale. Prefer buildings with fewer units, larger layouts or a single operator.' },
    { id: 'risk-border', kind: 'risk', name: 'Border lorry queue', at: [41.531, 41.553], note: 'Trucks waiting for the Sarpi crossing line the only coast road. A villa above the road is fine; one that faces it is not.' },
    { id: 'risk-shoreline', kind: 'risk', name: 'North coast: road and railway on the shore', at: [41.672, 41.6895], note: 'Along Makhinjauri the highway and the railway run between the buildings and the beach. "First line" here can mean first line to the tracks.' },
  ],
}
