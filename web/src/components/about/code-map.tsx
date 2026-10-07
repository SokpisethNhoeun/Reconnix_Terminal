/* Where things live: the terminal app's package and this dashboard's source, one line each. */
import { Card } from "@/components/neu/card";

import { CODE_MAP } from "./content";

export function CodeMap() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {CODE_MAP.map((area) => (
        <Card key={area.root} title={area.root} hint={area.title}>
          <dl className="m-0 grid grid-cols-[minmax(0,96px)_minmax(0,1fr)] sm:grid-cols-[minmax(0,130px)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]">
            {area.entries.map((e) => (
              <div key={e.path} className="contents">
                <dt className="font-mono text-[12.5px] text-accent [overflow-wrap:anywhere]">{e.path}</dt>
                <dd className="m-0 text-muted">{e.about}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}
