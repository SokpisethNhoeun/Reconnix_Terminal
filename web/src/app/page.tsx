/* The Local Assessment Viewer at `/`, rendered per request from the assessments the Reconix
   TUI saved (src/lib/data/store.ts). With no `?uid=` the Overview totals every saved run
   (derive-overall.ts) and Findings lists them all; `?uid=` opens one run (derive.ts). `?view=` is
   the open view, read by the client Viewer. The terminal is rendered only when the server says
   this browser may use it (lib/auth/guard.ts); the AI Assistant learns what it is about, whether
   this browser may ask (operator role) and which model answers (lib/assistant/config.ts). */
import type { AssistantInfo } from "@/components/assistant/types";
import { deriveDashboard } from "@/components/dashboard/derive";
import { deriveOverall } from "@/components/dashboard/derive-overall";
import { EmptyView } from "@/components/dashboard/empty-view";
import { FindingsView } from "@/components/dashboard/findings-view";
import { OverviewView } from "@/components/dashboard/overview-view";
import { ReportsView } from "@/components/dashboard/reports-view";
import { RunPicker } from "@/components/dashboard/run-picker";
import { ScopeView } from "@/components/dashboard/scope-view";
import { TopBar } from "@/components/dashboard/top-bar";
import { Viewer } from "@/components/dashboard/viewer";
import { TerminalView } from "@/components/terminal/terminal-view";
import { modelSummary } from "@/lib/assistant/config";
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
  const model = modelSummary();
  const assistant: AssistantInfo = {
    scope: dash
      ? {
          uid: dash.assessment.uid,
          label: dash.assessment.id,
          detail: [dash.assessment.template, dash.assessment.target, dash.assessment.status].join(" · "),
          chips: [`${dash.findingTotal} findings`, `${dash.checks.blocked} blocked`, `${dash.assessment.progress}% done`],
        }
      : {
          uid: null,
          label: "All assessments",
          detail: overall ? `${overall.runs} saved ${overall.runs === 1 ? "run" : "runs"}` : "nothing saved yet",
          chips: overall ? [`${overall.findingTotal} findings`, `${overall.waiting} waiting`, `${overall.completed} completed`] : [],
        },
    questions: (dash ?? overall)?.cards.ask.questions ?? [],
    operator: hasRole(role, "operator"),
    model: { configured: model.configured, name: model.model, local: model.local, reason: model.reason },
  };
  const empty = <EmptyView dir={dir} problems={library.problems} compact />;
  // Reports and Scope belong to one run: with every run shown, pick one first.
  const pick = (title: string, about: string) => (overall ? <RunPicker title={title} about={about} items={items} /> : empty);

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
      findings={
        dash ? (
          <FindingsView key={dash.assessment.uid} findings={dash.findings} />
        ) : overall ? (
          <FindingsView key="all" findings={overall.findings} across={overall.runs} />
        ) : (
          empty
        )
      }
      reports={dash ? <ReportsView dash={dash} /> : pick("Report", "Reports are made per assessment. Pick one to see its summary and downloads.")}
      scope={dash ? <ScopeView dash={dash} /> : pick("Scope", "Each assessment has its own approved scope. Pick one to see it.")}
      terminal={<TerminalView access={access} />}
      terminalState={access}
      assistant={assistant}
    />
  );
}
