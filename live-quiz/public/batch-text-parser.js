(function (root, factory) {
  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BatchTextParser = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULTS = {
    minQuestions: 1,
    maxQuestions: 50,
    promptMaxLength: 500,
    optionMaxLength: 300
  };

  function ParserError(errors) {
    var message = "Batch text could not be parsed:\n- " + errors.join("\n- ");
    var error = new Error(message);
    error.name = "BatchTextParserError";
    error.errors = errors.slice();
    return error;
  }

  function readPositiveInteger(value, fallback, name) {
    if (value === undefined) {
      return fallback;
    }
    if (!Number.isInteger(value) || value < 1) {
      throw ParserError([name + " must be a positive integer."]);
    }
    return value;
  }

  function getConfig(options) {
    options = options || {};
    if (typeof options !== "object" || Array.isArray(options)) {
      throw ParserError(["options must be an object when provided."]);
    }

    var config = {
      minQuestions: readPositiveInteger(
        options.minQuestions,
        DEFAULTS.minQuestions,
        "minQuestions"
      ),
      maxQuestions: readPositiveInteger(
        options.maxQuestions,
        DEFAULTS.maxQuestions,
        "maxQuestions"
      ),
      promptMaxLength: readPositiveInteger(
        options.promptMaxLength,
        DEFAULTS.promptMaxLength,
        "promptMaxLength"
      ),
      optionMaxLength: readPositiveInteger(
        options.optionMaxLength,
        DEFAULTS.optionMaxLength,
        "optionMaxLength"
      )
    };

    if (config.minQuestions > config.maxQuestions) {
      throw ParserError(["minQuestions cannot be greater than maxQuestions."]);
    }
    return config;
  }

  function matchBoldLabel(line, labelPattern) {
    return line.match(
      new RegExp(
        "^\\s*(?:\\*\\*\\s*)?(" +
          labelPattern +
          ")(?:(?:\\s*:\\s*)(?:\\*\\*\\s*)?|(?:\\s*\\*\\*\\s*:\\s*))(.*)$",
        "i"
      )
    );
  }

  function matchQuestionLabel(line) {
    var match = matchBoldLabel(line, "Question");
    return match ? match[2].trim() : null;
  }

  function matchAnswerLabel(line) {
    var match = matchBoldLabel(line, "Answer|Correct");
    return match ? match[2].trim() : null;
  }

  function matchLetterOption(line) {
    var match = line.match(
      /^\s*(?:\*\*\s*)?([A-D])(?:(?:\s*[.):]\s*)(?:\*\*\s*)?|(?:\s*\*\*\s*[.):]\s*))(.*)$/i
    );
    return match
      ? { index: match[1].toUpperCase().charCodeAt(0) - 65, text: match[2].trim() }
      : null;
  }

  function matchNumberOption(line) {
    var match = line.match(
      /^\s*(?:\*\*\s*)?([1-4])(?:(?:\s*[.):]\s*)(?:\*\*\s*)?|(?:\s*\*\*\s*[.):]\s*))(.*)$/
    );
    return match
      ? { index: Number(match[1]) - 1, text: match[2].trim() }
      : null;
  }

  function matchNumberedQuestion(line) {
    var match = line.match(/^\s*(\d{1,3})[.)]\s+(.+)$/);
    return match ? { number: Number(match[1]), prompt: match[2].trim() } : null;
  }

  function questionName(question, fallbackNumber) {
    if (!question) {
      return "Question " + fallbackNumber;
    }
    return question.mode === "numbered"
      ? "Question " + question.sourceNumber
      : "Block " + fallbackNumber;
  }

  function addQuestionError(errors, question, fallbackNumber, message) {
    errors.push(questionName(question, fallbackNumber) + ": " + message);
  }

  function resolveAnswer(answer, options, errors, question, fallbackNumber) {
    var normalized = answer.trim();
    var letter = normalized.match(/^[A-D]$/i);
    if (letter) {
      return letter[0].toUpperCase().charCodeAt(0) - 65;
    }

    var number = normalized.match(/^[1-4]$/);
    if (number) {
      return Number(number[0]) - 1;
    }

    var target = normalized.toLocaleLowerCase();
    var matches = [];
    options.forEach(function (option, index) {
      if (option.trim().toLocaleLowerCase() === target) {
        matches.push(index);
      }
    });

    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1) {
      addQuestionError(
        errors,
        question,
        fallbackNumber,
        'answer text "' + normalized + '" matches more than one option.'
      );
    } else {
      addQuestionError(
        errors,
        question,
        fallbackNumber,
        'answer "' +
          normalized +
          '" must be A-D, 1-4, or the exact text of one option.'
      );
    }
    return -1;
  }

  function validateQuestion(question, resultNumber, config, errors) {
    var label = questionName(question, resultNumber);
    var prompt = question.prompt.trim();
    var options = question.options.map(function (option) {
      return option === undefined ? "" : option.trim();
    });

    if (!prompt) {
      errors.push(label + ": prompt is empty.");
    } else if (prompt.length > config.promptMaxLength) {
      errors.push(
        label +
          ": prompt is " +
          prompt.length +
          " characters; maximum is " +
          config.promptMaxLength +
          "."
      );
    }

    var missing = [];
    options.forEach(function (option, index) {
      if (!option) {
        missing.push(question.optionKind === "number" ? String(index + 1) : String.fromCharCode(65 + index));
      } else if (option.length > config.optionMaxLength) {
        errors.push(
          label +
            ": option " +
            (question.optionKind === "number" ? index + 1 : String.fromCharCode(65 + index)) +
            " is " +
            option.length +
            " characters; maximum is " +
            config.optionMaxLength +
            "."
        );
      }
    });
    if (missing.length) {
      errors.push(label + ": missing or empty option(s) " + missing.join(", ") + ".");
    }

    var seen = Object.create(null);
    options.forEach(function (option, index) {
      if (!option) {
        return;
      }
      var key = option.toLocaleLowerCase();
      if (seen[key] !== undefined) {
        errors.push(
          label +
            ": options " +
            (seen[key] + 1) +
            " and " +
            (index + 1) +
            " are duplicates; all four options must be distinct."
        );
      } else {
        seen[key] = index;
      }
    });

    if (question.answer === null) {
      errors.push(label + ": missing Answer: or Correct: line.");
      return null;
    }
    if (!question.answer.trim()) {
      errors.push(label + ": Answer: or Correct: value is empty.");
      return null;
    }
    if (missing.length) {
      return null;
    }

    var correctOption = resolveAnswer(
      question.answer,
      options,
      errors,
      question,
      resultNumber
    );
    if (correctOption < 0) {
      return null;
    }

    return {
      topic: "Question " + resultNumber,
      prompt: prompt,
      options: options,
      correctOption: correctOption,
      explanation: ""
    };
  }

  function createQuestion(mode, prompt, sourceNumber, lineNumber) {
    return {
      mode: mode,
      sourceNumber: sourceNumber,
      startLine: lineNumber,
      prompt: prompt,
      options: [undefined, undefined, undefined, undefined],
      optionKind: mode === "labeled" ? "letter" : null,
      currentOption: -1,
      answer: null
    };
  }

  function expandInlineLabels(text) {
    return text.replace(/\r\n?/g, "\n").split("\n").map(function (rawLine) {
      if (matchQuestionLabel(rawLine.trim()) === null) {
        return rawLine;
      }
      return rawLine.replace(
        /\s+(?=(?:A|B|C|D|Answer|Correct)\s*:)/gi,
        "\n"
      );
    }).join("\n");
  }

  function parse(text, options) {
    var config = getConfig(options);
    if (typeof text !== "string") {
      throw ParserError(["Input must be text."]);
    }
    if (!text.trim()) {
      throw ParserError([
        "Input is empty. Add at least " + config.minQuestions + " question."
      ]);
    }

    var lines = expandInlineLabels(text).split("\n");
    var parsed = [];
    var errors = [];
    var current = null;

    function finishCurrent() {
      if (!current) {
        return;
      }
      var result = validateQuestion(current, parsed.length + 1, config, errors);
      if (result) {
        parsed.push(result);
      }
      current = null;
    }

    lines.forEach(function (rawLine, lineIndex) {
      var lineNumber = lineIndex + 1;
      var line = rawLine.trim();
      if (!line) {
        return;
      }

      if (!current) {
        var labeledPrompt = matchQuestionLabel(line);
        if (labeledPrompt !== null) {
          current = createQuestion("labeled", labeledPrompt, null, lineNumber);
          return;
        }

        var numberedStart = matchNumberedQuestion(line);
        if (numberedStart) {
          current = createQuestion(
            "numbered",
            numberedStart.prompt,
            numberedStart.number,
            lineNumber
          );
          return;
        }

        errors.push(
          "Line " +
            lineNumber +
            ': expected "Question:" or a numbered question such as "1. ...".'
        );
        return;
      }

      var answer = matchAnswerLabel(line);
      if (answer !== null) {
        if (current.answer !== null) {
          addQuestionError(
            errors,
            current,
            parsed.length + 1,
            "has more than one Answer/Correct line (line " + lineNumber + ")."
          );
        } else {
          current.answer = answer;
        }
        finishCurrent();
        return;
      }

      var nextLabeledPrompt = matchQuestionLabel(line);
      if (nextLabeledPrompt !== null) {
        addQuestionError(
          errors,
          current,
          parsed.length + 1,
          "a new Question: starts on line " +
            lineNumber +
            " before an Answer/Correct line."
        );
        finishCurrent();
        current = createQuestion("labeled", nextLabeledPrompt, null, lineNumber);
        return;
      }

      var letterOption = matchLetterOption(line);
      var numberOption = matchNumberOption(line);
      var option = null;
      var kind = null;

      if (current.mode === "labeled") {
        option = letterOption;
        kind = "letter";
      } else if (letterOption) {
        option = letterOption;
        kind = "letter";
      } else if (numberOption) {
        option = numberOption;
        kind = "number";
      }

      if (option) {
        if (current.optionKind && current.optionKind !== kind) {
          addQuestionError(
            errors,
            current,
            parsed.length + 1,
            "mixes lettered and numbered options on line " + lineNumber + "."
          );
          return;
        }
        current.optionKind = kind;
        if (current.options[option.index] !== undefined) {
          addQuestionError(
            errors,
            current,
            parsed.length + 1,
            "option " +
              (kind === "number" ? option.index + 1 : String.fromCharCode(65 + option.index)) +
              " is repeated on line " +
              lineNumber +
              "."
          );
          return;
        }
        current.options[option.index] = option.text;
        current.currentOption = option.index;
        return;
      }

      var possibleNextQuestion = matchNumberedQuestion(line);
      if (
        possibleNextQuestion &&
        (current.mode === "labeled" ||
          current.optionKind === "letter" ||
          current.options.every(function (value) { return value !== undefined; }))
      ) {
        addQuestionError(
          errors,
          current,
          parsed.length + 1,
          "question " +
            possibleNextQuestion.number +
            " starts on line " +
            lineNumber +
            " before an Answer/Correct line."
        );
        finishCurrent();
        current = createQuestion(
          "numbered",
          possibleNextQuestion.prompt,
          possibleNextQuestion.number,
          lineNumber
        );
        return;
      }

      if (/^\s*(?:\*\*\s*)?[A-Za-z0-9]+(?:\s*\*\*)?\s*[.):]/.test(line)) {
        addQuestionError(
          errors,
          current,
          parsed.length + 1,
          'unrecognized or out-of-range option label on line ' + lineNumber + ': "' + line + '".'
        );
        return;
      }

      if (current.currentOption >= 0) {
        current.options[current.currentOption] += " " + line;
      } else {
        current.prompt += " " + line;
      }
    });

    finishCurrent();

    if (parsed.length < config.minQuestions) {
      errors.push(
        "Found " +
          parsed.length +
          " valid question(s); at least " +
          config.minQuestions +
          " required."
      );
    }
    if (parsed.length > config.maxQuestions) {
      errors.push(
        "Found " +
          parsed.length +
          " questions; maximum is " +
          config.maxQuestions +
          "."
      );
    }
    if (errors.length) {
      throw ParserError(errors);
    }
    return parsed;
  }

  return { parse: parse };
});
