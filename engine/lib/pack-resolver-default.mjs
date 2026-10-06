// The type a site.config.json without "type" builds as, in Phase 1 only
// (the build warns "type-missing"). This file is the one place in engine/
// allowed to name a type; tools/engine-lint.mjs and the Phase 1 acceptance
// grep exclude it by name.
export const DEFAULT_TYPE = 'social-casino';
