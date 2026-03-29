# DirectCash Studio

MVP full-stack para o teste técnico da DirectAds.

`DirectCash Studio` é um painel de gestão de campanhas com autenticação JWT, perfis de acesso, CRUD completo, worker assíncrono e interface responsiva.

## Funcionalidades entregues

- Login, refresh e provisionamento autenticado com JWT
- Perfis `ADMIN`, `MANAGER` e `USER`
- Gestão administrativa de usuários com listagem, edição e exclusão
- CRUD completo de campanhas
- Worker de expiração de campanhas com BullMQ
- Swagger protegido por basic auth via variável de ambiente, incluindo endpoint YAML
- Dashboard responsivo com estados de carregamento, erro, vazio e sucesso
- Modo claro/escuro persistido no navegador
- Internacionalização básica `pt-BR` / `en-US`
- Observabilidade com `x-request-id`, health checks e logs JSON estruturados
- CORS com whitelist configurável por `ALLOWED_ORIGINS`
- Redis com autenticação por senha e `appendonly` no ambiente Docker local
- Guard rail de runtime para impedir segredos JWT de teste fora de `NODE_ENV=test`
- Seed com usuários e campanhas demo
- Testes unitários no backend
- Testes e2e reais com schema isolado no PostgreSQL
- CI/CD com GitHub Actions para validação e publicação de imagens Docker
- Pipeline local de qualidade com ESLint, Prettier, Husky e Commitlint

## Stack

- Frontend: Next.js 16 com App Router
- Backend: NestJS 11
- Banco: PostgreSQL
- ORM: Prisma
- Linguagem: TypeScript
- Organização: monorepo com `npm workspaces`

## Estrutura do projeto

```text
.
├── apps
│   ├── api
│   └── web
├── packages
│   └── config
├── Dockerfile.api
├── Dockerfile.web
└── docker-compose.yml
```

## Como rodar localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Subir PostgreSQL e Redis

Antes disso, opcionalmente copie as variáveis locais do compose:

```bash
cp .env.example .env
```

O arquivo raiz `.env.example` já traz valores de desenvolvimento para:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT`
- `REDIS_PORT`
- `REDIS_PASSWORD`

`docker-compose.yml` agora exige explicitamente `POSTGRES_PASSWORD` e `REDIS_PASSWORD`, então mantenha esses valores definidos no `.env` antes de subir os containers.

```bash
docker compose up -d
```

Serviços locais do compose:

- PostgreSQL em `localhost:5433`
- Redis em `localhost:6380`

As portas foram escolhidas para reduzir conflito com instalações locais já usando `5432` e `6379`.

### 3. Configurar ambiente

API:

```bash
cp apps/api/.env.example apps/api/.env
```

Ajustes importantes no `apps/api/.env`:

- configure `DATABASE_URL` com credenciais reais para o Postgres local
- configure `REDIS_PASSWORD` com a mesma senha usada no `docker-compose`
- ajuste `ALLOWED_ORIGINS` para as origens do frontend que podem enviar credenciais
- se quiser usar o Swagger localmente, defina `SWAGGER_ENABLED=true` e configure `SWAGGER_USER` e `SWAGGER_PASSWORD`

Observação: a API e o worker falham na inicialização fora de `NODE_ENV=test` se `JWT_SECRET` ou `JWT_REFRESH_SECRET` ainda contiverem valores fracos como `change-me`.

Web:

```bash
cp apps/web/.env.example apps/web/.env.local
```

### 4. Aplicar migration e seed

```bash
npm run db:migrate --workspace @directcash/api
npm run db:seed --workspace @directcash/api
```

### 5. Rodar frontend e backend

```bash
npm run dev
```

Serviços locais:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3333/api`
- Health: `http://localhost:3333/api/health`
- Readiness: `http://localhost:3333/api/health/ready`
- Swagger: `http://localhost:3333/api/docs` quando `SWAGGER_ENABLED=true`

