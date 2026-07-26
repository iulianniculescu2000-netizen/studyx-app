import { formatMessage } from './shared';

/**
 * Renders AI-authored text with the same markdown pipeline as the chat —
 * headings, lists, tables, schemas — so every AI surface in the app reads the
 * same way instead of dumping one raw paragraph.
 *
 * The pipeline HTML-escapes model text before formatting, so this is safe to
 * feed straight into the DOM.
 */
export default function AIRichText({
  text,
  className = '',
  style,
}: {
  text: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!text?.trim()) return null;
  return (
    <div
      className={`ai-rich-text ${className}`.trim()}
      style={style}
      dangerouslySetInnerHTML={{ __html: formatMessage(text) }}
    />
  );
}
