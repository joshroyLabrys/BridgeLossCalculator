# Australian Bridge Hydrology Process - Product Assessment

**Date:** 2026-03-29  
**Goal:** Assess the current FlowSuite / Bridge Loss Calculator against a real Australian bridge-hydrology workflow, define where it sits in the delivery chain, and recommend the next full tool and next high-value automation layer.  
**Audience:** Product owner, hydraulic engineers, bridge designers, and technical leads shaping the roadmap.

---

## Executive Assessment

### Short verdict

The current application is strongest as a **bridge waterway adequacy and hydraulic QA workstation**, not as a full end-to-end hydrology platform.

If I frame it from an Australian hydraulic engineering standpoint:

- **Very useful** for the middle of the workflow:
  - bridge opening checks
  - method comparison
  - quick independent QA against HEC-RAS
  - scour screening
  - adequacy framing
  - reporting
- **Partly useful** for early hydrology:
  - simple ARR/IFD-assisted flow generation
  - small-catchment screening
- **Not yet sufficient** for full project hydrology governance:
  - design event assembly
  - losses selection and reconciliation
  - temporal patterns and hydrographs
  - runoff-routing models
  - climate change event sets
  - authority-specific submission workflows

### Product position in one sentence

This product currently sits best as the **independent bridge-waterway assessment layer between upstream hydrology/flood modelling and downstream design/report approvals**.

### Usefulness score

- **8/10** for bridge waterway adequacy screening, optioneering, and QA review.
- **4/10** for upstream hydrology generation as practiced on real Australian bridge projects.
- **3/10** as a whole-of-project bridge and flood workflow platform.

---

## Repo-Grounded Reality Check

### What is genuinely strong already

- The repo is clearly built around a serious **bridge loss / waterway adequacy** workflow, not a toy calculator.
- The current monorepo app already includes meaningful capability in:
  - multi-method bridge hydraulics
  - HEC-RAS import and comparison
  - adequacy assessment
  - scour screening
  - reach analysis
  - AI-assisted reporting
  - PDF exports
  - scenario history
- The engine also includes **TUFLOW FLC back-calculation**, which is a strong Australian-practice signal for consultant workflows.
- The browser-only posture is a good fit for sensitive engineering work where firms do not want project geometry and flood results leaving the desktop.

### What the repo says about current positioning

- The launcher already imagines a broader product, but only **Bridge Loss Calculator** is live today.
  - Evidence: `apps/web/src/app/page.tsx`
- The wider "FlowSuite" idea exists, but the delivered product is still one deep module rather than a fully separated hydrology suite, hydraulic suite, and report suite.
  - Evidence: `apps/web/src/app/page.tsx`, `apps/web/src/app/blc/page.tsx`

### Trust blockers that matter for engineering adoption

These are the main reasons I would currently position the app as a strong **screening + QA + optioneering** tool instead of a final-authority hydrology platform.

#### 1. Unit integrity risk in hydrology handoff

- The input layer documents that store values are held internally in **imperial units**.
  - Evidence: `apps/web/src/components/input/README.md`, `packages/data/src/units.ts`
- The catchment calculator computes discharges in **m3/s** and sends them directly to flow profiles without converting to imperial storage units.
  - Evidence: `apps/web/src/components/hydrology/catchment-calculator.tsx`

This is the single biggest trust issue in the current hydrology path. If unresolved, it undermines confidence in the "ARR to hydraulic model" handoff.

#### 2. ARR integration is not yet authority-grade

- The ARR lookup attempts a direct fetch and falls back to **example/mock IFD data** if the response shape is unexpected or the request fails.
  - Evidence: `apps/web/src/components/hydrology/arr-lookup.tsx`
- That is acceptable for demos, early exploration, or offline prototyping, but not for submission-grade design flood derivation.

#### 3. Jurisdiction logic is still heuristic

- The regulatory checklist is useful as a workflow prompt, but it is not yet a robust codification of authority requirements.
  - Evidence: `apps/web/src/config/regulatory-checklists.ts`
- Some checks are hard-coded using generic thresholds and simplified assumptions.
- Some current checks also appear to mix **metric policy thresholds** with an application state that is otherwise stored in **imperial units**, which makes them unsafe to treat as authoritative without hardening.
- The NSW authority naming is also stale relative to the current government structure.

#### 4. Scour is screening-level, not full bridge-foundation decision support

