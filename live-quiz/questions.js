'use strict';

const BRANDS = Object.freeze(['github', 'microsoft']);
const LIMITS = Object.freeze({
  maxBatchIdLength: 64,
  maxBatchLabelLength: 100,
  maxTags: 12,
  maxTagLength: 60,
  minQuestions: 1,
  maxQuestions: 100,
  minOptions: 2,
  maxOptions: 8,
  maxTitleLength: 120,
  maxPromptLength: 1000,
  maxOptionLength: 500,
  maxExplanationLength: 2000,
});

function fail(path, message, ErrorType = TypeError) {
  throw new ErrorType(`${path}: ${message}`);
}

function normalizeText(value, path, maxLength) {
  if (typeof value !== 'string') fail(path, 'must be a string');
  const normalized = value.trim();
  if (!normalized) fail(path, 'must not be empty');
  if (normalized.length > maxLength) fail(path, `must be at most ${maxLength} characters`);
  return normalized;
}

function normalizeTags(value, path = 'tags') {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(path, 'must be an array');
  if (value.length > LIMITS.maxTags) fail(path, `must contain at most ${LIMITS.maxTags} tags`);

  const seen = new Set();
  return value.map((tag, index) => normalizeText(tag, `${path}[${index}]`, LIMITS.maxTagLength))
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeBrand(value, path = 'brand') {
  const brand = normalizeText(value, path, 20).toLowerCase();
  if (!BRANDS.includes(brand)) fail(path, `must be one of: ${BRANDS.join(', ')}`, RangeError);
  return brand;
}

function generateBatchId(label, existingIds = []) {
  const normalizedLabel = normalizeText(label, 'label', LIMITS.maxBatchLabelLength);
  if (!Array.isArray(existingIds)) fail('existingIds', 'must be an array');
  const used = new Set(existingIds.map((id, index) =>
    normalizeText(id, `existingIds[${index}]`, LIMITS.maxBatchIdLength).toLowerCase()));
  const base = normalizedLabel.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.maxBatchIdLength)
    .replace(/-+$/g, '') || 'batch';
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    const suffixText = `-${suffix++}`;
    id = `${base.slice(0, LIMITS.maxBatchIdLength - suffixText.length)}${suffixText}`;
  }
  return id;
}

function normalizeQuestion(input, context = {}) {
  const path = context.path || 'question';
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(path, 'must be an object');

  const title = normalizeText(input.title ?? input.topic ?? input.t, `${path}.title`, LIMITS.maxTitleLength);
  const topic = normalizeText(input.topic ?? input.t ?? input.title, `${path}.topic`, LIMITS.maxTitleLength);
  const prompt = normalizeText(input.prompt ?? input.q, `${path}.prompt`, LIMITS.maxPromptLength);
  const rawOptions = input.options ?? input.o;
  if (!Array.isArray(rawOptions)) fail(`${path}.options`, 'must be an array');
  if (rawOptions.length < LIMITS.minOptions || rawOptions.length > LIMITS.maxOptions) {
    fail(`${path}.options`, `must contain ${LIMITS.minOptions} to ${LIMITS.maxOptions} options`, RangeError);
  }
  const options = rawOptions.map((option, index) =>
    normalizeText(option, `${path}.options[${index}]`, LIMITS.maxOptionLength));
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
    fail(`${path}.options`, 'must not contain duplicate options');
  }

  const correctAnswerIndex = input.correctAnswerIndex ?? input.correctIndex ?? input.c;
  if (!Number.isInteger(correctAnswerIndex)) fail(`${path}.correctAnswerIndex`, 'must be an integer');
  if (correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
    fail(`${path}.correctAnswerIndex`, 'must reference an available option', RangeError);
  }

  const explanationValue = input.explanation ?? input.e;
  const explanation = explanationValue === undefined
    ? undefined
    : normalizeText(explanationValue, `${path}.explanation`, LIMITS.maxExplanationLength);
  const brandValue = input.brand ?? context.brand;
  const brand = brandValue === undefined ? undefined : normalizeBrand(brandValue, `${path}.brand`);
  const tags = normalizeTags(input.tags ?? context.tags, `${path}.tags`);

  return {
    title,
    topic,
    prompt,
    options,
    correctAnswerIndex,
    ...(explanation === undefined ? {} : { explanation }),
    ...(brand === undefined ? {} : { brand }),
    tags,
    // Legacy aliases remain available until all consumers use descriptive fields.
    t: topic,
    q: prompt,
    o: options,
    c: correctAnswerIndex,
    ...(explanation === undefined ? {} : { e: explanation }),
  };
}

