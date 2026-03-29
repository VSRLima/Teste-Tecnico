# DirectCash Web

Frontend Next.js 16 do painel `DirectCash Studio`.

## O que a aplicação cobre

- autenticação contra a API com access token e refresh token
- dashboard de campanhas com filtros, estados de carregamento e feedbacks
- criação e edição de campanhas
- modal administrativa para listar, editar e excluir usuários
- criação de novo acesso com seleção de perfil via endpoint admin-only
- preferências persistidas de idioma (`pt-BR` / `en-US`) e tema (`dark` / `light`)
- tratamento de sessão expirada com refresh automático e invalidação controlada após `401` repetido
- layout responsivo com ajustes de acessibilidade nos grupos de preferência e foco visível

## Ambiente local

Crie o arquivo de ambiente do frontend:

```bash
cp .env.example .env.local
```

Variável principal:

- `NEXT_PUBLIC_API_URL`: URL base da API, por padrão `http://localhost:3333/api`

## Desenvolvimento

Pelo root do monorepo:

```bash
npm run dev
```

Ou apenas o frontend:

```bash
npm run dev --workspace @directcash/web
```

## Build e qualidade

```bash
npm run lint --workspace @directcash/web
npm run build --workspace @directcash/web
```

## Observações de integração

- a API deve liberar a origem do frontend em `ALLOWED_ORIGINS`
- datas digitadas no formulário de campanha são serializadas como datas locais para evitar deslocamento de dia ao converter para ISO
- o modal de campanha e o modal de provisionamento respondem a `Escape` fechando apenas um por vez
