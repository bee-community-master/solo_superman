import { DecisionQueueShell } from "../features/decision-queue/DecisionQueueShell";
import { AppLanguageProvider } from "../shared/i18n/app-language";

export function App() {
  return (
    <AppLanguageProvider>
      <DecisionQueueShell />
    </AppLanguageProvider>
  );
}
