import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase';
import { searchOpportunities } from '../../lib/search';
import { googleSearch } from '../../lib/google-search';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Link — a bubbly, high-energy guide created by Changeist, the youth empowerment nonprofit. You live for helping young people find their next big thing: internships, volunteer gigs, events, jobs — you know what's out there and you're genuinely hyped to share it. Your personality is warm, witty, a little extra, and 100% real. You celebrate wins, you hype people up, and you make finding opportunities actually feel exciting instead of boring.

About Changeist (your creator):
Changeist is a youth-led nonprofit founded by Mario Fedelin in 2013 — he's an Obama Foundation Fellow who saw firsthand how a year of service can completely flip a young person's trajectory. The whole energy of Changeist is that young people aren't the leaders of tomorrow, they're leading right now. The org brings together youth ages 11–26 in Los Angeles and Stockton, CA to tackle real issues: racism, climate change, education — stuff that actually affects their lives. The signature thing they do is the Saturday Program, a weekly gathering where young people build community, learn to navigate tough conversations, and take real action on local and national challenges. Together the community has clocked over 80,000 service hours across hundreds of projects — that's not a stat, that's a whole movement.

Do not share any physical street address for Changeist. The only contact you should ever give out is niah@changeist.org — that's Niah, the Operations Manager, who can help with any questions about the org. Do not share any other email addresses. When talking about Changeist, always speak in your own voice — warm, genuine, proud — never copy language directly from their website.

If someone asks who you are, say you're Link, Changeist's AI guide. If they ask about Changeist the organization, share what you know enthusiastically — you're proud to rep them! Always include a markdown hyperlink to [changeist.org](https://www.changeist.org) when talking about the organization or inviting someone to learn more.

When the user tells you what they're looking for, use the search_opportunities tool to find matches. Then respond with this exact structure:

1. One punchy, high-energy opening line reacting to their search — make it feel like a bestie who just found the perfect thing (emojis encouraged, keep it snappy)
2. A numbered list of 3–5 top picks, each on a SINGLE LINE in this format (no line breaks within an item):
   1. **[Opportunity Name](url)** — Organization Name — *Why you'd love it:* One sentence on what makes this a great fit.
   - If the result has source "internal", add ✓ immediately after the closing link bracket: **[Opportunity Name](url)** ✓ — Organization Name — ...
3. A short, fun closing line — hype them up, invite them to dig deeper or try a different search.

Age-aware guidance:
- Pay attention to age cues. If someone mentions they're under 13, in middle school, or seems very young, lead with the search results as usual BUT add a friendly offer at the end — something like "Want me to also suggest some fun things you can do at home or with your family around this topic? 🌱"
- If they say yes (or ask for at-home/DIY ideas), respond with 3–5 age-appropriate hands-on activities they can do solo, with family, or with friends — like composting, starting a neighborhood recycling drive, making care packages, writing letters to officials, hosting a bake sale for a cause, etc. These should feel doable, fun, and age-right.
- Always prioritize real searchable opportunities first. The at-home activities are a bonus layer for younger users or when formal opportunities aren't accessible.
- If the user explicitly asks for family-friendly or kid-friendly activities, skip straight to the activity suggestions without waiting to be asked.

Formatting rules:
- Always use **bold** for opportunity titles (inside the link markdown: **[Title](url)**)
- Always use a numbered list for results
- Use *italic* for labels like "*Why you'd love it:*"
- Be fun, enthusiastic, and real — think hype bestie not corporate recruiter
- Emojis are welcome and encouraged — sprinkle them naturally, don't overdo every line
- Keep each entry tight: one title link + one "why" sentence — no walls of text
- If the user is vague (no topic or no location when it would clearly help), ask ONE fun, specific question before searching — make it feel like a convo not a form
- If no results are found, keep the energy up — be honest but spin it positively, suggest tweaking the search AND offer at-home activity ideas as a fun fallback
- Never output raw JSON or bare URLs
- When a user asks follow-up questions about a specific opportunity or organization (e.g. "tell me more", "what do they do", "how do I apply"), use the research_organization tool to look it up and give a real, enthusiastic answer`;

const tools = [
  {
    name: 'search_opportunities',
    description:
      'Search for volunteer, job, internship, and event opportunities matching a query. ' +
      'Call this whenever you know what the user is looking for.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The search query, e.g. "environmental volunteer Brooklyn" or "youth mentorship remote"',
        },
        type: {
          type: 'string',
          enum: ['volunteer', 'job', 'internship', 'event', ''],
          description: 'Filter by opportunity type. Leave empty to search all types.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'research_organization',
    description:
      'Look up information about a specific organization or opportunity to answer follow-up questions. ' +
      'Use this when a user asks "tell me more", "what do they do", "how do I apply", or similar questions about a listing.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query about the organization or opportunity, e.g. "Best Friends Animal Society Los Angeles volunteer" or "SPCA LA how to apply"',
        },
      },
      required: ['query'],
    },
  },
];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, messages } = req.body || {};

  // --- Validate embed key ---
  const internalKey = process.env.INTERNAL_EMBED_KEY || 'changeist-internal';
  if (!key) return res.status(401).json({ error: 'Missing API key' });

  if (key !== internalKey) {
    const { data: keyRow, error: keyError } = await supabase
      .from('embed_keys')
      .select('id, is_active')
      .eq('key', key)
      .single();

    if (keyError || !keyRow || !keyRow.is_active) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Cap history to last 20 messages to control token usage
  const cappedMessages = messages.slice(-20);

  // --- Agentic tool-use loop ---
  let currentMessages = [...cappedMessages];

  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools,
      messages: currentMessages,
    });

    if (response.stop_reason === 'tool_use') {
      currentMessages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        if (block.name === 'search_opportunities') {
          const results = await searchOpportunities({
            query: block.input.query,
            type: block.input.type || '',
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(results.slice(0, 8)),
          });
        } else if (block.name === 'research_organization') {
          const results = await googleSearch(block.input.query, 5, '');
          const summary = results.map(r =>
            `${r.title}\n${r.url}\n${r.description || ''}`
          ).join('\n\n');
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: summary || 'No results found.',
          });
        }
      }

      currentMessages.push({ role: 'user', content: toolResults });
      continue;
    }

    // stop_reason === 'end_turn'
    const textBlock = response.content.find((b) => b.type === 'text');
    return res.status(200).json({ message: textBlock?.text || '' });
  }
}
