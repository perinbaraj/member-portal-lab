# Live quiz: event hosting

A multi-host Node.js and Socket.IO quiz. Every host sign-in creates an isolated competition with its own players, settings, scores, HTTPS player link, and QR code. Session state is persisted in Cosmos DB for 24 hours after its latest activity, so a browser refresh or App Service restart can resume the same competition.

## Current Azure event deployment

| Item | Value |
| --- | --- |
| Subscription | `ea8de45a-97c7-4e6c-81f1-6cae597e83bb` |
| Region | Central India |
| Resource group | `rg-livequiz-ci-c4e71a903d` |
| App Service plan | `asp-livequiz-ci-c4e71a903d` (Linux Basic B1, one worker) |
| Player link | Generated after host sign-in (`/play?session=<session-id>`) |
| Host link | https://solution-engineer-quiz.azurewebsites.net/ |
| Health endpoint | https://solution-engineer-quiz.azurewebsites.net/healthz |

The current deployment uses Node.js 24 LTS, HTTPS-only, Always On, an App Service health check, Cosmos DB for durable quiz sessions, custom batches, feedback, and host-domain settings, Application Insights, private Cosmos connectivity through a VNet, and Azure Communication Services Email for host access codes. Host controls require a one-time code sent to an exact email address on an administrator-approved domain. `github.com` and `microsoft.com` are protected defaults; administrators can add partner domains. Do not share the host URL as a player link; share only the session-specific link or QR generated after sign-in.

The web app is named `solution-engineer-quiz`, so the deployment URL is `https://solution-engineer-quiz.azurewebsites.net`. That root URL serves the host page directly; `/host.html` still works. Because the name has no uniqueness suffix, `scripts\deploy.ps1` fails with a clear message if the hostname is already taken globally. Renaming creates a new web app rather than renaming an existing one, so tear down any superseded deployment separately.

On 29 September 2026, the four built-in batches passed a full Socket.IO test with 120 simultaneous players plus one host. Treat those results as workload measurements, not an availability guarantee. Monitor CPU, memory, and disconnects during events. Increase the single worker's size and retest if necessary rather than adding workers. Custom batches should be load-tested separately when they materially differ from the built-in content.

## Host controls and game flow

Sign in on the host page with an exact work email on an allowed domain. Verifying the six-digit code creates a new isolated quiz session. Refreshing or reconnecting the same browser resumes that session with a separate host-control token; another host login creates a different competition. Choose **GitHub** or **Microsoft**, select a batch, set a whole-number question duration from 10 to 120 seconds, and independently choose whether player phones show the question text and answer choices. A batch must be selected for every game, including after **Play again**. The host toolbar also provides an explicit **Logout** button that removes control access and clears the saved host token without expiring the quiz session.

The host and player screens show the server-enforced countdown. A question is revealed when time expires, every connected player answers, or the host selects **Reveal now**.

### Share the player link and present cleanly

The lobby shows a join QR code and player link unique to that host session. Players using a missing, invalid, or expired session link cannot enter another competition. **Download QR** saves a high-resolution, print-friendly black-on-white PNG as `solution-engineer-quiz-join-qr.png`, **Copy join link** copies the player URL, and **Show large QR** opens a full-window QR for projecting.

**Full screen** in the header toggles a presentation view for screen sharing. While presenting, the setup controls (brand chooser, batch selector, timer, and batch management buttons) are hidden, and the QR code, join link, player list, and game actions stay visible. The toggle tracks the browser's own full-screen changes, so leaving full screen with `Escape` or `F11` restores the setup controls.

The compact batch toolbar sits with the batch selector: **+ New batch** starts a custom batch, **Preview** uses an eye icon to inspect the selected batch, and **Edit** uses a pencil icon to open it for changes. The visible labels remain for clarity and accessibility. Built-in and legacy shared batches are read-only; save a new custom copy to change them. New custom batches are private to the host identity that created them and are persisted in Cosmos DB on Azure or `data\quiz-content.json` locally. The former Saved drafts workflow has been removed.

### Feedback

Hosts and players can open **Feedback** from their respective interfaces. The dedicated neutral page collects a required 1–5 rating, category, comments, and an optional contact email. When opened from an active quiz, it also sends the session ID and role; the server resolves safe context such as brand and phase rather than trusting client-supplied context.

`POST /api/feedback` accepts same-origin JSON, validates field values and lengths, limits request bodies to 16 KB, and throttles accepted submissions per client address. Feedback is stored as separate `feedback` documents in the existing Cosmos content container or `data\feedback.json` locally. IP addresses, OTPs, host resume tokens, player reconnect tokens, player names, scores, answers, and other authentication data are not stored with feedback.

## Administration dashboard