function validateQuestion(input, context = {}) {
  normalizeQuestion(input, context);
  return true;
}

function normalizeBatch(input, options = {}) {
  const path = options.path || 'batch';
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(path, 'must be an object');

  const label = normalizeText(input.label, `${path}.label`, LIMITS.maxBatchLabelLength);
  const idValue = input.id ?? generateBatchId(label, options.existingIds || []);
  const id = normalizeText(idValue, `${path}.id`, LIMITS.maxBatchIdLength).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    fail(`${path}.id`, 'must contain lowercase letters, numbers, and single hyphens only');
  }
  const brand = normalizeBrand(input.brand, `${path}.brand`);
  const tags = normalizeTags(input.tags, `${path}.tags`);
  if (!Array.isArray(input.questions)) fail(`${path}.questions`, 'must be an array');
  if (input.questions.length < LIMITS.minQuestions || input.questions.length > LIMITS.maxQuestions) {
    fail(`${path}.questions`, `must contain ${LIMITS.minQuestions} to ${LIMITS.maxQuestions} questions`, RangeError);
  }
  const questions = input.questions.map((question, index) => normalizeQuestion(question, {
    path: `${path}.questions[${index}]`,
    brand,
    tags,
  }));

  return { id, label, brand, tags, questions };
}

function validateBatch(input, options = {}) {
  normalizeBatch(input, options);
  return true;
}

function normalizeBatches(inputs) {
  const entries = Array.isArray(inputs)
    ? inputs.map((batch, index) => [String(index), batch])
    : Object.entries(inputs || {});
  if (!entries.length) fail('batches', 'must contain at least one batch');

  const normalized = {};
  for (const [key, batch] of entries) {
    const value = normalizeBatch(batch, {
      path: `batches.${key}`,
      existingIds: Object.keys(normalized),
    });
    if (normalized[value.id]) fail(`batches.${key}.id`, `duplicates batch id "${value.id}"`);
    normalized[value.id] = value;
  }
  return normalized;
}

