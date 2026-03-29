## Summary

Corrige a etapa de instalacao das imagens Docker para que o `postinstall` consiga gerar o client do Prisma durante o `npm ci`, e atualiza o hook `pre-commit` do Husky para o formato compativel com as versoes mais recentes.

## Changes

- copia `apps/api/prisma` no estagio `deps` de `Dockerfile.api` antes do `npm ci`
- copia `apps/api/prisma` no estagio `deps` de `Dockerfile.web` antes do `npm ci`
- remove o bootstrap legado do Husky em `.husky/pre-commit`, mantendo apenas `npx lint-staged`

<!-- Remove sections below that don't apply to your PR -->

## Database Changes

- none

## Breaking Changes

- none

## Checklist

- [x] Self-reviewed
- [ ] Tests added/updated
- [ ] Documentation updated in `docs/` and Confluence (if applicable)
- [ ] Security implications considered (if applicable)