Open `/admin.html` directly; it is intentionally not linked from the public host or player pages. The dashboard requires the deployment-managed `ADMIN_PASSPHRASE` plus an operator name. A successful sign-in creates an eight-hour server-side session using an `HttpOnly`, `SameSite=Strict` cookie. State-changing requests also require a session-bound CSRF token, and failed admin sign-ins are rate-limited.

The complete v1 dashboard provides:

- **Overview** — connected hosts, active sessions by phase, connected/total participants, new feedback, active support codes, and recent issues.
- **Hosts and sessions** — host identity/email, connection state, selected batch, phase, question progress, player counts, activity, expiry, and session-specific join URL.
- **Participants** — names, scores, connection state, and join/last-seen timestamps. Individual answers and correctness are never exposed.
- **Logs** — 90 days of host authentication, session transitions, participant activity, feedback, exports, and administrative actions.
- **Host domains** — protected GitHub/Microsoft defaults plus durable partner domains that administrators can add or remove. Matching is exact; allowing `partner.com` does not allow `sub.partner.com`. Removal blocks new authentication and code generation but leaves active quiz sessions running.
- **Access codes** — a one-time six-digit host code tied to an exact allowed email. The admin can keep the default 10-minute lifetime or choose 1–1440 whole minutes. Only a salted digest is stored; the code is displayed to the admin once.
- **Feedback** — contact/context details plus `new`, `reviewed`, and `resolved` moderation state and internal notes.
- **Exports** — sanitized CSV or JSON for sessions, participants, logs, and feedback. CSV cells are protected against spreadsheet formula injection.

Resetting a session, disconnecting a participant, and expiring a session require a reason and explicit confirmation. Every action and export is durably audited with the operator-supplied name. No admin response, log, or export includes shared secrets, OTPs, manual-code plaintext, cookies, CSRF values, host/player resume tokens, socket IDs, secret hashes, or individual answers.

The shared secret is one authorization boundary, not independently attributable SSO. Operator names improve audit readability but are self-declared. Use a long unique secret, distribute it outside the app, rotate it after personnel changes or suspected disclosure, and prefer Entra group authentication in a future identity upgrade.

### Prepare questions with any AI tool

Select **New batch**, enter a label and tags, then choose **Prepare prompt and paste questions**. Pick the question count and add optional guidance. The host page creates a ready-made prompt that requests the exact plain-text format accepted by the importer.

Choose **General topic or guidance** for the existing provider-neutral prompt. To create a quiz from a presentation, choose **Microsoft 365 Copilot + slide deck**, open or attach the PowerPoint presentation in Microsoft 365 Copilot, and use **Copy prompt**. That prompt tells Copilot to use the deck as its sole factual source and return the exact plain-text format accepted by the importer. Paste the response back into the host page. The quiz application does not upload the presentation or send batch details to an AI service. The complete response is validated before import, and imported questions open in the editor for review and correction before saving.

## Create a custom batch

Select **New batch**, enter a label and comma-separated tags, prepare and copy the provided prompt, then paste the generated plain-text questions. Imported questions open in the editor where topics, prompts, options, correct answers, and optional explanations can be reviewed and changed.

The paste importer accepts 1 to 50 questions. Every question must contain exactly four distinct options, one answer line, a prompt of at most 500 characters, and options of at most 300 characters. The complete paste is validated before anything is imported; an invalid block does not produce a partial batch.

### Labeled paste format

```text
Question: Which command creates a Git branch?
A: git add
B: git branch
C: git merge
D: git clone
Answer: B
```

`Correct:` can replace `Answer:`. The answer can be the letter `A` through `D`, the number `1` through `4`, or the exact text of one unique option. Labels may include surrounding whitespace and Markdown bold markers.

### Numbered paste format

```text
1. Which command creates a Git branch?
1. git add
2. git branch
3. git merge
4. git clone
Correct: 2
```

After import, review and edit every field in the manual editor. Select **Review batch**, verify the correct choices, and then select **Create and select batch**. The server validates creates and updates again, so malformed or oversized payloads are rejected without changing the catalog.

`Batch-1.txt` through `Batch-4.txt` are the authoring sources for the built-in GitHub batches. The running quiz uses their normalized content in `questions.js`; changing a text source alone does not change the application. Update `questions.js`, verify the correct choices, run `npm test`, and redeploy when revising built-in content.

## Host authentication

The server checks the normalized email domain exactly against the durable admin-managed allowlist before creating, sending, or redeeming a code. Addresses on other domains, unlisted subdomains such as `user@sub.microsoft.com`, and suffix tricks such as `user@microsoft.com.example` are rejected without sending email. `HOST_ALLOWED_EMAIL_DOMAINS` can seed additional partner domains on first initialization; later admin changes are stored in Cosmos DB or `data\host-domains.json` and survive restarts.

