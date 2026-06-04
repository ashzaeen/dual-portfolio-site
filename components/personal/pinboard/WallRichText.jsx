// Minimal Notion rich-text renderer for wall paper items (Subway receipt,
// boarding-pass journal). Unlike the story-side RichText, this maps
// italic → <em> and bold → <strong> so the existing CSS hooks apply —
// notably `.subwayDetail em { color: #1a7a1a }` (italics render green).
//
//   <WallRichText richText={notionArray} />            inline run
//   <WallRichText richText={notionArray} paragraphs />  split on \n into <p>s
//
// Each segment is a Notion rich_text node: { annotations, plain_text, text }.

function renderSegment(rt, key) {
  if (rt.type !== "text") return null;
  const { bold, italic, underline, code } = rt.annotations || {};
  const content = rt.text?.content ?? rt.plain_text ?? "";
  const href = rt.text?.link?.url;

  let node = content;
  if (code) node = <code key={`c${key}`}>{node}</code>;
  if (italic) node = <em key={`i${key}`}>{node}</em>;
  if (underline) node = <u key={`u${key}`}>{node}</u>;
  if (bold) node = <strong key={`b${key}`}>{node}</strong>;
  if (href) {
    return (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer">
        {node}
      </a>
    );
  }
  return <span key={key}>{node}</span>;
}

// Split a Notion rich_text array into paragraph-level arrays on newlines.
// A "\n" can appear inside a segment's content or as a standalone segment,
// so we walk char-aware: each segment's text is split on \n, and the parts
// inherit that segment's annotations.
function splitParagraphs(richText) {
  const paras = [[]];
  for (const rt of richText) {
    if (rt.type !== "text") {
      paras[paras.length - 1].push(rt);
      continue;
    }
    const content = rt.text?.content ?? rt.plain_text ?? "";
    const pieces = content.split("\n");
    pieces.forEach((piece, idx) => {
      if (idx > 0) paras.push([]); // newline starts a new paragraph
      if (piece) {
        paras[paras.length - 1].push({
          ...rt,
          text: { ...rt.text, content: piece },
          plain_text: piece,
        });
      }
    });
  }
  // Drop empty paragraphs (e.g. trailing newline / blank lines).
  return paras.filter((p) => p.length > 0);
}

export default function WallRichText({ richText = [], paragraphs = false }) {
  if (!richText || richText.length === 0) return null;

  if (!paragraphs) {
    return <>{richText.map((rt, i) => renderSegment(rt, i))}</>;
  }

  return (
    <>
      {splitParagraphs(richText).map((para, pi) => (
        <p key={pi}>{para.map((rt, i) => renderSegment(rt, `${pi}-${i}`))}</p>
      ))}
    </>
  );
}
