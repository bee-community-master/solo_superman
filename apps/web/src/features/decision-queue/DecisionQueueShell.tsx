import { DecisionQueueDesktopLayout } from "./shell/DecisionQueueDesktopLayout";
import { ImplementationView } from "./shell/ImplementationView";
import { OnboardingView } from "./shell/OnboardingView";
import { PermissionsView } from "./shell/PermissionsView";
import { PlanningView } from "./shell/PlanningView";
import { QuestionsView } from "./shell/QuestionsView";
import { ResearchView } from "./shell/ResearchView";
import { RightRail } from "./shell/RightRail";
import { useDecisionQueueShellController } from "./shell/useDecisionQueueShellController";

export function DecisionQueueShell() {
  const controller = useDecisionQueueShellController();

  return (
    <DecisionQueueDesktopLayout controller={controller} rightRail={<RightRail controller={controller} />}>
      {controller.activePage === "onboarding" ? <OnboardingView controller={controller} /> : null}
      {controller.activePage === "questions" ? <QuestionsView controller={controller} /> : null}
      {controller.activePage === "research" ? <ResearchView controller={controller} /> : null}
      {controller.activePage === "planning" ? <PlanningView controller={controller} /> : null}
      {controller.activePage === "implementation" ? <ImplementationView controller={controller} /> : null}
      {controller.activePage === "permissions" ? <PermissionsView controller={controller} /> : null}
    </DecisionQueueDesktopLayout>
  );
}