Access codes are generated with cryptographic randomness, stored only as digests, expire after 10 minutes, can be used once, and are invalidated after five incorrect attempts. Resends have a 60-second cooldown. Requests are limited to five per email address and 20 per client IP in a one-hour window. Challenge and throttle state is in memory, which matches the required single-worker deployment; move it to shared storage before scaling to multiple workers.

If email delivery is unavailable, an authenticated administrator can generate a separate single-use code for the exact host email. The host selects **Use admin-provided code**, enters that email and code, and receives a normal isolated host session after successful redemption. Manual codes are durable across app restarts, use the admin-selected 1–1440 minute lifetime (10 minutes by default), are limited to five attempts, and do not replace or reveal emailed OTP challenges.

After verification, the server creates a random public session ID and a separate random host-resume token. Only token hashes are persisted. Quiz sessions expire after 24 hours of inactivity. This flow verifies control of an allowed mailbox; it does not provide Entra tenant claims, employment status, group/role authorization, centralized session revocation, or SSO.

The legacy passphrase is an emergency automation fallback only. It is disabled by default and is accepted only when both `ALLOW_LEGACY_HOST_PASSPHRASE=1` and a valid `HOST_PASSPHRASE` are configured. The browser UI never offers passphrase login.

## Run and test locally

From `C:\Users\pthangavel\Downloads\live-quiz`, use Node.js 24 LTS or newer:

```powershell
npm ci
$env:NODE_ENV = 'development'
$env:HOST_EMAIL_MODE = 'capture'
$env:ALLOW_HOST_EMAIL_CAPTURE = '1'
npm start
# In another shell:
npm test
```

Capture mode accepts allowed email requests without delivering mail and is intended only for local UI development; it does not expose the OTP in the browser. Automated tests use an isolated capture hook and receive the code only in test responses. To exercise real delivery locally, set `HOST_EMAIL_MODE=acs`, `HOST_EMAIL_ENDPOINT`, and `HOST_EMAIL_SENDER`, then sign in with Azure credentials that can access the Communication Services resource.

The local server defaults to port 4000. Set `PORT` and `PUBLIC_BASE_URL` when using another port. Production requires an HTTPS `PUBLIC_BASE_URL`; local development may use an HTTP loopback origin.

## Redeploy or create an event deployment

The deployment script provisions a dedicated Communication Services resource, Email Communication Service, and Azure-managed sender domain. It links the domain, grants the web app managed identity access at the Communication Services resource scope, and configures the ACS endpoint and generated `donotreply@...azurecomm.net` sender without storing an ACS access key.

```powershell
& 'C:\Users\pthangavel\Downloads\live-quiz\scripts\deploy.ps1' `
    -NameSuffix '36babfd2c3' `
    -Subscription 'ea8de45a-97c7-4e6c-81f1-6cae597e83bb'
```

The first ACS command installs the Azure CLI `communication` extension if it is not already present. The signed-in operator needs permission to register `Microsoft.Communication`, create the communication resources, link the email domain, and assign the web app identity at the Communication Services resource scope. Azure-managed domains can take time to reach `Succeeded`; rerun after provisioning completes if the script reports that the domain is not ready.

Rerunning with the existing suffix updates that deployment and keeps its URL. Active sessions and custom batches remain in Cosmos DB; connected browsers reconnect and resume with their saved tokens after the app returns. Omitting `-NameSuffix` creates a new dedicated resource group, App Service plan, web app, Cosmos account, Application Insights resource, Communication Services resources, VNet, and private endpoint.

To enable the emergency fallback for smoke/load automation, set both variables only for the deployment process:

```powershell
$env:ALLOW_LEGACY_HOST_PASSPHRASE = '1'
$env:HOST_PASSPHRASE = '<strong 16+-character emergency passphrase>'
try {
    & 'C:\Users\pthangavel\Downloads\live-quiz\scripts\deploy.ps1' -NameSuffix '36babfd2c3'
} finally {
    Remove-Item Env:ALLOW_LEGACY_HOST_PASSPHRASE -ErrorAction SilentlyContinue
    Remove-Item Env:HOST_PASSPHRASE -ErrorAction SilentlyContinue
}
```

The first admin-dashboard deployment also requires a strong admin passphrase supplied only to the deployment process. Later deployments preserve the existing App Service setting when this variable is omitted:

```powershell
$env:ADMIN_PASSPHRASE = '<unique 20+-character secret with at least three character classes>'
try {
    & 'C:\Users\pthangavel\Downloads\live-quiz\scripts\deploy.ps1' -NameSuffix 'c4e71a903d'
} finally {
    Remove-Item Env:ADMIN_PASSPHRASE -ErrorAction SilentlyContinue
}
```

