/** Transition-only structural contract. No dependency on Reports' implementation. */
interface ReportResult {
  readonly definitionPath: string;
  readonly status: string;
  readonly message: string;
}
interface ReportsCapability {
  readonly version: 1;
  generateDefinition(path: string): Promise<ReportResult>;
  generateAll(): Promise<readonly ReportResult[]>;
  showResults(results: readonly ReportResult[]): void;
}
interface CommandHost {
  readonly app: {
    readonly workspace: { getActiveFile(): { path: string; extension: string } | null };
    readonly murmurationReports?: ReportsCapability;
  };
  addCommand(command: { id: string; name: string; callback: () => void }): unknown;
}

/** Keep the old full command IDs/hotkeys for one MWC release. Resolve at invocation. */
export function installReportsCommandBridge(host: CommandHost, notice: (message: string) => void): void {
  const run = async (all: boolean) => {
    const file = host.app.workspace.getActiveFile();
    const path = file?.extension === 'md' ? file.path : null;
    const reports = host.app.murmurationReports;
    if (!reports || reports.version !== 1) {
      notice('Enable Murmuration Reports to generate reports. Existing saved outputs remain available.');
      return;
    }
    if (!all && !path) { notice('Open a report definition note first.'); return; }
    try {
      const results = all ? await reports.generateAll() : [await reports.generateDefinition(path!)];
      reports.showResults(results);
    } catch (error) { notice(`Could not generate reports: ${error instanceof Error ? error.message : String(error)}`); }
  };
  host.addCommand({ id: 'generate-derived-artefact', name: 'Generate derived artefact', callback: () => { void run(false); } });
  host.addCommand({ id: 'generate-all-derived-artefacts', name: 'Generate all derived artefacts', callback: () => { void run(true); } });
}