Credenciais demo da seed:

- `admin@directcash.local / Admin@123`
- `manager@directcash.local / Manager@123`

Observação: a seed cria contas demo `ADMIN` e `MANAGER`, mas novos usuários provisionados pela rota `/api/auth/register` recebem o papel `USER` por padrão.
No dashboard administrativo, o fluxo de novo acesso agora usa a área de gestão de usuários e permite escolher o papel no momento da criação via endpoint admin-only dedicado.

## Comandos úteis

Raiz:

- `npm run dev`
- `npm run lint`
- `npm run ci`
- `npm run build`
- `npm run format`
- `npm run format:check`

Backend:

- `npm run db:generate --workspace @directcash/api`
- `npm run db:migrate --workspace @directcash/api`
- `npm run db:push --workspace @directcash/api`
- `npm run db:seed --workspace @directcash/api`
- `npm run test --workspace @directcash/api -- --runInBand`
- `npm run test:e2e --workspace @directcash/api`
- `TEST_DATABASE_URL=postgresql://<user>:<password>@localhost:5433/directcash?schema=public npm run test:e2e --workspace @directcash/api`

## Regras de acesso

- `ADMIN`
  - provisiona novos usuários autenticados
  - lista, edita e exclui usuários pela área administrativa
  - acessa todas as campanhas
  - cria, edita e remove qualquer campanha
  - acessa o Swagger quando habilitado por env
- `MANAGER`
  - cria campanhas próprias
  - visualiza, edita e remove apenas campanhas sob sua responsabilidade
- `USER`
  - autentica e mantém sessão válida
  - não provisiona novos usuários
  - segue as mesmas restrições de acesso autenticado definidas pelo backend para campanhas e rotas protegidas

## Decisões técnicas e arquiteturais

- Monorepo com `npm workspaces`
  - simplifica instalação, scripts e padronização entre frontend e backend
- NestJS no backend
  - oferece estrutura modular clara para auth, guards, DTOs e Swagger
- Prisma no backend
  - acelera modelagem, geração do client e migrations com tipagem consistente
- JWT stateless
  - suficiente para o escopo do teste, simples de explicar e fácil de escalar
- Guards globais no Nest
  - centralizam autenticação e permissionamento sem duplicação nos controllers
- Next.js App Router no frontend
  - atende a stack obrigatória e mantém um ponto único de entrada para o dashboard
- Frontend client-side para o MVP
  - reduz complexidade de sessão neste momento e acelera a entrega end-to-end
- PostgreSQL via Docker no desenvolvimento
  - facilita avaliação local e evita dependência de instalação manual
- Redis autenticado no compose
  - aproxima o ambiente local de um cenário menos permissivo e evita assumir Redis aberto
- Dockerfiles separados para API e Web
  - facilitam deploy independente em Railway e também servem como base de containerização
- Schema isolado para e2e
  - evita contaminar a base de desenvolvimento e torna os testes HTTP repetíveis
- CORS por whitelist
  - evita expor cookies e credenciais para origens arbitrárias
- papel padrão `USER` em registros
  - reduz risco de escalonamento de privilégio por payload do cliente
- Logger JSON + request id
  - simplificam correlação de falhas em container, CI e produção
- Tema e idioma persistidos no frontend
  - melhoram a experiência sem introduzir dependência extra para o escopo do MVP

## Deploy sugerido no Railway

Estratégia recomendada: criar 5 serviços.

1. PostgreSQL
2. Redis
3. API usando [Dockerfile.api](./Dockerfile.api)
4. Worker usando [Dockerfile.api](./Dockerfile.api)
5. Web usando [Dockerfile.web](./Dockerfile.web)

### Serviço `api`

Configuração:

- Dockerfile path: `Dockerfile.api`
- no Railway, defina `RAILWAY_DOCKERFILE_PATH=Dockerfile.api` ou configure o Custom Dockerfile Path no serviço; `Dockerfile.api` não é autodetectado por não se chamar exatamente `Dockerfile`
- Port: `3333`

