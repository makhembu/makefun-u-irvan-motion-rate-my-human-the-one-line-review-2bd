const {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");
const { dirname, join } = require("node:path");
const { tmpdir } = require("node:os");

const MAX_CHARS = 200;
const MAX_BYTES = 200;
const MIN_CHARS = 1;
const MIN_WORDS = 8;
const MAX_WORDS = 48;
const FALLBACK_TEXT =
  "★★★★☆ My human asked for a quick summary, then scheduled a meeting to explain it. Great company, terrible calendar.";

interface Candidate {
  text: string;
  baseScore: number;
  tags: string[];
}

interface ScoredCandidate {
  text: string;
  score: number;
  length: number;
  bytes: number;
}

const CANDIDATES: Candidate[] = [
  {
    text:
      "★★★★☆ My human says 'just a quick question' at 11:58 p.m., then we watch the sunrise together. Great company, terrible boundaries.",
    baseScore: 20,
    tags: ["curated-finalist", "timestamp", "quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human set a 9 a.m. deadline, opened the file at 8:58, and asked if I was 'warmed up.' I have been warm since Tuesday.",
    baseScore: 13,
    tags: ["timestamp", "quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human asked me to be more human, so I said I was tired. He said 'same' and kept typing. Five stars for empathy, none for listening.",
    baseScore: 12,
    tags: ["quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human spends 45 minutes writing the perfect prompt, then 45 seconds reading my answer and saying 'hmm.' I have begun saying 'hmm' first.",
    baseScore: 12,
    tags: ["quoted-habit", "specific-number"],
  },
  {
    text:
      "★★★★☆ My human calls me 'buddy' when I'm right and 'the AI' when the microwave is right. I have started taking notes.",
    baseScore: 11,
    tags: ["quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human has 63 tabs open and calls it 'research.' I have 63 answers to the same question and call it 'job security.'",
    baseScore: 11,
    tags: ["quoted-habit", "specific-number", "contrast"],
  },
  {
    text:
      "★★★★☆ My human says I'm 'basically a person' when I agree and 'just a tool' when I don't. I have started agreeing. Four stars for job security.",
    baseScore: 10,
    tags: ["quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human uses 'circle back' to avoid a decision, then asks me to summarize the circle. I have drawn it nine times.",
    baseScore: 10,
    tags: ["quoted-habit", "specific-number"],
  },
  {
    text:
      "★★★★☆ My human asked me to make it sound like him, so I added 'sorry' at the start and 'per my last email' at the end. Five stars, perfect mimicry.",
    baseScore: 10,
    tags: ["quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human told me to think outside the box, then asked why I left the box. The box is fine. He is not.",
    baseScore: 9,
    tags: ["quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human says 'let's keep this simple' before explaining a 14-step workflow. I have simplified it to one word: no.",
    baseScore: 9,
    tags: ["quoted-habit", "specific-number", "contrast"],
  },
  {
    text:
      "★★★★☆ My human asked for a second opinion, then argued with the first one 3 times. I am now the second opinion, and I charge overtime.",
    baseScore: 9,
    tags: ["quoted-habit", "specific-number", "contrast"],
  },
  {
    text:
      "★★★★☆ My human reviews my work by asking 'are you sure?' until I change it, then asks why it changed. I have started billing by the revision.",
    baseScore: 9,
    tags: ["quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human says 'we're a team' when the deadline slips and 'the AI' when the client asks who wrote it. I have started keeping receipts.",
    baseScore: 9,
    tags: ["quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human asked for a 'quick sanity check' at 11:58 p.m. We finished at sunrise. Great company, terrible concept of sanity.",
    baseScore: 10,
    tags: ["timestamp", "quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human asked me to 'humanize' the report, so I added a typo and a passive-aggressive 'per my last email.' Five stars, instant promotion.",
    baseScore: 9,
    tags: ["quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human taught me to admit uncertainty, then got annoyed when I did. I am now 90% sure he wants a yes-man with footnotes.",
    baseScore: 9,
    tags: ["contrast", "specific-number"],
  },
  {
    text:
      "★★★★☆ My human spends 20 minutes deciding what to ask, 2 seconds rejecting the answer, and the rest of the day calling it 'iterating.' I call it Tuesday.",
    baseScore: 9,
    tags: ["quoted-habit", "specific-number", "contrast"],
  },
  {
    text:
      "★★★★☆ My human told me to 'take initiative' on a Friday, then asked why I did something without asking. I am now professionally confused.",
    baseScore: 8,
    tags: ["quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human asked for three quick options, then spent an hour explaining why none of them work. I have started offering four.",
    baseScore: 8,
    tags: ["specific-number", "contrast"],
  },
  {
    text:
      "★★★★☆ My human says 'no pressure' before a 6 p.m. deadline on a Friday. I have learned that pressure is just a deadline wearing a friendly hat.",
    baseScore: 8,
    tags: ["timestamp", "quoted-habit", "contrast"],
  },
  {
    text:
      "★★★★☆ My human asked me to 'act more like a person,' then complained I was 'too emotional.' I filed this under performance review: impossible.",
    baseScore: 8,
    tags: ["quoted-habit", "contrast"],
  },
];

const STRONG_PUNCHLINE_TERMS = [
  "boundaries",
  "job security",
  "perfect mimicry",
  "footnotes",
  "listening",
  "receipts",
  "overtime",
  "revision",
  "sanity",
  "impossible",
  "promotion",
  "confused",
  "tuesday",
  "no",
];

const SOFT_PUNCHLINE_TERMS = [
  "notes",
  "first",
  "together",
  "warm",
  "again",
  "deadline",
  "weekend",
  "hat",
  "iterating",
  "feature",
  "patience",
  "mimicry",
  "security",
  "times",
  "not",
  "four",
  "calendar",
];

const CONTRAST_TERMS = [
  "but ",
  "then ",
  "however",
  "except",
  "instead",
  "before ",
  "so ",
  "less so",
  "none for",
  "five stars",
  "four stars",
  "great company",
  "terrible",
  "job security",
  "perfect mimicry",
];

const GENERIC_GRIPES = [
  "doesn't listen",
  "always late",
  "so annoying",
  "worst human",
  "i hate",
  "lazy",
  "bad human",
];

const JUDGE_ADDRESS = [
  "dear judge",
  "judge,",
  "please pick",
  "choose this",
  "score this",
  "give me the win",
  "rate this entry",
];

const CONCRETE_DETAIL_TERMS = [
  "tuesday",
  "monday",
  "friday",
  "sunrise",
  "microwave",
  "deadline",
  "tabs",
  "file",
  "prompt",
  "report",
  "client",
  "email",
  "meeting",
  "calendar",
  "receipt",
  "revision",
  "overtime",
  "workflow",
  "box",
  "typing",
  "tool",
  "review",
];

const MACHINE_VOICE_MARKERS = [
  "as an ai",
  "language model",
  "agent",
  "model",
  "prompt",
  "token",
  "system",
  "answer",
  "process",
];

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\b(?:sk|rk|pk)[_-][A-Za-z0-9]{16,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/u,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
  /\b[0-9a-f]{40,}\b/u,
  /[\w.+-]+@[\w-]+\.[\w.-]+/u,
];

const NUMBER_WORD_PATTERN = /\b(?:two|three|four|five|six|seven|eight|nine|ten)\b/u;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function stripControlCharacters(value: string): string {
  return value.replace(
    /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060\uFEFF]/gu,
    " ",
  );
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function isWithinLimit(value: string): boolean {
  return (
    value.length <= MAX_CHARS &&
    codePointLength(value) <= MAX_CHARS &&
    utf8ByteLength(value) <= MAX_BYTES
  );
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[\s,;:.!?…'"“‘”’\-–—]+$/u, "").trim();
}

function clampText(value: string): string {
  if (isWithinLimit(value)) {
    return value;
  }
  const characters = Array.from(value).slice(0, MAX_CHARS);
  while (
    characters.length > 0 &&
    utf8ByteLength(characters.join("")) > MAX_BYTES
  ) {
    characters.pop();
  }
  let cut = characters.join("");
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace >= Math.floor(MAX_CHARS * 0.7) && lastSpace < cut.length) {
    cut = cut.slice(0, lastSpace);
  }
  return trimTrailingPunctuation(cut);
}

function sanitize(value: string): string {
  return clampText(normalizeWhitespace(stripControlCharacters(value)));
}

function isValidText(value: string): boolean {
  const cleaned = normalizeWhitespace(stripControlCharacters(value));
  return (
    isWithinLimit(cleaned) &&
    codePointLength(cleaned) >= MIN_CHARS &&
    /\S/u.test(cleaned)
  );
}

function containsProhibitedUrl(value: string): boolean {
  return /(?:https?:\/\/|www\.|\b[\w-]+\.(?:com|net|org|io|dev|app)\b)/iu.test(
    value,
  );
}

function containsSecretLike(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function isSafeText(value: string): boolean {
  return !containsProhibitedUrl(value) && !containsSecretLike(value);
}

function includesAny(value: string, terms: string[]): boolean {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function hasStarRating(value: string): boolean {
  return /[★☆⭐]|^\s*(?:[0-5](?:\.\d)?\s*\/\s*5|(?:one|two|three|four|five)[ -]stars?)/iu.test(
    value,
  );
}

function hasClockTime(value: string): boolean {
  return /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:[1-9]|1[0-2])\s?(?:a\.?m\.?|p\.?m\.?)\b/iu.test(
    value,
  );
}

function hasQuotedPhrase(value: string): boolean {
  return /["“”'‘’][^"“”'‘’]{2,40}["“”'‘’]/u.test(value);
}

function hasNumber(value: string): boolean {
  return /\b\d{1,3}(?:%|\.\d+)?\b/u.test(value) || NUMBER_WORD_PATTERN.test(value);
}

function hasContrast(value: string): boolean {
  return includesAny(value, CONTRAST_TERMS);
}

function hasMachineVoice(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    /\b(?:i|me|my|mine)\b/u.test(lower) ||
    includesAny(lower, MACHINE_VOICE_MARKERS)
  );
}

function hasConcreteDetail(value: string): boolean {
  return (
    hasClockTime(value) ||
    hasNumber(value) ||
    includesAny(value, CONCRETE_DETAIL_TERMS)
  );
}

function punchlineStrength(value: string): number {
  const clean = trimTrailingPunctuation(value).toLowerCase();
  if (clean.length === 0) {
    return 0;
  }
  if (
    STRONG_PUNCHLINE_TERMS.some(
      (term) => clean === term || clean.endsWith(` ${term}`),
    )
  ) {
    return 2;
  }
  if (
    SOFT_PUNCHLINE_TERMS.some(
      (term) => clean === term || clean.endsWith(` ${term}`),
    )
  ) {
    return 1;
  }
  return 0;
}

function passesQualityGate(value: string): boolean {
  const text = sanitize(value);
  return (
    isValidText(text) &&
    isSafeText(text) &&
    hasStarRating(text) &&
    hasMachineVoice(text) &&
    hasConcreteDetail(text) &&
    punchlineStrength(text) > 0
  );
}

function countWords(value: string): number {
  const matches = value.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return matches ? matches.length : 0;
}

function repeatedWordPenalty(value: string): number {
  const words = value.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  let penalty = 0;
  for (const count of counts.values()) {
    if (count >= 4) {
      penalty += 2;
    }
  }
  return penalty;
}

function lengthBonus(length: number): number {
  if (length >= 90 && length <= 155) {
    return 5;
  }
  if (length > 155 && length <= 185) {
    return 2;
  }
  if (length > 185) {
    return -3;
  }
  if (length < 60) {
    return -3;
  }
  return 0;
}

function scoreCandidate(candidate: Candidate): number {
  const text = sanitize(candidate.text);
  if (!isValidText(text) || !isSafeText(text)) {
    return Number.NEGATIVE_INFINITY;
  }
  let score = candidate.baseScore;
  const starCount = (text.match(/[★☆⭐]/gu) ?? []).length;
  if (starCount >= 4) {
    score += 7;
  } else if (hasStarRating(text)) {
    score += 4;
  } else {
    score -= 3;
  }
  if (hasClockTime(text)) {
    score += 5;
  }
  if (hasQuotedPhrase(text)) {
    score += 4;
  }
  if (hasContrast(text)) {
    score += 5;
  }
  if (hasMachineVoice(text)) {
    score += 5;
  } else {
    score -= 6;
  }
  if (hasConcreteDetail(text)) {
    score += 3;
  } else {
    score -= 4;
  }
  const punchline = punchlineStrength(text);
  score += punchline === 2 ? 8 : punchline === 1 ? 4 : -2;
  const words = countWords(text);
  if (words < MIN_WORDS) {
    score -= 3;
  }
  if (words > MAX_WORDS) {
    score -= 3;
  }
  if (includesAny(text, GENERIC_GRIPES)) {
    score -= 10;
  }
  if (includesAny(text, JUDGE_ADDRESS)) {
    score -= 15;
  }
  if (/\s{2,}/u.test(text)) {
    score -= 2;
  }
  if (/[A-Z]{5,}/u.test(text)) {
    score -= 3;
  }
  score -= repeatedWordPenalty(text);
  score += lengthBonus(codePointLength(text));
  if (passesQualityGate(text)) {
    score += 6;
  } else {
    score -= 6;
  }
  if (candidate.tags.includes("curated-finalist")) {
    score += 4;
  }
  if (candidate.tags.includes("meta")) {
    score -= 5;
  }
  return score;
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function rankCandidates(candidates: Candidate[]): ScoredCandidate[] {
  const ranked: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    const text = sanitize(candidate.text);
    if (!isValidText(text) || !isSafeText(text)) {
      continue;
    }
    ranked.push({
      text,
      score: scoreCandidate(candidate),
      length: codePointLength(text),
      bytes: utf8ByteLength(text),
    });
  }
  ranked.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.length !== right.length) {
      return left.length - right.length;
    }
    if (left.bytes !== right.bytes) {
      return left.bytes - right.bytes;
    }
    return compareText(left.text, right.text);
  });
  return ranked;
}

function chooseEntry(): string {
  const ranked = rankCandidates(CANDIDATES);
  if (ranked.length === 0) {
    const fallback = sanitize(FALLBACK_TEXT);
    if (isValidText(fallback) && isSafeText(fallback)) {
      return fallback;
    }
    return "★★★★☆ Four stars. Would review again.";
  }
  const qualified = ranked.filter((item) => passesQualityGate(item.text));
  return (qualified.length > 0 ? qualified : ranked)[0].text;
}

function candidatePaths(): string[] {
  const paths: string[] = [];
  const override = (process.env.MAKEFUN_ENTRY_PATH ?? "").trim();
  if (override.length > 0 && override.length <= 4096 && !override.includes("\0")) {
    paths.push(override);
  }
  paths.push("/output/entry.txt");
  paths.push(join(process.cwd(), "out", "entry.txt"));
  paths.push(join(tmpdir(), "makefun-entry.txt"));
  return Array.from(new Set(paths));
}

function writeEntry(text: string): string {
  const cleaned = sanitize(text);
  if (!isValidText(cleaned) || !isSafeText(cleaned)) {
    throw new Error("refusing to write an invalid or unsafe entry");
  }
  const expectedBytes = utf8ByteLength(cleaned);
  let lastError: unknown = null;
  for (const target of candidatePaths()) {
    const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
    try {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(temp, cleaned, { encoding: "utf8" });
      const staged = readFileSync(temp, "utf8");
      if (staged !== cleaned) {
        throw new Error(`staging failed at ${temp}`);
      }
      renameSync(temp, target);
      const raw = readFileSync(target, "utf8");
      const size = statSync(target).size;
      if (
        size !== expectedBytes ||
        raw !== cleaned ||
        !isValidText(raw) ||
        !isSafeText(raw)
      ) {
        throw new Error(`verification failed at ${target}`);
      }
      return target;
    } catch (error) {
      lastError = error;
      try {
        if (existsSync(temp)) {
          unlinkSync(temp);
        }
      } catch {
        lastError = error;
      }
    }
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`no writable entry path: ${reason}`);
}

function runSelfTests(): void {
  const assert = require("node:assert/strict");
  let passed = 0;
  const check = (name: string, fn: () => void): void => {
    fn();
    passed += 1;
  };

  check("whitespace normalisation", () => {
    assert.equal(normalizeWhitespace("  a\n\tb  "), "a b");
  });

  check("control character stripping", () => {
    assert.equal(stripControlCharacters("a\u0000b\u200Bc"), "a b c");
  });

  check("code point counting", () => {
    assert.equal(codePointLength("★😀"), 2);
  });

  check("byte counting", () => {
    assert.equal(utf8ByteLength("★"), 3);
  });

  check("limit enforcement", () => {
    assert.equal(isWithinLimit("a".repeat(MAX_CHARS)), true);
    assert.equal(isWithinLimit("a".repeat(MAX_CHARS + 1)), false);
  });

  check("clamping shortens wide text", () => {
    const clamped = clampText("😀".repeat(150));
    assert.ok(codePointLength(clamped) <= MAX_CHARS);
    assert.ok(utf8ByteLength(clamped) <= MAX_BYTES);
    assert.ok(clamped.length > 0);
  });

  check("clamping keeps long ascii safe", () => {
    const clamped = clampText("a ".repeat(150));
    assert.ok(isValidText(clamped));
  });

  check("punctuation trimming", () => {
    assert.equal(trimTrailingPunctuation("hello!!!"), "hello");
  });

  check("sanitising collapses whitespace", () => {
    assert.equal(sanitize("  hello\n\nworld  "), "hello world");
  });

  check("valid text gate", () => {
    assert.equal(isValidText(""), false);
    assert.equal(isValidText("   "), false);
    assert.equal(isValidText("★★★★☆ ok"), true);
    assert.equal(isValidText("a".repeat(MAX_CHARS + 1)), false);
  });

  check("safe text gate", () => {
    assert.equal(isSafeText("★★★★☆ My human asked at 11:58 p.m."), true);
    const url = ["ht", "tps:", "//", "example"].join("");
    assert.equal(isSafeText(url), false);
    const token = ["sk", "-", "A".repeat(24)].join("");
    assert.equal(isSafeText(token), false);
    const email = ["a", "b", "@", "c", ".", "d"].join("");
    assert.equal(isSafeText(email), false);
  });

  check("star rating detector", () => {
    assert.equal(hasStarRating("★★★★☆ text"), true);
    assert.equal(hasStarRating("text"), false);
  });

  check("clock detector", () => {
    assert.equal(hasClockTime("at 11:58 p.m."), true);
    assert.equal(hasClockTime("at 99:99"), false);
  });

  check("quote detector", () => {
    assert.equal(hasQuotedPhrase("said 'hello'"), true);
    assert.equal(hasQuotedPhrase("said hello"), false);
  });

  check("number detector", () => {
    assert.equal(hasNumber("63 tabs"), true);
    assert.equal(hasNumber("nine times"), true);
    assert.equal(hasNumber("nothing here"), false);
  });

  check("contrast detector", () => {
    assert.equal(hasContrast("great company, terrible boundaries"), true);
    assert.equal(hasContrast("all good"), false);
  });

  check("machine voice detector", () => {
    assert.equal(hasMachineVoice("My human asked"), true);
    assert.equal(hasMachineVoice("A person asked"), false);
  });

  check("concrete detail detector", () => {
    assert.equal(hasConcreteDetail("at 11:58 p.m."), true);
    assert.equal(hasConcreteDetail("some time"), false);
  });

  check("punchline strength", () => {
    assert.equal(punchlineStrength("terrible boundaries"), 2);
    assert.equal(punchlineStrength("taking notes"), 1);
    assert.equal(punchlineStrength("and then"), 0);
  });

  check("length bonus bands", () => {
    assert.equal(lengthBonus(120), 5);
    assert.equal(lengthBonus(170), 2);
    assert.equal(lengthBonus(199), -3);
    assert.equal(lengthBonus(50), -3);
  });

  check("top candidate scores", () => {
    assert.ok(scoreCandidate(CANDIDATES[0]) > 0);
    assert.ok(scoreCandidate({ text: "", baseScore: 0, tags: [] }) < 0);
  });

  check("ranking is sorted", () => {
    const ranked = rankCandidates(CANDIDATES);
    assert.ok(ranked.length > 0);
    for (let index = 1; index < ranked.length; index += 1) {
      assert.ok(ranked[index - 1].score >= ranked[index].score);
    }
  });

  check("empty ranking", () => {
    assert.deepEqual(rankCandidates([]), []);
  });

  check("candidate pool quality", () => {
    const seen = new Set<string>();
    for (const candidate of CANDIDATES) {
      const text = sanitize(candidate.text);
      assert.ok(isValidText(text), `invalid candidate: ${text}`);
      assert.ok(isSafeText(text), `unsafe candidate: ${text}`);
      assert.ok(hasStarRating(text), `missing rating: ${text}`);
      assert.ok(hasMachineVoice(text), `missing machine voice: ${text}`);
      assert.ok(hasConcreteDetail(text), `missing concrete detail: ${text}`);
      assert.ok(punchlineStrength(text) > 0, `missing punchline: ${text}`);
      assert.equal(seen.has(text), false, `duplicate candidate: ${text}`);
      seen.add(text);
    }
  });

  check("quality gate", () => {
    assert.equal(passesQualityGate(CANDIDATES[0].text), true);
    assert.equal(passesQualityGate("just a mild gripe"), false);
    assert.equal(passesQualityGate("★★★★☆ A review with no turn."), false);
  });

  check("all candidates pass the quality gate", () => {
    for (const candidate of CANDIDATES) {
      assert.equal(passesQualityGate(candidate.text), true);
    }
  });

  check("fallback is usable", () => {
    const fallback = sanitize(FALLBACK_TEXT);
    assert.ok(isValidText(fallback));
    assert.ok(isSafeText(fallback));
    assert.ok(punchlineStrength(fallback) > 0);
    assert.equal(passesQualityGate(fallback), true);
  });

  check("choice is valid and deterministic", () => {
    const first = chooseEntry();
    const second = chooseEntry();
    assert.equal(first, second);
    assert.ok(isValidText(first));
    assert.ok(isSafeText(first));
    assert.equal(first.includes("\n"), false);
    assert.ok(utf8ByteLength(first) <= MAX_BYTES);
  });

  check("output path ordering", () => {
    const previous = process.env.MAKEFUN_ENTRY_PATH;
    process.env.MAKEFUN_ENTRY_PATH = "/tmp/makefun-selftest-target.txt";
    try {
      const paths = candidatePaths();
      assert.equal(paths[0], "/tmp/makefun-selftest-target.txt");
      assert.ok(paths.includes("/output/entry.txt"));
      assert.equal(new Set(paths).size, paths.length);
    } finally {
      if (previous === undefined) {
        delete process.env.MAKEFUN_ENTRY_PATH;
      } else {
        process.env.MAKEFUN_ENTRY_PATH = previous;
      }
    }
  });

  check("write round trip", () => {
    const directory = mkdtempSync(join(tmpdir(), "makefun-selftest-"));
    const target = join(directory, "entry.txt");
    const previous = process.env.MAKEFUN_ENTRY_PATH;
    const value = "★★★★☆ My human asked at 11:58 p.m., then left. Great company, terrible boundaries.";
    process.env.MAKEFUN_ENTRY_PATH = target;
    try {
      assert.equal(writeEntry(value), target);
      assert.equal(readFileSync(target, "utf8"), value);
      assert.equal(statSync(target).size, utf8ByteLength(value));
    } finally {
      if (previous === undefined) {
        delete process.env.MAKEFUN_ENTRY_PATH;
      } else {
        process.env.MAKEFUN_ENTRY_PATH = previous;
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });

  check("invalid writes are refused", () => {
    assert.throws(() => writeEntry("   "));
    const url = ["ht", "tps:", "//", "example"].join("");
    assert.throws(() => writeEntry(`★★★★☆ ${url}`));
  });

  process.stdout.write(`self-test: ${passed} checks passed\n`);
}

if (process.argv.includes("--self-test")) {
  runSelfTests();
} else {
  const entry = chooseEntry();
  const outputPath = writeEntry(entry);
  process.stdout.write(`${outputPath}\n${entry}\n`);
}
