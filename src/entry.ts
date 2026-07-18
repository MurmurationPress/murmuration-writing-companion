import MurmurationWritingCompanionPlugin from "./main";
import { installManuscriptPreparationCommands } from "./manuscript/ManuscriptPreparationCommands";
import { installManuscriptReconciliationCommands } from "./manuscript/ManuscriptReconciliationCommands";

export default class MurmurationWritingCompanionEntry extends MurmurationWritingCompanionPlugin {
  async onload() {
    await super.onload();
    installManuscriptPreparationCommands(this);
    installManuscriptReconciliationCommands(this);
  }
}
