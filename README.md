# DirectCash Studio

MVP full-stack para o teste técnico da DirectAds.

`DirectCash Studio` é um painel de gestão de campanhas com autenticação JWT, perfis de acesso, CRUD completo e interface responsiva.

## Funcionalidades entregues

- Login e registro com JWT
- Perfis `ADMIN` e `MANAGER`
- CRUD completo de campanhas
- Worker de expiração de campanhas com BullMQ
- Swagger protegido por `user/password` via variável de ambiente
- Dashboard responsivo com estados de carregamento, erro, vazio e sucesso
- Modo claro/escuro persistido no navegador
- Internacionalização básica `pt-BR` / `en-US`
- Observabilidade com `x-request-id`, health checks e logs JSON estruturados
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

Se quiser usar o Swagger localmente, ajuste `SWAGGER_ENABLED=true` e configure
`SWAGGER_USER` e `SWAGGER_PASSWORD` com credenciais fortes.

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

## Regras de acesso

- `ADMIN`
  - cria contas admin
  - acessa todas as campanhas
  - cria, edita e remove qualquer campanha
  - acessa o Swagger quando habilitado por env
- `MANAGER`
  - registra e acessa o sistema
  - cria campanhas próprias
  - visualiza, edita e remove apenas campanhas sob sua responsabilidade

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
- Dockerfiles separados para API e Web
  - facilitam deploy independente em Railway e também servem como base de containerização
- Schema isolado para e2e
  - evita contaminar a base de desenvolvimento e torna os testes HTTP repetíveis
- Logger JSON + request id
  - simplificam correlação de falhas em container, CI e produção
- Tema e idioma persistidos no frontend
  - melhoram a experiência sem introduzir dependência extra para o escopo do MVP

## Deploy sugerido no Railway

Estratégia recomendada: criar 3 serviços.

1. PostgreSQL
2. API usando [Dockerfile.api](./Dockerfile.api)
3. Web usando [Dockerfile.web](./Dockerfile.web)

### Serviço `api`

Configuração:

- Dockerfile path: `Dockerfile.api`
- Port: `3333`

Variáveis de ambiente:

- `NODE_ENV=production`
- `PORT=3333`
- `DATABASE_URL=<fornecida pelo Railway/Postgres>`
- `JWT_SECRET=<segredo forte>`
- `JWT_EXPIRES_IN=1d`
- `SWAGGER_ENABLED=false`
- `SWAGGER_USER=<usuario do swagger>`
- `SWAGGER_PASSWORD=<senha do swagger>`

Após o primeiro deploy, execute migration:

```bash
npm run db:migrate --workspace @directcash/api
```

Opcionalmente, rode seed:

```bash
npm run db:seed --workspace @directcash/api
```

### Serviço `web`

Configuração:

- Dockerfile path: `Dockerfile.web`
- Port: `3000`

Variáveis de ambiente:

- `NODE_ENV=production`
- `PORT=3000`
- `NEXT_PUBLIC_API_URL=https://<url-da-api>/api`

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
  - readiness com verificação real do PostgreSQL
- Header `x-request-id`
  - correlaciona requests no cliente, logs e infraestrutura
- Logs estruturados em JSON
  - incluem método, rota, status, duração e `userId` quando autenticado

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
