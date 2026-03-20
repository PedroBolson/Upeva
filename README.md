# 🐾 Upeva

Plataforma web para divulgação de animais, envio de candidaturas de adoção e operação interna da ONG.

O projeto é uma SPA em React com duas áreas principais:

- **Área pública** — vitrine de animais e formulário de adoção em múltiplos passos
- **Área administrativa** — painel protegido por Firebase Auth para a equipe da ONG

O backend usa Firebase Hosting, Firestore, Storage, Authentication e Cloud Functions, com foco em baixo custo de leitura/escrita e segurança por padrão.

---

## ✅ Estado atual do projeto

- Home pública com destaque para animais disponíveis
- Listagem pública com filtros por espécie, sexo, porte e busca por nome — animações inteligentes que distinguem dados em cache de carregamentos reais
- Página de detalhe do animal com galeria de fotos e CTA para adoção
- Formulário público de candidatura por animal ou geral, com 8 etapas e campos condicionais por espécie
- Páginas institucionais `sobre` e `contato`
- Área administrativa com dashboard, animais, candidaturas, usuários e configurações
- CRUD de animais com upload de fotos no Firebase Storage
- Triagem de candidaturas com atualização de status e notas internas
- Gestão de usuários internos com roles `admin` e `reviewer`
- Paginação cursor-based em todas as listagens (público e admin)
- Rate limiting server-side por e-mail nas candidaturas de adoção

---

## 🔒 Segurança

### Firestore Rules

As regras ficam em [`firestore.rules`](firestore.rules) e usam **Custom Claims** (`request.auth.token.role`) para autorização — eliminando leituras ao Firestore dentro das próprias regras.

| Coleção | Leitura | Escrita |
|---|---|---|
| `animals` | pública | staff (create valida campos obrigatórios e enums) |
| `applications` | staff | create bloqueado no cliente (Cloud Function only); update valida enum de status |
| `users` | próprio doc ou admin | somente `displayName` pelo próprio usuário; resto via Cloud Functions |
| `metadata` | staff | Cloud Functions only |
| `rateLimits` | — | Cloud Functions only |
| `_processedEvents` | — | Cloud Functions only |
| qualquer outra | — | deny explícito (catch-all rule) |

### Storage Rules

As regras ficam em [`storage.rules`](storage.rules):

- Leitura pública de imagens de animais
- Escrita restrita a staff autenticado com Custom Claims
- Upload limitado a `image/*` com até 10 MB

### Cloud Functions — autorização

Todas as functions admin verificam o role diretamente no token JWT (`request.auth.token.role`), sem fazer leitura adicional ao Firestore.

### `createApplication` — allowlist de campos

O payload do formulário é filtrado por allowlist antes de ser gravado no Firestore — campos arbitrários enviados pelo cliente são descartados.

---

## ⚡ Escalabilidade

### Paginação cursor-based

Todas as listagens usam o padrão `limit(N+1) + startAfter(cursor)`:

| Listagem | Tamanho de página |
|---|---|
| Animais (público) | 12 |
| Animais (admin) | 25 |
| Candidaturas (admin) | 25 |
| Usuários (admin) | 50 |

### Rate limiting

Candidaturas de adoção são limitadas a **5 por e-mail por 24 horas**, usando transação atômica no Firestore com hash SHA-256 do e-mail como chave.

### `recalibrateCounts`

Usa `count()` aggregation queries em paralelo por status — sem full scan das coleções, sem risco de timeout ou estouro de memória em produção.

### `maxInstances` por function

Cada Cloud Function tem seu próprio limite de instâncias:

| Function | maxInstances |
|---|---|
| `createApplication` | 10 |
| `onApplicationStatusChanged` | 5 |
| `onAnimalChanged` | 5 |
| `refreshUserClaims` | 5 |
| `createUser` | 3 |
| `updateUserRole` | 3 |
| `recalibrateCounts` | 3 |

### Deduplicação de triggers

Os triggers `onApplicationStatusChanged` e `onAnimalChanged` usam o `event.id` para deduplicação — gravando o ID na coleção `_processedEvents` com `ref.create()` atômico, prevenindo double-counting em eventos retentados pelo Cloud Functions runtime.

### Cache-Control

