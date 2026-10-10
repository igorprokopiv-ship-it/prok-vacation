import fs from 'node:fs'

const paths = [
  'content/trips/eu2026/itinerary.json',
  'web/src/data/itinerary.json',
]

/** Vibe / Must-Try from EU4.pdf Food column, keyed by stop id. */
const meals = {
  'stop-day1-ginger-pig': {
    vibe: [
      'Bustling, premium grab-and-go butcher/deli vibe. Expect to eat standing up or while walking.',
    ],
    mustTry: ['Sausage Roll'],
  },
  'stop-day1-lampery': {
    vibe: ['Lively, classic Victorian tavern atmosphere.'],
    mustTry: ['Freshly prepared pub food like classic fish and chips.'],
  },
  'stop-day2-breakfast': {
    vibe: ['English breakfast'],
    mustTry: ['Full English'],
  },
  'stop-day2-opt1-food': {
    vibe: ["UK convenience-store grab-and-go (Tesco / Sainsbury's / M&S)."],
    mustTry: ['Sandwich, drink, and snack'],
  },
  'stop-day2-opt2-zedel': {
    vibe: ['A stunning, grand 1930s Parisian Art Deco basement.'],
    mustTry: ['The Prix Fixe menu — steak haché and profiteroles'],
  },
  'stop-day3-breakfast': {
    vibe: ['Quick hotel-room breakfast from Thursday groceries'],
    mustTry: ['What was bought Thursday'],
  },
  'stop-day3-regency': {
    vibe: ['Traditional British comfort food'],
    mustTry: ['British Breakfast'],
  },
  'stop-day3-george-inn': {
    vibe: ['17th-century pub where Shakespeare and Dickens drank'],
    mustTry: ['Local ale', 'Fish and chips'],
  },
  'stop-day4-opt1-breakfast': {
    vibe: ['English breakfast'],
    mustTry: ['Full English'],
  },
  'stop-day4-blacklock': {
    vibe: ['Upscale yet unpretentious mid-century British chophouse'],
    mustTry: [
      'The "All-In" Roast',
      'The Trimmings & Unlimited Gravy',
      'Cauliflower Cheese',
      'White Chocolate Cheesecake',
    ],
  },
  'stop-day4-fiveguys': {
    vibe: ['Burgers'],
    mustTry: ['French Burger'],
  },
  'stop-day5-breakfast': {
    vibe: ['Chain bakery-café'],
    mustTry: ['Baguette'],
  },
  'stop-day5-lunch': {
    vibe: ['Scenic & comfortable'],
    mustTry: ['Subs'],
  },
  'stop-day5-dinner': {
    vibe: ['Old-school French countryside hospitality in the city'],
    mustTry: ['Traditional Auvergne sausages and thick-cut steaks'],
  },
  'stop-day6-carette': {
    vibe: ['Classic Parisian'],
    mustTry: ['Hot chocolate', 'Croissant with whipped cream'],
  },
  'stop-day6-dinner': {
    vibe: [],
    mustTry: [],
  },
  'stop-day7-airport-breakfast': {
    vibe: ['Airport hangout before the Rome flight'],
    mustTry: [],
  },
  'stop-day7-opt1-lunch': {
    vibe: ['Small, casual takeaway counter'],
    mustTry: ['The fresh Pizza Margherita straight out of the oven'],
  },
  'stop-day7-opt2-lunch': {
    vibe: ['Small, casual takeaway counter'],
    mustTry: ['The fresh Pizza Margherita straight out of the oven'],
  },
  'stop-day7-opt3-lunch': {
    vibe: ['Small, casual takeaway counter'],
    mustTry: ['The fresh Pizza Margherita straight out of the oven'],
  },
  'stop-day7-mattei': {
    vibe: [
      'Hands-on, fun, and interactive Roman cooking experience with wine',
    ],
    mustTry: [
      'The handmade pizza',
      'Traditional Roman supplì',
      'Fresh gelato you prepare from scratch',
    ],
  },
  'stop-day8-breakfast': {
    vibe: ['Relaxed morning'],
    mustTry: ['Paid hotel breakfast — next meal is 13:00'],
  },
  'stop-day8-lunch': {
    vibe: ['Authentic, blunt, and quick Roman service'],
    mustTry: ['Traditional Roman pastas'],
  },
  'stop-day8-dinner': {
    vibe: ['Welcoming, friendly, and non-touristy'],
    mustTry: [
      'Pinsa with carbonara or pistachio',
      'Meat and cheese platters',
    ],
  },
  'stop-day9-perimeter': {
    vibe: ['Hectic, basic rest-stop cafeteria'],
    mustTry: ['A standard double espresso to quickly recharge'],
  },
  'stop-day9-lunch': {
    vibe: ['Small artisan pasta shop'],
    mustTry: ['Homemade pasta'],
  },
  'stop-day9-dinner': {
    vibe: ['Relaxed yet stylish and upscale'],
    mustTry: [
      'Complimentary fresh bread and olive oil',
      'Tuna tartare with lemon',
      'Grilled octopus',
      'Pasta with calamari',
      'Tiramisu',
    ],
  },
  'stop-day10-lunch': {
    vibe: [
      'Three-course Neapolitan lunch with views across the Bay of Naples',
    ],
    mustTry: ['Authentic Neapolitan pizza'],
  },
  'stop-day10-dinner': {
    vibe: ['Cozy, elegant, and modern'],
    mustTry: ['Beef carpaccio', 'Calamari', 'Ragù with thyme'],
  },
  'stop-day11-breakfast': {
    vibe: ['Paid hotel breakfast'],
    mustTry: ['Final espresso'],
  },
}

for (const p of paths) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'))
  let updated = 0
  const missing = []
  for (const day of data.days) {
    for (const stop of day.stops) {
      if (stop.kind !== 'meal') continue
      const m = meals[stop.id]
      if (!m) {
        missing.push(stop.id)
        continue
      }
      stop.vibe = m.vibe
      stop.mustTry = m.mustTry
      updated++
    }
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
  console.log(p, { updated, missing })
}
