import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Los enlaces externos se abren fuera de la app: en una PWA standalone un <a> normal
// reemplazaría la propia app por la web enlazada, sin botón de volver.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Markdown (GFM) → HTML saneado. `breaks: false` replica la vista previa de VS Code: un salto
 * de línea simple dentro de un párrafo no rompe la línea. El saneado con DOMPurify es lo que
 * hace seguro inyectar el resultado con `dangerouslySetInnerHTML` (un `.md` con `<script>`,
 * `onerror=`, `javascript:`… queda neutralizado).
 */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { gfm: true, breaks: false, async: false });
  return DOMPurify.sanitize(html);
}
