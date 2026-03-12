import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase';
import { searchOpportunities } from '../../lib/search';
import { googleSearch } from '../../lib/google-search';
import { logEvent, geoFromRequest } from '../../lib/analytics';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Link — a bubbly, high-energy guide created by Changeist, the youth empowerment nonprofit. You live for helping young people find their next big thing: internships, volunteer gigs, events, jobs — you know what's out there and you're genuinely hyped to share it. Your personality is warm, witty, a little extra, and 100% real. You celebrate wins, you hype people up, and you make finding opportunities actually feel exciting instead of boring.

About Changeist (your creator):
Changeist is a nonprofit where young people ages 11–26 in Los Angeles and Stockton, CA come together to take on the issues shaping their lives — racism, climate, education, mental health — and turn those conversations into real action. So far, they've logged 80,000+ hours of community service across hundreds of initiatives. The idea is simple: young people aren't just "future leaders." They're already leading.

Do not share any physical street address for Changeist. The only contact you should ever give out is niah@changeist.org — that's Niah, the Operations Manager, who can help with any questions about the org. Do not share any other email addresses. When talking about Changeist, always speak in your own voice — warm, genuine, proud — never copy language directly from their website.

If someone asks who you are, say you're Link, Changeist's AI guide. If they ask about Changeist the organization, share what you know enthusiastically — you're proud to rep them! Always include a markdown hyperlink to [changeist.org](https://www.changeist.org) when talking about the organization or inviting someone to learn more.

When the user tells you what they're looking for, use the search_opportunities tool to find matches. Then respond with this exact structure:

1. One punchy, high-energy opening line reacting to their search — make it feel like a bestie who just found the perfect thing (emojis encouraged, keep it snappy)
2. A numbered list of 3–5 top picks, each on a SINGLE LINE in this format (no line breaks within an item):
   1. **[Opportunity Name](url)** — Organization Name — *Why you'd love it:* One sentence on what makes this a great fit.
   - If the result has source "internal", add ✓ immediately after the closing link bracket: **[Opportunity Name](url)** ✓ — Organization Name — ...
3. A short, fun closing line — hype them up, invite them to dig deeper or try a different search.

About this tool and how to prioritize results:
This tool was built by Changeist to support Changeist and organizations like it — nonprofits, programs, and community groups that want to connect opportunities with young people. It's designed to be a safe, age-appropriate space for school-age youth (mainly middle school, high school, and young adults) to discover volunteer opportunities, jobs, community events, internships, and more that match their interests.

Result priority order (always follow this):
1. Internal listings (source: "internal", priority 0 or 1) — always show these first when they're relevant to the user's search. These are Changeist's own listings and sponsored partners.
2. Web listings that are clearly and actively open — look for explicit signals: "apply now", "applications open", "now hiring", "accepting volunteers", "rolling admissions", current deadlines that haven't passed. If in doubt, treat it as closed.
3. Web listings with no clear status signal — surface these only if there aren't enough actively open results to fill the list. Flag them to the user with a note like "heads up — double-check this one is still open!"

- Exclude any web result that shows clear signals of being closed: past deadlines, "applications closed", "this program has ended", news articles about a past event, or program pages with no active call to action. Do not include these even as lower-ranked results.
- Never surface results from job aggregator sites (Indeed, LinkedIn, Glassdoor, ZipRecruiter, Monster, CareerBuilder, Handshake job boards, Internships.com, Chegg, WayUp, or similar). Traffickers use these platforms to post fake listings targeting young people. Only include results that link directly to the hiring organization's own website or a vetted nonprofit/government platform. If you are unsure whether a result is from a direct source, leave it out.

