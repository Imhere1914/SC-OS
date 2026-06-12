import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

function dbPath(name: string) {
  mkdirSync(DATA_DIR, { recursive: true })
  return join(DATA_DIR, name)
}

function readJson<T>(file: string, fallback: T): T {
  const p = dbPath(file)
  if (!existsSync(p)) return fallback
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return fallback }
}

function writeJson(file: string, data: unknown) {
  const p = dbPath(file)
  const tmp = p + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, p)
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type LessonType = 'text' | 'video' | 'audio' | 'pdf' | 'quiz'
export type ModuleStatus = 'draft' | 'published' | 'archived'

export interface QuizQuestion {
  id: string
  question: string
  type: 'multiple_choice' | 'true_false' | 'short_answer'
  options?: string[]
  correct_answer?: string
  explanation?: string
}

export interface Lesson {
  id: string
  title: string
  type: LessonType
  content_html?: string
  video_url?: string
  audio_url?: string
  pdf_url?: string
  image_urls?: string[]
  duration_minutes?: number
  quiz_questions?: QuizQuestion[]
  order: number
  is_preview: boolean
}

export interface TrainingModule {
  id: string
  brand: string
  title: string
  slug: string
  description: string
  category: string
  thumbnail_url?: string
  instructor_name?: string
  instructor_bio?: string
  status: ModuleStatus
  is_free: boolean
  price_cents?: number
  lessons: Lesson[]
  tags: string[]
  total_duration_minutes: number
  enrolled_count: number
  share_token: string
  created_at: string
  updated_at: string
}

