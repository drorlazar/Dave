# Git Repository Security Hardening Plan

**Date**: 2026-02-11
**Project**: Dave (Dror's Assets Viewing Experience)
**Repo**: https://github.com/DrorLazar-Sett/Dave

## Context
The Dave repo (public) currently has no branch protection, no commit signing, and no pre-commit hooks. The goal is to harden it against unauthorized pushes, history tampering, and accidental secret leaks, while keeping it open for community contributions via fork + PR.

## Phases
1. Install GitHub CLI (`winget install --id GitHub.cli`)
2. SSH commit signing (uses existing Ed25519 key)
3. Pre-commit hooks (gitleaks, detect-secrets, file quality checks)
4. Governance files (SECURITY.md, CODEOWNERS, CONTRIBUTING.md)
5. Branch protection (require PR, block force push, code owner review)
6. GitHub security settings (secret scanning, push protection, Dependabot)
7. .gitignore hardening (credential file patterns)

## Files Created/Modified
- `~/.ssh/allowed_signers` - SSH signing verification
- `.pre-commit-config.yaml` - Hook configuration
- `.secrets.baseline` - detect-secrets baseline
- `SECURITY.md` - Vulnerability reporting policy
- `.github/CODEOWNERS` - Auto-review assignment
- `CONTRIBUTING.md` - Fork & PR guide
- `.gitignore` - Additional credential patterns

See full plan in `C:\Users\drorl\.claude\plans\atomic-sniffing-toucan.md`
