/* First run: nothing has been saved yet, so explain where data comes from. */
export function EmptyState({ dir }: { dir: string }) {
  return (
    <section className="card items-center gap-5 px-6 py-11 text-center">
      <div className="ring" aria-hidden />
      <div>
        <h2 className="mb-1.5 text-[19px] font-semibold">No assessments yet</h2>
        <p className="text-[13px] text-muted">
          This dashboard shows what the terminal app saves. Nothing is in <code className="font-mono">{dir}</code> yet.
        </p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-3 p-0 text-left text-[13.5px] [counter-reset:step]">
        {[
          <>
            Run <code className="font-mono text-accent">python -m reconix</code> in a terminal.
          </>,
          <>Start an assessment. It is saved here as it runs, without passwords or codes.</>,
          <>Come back: this page fills in by itself.</>,
        ].map((step, i) => (
          <li key={i} className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-3">
            <span className="grid size-[30px] place-items-center rounded-full font-mono text-[12.5px] font-semibold text-accent shadow-[var(--raise-sm)]">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
