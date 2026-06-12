import type { WellnessSession } from '../stores/wellness-store'

type SeedSession = Omit<WellnessSession, 'id' | 'brand' | 'created_at' | 'updated_at'>

const DISCLAIMER =
  'This is general wellness education, not medical advice. Always talk with your HFM practitioner about your individual needs.'

/**
 * The Daily Wellness content library for HFM.
 * 7 categories x 3 sessions = 21 sessions, each 4–6 interactive cards.
 * Warm, women-centered, holistic, fun — and strictly GENERAL education
 * (no diagnosis, prescription, supplement dosing, or cure claims).
 * Every session ships as 'draft' for practitioner review before publishing.
 */
/** Derive a difficulty tier from a session's 0-based order (matches store logic). */
function seedDifficulty(order: number): 1 | 2 | 3 {
  const o = order + 1
  if (o <= 2) return 1
  if (o <= 4) return 2
  return 3
}

/** Derive focus_areas from category + title keywords (matches store logic). */
function seedFocusAreas(categoryKey: string, title: string): string[] {
  const areas = new Set<string>()
  const t = title.toLowerCase()
  switch (categoryKey) {
    case 'hormone-harmony': areas.add('hormones'); areas.add('pcos'); break
    case 'gut-glow': areas.add('gut'); break
    case 'energy-vitality': areas.add('energy'); break
    case 'nourish': areas.add('blood-sugar'); break
    case 'mind-mood': areas.add('stress'); break
    case 'rest-restore': areas.add('sleep'); break
    case 'inner-balance': areas.add('stress'); break
  }
  if (t.includes('blood sugar') || t.includes('protein') || t.includes('balanced plate') || t.includes('rainbow')) areas.add('blood-sugar')
  if (t.includes('blood pressure') || t.includes('heart')) areas.add('heart')
  if (t.includes('gut') || t.includes('fiber') || t.includes('digest')) areas.add('gut')
  if (t.includes('cycle') || t.includes('pcos') || t.includes('hormone')) { areas.add('hormones'); areas.add('pcos') }
  if (t.includes('stress') || t.includes('cortisol') || t.includes('breath') || t.includes('nervous')) areas.add('stress')
  if (t.includes('sleep') || t.includes('wind-down') || t.includes('screen')) areas.add('sleep')
  if (t.includes('hydrat') || t.includes('water')) areas.add('energy')
  return [...areas]
}

export function seedWellnessSessions(): SeedSession[] {
  return SESSIONS.map(s => ({
    ...s,
    difficulty: s.difficulty ?? seedDifficulty(s.order),
    focus_areas: s.focus_areas ?? seedFocusAreas(s.category_key, s.title),
    cards: s.cards.map(card =>
      card.type === 'complete'
        ? { ...card, body: card.body ? `${card.body} ${DISCLAIMER}` : DISCLAIMER }
        : card,
    ),
  }))
}

