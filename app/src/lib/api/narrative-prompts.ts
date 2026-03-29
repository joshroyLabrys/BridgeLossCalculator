export interface NarrativeSectionDef {
  id: string;
  title: string;
  description: string;
  systemPrompt: (tone: 'technical' | 'summary') => string;
  /** If set, this section requires specific data to be present */
  requiresData?: string;
}

export const NARRATIVE_SECTIONS: NarrativeSectionDef[] = [
  {
    id: 'introduction',
    title: 'Introduction & Scope',
    description: 'Project description, bridge location, assessment purpose, standards referenced',
    systemPrompt: (tone) => tone === 'technical'
      ? 'Write a formal introduction section for a bridge waterway adequacy assessment report. Include project context, bridge identification, assessment purpose, and applicable standards. Use third person, passive voice, formal engineering register. Reference Australian standards (ARR, TMR guidelines) where applicable. Keep to 2-3 paragraphs.'
      : 'Write a plain-language introduction explaining what this bridge assessment covers and why it was done. Keep it clear and accessible for non-technical stakeholders. 1-2 paragraphs.',
  },
  {
    id: 'methodology',
    title: 'Methodology',
    description: 'Calculation methods, assumptions, software used, input data sources',
    systemPrompt: (tone) => tone === 'technical'
      ? 'Write a methodology section for a bridge hydraulic assessment. Describe the calculation methods used (Energy, Momentum, Yarnell, WSPRO as applicable), key assumptions, coefficient selections, and software. Reference HEC-RAS Technical Reference Manual methodology. Use formal engineering register. 2-3 paragraphs.'
      : 'Explain in plain language how the bridge was assessed — what methods were used and what assumptions were made. 1-2 paragraphs.',
  },
  {
    id: 'hydraulic-analysis',
    title: 'Hydraulic Analysis',
    description: 'Results interpretation per AEP, regime classifications, method agreement',
    requiresData: 'results',
    systemPrompt: (tone) => tone === 'technical'
      ? 'Write the hydraulic analysis results section. Discuss upstream water levels for each design event, flow regime classifications, method agreement/divergence, and any notable hydraulic behavior. Reference specific WSEL values and head losses from the data provided. Use formal engineering register.'
      : 'Summarize the key hydraulic results in plain language — what happens to water levels at different flood sizes, and whether the methods agree.',
  },
  {
    id: 'scour',
    title: 'Scour Assessment',
    description: 'Pier and contraction scour results, critical elevations',
    requiresData: 'scourResults',
    systemPrompt: (tone) => tone === 'technical'
      ? 'Write a scour assessment section covering pier scour (CSU/HEC-18 equation) and contraction scour results. Report scour depths per pier, contraction scour depth, total scour, and critical bed elevations. Reference specific values from the data. If no scour data is provided, state that scour assessment was not completed.'
      : 'Explain the scour assessment results — how deep the river bed could erode around the bridge piers and under the bridge.',
  },
  {
    id: 'adequacy',
    title: 'Bridge Adequacy',
    description: 'Pass/fail summary, critical discharge thresholds, freeboard status',
    requiresData: 'results',
    systemPrompt: (tone) => tone === 'technical'
      ? 'Write the bridge adequacy assessment section. State the overall verdict, freeboard at design AEP, flow regime at design event, and critical discharge thresholds (pressure onset, overtopping onset). Compare against regulatory requirements.'
      : 'State clearly whether the bridge passes or fails the assessment, and at what flood level problems start.',
  },
  {
    id: 'sensitivity',
    title: 'Sensitivity & Uncertainty',
    description: "Manning's n sensitivity, debris scenarios, parameter uncertainty",
    requiresData: 'sensitivityResults',
    systemPrompt: (tone) => tone === 'technical'
      ? "Write a sensitivity analysis section discussing Manning's n sensitivity results (±percentage), debris blockage scenario impacts, and overall parameter uncertainty. Quantify the impact on upstream WSEL and freeboard."
      : 'Explain how sensitive the results are to key assumptions — what happens if conditions are slightly different than assumed.',
  },
  {
    id: 'conclusions',
    title: 'Conclusions & Recommendations',
    description: 'Overall verdict, recommended actions, conditions/caveats',
    systemPrompt: (tone) => tone === 'technical'
      ? 'Write conclusions and recommendations for the bridge assessment. Summarize the overall adequacy verdict, key findings, and specific recommendations for action. Include caveats and conditions. Use formal engineering register.'
      : 'Summarize the main findings and what should be done next, in plain language.',
  },
];