- Pier scour and contraction scour are implemented and valuable.
  - Evidence: `packages/engine/src/scour/pier-scour.ts`, `packages/engine/src/scour/contraction-scour.ts`
- But the current implementation still makes simplifying assumptions:
  - fixed or simplified bed factors
  - assumed pier length ratio
  - simplified contraction inputs
  - no integrated abutment scour workflow
  - no direct linkage to footing, pile, or founding levels

That means the scour module is helpful for review and flagging risk, but not yet the final foundation decision engine.

#### 5. Reach analysis is useful, but intentionally simplified

- The reach solver cascades tailwater bridge-to-bridge.
  - Evidence: `packages/engine/src/reach/reach-solver.ts`
- It does not yet model attenuation, storage, detailed floodplain interaction, or richer reach hydraulics.

That is still valuable for quick bridge-chain screening, but it is not a substitute for a proper river/floodplain model.

#### 6. The unified import story is not fully unified yet

- The new import panel is good for CSV and JSON.
- HEC-RAS files are still pushed back to the older import path instead of being handled seamlessly in the same workflow.
  - Evidence: `apps/web/src/components/data/import-panel.tsx`

---

## Australian Process Flow

Below is the full bridge and hydrology process as it usually behaves in practice for Australian road/bridge work. The important point is that **hydrology is only one part of the chain**, and bridge waterway adequacy is one subsection inside the larger design and approval workflow.

| Stage | Typical outputs | Who owns it | Where the current app fits |
|---|---|---|---|
| 1. Project framing and authority basis | design criteria, road importance, serviceability/ULS events, authority requirements, climate change basis | project manager, bridge lead, hydraulic lead | Not primary |
| 2. Site data assembly | survey, LiDAR, aerials, bridge geometry, asset records, utilities, previous studies, flood history | survey + discipline leads | Partial via manual data entry/import |
| 3. Catchment and flood basis definition | catchment boundaries, losses, temporal patterns, ARR inputs, state supplements, gauged data review, model strategy | hydrologist | Light support only |
| 4. Design flood estimation | peak flows, hydrographs, event set, climate change scenarios, sensitivity ranges | hydrologist | Light support only |
| 5. Flood hydraulics and boundaries | 1D/2D model, tailwater, flood levels, velocity field, afflux, flow distribution | hydraulic modeller | Partial via HEC-RAS comparison, not a full flood model |
| 6. Bridge waterway adequacy and optioning | bridge opening losses, afflux, freeboard, pressure flow, overtopping thresholds, method comparison | hydraulic bridge engineer | Core strength |
| 7. Scour and stability review | pier scour, contraction scour, abutment risk, countermeasures, founding-level checks | hydraulic + geotech + bridge | Partial, screening-level |
| 8. Structural and road safety integration | deck levels, overtopping risk, closures, foundation implications, roadway consequences | bridge + road + safety | Partial |
| 9. Compliance, QA, and submission assembly | design report, checklists, review memo, assumptions register, submission pack | discipline leads + reviewer | Strong potential, partly implemented |
| 10. Delivery, operations, and monitoring | IFC package, construction staging checks, post-flood inspection logic, monitoring | design + asset owner | Not primary |

### The cleanest way to define the app's current seat

The app sits most naturally at:

**Stage 6 with extensions into Stages 7 and 9.**

That is a very real and commercially important slot:

- it is where engineers burn time comparing methods
- it is where bridge openings get challenged
- it is where firms want independent QA against HEC-RAS or spreadsheet workflows
- it is where options get killed or justified
- it is where reporting drags out

That means the app already has a good commercial center of gravity. It just should not pretend to be the entire hydrology chain yet.

---

## External Practice Alignment

The broader Australian workflow implied by current guidance is larger than a rational-method bridge calculator:

- ARR 4.2 spans peak flow estimation, catchment simulation, hydrograph estimation, flood hydraulics, modelling systems, uncertainty, documentation, and climate change.
- The ARR Data Hub is a design-input source, not the whole hydrology method.
- Austroads Part 8 covers design floods, hydraulic design of waterway structures, scour, monitoring, and broader waterway design considerations.
- TMR has now aligned drainage guidance into RPDM supplements rather than the old standalone drainage manual.
- NSW institutional references have changed since 2024, so older "DPIE" naming is no longer current.

Implication:

The app should market itself as:

**"Australian bridge waterway assessment, review, and adequacy workstation"**

not as:

**"complete Australian bridge hydrology platform"**

at least until upstream hydrology governance is materially expanded.

