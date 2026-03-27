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

  /*
   * Strategy: visibility:hidden on body hides everything including children.
   * Then visibility:visible on the print-report makes it (and its children) visible.
   * This avoids display:none which collapses layout and requires re-establishing
   * the display type for every element.
   */
  body {
    visibility: hidden !important;
  }

  .print-report {
    visibility: visible !important;
    display: block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
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