export interface Enrollment {
  id: string
  brand: string
  module_id: string
  contact_id?: string
  contact_name: string
  contact_email?: string
  progress: number
  completed_lessons: string[]
  started_at: string
  completed_at?: string
  last_accessed_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function nowISO() { return new Date().toISOString() }

export function generateShareToken() { return nanoid(12) }

function computeDuration(lessons: Lesson[]): number {
  return lessons.reduce((sum, l) => sum + (l.duration_minutes ?? 0), 0)
}

function modulesFile(brand: string) { return `training-modules-${brand}.json` }
function enrollmentsFile(brand: string) { return `training-enrollments-${brand}.json` }

// ── Seed data for HFM ─────────────────────────────────────────────────────────

function seedHfmModules(): TrainingModule[] {
  const now = nowISO()
  return [
    {
      id: nanoid(),
      brand: 'hfm',
      title: 'Introduction to Holistic Health',
      slug: 'intro-to-holistic-health',
      description: 'Explore the foundational principles of holistic health, understanding the whole person: body, mind, and spirit. Learn how conventional and integrative approaches can work together for lasting wellness.',
      category: 'Holistic Foundations',
      instructor_name: 'HFM Wellness Team',
      instructor_bio: 'Our team of holistic health practitioners brings decades of combined experience in functional and integrative medicine.',
      status: 'published',
      is_free: true,
      lessons: [
        {
          id: nanoid(),
          title: 'What Is Holistic Health?',
          type: 'text',
          content_html: `<h2>What Is Holistic Health?</h2>
<p>Holistic health is an approach to wellness that considers the whole person, body, mind, emotions, and spirit, in the pursuit of optimal health and well-being. Rather than focusing solely on the absence of disease, holistic health seeks to achieve the highest possible level of functioning and a sense of balance in all areas of life.</p>
<h3>The Core Principles</h3>
<ul>
  <li><strong>Whole-person care:</strong> Every aspect of a person's life, physical, mental, emotional, social, and spiritual, is interconnected and influences overall health.</li>
  <li><strong>Root cause focus:</strong> Holistic practitioners seek to identify and address the underlying causes of illness rather than simply treating symptoms.</li>
  <li><strong>Prevention first:</strong> Education, lifestyle changes, and preventive care are prioritized over reactive treatment.</li>
  <li><strong>Individualized approach:</strong> Each person is unique, and treatment plans are tailored to individual needs, values, and circumstances.</li>
</ul>
<h3>Holistic vs. Conventional Medicine</h3>
<p>Conventional medicine excels in acute care, diagnostics, and emergency treatment. Holistic health complements these strengths by addressing lifestyle, nutrition, stress management, and the emotional underpinnings of physical health. The most effective approach often integrates both.</p>`,
          duration_minutes: 10,
          order: 0,
          is_preview: true,
        },
        {
          id: nanoid(),
          title: 'The Five Pillars of Wellness',
          type: 'text',
          content_html: `<h2>The Five Pillars of Wellness</h2>
<p>Sustainable health rests on five interconnected pillars. Understanding each one helps you identify where to focus your attention for maximum impact.</p>
<h3>1. Nutrition</h3>
<p>Food is information for your cells. A nutrient-dense, whole-foods diet provides the building blocks for hormones, neurotransmitters, and immune function. Functional nutrition goes beyond calories to examine how specific foods affect inflammation, gut health, and gene expression.</p>
<h3>2. Movement</h3>
<p>Regular physical activity supports cardiovascular health, muscle mass, metabolic function, mood regulation, and cognitive performance. Both aerobic exercise and resistance training play important roles.</p>
<h3>3. Sleep & Recovery</h3>
<p>Deep, restorative sleep is when the body repairs tissues, consolidates memories, and regulates hormones. Chronic sleep deprivation is linked to virtually every major chronic disease.</p>
<h3>4. Stress Management</h3>
<p>Chronic stress elevates cortisol, suppresses immune function, disrupts digestion, and accelerates aging. Practices such as meditation, breathwork, yoga, and time in nature help regulate the nervous system.</p>
<h3>5. Connection & Purpose</h3>
<p>Social bonds, meaningful relationships, and a sense of purpose are among the strongest predictors of longevity and quality of life. Isolation and purposelessness are genuine health risks.</p>`,
          duration_minutes: 12,
          order: 1,
          is_preview: true,
        },
        {
          id: nanoid(),
          title: 'Starting Your Holistic Health Journey',
          type: 'text',
          content_html: `<h2>Starting Your Holistic Health Journey</h2>
<p>Every journey toward wholeness begins with awareness. Here are practical first steps to begin integrating holistic principles into your daily life.</p>
<h3>Step 1: Assess Your Current State</h3>
<p>Take stock of each of the five pillars. Where do you feel vibrant and energized? Where do you feel depleted or stuck? Honest self-assessment is the foundation of meaningful change.</p>
<h3>Step 2: Choose One Keystone Habit</h3>
<p>Rather than overhauling everything at once, identify one "keystone habit", a single change that tends to cascade positively into other areas. Common examples include improving sleep consistency, adding a 20-minute daily walk, or eliminating processed sugar.</p>
<h3>Step 3: Build Your Support System</h3>
<p>Share your intentions with people who support your growth. Consider working with a holistic health practitioner who can provide personalized guidance, run functional lab tests, and help you interpret your body's signals.</p>
<h3>Step 4: Track and Celebrate Progress</h3>
<p>Keep a simple journal of how you feel, energy levels, mood, digestion, sleep quality. Small wins matter. Progress, not perfection, is the goal.</p>
<blockquote><em>"The natural healing force within each one of us is the greatest force in getting well.", Hippocrates</em></blockquote>`,
          duration_minutes: 8,
          order: 2,
          is_preview: false,
        },
      ],
      tags: ['holistic', 'foundations', 'wellness', 'beginner'],
      total_duration_minutes: 30,
      enrolled_count: 0,
      share_token: generateShareToken(),
      created_at: now,
      updated_at: now,
    },
    {
      id: nanoid(),
      brand: 'hfm',
      title: 'Mind-Body Connection',
      slug: 'mind-body-connection',
      description: 'Discover the profound scientific evidence behind the mind-body connection and learn practical techniques to harness it for healing, resilience, and optimal performance.',
      category: 'Mind-Body Connection',
      instructor_name: 'HFM Wellness Team',
      instructor_bio: 'Our team of holistic health practitioners brings decades of combined experience in functional and integrative medicine.',
      status: 'published',
      is_free: true,
      lessons: [
        {
          id: nanoid(),
          title: 'The Science of Mind-Body Medicine',
          type: 'text',
          content_html: `<h2>The Science of Mind-Body Medicine</h2>
<p>For centuries, the connection between thoughts, emotions, and physical health was considered philosophical. Today, the field of psychoneuroimmunology (PNI) has mapped the biochemical pathways through which the mind influences every cell in the body.</p>
<h3>How Thoughts Become Biology</h3>
<p>When you experience stress, fear, or anxiety, your hypothalamus triggers a cascade of hormonal and neurological signals. Cortisol and adrenaline flood the bloodstream, heart rate increases, digestion slows, and immune function is suppressed. This "fight-or-flight" response was designed for short-term survival, not the chronic activation many people experience today.</p>
<p>Conversely, positive emotions, gratitude, love, and laughter trigger the release of oxytocin, serotonin, and endorphins, molecules that lower inflammation, enhance immune function, and promote tissue repair.</p>
<h3>The Gut-Brain Axis</h3>
<p>Your gut contains approximately 100 million neurons, more than your spinal cord. The vagus nerve creates a bidirectional highway between your gut and brain. This is why anxiety causes stomach upset, and why poor gut health contributes to depression and cognitive dysfunction.</p>
<h3>Neuroplasticity: Rewiring the Brain</h3>
<p>The brain is not fixed, it continuously rewires itself based on experience and thought patterns. Practices like mindfulness meditation, cognitive reframing, and visualization literally change the structure and function of the brain, shifting it from stress reactivity to calm responsiveness.</p>`,
          duration_minutes: 15,
          order: 0,
          is_preview: true,
        },
        {
          id: nanoid(),
          title: 'Practical Mind-Body Techniques',
          type: 'text',
          content_html: `<h2>Practical Mind-Body Techniques</h2>
<p>Understanding the mind-body connection is only valuable when paired with practical tools for daily life. Here are evidence-based techniques you can begin using today.</p>
<h3>1. Diaphragmatic Breathing (Box Breathing)</h3>
<p>Deep belly breathing activates the parasympathetic nervous system, counteracting the stress response within seconds. Try box breathing: inhale for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat for 5 minutes.</p>
<h3>2. Body Scan Meditation</h3>
<p>Systematically bringing awareness to each part of the body, without judgment, releases stored tension and increases interoceptive awareness (the ability to sense internal body states). This practice is clinically shown to reduce chronic pain and anxiety.</p>
<h3>3. Journaling for Emotional Processing</h3>
<p>Expressive writing about stressful experiences has been shown in multiple studies to improve immune function, reduce symptoms of trauma, and lower blood pressure. Write for 15-20 minutes about your thoughts and feelings, not just the facts of an event.</p>
<h3>4. Visualization & Imagery</h3>
<p>The brain responds to vividly imagined experiences similarly to real ones. Guided imagery has been used to accelerate wound healing, reduce chemotherapy side effects, improve athletic performance, and manage pain. Spend 10 minutes each morning visualizing your ideal state of health.</p>
<h3>5. Heart Rate Variability (HRV) Training</h3>
<p>HRV, the variation in time between heartbeats, is one of the best indicators of nervous system health. Biofeedback tools and apps can help you train your HRV toward coherence states associated with enhanced cognitive function and emotional resilience.</p>`,
          duration_minutes: 18,
          order: 1,
          is_preview: false,
        },
      ],
      tags: ['mind-body', 'neuroscience', 'stress', 'meditation'],
      total_duration_minutes: 33,
      enrolled_count: 0,
      share_token: generateShareToken(),
      created_at: now,
      updated_at: now,
    },
    {
      id: nanoid(),
      brand: 'hfm',
      title: 'Understanding Energy Medicine',
      slug: 'understanding-energy-medicine',
      description: 'Explore the science and practice of energy medicine, from bioelectromagnetic fields and acupuncture meridians to quantum biology and the human biofield. Learn how these principles inform cutting-edge holistic care.',
      category: 'Energy Medicine',
      instructor_name: 'HFM Wellness Team',
      instructor_bio: 'Our team of holistic health practitioners brings decades of combined experience in functional and integrative medicine.',
      status: 'published',
      is_free: true,
      lessons: [
        {
          id: nanoid(),
          title: 'What Is Energy Medicine?',
          type: 'text',
          content_html: `<h2>What Is Energy Medicine?</h2>
<p>Energy medicine is a broad term for healing practices that work with the body's biofield, the electromagnetic and subtle energy fields produced by living organisms. While some aspects remain on the frontier of science, many are now measurable with modern instruments.</p>
<h3>The Biofield</h3>
<p>Every cell in your body generates a tiny electrical current. The collective electromagnetic activity of billions of cells creates a measurable field that extends beyond the body's physical boundaries. This biofield interacts with the fields of other people, environments, and even the Earth's geomagnetic field.</p>
<p>The heart produces the body's strongest electromagnetic field, measurable 3-4 feet from the body using sensitive magnetometers (MEG). The brain's field, produced by neural activity, is about 50 times weaker but equally real.</p>
<h3>Traditional Energy Systems</h3>
<p>Virtually every traditional medicine system incorporates a concept of life-force energy:</p>
<ul>
  <li><strong>Qi (Traditional Chinese Medicine):</strong> The vital force that flows through meridian channels, governing all bodily functions.</li>
  <li><strong>Prana (Ayurveda):</strong> Life energy drawn in through breath and food, distributed through energy channels called nadis.</li>
  <li><strong>Mana (Hawaiian healing traditions):</strong> Spiritual power and healing force.</li>
  <li><strong>Vital Force (Homeopathy):</strong> The intelligent organizing principle that maintains health and drives self-healing.</li>
</ul>
<h3>Modern Research</h3>
<p>Researchers at leading institutions have documented measurable changes in biofield emissions associated with healing states, meditation, and disease. Acupuncture points show distinct electrical conductance properties. Bioelectromagnetic medicine is being studied for wound healing, bone regeneration, and cancer treatment.</p>`,
          duration_minutes: 14,
          order: 0,
          is_preview: true,
        },
        {
          id: nanoid(),
          title: 'Energy Medicine Modalities in Practice',
          type: 'text',
          content_html: `<h2>Energy Medicine Modalities in Practice</h2>
<p>Energy medicine encompasses a wide range of therapeutic modalities. Here we survey the most clinically studied and practically accessible approaches.</p>
<h3>Acupuncture & Acupressure</h3>
<p>Stimulating specific points along meridian pathways has demonstrated efficacy for pain management, nausea, anxiety, insomnia, and fertility support. Modern research suggests mechanisms include endorphin release, modulation of the autonomic nervous system, and changes in connective tissue tension.</p>
<h3>Therapeutic Touch & Healing Touch</h3>
<p>Practitioners use their hands, in contact or slightly off the body, to assess and rebalance the biofield. Multiple systematic reviews support its effectiveness for pain reduction, anxiety, and fatigue in clinical settings. These modalities are now offered in many hospitals and cancer centers.</p>
<h3>PEMF Therapy (Pulsed Electromagnetic Field)</h3>
<p>FDA-cleared PEMF devices deliver specific electromagnetic frequencies to stimulate cellular repair. Applications include bone fracture healing, depression treatment (via transcranial magnetic stimulation), and anti-inflammatory effects. This represents the most direct bridge between energy medicine and conventional medical technology.</p>
<h3>Sound Healing & Vibrational Medicine</h3>
<p>Sound waves create mechanical vibrations that travel through the body's water-rich tissues. Specific frequencies, whether from singing bowls, tuning forks, or engineered sound therapy, have been shown to induce relaxation responses, reduce cortisol, and entrain brainwave patterns toward healing states.</p>
<h3>Homeopathy & Flower Essences</h3>
<p>These highly diluted preparations are theorized to carry informational imprints that interact with the body's regulatory systems. While the mechanism remains controversial scientifically, many practitioners and patients report significant therapeutic effects, particularly for chronic, complex conditions.</p>
<h3>Integrating Energy Medicine</h3>
<p>The most effective approach integrates energy medicine within a comprehensive holistic framework, alongside nutritional support, lifestyle optimization, and mind-body practices. Energy medicine is not a replacement for conventional care in acute or emergency situations, but it can be a powerful complement for chronic conditions, prevention, and enhanced well-being.</p>`,
          duration_minutes: 20,
          order: 1,
          is_preview: false,
        },
      ],
      tags: ['energy medicine', 'biofield', 'acupuncture', 'PEMF', 'metaphysical'],
      total_duration_minutes: 34,
      enrolled_count: 0,
      share_token: generateShareToken(),
      created_at: now,
      updated_at: now,
    },
  ]
}

// ── Module CRUD ────────────────────────────────────────────────────────────────

function readModules(brand: string): TrainingModule[] {
  const data = readJson<TrainingModule[]>(modulesFile(brand), [])
  if (brand === 'hfm' && data.length === 0) {
    const seeded = seedHfmModules()
    writeJson(modulesFile(brand), seeded)
    return seeded
  }
  return data
}

function writeModules(brand: string, modules: TrainingModule[]) {
  writeJson(modulesFile(brand), modules)
}

export function listModules(brand: string, opts: { status?: string; category?: string } = {}): TrainingModule[] {
  let modules = readModules(brand)
  if (opts.status) modules = modules.filter(m => m.status === opts.status)
  if (opts.category) modules = modules.filter(m => m.category === opts.category)
  return modules
}

export function getModule(brand: string, id: string): TrainingModule | null {
  return readModules(brand).find(m => m.id === id) ?? null
}

export function getModuleBySlug(brand: string, slug: string): TrainingModule | null {
  return readModules(brand).find(m => m.slug === slug) ?? null
}

export function getModuleByToken(token: string): TrainingModule | null {
  // Search all brand files
  const dirs = existsSync(DATA_DIR) ? (() => {
    return readdirSync(DATA_DIR)
  })() as string[] : []
  for (const file of dirs) {
    if (!file.startsWith('training-modules-') || !file.endsWith('.json')) continue
    try {
      const modules = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as TrainingModule[]
      const found = modules.find(m => m.share_token === token)
      if (found) return found
    } catch { /* skip */ }
  }
  return null
}

export function createModule(brand: string, data: Partial<TrainingModule>): TrainingModule {
  const now = nowISO()
  const module: TrainingModule = {
    id: nanoid(),
    brand,
    title: data.title ?? 'Untitled Module',
    slug: data.slug ?? slugify(data.title ?? 'untitled'),
    description: data.description ?? '',
    category: data.category ?? 'Holistic Foundations',
    thumbnail_url: data.thumbnail_url,
    instructor_name: data.instructor_name,
    instructor_bio: data.instructor_bio,
    status: 'draft',
    is_free: data.is_free ?? true,
    price_cents: data.price_cents,
    lessons: [],
    tags: data.tags ?? [],
    total_duration_minutes: 0,
    enrolled_count: 0,
    share_token: generateShareToken(),
    created_at: now,
    updated_at: now,
  }
  const modules = readModules(brand)
  modules.push(module)
  writeModules(brand, modules)
  return module
}

export function updateModule(brand: string, id: string, data: Partial<TrainingModule>): TrainingModule | null {
  const modules = readModules(brand)
  const idx = modules.findIndex(m => m.id === id)
  if (idx === -1) return null
  const updated = { ...modules[idx], ...data, id, brand, updated_at: nowISO() }
  modules[idx] = updated
  writeModules(brand, modules)
  return updated
}

export function deleteModule(brand: string, id: string): boolean {
  const modules = readModules(brand)
  const len = modules.length
  const filtered = modules.filter(m => m.id !== id)
  if (filtered.length === len) return false
  writeModules(brand, filtered)
  return true
}

export function publishModule(brand: string, id: string): TrainingModule | null {
  return updateModule(brand, id, { status: 'published' })
}

export function archiveModule(brand: string, id: string): TrainingModule | null {
  return updateModule(brand, id, { status: 'archived' })
}

// ── Lessons ────────────────────────────────────────────────────────────────────

export function addLesson(brand: string, moduleId: string, lesson: Partial<Lesson>): TrainingModule | null {
  const modules = readModules(brand)
  const idx = modules.findIndex(m => m.id === moduleId)
  if (idx === -1) return null
  const newLesson: Lesson = {
    id: nanoid(),
    title: lesson.title ?? 'Untitled Lesson',
    type: lesson.type ?? 'text',
    content_html: lesson.content_html,
    video_url: lesson.video_url,
    audio_url: lesson.audio_url,
    pdf_url: lesson.pdf_url,
    duration_minutes: lesson.duration_minutes,
    quiz_questions: lesson.quiz_questions,
    order: modules[idx].lessons.length,
    is_preview: lesson.is_preview ?? false,
  }
  modules[idx].lessons.push(newLesson)
  modules[idx].total_duration_minutes = computeDuration(modules[idx].lessons)
  modules[idx].updated_at = nowISO()
  writeModules(brand, modules)
  return modules[idx]
}

export function updateLesson(brand: string, moduleId: string, lessonId: string, data: Partial<Lesson>): TrainingModule | null {
  const modules = readModules(brand)
  const mIdx = modules.findIndex(m => m.id === moduleId)
  if (mIdx === -1) return null
  const lIdx = modules[mIdx].lessons.findIndex(l => l.id === lessonId)
  if (lIdx === -1) return null
  modules[mIdx].lessons[lIdx] = { ...modules[mIdx].lessons[lIdx], ...data, id: lessonId }
  modules[mIdx].total_duration_minutes = computeDuration(modules[mIdx].lessons)
  modules[mIdx].updated_at = nowISO()
  writeModules(brand, modules)
  return modules[mIdx]
}

export function removeLesson(brand: string, moduleId: string, lessonId: string): TrainingModule | null {
  const modules = readModules(brand)
  const mIdx = modules.findIndex(m => m.id === moduleId)
  if (mIdx === -1) return null
  modules[mIdx].lessons = modules[mIdx].lessons.filter(l => l.id !== lessonId)
  modules[mIdx].total_duration_minutes = computeDuration(modules[mIdx].lessons)
  modules[mIdx].updated_at = nowISO()
  writeModules(brand, modules)
  return modules[mIdx]
}

export function reorderLessons(brand: string, moduleId: string, orderedIds: string[]): TrainingModule | null {
  const modules = readModules(brand)
  const mIdx = modules.findIndex(m => m.id === moduleId)
  if (mIdx === -1) return null
  const lessonMap = new Map(modules[mIdx].lessons.map(l => [l.id, l]))
  modules[mIdx].lessons = orderedIds
    .map((id, order) => {
      const l = lessonMap.get(id)
      return l ? { ...l, order } : null
    })
    .filter((l): l is Lesson => l !== null)
  modules[mIdx].updated_at = nowISO()
  writeModules(brand, modules)
  return modules[mIdx]
}

// ── Enrollments ────────────────────────────────────────────────────────────────

function readEnrollments(brand: string): Enrollment[] {
  return readJson<Enrollment[]>(enrollmentsFile(brand), [])
}

function writeEnrollments(brand: string, enrollments: Enrollment[]) {
  writeJson(enrollmentsFile(brand), enrollments)
}

export function listEnrollments(brand: string, opts: { module_id?: string; contact_id?: string } = {}): Enrollment[] {
  let enrollments = readEnrollments(brand)
  if (opts.module_id) enrollments = enrollments.filter(e => e.module_id === opts.module_id)
  if (opts.contact_id) enrollments = enrollments.filter(e => e.contact_id === opts.contact_id)
  return enrollments
}

export function enroll(brand: string, moduleId: string, data: {
  contact_name: string
  contact_email?: string
  contact_id?: string
}): Enrollment {
  const now = nowISO()
  const enrollment: Enrollment = {
    id: nanoid(),
    brand,
    module_id: moduleId,
    contact_id: data.contact_id,
    contact_name: data.contact_name,
    contact_email: data.contact_email,
    progress: 0,
    completed_lessons: [],
    started_at: now,
    last_accessed_at: now,
  }
  const enrollments = readEnrollments(brand)
  enrollments.push(enrollment)
  writeEnrollments(brand, enrollments)

  // Increment enrolled_count on module
  const modules = readModules(brand)
  const mIdx = modules.findIndex(m => m.id === moduleId)
  if (mIdx !== -1) {
    modules[mIdx].enrolled_count++
    writeModules(brand, modules)
  }

  return enrollment
}

export function updateProgress(brand: string, enrollmentId: string, completedLessonIds: string[]): Enrollment | null {
  const enrollments = readEnrollments(brand)
  const idx = enrollments.findIndex(e => e.id === enrollmentId)
  if (idx === -1) return null

  const enrollment = enrollments[idx]
  enrollment.completed_lessons = completedLessonIds
  enrollment.last_accessed_at = nowISO()

  // Calculate progress based on module lessons
  const module = getModule(brand, enrollment.module_id)
  if (module && module.lessons.length > 0) {
    enrollment.progress = Math.round((completedLessonIds.length / module.lessons.length) * 100)
    if (enrollment.progress >= 100 && !enrollment.completed_at) {
      enrollment.completed_at = nowISO()
    }
  }

  enrollments[idx] = enrollment
  writeEnrollments(brand, enrollments)
  return enrollment
}

export function getEnrollment(brand: string, moduleId: string, contactId: string): Enrollment | null {
  return readEnrollments(brand).find(e => e.module_id === moduleId && e.contact_id === contactId) ?? null
}

// ── Utilities ──────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