---

## Where The App Wins Today

### 1. It compresses the most painful middle section

This is the section where engineers often bounce between:

- spreadsheets
- HEC-RAS outputs
- manual bridge loss checks
- scour side-calcs
- review notes
- report drafting

Bringing those together is meaningful.

### 2. It is highly usable for optioneering

The app is already shaped for:

- "what if we raise the low chord?"
- "what if debris is 20% instead of 0?"
- "what if the opening width increases?"
- "what if Yarnell and energy disagree?"

That is exactly the kind of iterative work a bridge hydrology engineer does early and mid-design.

### 3. It has reviewer value, not just designer value

The independent method comparison and QA/QC framing mean the tool has a second buyer/use case:

- internal design checkers
- principal reviewers
- client-side reviewers
- independent verification reviewers

That is strong product territory.

---

## Where It Is Still Thin

### Hydrology depth

The current hydrology section is still a **small-catchment peak-flow helper**, not a project hydrology engine.

Missing or thin areas include:

- runoff-routing model support
- hydrograph workflows
- losses workflows
- temporal patterns
- event set management
- climate change event generation
- RFFE and gauged-data reconciliation
- state-specific hydrology adjustments

### Governance depth

A real Australian submission workflow needs stronger treatment of:

- assumptions register
- model version register
- authority-specific evidence packs
- review sign-offs
- provenance of imported data
- separation of screening values from submission values

### Bridge-design integration depth

The app still needs tighter coupling to:

- foundation / pile / founding levels
- structural consequences of overtopping and scour
- road closure / serviceability logic
- environmental and fish-passage implications where required

---

## Best Next Whole Tool

## Recommendation

Build the next full tool as an **Australian Hydrology Inputs and Design Event Manager**.

### Why this should be next

This is the biggest workflow gap on either side of the current app.

Right now the product is strongest after someone already knows:

- what events matter
- what flows to test
- what climate change basis applies
- what losses and temporal patterns were used
- what boundary conditions and model provenance are trusted

That means the app starts too late in the overall process.

If you add a proper hydrology/governance tool before the current BLC module, FlowSuite becomes a much more complete platform.

### What this tool should do

It should own the flood-input assembly process for Australian bridge work:

- catchment definition and metadata
- ARR Data Hub ingest with provenance capture
- state-specific supplements and notes
- losses selection workflow
- temporal pattern selection
- design event register
- climate change event generation
- hydrograph import/export
- gauged-data and RFFE reconciliation notes
- direct export of approved event sets into the bridge adequacy module

### Why this is better than adding more visual features first

A stronger simulation scene is nice.  
A stronger flood-input and event-governance layer changes the product category.

That layer would let you say:

> "We do not just check a bridge opening. We package the approved design flood basis, push it into the bridge assessment, and carry the assumptions through to reporting."

That is a much bigger commercial story.

---

## Best Next Automation Inside The Current App

## Recommendation

Add a **Bridge Waterway Assessment Orchestrator** inside the current app.

### This automation should:

- guide the engineer through a fixed sequence:
  - project basis
  - data completeness
  - imported model evidence
  - bridge adequacy run
  - scour review
  - scenarios
  - compliance checks
  - final report pack
- flag missing prerequisites before allowing sign-off
- auto-build an assumptions register from user decisions
- auto-summarise the governing profile, governing method, and governing risk
- produce submission-ready output packs for internal review and authority submission

### Why this matters

The current app has many strong pieces, but they still feel like features.  
An orchestrator turns them into a disciplined engineering process.

That is what makes a tool feel "god-tier" in practice:

- not more buttons
- more confidence
- less rework
- fewer missed steps
- faster reviews

---

## How To Make This App A "Godly Gift" For Its Section Of The Workflow

### 1. Fix trust before adding more scope

The first priority should be correctness and provenance:

- fix metric/imperial handoff in hydrology-to-flow-profile transfer
- remove any ambiguity around internal storage vs displayed units
- stop using mock IFD values silently in real workflows
- label demo/example data aggressively when used

### 2. Turn the regulatory layer into a real authority layer

Replace generic checklist heuristics with configurable jurisdiction packs:

- TMR
- current Victorian authority pack
- current NSW authority pack
- ARR general pack
- client-specific pack

Each should carry:

- thresholds
- required evidence
- mandatory deliverables
- manual sign-off items
- explanation of why a check passed or failed

### 3. Make hydrology provenance visible everywhere

