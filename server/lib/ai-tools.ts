/**
 * OpenRouter-compatible tool definitions for the Hermes AI assistant.
 * These give the model the ability to execute real platform actions.
 */

export const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_contact',
      description: 'Create a new contact in the CRM',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name' },
          email: { type: 'string', description: 'Email address' },
          phone: { type: 'string', description: 'Phone number' },
          company: { type: 'string', description: 'Company name' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags to apply' },
          notes: { type: 'string', description: 'Initial notes' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_deal',
      description: 'Create a new deal in the pipeline',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Deal title' },
          contact_name: { type: 'string', description: 'Contact name this deal is for' },
          value_cents: { type: 'number', description: 'Deal value in cents (e.g. 150000 = $1500)' },
          stage: {
            type: 'string',
            enum: ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
            description: 'Pipeline stage',
          },
          notes: { type: 'string' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_contacts',
      description: 'Search/list contacts from the CRM',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search term (name, email, company)' },
          limit: { type: 'number', description: 'Max results to return (default 5)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_deals',
      description: 'List open deals from the pipeline',
      parameters: {
        type: 'object',
        properties: {
          stage: { type: 'string', description: 'Filter by stage (optional)' },
          limit: { type: 'number', description: 'Max results (default 5)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_appointments',
      description: 'List upcoming appointments',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results (default 5)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a task on a project',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          project_name: { type: 'string', description: 'Project name to add task to' },
          due_date: { type: 'string', description: 'Due date ISO string' },
          notes: { type: 'string' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_business_summary',
      description: 'Get a summary of current business stats: contacts, deals, invoices, appointments',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_post_performance',
      description:
        "Analyze the business's own published social posts to see which performed best and when. Returns top posts, totals, best platform, and best time/day to post. Use when the user asks 'which posts performed best?', 'what's our best posting time?', or about social engagement.",
      parameters: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            description: "Optional platform filter (e.g. 'facebook', 'instagram')",
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'research_ad_trends',
      description:
        'Research what competitors or a topic are running as ads via the Meta Ad Library. Use when the user asks "what are competitors running for {topic}?" or wants trend/competitive ad research.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Topic, keyword, or competitor/brand name to search the Ad Library for',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description:
        'Generate an image with AI and save it to the Media Studio gallery. Use when the user asks to create, generate, or make an image/graphic/visual.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed visual description of the image to generate' },
          aspect: {
            type: 'string',
            enum: ['1:1', '16:9', '9:16'],
            description: "Aspect ratio (default '1:1')",
          },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'post_to_social',
      description:
        "Publish a post to the business's connected social accounts (Facebook, Instagram, LinkedIn, TikTok). Optionally generate an image to attach. Returns per-platform success so you can report honestly which channels posted and which are not connected.",
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The post caption / body text' },
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['facebook', 'instagram', 'linkedin', 'tiktok'] },
            description: 'Which platforms to publish to. Defaults to all connected channels if omitted.',
          },
          image_prompt: {
            type: 'string',
            description: 'Optional. If given, an image is generated first and attached to the post.',
          },
          link: { type: 'string', description: 'Optional URL to include with the post' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_video',
      description:
        'Generate a short AI video (~8 seconds) and save it to the Media Studio gallery. Rendering takes a few minutes. Use when the user asks to create, generate, or make a video.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed visual description of the video to generate' },
          aspect: {
            type: 'string',
            enum: ['1:1', '16:9', '9:16'],
            description: "Aspect ratio (default '1:1')",
          },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deploy_agents',
      description:
        'Decompose a complex business goal into tasks and deploy them to the agent swarm. Use when the user asks to handle something that needs multiple steps across different areas (scheduling, outreach, bookkeeping, content, research, dispatching). Hermes will plan the tasks and assign each to the right specialist agent.',
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'The business goal to accomplish (e.g. "Follow up with all leads from this week and send overdue invoice reminders")',
          },
          context: {
            type: 'string',
            description: 'Additional context about the business situation',
          },
        },
        required: ['goal'],
      },
    },
  },
]