- Imagens enviadas ao Storage recebem `Cache-Control: public, max-age=31536000, immutable` (nomes incluem timestamp, então são imutáveis)
- Firebase Hosting serve JS, CSS e fontes com `max-age=31536000, immutable`
- Imagens estáticas do Hosting com `max-age=31536000`

---

## 🧩 Stack

### Frontend

- React 19
- TypeScript
- Vite 8 com code splitting manual (firebase, router, query, forms, motion, react-vendor)
- React Router 7
- TanStack Query 5 (`keepPreviousData`, `useInfiniteQuery`, `staleTime` por query)
- React Hook Form + Zod
- Tailwind CSS 4
- Framer Motion
- Firebase Web SDK

### Backend e infraestrutura

- Firebase Hosting (CDN + SPA rewrite)
- Cloud Firestore (`southamerica-east1`)
- Firebase Storage
- Firebase Authentication (email/senha)
- Firebase Functions (`southamerica-east1`)
  - `onUserCreated` — 1st gen (trigger de Auth)
  - demais functions — 2nd gen

---

## 🗂️ Rotas

### Públicas

| Rota | Descrição |
|---|---|
| `/` | Home com destaque de animais |
| `/animais` | Listagem com filtros |
| `/animais/:id` | Detalhe do animal |
| `/adotar` | Candidatura geral |
| `/adotar/:id` | Candidatura vinculada a um animal |
| `/sobre` | Página institucional |
| `/contato` | Contatos da ONG |

### Administrativas (requerem autenticação)

| Rota | Acesso |
|---|---|
| `/admin/login` | Público |
| `/admin` | staff |
| `/admin/animais` | staff |
| `/admin/animais/novo` | staff |
| `/admin/animais/:id/editar` | staff |
| `/admin/candidaturas` | staff |
| `/admin/candidaturas/:id` | staff |
| `/admin/usuarios` | admin only |
| `/admin/configuracoes` | staff |

---

## 👥 Auth e roles

A autenticação usa `email/senha` no Firebase Auth com **Custom Claims** para autorização.

| Role | Acesso |
|---|---|
| `admin` | acesso total, incluindo gestão de usuários e alteração de roles |
| `reviewer` | dashboard, animais, candidaturas e configurações |

O login valida se o usuário tem um perfil em `users/{uid}` com role válido. Se o token não contiver o claim `role` (usuários anteriores ao deploy dos Custom Claims), a function `refreshUserClaims` é chamada automaticamente para sincronizar.

---

## ☁️ Cloud Functions

As functions ficam em [`functions/src/index.ts`](functions/src/index.ts).

### `onUserCreated`
Trigger de Auth — espelha o usuário em `users/{uid}` e define Custom Claims. O primeiro usuário criado recebe `role: "admin"`, os demais recebem `role: "reviewer"`.

### `createUser`
Callable — somente `admin`. Cria usuário no Firebase Auth, define Custom Claims e grava o perfil em `users/{uid}`.

### `updateUserRole`
Callable — somente `admin`. Atualiza role de outro usuário (autoalteração bloqueada). Atualiza Custom Claims imediatamente.

### `createApplication`
Callable — público. Valida campos obrigatórios, filtra payload por allowlist, aplica rate limiting (5/24h por e-mail) e grava via Admin SDK (contorna as rules do cliente).

### `refreshUserClaims`
Callable — usuário autenticado. Sincroniza Custom Claims a partir do Firestore para usuários que não os possuem no token.

### `recalibrateCounts`
Callable — somente `admin`. Reconstrói `metadata/counts` usando `count()` aggregation queries em paralelo. Chamada automaticamente após o bootstrap e disponível manualmente no dashboard.

### `onApplicationStatusChanged`
Trigger em `applications/{appId}` — mantém contadores em `metadata/counts` e sincroniza `animals.status` conforme o status da candidatura:

- `in_review` → animal fica `under_review`
- `approved` → animal fica `adopted`
- `rejected` / `withdrawn` → animal volta a `available` se não houver outra candidatura ativa

### `onAnimalChanged`
Trigger em `animals/{animalId}` — mantém contadores de animais em `metadata/counts` por status.

> Ambos os triggers usam deduplicação por `event.id` para garantir idempotência.

---

## 🗄️ Estrutura de dados