For each flow profile, show:

- source
- method
- ARR version / dataset version
- climate basis
- assumptions
- who approved it
- when it changed

That turns the app from a calculator into a controlled engineering record.

### 4. Add option comparison as a first-class workflow

The current tool can test scenarios, but it should become excellent at comparing options such as:

- raise deck
- widen opening
- reduce pier count
- change skew
- add scour protection
- change debris assumptions

Each option should automatically compare:

- afflux
- freeboard
- scour
- constructability notes
- likely authority risk

### 5. Make the report evidence-based, not just polished

The report engine should become a submission pack builder with:

- evidence references
- assumption tables
- input provenance
- design-event register
- reviewer sign-off block
- model file index
- scenario comparison appendix
- compliance matrix

### 6. Add "reviewer mode"

This is one of the strongest expansion paths because the product already has reviewer DNA.

Reviewer mode should:

- lock inputs and show diffs only
- flag departures from firm standards
- compare against imported HEC-RAS / TUFLOW evidence
- force comment capture on overrides
- produce a QA memorandum automatically

---

## Recommended Product Positioning

### What I would say externally

FlowSuite is an **Australian bridge waterway assessment and hydraulic QA platform** that helps engineers move from imported model evidence to a defended bridge adequacy decision faster.

### What I would avoid saying externally for now

- "full bridge hydrology platform"
- "complete ARR automation suite"
- "submission-ready hydrology engine"

Those claims should wait until the upstream hydrology and governance layer is materially expanded.

---

## Practical Roadmap

### Phase 1 - Trust and fit

- Fix hydrology unit handoff.
- Replace ARR fallback behavior with a real adapter and explicit provenance.
- Refresh jurisdiction naming and logic.
- Tighten checklist calculations and unit handling.
- Separate demo mode from production mode.

### Phase 2 - Own the current section

- Add assessment orchestrator.
- Add option comparison workspace.
- Add reviewer mode.
- Add stronger evidence and sign-off workflow.
- Harden HEC-RAS/TUFLOW import and comparison.

### Phase 3 - Expand earlier in the process

- Build Hydrology Inputs and Design Event Manager as a separate module.
- Add ARR-driven event management, climate factors, losses, and hydrograph workflows.
- Feed approved design-event packs directly into the bridge assessment module.

### Phase 4 - Expand later in the process

- Add compliance/submission pack builder.
- Add structural/foundation hooks for scour consequences.
- Add post-flood inspection / asset monitoring workflows.

---

## Bottom Line

The app is already pointed at a real and valuable slice of the Australian bridge workflow:

**bridge waterway adequacy, hydraulic review, and reporting.**

That is a good place to be.

The mistake would be trying to call it the whole process too early.

The right move is:

1. make this section impeccable and trusted
2. add the upstream hydrology/event-governance tool next
3. then stitch the modules together into a genuine FlowSuite

If you do that, the app stops being "a clever calculator" and becomes the operating layer engineers use to move from flood basis to bridge decision with less friction and more confidence.

---

## External References

- Australian Rainfall and Runoff guidebook and book structure: https://www.arr-software.org/arr-web/
- ARR project downloads and current version structure: https://www.arr-software.org/arrdocs.html
- ARR Data Hub overview: https://data.arr-software.org/about
- ARR Data Hub changelog, including climate-factor and NSW-specific updates: https://data.arr-software.org/changelog
- Austroads Guide to Bridge Technology Part 8 overview: https://austroads.com.au/publications/bridges/agbt08
- Austroads Guide to Bridge Technology Part 8, 2025 edition listing: https://austroads.com.au/publications/bridges/agbt08
- TMR Road Drainage Manual replacement notice and RPDM supplements: https://www.tmr.qld.gov.au/business-industry/technical-standards-publications/road-drainage-manual.aspx
- TMR Road Planning and Design Manual 2nd edition listing: https://www.tmr.qld.gov.au/business-industry/Technical-standards-publications/Road-planning-and-design-manual-2nd-edition
- TMR Bridge design and assessment criteria: https://www.tmr.qld.gov.au/business-industry/Technical-standards-publications/Bridge-design-and-assessment-criteria
- Victorian Department of Transport and Planning technical publications hub: https://www.vic.gov.au/technical-publications-owned-department-transport-and-planning
- NSW government note on the January 1, 2024 split of the former Department of Planning and Environment: https://www.nsw.gov.au/departments-and-agencies/dcceew/about-dcceew