The deployment configures eight-hour admin sessions, five sign-in attempts per 15 minutes, 10-minute host support codes, five code attempts, 90-day audit retention, and Cosmos per-item TTL support. Existing batch, session, revision, and feedback documents do not receive a TTL and are not automatically deleted by this setting.

The script installs production dependencies locally, packages them with the server modules and `public\`, configures the single-worker Node.js app, creates the Cosmos database and content container, enables managed identity and private networking, and verifies HTTPS health and the host page. If provisioning fails after resource creation, inspect the named resource group because billable resources may remain.

Before inviting players, visit `/healthz`, open both links, request and verify a real host email code, verify the QR points to the HTTPS player link, create or select a batch, and join from a second browser or device. The automation below requires the explicitly enabled emergency fallback. It creates and selects a deterministic custom batch:

```powershell
$env:SMOKE_BASE_URL = 'https://solution-engineer-quiz.azurewebsites.net'
$env:HOST_PASSPHRASE = '<host passphrase>'
node .\scripts\smoke-live.js
```

The load harness also requires the explicitly enabled emergency fallback. It runs a complete game and must not be used during a live event:

```powershell
$env:BASE_URL = 'https://solution-engineer-quiz.azurewebsites.net'
$env:HOST_PASSPHRASE = '<host passphrase>'
node .\scripts\load-test.js --batch batch-4 --duration 120 --players 120 `
    --sustain-ms 30000 --timeout-ms 15000 --max-p95-ms 1000
```

### 100-user performance test case

Use this acceptance scenario for any environment where the app is expected to support at least 100 concurrent users:

1. Start a disposable quiz session using the emergency passphrase flow only.
2. Select a known-good built-in batch (`batch-1` through `batch-4`) and set a realistic question duration (20–120 seconds).
3. Connect 100 player sockets with unique names and confirm every socket remains connected for the full pre-question sustain window.
4. Start the first round and confirm all 100 players receive the same question payload, while only the host sees the answer options.
5. Submit answers for all players and validate that the host and each player receive the reveal result with the expected score and rank data.
6. Require zero unexpected disconnects, zero HTTP 5xx responses, and a p95 answer acknowledgement time below the configured threshold.

The repository now includes an automated version of this scenario in `tests/integration.test.js` and it is included in the normal `npm test` suite. The hosted harness targets the built-in 12-question batches; materially different custom batches need an equivalent purpose-built test.

## GitHub Actions CI/CD Deployment

The repository includes a GitHub Actions pipeline (`.github/workflows/deploy.yml`) that automates testing, production bundle packaging (including `node_modules.tar.gz` for App Service startup), zero-downtime deployment, and post-deploy health validation.

### Workflow triggers
- **Push to `main`**: Automatically runs unit and integration tests, builds release package, and deploys to Azure App Service.
- **Pull Request to `main`**: Runs unit and integration tests and validates build artifacts without deploying.
- **Manual (`workflow_dispatch`)**: Allows manual deployment with optional custom target web app name (`webapp_name`) and test toggles.

### Setting up repository secrets
The pipeline supports two authentication methods:

1. **Publish Profile (Quickest setup)**:
   Retrieve the publish profile XML from Azure and add it as a repository secret:
   ```powershell
   az webapp deployment list-publishing-profiles `
       --name solution-engineer-quiz `
       --resource-group rg-livequiz-ci-c4e71a903d `
       --xml | Set-Clipboard
   ```
   Save the XML into GitHub repository secret: `AZURE_WEBAPP_PUBLISH_PROFILE`.

2. **OpenID Connect / Workload Identity (Recommended enterprise standard)**:
   Configure federated credentials in Azure AD for the repository, and set:
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID` (`ea8de45a-97c7-4e6c-81f1-6cae597e83bb`)

## Cost and event teardown

The Azure deployment includes billable App Service, Cosmos DB, Application Insights, networking, storage/backup, and outbound traffic. A stopped web app still incurs App Service plan charges.

Teardown is a separate, irreversible operator action. Verify that the dedicated resource group contains only the expected quiz resources and do not run teardown during an active event:

```powershell
& 'C:\Users\pthangavel\Downloads\live-quiz\scripts\teardown.ps1' `
    -NameSuffix '36babfd2c3' `
    -ResourceGroupName 'rg-livequiz-ci-36babfd2c3' `
    -ConfirmResourceGroupName 'rg-livequiz-ci-36babfd2c3' `
    -Subscription 'ea8de45a-97c7-4e6c-81f1-6cae597e83bb'
```

The teardown script removes only the explicitly named resource group after separate operator authorization. If authorization, quota, policy, DNS, or Azure availability blocks provisioning, resolve the reported error in the named subscription rather than silently switching subscription or region.
