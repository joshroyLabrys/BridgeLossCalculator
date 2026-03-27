// src/components/pdf-chart-capture.ts

export interface CapturedChart {
  id: string;
  label: string;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Find all SVG charts in the DOM by data-chart-id attribute,
 * render each to an offscreen canvas at 2x resolution, and
 * return PNG data URLs.
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

function svgToDataUrl(svg: SVGSVGElement, scale: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = svg.clientWidth || 600;
    const h = svg.clientHeight || 300;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    inlineStyles(svg, clone);

    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to rasterize chart: ${svg.getAttribute('data-chart-id') || 'unknown'}`));
    };
    img.src = url;
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
