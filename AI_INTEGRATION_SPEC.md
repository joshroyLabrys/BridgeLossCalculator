# AI Financial Dashboard Integration Spec

> Complete technical specification for integrating an LLM-powered financial analysis and chat system into a dashboard application. This covers the full data flow: dashboard data collection, LLM request construction, response parsing, and UI rendering.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Authentication & Client Setup](#3-authentication--client-setup)
4. [Data Collection Pipeline](#4-data-collection-pipeline)
5. [AI Analysis Pipeline (Structured JSON)](#5-ai-analysis-pipeline-structured-json)
6. [AI Chat (Streaming Text)](#6-ai-chat-streaming-text)
7. [Prompt Engineering](#7-prompt-engineering)
8. [Response Schemas](#8-response-schemas)
9. [Frontend: Consuming Analysis Results](#9-frontend-consuming-analysis-results)
10. [Frontend: Streaming Chat](#10-frontend-streaming-chat)
11. [Error Handling & Resilience](#11-error-handling--resilience)
12. [Common Integration Issues & Fixes](#12-common-integration-issues--fixes)

---

## 1. Architecture Overview

```
                    User clicks "Run Analysis" or sends chat message
                                       |
                                       v
                    +-----------------------------------------+
                    |         Next.js API Routes              |
                    |  POST /api/ai/analyze  (structured)     |
                    |  POST /api/ai/chat     (streaming)      |
                    +-----------------------------------------+
                                       |
                          +------------+-------------+
                          |                          |
                          v                          v
                 GET /api/ai/gather-data      DB: latest analysis
                 (aggregates all sources)     (for chat continuity)
                          |
            +-------------+-------------+
            |             |             |
            v             v             v
        [Xero]      [Pipedrive]    [Toggl Track]
       Financials     Pipeline     Time Entries
            |             |             |
            +------+------+------+-----+
                   |
                   v
          Exclusions, Filters, FY Summaries
                   |
                   v
          Gathered Data Object (JSON)
                   |
          +--------+---------+
          |                  |
          v                  v
    Analysis Mode        Chat Mode
    (3-step pipeline)    (streaming)
          |                  |
          v                  v
    System + User        System prompt
    prompts with         embeds ALL data
    JSON schema          + conversation
          |                  |
          v                  v
    OpenAI API           OpenAI API
    (non-streaming)      (streaming)
          |                  |
          v                  v
    Parse JSON           Stream chunks
    Store in DB          via ReadableStream
          |                  |
          v                  v
    GET /api/ai/results  Frontend decoder
    (retrieve later)     (real-time UI)
          |                  |
          v                  v
    Score Gauge          Chat Messages
    Risk Cards           with Markdown
    Charts               Rendering
    Action Items
```

**Two modes of AI interaction:**

| Mode | Endpoint | Response Type | Use Case |
|------|----------|--------------|----------|
| **Analysis** | `POST /api/ai/analyze` | Complete JSON | Dashboard: scores, risks, charts, actions |
| **Chat** | `POST /api/ai/chat` | Streaming text | Conversational Q&A, what-if simulations |

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router) | API routes + React frontend |
| LLM SDK | `openai` npm package (^6.27.0) | OpenAI API client |
| Model | `gpt-5.4` | LLM for analysis and chat |
| Database | SQLite via `drizzle-orm` + `@libsql/client` | Store analysis results, financial data |
| Charts | `recharts` | Score gauges, runway/forecast charts |
| Animation | `framer-motion` | Chat message transitions |

---

## 3. Authentication & Client Setup

The system supports **two authentication paths** with automatic detection.

### Option A: Standard OpenAI API Key (Recommended for integration)

Set the environment variable:

```bash
# .env.local
OPENAI_API_KEY=sk-proj-...your-key...
```

This routes requests to `api.openai.com` using the **Chat Completions API**.

### Option B: Codex OAuth Token

```bash
# .env.local
OPENAI_OAUTH_TOKEN=your-codex-oauth-token
# Optional: for multi-account setups
OPENAI_CHATGPT_ACCOUNT_ID=your-account-id
```

This routes requests to `chatgpt.com/backend-api/codex` using the **Responses API** with special headers.

### Client Initialization Code

```typescript
import OpenAI from "openai";

// --- Option A: Standard API Key ---
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Option B: Codex OAuth ---
const client = new OpenAI({
  apiKey: process.env.OPENAI_OAUTH_TOKEN,
  baseURL: "https://chatgpt.com/backend-api/codex",
  defaultHeaders: {
    version: "0.80.0",
    "x-codex-beta-features": "unified_exec,shell_snapshot",
    originator: "codex_exec",
    // Include if multi-account:
    // "chatgpt-account-id": process.env.OPENAI_CHATGPT_ACCOUNT_ID,
  },
});
```

### Auth Resolution Priority

The app checks credentials in this order and uses the first one found:

1. `OPENAI_API_KEY` env var -> Platform API
2. `OPENAI_OAUTH_TOKEN` env var -> Codex backend
3. `~/.codex/auth.json` file -> Codex backend

### Credential Validation

```typescript
function hasCredentials(): boolean {
  return !!(
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_OAUTH_TOKEN ||
    readCodexAuthFile()  // checks ~/.codex/auth.json
  );
}
```

### Timeout Configuration

Analysis requests can take 30-60 seconds for complex financial data. The timeout is set to **120 seconds**:

```typescript
const TIMEOUT_MS = 120_000;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
```

For Vercel deployments, set the route config:

```typescript
export const maxDuration = 120;
```

---

## 4. Data Collection Pipeline

Before any AI request, all financial data is aggregated into a single JSON object via `GET /api/ai/gather-data`.

### Data Sources

| Source | Data Type | Examples |
|--------|----------|---------|
| Xero (via `financialRecords` table) | P&L, Balance Sheet, AR, Invoices | Revenue, expenses, cash position, receivables |
| Pipedrive (via `deals` table) | CRM pipeline | Deal stages, values, probabilities, close dates |
| Toggl Track (via `timeEntries` table) | Team hours | Billable/non-billable hours, utilization |

### Gathered Data Shape

This is the exact JSON structure sent to the LLM:

```typescript
interface GatheredData {
  source: "live" | "mixed" | "sample";  // whether data is real or fallback
  configContext: {
    excludedAccounts: Array<{ type: string; value: string; entity: string }>;
    accountGroupings: Array<{ group: string; accounts: string[] }>;
    includedPipelines: string[];
    excludedPipelines: string[];
    connectedEntities: string[];  // Xero orgs
  };
  data: {
    // Temporal context
    currentPeriodContext: {
      today: string;            // "2026-03-27"
      currentMonth: string;     // "2026-03"
      dayOfMonth: number;       // 27
      daysInMonth: number;      // 31
      monthElapsedPct: number;  // 87
      isCurrentMonthPartial: true;
      lastCompletedMonth: string | null;  // "2026-02"
      note: string;  // Human-readable note about partial month
    };

    // Year-over-year (Australian FY: Jul-Jun)
    annualSummaries: Array<{
      label: string;           // "FY25/26 (YTD)"
      startMonth: string;      // "2025-07"
      endMonth: string;        // "2026-03"
      months: number;
      revenue: number;
      cogs: number;
      opex: number;
      grossProfit: number;
      netProfit: number;
      grossMargin: number;     // percentage
      netMargin: number;       // percentage
      avgMonthlyRevenue: number;
      avgMonthlyExpenses: number;
      openingCash: number | null;
      closingCash: number | null;
    }>;

    // Monthly data (up to 36 months)
    profitLoss: Array<{
      month: string;       // "2024-01"
      revenue: number;
      cogs: number;
      opex: number;
      grossProfit: number;
      netProfit: number;
    }>;

    cashFlow: Array<{
      month: string;
      inflow: number;
      outflow: number;
      balance: number;
    }>;

    // Snapshots
    expenseBreakdown: Array<{ category: string; amount: number }>;
    agingReceivables: Array<{ bucket: string; count: number; total: number }>;
    revenueByClient: Array<{ client: string; revenue: number }>;

    // KPIs
    kpis: {
      revenue: number;
      ytdRevenue: number;
      expenses: number;
      grossProfit: number;
      cashPosition: number;
      dso: number;
      arTotal: number;
      payablesDays: number;
      runway: number;
      revenueGrowthMoM: number;
      // ... additional computed metrics
    };

    // Pipeline (up to 40 deals)
    pipeline: Array<{ stage: string; count: number; value: number; probability: number }>;
    deals: Array<{
      title: string;
      value: number;
      stage: string;
      probability: number;
      closeDate: string;
    }>;
    dealsWonLost: Array<{ month: string; won: number; lost: number; value: number }>;

    // Team (up to 30 members)
    teamUtilization: Array<{
      name: string;
      billablePct: number;
      nonBillablePct: number;
      hours: number;
    }>;
    utilization: { billable: number; nonBillable: number };
    hoursByProject: Array<{ project: string; hours: number; billable: boolean }>;
  };
}
```

### Key Data Transformations

Before sending to the AI, the data is processed:

1. **Exclusion rules applied** — user-defined filters remove specific accounts or clients
2. **Intercompany transactions removed** — if multiple Xero entities are connected
3. **Pipeline filtering** — excluded pipelines are stripped out
4. **Account grouping** — individual accounts mapped to user-defined groups
5. **Array trimming** — P&L capped at 36 months, deals at 40, team at 30 (token efficiency)
6. **AR point-in-time** — only the latest receivables snapshot per entity is used
7. **Partial month flagging** — current month is flagged as incomplete with elapsed percentage

### How to Replicate Data Gathering

If you're building your own version, the critical pattern is:

```typescript
// 1. Load all raw data in parallel
const [financials, deals, timeEntries, exclusions, ...] = await Promise.all([
  db.select().from(financialRecords),
  db.select().from(deals),
  db.select().from(timeEntries),
  getExclusionRules(),
  // ... other tables
]);

// 2. Apply filters
const filtered = applyExclusions(financials, exclusions);

// 3. Run aggregation functions
const profitLoss = aggregateProfitLoss(filtered);
const cashFlow = aggregateCashFlow(filtered);
const kpis = aggregateKpis(profitLoss, cashFlow, ...);

// 4. Build temporal context
const currentPeriodContext = {
  today: format(new Date(), "yyyy-MM-dd"),
  currentMonth: format(new Date(), "yyyy-MM"),
  isCurrentMonthPartial: true,
  // ... tells the AI not to treat this month as complete
};

// 5. Trim for token budget
const trimArray = <T>(arr: T[], max: number) => arr.slice(-max);

// 6. Return gathered object
return { source, configContext, data: { profitLoss, cashFlow, kpis, ... } };
```

---

## 5. AI Analysis Pipeline (Structured JSON)

The analysis runs as a **three-step sequential pipeline**. Each step is an independent LLM call that can fail without blocking the others.

### Pipeline Flow

```
Step 1: Financial Health    Step 2: Pipeline & Growth
(P&L, cash, AR, expenses)  (deals, team, utilization)
        |                           |
        +----------+----------------+
                   |
                   v
          Step 3: Executive Summary
          (synthesizes steps 1 & 2)
```

### Making an Analysis Call

```typescript
// The core function that calls OpenAI
async function callOpenAI(opts: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<Record<string, unknown>> {

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);

  try {
    // --- Chat Completions API (standard API key) ---
    const response = await client.chat.completions.create(
      {
        model: "gpt-5.4",
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
        temperature: opts.temperature ?? 0.3,
        response_format: { type: "json_object" },  // CRITICAL: forces JSON output
      },
      { signal: controller.signal },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");
    return JSON.parse(content);

  } finally {
    clearTimeout(timer);
  }
}
```

**Key detail:** `response_format: { type: "json_object" }` is what forces the LLM to return valid JSON. Without this, the LLM may return markdown or prose.

### If Using Codex/Responses API Instead

```typescript
// Codex backend requires streaming even for "non-streaming" calls
const stream = await client.responses.create({
  model: "gpt-5.4",
  instructions: opts.systemPrompt,    // system prompt goes here, not in messages
  input: [{ role: "user", content: opts.userPrompt }],
  text: { format: { type: "json_object" } },  // different format param
  stream: true,
  store: false,
});

// Accumulate the streamed response
let accumulated = "";
for await (const event of stream) {
  if (event.type === "response.output_text.delta" && "delta" in event) {
    accumulated += event.delta;
  }
}

return JSON.parse(accumulated);
```

### Running the Three Steps

```typescript
export async function POST() {
  // 1. Gather all financial data
  const { source, data, configContext } = await fetch("/api/ai/gather-data").then(r => r.json());

  // 2. Create a DB record (status: "processing")
  const [inserted] = await db.insert(aiAnalyses)
    .values({ status: "processing", modelUsed: "gpt-5.4" })
    .returning();

  let financialHealth = null;
  let pipelineGrowth = null;
  let executiveSummary = null;
  const errors: string[] = [];

  // Step 1: Financial Health (can fail independently)
  try {
    financialHealth = await callOpenAI({
      systemPrompt: FINANCIAL_HEALTH_SYSTEM,
      userPrompt: buildFinancialHealthPrompt({
        profitLoss: data.profitLoss,
        cashFlow: data.cashFlow,
        expenseBreakdown: data.expenseBreakdown,
        agingReceivables: data.agingReceivables,
        revenueByClient: data.revenueByClient,
        kpis: data.kpis,
        annualSummaries: data.annualSummaries,
        currentPeriodContext: data.currentPeriodContext,
        dataSource: source,
        configContext,
      }),
    });
  } catch (e) {
    errors.push(`Financial health failed: ${e.message}`);
  }

  // Step 2: Pipeline & Growth (can fail independently)
  try {
    pipelineGrowth = await callOpenAI({
      systemPrompt: PIPELINE_GROWTH_SYSTEM,
      userPrompt: buildPipelineGrowthPrompt({
        pipeline: data.pipeline,
        deals: data.deals,
        dealsWonLost: data.dealsWonLost,
        teamUtilization: data.teamUtilization,
        utilization: data.utilization,
        hoursByProject: data.hoursByProject,
        dataSource: source,
        configContext,
      }),
    });
  } catch (e) {
    errors.push(`Pipeline growth failed: ${e.message}`);
  }

  // Step 3: Executive Summary (only if at least one upstream succeeded)
  if (financialHealth || pipelineGrowth) {
    try {
      executiveSummary = await callOpenAI({
        systemPrompt: EXECUTIVE_SUMMARY_SYSTEM,
        userPrompt: buildExecutiveSummaryPrompt(financialHealth, pipelineGrowth),
      });
    } catch (e) {
      errors.push(`Executive summary failed: ${e.message}`);
    }
  }

  // 3. Persist to database
  const analysisData = { financialHealth, pipelineGrowth, executiveSummary, partial: errors.length > 0, errors };
  await db.update(aiAnalyses).set({
    analysisData: JSON.stringify(analysisData),
    dataSnapshot: JSON.stringify({ source, data }),
    status: (financialHealth || pipelineGrowth || executiveSummary) ? "complete" : "error",
    errorMessage: errors.length > 0 ? errors.join("; ") : null,
  }).where(eq(aiAnalyses.id, inserted.id));

  // 4. Return results
  return NextResponse.json({
    id: inserted.id,
    status: "complete",
    source,
    modelUsed: "gpt-5.4",
    analysis: analysisData,
    createdAt: inserted.createdAt,
  });
}
```

### User Prompt Construction

The user prompt is assembled by **serializing data sections as JSON** with markdown headers:

```typescript
function buildFinancialHealthPrompt(data): string {
  return `Analyze the following financial data (data source: ${data.dataSource}).

## IMPORTANT: Current Period Context
${JSON.stringify(data.currentPeriodContext)}

## Annual Financial Year Summaries (Australian FY: Jul-Jun)
${JSON.stringify(data.annualSummaries)}

## KPIs (Current Period)
${JSON.stringify(data.kpis)}

## Profit & Loss (Monthly - up to 36 months)
${JSON.stringify(data.profitLoss)}

## Cash Flow (Monthly - up to 36 months)
${JSON.stringify(data.cashFlow)}

## Expense Breakdown (Current FY)
${JSON.stringify(data.expenseBreakdown)}

## Aging Receivables (Latest Snapshot)
${JSON.stringify(data.agingReceivables)}

## Revenue by Client
${JSON.stringify(data.revenueByClient)}

Produce your financial health analysis as structured JSON.`;
}
```

**Pattern:** Each data section gets a markdown `##` header for context, then `JSON.stringify()` dumps the raw data. The LLM is surprisingly good at parsing this.

---

## 6. AI Chat (Streaming Text)

Chat mode embeds **all financial data into the system prompt** and streams the LLM's text response in real-time.

### Backend: Building the Chat Request

```typescript
export async function POST(request: NextRequest) {
  const { messages: userMessages } = await request.json();

  // 1. Gather fresh data + latest analysis in parallel
  const [gathered, latestAnalysis] = await Promise.all([
    fetch("/api/ai/gather-data").then(r => r.json()),
    getLatestAnalysis(),  // from DB
  ]);

  // 2. Build system prompt with ALL data embedded
  const systemPrompt = buildChatSystemPrompt({
    ...gathered.data,
    dataSource: gathered.source,
    latestAnalysis,           // includes prior analysis for continuity
    configContext: gathered.configContext,
  });

  // 3. Construct message array
  const messages = [
    { role: "system", content: systemPrompt },
    ...userMessages,  // user's conversation history
  ];

  // 4. Stream the response
  const stream = await streamChat(messages, { temperature: 0.4 });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
```

### Backend: Streaming Implementation

```typescript
async function streamChat(
  messages: ChatMessage[],
  opts?: { temperature?: number },
): Promise<ReadableStream<Uint8Array>> {

  // --- Chat Completions API (standard) ---
  const stream = await client.chat.completions.create({
    model: "gpt-5.4",
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: opts?.temperature ?? 0.4,
    stream: true,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encoder.encode(delta));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
```

### If Using Codex/Responses API for Streaming

```typescript
async function streamViaResponses(
  client: OpenAI,
  messages: ChatMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const systemMessage = messages.find(m => m.role === "system");
  const conversationMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role, content: m.content }));

  const stream = await client.responses.create({
    model: "gpt-5.4",
    instructions: systemMessage?.content,  // system prompt goes in instructions
    input: conversationMessages,           // conversation goes in input
    stream: true,
    store: false,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          // Different event type than Chat Completions
          if (event.type === "response.output_text.delta" && "delta" in event) {
            controller.enqueue(encoder.encode(event.delta));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
```

**Key difference:** The Responses API uses `instructions` for the system prompt (not in the messages array) and emits `response.output_text.delta` events instead of `choices[0].delta.content`.

---

## 7. Prompt Engineering

### System Prompt Structure

Each analysis step gets a dedicated system prompt that defines:

1. **Persona** (CFO, CRO, or CEO advisor)
2. **Exact JSON schema** the LLM must output
3. **Tone/style rules** (blunt, specific, actionable)
4. **Formatting rules** (AUD currency, compact notation, no raw key=value pairs)
5. **Partial month handling** (critical for accurate analysis)

### Financial Health System Prompt (Step 1)

```
You are a CFO-level AI advisor for a technology consulting company.
You report directly to the CEO. Your job is to deliver hard truths, not soft suggestions.

You MUST respond with valid JSON matching this exact schema:
{
  "healthScore": <number 0-100>,
  "risks": [{ "severity": "high"|"medium"|"low", "title": ..., "description": ..., "metric": ..., "recommendation": ... }],
  "warnings": [{ "severity": "high"|"medium"|"low", "title": ..., "description": ..., "metric": ... }],
  "positives": [{ "title": ..., "description": ..., "metric": ... }],
  "burnRate": { "current": <number>, "trend": "increasing"|"decreasing"|"stable", "monthsOfData": <number> },
  "runway": { "weeks": <number>, "projection": [{ "month": <string MMM YY>, "cashBalance": <number> }] },
  "concentrationRisk": { "score": <number 0-100>, "details": <string> }
}

Formatting rules:
- CRITICAL: The current month's P&L data is PARTIAL. Do NOT use partial-month revenue
  or expenses as if they represent a full month. Use the LAST COMPLETED month or a
  trailing average.
- The "metric" field MUST be a short, readable prose summary (e.g. "AR: $8.85M | Cash: $639K")
- NEVER use raw key=value pairs like "revenue=65780"
- For large monetary values (>= $10,000), use compact notation: $65.8K, $1.2M
- healthScore: 80+ is healthy, 60-79 is cautionary, below 60 is concerning
```

### Pipeline Growth System Prompt (Step 2)

```
You are a CRO-level AI advisor. You deliver direct assessments of sales performance.

You MUST respond with valid JSON matching this exact schema:
{
  "revenueForecast": [{ "month": <string MMM YY>, "predicted": <number>, "low": <number>, "high": <number> }],
  "pipelineHealth": { "score": <number 0-100>, "insights": [<string>] },
  "dealVelocity": { "avgDays": <number>, "trend": "improving"|"slowing"|"stable" },
  "teamCapacity": { "utilizationAssessment": <string>, "bottlenecks": [<string>] },
  "growthSignals": [{ "signal": <string>, "confidence": "high"|"medium"|"low", "impact": "positive"|"negative"|"neutral" }]
}

- revenueForecast: project 6 months. Monetary values as raw numbers (for charts).
- Format monetary values in text as readable AUD ($150K, $1.2M)
```

### Executive Summary System Prompt (Step 3)

```
You are the CEO's strategic AI advisor. Synthesize all analysis into a board-ready briefing.

You MUST respond with valid JSON matching this exact schema:
{
  "headline": <string, max 100 chars>,
  "executiveSummary": <string, 2-3 paragraphs>,
  "topActions": [{ "priority": 1-5, "action": ..., "rationale": ..., "impact": "high"|"medium"|"low" }],
  "overallScore": <number 0-100>,
  "keyMetrics": [{ "label": ..., "value": ..., "trend": "up"|"down"|"stable", "status": "good"|"warning"|"critical" }]
}

- Headline must be specific: "Cash runway is 14 weeks - staffing costs must drop $40K/mo"
  NOT generic: "Mixed Signals Ahead"
- Do NOT base headline on partial month data
```

### Chat System Prompt

The chat prompt embeds **all financial data** directly:

```typescript
function buildChatSystemPrompt(data): string {
  const sections = [
    `## IMPORTANT: Current Period Context\n${JSON.stringify(data.currentPeriodContext)}`,
    `## Annual FY Summaries\n${JSON.stringify(data.annualSummaries)}`,
    `## KPIs\n${JSON.stringify(data.kpis)}`,
    `## Profit & Loss\n${JSON.stringify(data.profitLoss)}`,
    `## Cash Flow\n${JSON.stringify(data.cashFlow)}`,
    `## Expense Breakdown\n${JSON.stringify(data.expenseBreakdown)}`,
    `## Aging Receivables\n${JSON.stringify(data.agingReceivables)}`,
    `## Revenue by Client\n${JSON.stringify(data.revenueByClient)}`,
    `## Pipeline by Stage\n${JSON.stringify(data.pipeline)}`,
    `## Active Deals\n${JSON.stringify(data.deals)}`,
    `## Deals Won vs Lost\n${JSON.stringify(data.dealsWonLost)}`,
    `## Team Utilization\n${JSON.stringify(data.teamUtilization)}`,
    `## Overall Utilization\n${JSON.stringify(data.utilization)}`,
    `## Hours by Project\n${JSON.stringify(data.hoursByProject)}`,
  ];

  // Include latest analysis results for continuity
  if (data.latestAnalysis) {
    sections.push(`## Latest AI Analysis Results\n${JSON.stringify(data.latestAnalysis)}`);
  }

  return `You are a senior financial advisor AI. You have access to all financial,
pipeline, and team data. Use Australian FY (Jul-Jun).

Your capabilities:
- Answer questions about financial health, revenue, expenses, cash position
- Run simulations ("What if we lose our biggest client?")
- Analyze trends, project runway, forecast outcomes
- Compare metrics across time periods

Rules:
- The current month's data is PARTIAL. Use last completed month for rate-based analysis.
- Always cite specific numbers from the data.
- Format ALL monetary values with $ and AUD formatting ($65.8K, $1.2M).
- NEVER output raw key=value pairs.
- Use markdown tables and bullet points for clarity.

---

# Financial Data
${sections.join("\n\n")}`;
}
```

---

## 8. Response Schemas

### Financial Health Response

```typescript
interface FinancialHealthResponse {
  healthScore: number;  // 0-100
  risks: Array<{
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    metric: string;          // e.g. "AR: $8.85M | Cash: $639K | DSO: 4,038 days"
    recommendation: string;  // specific action
  }>;
  warnings: Array<{
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    metric: string;
  }>;
  positives: Array<{
    title: string;
    description: string;
    metric: string;
  }>;
  burnRate: {
    current: number;                              // raw number (for charts)
    trend: "increasing" | "decreasing" | "stable";
    monthsOfData: number;
  };
  runway: {
    weeks: number;
    projection: Array<{
      month: string;        // "Mar 26"
      cashBalance: number;  // raw number (for charts)
    }>;
  };
  concentrationRisk: {
    score: number;   // 0-100
    details: string;
  };
}
```

### Pipeline Growth Response

```typescript
interface PipelineGrowthResponse {
  revenueForecast: Array<{
    month: string;      // "Mar 26"
    predicted: number;  // raw number
    low: number;        // confidence band lower
    high: number;       // confidence band upper
  }>;
  pipelineHealth: {
    score: number;       // 0-100
    insights: string[];  // 2-4 one-sentence insights
  };
  dealVelocity: {
    avgDays: number;
    trend: "improving" | "slowing" | "stable";
  };
  teamCapacity: {
    utilizationAssessment: string;
    bottlenecks: string[];
  };
  growthSignals: Array<{
    signal: string;
    confidence: "high" | "medium" | "low";
    impact: "positive" | "negative" | "neutral";
  }>;
}
```

### Executive Summary Response

```typescript
interface ExecutiveSummaryResponse {
  headline: string;          // max 100 chars, specific
  executiveSummary: string;  // 2-3 paragraphs prose
  topActions: Array<{
    priority: 1 | 2 | 3 | 4 | 5;
    action: string;
    rationale: string;
    impact: "high" | "medium" | "low";
  }>;
  overallScore: number;  // 0-100, weighted blend of health + pipeline
  keyMetrics: Array<{
    label: string;
    value: string;   // formatted: "$639K", "42%", "14 weeks"
    trend: "up" | "down" | "stable";
    status: "good" | "warning" | "critical";
  }>;
}
```

### Combined Analysis Response (from `POST /api/ai/analyze`)

```typescript
interface AnalyzeResponse {
  id: number;
  status: "complete" | "error";
  source: "live" | "mixed" | "sample";
  modelUsed: string;
  analysis: {
    financialHealth: FinancialHealthResponse | null;
    pipelineGrowth: PipelineGrowthResponse | null;
    executiveSummary: ExecutiveSummaryResponse | null;
    partial: boolean;    // true if any step failed
    errors: string[];    // error messages from failed steps
  };
  createdAt: string;  // ISO timestamp
}
```

---

## 9. Frontend: Consuming Analysis Results

### Triggering an Analysis

```typescript
const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
const [running, setRunning] = useState(false);
const [error, setError] = useState<string | null>(null);

async function runAnalysis() {
  setRunning(true);
  setError(null);

  try {
    const res = await fetch("/api/ai/analyze", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Analysis failed (${res.status})`);
    }
    const result = await res.json();
    setAnalysis(result.analysis);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Analysis failed");
  } finally {
    setRunning(false);
  }
}
```

### Loading Stored Results

```typescript
async function loadStoredAnalysis() {
  try {
    const res = await fetch("/api/ai/results");
    if (!res.ok) return;
    const { data } = await res.json();
    if (data?.analysis) {
      setAnalysis(JSON.parse(data.analysis));
    }
  } catch { /* ignore */ }
}
```

### Rendering the Dashboard

```tsx
// Score gauge
{analysis?.executiveSummary && (
  <AiScoreGauge score={analysis.executiveSummary.overallScore} />
)}

// Executive summary card
{analysis?.executiveSummary && (
  <Card>
    <h2>{analysis.executiveSummary.headline}</h2>
    <p>{analysis.executiveSummary.executiveSummary}</p>
    <div className="grid grid-cols-3 gap-3">
      {analysis.executiveSummary.keyMetrics.map(metric => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          trend={metric.trend}
          status={metric.status}
        />
      ))}
    </div>
  </Card>
)}

// Risk summary
{analysis?.financialHealth && (
  <AiRiskSummary
    risks={analysis.financialHealth.risks}
    warnings={analysis.financialHealth.warnings}
    positives={analysis.financialHealth.positives}
  />
)}

// Runway chart
{analysis?.financialHealth?.runway && (
  <AiRunwayChart projection={analysis.financialHealth.runway.projection} />
)}

// Revenue forecast chart
{analysis?.pipelineGrowth?.revenueForecast && (
  <AiRevenueForecastChart forecast={analysis.pipelineGrowth.revenueForecast} />
)}

// Action items
{analysis?.executiveSummary?.topActions.map(action => (
  <ActionCard
    key={action.priority}
    priority={action.priority}
    action={action.action}
    rationale={action.rationale}
    impact={action.impact}
  />
))}
```

### Score Gauge Color Coding

```typescript
function getScoreColor(score: number) {
  if (score >= 80) return { color: "green",  label: "Healthy" };
  if (score >= 60) return { color: "yellow", label: "Cautionary" };
  return                  { color: "red",    label: "Concerning" };
}
```

These thresholds are embedded in both the system prompts and the UI components so they stay in sync.

---

## 10. Frontend: Streaming Chat

### The Complete Chat Component Pattern

```typescript
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [streaming, setStreaming] = useState(false);

async function sendMessage(content: string) {
  if (!content.trim() || streaming) return;

  // 1. Create user + placeholder assistant messages
  const userMsg = { id: crypto.randomUUID(), role: "user", content };
  const assistantMsg = { id: crypto.randomUUID(), role: "assistant", content: "" };
  setMessages(prev => [...prev, userMsg, assistantMsg]);
  setStreaming(true);

  try {
    // 2. Send conversation history
    const history = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }

    // 3. Read the stream
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 4. Decode chunk and accumulate
      accumulated += decoder.decode(value, { stream: true });

      // 5. Update the assistant message in-place
      const snapshot = accumulated;
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id ? { ...m, content: snapshot } : m
        ),
      );
    }
  } catch (err) {
    // 6. Replace assistant message with error
    const errorText = err instanceof Error ? err.message : "Something went wrong";
    setMessages(prev =>
      prev.map(m =>
        m.id === assistantMsg.id ? { ...m, content: `Error: ${errorText}` } : m
      ),
    );
  } finally {
    setStreaming(false);
  }
}
```

### Key Details

- **`decoder.decode(value, { stream: true })`** — the `{ stream: true }` option handles multi-byte characters that may be split across chunks
- **In-place message update** — the assistant message is created with empty content first, then updated on each chunk via `setMessages` with a map
- **Conversation history** — the full message history is sent with each request so the AI maintains context
- **No SSE** — this uses raw `ReadableStream` with `text/plain`, not Server-Sent Events. Simpler to implement and parse.

---

## 11. Error Handling & Resilience

### Analysis: Partial Results

Each of the three analysis steps is wrapped in its own try-catch. If Step 1 fails but Step 2 succeeds, you still get pipeline data:

```typescript
const analysisData = {
  financialHealth,   // may be null
  pipelineGrowth,    // may be null
  executiveSummary,  // null if both above are null
  partial: errors.length > 0,
  errors,            // array of error messages
};
```

The UI checks each section before rendering:

```tsx
{analysis?.financialHealth && <FinancialHealthPanel data={analysis.financialHealth} />}
{analysis?.pipelineGrowth && <PipelinePanel data={analysis.pipelineGrowth} />}
{analysis?.executiveSummary && <ExecutiveSummary data={analysis.executiveSummary} />}
```

### Auth Error Detection

```typescript
function wrapAuthError(err: unknown, method: AuthMethod): never {
  const msg = err instanceof Error ? err.message : String(err);

  if (
    msg.includes("insufficient permissions") ||
    msg.includes("Missing scopes") ||
    msg.includes("Unauthorized")
  ) {
    const hint = isOAuth(method)
      ? "OAuth token may have expired. Re-run `codex login` to refresh."
      : "API key may be restricted. Generate a full-access key.";
    throw new Error(`OpenAI auth failed (${method}): ${hint}`);
  }

  throw err;
}
```

### Chat Error Handling

Errors are displayed inline in the chat as the assistant message content:

```typescript
catch (err) {
  setMessages(prev =>
    prev.map(m =>
      m.id === assistantMsg.id
        ? { ...m, content: `Error: ${err.message}` }
        : m
    ),
  );
}
```

---

## 12. Common Integration Issues & Fixes

### Issue: LLM returns markdown/prose instead of JSON

**Cause:** Missing `response_format: { type: "json_object" }` in the API call.

**Fix:**
```typescript
// Chat Completions API
response_format: { type: "json_object" }

// Responses API (Codex)
text: { format: { type: "json_object" } }
```

Also ensure the system prompt contains the JSON schema and ends with "Respond with valid JSON."

### Issue: Empty response from LLM

**Cause:** The response may be in a different location depending on the API.

**Fix:**
```typescript
// Chat Completions API
const content = response.choices[0]?.message?.content;

// Responses API — must accumulate from stream events
for await (const event of stream) {
  if (event.type === "response.output_text.delta") {
    accumulated += event.delta;
  }
}
```

### Issue: Streaming chunks garble multi-byte characters

**Cause:** UTF-8 characters split across chunk boundaries.

**Fix:** Always use `{ stream: true }` option on TextDecoder:
```typescript
const decoder = new TextDecoder();
accumulated += decoder.decode(value, { stream: true });
```

### Issue: Partial month data skews analysis

**Cause:** The current month only has data through today, but the LLM treats it as a full month.

**Fix:** Include `currentPeriodContext` in the data payload and add explicit instructions in the system prompt:
```
CRITICAL: The current month's P&L data is PARTIAL (only X% complete).
Do NOT use it for burn rate or run-rate calculations.
Use the LAST COMPLETED month instead.
```

### Issue: Response too large / token limit exceeded

**Cause:** Sending too much historical data.

**Fix:** Trim arrays before sending:
```typescript
const trimArray = <T>(arr: T[], max: number) => arr.slice(-max);
// P&L: 36 months, Deals: 40, Team: 30, Projects: 20
```

### Issue: LLM outputs raw numbers like "revenue=65780"

**Cause:** The LLM defaults to debug-style output without formatting instructions.

**Fix:** Add explicit formatting rules to the system prompt:
```
NEVER output raw key=value pairs like "revenue=65780".
Use human-readable labels: "Revenue: $65.8K"
Use compact notation for large values: $65.8K, $1.2M, $8.9M
Use pipe separators in metric fields: "AR: $8.85M | Cash: $639K"
```

### Issue: Codex backend rejects temperature parameter

**Cause:** The Codex Responses API doesn't support the `temperature` parameter.

**Fix:** Only pass temperature for Chat Completions API:
```typescript
if (isOAuth(method)) {
  // Codex: no temperature support
  await client.responses.create({
    model, instructions, input, stream: true, store: false,
  });
} else {
  // Platform: temperature supported
  await client.chat.completions.create({
    model, messages, temperature: 0.3, stream: true,
  });
}
```

### Issue: Analysis times out on Vercel

**Cause:** Default function timeout is 10 seconds.

**Fix:**
```typescript
// At the top of each API route file
export const maxDuration = 120;
```

And ensure the AbortController timeout matches:
```typescript
const timer = setTimeout(() => controller.abort(), 120_000);
```

---

## Quick Reference: API Endpoints

| Endpoint | Method | Request Body | Response | Purpose |
|----------|--------|-------------|----------|---------|
| `/api/ai/gather-data` | GET | None | `{ source, configContext, data }` | Aggregate all financial data |
| `/api/ai/analyze` | POST | None | `{ id, status, analysis, ... }` | Run 3-step analysis pipeline |
| `/api/ai/results` | GET | None | `{ data: { analysis, ... } }` | Retrieve latest stored analysis |
| `/api/ai/chat` | POST | `{ messages: [{ role, content }] }` | Streaming text | Conversational Q&A |

---

## Quick Reference: Key Files

| File | Purpose |
|------|---------|
| `src/lib/api/openai.ts` | OpenAI client: `callOpenAI()` + `streamChat()` |
| `src/lib/api/openai-auth.ts` | Credential resolution (API key / OAuth / Codex file) |
| `src/lib/ai-prompts.ts` | All system prompts + prompt builders |
| `src/app/api/ai/analyze/route.ts` | 3-step analysis pipeline endpoint |
| `src/app/api/ai/chat/route.ts` | Streaming chat endpoint |
| `src/app/api/ai/gather-data/route.ts` | Data aggregation endpoint |
| `src/app/api/ai/results/route.ts` | Retrieve stored analysis |
| `src/app/ai-assistant/page.tsx` | Frontend: analysis dashboard + chat tabs |
| `src/components/ai/ai-chat.tsx` | Frontend: streaming chat with markdown rendering |
| `src/components/ai/ai-score-gauge.tsx` | Frontend: health score donut chart |
| `src/components/ai/ai-risk-summary.tsx` | Frontend: risks/warnings/positives cards |
| `src/components/ai/ai-runway-chart.tsx` | Frontend: cash runway projection chart |
| `src/components/ai/ai-revenue-forecast-chart.tsx` | Frontend: revenue forecast with confidence bands |
| `src/lib/db/schema.ts` | Database schema (all tables) |
| `src/lib/aggregations.ts` | Data transformation functions |
