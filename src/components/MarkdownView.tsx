import { useMemo } from 'react';
import { renderMarkdown } from '../lib/markdown';
import styles from './MarkdownView.module.css';

interface MarkdownViewProps {
  source: string;
}

export function MarkdownView({ source }: MarkdownViewProps) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  // Seguro: `renderMarkdown` pasa siempre por DOMPurify antes de devolver el HTML.
  return <article className={styles.markdown} dangerouslySetInnerHTML={{ __html: html }} />;
}