Variáveis de ambiente:

- `NODE_ENV=production`
- `PORT=3333`
- `DATABASE_URL=<fornecida pelo Railway/Postgres>`
- `FAKE_PASSWORD_HASH=<hash bcrypt válido>`
- `JWT_SECRET=<segredo forte>`
- `JWT_REFRESH_SECRET=<segredo forte e diferente do access token>`
- `JWT_EXPIRES_IN=1d`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `REDIS_HOST=<host do redis>`
- `REDIS_PORT=<porta do redis>`
- `REDIS_DB=0`
- `REDIS_USERNAME=<usuario do redis, se existir>`
- `REDIS_PASSWORD=<senha do redis>`
- `ALLOWED_ORIGINS=https://<url-do-web>`
- `SWAGGER_ENABLED=false`
- `SWAGGER_USER=<usuario do swagger>`
- `SWAGGER_PASSWORD=<senha do swagger>`

Exemplo para gerar segredos e hash:

```bash
openssl rand -hex 32
node -e "require('bcrypt').hash('not-used-in-login', 10).then(console.log)"
```

Configure no Railway um Pre-Deploy Command para aplicar migrations:

```bash
npm run db:migrate:deploy --workspace @directcash/api
```

Opcionalmente, rode seed. O worker depende das tabelas já criadas, então publique o worker apenas depois que as migrations tiverem sido aplicadas. O seed em produção exige opt-in explícito:

```bash
SEED_ADMIN_PASSWORD=<senha-admin> SEED_MANAGER_PASSWORD=<senha-manager> npm run db:seed:prod --workspace @directcash/api
```

### Serviço `worker`

Configuração:

- Dockerfile path: `Dockerfile.api`
- no Railway, defina `RAILWAY_DOCKERFILE_PATH=Dockerfile.api` ou configure o Custom Dockerfile Path no serviço
- Start command: `node apps/api/dist/src/worker.js`

Variáveis de ambiente:

- reutilize as mesmas variáveis do serviço `api`
- `PORT` pode permanecer `3333`; o worker não expõe HTTP, mas a variável continua aceita pelo bootstrap compartilhado

### Serviço `web`

Configuração:

- Dockerfile path: `Dockerfile.web`
- no Railway, defina `RAILWAY_DOCKERFILE_PATH=Dockerfile.web` ou configure o Custom Dockerfile Path no serviço
- Port: `3000`

Variáveis de ambiente:

- `NODE_ENV=production`
- `PORT=3000`
- `NEXT_PUBLIC_API_URL=https://<url-da-api>/api`
- como o frontend é buildado com `Dockerfile.web`, esse valor precisa estar disponível no build do deploy; após alterar a variável, faça novo deploy do serviço `web`

## Testes e qualidade