### Coleções Firestore

| Coleção | Descrição |
|---|---|
| `animals` | Animais da ONG |
| `applications` | Candidaturas de adoção |
| `users` | Perfis da equipe (espelho do Firebase Auth) |
| `metadata` | Contadores agregados (`counts`) para o dashboard |
| `rateLimits` | Estado do rate limiting por hash de e-mail |
| `_processedEvents` | IDs de eventos de trigger já processados (deduplicação) |

#### `animals`

```
name, species, sex, size?, breed?, estimatedAge?, description,
photos, coverPhotoIndex, status, vaccines, neutered, specialNeeds?,
createdAt, updatedAt
```

Status possíveis: `available` · `under_review` · `adopted` · `archived`

#### `applications`

```
animalId?, animalName?, species, fullName, email, phone, birthDate, address,
[respostas completas do formulário de 8 etapas],
status, adminNotes?, createdAt, updatedAt
```

Status possíveis: `pending` · `in_review` · `approved` · `rejected` · `withdrawn`

#### `users`

```
uid, email, displayName, role, createdAt, createdBy, updatedAt?
```

### Storage

Fotos dos animais em `animals/{animalId}/{timestamp}_{filename}`.

---

## 🏗️ Estrutura do frontend

O projeto segue organização por features:

```
src/
  app/           # providers globais, router, theme provider
  components/ui/ # button, input, modal, table, pagination, file-upload, stepper...
  features/
    adoption/    # form multi-step, hooks, schemas, services
    animals/     # cards, galeria, filtros, hooks, services, storage
    auth/        # context, protected-route, hooks, services
    admin/       # header context, hooks, metadata service
    contact/     # componentes e config de links
    users/       # hooks e services
  layouts/       # PublicLayout, AdminLayout
  lib/           # firebase.ts, query-client.ts
  pages/
    admin/       # login, dashboard, animais, candidaturas, usuários, configurações
    public/      # home, animais, animal-detail, adotar, sobre, contato
  types/         # tipos compartilhados
  utils/         # cn, animations, format
```

---

## 🔧 Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com as credenciais do projeto Firebase:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_FUNCTIONS_REGION=southamerica-east1
```

---

## 🚀 Como rodar localmente

1. Instale dependências do frontend:

```bash
npm install
```

2. Instale dependências das Functions:

```bash
npm install --prefix functions
```

3. Crie o `.env` a partir de `.env.example` com as credenciais do projeto Firebase.

4. Rode o frontend:

```bash
npm run dev
```

5. Para trabalhar nas Functions localmente:

```bash
npm --prefix functions run build
# ou com hot reload:
npm --prefix functions run serve
```

---

## 📦 Scripts

### Raiz do projeto

```bash
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção (tsc + vite)
npm run lint      # eslint
npm run preview   # preview do build
```

### Functions

```bash
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix functions run serve
```

---

## 🌐 Build e deploy

### Build de produção

```bash
npm run build
```

### Deploy Firebase

```bash
# Completo (hosting + functions + rules)
firebase deploy

# Só o backend (functions + rules)
firebase deploy --only functions,firestore:rules,storage

# Só o frontend
firebase deploy --only hosting
```

O deploy das Functions roda automaticamente `lint` e `build` antes de publicar (configurado em `predeploy` no [`firebase.json`](firebase.json)).

---

## 🐣 Bootstrap do primeiro admin

1. Fazer deploy das Functions
2. Criar manualmente o primeiro usuário em **Firebase Console › Authentication**
3. A function `onUserCreated` espelha o usuário em `users/{uid}` e, como não existe nenhum admin ainda, atribui `role: "admin"` automaticamente
4. Após o primeiro login, acessar o dashboard e clicar em **Recalibrar contadores** para inicializar `metadata/counts`

A partir daí, novos usuários devem ser criados pela tela `/admin/usuarios`.

---

## 📝 Observações

- Não há suite automatizada de testes configurada no momento
- A região padrão do projeto para Firestore e Functions é `southamerica-east1`
- `onUserCreated` usa 1st gen (único trigger de Auth disponível nessa geração); as demais functions usam 2nd gen
- O arquivo [`PLAN.md`](PLAN.md) existe no repositório como referência de implementação; este README descreve o estado real do código
