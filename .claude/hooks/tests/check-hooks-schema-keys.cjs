#!/usr/bin/env node
// Adapted from everything-claude-code scripts/ci/check-hooks-schema-keys.js @ ef648e01 (c) 2026 Affaan Mustafa, MIT. Modifications (c) 2026 the site factory studio, MIT.
// Factory changes: the file to check is the first argument (default .claude/settings.json); a settings
// file carries permissions/env/etc. at the root, so only its `hooks` subtree is checked (root keys are
// checked when the file is a bare hooks config); the Codex key set is dropped (not a factory surface).
/**
 * Fail when a hooks config carries keys outside its loader's documented set.
 *
 * Claude Code validates hooks against its own schema at load time and prints
 * "unknown keys ... ignored" for anything else (issues #3138 and #3114). The
 * documented set for Claude Code is:
 *   root:    hooks
 *   group:   matcher, hooks
 *   handler: the keys defined by schemas/hooks.schema.json hook item types
 *            plus statusMessage (recognized by the loader, absent from the
 *            local schema).
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(process.argv[2] || path.join(__dirname, '../../settings.json'));

const KEY_SET = {
  label: 'Claude Code',
  file: FILE,
  rootKeys: ['hooks'],
  groupKeys: ['matcher', 'hooks'],
  handlerKeys: [
    'type', 'command', 'timeout', 'statusMessage', 'async',
    'url', 'headers', 'allowedEnvVars', 'prompt', 'model',
  ],
  // Event names: the propertyNames enum of ECC schemas/hooks.schema.json, plus StopFailure
  // (a current Claude Code event that ECC's schema predates; factory extension, MASTER-PLAN 5.4).
  events: [
    'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse',
    'PostToolUseFailure', 'Notification', 'SubagentStart', 'Stop', 'SubagentStop', 'PreCompact',
    'InstructionsLoaded', 'TeammateIdle', 'TaskCompleted', 'ConfigChange', 'WorktreeCreate',
    'WorktreeRemove', 'SessionEnd', 'StopFailure',
  ],
  // Events whose entries must carry a matcher (ECC schema patternProperties -> managedMatcherRequiredEntry).
  matcherRequired: [
    'SessionStart', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'PostToolUseFailure',
    'SubagentStart', 'PreCompact', 'InstructionsLoaded', 'TeammateIdle', 'TaskCompleted',
    'ConfigChange', 'WorktreeCreate', 'WorktreeRemove', 'SessionEnd',
  ],
};

/**
 * Collect every key outside the documented set for one parsed hooks config.
 *
 * @param {object} data - Parsed hooks config.
 * @param {object} keySet - KEY_SET.
 * @param {boolean} checkRoot - false for a settings.json (other root keys are legitimate there).
 * @returns {string[]} human-readable findings
 */
function findUnknownKeys(data, keySet, checkRoot) {
  const findings = [];
  const fileLabel = path.basename(keySet.file);

  if (checkRoot) {
    for (const key of Object.keys(data)) {
      if (!keySet.rootKeys.includes(key)) {
        findings.push(`${fileLabel}: root key "${key}" is not in the ${keySet.label} documented set`);
      }
    }
  }

  const events = data.hooks && typeof data.hooks === 'object' && !Array.isArray(data.hooks)
    ? data.hooks
    : {};
  for (const [eventType, groups] of Object.entries(events)) {
    if (!keySet.events.includes(eventType)) {
      findings.push(`${fileLabel}: hook event "${eventType}" is not a known ${keySet.label} event`);
    }
    if (Array.isArray(groups) && keySet.matcherRequired.includes(eventType)) {
      groups.forEach((group, groupIndex) => {
        if (group && typeof group === 'object' && !(typeof group.matcher === 'string' && group.matcher)) {
          findings.push(`${fileLabel}: ${eventType}[${groupIndex}] needs a matcher (schemas/hooks.schema.json)`);
        }
      });
    }
    if (!Array.isArray(groups)) {
      findings.push(`${fileLabel}: hooks.${eventType} must be an array`);
      continue;
    }
    groups.forEach((group, groupIndex) => {
      if (!group || typeof group !== 'object' || Array.isArray(group)) return;
      for (const key of Object.keys(group)) {
        if (!keySet.groupKeys.includes(key)) {
          findings.push(
            `${fileLabel}: ${eventType}[${groupIndex}] key "${key}" is not in the ${keySet.label} documented set`
          );
        }
      }
      if (!Array.isArray(group.hooks)) return;
      group.hooks.forEach((handler, handlerIndex) => {
        if (!handler || typeof handler !== 'object' || Array.isArray(handler)) return;
        for (const key of Object.keys(handler)) {
          if (!keySet.handlerKeys.includes(key)) {
            findings.push(
              `${fileLabel}: ${eventType}[${groupIndex}].hooks[${handlerIndex}] key "${key}" `
              + `is not in the ${keySet.label} documented set`
            );
          }
        }
      });
    });
  }

  return findings;
}

function checkHooksSchemaKeys() {
  const keySet = KEY_SET;
  if (!fs.existsSync(keySet.file)) {
    console.error(`ERROR: ${keySet.file} not found`);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(keySet.file, 'utf-8'));
  } catch (e) {
    console.error(`ERROR: Invalid JSON in ${keySet.file}: ${e.message}`);
    process.exit(1);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    console.error(`ERROR: ${keySet.file} must contain a JSON object`);
    process.exit(1);
  }
  const isSettings = !(Object.keys(data).length === 1 && 'hooks' in data);
  const findings = findUnknownKeys(data, keySet, !isSettings);

  if (findings.length > 0) {
    for (const finding of findings) console.error(`ERROR: ${finding}`);
    console.error(`\n${findings.length} key(s) outside the documented loader set`);
    process.exit(1);
  }

  console.log(`Checked ${path.basename(keySet.file)}: all hook keys within the documented ${keySet.label} loader set`);
}

checkHooksSchemaKeys();
