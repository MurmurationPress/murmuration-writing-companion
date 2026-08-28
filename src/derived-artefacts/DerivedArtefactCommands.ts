import { Notice } from "obsidian";
import { createObsidianDerivedArtefactService } from "./ObsidianDerivedArtefactService";

interface CommandHost {
  readonly app: import("obsidian").App;
  addCommand(command: { readonly id: string; readonly name: string; readonly callback: () => void }): unknown;
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export function installDerivedArtefactCommands(host: CommandHost): void {
  host.addCommand({
    id: "generate-derived-artefact",
    name: "Generate derived artefact",
    callback: () => {
      const file = host.app.workspace.getActiveFile();
      if (!file || file.extension !== "md") { new Notice("Open a derived-artefact definition note first."); return; }
      const service = createObsidianDerivedArtefactService(host.app);
      void service.generate(file.path)
        .then((result) => new Notice(`Generated ${result.outputPath} from ${result.observations} observations.`))
        .catch((error) => new Notice(`Could not generate derived artefact: ${message(error)}`, 10000));
    }
  });
  host.addCommand({
    id: "generate-all-derived-artefacts",
    name: "Generate all derived artefacts",
    callback: () => {
      const service = createObsidianDerivedArtefactService(host.app);
      void (async () => {
        const definitions = service.definitions();
        if (definitions.length === 0) { new Notice("No derived-artefact definitions were found."); return; }
        const failures: string[] = [];
        let generated = 0;
        for (const definition of definitions) {
          try { await service.generate(definition.path); generated += 1; }
          catch (error) { failures.push(message(error)); }
        }
        if (failures.length) new Notice(`Generated ${generated} of ${definitions.length} derived artefacts. ${failures.join(" ")}`, 15000);
        else new Notice(`Generated ${generated} derived artefact${generated === 1 ? "" : "s"}.`);
      })().catch((error) => new Notice(`Could not generate derived artefacts: ${message(error)}`, 10000));
    }
  });
}