- ESLint configurado e limpo
- Prettier configurado e validado
- Husky com `pre-commit`
- Commitlint com Conventional Commits em `commit-msg`
- Testes unitários para serviços críticos e worker
- Testes e2e HTTP com banco isolado em schema dedicado
- Workflow de CI em [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
- Workflow de CD em [`.github/workflows/cd.yml`](./.github/workflows/cd.yml)

## Observabilidade

- `GET /api/health`
  - liveness simples da API
- `GET /api/health/ready`
  - readiness com verificação real do PostgreSQL e resposta estruturada em caso de falha
- Header `x-request-id`
  - correlaciona requests no cliente, logs e infraestrutura
- Logs estruturados em JSON
  - incluem método, rota, status, duração e `userId` quando autenticado
  - preservam stack trace em logs de erro

## Dependências instaladas e por que foram escolhidas

### Raiz

- `@commitlint/cli`
  - valida mensagens de commit no padrão conventional commits
- `@commitlint/config-conventional`
  - preset pronto para reduzir configuração manual
- `concurrently`
  - executa frontend e backend em paralelo no desenvolvimento
- `husky`
  - registra hooks de git locais
- `lint-staged`
  - roda formatação antes do commit só nos arquivos alterados
- `prettier`
  - padroniza estilo de código no monorepo

### Backend: dependências de runtime

- `@nestjs/common`
  - base do framework Nest
- `@nestjs/config`
  - leitura e validação centralizada de variáveis de ambiente
- `@nestjs/core`
  - bootstrap da aplicação Nest
- `@nestjs/jwt`
  - emissão e validação de tokens JWT
- `@nestjs/passport`
  - integração de estratégias de autenticação com guards
- `@nestjs/platform-express`
  - adapter HTTP do Nest para Express
- `@nestjs/swagger`
  - geração da documentação OpenAPI
- `@prisma/client`
  - client tipado para acesso ao PostgreSQL
- `bcrypt`
  - hash seguro de senha
- `class-transformer`
  - suporte a transformação de payloads
- `class-validator`
  - validação declarativa dos DTOs
- `express-basic-auth`
  - proteção simples do Swagger por credencial
- `passport`
  - base de autenticação usada pelo Nest
- `passport-jwt`
  - estratégia JWT do Passport
- `reflect-metadata`
  - suporte a decorators do Nest/TypeScript
- `rxjs`
  - dependência base do ecossistema Nest
- `swagger-ui-express`
  - interface web do Swagger

### Backend: dependências de desenvolvimento

- `@eslint/eslintrc`
  - compatibilidade do ESLint moderno com configuração legada do Nest
- `@eslint/js`
  - regras base do ESLint
- `@nestjs/cli`
  - build e geração do projeto Nest
- `@nestjs/schematics`
  - suporte a schematics do ecossistema Nest
- `@nestjs/testing`
  - utilitários de testes do Nest
- `@types/bcrypt`
  - tipos do `bcrypt`
- `@types/express`
  - tipos do Express
- `@types/jest`
  - tipos do Jest
- `@types/node`
  - tipos do Node.js
- `@types/passport-jwt`
  - tipos do Passport JWT
- `@types/supertest`
  - tipos do Supertest
- `eslint`
  - lint do backend
- `eslint-config-prettier`
  - evita conflito entre ESLint e Prettier
- `eslint-plugin-prettier`
  - expõe problemas de formatação no lint do Nest
- `globals`
  - catálogo de globais para configuração do ESLint
- `jest`
  - framework de testes
- `prisma`
  - migrations, generate e seed
- `source-map-support`
  - stack traces melhores em TS compilado
- `supertest`
  - testes HTTP no backend
- `ts-jest`
  - integração do Jest com TypeScript
- `ts-loader`
  - suporte de build TS no ecossistema gerado pelo Nest
- `ts-node`
  - execução de scripts TypeScript como a seed
- `tsconfig-paths`
  - resolução de paths em ambiente TS/Jest
- `typescript`
  - compilação TypeScript
- `typescript-eslint`
  - regras TS no ESLint

### Frontend

- `next`
  - framework React com App Router, build e runtime web
- `react`
  - base de UI
- `react-dom`
  - renderização do React no browser
- `@types/node`
  - tipos do Node para o projeto web
- `@types/react`
  - tipos do React
- `@types/react-dom`
  - tipos do React DOM
- `eslint`
  - lint do frontend
- `eslint-config-next`
  - regras recomendadas para Next.js
- `prettier`
  - formatação do frontend
- `typescript`
  - compilação TypeScript

## Status atual

O MVP obrigatório está implementado de ponta a ponta e o projeto está validado com:

- `npm run lint`
- `npm run test:e2e --workspace @directcash/api`
- `npm run test --workspace @directcash/api -- --runInBand`
- `npm run build`

Os cinco incrementos pedidos nesta etapa já estão incorporados ao projeto:

- testes e2e completos com banco de teste isolado
- CI/CD automatizado
- modo escuro
- internacionalização
- observabilidade e logging estruturado
