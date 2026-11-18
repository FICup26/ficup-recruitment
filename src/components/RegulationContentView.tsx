import { Fragment } from 'react';

type RegulationBlock =
  | { type: 'title'; text: string }
  | { type: 'subtitle'; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

function parseRegulationBlocks(rawText: string): RegulationBlock[] {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const blocks: RegulationBlock[] = [];

  let currentParagraph: string[] = [];
  let currentUl: string[] = [];
  let currentOl: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'paragraph', lines: currentParagraph });
      currentParagraph = [];
    }
  };

  const flushUl = () => {
    if (currentUl.length > 0) {
      blocks.push({ type: 'ul', items: currentUl });
      currentUl = [];
    }
  };

  const flushOl = () => {
    if (currentOl.length > 0) {
      blocks.push({ type: 'ol', items: currentOl });
      currentOl = [];
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushUl();
    flushOl();
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushAll();
      const subtitleText = trimmed.slice(3).trim();
      if (subtitleText) {
        blocks.push({ type: 'subtitle', text: subtitleText });
      }
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushAll();
      const titleText = trimmed.slice(2).trim();
      if (titleText) {
        blocks.push({ type: 'title', text: titleText });
      }
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch?.[1]) {
      flushParagraph();
      flushOl();
      currentUl.push(ulMatch[1].trim());
      continue;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch?.[1]) {
      flushParagraph();
      flushUl();
      currentOl.push(olMatch[1].trim());
      continue;
    }

    flushUl();
    flushOl();
    currentParagraph.push(trimmed);
  }

  flushAll();
  return blocks;
}

interface RegulationContentViewProps {
  content: string;
  emptyMessage?: string;
}

export function RegulationContentView({
  content,
  emptyMessage = 'Nessun contenuto testuale disponibile.',
}: RegulationContentViewProps) {
  const clean = content.trim();
  if (!clean) {
    return <p className="text-xs sm:text-sm text-slate-500 italic">{emptyMessage}</p>;
  }

  const blocks = parseRegulationBlocks(clean);

  return (
    <div className="space-y-3.5 text-slate-800 break-words">
      {blocks.map((block, index) => {
        if (block.type === 'title') {
          return (
            <h4
              key={index}
              className="pt-2 first:pt-0 pb-1.5 border-b border-slate-200 font-display text-base sm:text-lg font-extrabold text-[#0B1F4D]"
            >
              {block.text}
            </h4>
          );
        }

        if (block.type === 'subtitle') {
          return (
            <h5
              key={index}
              className="pt-1 font-display text-sm sm:text-base font-bold text-[#153985]"
            >
              {block.text}
            </h5>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul
              key={index}
              className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed marker:text-[#C69214]"
            >
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{item}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol
              key={index}
              className="list-decimal pl-5 space-y-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed marker:font-mono-tabular marker:font-bold marker:text-[#0B1F4D]"
            >
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{item}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={index} className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {block.lines.map((line, lineIdx) => (
              <Fragment key={lineIdx}>
                {lineIdx > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
