# GitHub repository settings (maintainers)

`gh` was not authenticated from this workspace when these were written. Apply manually (or after `gh auth login`).

## Branch protection - `main`

Recommended **strict** settings:

- Require a pull request before merging
- Require approvals: at least **1**
- Dismiss stale reviews when new commits are pushed
- Require status checks to pass:
  - `Selfcheck`
  - `Secret path sanity`
- Require conversation resolution before merging
- Do **not** allow force pushes
- Do **not** allow deletions
- Restrict who can push to `main` (maintainers only)

Optional: require linear history; require signed commits if your team already uses GPG/SSH signing.

## General

- Disable “Allow merge commits” *or* standardize on squash merges for a clean `main`
- Enable **Secret scanning** and **Push protection** (GitHub Advanced Security / public repo defaults where available)
- Enable **Dependabot** alerts for npm

## Example `gh` (after auth)

```bash
gh api repos/qeva-app/qeva/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Selfcheck", "Secret path sanity"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Adjust team/org names in [`.github/CODEOWNERS`](../.github/CODEOWNERS) before enabling “Require review from Code Owners”.
