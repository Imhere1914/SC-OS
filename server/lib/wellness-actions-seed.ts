import type { ActionTask } from '../stores/wellness-store'

/**
 * The daily ACTION-task library for HFM Daily Wellness.
 * Light, non-rigorous, warm micro-tasks across five dimensions and three
 * difficulty tiers. Targets scale by difficulty. Strictly GENERAL wellness
 * education — gentle movement, nourishment, hydration, rest, and mindset —
 * safe for a general adult audience, in a "listen to your body / check with
 * your practitioner" spirit. NO diagnosis, treatment, dosing, or cure claims.
 *
 * focus_areas tags map a task to wellness-support tracks (general lifestyle
 * habits broadly supportive of those areas), never to a condition's treatment.
 */

const ACTIONS: ActionTask[] = [
  // ───────────────────────────────── MOVEMENT 🚶
  {
    id: 'act-move-walk-1', dimension: 'movement', difficulty: 1,
    title: 'Gentle 10-minute walk',
    description: 'Step outside or stroll around indoors for about 10 minutes at an easy, comfortable pace. No rush — just gentle motion.',
    target: { value: 10, unit: 'min' },
    focus_areas: ['blood-sugar', 'heart', 'energy'],
  },
  {
    id: 'act-move-walk-2', dimension: 'movement', difficulty: 2,
    title: '15-minute walk or easy movement',
    description: 'Enjoy a 15-minute walk or some easy movement you like. Let it feel good, not effortful.',
    target: { value: 15, unit: 'min' },
    focus_areas: ['blood-sugar', 'heart', 'energy'],
  },
  {
    id: 'act-move-walk-3', dimension: 'movement', difficulty: 3,
    title: '20-minute walk or gentle flow',
    description: 'Take a 20-minute walk or move through a gentle flow. Keep it kind on your body and pause whenever you need.',
    target: { value: 20, unit: 'min' },
    focus_areas: ['blood-sugar', 'heart', 'energy'],
  },
  {
    id: 'act-move-stretch-1', dimension: 'movement', difficulty: 1,
    title: 'Take a stretch break',
    description: 'Stand up, reach toward the sky, and gently roll your shoulders and neck. A minute of unwinding is plenty.',
    focus_areas: ['stress', 'energy'],
  },
  {
    id: 'act-move-dance-2', dimension: 'movement', difficulty: 2,
    title: 'Dance to one song',
    description: 'Put on a song you love and move however feels good for its full length. Joyful movement counts.',
    focus_areas: ['energy', 'stress', 'heart'],
  },
  {
    id: 'act-move-stairs-2', dimension: 'movement', difficulty: 2,
    title: 'Take the stairs today',
    description: 'When you have the chance, choose the stairs over the elevator. Small steady efforts add up.',
    focus_areas: ['blood-sugar', 'heart'],
  },
  {
    id: 'act-move-yoga-3', dimension: 'movement', difficulty: 3,
    title: 'Gentle yoga moment',
    description: 'Flow through a few gentle yoga poses for around 10 minutes, breathing slowly. Move only as far as feels easy.',
    target: { value: 10, unit: 'min' },
    focus_areas: ['stress', 'hormones', 'energy'],
  },
  {
    id: 'act-move-standup-1', dimension: 'movement', difficulty: 1,
    title: 'Stand and move every hour',
    description: 'Set a gentle reminder to rise and move for a minute each hour today. Breaking up sitting feels great.',
    focus_areas: ['blood-sugar', 'energy'],
  },

  // ───────────────────────────────── NUTRITION 🥗
  {
    id: 'act-nutri-veg-1', dimension: 'nutrition', difficulty: 1,
    title: 'Add one vegetable to a meal',
    description: 'Slip one extra vegetable onto your plate today — a handful of greens, some carrots, anything colorful.',
    focus_areas: ['blood-sugar', 'gut', 'heart'],
  },
  {
    id: 'act-nutri-protein-2', dimension: 'nutrition', difficulty: 2,
    title: 'Eat a protein-rich breakfast',
    description: 'Start your day with some protein — eggs, yogurt, beans, or a smoothie with protein. It helps energy stay steady.',
    focus_areas: ['blood-sugar', 'energy', 'pcos'],
  },
  {
    id: 'act-nutri-plate-3', dimension: 'nutrition', difficulty: 3,
    title: 'Build a balanced plate',
    description: 'For one meal, aim for protein + fiber + color together. A simple, satisfying blueprint for steady energy.',
    focus_areas: ['blood-sugar', 'gut', 'pcos', 'heart'],
  },
  {
    id: 'act-nutri-rainbow-2', dimension: 'nutrition', difficulty: 2,
    title: 'Eat the rainbow (3 colors)',
    description: 'Aim for three different colors of plants across your day. Variety feeds variety in your gut.',
    target: { value: 3, unit: 'colors' },
    focus_areas: ['gut', 'heart'],
  },
  {
    id: 'act-nutri-rainbow-3', dimension: 'nutrition', difficulty: 3,
    title: 'Eat the rainbow (5 colors)',
    description: 'See if you can gather five different plant colors today. A fun, gentle way to nourish your gut.',
    target: { value: 5, unit: 'colors' },
    focus_areas: ['gut', 'heart'],
  },
  {
    id: 'act-nutri-swap-1', dimension: 'nutrition', difficulty: 1,
    title: 'Swap a refined snack for a whole food',
    description: 'Trade one processed snack for something whole — fruit, nuts, or veggies and hummus. Small swap, kind effect.',
    focus_areas: ['blood-sugar', 'gut'],
  },
  {
    id: 'act-nutri-fiber-2', dimension: 'nutrition', difficulty: 2,
    title: 'Add a fiber-rich food',
    description: 'Include a fiber-friendly food today — beans, oats, berries, or whole grains — to feed your friendly bacteria.',
    focus_areas: ['gut', 'blood-sugar', 'heart'],
  },
  {
    id: 'act-nutri-mindful-3', dimension: 'nutrition', difficulty: 3,
    title: 'Eat one meal mindfully',
    description: 'Sit down for one meal without screens, slow down, and notice flavors and fullness. Digestion loves calm.',
    focus_areas: ['gut', 'stress'],
  },

  // ───────────────────────────────── HYDRATION 💧
  {
    id: 'act-hydra-wake-1', dimension: 'hydration', difficulty: 1,
    title: 'Drink a glass of water when you wake',
    description: 'Start the morning with a glass of water before anything else. A simple, refreshing first win.',
    target: { value: 1, unit: 'glass' },
    focus_areas: ['energy', 'gut'],
  },
  {
    id: 'act-hydra-six-2', dimension: 'hydration', difficulty: 2,
    title: 'Reach 6 glasses of water',
    description: 'Sip your way to about six glasses of water across the day. Keep one nearby as a gentle nudge.',
    target: { value: 6, unit: 'glasses' },
    focus_areas: ['energy', 'heart', 'gut'],
  },
  {
    id: 'act-hydra-eight-3', dimension: 'hydration', difficulty: 3,
    title: 'Reach 8 glasses of water',
    description: 'Aim for around eight glasses of water today, spread out and easy. Listen to your thirst as your guide.',
    target: { value: 8, unit: 'glasses' },
    focus_areas: ['energy', 'heart', 'gut'],
  },
  {
    id: 'act-hydra-swap-1', dimension: 'hydration', difficulty: 1,
    title: 'Swap one sugary drink for water',
    description: 'Replace a single sweet drink today with water or herbal tea. A kind, refreshing little trade.',
    focus_areas: ['blood-sugar', 'heart'],
  },
  {
    id: 'act-hydra-bottle-2', dimension: 'hydration', difficulty: 2,
    title: 'Keep a water bottle within reach',
    description: 'Fill a bottle and keep it beside you today. Out where you can see it, easy to sip.',
    focus_areas: ['energy'],
  },
  {
    id: 'act-hydra-herbal-3', dimension: 'hydration', difficulty: 3,
    title: 'Enjoy a calming herbal tea',
    description: 'Brew a warm, caffeine-free herbal tea and savor it slowly. Hydration and a soothing pause in one.',
    focus_areas: ['stress', 'gut'],
  },

  // ───────────────────────────────── SLEEP 🌙
  {
    id: 'act-sleep-dim-1', dimension: 'sleep', difficulty: 1,
    title: 'Dim the lights 30 min before bed',
    description: 'Lower the lights about half an hour before bed to gently cue your body that rest is coming.',
    target: { value: 30, unit: 'min' },
    focus_areas: ['sleep', 'hormones'],
  },
  {
    id: 'act-sleep-screens-2', dimension: 'sleep', difficulty: 2,
    title: 'Screens off 45 min before bed',
    description: 'Set screens aside about 45 minutes before sleep. Let your mind wind down with something calmer instead.',
    target: { value: 45, unit: 'min' },
    focus_areas: ['sleep', 'stress'],
  },
  {
    id: 'act-sleep-bedtime-3', dimension: 'sleep', difficulty: 3,
    title: 'Keep a consistent bedtime tonight',
    description: 'Aim to go to bed around the same time as last night. Steady rhythms help rest feel more restoring.',
    focus_areas: ['sleep', 'hormones', 'energy'],
  },
  {
    id: 'act-sleep-winddown-1', dimension: 'sleep', difficulty: 1,
    title: 'A 5-minute wind-down ritual',
    description: 'Pick one calming thing — light stretching, a few pages, slow breaths — for five minutes before bed.',
    target: { value: 5, unit: 'min' },
    focus_areas: ['sleep', 'stress'],
  },
  {
    id: 'act-sleep-cool-2', dimension: 'sleep', difficulty: 2,
    title: 'Cool, dark, restful room',
    description: 'Set your room a touch cooler and darker tonight. A cozy cave helps deeper rest.',
    focus_areas: ['sleep'],
  },
  {
    id: 'act-sleep-caffeine-3', dimension: 'sleep', difficulty: 3,
    title: 'No caffeine after early afternoon',
    description: 'Enjoy your last caffeinated drink earlier today so it clears before bedtime. Your sleep will thank you.',
    focus_areas: ['sleep', 'energy'],
  },

  // ───────────────────────────────── MINDSET 🧘
  {
    id: 'act-mind-gratitude-1', dimension: 'mindset', difficulty: 1,
    title: "Name 3 things you're grateful for",
    description: 'Pause and bring to mind three things, big or small, that you appreciate today. Let yourself feel them.',
    target: { value: 3, unit: 'things' },
    focus_areas: ['stress', 'hormones'],
  },
  {
    id: 'act-mind-breath-2', dimension: 'mindset', difficulty: 2,
    title: 'Take 10 slow breaths',
    description: 'Breathe in slowly and out even slower, ten gentle rounds. A quick way to settle your nervous system.',
    target: { value: 10, unit: 'breaths' },
    focus_areas: ['stress', 'heart'],
  },
  {
    id: 'act-mind-pause-3', dimension: 'mindset', difficulty: 3,
    title: '5-minute mindful pause',
    description: 'Sit quietly for five minutes, noticing your breath and senses. No fixing — just being present.',
    target: { value: 5, unit: 'min' },
    focus_areas: ['stress', 'hormones'],
  },
  {
    id: 'act-mind-intention-1', dimension: 'mindset', difficulty: 1,
    title: 'Set one gentle intention',
    description: 'Choose one kind, simple intention for today and say it to yourself. Let it quietly guide you.',
    focus_areas: ['stress'],
  },
  {
    id: 'act-mind-daylight-2', dimension: 'mindset', difficulty: 2,
    title: 'Step outside for daylight',
    description: 'Spend a few minutes outdoors in natural light. A small dose of daylight lifts mood and steadies rhythms.',
    focus_areas: ['energy', 'sleep', 'stress'],
  },
  {
    id: 'act-mind-kindness-3', dimension: 'mindset', difficulty: 3,
    title: 'Offer yourself one kind sentence',
    description: 'Speak to yourself as you would a dear friend — one warm, encouraging sentence. Self-kindness is a practice.',
    focus_areas: ['stress', 'hormones'],
  },
]

export function seedActionTasks(): ActionTask[] {
  return ACTIONS.map(a => ({ ...a }))
}
