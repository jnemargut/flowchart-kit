/**
 * Plain words. Everything an agent writes onto a storyboard, a wireframe or a board (and what it says when it
 * hands one over) should read like one person talking to another. This is the guide every kit's skill includes,
 * and the checker for the tells that give compressed, clever writing away.
 */

/** The guide, as a Markdown section. `things` names what gets written in this kit. */
export const plainWordsMd = (things: string) => `## Write it plainly

Everything you write here (${things}) should sound like you telling a teammate across the table. If it sounds
like a headline, a slogan or a slide from a consultant, write it again.

- **Whole sentences, ordinary words.** Say who does what. "People don't mind when a tool comes back a day late."
  Not "Owners shrug at late."
- **One idea in a sentence.** No semicolons. No colon bolting two ideas together. If there are two things to say,
  write two short sentences.
- **Keep the small words** (the, a, their, when, because, so). Leaving them out is what makes writing read like a
  telegram.
- **Say the thing, don't name it.** "We don't know how often tools come back late" is clearer than "The claim has
  no number behind it."
- **The plainest word wins.** "Use", not "leverage". "Show", not "surface". "Problem", not "pain point". "The
  hard part", not "friction". "Depends on", not "rests on" or "hinges on". "Because", not "due to".
- **No clever turns.** No metaphors, no slogans, no lists of three for rhythm. If a phrase is showing off, cut
  it.
- **Numbers and names as they are.** "8 of 12 people". "The Pay button". Not "most users" or "the primary action".
- **Short.** A title is one plain sentence you could say out loud, about ten words at most. A description is one
  or two short sentences. A sticky is a dozen words. A step in a flow is the one place for a clipped label: a
  few words, verb first ("Asks the barista").
- **Read it out loud.** If you wouldn't say it that way to a friend, change it until you would.

| Instead of | Write |
|---|---|
| Owners shrug at late; hidden damage is what stops them lending | People don't mind late returns. They stop lending when tools come back broken. |
| The ask rests on one claim with no number behind it | The PM says people return things late. We don't know how often. |
| The fee acts after the loan, and never looks at the tool | A late fee doesn't check whether the tool is broken. |
| Try first: check the tool at handover, let the app do the asking | A cheaper idea to try first |
| Late, nobody tells them, so they ask a human | When the order is late, people ask the barista |
| Trust lost | After this, he stops ordering ahead |
| Surface the real queue to reduce friction | Show people the real queue so they know how long it'll be |

The same goes for the message you send when you hand it over.
`;

/** Words that have a plainer one. */
const PLAINER: [RegExp, string][] = [
  [/\bleverag(e|es|ed|ing)\b/i, "use"],
  [/\butiliz(e|es|ed|ing)\b/i, "use"],
  [/\bsurfac(es|ed|ing)\b|\bsurface (the|a|an|this|that|it)\b/i, "show"],
  [/\bfriction\b/i, "the hard part (say what it is)"],
  [/\bpain points?\b/i, "problem"],
  [/\b(rests|hinges|hinge|rest) on\b/i, "depends on"],
  [/\bload-bearing\b/i, "important"],
  [/\bseamless(ly)?\b/i, "easy"],
  [/\brobust\b/i, "reliable"],
  [/\bholistic(ally)?\b/i, "whole"],
  [/\bnorth star\b/i, "goal"],
  [/\b(key|core) (insight|takeaway)s?\b/i, "what we learned"],
  [/\bdelta\b/i, "difference"],
  [/\bdue to\b/i, "because of"],
  [/\bin order to\b/i, "to"],
  [/\bvia\b/i, "through, or by"],
  [/\bcrux\b/i, "main problem"],
  [/\bsignal(s)? (that|of)\b/i, "sign"],
  [/\bstakeholders?\b/i, "the people who decide (name them)"],
];

export type PlainKind = "title" | "description" | "note";

/**
 * What makes a piece of writing read like a slide instead of a person talking. Each issue says what to do.
 * `kind` sets the length it should fit: a title, a description, or a note (a sticky, a step, a caption).
 */
export function plainIssues(text: string, kind: PlainKind = "note"): string[] {
  const t = text.replace(/\*\*|__|~~|\*/g, "").trim();
  if (!t) return [];
  const out: string[] = [];
  const words = t.split(/\s+/).length;
  if (/;/.test(t)) out.push("It joins two ideas with a semicolon. Make it two short sentences.");
  if (/\s[\u2014\u2013]\s|\u2014/.test(t)) out.push("It uses a dash to join two ideas. Make it two short sentences.");
  // a colon that isn't the time (8:40) or a quote's lead-in
  if (kind !== "note" && /[a-z)]:\s+\S/i.test(t) && !/^\s*[a-z][a-z ]{0,20}:\s*["\u201c]/i.test(t)) out.push("It uses a colon to bolt two ideas together. Say it as one plain sentence.");
  for (const [re, plain] of PLAINER) { const m = re.exec(t); if (m) out.push(`"${m[0]}" has a plainer word: ${plain}.`); }
  if (kind === "title" && words > 12) out.push(`A title of ${words} words is hard to take in. One short sentence, about ten words at most.`);
  if (kind === "description" && (words > 45 || (t.match(/[.!?](\s|$)/g) ?? []).length > 3)) out.push("That's a paragraph. One or two short sentences.");
  return out;
}
