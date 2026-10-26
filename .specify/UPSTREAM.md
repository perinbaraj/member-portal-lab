# Bundled Spec Kit

Source: [github/spec-kit v0.0.90](https://github.com/github/spec-kit/releases/tag/v0.0.90).
License: [MIT](LICENSE).

The branch vendors the standalone Copilot PowerShell and Bash release templates
so participants do not need Python, uv, or the Specify CLI. This is the pinned
prompt/agent layout, not the latest Spec Kit skills layout.

Original archives and SHA-256 hashes:

| Archive | SHA-256 |
| --- | --- |
| `spec-kit-template-copilot-ps-v0.0.90.zip` | `3206033b9e5cbb855160351df3d3a9ffb5d1993c878a0c25e0156652f1b69bbe` |
| `spec-kit-template-copilot-sh-v0.0.90.zip` | `f9ab84e4de2dc531987f50f0af80e2dd134d72f2ebb689700a3587e6974b5855` |

Both archives are available under the release's download assets. Hashes identify
the downloaded artifacts; they are not a separate publisher signature.

Workshop adaptations:

- The constitution is populated with the approved repository/workshop rules.
- Agent setup instructions include the appropriate PowerShell/Bash alternative.
- Specification numbering uses local branches/spec directories and an explicit
  number, avoiding mandatory remote access during a local exercise.
- Planning reuses local evidence without automatic research-agent fan-out or
  rewriting shared Copilot instructions.
- Implementation limits setup verification to the existing project and does not
  generate unrelated ignore files or infrastructure.
- The task-to-issues integration is omitted; the workshop needs no GitHub API write.
- Upstream editor auto-approval settings are not imported. The local editor
  settings contain only prompt recommendations.

The bundled shell scripts and templates otherwise retain upstream behavior.
Review local adaptations before replacing them with another release.
