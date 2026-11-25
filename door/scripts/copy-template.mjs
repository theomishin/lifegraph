// Ship the starter LifeGraph inside the door so `lifegraph init` works offline.
import { cpSync, rmSync } from "node:fs";
rmSync("template", { recursive: true, force: true });
cpSync("../template", "template", { recursive: true });