const SESSIONS: SeedSession[] = [
    // ───────────────────────────────────────── HORMONE HARMONY 🌸
    {
      category_key: 'hormone-harmony',
      title: 'Your Cycle Has Seasons',
      subtitle: 'Meet the four phases that shape your month',
      order: 0,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'hh-seasons-c1', type: 'teach',
          heading: 'You have an inner calendar',
          body: 'Your menstrual cycle isn\'t one steady state — it moves through four phases, a little like seasons. Menstrual (winter, rest), follicular (spring, fresh energy), ovulatory (summer, peak social spark), and luteal (autumn, winding down). Noticing where you are can help you understand your shifting energy and mood.',
        },
        {
          id: 'hh-seasons-c2', type: 'quiz',
          question: 'Which phase is often described as your inner "spring" — rising energy and fresh ideas?',
          options: ['Menstrual', 'Follicular', 'Luteal', 'Ovulatory'],
          correct_index: 1,
          explanation: 'Yes! The follicular phase, just after your period, is when many women feel a lift in energy and creativity. Spring has sprung.',
        },
        {
          id: 'hh-seasons-c3', type: 'truefalse',
          statement: 'Feeling more reflective or low-energy before your period means something is wrong.',
          is_true: false,
          explanation: 'Not at all. The luteal phase ("autumn") naturally invites slowing down. Honoring that rhythm is a form of self-care, not a problem to fix.',
        },
        {
          id: 'hh-seasons-c4', type: 'tip',
          heading: 'Try cycle-aware planning',
          body: 'When you can, schedule big social or creative pushes for your follicular and ovulatory weeks, and gentler, restful tasks for the days before your period.',
          habit: 'Mark today\'s cycle phase in a note or journal — just one word.',
        },
        {
          id: 'hh-seasons-c5', type: 'complete',
          takeaway: 'Your cycle is a rhythm, not a flaw — and working with it feels kinder than fighting it.',
          affirmation: 'I move with my own natural seasons.',
        },
      ],
    },
    {
      category_key: 'hormone-harmony',
      title: 'Blood Sugar & Your Hormones',
      subtitle: 'The steady-energy connection',
      order: 1,
      est_minutes: 7,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'hh-bloodsugar-c1', type: 'teach',
          heading: 'A backstage influence',
          body: 'Big swings in blood sugar — the spikes and crashes after a sugary snack on an empty stomach — can ripple into how your hormones feel, nudging energy, mood, and cravings. Gentle, balanced eating helps keep that backstage crew calm.',
        },
        {
          id: 'hh-bloodsugar-c2', type: 'truefalse',
          statement: 'Pairing carbohydrates with protein, fat, or fiber tends to soften blood-sugar spikes.',
          is_true: true,
          explanation: 'Exactly. An apple with a handful of nuts lands more gently than the apple alone. Balance is the friendly trick here.',
        },
        {
          id: 'hh-bloodsugar-c3', type: 'quiz',
          question: 'Which breakfast is most likely to give you steady energy through the morning?',
          options: ['Just a pastry and coffee', 'Eggs with veggies and whole-grain toast', 'A large fruit juice on its own', 'Nothing — skipping it'],
          correct_index: 1,
          explanation: 'A breakfast with protein, fiber, and some healthy fat tends to keep energy steadier than sugar alone. Nice choice.',
        },
        {
          id: 'hh-bloodsugar-c4', type: 'reflect',
          prompt: 'When in your day do you usually hit a slump or a strong craving? What did you eat beforehand?',
          placeholder: 'e.g., around 3pm, after a light lunch...',
        },
        {
          id: 'hh-bloodsugar-c5', type: 'tip',
          heading: 'The balanced plate',
          body: 'Aim for a mix on your plate — something with protein, something with fiber, something with healthy fat — most of the time.',
          habit: 'Add one source of protein to your next snack.',
        },
        {
          id: 'hh-bloodsugar-c6', type: 'complete',
          takeaway: 'Steadier blood sugar can mean steadier energy and mood — small pairings, big difference.',
          affirmation: 'I nourish myself in balanced, loving ways.',
        },
      ],
    },
    {
      category_key: 'hormone-harmony',
      title: 'Stress Hormones 101',
      subtitle: 'Meet cortisol, gently',
      order: 2,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'hh-cortisol-c1', type: 'teach',
          heading: 'Cortisol isn\'t the villain',
          body: 'Cortisol is your body\'s natural "get-up-and-go" hormone — it helps you wake, focus, and respond to challenges. It\'s meant to rise and fall in a daily rhythm. The trouble is when stress keeps it elevated around the clock with no chance to settle.',
        },
        {
          id: 'hh-cortisol-c2', type: 'quiz',
          question: 'In a healthy daily rhythm, cortisol is typically highest at which time?',
          options: ['Right before bed', 'In the morning', 'At midnight', 'It stays flat all day'],
          correct_index: 1,
          explanation: 'Right! A natural morning rise helps you feel alert. It then tapers through the day so you can wind down at night.',
        },
        {
          id: 'hh-cortisol-c3', type: 'truefalse',
          statement: 'Short, simple practices like slow breathing can help signal safety to your body.',
          is_true: true,
          explanation: 'True. You can\'t think your way out of stress, but you can breathe your way toward calm — the body listens to a long, slow exhale.',
        },
        {
          id: 'hh-cortisol-c4', type: 'tip',
          heading: 'A 90-second reset',
          body: 'When you notice tension, try a few slow breaths where the exhale is longer than the inhale. This gently nudges your nervous system toward calm.',
          habit: 'Take three long exhales before your next meal.',
        },
        {
          id: 'hh-cortisol-c5', type: 'complete',
          takeaway: 'Cortisol works best in rhythm — rising to meet the day, softening to meet the night.',
          affirmation: 'I give my body permission to rest.',
        },
      ],
    },

    // ───────────────────────────────────────── GUT & GLOW 🌿
    {
      category_key: 'gut-glow',
      title: 'The Gut–Skin Chat',
      subtitle: 'Why your glow starts inside',
      order: 0,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'gg-skin-c1', type: 'teach',
          heading: 'Your gut and skin gossip',
          body: 'Your gut and your skin are in constant conversation. A happy, diverse gut microbiome supports a calm, balanced complexion — which is why so many holistic practitioners look "inside out" when it comes to glow. Hydration, fiber, and variety all play a role.',
        },
        {
          id: 'gg-skin-c2', type: 'truefalse',
          statement: 'A varied diet rich in plants tends to support a more diverse gut microbiome.',
          is_true: true,
          explanation: 'True! Different plants feed different friendly microbes. Variety is the spice — and the strategy.',
        },
        {
          id: 'gg-skin-c3', type: 'quiz',
          question: 'Which everyday habit most directly supports both gut and skin?',
          options: ['Skipping meals', 'Staying well hydrated', 'Avoiding all fiber', 'Eating the same thing daily'],
          correct_index: 1,
          explanation: 'Hydration supports digestion and gives skin a plumper, healthier look. Two wins from one glass of water.',
        },
        {
          id: 'gg-skin-c4', type: 'tip',
          heading: 'Eat a rainbow this week',
          body: 'Different colors of produce bring different nutrients and plant fibers that feed your friendly gut bacteria.',
          habit: 'Add one new color of vegetable or fruit to your plate today.',
        },
        {
          id: 'gg-skin-c5', type: 'complete',
          takeaway: 'Glow is an inside job — feed the gut, and the skin often follows.',
          affirmation: 'I nourish myself from the inside out.',
        },
      ],
    },
    {
      category_key: 'gut-glow',
      title: 'Fiber & Your Friendly Bacteria',
      subtitle: 'Feeding the good guys',
      order: 1,
      est_minutes: 7,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'gg-fiber-c1', type: 'teach',
          heading: 'Fiber is a feast',
          body: 'Fiber isn\'t just for digestion — much of it is food for the trillions of friendly bacteria living in your gut. When they feast on fiber, they produce helpful compounds that support your whole body. Think of fiber as a thank-you gift to your inner garden.',
        },
        {
          id: 'gg-fiber-c2', type: 'quiz',
          question: 'Which of these is a great source of gut-friendly fiber?',
          options: ['White bread', 'Beans and lentils', 'Soda', 'Plain candy'],
          correct_index: 1,
          explanation: 'Beans and lentils are fiber superstars. Your friendly bacteria send their thanks!',
        },
        {
          id: 'gg-fiber-c3', type: 'truefalse',
          statement: 'It\'s best to increase fiber gradually and drink plenty of water alongside it.',
          is_true: true,
          explanation: 'True. A slow build with good hydration keeps things comfortable as your gut adjusts. Gentle and steady wins.',
        },
        {
          id: 'gg-fiber-c4', type: 'reflect',
          prompt: 'What\'s one fiber-rich food you genuinely enjoy and could eat more often?',
          placeholder: 'e.g., raspberries, oats, chickpeas...',
        },
        {
          id: 'gg-fiber-c5', type: 'tip',
          heading: 'A spoonful of variety',
          body: 'Mixing different fiber sources — fruits, veggies, beans, whole grains, seeds — feeds a wider range of friendly microbes.',
          habit: 'Sprinkle a spoonful of seeds onto something you eat today.',
        },
        {
          id: 'gg-fiber-c6', type: 'complete',
          takeaway: 'Fiber feeds your inner garden — variety keeps it thriving.',
          affirmation: 'I tend to my body with care and patience.',
        },
      ],
    },
    {
      category_key: 'gut-glow',
      title: 'Mindful Eating',
      subtitle: 'Slow down, digest well',
      order: 2,
      est_minutes: 5,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'gg-mindful-c1', type: 'teach',
          heading: 'Digestion starts before the first bite',
          body: 'When you slow down and actually notice your food — the smell, the colors, the first chew — your body shifts into "rest and digest" mode. Eating in a rush or distracted can leave your digestion playing catch-up. A calmer meal is often a kinder meal.',
        },
        {
          id: 'gg-mindful-c2', type: 'truefalse',
          statement: 'Chewing thoroughly gives your digestion a helpful head start.',
          is_true: true,
          explanation: 'True! Chewing breaks food down and mixes it with saliva, so the rest of digestion has less heavy lifting to do.',
        },
        {
          id: 'gg-mindful-c3', type: 'quiz',
          question: 'Which habit best supports calm, mindful digestion?',
          options: ['Eating while scrolling', 'Pausing to breathe before eating', 'Finishing as fast as possible', 'Standing and rushing'],
          correct_index: 1,
          explanation: 'A single calming breath before you eat helps your body settle into digest mode. Small ritual, real effect.',
        },
        {
          id: 'gg-mindful-c4', type: 'tip',
          heading: 'The one-breath ritual',
          body: 'Before your next meal, take one slow breath and notice what\'s on your plate before you begin.',
          habit: 'Eat one meal today without a screen.',
        },
        {
          id: 'gg-mindful-c5', type: 'complete',
          takeaway: 'A slower meal is a gift to your gut — presence aids digestion.',
          affirmation: 'I eat with presence and gratitude.',
        },
      ],
    },

    // ───────────────────────────────────────── ENERGY & VITALITY ⚡
    {
      category_key: 'energy-vitality',
      title: 'Morning Light Magic',
      subtitle: 'Set your inner clock',
      order: 0,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'ev-light-c1', type: 'teach',
          heading: 'Light is a signal',
          body: 'Your body runs on a roughly 24-hour internal clock called your circadian rhythm. Morning light is one of its strongest cues — getting bright light soon after waking helps tell your body "it\'s daytime," supporting steadier energy and easier sleep later.',
        },
        {
          id: 'ev-light-c2', type: 'quiz',
          question: 'When is natural light especially helpful for setting your inner clock?',
          options: ['Late at night', 'Within an hour or so of waking', 'Only at noon', 'It doesn\'t matter when'],
          correct_index: 1,
          explanation: 'Morning light is the headline act. A few minutes outside soon after waking can anchor your whole day.',
        },
        {
          id: 'ev-light-c3', type: 'truefalse',
          statement: 'Even on a cloudy day, outdoor light is much brighter than typical indoor lighting.',
          is_true: true,
          explanation: 'True! Outdoor light — even overcast — is far brighter than most indoor rooms, so stepping outside still counts.',
        },
        {
          id: 'ev-light-c4', type: 'tip',
          heading: 'Step outside first thing',
          body: 'Try a few minutes of morning light — on a balcony, by a window, or on a short walk — soon after you wake.',
          habit: 'Get some natural light within an hour of waking tomorrow.',
        },
        {
          id: 'ev-light-c5', type: 'complete',
          takeaway: 'Morning light anchors your energy — a free, gentle daily reset.',
          affirmation: 'I greet each day with light and intention.',
        },
      ],
    },
    {
      category_key: 'energy-vitality',
      title: 'The Hydration Habit',
      subtitle: 'Water as quiet fuel',
      order: 1,
      est_minutes: 5,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'ev-hydrate-c1', type: 'teach',
          heading: 'Tired? You might be thirsty',
          body: 'Even mild dehydration can show up as low energy, fuzzy focus, or a headache long before you feel "thirsty." Your body is mostly water, and it uses it for nearly everything. Sipping steadily through the day is one of the simplest vitality boosters there is.',
        },
        {
          id: 'ev-hydrate-c2', type: 'truefalse',
          statement: 'Feeling thirsty is an early, reliable sign you need water.',
          is_true: false,
          explanation: 'Actually, thirst tends to show up after you\'re already a bit low. Sipping regularly — before you feel parched — keeps you ahead of it.',
        },
        {
          id: 'ev-hydrate-c3', type: 'quiz',
          question: 'Which is a gentle way to drink more water through the day?',
          options: ['Waiting until very thirsty', 'Keeping a bottle within sight', 'Only drinking at dinner', 'Replacing water with soda'],
          correct_index: 1,
          explanation: 'A visible bottle is a friendly nudge — out of sight, out of sips. Keep it where you\'ll see it.',
        },
        {
          id: 'ev-hydrate-c4', type: 'tip',
          heading: 'Anchor it to a habit',
          body: 'Pair a glass of water with something you already do — like before each meal or after brushing your teeth.',
          habit: 'Drink a glass of water right after this session.',
        },
        {
          id: 'ev-hydrate-c5', type: 'complete',
          takeaway: 'Steady sips beat big gulps — hydration is quiet, daily fuel.',
          affirmation: 'I care for my body in small, steady ways.',
        },
      ],
    },
    {
      category_key: 'energy-vitality',
      title: 'Befriending the Afternoon Dip',
      subtitle: 'Ride the slump, gently',
      order: 2,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'ev-dip-c1', type: 'teach',
          heading: 'The dip is normal',
          body: 'That mid-afternoon lull around 2–4pm? It\'s a natural part of your circadian rhythm — not a personal failing or proof you need more caffeine. Knowing it\'s coming lets you meet it with a short reset instead of a sugar-and-coffee scramble.',
        },
        {
          id: 'ev-dip-c2', type: 'quiz',
          question: 'Which is a refreshing way to meet the afternoon dip?',
          options: ['A short walk or stretch', 'A third large coffee', 'A big sugary snack', 'Pushing through with zero break'],
          correct_index: 0,
          explanation: 'Movement and a change of scene can re-energize you naturally — often more lasting than another caffeine hit.',
        },
        {
          id: 'ev-dip-c3', type: 'truefalse',
          statement: 'Caffeine late in the afternoon can sometimes ripple into your night\'s sleep.',
          is_true: true,
          explanation: 'True. Caffeine can linger for hours, so a late cup may quietly nibble at your sleep. A walk is a gentler pick-me-up.',
        },
        {
          id: 'ev-dip-c4', type: 'reflect',
          prompt: 'What\'s one small, energizing reset you could try the next time your energy dips?',
          placeholder: 'e.g., step outside, stretch, glass of water...',
        },
        {
          id: 'ev-dip-c5', type: 'tip',
          heading: 'A two-minute reset',
          body: 'When the dip hits, stand up, stretch, and take a few breaths — bonus points for stepping near a window or outside.',
          habit: 'Schedule a two-minute movement break for your next afternoon dip.',
        },
        {
          id: 'ev-dip-c6', type: 'complete',
          takeaway: 'The afternoon dip is natural — a gentle reset beats a frantic fix.',
          affirmation: 'I respond to my body\'s rhythms with kindness.',
        },
      ],
    },

    // ───────────────────────────────────────── NOURISH 🥗
    {
      category_key: 'nourish',
      title: 'Eat the Rainbow',
      subtitle: 'Color is nutrition',
      order: 0,
      est_minutes: 5,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'no-rainbow-c1', type: 'teach',
          heading: 'Color tells a story',
          body: 'The colors in fruits and vegetables come from plant compounds — each hue offering its own gifts. Deep greens, sunny oranges, rich purples: together they bring a wider spectrum of nutrients than any single "superfood" ever could. Variety is the real superpower.',
        },
        {
          id: 'no-rainbow-c2', type: 'quiz',
          question: 'Why is eating a variety of produce colors helpful?',
          options: ['It looks pretty only', 'Different colors offer different nutrients', 'Color has no meaning', 'One color is always best'],
          correct_index: 1,
          explanation: 'Each color brings its own plant compounds and nutrients, so a colorful plate covers more bases. Eat the rainbow!',
        },
        {
          id: 'no-rainbow-c3', type: 'truefalse',
          statement: 'You need an exotic, expensive superfood to eat well.',
          is_true: false,
          explanation: 'Happily, no. Everyday colorful produce — carrots, spinach, berries, peppers — is wonderfully nourishing and budget-friendly.',
        },
        {
          id: 'no-rainbow-c4', type: 'tip',
          heading: 'Count your colors',
          body: 'At one meal today, see how many different colors of plants you can include.',
          habit: 'Aim for three produce colors on your next plate.',
        },
        {
          id: 'no-rainbow-c5', type: 'complete',
          takeaway: 'A colorful plate is a nourishing plate — variety beats any single superfood.',
          affirmation: 'I fill my plate with color and life.',
        },
      ],
    },
    {
      category_key: 'nourish',
      title: 'Protein at Breakfast',
      subtitle: 'Start strong, stay steady',
      order: 1,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'no-protein-c1', type: 'teach',
          heading: 'Front-load your protein',
          body: 'Many of us eat most of our protein at dinner, but starting the day with some can help you feel fuller and steadier through the morning. Protein is the building block your body uses for muscles, hormones, and more — and breakfast is a great place to give it a head start.',
        },
        {
          id: 'no-protein-c2', type: 'quiz',
          question: 'Which breakfast brings a nice dose of protein?',
          options: ['Plain toast with jam', 'Greek yogurt with seeds', 'A glass of juice', 'A plain bagel'],
          correct_index: 1,
          explanation: 'Greek yogurt is protein-rich, and the seeds add fiber and crunch. A steady, satisfying start.',
        },
        {
          id: 'no-protein-c3', type: 'truefalse',
          statement: 'A protein-containing breakfast can help reduce mid-morning cravings for many people.',
          is_true: true,
          explanation: 'True. Protein helps you feel satisfied longer, so the cookie jar calls a little less loudly before lunch.',
        },
        {
          id: 'no-protein-c4', type: 'reflect',
          prompt: 'What does your usual breakfast look like — and where could a little protein sneak in?',
          placeholder: 'e.g., add eggs, yogurt, or nut butter...',
        },
        {
          id: 'no-protein-c5', type: 'tip',
          heading: 'Pick your protein',
          body: 'Eggs, Greek yogurt, cottage cheese, tofu, beans, or nut butter are all easy breakfast protein helpers.',
          habit: 'Add one protein source to tomorrow\'s breakfast.',
        },
        {
          id: 'no-protein-c6', type: 'complete',
          takeaway: 'A little protein at breakfast can mean steadier energy all morning.',
          affirmation: 'I begin my day by truly nourishing myself.',
        },
      ],
    },
    {
      category_key: 'nourish',
      title: 'The Balanced Plate',
      subtitle: 'A simple blueprint for any meal',
      order: 2,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'no-plate-c1', type: 'teach',
          heading: 'No measuring required',
          body: 'A balanced plate is an easy visual guide: roughly half non-starchy vegetables, a quarter protein, and a quarter whole-food carbs, plus a little healthy fat. It\'s flexible, forgiving, and works for almost any cuisine — no scales or calorie math needed.',
        },
        {
          id: 'no-plate-c2', type: 'quiz',
          question: 'In the simple balanced-plate guide, about how much is non-starchy vegetables?',
          options: ['A tiny corner', 'About half', 'The whole plate', 'None'],
          correct_index: 1,
          explanation: 'About half! Veggies bring fiber, color, and volume — a generous, satisfying foundation.',
        },
        {
          id: 'no-plate-c3', type: 'truefalse',
          statement: 'The balanced-plate approach requires weighing and counting every gram.',
          is_true: false,
          explanation: 'Nope — that\'s the beauty of it. It\'s a friendly visual estimate, not a math exam. Eyeballing is welcome.',
        },
        {
          id: 'no-plate-c4', type: 'tip',
          heading: 'Build it by sight',
          body: 'Picture the plate in halves and quarters as you serve — veggies first, then protein, then carbs and a touch of fat.',
          habit: 'Use the half-plate-veggies idea at one meal today.',
        },
        {
          id: 'no-plate-c5', type: 'complete',
          takeaway: 'A balanced plate is a flexible blueprint — no perfection or counting needed.',
          affirmation: 'I trust simple, sustainable choices.',
        },
      ],
    },

    // ───────────────────────────────────────── MIND & MOOD 🧠
    {
      category_key: 'mind-mood',
      title: 'Your Nervous System 101',
      subtitle: 'Two gears: go and rest',
      order: 0,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'mm-ns-c1', type: 'teach',
          heading: 'Your built-in gearbox',
          body: 'Your nervous system has two main gears. The sympathetic ("go") gear revs you up for action, and the parasympathetic ("rest and digest") gear helps you calm and recover. Both are healthy — wellness is about being able to shift between them, not living stuck in "go."',
        },
        {
          id: 'mm-ns-c2', type: 'quiz',
          question: 'Which gear helps your body calm, recover, and digest?',
          options: ['Sympathetic ("go")', 'Parasympathetic ("rest")', 'Neither', 'They do the same thing'],
          correct_index: 1,
          explanation: 'The parasympathetic branch is your rest-and-digest gear. Learning to invite it in is a real wellness skill.',
        },
        {
          id: 'mm-ns-c3', type: 'truefalse',
          statement: 'A slow, extended exhale can help nudge you toward the "rest" gear.',
          is_true: true,
          explanation: 'True. A long exhale is like a gentle signal to your body that it\'s safe to settle. Your breath is a built-in remote control.',
        },
        {
          id: 'mm-ns-c4', type: 'tip',
          heading: 'Find your off-ramp',
          body: 'When you feel revved up, try a few breaths with a longer exhale, or place a hand on your chest and slow down.',
          habit: 'Take five slow breaths the next time you feel tense.',
        },
        {
          id: 'mm-ns-c5', type: 'complete',
          takeaway: 'Health isn\'t about never stressing — it\'s about being able to come back to calm.',
          affirmation: 'I can return to calm whenever I need to.',
        },
      ],
    },
    {
      category_key: 'mind-mood',
      title: 'A 60-Second Breath',
      subtitle: 'Calm on demand',
      order: 1,
      est_minutes: 5,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'mm-breath-c1', type: 'teach',
          heading: 'The fastest calming tool you own',
          body: 'Your breath is always with you, and it\'s one of the quickest ways to shift your state. Slowing it down — especially lengthening the exhale — gently signals your body to relax. No app, no equipment, no cost. Just one minute can take the edge off.',
        },
        {
          id: 'mm-breath-c2', type: 'truefalse',
          statement: 'Breathing exercises need special equipment to work.',
          is_true: false,
          explanation: 'Not at all — your breath is free and portable. You can do this in line at the store and no one will even notice.',
        },
        {
          id: 'mm-breath-c3', type: 'quiz',
          question: 'In many calming breath practices, the exhale is...',
          options: ['Shorter than the inhale', 'The same length, always', 'As long or longer than the inhale', 'Held forever'],
          correct_index: 2,
          explanation: 'A longer exhale tends to be the calming part. Try inhaling for 4, exhaling for 6, and notice how you feel.',
        },
        {
          id: 'mm-breath-c4', type: 'tip',
          heading: 'Try it right now',
          body: 'Inhale slowly for a count of four, then exhale gently for a count of six. Repeat a few times and notice any shift.',
          habit: 'Do one minute of slow breathing before bed tonight.',
        },
        {
          id: 'mm-breath-c5', type: 'complete',
          takeaway: 'Calm is one slow breath away — and it\'s always within reach.',
          affirmation: 'My breath brings me home to myself.',
        },
      ],
    },
    {
      category_key: 'mind-mood',
      title: 'Naming Your Feelings',
      subtitle: 'Name it to tame it',
      order: 2,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'mm-name-c1', type: 'teach',
          heading: 'Words soften big feelings',
          body: 'Simply putting a feeling into words — "I\'m feeling anxious," "I\'m frustrated" — can take some of the heat out of it. Naming an emotion helps you observe it rather than be swept away by it. It\'s a small act of awareness with a surprisingly steadying effect.',
        },
        {
          id: 'mm-name-c2', type: 'quiz',
          question: 'What can gently happen when you name an emotion you\'re feeling?',
          options: ['It instantly disappears forever', 'It often becomes a little easier to manage', 'It always gets worse', 'Nothing changes ever'],
          correct_index: 1,
          explanation: 'Naming a feeling tends to make it feel a touch more manageable — you become the observer, not just the swept-along.',
        },
        {
          id: 'mm-name-c3', type: 'truefalse',
          statement: 'You can feel more than one emotion at the same time.',
          is_true: true,
          explanation: 'True. We\'re wonderfully complex — relief and sadness, or excitement and nerves, can absolutely share the stage.',
        },
        {
          id: 'mm-name-c4', type: 'reflect',
          prompt: 'What\'s one feeling present for you right now? Try naming it in a word or two.',
          placeholder: 'e.g., tired, hopeful, a bit anxious...',
        },
        {
          id: 'mm-name-c5', type: 'tip',
          heading: 'The daily check-in',
          body: 'Once a day, pause and ask, "What am I feeling right now?" — no need to fix it, just notice and name it.',
          habit: 'Name one feeling out loud or in a journal today.',
        },
        {
          id: 'mm-name-c6', type: 'complete',
          takeaway: 'Naming a feeling is the first gentle step to working with it.',
          affirmation: 'My feelings are welcome and worth noticing.',
        },
      ],
    },

    // ───────────────────────────────────────── REST & RESTORE 🌙
    {
      category_key: 'rest-restore',
      title: 'Sleep Hygiene Basics',
      subtitle: 'The foundations of good rest',
      order: 0,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'rr-hygiene-c1', type: 'teach',
          heading: 'Good sleep loves routine',
          body: '"Sleep hygiene" simply means the everyday habits that set the stage for rest. A consistent sleep and wake time, a cool dark room, and a calming wind-down all help your body know when it\'s time to drift off. Small, steady habits often matter more than any single trick.',
        },
        {
          id: 'rr-hygiene-c2', type: 'quiz',
          question: 'Which habit tends to support better sleep?',
          options: ['Wildly different bedtimes each night', 'A consistent sleep and wake time', 'A bright, warm bedroom', 'A big intense workout right at bedtime'],
          correct_index: 1,
          explanation: 'Consistency is a quiet superpower. A regular rhythm helps your body anticipate and prepare for sleep.',
        },
        {
          id: 'rr-hygiene-c3', type: 'truefalse',
          statement: 'A cooler, darker bedroom generally supports deeper sleep.',
          is_true: true,
          explanation: 'True. Cool and dark are friends to good sleep — they echo the natural conditions your body associates with night.',
        },
        {
          id: 'rr-hygiene-c4', type: 'tip',
          heading: 'Pick one anchor',
          body: 'Choose a consistent wake-up time, even on weekends — it\'s one of the simplest ways to steady your whole sleep rhythm.',
          habit: 'Set a regular wake-up time for the next three days.',
        },
        {
          id: 'rr-hygiene-c5', type: 'complete',
          takeaway: 'Good sleep is built from small, consistent habits — not luck.',
          affirmation: 'I honor my need for deep, restoring rest.',
        },
      ],
    },
    {
      category_key: 'rest-restore',
      title: 'The Wind-Down Ritual',
      subtitle: 'Signal sleep is coming',
      order: 1,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'rr-winddown-c1', type: 'teach',
          heading: 'Your body needs a runway',
          body: 'We can\'t go from full-speed day to deep sleep in an instant — the body needs a gentle runway. A wind-down ritual, repeated each night, becomes a cue that rest is coming. Dimmer lights, a warm shower, a few pages of a book: small signals add up.',
        },
        {
          id: 'rr-winddown-c2', type: 'truefalse',
          statement: 'A repeated nightly routine can become a cue that helps your body prepare for sleep.',
          is_true: true,
          explanation: 'True. Repetition turns your routine into a signal — your body starts to recognize "ah, sleep is on the way."',
        },
        {
          id: 'rr-winddown-c3', type: 'quiz',
          question: 'Which is a soothing wind-down activity?',
          options: ['Intense news scrolling', 'A warm shower and dim lights', 'A heavy late meal', 'A bright overhead light'],
          correct_index: 1,
          explanation: 'Warmth and dim light gently coax your body toward rest. A lovely way to close the day.',
        },
        {
          id: 'rr-winddown-c4', type: 'reflect',
          prompt: 'What\'s one calming activity you\'d enjoy adding to your evening wind-down?',
          placeholder: 'e.g., reading, gentle stretching, tea...',
        },
        {
          id: 'rr-winddown-c5', type: 'tip',
          heading: 'Build a mini ritual',
          body: 'Pick two or three calming steps to do in the same order each night — they\'ll soon feel like a lullaby for your nervous system.',
          habit: 'Dim the lights 30 minutes before bed tonight.',
        },
        {
          id: 'rr-winddown-c6', type: 'complete',
          takeaway: 'A nightly wind-down gives your body the runway it needs to land in sleep.',
          affirmation: 'I let go of the day with ease.',
        },
      ],
    },
    {
      category_key: 'rest-restore',
      title: 'Screens & Your Sleep',
      subtitle: 'The light-at-night story',
      order: 2,
      est_minutes: 5,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'rr-screens-c1', type: 'teach',
          heading: 'Bright light says "daytime"',
          body: 'In the evening, your body naturally begins producing melatonin, a hormone that helps you feel sleepy. Bright light — including from screens late at night — can signal "it\'s still daytime" and make winding down harder. Dimming the evening can help your natural rhythm along.',
        },
        {
          id: 'rr-screens-c2', type: 'quiz',
          question: 'Which evening habit tends to support easier sleep?',
          options: ['Bright screens right up to lights-out', 'Dimming lights and screens before bed', 'Turning all lights brighter at night', 'Scrolling in a dark room for hours'],
          correct_index: 1,
          explanation: 'Easing off bright light in the evening lets your natural sleepiness build. Your body appreciates the dimmer switch.',
        },
        {
          id: 'rr-screens-c3', type: 'truefalse',
          statement: 'Melatonin is something your body can produce on its own as evening comes.',
          is_true: true,
          explanation: 'True. Your body has its own built-in evening rhythm — dimming the lights simply helps it do its thing.',
        },
        {
          id: 'rr-screens-c4', type: 'tip',
          heading: 'A gentle screen curfew',
          body: 'Try setting screens aside a little earlier in the evening, or lowering their brightness as bedtime nears.',
          habit: 'Put your phone down 20 minutes earlier tonight.',
        },
        {
          id: 'rr-screens-c5', type: 'complete',
          takeaway: 'Dimming your evening helps your natural sleepiness rise on cue.',
          affirmation: 'I create space for rest to find me.',
        },
      ],
    },

    // ───────────────────────────────────────── INNER BALANCE ✨
    {
      category_key: 'inner-balance',
      title: 'The Gratitude Practice',
      subtitle: 'Train your attention toward good',
      order: 0,
      est_minutes: 5,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'ib-gratitude-c1', type: 'teach',
          heading: 'What you notice grows',
          body: 'Gratitude is more than a nice idea — it\'s a practice of gently steering your attention toward what\'s good and present. Over time, regularly noticing small blessings can shift your overall outlook. It doesn\'t deny life\'s hard parts; it just makes sure the good ones get seen too.',
        },
        {
          id: 'ib-gratitude-c2', type: 'truefalse',
          statement: 'Gratitude means ignoring or denying difficult feelings.',
          is_true: false,
          explanation: 'Not at all. Gratitude lives alongside the hard stuff — it simply makes sure the good moments don\'t go unnoticed.',
        },
        {
          id: 'ib-gratitude-c3', type: 'quiz',
          question: 'A simple way to begin a gratitude practice is to...',
          options: ['Wait for huge life events', 'Note a few small good things regularly', 'Only feel grateful on holidays', 'Compare yourself to others'],
          correct_index: 1,
          explanation: 'Small and regular wins. Even noticing a warm cup of tea or a kind word counts beautifully.',
        },
        {
          id: 'ib-gratitude-c4', type: 'reflect',
          prompt: 'Name three small things you feel grateful for right now.',
          placeholder: 'e.g., morning light, a friend\'s text, this quiet moment...',
        },
        {
          id: 'ib-gratitude-c5', type: 'complete',
          takeaway: 'Gratitude is a gentle daily practice of noticing the good that\'s already here.',
          affirmation: 'I notice and welcome the good in my life.',
        },
      ],
    },
    {
      category_key: 'inner-balance',
      title: 'Setting Intentions',
      subtitle: 'Lead your day with meaning',
      order: 1,
      est_minutes: 5,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'ib-intention-c1', type: 'teach',
          heading: 'An intention is a compass, not a checklist',
          body: 'Where a goal is something you achieve, an intention is a way of being you choose to embody — "I want to move through today with patience," or "I\'ll be present with the people I love." Setting one in the morning can quietly guide your choices all day long.',
        },
        {
          id: 'ib-intention-c2', type: 'quiz',
          question: 'How does an intention differ from a to-do item?',
          options: ['It\'s a task to tick off', 'It\'s a way of being you choose', 'It must be done by noon', 'They are identical'],
          correct_index: 1,
          explanation: 'An intention is about how you show up, not what you cross off. It colors the whole day rather than ending in a checkmark.',
        },
        {
          id: 'ib-intention-c3', type: 'truefalse',
          statement: 'Intentions can be simple, gentle, and just a few words long.',
          is_true: true,
          explanation: 'True. "Be kind to myself today" is a perfectly powerful intention. Simple is more than enough.',
        },
        {
          id: 'ib-intention-c4', type: 'reflect',
          prompt: 'What intention would feel supportive for you today? Try finishing: "Today, I intend to..."',
          placeholder: 'e.g., move slowly, stay curious, be gentle with myself...',
        },
        {
          id: 'ib-intention-c5', type: 'tip',
          heading: 'Set it first thing',
          body: 'Before reaching for your phone in the morning, take a breath and choose one word or phrase to guide your day.',
          habit: 'Set a one-line intention when you wake tomorrow.',
        },
        {
          id: 'ib-intention-c6', type: 'complete',
          takeaway: 'An intention gently steers your day from the inside out.',
          affirmation: 'I lead my days with purpose and heart.',
        },
      ],
    },
    {
      category_key: 'inner-balance',
      title: 'Whole-Person Wellness',
      subtitle: 'Body, mind, and spirit together',
      order: 2,
      est_minutes: 6,
      points: 50,
      status: 'draft',
      cards: [
        {
          id: 'ib-whole-c1', type: 'teach',
          heading: 'You are more than your parts',
          body: 'Holistic wellness sees you as a whole person — body, mind, emotions, and spirit, all connected. A stressful week can show up in your digestion; a sense of purpose can lift your energy. Tending to one area often ripples into the others. Wellness isn\'t a single fix; it\'s a living balance.',
        },
        {
          id: 'ib-whole-c2', type: 'truefalse',
          statement: 'Your emotional and physical wellbeing can influence each other.',
          is_true: true,
          explanation: 'True. Mind and body are in constant conversation — caring for one is rarely separate from caring for the other.',
        },
        {
          id: 'ib-whole-c3', type: 'quiz',
          question: 'What best captures the holistic view of wellness?',
          options: ['Only the body matters', 'Body, mind, and spirit are interconnected', 'Each part is fully separate', 'Wellness is one quick fix'],
          correct_index: 1,
          explanation: 'Holistic care honors the whole, interconnected you. Every part is part of the picture.',
        },
        {
          id: 'ib-whole-c4', type: 'reflect',
          prompt: 'Which area of your whole-person wellness feels like it\'s asking for a little attention right now?',
          placeholder: 'e.g., rest, connection, movement, meaning...',
        },
        {
          id: 'ib-whole-c5', type: 'tip',
          heading: 'Tend one corner',
          body: 'Pick the one area that called to you, and choose a single small, kind action for it this week.',
          habit: 'Do one small thing today for the part of you that needs it.',
        },
        {
          id: 'ib-whole-c6', type: 'complete',
          takeaway: 'You are a whole, connected being — caring for one part nourishes them all.',
          affirmation: 'I honor my whole self with compassion.',
        },
      ],
    },
]
