# Lab 7: Responsible AI + Model Governance — Claims Triage Assistant

## Objective

Apply responsible AI governance controls when building an AI-assisted feature for healthcare. Evaluate model fitness, define guardrails, build a governance decision record, and simulate incident response.

**Use Case:** The team is evaluating an AI-powered claims triage assistant that reads claim details and suggests next actions (approve, flag for review, request additional documentation). This involves PHI, clinical data, and automated decision-making — all of which require governance controls.

## Prerequisites

- Completion of Lab 6
- Understanding of the member portal domain (claims, PHI)
- Access to organization policy references or willingness to define them
- Copilot Chat available

## Step-by-step Instructions

### Step 1: Define the Use Case Boundaries

In Copilot Chat:

```
Help me define boundaries for an AI claims triage assistant in a healthcare (HIPAA-regulated) environment. Structure the output as:

1. Allowed inputs (what data the model CAN see)
2. Prohibited inputs (what data MUST NOT be sent to the model)
3. Decision criticality (what happens if the model is wrong)
4. Human-in-the-loop requirements (when must a human review)
5. Data residency requirements (where can data be processed)
```

**Expected boundaries:**

| Category | Decision |
|---|---|
| Allowed inputs | Claim amount, procedure code, provider type, member plan tier |
| Prohibited inputs | Member name, SSN, full DOB, diagnosis narrative, clinical notes |
| Decision criticality | HIGH — incorrect triage delays care or causes financial harm |
| Human-in-the-loop | Required for all denials; required for claims > $5,000 |
| Data residency | US-only processing; no cross-border data transfer |

### Step 2: Build Model Evaluation Matrix

Compare candidate models for the claims triage task:

```
Create a model evaluation matrix for a claims triage AI assistant. Compare these options:
1. Azure OpenAI GPT-4o (Microsoft-hosted, US region)
2. Third-party vendor "ClaimsAI Pro" (SaaS, data leaves org)
3. Fine-tuned open-source model (self-hosted on Azure)

Evaluate on: capability fit, data residency/privacy, security controls, HIPAA BAA coverage, auditability, cost, latency, and ability to enforce guardrails.
```

**Expected output:** Matrix with clear recommendation and rationale.

### Step 3: Run Risk Assessment

```
Perform a responsible AI risk assessment for the claims triage assistant. Cover:
1. Bias risk — could the model treat certain demographics differently?
2. Hallucination risk — could the model invent claim details or codes?
3. PHI leakage risk — could prompt/response contain PHI that gets logged?
4. Fairness risk — could certain plan types or providers be systematically disadvantaged?
5. Transparency risk — can we explain why a claim was flagged?

For each risk, rate likelihood (L/M/H), impact (L/M/H), and define a mitigation.
```

### Step 4: Define Guardrails

```
Define technical guardrails for the claims triage AI assistant:

1. Input guardrails (what gets filtered before the model sees it)
2. Output guardrails (what gets filtered before the user sees the result)
3. Prompt guardrails (system prompt constraints)
4. Logging rules (what can/cannot be logged)
5. Human-in-the-loop checkpoints (when to escalate)
6. Rate limiting (prevent abuse)

Format as a checklist the team can implement.
```

**Expected guardrails:**
- **Input:** Strip member names, SSN, full DOB before model invocation. Replace with anonymized tokens.
- **Output:** Block any response containing PII patterns (SSN regex, full names). Replace with `[REDACTED]`.
- **Prompt:** System prompt includes "Never output member names, SSN, or specific diagnosis details."
- **Logging:** Log only: claim ID, triage decision, confidence score, model version. Never log prompt/response content.
- **HITL:** All deny decisions require human review. Claims > $5K require human review.

### Step 5: Create Governance Decision Record

```
Create a governance decision record for the claims triage AI assistant. Use this template:

- Feature name
- Model selected (with rationale)
- Data classification of inputs/outputs
- Guardrails implemented
- Risks accepted (with owner)
- Risks mitigated (with control description)
- Approval status: APPROVED / CONDITIONAL / REJECTED
- Conditions for approval (if conditional)
- Review cadence (when to re-evaluate)
- Sign-off: [names and dates]
```

### Step 6: Simulate an Incident

```
Simulate this incident scenario for the claims triage assistant:

Scenario: A member reports receiving a letter saying their claim was denied. Upon investigation, the AI triage assistant incorrectly flagged the claim for denial based on a procedure code mismatch — but the mismatch was caused by a known data quality issue in the upstream claims feed.

Define:
1. Detection: How is this discovered?
2. Impact assessment: Who is affected? What's the blast radius?
3. Immediate response: What actions happen in the first hour?
4. Root cause: What failed?
5. Remediation: Short-term and long-term fixes
6. Communication: What goes to the member? To leadership?
7. Prevention: What changes prevent recurrence?
```

### Step 7: Define Re-certification Criteria

```
Define quarterly re-certification criteria for the claims triage AI model:
1. Performance metrics to check (accuracy, false positive/negative rates)
2. Bias audits to run (demographic parity, equal opportunity)
3. Data drift indicators (input distribution shift)
4. Policy changes to incorporate (new regulations, updated PHI rules)
5. Incident review (any incidents since last certification)
6. Go/no-go decision criteria for continued operation
```

## Exit Criteria

- [ ] Use case boundaries document completed (allowed/prohibited inputs, criticality, HITL rules)
- [ ] Model evaluation matrix compares at least 3 options with clear recommendation
- [ ] Risk assessment covers bias, hallucination, PHI leakage, fairness, and transparency
- [ ] Technical guardrails checklist is implementable (input/output/prompt/logging)
- [ ] Governance decision record is completed with approval status
- [ ] Incident simulation defines detection through prevention
- [ ] Re-certification criteria define ongoing governance cadence
- [ ] Team can articulate why the selected model was chosen over alternatives

## Time Budget

| Phase | Time | Notes |
|---|---|---|
| Use case boundaries | 5 min | Critical framing — everything follows from this |
| Model evaluation matrix | 10 min | Don't skip security/compliance columns |
| Risk assessment | 10 min | Focus on healthcare-specific risks |
| Guardrails | 10 min | Make these implementable, not aspirational |
| Governance decision record | 10 min | This is the artifact that gets signed off |
| Incident simulation | 10 min | Make it realistic — data quality issues are common |
| Re-certification | 5 min | Define the cadence, not just the criteria |

**The lesson:** In healthcare AI, "it works" is never sufficient. Governance is not paperwork — it's the control system that prevents a model from harming patients or leaking their data. Build governance in from the start, not after the incident.
