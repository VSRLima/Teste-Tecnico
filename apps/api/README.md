# DirectCash API

API NestJS responsável por autenticação, autorização, gestão de campanhas e expiração automática de campanhas com `endDate` via worker BullMQ.

## Stack

- NestJS 11
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- JWT com access token e refresh token
- Jest para testes unitários e e2e

## Pré-requisitos

- Node.js 22+
- npm 10+
- PostgreSQL disponível no `DATABASE_URL`
- Redis disponível para fila e worker

## Configuração

Arquivos de ambiente relevantes:

- [`apps/api/.env`](/home/vreis/Teste-Tecnico/apps/api/.env)
- [`apps/api/.env.example`](/home/vreis/Teste-Tecnico/apps/api/.env.example)

Variáveis principais:

- `DATABASE_URL`: conexão com o PostgreSQL.
- `JWT_SECRET`: segredo do access token.
- `JWT_EXPIRES_IN`: expiração do access token.
- `JWT_REFRESH_SECRET`: segredo do refresh token.
- `JWT_REFRESH_EXPIRES_IN`: expiração do refresh token.
- `FAKE_PASSWORD_HASH`: hash bcrypt usado para evitar diferença de tempo no login de usuário inexistente.
- `REDIS_HOST`: host do Redis.
- `REDIS_PORT`: porta do Redis.
- `REDIS_DB`: database lógica do Redis.
- `REDIS_USERNAME`: usuário do Redis, quando aplicável.
- `REDIS_PASSWORD`: senha do Redis, quando aplicável.
- `SWAGGER_ENABLED`: habilita/desabilita Swagger.
- `SWAGGER_USER`: usuário do basic auth do Swagger quando habilitado.
- `SWAGGER_PASSWORD`: senha do basic auth do Swagger quando habilitado.

## Instalação

```bash
npm install
npm run db:generate --workspace @directcash/api
npm run db:migrate --workspace @directcash/api
```

## Execução

API HTTP:

```bash
npm run start:dev --workspace @directcash/api
```

Worker de campanhas:

```bash
npm run start:worker:dev --workspace @directcash/api
```

Fluxo completo pelo root do monorepo:

```bash
npm run dev
```

A API sobe por padrão em `http://localhost:3333/api`.

## Módulos

### App

- `GET /api`
  Healthcheck simples da API.

### Auth

Base path: `/api/auth`

- `POST /register`
  Cria usuários com access token válido. Somente `ADMIN` pode criar `ADMIN` ou `MANAGER`.
- `POST /login`
  Autentica usuário com email e senha e retorna `accessToken`, `refreshToken` e payload sanitizado do usuário.
- `POST /refresh`
  Recebe `refreshToken`, valida assinatura/expiração e emite novos tokens.

Regras:

- `POST /auth/register` exige access token válido.
- `MANAGER` não pode criar usuários.
- `ADMIN` pode criar outros `ADMIN` e `MANAGER`.

### Campaigns

Base path: `/api/campaigns`

- `POST /`
  Cria campanha vinculada ao usuário autenticado.
- `GET /`
  Lista todas as campanhas para `ADMIN` e apenas as próprias campanhas para `MANAGER`.
- `GET /:id`
  Busca campanha por id, respeitando controle de acesso.
- `PATCH /:id`
  Atualiza campanha se o usuário tiver acesso.
- `DELETE /:id`
  Remove campanha se o usuário tiver acesso.

Regras de negócio:

- `status` default no create é `DRAFT`.
- o mesmo usuário não pode ter duas campanhas com o mesmo `name`.
- campanhas com `endDate` recebem agendamento no Redis/BullMQ.
- quando `endDate` é alterado, o worker faz reschedule.
- quando `endDate` é atingido, a campanha é marcada automaticamente como `COMPLETED`.

DTOs validados:

- `CreateCampaignDto`: `name`, `description`, `status`, `budget`, `startDate`, `endDate`.
- `UpdateCampaignDto`: versão parcial do DTO de criação.

## Worker de campanhas

O worker é inicializado por [`src/worker.ts`](/home/vreis/Teste-Tecnico/apps/api/src/worker.ts) e usa BullMQ para processar expiração automática.

Fluxo:

1. na subida, o worker sincroniza os jobs pendentes com o estado atual do banco.
2. no create/update/delete da campanha, o schedule é criado, atualizado ou removido.
3. ao processar o job, o worker revalida o `endDate` salvo no banco antes de concluir a campanha.

## Testes

```bash
# unitários
npm run test --workspace @directcash/api

# e2e
npm run test:e2e --workspace @directcash/api

# cobertura
npm run test:cov --workspace @directcash/api
```

Cobertura atual inclui:

- `AuthService`
- `CampaignsService`
- `CampaignExpirationSchedulerService`
- `CampaignExpirationConsumer`
- `CampaignSchedulerInitializerService`
- `UsersService`
- `PrismaService`
- e2e de `app`, `auth` e `campaigns`

## Banco e seed

```bash
npm run db:seed --workspace @directcash/api
```

Seed local padrão:

- `admin@directcash.local` / `Admin@123`
- `manager@directcash.local` / `Manager@123`

## Swagger

Quando `SWAGGER_ENABLED=true`, a documentação fica disponível em `GET /api/docs` com proteção via basic auth usando `SWAGGER_USER` e `SWAGGER_PASSWORD`.
