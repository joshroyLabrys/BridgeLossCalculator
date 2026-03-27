export interface CapturedChart {
  id: string;
  label: string;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Find all SVG charts in the DOM by data-chart-id attribute,
 * convert them to print-friendly PNGs at 2x resolution.
 */
export async function captureCharts(): Promise<CapturedChart[]> {
  const containers = document.querySelectorAll<HTMLElement>('[data-chart-id]');
  const results: CapturedChart[] = [];

  for (const container of containers) {
    const svg = container.querySelector('svg');
    if (!svg) continue;

    const id = container.getAttribute('data-chart-id') || 'chart';
    const card = container.closest('[class*="CardContent"]')?.parentElement;
    const titleEl = card?.querySelector('[class*="CardTitle"]');
    const label = titleEl?.textContent || id;

    const dataUrl = await svgToDataUrl(svg, 2);
    results.push({
      id,
      label,
      dataUrl,
      width: svg.clientWidth || 600,
      height: svg.clientHeight || 300,
    });
  }

  return results;
}

/** Known method/data line colors that should NOT be overridden for print. */
const DATA_COLORS = new Set([
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', // method + hecras
  'rgb(59, 130, 246)', 'rgb(16, 185, 129)', 'rgb(245, 158, 11)', 'rgb(139, 92, 246)', 'rgb(239, 68, 68)',
]);

function isDataColor(color: string): boolean {
  return DATA_COLORS.has(color.toLowerCase().trim());
}

function svgToDataUrl(svg: SVGSVGElement, scale: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = svg.clientWidth || 600;
    const h = svg.clientHeight || 300;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // First inline the computed styles from the live DOM
    inlineStyles(svg, clone);
    // Then post-process for print (white bg, dark text, visible grid)
    prepareForPrint(clone, w, h);

    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Could not get canvas 2D context')); return; }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize chart'));
    };
    img.src = url;
  });
}

/**
 * Post-process a cloned SVG for print: white background, dark text,
 * visible grid lines. Preserves data-line colors (method colors).
 */
function prepareForPrint(clone: SVGSVGElement, w: number, h: number): void {
  // 1. Insert white background rect as first child
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', String(w));
  bg.setAttribute('height', String(h));
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  // 2. Override all text to dark color for readability
  clone.querySelectorAll('text').forEach((t) => {
    t.style.fill = '#333333';
    t.style.fontWeight = '500';
  });

  // 3. Override grid/axis lines (but not data lines)
  clone.querySelectorAll('line').forEach((l) => {
    const stroke = l.style.stroke || l.getAttribute('stroke') || '';
    if (!isDataColor(stroke)) {
      l.style.stroke = '#d1d5db'; // light gray grid
      l.style.strokeWidth = '0.5';
    } else {
      // Make data lines slightly thicker for print
      l.style.strokeWidth = '2';
    }
  });

  // 4. Override axis domain paths
  clone.querySelectorAll('.domain').forEach((d) => {
    (d as SVGElement).style.stroke = '#9ca3af';
    (d as SVGElement).style.strokeWidth = '1';
  });

  // 5. Override tick lines
  clone.querySelectorAll('.tick line').forEach((l) => {
    (l as SVGElement).style.stroke = '#d1d5db';
  });

  // 6. Make data paths (lines, areas) thicker for print
  clone.querySelectorAll('path').forEach((p) => {
    const stroke = p.style.stroke || p.getAttribute('stroke') || '';
    if (isDataColor(stroke)) {
      p.style.strokeWidth = '2.5';
    }
    // Make area fills slightly more opaque
    const fill = p.style.fill || p.getAttribute('fill') || '';
    if (isDataColor(fill) && p.style.opacity) {
      const op = parseFloat(p.style.opacity);
      if (op < 0.5) p.style.opacity = String(Math.min(op * 1.5, 0.4));
    }
  });

  // 7. Make circles (data points) larger
  clone.querySelectorAll('circle').forEach((c) => {
    const r = parseFloat(c.getAttribute('r') || '3');
    c.setAttribute('r', String(Math.max(r, 4)));
  });
}

function inlineStyles(source: Element, target: Element): void {
  const computed = window.getComputedStyle(source);
  const important = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray',
    'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor',
    'dominant-baseline', 'visibility', 'display'];
  for (const prop of important) {
    const val = computed.getPropertyValue(prop);
    if (val) (target as SVGElement).style.setProperty(prop, val);
  }
  for (let i = 0; i < source.children.length; i++) {
    if (target.children[i]) {
      inlineStyles(source.children[i], target.children[i]);
    }
  }
}
