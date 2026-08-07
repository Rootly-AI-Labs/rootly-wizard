# Wizard usage telemetry (Datadog)

How we measure **real** adoption of the Rootly Setup Wizard — actual runs against
the Rootly API — instead of npm download counts (which are ~all mirrors,
scanners, and CI and don't reflect real users).

## How it works

Every request the wizard makes to the Rootly API is tagged with an identifying
header, set in [`src/user-agent.js`](../src/user-agent.js) and applied by
[`src/rootly-api.js`](../src/rootly-api.js) and [`src/auth.js`](../src/auth.js):

```
User-Agent:      rootly-wizard/<version> (+https://github.com/rootlyhq/rootly-wizard)
X-Rootly-Client: rootly-wizard/<version>
```

The Rootly API (`service:rootly-api`) is instrumented with Datadog APM, which
**already captures the User-Agent** as the span attribute `@http.useragent`
(no API/app code change needed). Entry spans also carry `@rootly.team.id`,
`@rootly.current_user.id`, and `@rootly.team.in_trial`, which let us count
**unique workspaces** and split trial vs. paid.

- Shipped in **v0.4.1** (first version that sends the header).
- Identification is the User-Agent string; a request matching
  `@http.useragent:rootly-wizard*` is a wizard run. (Self-reported, fine for
  usage analytics. For spoof-proof attribution of OAuth sessions, the token is
  tied to the "Rootly Wizard" OAuth client server-side — not needed here.)

## Dashboard

**Rootly Wizard — Adoption:** https://app.datadoghq.com/dashboard/afg-df6-6ks

Every widget filters `service:rootly-api @http.useragent:rootly-wizard*`. Key
tile is **Unique workspaces** = `cardinality(@rootly.team.id)` — the honest
adoption metric.

## Datadog setup (admin, one-time — UI/click-ops, no deploy)

These are Datadog configuration, not code. They require Datadog admin.

### 1. Retention filter (important at low volume)

APM span **search/analytics only sees retained (sampled) spans**. Low-volume
`200 GET`s get sampled out, so early wizard traffic can be undercounted or
invisible on the dashboard. Keep 100% of wizard spans:

- **APM → Settings → Retention Filters → New retention filter**
- Query: `@http.useragent:rootly-wizard*`
- Sample rate: **100%**
- Name: `Rootly Wizard traffic`

### 2. Span-based metric (for counts that ignore sampling)

Span-based metrics are computed on **100% of spans before sampling**, so they're
the most reliable volume signal:

- **APM → Settings → Generate Metrics → New Metric**
- Query: `service:rootly-api @http.useragent:rootly-wizard*`
- Metric name: `rootly.wizard.requests`
- Group-by tags: `@http.useragent` (→ version), `@rootly.team.in_trial`
- ⚠️ Do **not** add `@rootly.team.id` as a metric tag (high cardinality / cost).
  Keep unique-workspace counting in span **analytics** (the dashboard), which the
  retention filter above makes reliable.

### 3. "Notify me" monitor

Alert when the wizard gets used (fires the first time real traffic appears;
currently zero). Build in **Monitors → New → Trace Analytics** (or a Metric
monitor on `rootly.wizard.requests` once step 2 exists):

- Trace Analytics monitor, query spans `service:rootly-api @http.useragent:rootly-wizard*`
- Evaluation: `count` over `last 1 week` `> 0`
- Notify: `@spencer.cheng@rootly.com`
- Message: e.g. _"🎉 The Rootly Setup Wizard was used by real traffic this week."_

For a weekly digest instead of a one-shot alert, use a scheduled Datadog
notebook/report or a low-frequency monitor with `renotify`.

## Verifying end to end

The pipeline was verified by firing wizard-tagged requests from the `0.4.1`
client and confirming the identical span query works for a known UA
(`@http.useragent:Datadog/Synthetics` returned data). Wizard traffic shows up
once (a) users are on `0.4.1+` and (b) the retention filter (step 1) keeps the
low-volume spans.

## What to watch (vs. npm downloads)

- **Unique workspaces / week** — real adoption.
- **Requests over time by version** — how fast `0.4.x` is picked up.
- **Trial vs. paid** — is the wizard landing with prospects or existing customers.
- **Error rate (5xx)** — broken flows in the wild.
