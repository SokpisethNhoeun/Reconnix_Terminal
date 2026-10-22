/* The Local Assessment Viewer at `/`, rendered per request from the assessments the Reconix
   TUI saved (src/lib/data/store.ts). With no `?uid=` the Overview totals every saved run
   (derive-overall.ts), Findings lists them all, and Scope and Report sum them up
   (derive-scope.ts, derive-report.ts); `?uid=` opens one run (derive.ts). `?view=` is
   the open view, read by the client Viewer. The terminal is rendered only when the server says
   this browser may use it (lib/auth/guard.ts); the AI Assistant learns what it is about, whether
   this browser may ask (operator role), which model answers (lib/assistant/models/resolve.ts) and what
   to suggest, from the data in scope (lib/assistant/prompts.ts). */
import type { AssistantInfo } from "@/components/assistant/types";
import { deriveDashboard } from "@/components/dashboard/derive";
import { deriveOverall } from "@/components/dashboard/derive-overall";
import { assessmentsCards, overallReportCards, reportCards, runRow } from "@/components/dashboard/derive-report";
import { overallScopeCards, scopeCards } from "@/components/dashboard/derive-scope";
import { AssessmentsView } from "@/components/dashboard/assessments-view";
import { EmptyView } from "@/components/dashboard/empty-view";
import { FindingsView } from "@/components/dashboard/findings-view";
import { OverviewView } from "@/components/dashboard/overview-view";
import { ReportsView } from "@/components/dashboard/reports-view";
import { ScopeView } from "@/components/dashboard/scope-view";
import { TopBar } from "@/components/dashboard/top-bar";
import { Viewer } from "@/components/dashboard/viewer";
import { TerminalView } from "@/components/terminal/terminal-view";
import { retentionDays } from "@/lib/assistant/history-store";
import { activeModel } from "@/lib/assistant/models/resolve";
import { runRef, scopedViews, scopeOf } from "@/lib/assistant/insights";
import { welcomePrompts } from "@/lib/assistant/prompts";
import { currentRole, terminalAccess } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/session";
import { assessmentView, libraryItem } from "@/lib/data/adapt";
import { clock } from "@/lib/data/format";
import { loadLibrary, shownDir, UID } from "@/lib/data/store";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Home({ searchParams }: Props) {
  const [params, library, access, role] = await Promise.all([searchParams, loadLibrary(), terminalAccess(), currentRole()]);
  const wanted = typeof params.uid === "string" && UID.test(params.uid) ? params.uid : null;
  const views = library.assessments.map(assessmentView);
  const chosen = views.find((v) => v.uid === wanted) ?? null;
  const dash = chosen ? deriveDashboard(chosen) : null;
  const overall = !chosen && views.length ? deriveOverall(views) : null;
  const items = library.assessments.map(libraryItem);
  const dir = shownDir(library.dir);
  const terminal = access === "operator";
  const { summary: model } = await activeModel();
  const assistant: AssistantInfo = {
    scope: scopeOf(chosen),
    runs: scopedViews(views, null).map((v) => ({ ...runRef(v), status: v.status })),
    prompts: welcomePrompts(scopedViews(views, chosen?.uid ?? null)),
    operator: hasRole(role, "operator"),
    terminal,
    retentionDays: retentionDays(),
    model,
  };
  const empty = <EmptyView dir={dir} problems={library.problems} compact />;
  const runs = views.map(runRow); // once: the Assessments view and the all-runs Report share it
  const scope = chosen ? scopeCards(chosen) : overall ? overallScopeCards(views) : null;
  const report = chosen && dash ? reportCards(chosen, dash.findings, dash.cards.findings) : overall ? overallReportCards(views, overall.cards.findings, runs) : null;

  return (
    <Viewer
      topBar={
        <TopBar
          dash={dash}
          overall={overall}
          items={items}
          dir={dir}
          renderedAt={clock(library.readAt)}
          skipped={library.problems}
          terminal={terminal}
        />
      }
      overview={
        dash ? (
          <OverviewView cards={dash.cards} />
        ) : overall ? (
          <OverviewView cards={overall.cards} />
        ) : (
          <EmptyView dir={dir} problems={library.problems} />
        )
      }
      assessments={runs.length ? <AssessmentsView data={assessmentsCards(runs)} /> : empty}
      findings={
        dash ? (
          <FindingsView key={dash.assessment.uid} findings={dash.findings} />
        ) : overall ? (
          <FindingsView key="all" findings={overall.findings} across={overall.runs} />
        ) : (
          empty
        )
      }
      reports={report ? <ReportsView key={chosen?.uid ?? "all"} data={report} /> : empty}
      scope={scope ? <ScopeView data={scope} /> : empty}
      terminal={<TerminalView access={access} />}
      terminalState={access}
      assistant={assistant}
    />
  );
}
