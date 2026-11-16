// The one orchestrator for this play session, shared by every scene.

import { state } from "./beats.js";
import { llm } from "./llm.js";
import { createDirector } from "./director.js";

export const director = createDirector({ state, llm });
