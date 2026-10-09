(function (root, factory) {
  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BatchPromptBuilder = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function build(input) {
    input = input || {};
    var count = Number(input.count);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      throw new Error("Question count must be between 1 and 50.");
    }

    var label = clean(input.label) || "Custom quiz";
    var brand = input.brand === "microsoft" ? "Microsoft Cloud Challenge" : "GitHub Platform Challenge";
    var tags = Array.isArray(input.tags)
      ? input.tags.map(clean).filter(Boolean)
      : [];
    var guidance = clean(input.guidance);
    var sourceMode = input.sourceMode === "slide-deck" ? "slide-deck" : "general";

    var context = [
      sourceMode === "slide-deck"
        ? "Use the PowerPoint presentation attached to or open in this Microsoft 365 Copilot conversation as the sole factual source."
        : "Create exactly " + count + " accurate multiple-choice quiz questions.",
      sourceMode === "slide-deck"
        ? "Create exactly " + count + " accurate multiple-choice quiz questions from that slide deck."
        : "",
      "Experience: " + brand + ".",
      "Batch label: " + label + ".",
      tags.length ? "Topics or tags: " + tags.join(", ") + "." : "",
      guidance ? "Additional guidance: " + guidance : ""
    ].filter(Boolean);

    return [
      context.join("\n"),
      "",
      "Return only plain text in this exact repeated format:",
      "Question: <question text>",
      "A: <option>",
      "B: <option>",
      "C: <option>",
      "D: <option>",
      "Answer: <A, B, C, or D>",
      "",
      "Requirements:",
      "- Include exactly " + count + " question blocks.",
      "- Put Question, A, B, C, D, and Answer on separate lines exactly as shown.",
      "- Never place two labels on the same line.",
      "- Give every question exactly four distinct options and one unambiguous correct answer.",
      "- Keep each question under 500 characters and each option under 300 characters.",
      "- Use stable, verifiable facts. Avoid trick questions, negative wording, and ambiguous answers.",
      sourceMode === "slide-deck"
        ? "- Ground every question and correct answer only in content stated or clearly shown in the presentation."
        : "",
      sourceMode === "slide-deck"
        ? "- Cover the presentation's important sections without inventing details or using outside knowledge."
        : "",
      sourceMode === "slide-deck"
        ? "- If the presentation is unavailable or lacks enough supported facts, say so instead of creating unsupported questions."
        : "",
      "- Do not include numbering, markdown fences, headings, explanations, citations, or commentary."
    ].filter(Boolean).join("\n");
  }

  return { build: build };
});
