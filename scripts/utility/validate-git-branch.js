#!/usr/bin/env node

/**
 * Branch Name Validation Script
 *
 * Validates git branch names against the conventional branch naming convention:
 *   <type>/<description>
 *
 * Where:
 *   - type: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, release
 *   - description: lowercase letters, numbers, and hyphens (no spaces or underscores)
 *   - release branches: release/vX.Y.Z or release/X.Y.Z (semantic versioning)
 *   - dependabot branches: dependabot/<ecosystem>/<dependency-name-and-version>
 *
 * Examples:
 *   ✅ feat/user-dashboard
 *   ✅ fix/login-validation
 *   ✅ chore/update-dependencies
 *   ✅ release/v2.0.0
 *   ✅ release/1.5.3
 *   ✅ dependabot/github_actions/actions/download-artifact-8
 *   ❌ my-feature
 *   ❌ feature_user_dashboard
 *   ❌ Fix/something
 */

import { execSync } from 'child_process';

export const VALID_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
  'release',
];

export const PROTECTED_BRANCHES = ['main', 'master', 'develop', 'staging', 'production'];

export const BRANCH_PATTERN = new RegExp(`^(${VALID_TYPES.join('|')})/([a-z0-9-]+)$`);

// Pattern for release branches: release/vX.Y.Z or release/X.Y.Z
export const RELEASE_BRANCH_PATTERN = /^release\/v?(\d+)\.(\d+)\.(\d+)$/;

// Pattern for Dependabot branches: dependabot/<ecosystem>/<dependency-name-and-version>
// Ecosystem uses lowercase letters, digits, and underscores (e.g. github_actions, npm_and_yarn).
// The dependency segment may contain slashes, dots, hyphens, underscores, and digits.
export const DEPENDABOT_BRANCH_PATTERN = /^dependabot\/([a-z0-9_]+)\/([a-z0-9._\-/]+)$/i;

/**
 * Validates a branch name against the conventional branch naming convention.
 * @param {string} branchName - The branch name to validate
 * @returns {{ valid: boolean, error?: string, type?: string, description?: string }}
 */
export function validateBranchName(branchName) {
  // Allow empty branch name (detached HEAD state)
  if (!branchName) {
    return { valid: true };
  }

  // Allow protected branches
  if (PROTECTED_BRANCHES.includes(branchName)) {
    return { valid: true, type: 'protected', description: branchName };
  }

  // Allow HEAD (detached state)
  if (branchName === 'HEAD') {
    return { valid: true };
  }

  // Check for release branches first (special pattern)
  if (branchName.startsWith('release/')) {
    const releaseMatch = branchName.match(RELEASE_BRANCH_PATTERN);

    if (releaseMatch) {
      const [, major, minor, patch] = releaseMatch;
      return {
        valid: true,
        type: 'release',
        description: `v${major}.${minor}.${patch}`,
      };
    }

    return {
      valid: false,
      error: `Invalid release branch format in "${branchName}"

Release branches must follow semantic versioning: release/vX.Y.Z or release/X.Y.Z
Where X, Y, Z are non-negative integers.

Examples:
  ✅ release/v2.0.0
  ✅ release/1.5.3
  ✅ release/v0.1.0
  ❌ ${branchName}`,
    };
  }

  // Check for Dependabot branches (special pattern)
  const dependabotMatch = branchName.match(DEPENDABOT_BRANCH_PATTERN);
  if (dependabotMatch) {
    const [, ecosystem, dependency] = dependabotMatch;
    return {
      valid: true,
      type: 'dependabot',
      description: `${ecosystem}/${dependency}`,
    };
  }

  // Check against pattern
  const match = branchName.match(BRANCH_PATTERN);

  if (!match) {
    // Provide helpful error message
    const hasSlash = branchName.includes('/');

    if (!hasSlash) {
      return {
        valid: false,
        error: `Branch name "${branchName}" must follow the pattern: <type>/<description>

Expected format: <type>/<description>
Valid types: ${VALID_TYPES.join(', ')}

Examples:
  ✅ feat/user-dashboard
  ✅ fix/login-validation
  ✅ chore/update-dependencies
  ❌ ${branchName} (missing type prefix)`,
      };
    }

    const [prefix] = branchName.split('/');

    if (!VALID_TYPES.includes(prefix)) {
      return {
        valid: false,
        error: `Invalid branch type "${prefix}" in "${branchName}"

Valid types: ${VALID_TYPES.join(', ')}

Examples:
  ✅ feat/user-dashboard
  ✅ fix/login-validation
  ❌ ${branchName}`,
      };
    }

    // Type is valid but description is not
    return {
      valid: false,
      error: `Invalid branch description in "${branchName}"

Description must use only lowercase letters, numbers, and hyphens.
No spaces, underscores, or uppercase letters allowed.

Examples:
  ✅ feat/user-dashboard
  ✅ fix/login-validation-123
  ❌ feat/user_dashboard (uses underscore)
  ❌ feat/UserDashboard (uses uppercase)
  ❌ feat/user dashboard (uses space)`,
    };
  }

  const [, type, description] = match;
  return { valid: true, type, description };
}

/**
 * Gets the current git branch name.
 * @returns {string}
 */
export function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Main entry point for CLI usage.
 */
function main() {
  const args = process.argv.slice(2);

  // Handle --help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Branch Name Validation

Usage:
  node validate-git-branch.js [branch-name] [options]

Options:
  -q, --quiet    Suppress output, exit with code only
  -h, --help     Show this help message

Valid branch format:
  <type>/<description>

Valid types:
  ${VALID_TYPES.join(', ')}

Release branches:
  release/vX.Y.Z or release/X.Y.Z (semantic versioning)

Dependabot branches:
  dependabot/<ecosystem>/<dependency-name-and-version>

Protected branches (always allowed):
  ${PROTECTED_BRANCHES.join(', ')}

Examples:
  ✅ feat/user-dashboard
  ✅ fix/login-validation
  ✅ chore/update-dependencies
  ✅ release/v2.0.0
  ✅ release/1.5.3
  ✅ dependabot/github_actions/actions/download-artifact-8
  ❌ my-feature
  ❌ feature_user_dashboard
`);
    process.exit(0);
  }

  // Handle --quiet flag
  const quiet = args.includes('--quiet') || args.includes('-q');

  // Get branch name from argument (excluding flags) or current branch
  const branchName = args.find((arg) => !arg.startsWith('-')) || getCurrentBranch();

  const result = validateBranchName(branchName);

  if (result.valid) {
    if (!quiet && branchName && branchName !== 'HEAD') {
      console.log(`✅ Branch name "${branchName}" is valid`);
      if (result.type && result.type !== 'protected') {
        console.log(`   Type: ${result.type}`);
        console.log(`   Description: ${result.description}`);
      }
    }
    process.exit(0);
  } else {
    if (!quiet) {
      console.error(`❌ ${result.error}`);
    }
    process.exit(1);
  }
}

// Run CLI if executed directly
main();
