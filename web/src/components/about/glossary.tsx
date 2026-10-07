/* The words the terminal app and this dashboard use, each with one line of meaning. */
import { GLOSSARY } from "./content";

export function Glossary() {
  return (
    <dl className="card m-0 grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
      {GLOSSARY.map((t) => (
        <div key={t.term} className="rail">
          <dt className="font-mono text-[12.5px] font-semibold text-text">{t.term}</dt>
          <dd className="m-0 text-[13px] text-muted">{t.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}
