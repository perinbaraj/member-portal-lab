"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parse } = require("../public/batch-text-parser");

function question(prompt, correctOption, options = ["Alpha", "Bravo", "Charlie", "Delta"]) {
  return {
    topic: "Question 1",
    prompt,
    options,
    correctOption,
    explanation: "",
  };
}

test("parses labeled questions and resolves answers by letter", () => {
  const parsed = parse(`
Question: Which option is correct?
A: Alpha
B: Bravo
C: Charlie
D: Delta
Answer: B
`);

  assert.deepEqual(parsed, [question("Which option is correct?", 1)]);
});

test("parses AI output with every label on one line", () => {
  const parsed = parse(`
Question: What is the primary role of an ontology in Fabric IQ? A: Provide a shared business representation B: Replace all operational databases C: Provision virtual machines D: Manage user passwords Answer: A

Question: Which Cosmos DB capability supports similarity search? A: Vector search B: DNS forwarding C: Block storage D: SMTP relay Answer: A
`);

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].prompt, "What is the primary role of an ontology in Fabric IQ?");
  assert.deepEqual(parsed[0].options, [
    "Provide a shared business representation",
    "Replace all operational databases",
    "Provision virtual machines",
    "Manage user passwords",
  ]);
  assert.equal(parsed[1].correctOption, 0);
});

test("parses numbered questions and resolves answers by number", () => {
  const parsed = parse(`
1. Pick the third option.
1) Alpha
2) Bravo
3) Charlie
4) Delta
Correct: 3
`);

  assert.deepEqual(parsed, [question("Pick the third option.", 2)]);
});

test("resolves an answer from unique exact option text case-insensitively", () => {
  const parsed = parse(`
Question: Pick the named color.
A. Red
B. Green
C. Blue
D. Gold
Answer: blue
`);

  assert.equal(parsed[0].correctOption, 2);
  assert.deepEqual(parsed[0].options, ["Red", "Green", "Blue", "Gold"]);
});

test("tolerates whitespace and Markdown around labels", () => {
  const parsed = parse(`
   **Question** :   Which command creates a branch?
 **A**: git add
 **B** : git branch
 **C.** git merge
 **D)** git clone
 **Answer** :   B
`);

  assert.equal(parsed[0].prompt, "Which command creates a branch?");
  assert.deepEqual(parsed[0].options, ["git add", "git branch", "git merge", "git clone"]);
  assert.equal(parsed[0].correctOption, 1);
});

test("parses multiple labeled and numbered questions atomically", () => {
  const parsed = parse(`
Question: First question?
A: One
B: Two
C: Three
D: Four
Answer: A

2. Second question?
1. North
2. South
3. East
4. West
Correct: West
`);

  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed.map(item => item.prompt), ["First question?", "Second question?"]);
  assert.deepEqual(parsed.map(item => item.correctOption), [0, 3]);
  assert.deepEqual(parsed.map(item => item.topic), ["Question 1", "Question 2"]);
});

test("rejects duplicate options and ambiguous exact-text answers", () => {
  assert.throws(
    () => parse(`
Question: Which duplicate is correct?
A: Same
B: Other
C: Same
D: Last
Answer: Same
`),
    error => {
      assert.equal(error.name, "BatchTextParserError");
      assert.ok(error.errors.some(message => /duplicates/i.test(message)));
      assert.ok(error.errors.some(message => /matches more than one option/i.test(message)));
      return true;
    }
  );
});

test("rejects missing, empty, and extra options", () => {
  assert.throws(
    () => parse(`
Question: Missing an option?
A: Alpha
B: Bravo
C: Charlie
Answer: A
`),
    error => error.errors.some(message => /missing or empty option\(s\) D/i.test(message))
  );

  assert.throws(
    () => parse(`
Question: Empty option?
A: Alpha
B:
C: Charlie
D: Delta
Answer: A
`),
    error => error.errors.some(message => /missing or empty option\(s\) B/i.test(message))
  );

  assert.throws(
    () => parse(`
Question: Too many options?
A: Alpha
B: Bravo
C: Charlie
D: Delta
E: Echo
Answer: A
`),
    error => error.errors.some(message => /out-of-range option label/i.test(message))
  );
});

test("rejects malformed blocks and invalid answer references", () => {
  for (const source of [
    "This is not a question block.",
    `Question: Missing answer?
A: Alpha
B: Bravo
C: Charlie
D: Delta`,
    `Question: Bad answer?
A: Alpha
B: Bravo
C: Charlie
D: Delta
Answer: Echo`,
    `Question: Mixed option labels?
A: Alpha
2: Bravo
C: Charlie
D: Delta
Answer: A`,
    `Question: Interrupted?
A: Alpha
B: Bravo
C: Charlie
D: Delta
Question: Starts too early
A: One
B: Two
C: Three
D: Four
Answer: A`,
  ]) {
    assert.throws(() => parse(source), { name: "BatchTextParserError" });
  }
});

test("enforces prompt, option, and question count limits", () => {
  assert.throws(
    () => parse(`
Question: 123456
A: A
B: B
C: C
D: D
Answer: A
`, { promptMaxLength: 5 }),
    error => error.errors.some(message => /prompt is 6 characters; maximum is 5/i.test(message))
  );

  assert.throws(
    () => parse(`
Question: Option limit?
A: 123456
B: B
C: C
D: D
Answer: B
`, { optionMaxLength: 5 }),
    error => error.errors.some(message => /option A is 6 characters; maximum is 5/i.test(message))
  );

  const twoQuestions = `
Question: First?
A: A
B: B
C: C
D: D
Answer: A
Question: Second?
A: A
B: B
C: C
D: D
Answer: B
`;
  assert.throws(
    () => parse(twoQuestions, { maxQuestions: 1 }),
    error => error.errors.some(message => /Found 2 questions; maximum is 1/i.test(message))
  );
  assert.throws(
    () => parse(twoQuestions, { minQuestions: 3 }),
    error => error.errors.some(message => /Found 2 valid question\(s\); at least 3 required/i.test(message))
  );
});

test("does not return partial questions when any block is invalid", () => {
  let result = "not assigned";
  assert.throws(() => {
    result = parse(`
Question: Valid first block?
A: Alpha
B: Bravo
C: Charlie
D: Delta
Answer: A

Question: Invalid second block?
A: Alpha
B: Bravo
C: Charlie
Answer: A
`);
  }, { name: "BatchTextParserError" });
  assert.equal(result, "not assigned");

  const subsequent = parse(`
Question: A later valid parse still works?
A: Alpha
B: Bravo
C: Charlie
D: Delta
Answer: D
`);
  assert.equal(subsequent.length, 1);
  assert.equal(subsequent[0].correctOption, 3);
});

test("rejects invalid parser input and limit configuration", () => {
  assert.throws(() => parse(null), /Input must be text/);
  assert.throws(() => parse(" \n "), /Input is empty/);
  assert.throws(() => parse("Question: Test", []), /options must be an object/);
  assert.throws(() => parse("Question: Test", { minQuestions: 2, maxQuestions: 1 }), /cannot be greater/);
  assert.throws(() => parse("Question: Test", { promptMaxLength: 0 }), /positive integer/);
});
