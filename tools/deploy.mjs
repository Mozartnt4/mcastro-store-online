import { spawnSync } from 'node:child_process';
import { configureD1 } from './configure-d1.mjs';
import { originalWrangler } from './wrangler-guard.mjs';

await configureD1({required:true});
const result=spawnSync(process.execPath,[originalWrangler(),'deploy'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
