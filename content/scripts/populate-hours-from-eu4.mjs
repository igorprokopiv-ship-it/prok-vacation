import fs from 'node:fs'

const paths = [
  'content/trips/eu2026/itinerary.json',
  'web/src/data/itinerary.json',
]

/** Opening hours from EU4.pdf, keyed by stop id. null = no Hours line in EU4. */
const hoursByStopId = {
  // Day 1
  'stop-day1-ginger-pig': '9:00 – 17:00',
  'stop-day1-tower': '10:00 – 17:30 (last admission 15:00)',
  'stop-day1-london-wall': null,
  'stop-day1-lampery': '12:00 – 23:00',

  // Day 2
  'stop-day2-breakfast': '6:30 – 10:30 (M–F), 7:00 – 11:00 (weekends)',
  'stop-day2-hp': '9:00 – 20:00',
  'stop-day2-opt1-magdalen': '10:00 – 16:00 (October–March)',
  'stop-day2-opt1-radcliffe':
    'Bodleian Library weekdays 9:00 – 17:00; Radcliffe Square 24/7',
  'stop-day2-opt1-christ-church': 'Monday–Saturday 10:00 – 17:00',
  'stop-day2-opt1-food': null,
  'stop-day2-opt2-stpauls': '8:30 – 16:30 (last admission 16:00)',
  'stop-day2-opt2-zedel': '11:30 – 00:00',

  // Day 3
  'stop-day3-breakfast': null,
  'stop-day3-parliament': '09:00 – 17:00',
  'stop-day3-abbey': '09:30 – 15:30',
  'stop-day3-officers': null,
  'stop-day3-buckingham': '09:30 – 18:30',
  'stop-day3-regency': '10:00 – 17:00',
  'stop-day3-globe': '11:00 – 18:00',
  'stop-day3-golden-hind': '11:00 – 18:00',
  'stop-day3-tower-bridge': '9:30 – 18:00 (last admission 17:00)',
  'stop-day3-george-inn': '11:00 – 23:00',

  // Day 4
  'stop-day4-opt1-breakfast': '07:00 – 10:00',
  'stop-day4-opt1-bm': '10:00 – 17:00',
  'stop-day4-opt2-radcliffe': 'Public squares open 24/7',
  'stop-day4-opt2-magdalen': '10:00 – 16:00 (winter hours)',
  'stop-day4-blacklock': '11:45 – 20:00',
  'stop-day4-fiveguys': '10:30 – 01:00',

  // Day 5
  'stop-day5-palais-royal': '8:00 – 22:30',
  'stop-day5-breakfast': '8:00 – 20:00',
  'stop-day5-carrousel': 'N/A',
  'stop-day5-louvre': '09:00 – 18:00 (closed Tuesdays)',
  'stop-day5-lunch': '7:00 – 19:00',
  'stop-day5-sainte-chapelle': '09:00 – 19:00',
  'stop-day5-seine': '10:30 – 22:00',
  'stop-day5-notre-dame': '08:00 – 19:00',
  'stop-day5-arc': '10:00 – 22:30',
  'stop-day5-dinner': '19:00 – 22:30',

  // Day 6
  'stop-day6-carette': '7:00 – 23:30',
  'stop-day6-versailles': '09:00 – 17:30 (closed Mondays)',
  'stop-day6-eiffel': '9:00 – 00:00',
  'stop-day6-catacombs': '9:45 – 20:30 (closed Mondays)',
  'stop-day6-dinner': null,

  // Day 7
  'stop-day7-airport-breakfast': null,
  'stop-day7-opt1-pantheon': '09:00 – 18:00',
  'stop-day7-opt1-lunch': '11:00 – 21:00',
  'stop-day7-opt1-navona': null,
  'stop-day7-opt1-spanish': null,
  'stop-day7-opt1-trevi': null,
  'stop-day7-opt2-lunch': '11:00 – 21:00',
  'stop-day7-opt2-pantheon': '09:00 – 18:00',
  'stop-day7-opt2-navona': null,
  'stop-day7-opt2-spanish': null,
  'stop-day7-opt2-trevi': null,
  'stop-day7-opt3-lunch': '11:00 – 21:00',
  'stop-day7-opt3-trevi': null,
  'stop-day7-opt3-spanish': null,
  'stop-day7-opt3-navona': null,
  'stop-day7-opt3-pantheon': '09:00 – 18:00',
  'stop-day7-mattei': '18:15 – 21:30',

  // Day 8
  'stop-day8-breakfast': '07:00 – 10:00',
  'stop-day8-constantine': '08:30 – 16:30 (last admission 15:30)',
  'stop-day8-forum': '08:30 – 16:30 (last admission 15:30)',
  'stop-day8-palatine': '08:30 – 16:30 (last admission 15:30)',
  'stop-day8-colosseum': '08:30 – 16:30 (last admission 15:30)',
  'stop-day8-lunch': '11:30 – 22:30',
  'stop-day8-caracalla': '09:00 – 16:30 (last admission 15:30)',
  'stop-day8-circus': null,
  'stop-day8-capitoline': 'N/A',
  'stop-day8-trajan': 'N/A',
  'stop-day8-altar':
    '09:30 – 19:30 (rooftop elevator last admission 18:45)',
  'stop-day8-dinner': '10:30 – 23:30',

  // Day 9
  'stop-day9-st-peters': '7:00 – 19:10 (dome stairs open 8:00)',
  'stop-day9-perimeter': '08:00 – 18:00',
  'stop-day9-vatican': '08:00 – 20:00 (closed Sundays and holidays)',
  'stop-day9-lunch': '11:45 – 21:30',
  'stop-day9-castel': '09:00 – 19:30',
  'stop-day9-dinner': '11:00 – 23:00',

  // Day 10
  'stop-day10-pompeii': '09:00 – 17:00 (1 Nov–30 Mar; else until 19:00)',
  'stop-day10-lunch': null,
  'stop-day10-vesuvius': null,
  'stop-day10-dinner': '17:30 – 00:00',

  // Day 11
  'stop-day11-breakfast': '07:00 – 10:00',
}

for (const p of paths) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'))
  let updated = 0
  const missing = []
  for (const day of data.days) {
    for (const stop of day.stops) {
      if (stop.kind === 'meal' || stop.kind === 'attraction') {
        if (!(stop.id in hoursByStopId)) {
          missing.push(stop.id)
          continue
        }
        stop.hours = hoursByStopId[stop.id]
        updated++
      } else if ('hours' in stop) {
        stop.hours = null
      }
    }
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
  console.log(p, { updated, missing })
}
