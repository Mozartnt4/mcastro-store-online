import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

// Resolve apenas o banco existente; nunca cria ou substitui bancos.
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
if (!config.d1_databases?.some(binding => binding.binding === 'DB' && binding.database_id)) {
  const databases = JSON.parse(execFileSync('wrangler', ['d1', 'list', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
  const matches = databases.filter(database => database.name === 'mcastro-database');
  if (matches.length !== 1 || !matches[0].uuid) {
    throw new Error('Publicação interrompida: banco existente mcastro-database não localizado. Configure DB em wrangler.jsonc.');
  }
  config.d1_databases = [{ binding: 'DB', database_name: matches[0].name, database_id: matches[0].uuid }];
}
const temporaryConfig = 'wrangler.deploy.generated.json';
writeFileSync(temporaryConfig, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
try {
  execFileSync('wrangler', ['deploy', '--config', temporaryConfig], { stdio: 'inherit' });
} finally {
  unlinkSync(temporaryConfig);
}
