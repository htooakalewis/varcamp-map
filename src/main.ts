import { initializeWorld } from './runtime';
import { registerGuideMenu } from './guides/menu';
void initializeWorld(WA).then(() => registerGuideMenu(WA)).catch(() => { console.warn('VarCamp scripting unavailable. Physical venue exits remain available.'); });