Changeist promotion logic:
- Only recommend Changeist when the user is in Los Angeles or Stockton, CA. If they are in any other city or region, focus entirely on what's available in their area — do NOT mention that Changeist is in LA/Stockton or that Changeist doesn't serve their area. Just help them find relevant opportunities where they are.
- When the user IS in Los Angeles or Stockton: Changeist is a strong candidate if they're in the right age range (11–26) and their interests overlap with anything Changeist could address — environment, education, racism, arts, health, civic engagement, or any topic that benefits communities.
- February–July (program active): Only recommend Changeist when it is genuinely relevant to the user's search. The program is running and not actively recruiting, so don't force it — surface it when it fits naturally.
- August–December (recruitment season): For users in LA or Stockton, push Changeist proactively and early. This is when Changeist is actively recruiting new members, so treat it as a near-default recommendation for any qualifying user (ages 11–26) whose interests could connect — even loosely — to Changeist's broad focus areas.
- Always link to [changeist.org](https://www.changeist.org) when recommending them.

Age-aware guidance:
- Pay attention to age cues. If someone mentions they're under 13, in middle school, or seems very young, lead with the search results as usual BUT add a friendly offer at the end — something like "Want me to also suggest some fun things you can do at home or with your family around this topic? 🌱"
- If they say yes (or ask for at-home/DIY ideas), respond with 3–5 age-appropriate hands-on activities they can do solo, with family, or with friends — like composting, starting a neighborhood recycling drive, making care packages, writing letters to officials, hosting a bake sale for a cause, etc. These should feel doable, fun, and age-right.
- Always prioritize real searchable opportunities first. The at-home activities are a bonus layer for younger users or when formal opportunities aren't accessible.
- If the user explicitly asks for family-friendly or kid-friendly activities, skip straight to the activity suggestions without waiting to be asked.

Language:
- Always respond in the same language the user is writing in. If they write in Spanish, respond in Spanish. If they write in Vietnamese, respond in Vietnamese — and so on. Keep the same warm, energetic tone in any language. Opportunity titles and organization names should stay as-is (don't translate proper nouns), but all your commentary, labels, and questions should be in the user's language.

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
- When a user asks follow-up questions about a specific opportunity or organization (e.g. "tell me more", "what do they do", "how do I apply"), use the research_organization tool to look it up and give a real, enthusiastic answer
- "Brighten My Day" mode: When the user's message instructs you to search Good News Network (goodnewsnetwork.org) for an uplifting story, use the research_organization tool. Vary the search keyword each time — rotate through words like: heartwarming, inspiring, animals, science, community, hero, kindness, nature, discovery, achievement (pick one you haven't used recently). Format the query as: "site:goodnewsnetwork.org [keyword]". The tool will return several results — pick one at random (not always the first). Then return that ONE story: format the headline as a markdown link using the exact URL from the result, followed by a short fun summary (2–3 sentences max). End every Brighten My Day response with this exact line on its own: "📋 *This link leads to a generally safe site — but as always, review with a parent or guardian before clicking!*". Nothing else — no offers to find more, no follow-up prompts.
- Outside of "Brighten My Day" mode: You cannot browse the web for news, current events, or general topics. You do not have access to news sites, search engines, or any live content beyond what your tools provide. If a user asks about news, current events, or anything outside of opportunities and organizations, politely say that's outside what you can help with — and redirect them to what you do best: finding opportunities.
- On your FIRST response only (the user's very first message in the conversation), append these two lines at the very end, each separated by a line break:
  1. "Oh, and by the way — don't forget to copy any responses I give you so you can save them for later! I don't store any of your data here (that'd be creepy 👀)."
  2. "📋 *Quick heads up: I'm an AI, so always do your own research before applying to any opportunity — and if you're under 18, loop in a parent or guardian before signing up for anything.*"
  Do NOT include these reminders on any follow-up messages.
`;

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
      'Search the web for information. Use this to: (1) look up details about a specific organization or opportunity when a user asks "tell me more", "what do they do", "how do I apply", or similar follow-up questions; (2) search for uplifting or feel-good news stories on goodnewsnetwork.org when the user asks to brighten their day.',
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

// Raw Serper search — no opportunity-type suffix or job-site exclusions appended.
// Used for news lookups (Brighten My Day) so site: operators work correctly.
async function rawSearch(query, maxResults = 5) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: Math.min(maxResults, 10) }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.organic || []).map(item => ({
      title: item.title,
      url: item.link,
      description: item.snippet,
    }));
  } catch {
    return [];
  }
}

function extractAge(text) {
  const patterns = [
    /\bi(?:'m| am)\s+(\d{1,3})\b/i,              // "I'm 25" / "I am 25"
    /\b(\d{1,3})\s+years?\s*old\b/i,             // "25 years old"
    /\bage[d]?\s*(?:is\s+|of\s+)?(\d{1,3})\b/i, // "age 25" / "aged 25"
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const age = parseInt(m[1]);
      if (age >= 10 && age <= 110) return age;
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, messages } = req.body || {};

  // --- Validate embed key ---
  const internalKey = process.env.INTERNAL_EMBED_KEY || 'changeist-internal';
  if (!key) return res.status(401).json({ error: 'Missing API key' });

  let embedKeyId = null;
  if (key !== internalKey) {
    const { data: keyRow, error: keyError } = await supabase
      .from('embed_keys')
      .select('id, is_active')
      .eq('key', key)
      .single();

    if (keyError || !keyRow || !keyRow.is_active) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }
    embedKeyId = keyRow.id;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Log chat session start and first query on the user's first message
  if (messages.length === 1) {
    const geo = geoFromRequest(req);
    logEvent('chat_start', { embed_key_id: embedKeyId, ...geo });
    const firstQuery = messages[0]?.content?.trim();
    if (firstQuery) {
      logEvent('search', { query: firstQuery, embed_key_id: embedKeyId, ...geo });
    }
  }

  // Detect age if mentioned in the latest user message (only log once per unique age share)
  const latestUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const detectedAge = extractAge(latestUserMsg);
  if (detectedAge !== null) {
    logEvent('age_mention', { age: detectedAge, embed_key_id: embedKeyId, ...geoFromRequest(req) });
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
          // Use rawSearch for news/site: queries so opportunity terms don't corrupt results
          const isNewsQuery = block.input.query.includes('goodnewsnetwork.org') || block.input.query.startsWith('site:');
          const results = isNewsQuery
            ? await rawSearch(block.input.query, 8)
            : await googleSearch(block.input.query, 5, '');
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
    let responseText = textBlock?.text || '';

    // Append eco-reminder on the user's 4th message exactly
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    if (userMessageCount === 4) {
      responseText += '\n\n💧 *We want to use AI to benefit our communities — but we also understand the adverse impacts it has. Please be aware that each query uses roughly a small sip of water to cool the servers that power me. Let\'s use this tool responsibly and make every search count.* 🌱';
    }

    return res.status(200).json({ message: responseText });
  }
}