const RAW_BATCHES = {
  'batch-1': {
    id: 'batch-1',
    label: 'Batch 1',
    brand: 'github',
    tags: ['GitHub Copilot', 'GitHub Actions', 'GitHub Security'],
    questions: [
      {
        t: 'GitHub Copilot Inline Suggestions',
        q: 'In Visual Studio Code, which key accepts the full inline suggestion displayed by GitHub Copilot?',
        o: ['Enter', 'Tab', 'Escape', 'Ctrl+Enter'],
        c: 1,
      },
      {
        t: 'GitHub Copilot Chat',
        q: 'Which Copilot Chat slash command can be used to generate unit tests for selected code?',
        o: ['/fix', '/explain', '/doc', '/tests'],
        c: 3,
      },
      {
        t: 'GitHub Copilot CLI',
        q: 'Which command installs GitHub Copilot CLI using npm?',
        o: ['npm install -g @github/copilot', 'npm install -g @github/copilot-sdk', 'npm install -g github-copilot', 'npm run copilot'],
        c: 0,
      },
      {
        t: 'GitHub Copilot CLI',
        q: 'Which command starts an interactive GitHub Copilot CLI session?',
        o: ['copilot login', 'npm run copilot', 'copilot', 'gh copilot suggest'],
        c: 2,
      },
      {
        t: 'Copilot Cloud Agent',
        q: 'What can GitHub Copilot cloud agent do when you delegate a coding task to it?',
        o: [
          'It only suggests the next line in the open editor and cannot make code changes.',
          'It can work independently in the background, research the repository, plan the implementation, and make code changes on a branch for review.',
          'It deploys every change directly to production without a review branch.',
          'It can only review existing pull requests and cannot implement a delegated task.',
        ],
        c: 1,
      },
      {
        t: 'GitHub Actions',
        q: 'In which repository directory must GitHub Actions workflow files be stored?',
        o: ['.github/actions/', '.github/workflow/', '.github/workflows/', 'workflows/'],
        c: 2,
      },
      {
        t: 'GitHub Actions',
        q: 'Which GitHub Actions event allows a workflow to be triggered manually?',
        o: ['workflow_dispatch', 'push', 'pull_request', 'schedule'],
        c: 0,
      },
      {
        t: 'GitHub Secret Protection',
        q: 'What does push protection do?',
        o: [
          'It rotates repository secrets after every successful push.',
          'It encrypts all commits before they are stored in the repository.',
          'It scans for secrets only after they have been merged into the default branch.',
          'It detects and blocks supported secrets before they reach the repository.',
        ],
        c: 3,
      },
      {
        t: 'GitHub Copilot IDE',
        q: 'In Visual Studio Code, which context variable can be used to provide Copilot Chat with codebase context?',
        o: ['#file', '#codebase', '#selection', '#terminal'],
        c: 1,
      },
      {
        t: 'GitHub Copilot Models',
        q: 'What option allows GitHub Copilot to automatically choose an appropriate AI model for a task?',
        o: ['Agent mode', 'Copilot Spaces', 'Auto model selection', 'Manual model picker'],
        c: 2,
      },
      {
        t: 'GitHub Actions',
        q: 'What expression references a repository secret named API_KEY in a GitHub Actions workflow?',
        o: ['${{ secrets.API_KEY }}', '${{ vars.API_KEY }}', '${{ env.API_KEY }}', '${{ github.API_KEY }}'],
        c: 0,
      },
      {
        t: 'GitHub Enterprise',
        q: 'What is the main deployment difference between GitHub Enterprise Cloud (GHEC) and GitHub Enterprise Server (GHES)?',
        o: [
          'Both are self-hosted, but only GHEC supports GitHub Actions.',
          'GHES is hosted by GitHub, while GHEC is self-hosted.',
          'Both are hosted by GitHub, but GHES requires a dedicated organization.',
          'GitHub Enterprise Cloud is hosted by GitHub, while GitHub Enterprise Server is self-hosted.',
        ],
        c: 3,
      },
    ],
  },
  'batch-2': {
    id: 'batch-2',
    label: 'Batch 2',
    brand: 'github',
    tags: ['GitHub Copilot', 'GitHub Actions', 'GitHub Security'],
    questions: [
      {
        t: 'GitHub Copilot Agent Mode',
        q: 'In a supported IDE, which Copilot mode can autonomously determine which files to modify and run commands as it works toward completing a coding task?',
        o: ['Ask mode', 'Edit mode', 'Agent mode', 'Plan mode'],
        c: 2,
      },
      {
        t: 'GitHub Copilot Context',
        q: 'In Visual Studio Code, which Copilot context variable can be used to explicitly reference a specific file in a prompt?',
        o: ['#file', '#codebase', '#selection', '#terminal'],
        c: 0,
      },
      {
        t: 'GitHub Copilot Custom Instructions',
        q: 'What repository file can be used to provide repository-wide custom instructions to GitHub Copilot?',
        o: ['.github/instructions.md', '.github/copilot.md', '.github/README.md', '.github/copilot-instructions.md'],
        c: 3,
      },
      {
        t: 'GitHub Copilot CLI',
        q: 'Which slash command is used to authenticate from within GitHub Copilot CLI when you are not already signed in?',
        o: ['/auth', '/login', '/signin', '/connect'],
        c: 1,
      },
      {
        t: 'GitHub Copilot Cloud Agent',
        q: 'What type of development environment does Copilot cloud agent use while working on an assigned coding task?',
        o: [
          'Its own ephemeral development environment powered by GitHub Actions.',
          'The requester’s local IDE and terminal, controlled remotely.',
          'A permanent shared server reused across all repository tasks.',
          'The production server where the application is deployed.',
        ],
        c: 0,
      },
      {
        t: 'GitHub Actions',
        q: 'Which GitHub Actions keyword defines the events that trigger a workflow?',
        o: ['jobs', 'runs-on', 'on', 'needs'],
        c: 2,
      },
      {
        t: 'GitHub Actions',
        q: 'Which GitHub Actions event is commonly used to run a workflow when code is pushed to a repository?',
        o: ['pull_request', 'schedule', 'workflow_dispatch', 'push'],
        c: 3,
      },
      {
        t: 'GitHub Actions',
        q: 'Which GitHub Actions context provides information about the workflow run and the event that triggered it?',
        o: ['runner', 'github', 'env', 'secrets'],
        c: 1,
      },
      {
        t: 'GitHub Code Security',
        q: 'Which GitHub security capability analyzes source code to identify potential security vulnerabilities and coding errors?',
        o: ['Code scanning', 'Secret scanning', 'Dependency graph', 'Dependabot alerts'],
        c: 0,
      },
      {
        t: 'GitHub Code Security',
        q: 'Which GitHub feature identifies known vulnerable dependencies used by a repository?',
        o: ['Code scanning', 'Secret scanning', 'Dependabot alerts', 'Dependabot version updates'],
        c: 2,
      },
      {
        t: 'GitHub Secret Protection',
        q: 'If push protection detects a supported secret during a push, what happens by default?',
        o: [
          'GitHub removes the secret from the commit and accepts the push.',
          'The push is blocked so the secret does not reach the protected repository.',
          'The push succeeds, then an alert is sent to the repository owner.',
          'The secret is published in a private issue while the push completes.',
        ],
        c: 1,
      },
      {
        t: 'GitHub Pull Requests',
        q: 'Which GitHub feature can require specified conditions, such as approving reviews or passing status checks, before changes can be merged into a protected branch?',
        o: ['CODEOWNERS file alone', 'Branch naming conventions', 'Issue templates', 'Branch protection rules'],
        c: 3,
      },
    ],
  },
  'batch-3': {
    id: 'batch-3',
    label: 'Batch 3',
    brand: 'github',
    tags: ['GitHub Copilot', 'MCP', 'GitHub Code Review'],
    questions: [
      {
        t: 'Copilot Agent Mode',
        q: 'Which GitHub Copilot mode can autonomously determine which files to modify and run commands while completing a development task?',
        o: ['Agent mode', 'Ask mode', 'Edit mode', 'Plan mode'],
        c: 0,
      },
      {
        t: 'Copilot Context',
        q: 'In Visual Studio Code, which context variable can you use to explicitly reference a specific file in a Copilot Chat prompt?',
        o: ['#codebase', '#selection', '#file', '#terminal'],
        c: 2,
      },
      {
        t: 'Copilot Custom Instructions',
        q: 'Which repository file can provide repository-wide custom instructions to GitHub Copilot?',
        o: ['.github/instructions.md', '.github/README.md', '.github/copilot.md', '.github/copilot-instructions.md'],
        c: 3,
      },
      {
        t: 'Copilot Custom Agents',
        q: 'In which repository directory are repository-level GitHub Copilot custom agent profile files stored?',
        o: ['.github/instructions/', '.github/agents/', '.github/prompts/', '.github/workflows/'],
        c: 1,
      },
      {
        t: 'Copilot Custom Agents',
        q: 'What file extension is used for a GitHub Copilot custom agent profile?',
        o: ['.agent.md', '.prompt.md', '.instructions.md', '.copilot.md'],
        c: 0,
      },
      {
        t: 'Copilot Code Review',
        q: 'Which GitHub Copilot capability can review pull requests and suggest code changes?',
        o: ['Code scanning', 'Dependabot alerts', 'GitHub Copilot code review', 'GitHub Copilot Spaces'],
        c: 2,
      },
      {
        t: 'Copilot Code Review',
        q: 'By default, does a GitHub Copilot code review count as an approval toward required pull request approvals?',
        o: [
          'Yes. It submits an Approve review when it finds no issues.',
          'No. By default, Copilot leaves a Comment review rather than an Approve review.',
          'Yes. Its comments automatically satisfy one required approval.',
          'Yes. It is recorded as the pull request author’s approval.',
        ],
        c: 1,
      },
      {
        t: 'Copilot and MCP',
        q: 'What does MCP stand for when used to extend GitHub Copilot with external tools and services?',
        o: ['Model Control Pipeline', 'Managed Copilot Platform', 'Machine Context Provider', 'Model Context Protocol'],
        c: 3,
      },
      {
        t: 'Copilot and MCP',
        q: 'Which two MCP servers are configured by default for GitHub Copilot cloud agent?',
        o: [
          'GitHub MCP server and Playwright MCP server',
          'GitHub MCP server and Azure MCP server',
          'Playwright MCP server and Slack MCP server',
          'GitHub MCP server and Postman MCP server',
        ],
        c: 0,
      },
      {
        t: 'Copilot CLI',
        q: 'Which slash command can be used to authenticate from GitHub Copilot CLI when you are not already signed in?',
        o: ['/auth', '/signin', '/login', '/connect'],
        c: 2,
      },
      {
        t: 'Copilot Model Selection',
        q: 'What GitHub Copilot feature automatically routes a task to an appropriate supported AI model based on factors such as task complexity and model availability?',
        o: ['Manual model picker', 'Auto model selection', 'Agent mode', 'GitHub Copilot Spaces'],
        c: 1,
      },
      {
        t: 'Copilot Cloud Agent',
        q: 'What type of development environment does GitHub Copilot cloud agent use when working on a coding task?',
        o: [
          'The requester’s local IDE and terminal, controlled remotely.',
          'A permanent shared server reused across all repository tasks.',
          'The production server where the application is deployed.',
          'An ephemeral development environment powered by GitHub Actions.',
        ],
        c: 3,
      },
    ],
  },
  'batch-4': {
    id: 'batch-4',
    label: 'Batch 4',
    brand: 'github',
    tags: ['GitHub Copilot', 'Copilot Spaces', 'Copilot Memory'],
    questions: [
      {
        t: 'Copilot Spaces',
        q: 'What GitHub Copilot feature lets you organize repositories, files, issues, pull requests, and other relevant content into a curated context for Copilot?',
        o: ['GitHub Copilot Memory', 'GitHub Copilot Spaces', 'GitHub Copilot code review', 'GitHub Copilot custom instructions'],
        c: 1,
      },
      {
        t: 'Copilot Spaces',
        q: 'What are the two main types of context you can add when creating a GitHub Copilot Space?',
        o: ['Prompts and completions', 'Branches and tags', 'Tests and coverage reports', 'Instructions and sources'],
        c: 3,
      },
      {
        t: 'Copilot Spaces',
        q: 'When GitHub files added to a Copilot Space change, does the Space require you to manually upload the latest versions?',
        o: [
          'No. GitHub-based sources added to a Space are automatically updated as they change.',
          'Yes. You must re-upload each file after every change.',
          'Yes. You must rebuild the Space whenever a repository file changes.',
          'Yes. You must replace the GitHub link with a static file upload.',
        ],
        c: 0,
      },
      {
        t: 'Copilot Memory',
        q: 'What GitHub Copilot feature can remember useful facts about repositories and personal coding preferences across interactions?',
        o: ['GitHub Copilot Spaces', 'GitHub Copilot code review', 'GitHub Copilot Memory', 'GitHub Copilot prompt files'],
        c: 2,
      },
      {
        t: 'Copilot Memory',
        q: 'What are the two types of information that GitHub Copilot Memory can store?',
        o: [
          'Repository-level secrets and organization-level tokens',
          'Repository-level facts and user-level preferences',
          'Pull request approvals and branch protection rules',
          'CI logs and production database records',
        ],
        c: 1,
      },
      {
        t: 'Copilot Memory',
        q: 'Name two examples of repository-level information that Copilot Memory can retain.',
        o: [
          'Examples include a user’s browser theme, notification settings, and personal calendar.',
          'Examples include short-lived login tokens, API keys, and account passwords.',
          'Examples include live server CPU usage, memory pressure, and request latency.',
          'Examples include coding conventions, architectural decisions, build commands, and project-specific rules.',
        ],
        c: 3,
      },
      {
        t: 'Copilot Custom Instructions',
        q: 'Where are path-specific GitHub Copilot custom instruction files stored in a repository?',
        o: ['.github/instructions/', '.github/agents/', '.github/prompts/', '.github/workflows/'],
        c: 0,
      },
      {
        t: 'Copilot Custom Instructions',
        q: 'What filename pattern is used for path-specific GitHub Copilot instruction files?',
        o: ['NAME.agent.md', 'NAME.prompt.md', 'NAME.instructions.md', 'NAME.copilot.md'],
        c: 2,
      },
      {
        t: 'Copilot Prompt Files',
        q: 'Which GitHub Copilot customization feature provides reusable prompt templates for focused, repeatable tasks?',
        o: ['GitHub Copilot Memory', 'Prompt files', 'GitHub Copilot Spaces', 'Custom instructions'],
        c: 1,
      },
      {
        t: 'Copilot Prompt Files',
        q: 'Where are repository-level GitHub Copilot prompt files stored?',
        o: ['.github/instructions/', '.github/agents/', '.github/workflows/', '.github/prompts/'],
        c: 3,
      },
      {
        t: 'Copilot CLI',
        q: 'Which GitHub Copilot CLI mode creates a structured implementation plan before writing code?',
        o: ['Plan mode', 'Agent mode', 'Ask mode', 'Edit mode'],
        c: 0,
      },
      {
        t: 'Copilot Cloud Agent',
        q: 'While working on a coding task, where does GitHub Copilot cloud agent make and test its changes?',
        o: [
          'In the requester’s local IDE and terminal, controlled remotely.',
          'Directly on the production server hosting the application.',
          'In its own ephemeral development environment powered by GitHub Actions.',
          'In an unisolated directory on the requester’s laptop.',
        ],
        c: 2,
      },
    ],
  },
};

const BATCHES = normalizeBatches(RAW_BATCHES);

module.exports = {
  BATCHES,
  BRANDS,
  LIMITS,
  generateBatchId,
  normalizeQuestion,
  validateQuestion,
  normalizeBatch,
  validateBatch,
  normalizeBatches,
};
