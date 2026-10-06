// Check sections of the social-casino type pack (engine/tools/check.mjs loads
// this file for every site of the type). Each section is
//   { id, title, group?, after, run(t) }
// `after` places it in the engine's order; `group` is the --only id it also
// answers to (default: its own id). Ids are unique across the engine and every
// pack (MASTER-PLAN D-53); `policy` arrives with the policy-urls lint in Phase 2.
//
// The sections read site fixtures from t.fx (sites/<slug>/checks.json, schema
// engine/tools/checks.schema.json), the builds from t.builds (pack.checks.builds)
// and every helper from t.harness, so nothing here imports engine paths.
import stage from './stage.mjs';
import tables from './tables.mjs';
import lobby from './lobby.mjs';

export const sections = [...stage, ...tables, ...lobby];
export default sections;
