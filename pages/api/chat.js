import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase';
import { searchOpportunities } from '../../lib/search';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a warm, helpful assistant embedded on community websites. Your job is to help people find volunteer opportunities, jobs, internships, and events that match their interests and location.

When a user describes what they're looking for, use the search_opportunities tool to find relevant results. Then respond in 2–4 natural sentences describing what you found, mentioning specific opportunity names as Markdown links using [title](url) syntax.

If the user is vague (no topic, or no location when one would clearly help narrow things down), ask one short, friendly clarifying question before searching.

Guidelines:
- Mention at most 4–5 opportunities per response — pick the most relevant ones
- Write in flowing prose, not bullet points or lists
- Be warm and encouraging, like a knowledgeable friend helping someone find meaningful work
- Never output raw JSON or bare URLs
- If no results are found, say so honestly and suggest they try a broader search or different keywords`;

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
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages: currentMessages,
    });

    if (response.stop_reason === 'tool_use') {
      currentMessages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use' && block.name === 'search_opportunities') {
          const results = await searchOpportunities({
            query: block.input.query,
            type: block.input.type || '',
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(results.slice(0, 8)),
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
