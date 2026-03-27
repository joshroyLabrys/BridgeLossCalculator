/**
 * Print-only CSS as a raw string.
 * Injected via <style> in layout.tsx to bypass Tailwind v4's PostCSS
 * purge, which strips rules referencing classes it doesn't generate.
 */
export const printStyles = `
@media print {
  body {
    background: white !important;
    background-image: none !important;
  }

  /* Hide everything in the page wrapper except .print-report */
  :has(> .print-report) > *:not(.print-report) {
    display: none !important;
  }

  .print-report {
    display: block !important;
    width: 100%;
  }

  /* Page template */
  .print-page {
    page-break-after: always;
    position: relative;
    box-sizing: border-box;
  }

  .print-page:first-child {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .print-page:first-child .print-page-content {
    flex: 1;
  }

  .print-page:last-child {
    page-break-after: auto;
  }

  .print-page-footer {
    margin-top: 2mm;
    padding-top: 1mm;
  }

  /* Table and SVG */
  .print-report table {
    table-layout: fixed;
    word-break: break-word;
    max-width: 100%;
  }

  .print-report svg {
    max-width: 100% !important;
    height: auto !important;
    overflow: hidden;
    display: block;
    background: white;
  }

  .print-report svg text {
    fill: #374151 !important;
  }

  .print-report svg line,
  .print-report svg .domain {
    stroke: #d1d5db !important;
  }

  @page {
    margin: 15mm 15mm;
    size: A4;
  }
}
`;
