/* How the pieces fit, drawn as two paths of nodes joined by connectors (a pulse travels
   along each, like the landing's stack diagram): left to right on wide screens, top to
   bottom on narrow ones. */
import { Fragment } from "react";

import { DATA_PATHS } from "./content";

export function DataPaths() {
  return (
    <div className="card gap-7">
      {DATA_PATHS.map((path) => (
        <section key={path.title} className="flex flex-col gap-3" aria-label={path.title}>
          <h3 className="eyebrow text-muted">{path.title}</h3>
          <ol className="path m-0 list-none p-0">
            {path.nodes.map(({ icon: Icon, title, sub }, i) => (
              <Fragment key={title}>
                {i > 0 && <li className="path-link" aria-hidden />}
                <li className="path-node">
                  <span className="icon-tile" aria-hidden>
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[13.5px] font-semibold">{title}</b>
                    <span className="block font-mono text-[11.5px] text-muted [overflow-wrap:anywhere]">{sub}</span>
                  </span>
                </li>
              </Fragment>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
