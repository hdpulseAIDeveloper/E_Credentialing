import type { LegalBlock, LegalDocument } from "@/lib/legal/copy";

interface LegalDocumentRendererProps {
  document: LegalDocument;
}

export function LegalDocumentRenderer({ document }: LegalDocumentRendererProps) {
  const effective =
    document.effectiveDate ??
    `pending Legal sign-off (status: ${document.status})`;

  return (
    <article className="prose prose-slate max-w-none">
      <header className="not-prose mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900">{document.title}</h1>
        {document.lead ? (
          <p className="mt-3 text-base text-gray-600">{document.lead}</p>
        ) : null}
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-500 sm:grid-cols-3">
          <div>
            <dt className="inline font-semibold text-gray-700">Version: </dt>
            <dd className="inline">{document.version}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-700">Status: </dt>
            <dd className="inline">{document.status}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-700">Effective: </dt>
            <dd className="inline">{effective}</dd>
          </div>
        </dl>
      </header>

      <div className="space-y-4">
        {document.blocks.map((block, index) => (
          <BlockRenderer key={index} block={block} />
        ))}
      </div>
    </article>
  );
}

function BlockRenderer({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "heading": {
      const className =
        block.level === 2
          ? "mt-8 text-xl font-semibold text-gray-900"
          : "mt-6 text-lg font-semibold text-gray-900";
      return block.level === 2 ? (
        <h2 className={className}>{block.text}</h2>
      ) : (
        <h3 className={className}>{block.text}</h3>
      );
    }
    case "paragraph":
      return <p className="text-sm leading-relaxed text-gray-700">{block.text}</p>;
    case "callout":
      return (
        <p className="rounded-md border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
          {block.text}
        </p>
      );
    case "list": {
      const items = block.items.map((item, i) => (
        <li key={i} className="text-sm leading-relaxed text-gray-700">
          {item}
        </li>
      ));
      return block.ordered ? (
        <ol className="ml-6 list-decimal space-y-1">{items}</ol>
      ) : (
        <ul className="ml-6 list-disc space-y-1">{items}</ul>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                {block.headers.map((header, i) => (
                  <th
                    key={i}
                    className="border border-gray-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-700"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="even:bg-gray-50/50">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border border-gray-200 px-3 py-2 align-top text-gray-700"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default: {
      // Exhaustive check — should never happen.
      const _exhaustive: never = block;
      return null;
    }
  }
}
