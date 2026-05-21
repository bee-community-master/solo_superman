import { DecisionQueueShell } from "../features/decision-queue/DecisionQueueShell";
import { AppLanguageProvider } from "../shared/i18n/app-language";
import { AppErrorBoundary } from "./AppErrorBoundary";

export function App() {
  return (
    <AppLanguageProvider>
      <AppErrorBoundary>
        <DecisionQueueShell />
      </AppErrorBoundary>
    </AppLanguageProvider>
  );
}
