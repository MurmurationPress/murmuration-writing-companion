import MurmurationWritingCompanionPlugin from "./main";
import { installManuscriptPreparationCommands } from "./manuscript/ManuscriptPreparationCommands";

export default class MurmurationWritingCompanionEntry extends MurmurationWritingCompanionPlugin {
  async onload() {
    await super.onload();
    installManuscriptPreparationCommands(this);
  }
}
