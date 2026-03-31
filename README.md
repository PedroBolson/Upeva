# 🐾 Upeva

Plataforma web para divulgação de animais, envio de candidaturas de adoção e operação interna da ONG.

O projeto é uma SPA em React com duas áreas principais:

- **Área pública** — vitrine de animais, fila de adoção com waitlist e formulário multi-etapas
- **Área administrativa** — painel protegido por Firebase Auth para a equipe da ONG

O backend usa Firebase Hosting, Firestore, Storage, Authentication e Cloud Functions, com foco em baixo custo de leitura/escrita e segurança por padrão.

---

## 📋 Sumário

- [Estado atual](#-estado-atual-do-projeto)
- [PWA](#-pwa)
- [Fila de adoção](#-fila-de-adoção)
- [Segurança](#-segurança)
- [Escalabilidade](#-escalabilidade)
- [Stack](#-stack)
- [Rotas](#️-rotas)
- [Auth e roles](#-auth-e-roles)
- [Cloud Functions](#️-cloud-functions)
- [Estrutura de dados](#️-estrutura-de-dados)
- [Estrutura do frontend](#️-estrutura-do-frontend)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Como rodar localmente](#-como-rodar-localmente)
- [Scripts](#-scripts)
- [Build e deploy](#-build-e-deploy)
- [Bootstrap do primeiro admin](#-bootstrap-do-primeiro-admin)
- [Observações](#-observações)

---

## ✅ Estado atual do projeto

### Área pública
- Home com rail de animais disponíveis (pool de até 50, embaralhado client-side a cada visita)
- Listagem pública com filtros por espécie, sexo, porte e busca por nome — inclui animais `under_review` com badge de status
- Animações inteligentes que distinguem dados em cache de carregamentos reais
- Página de detalhe do animal com galeria de fotos e CTA de adoção adaptado ao status (disponível ou waitlist)
- Formulário público de candidatura por animal ou geral, com 8 etapas e campos condicionais por espécie
- Tela de sucesso pós-candidatura com posição na fila para candidatos em waitlist
- Páginas institucionais `sobre` e `contato`

### Área administrativa
- Dashboard com gráficos de distribuição de status (animais e candidaturas) via Recharts, Skeleton loading e miniaturas de fotos
- Listagem de animais com cabeçalhos de coluna ordenáveis e animações por linha
- CRUD de animais com upload de fotos no Firebase Storage
- Listagem de candidaturas com filtro por animal (no header), posição na fila visível por linha e animações Framer Motion
- Fluxo de aprovação com conversão automática de candidatos concorrentes para interesse geral
- Detalhe de candidatura com layout multi-coluna, vinculação de animal (para candidaturas gerais), contatos diretos (mailto + WhatsApp) e modal de quick-view do animal
- Gestão de usuários com criação, alteração de role e exclusão (somente admin)
- Página de redefinição de senha (`/admin/reset-password`)
- Configurações com ações de manutenção: recalibrar contadores e recalibrar posições de fila
- Paginação cursor-based em todas as listagens (público e admin)
- Rate limiting server-side por e-mail nas candidaturas de adoção

---

## 📱 PWA

O app é instalável como Progressive Web App em desktop e mobile.

- **Service Worker** gerado via `vite-plugin-pwa` + Workbox (precache de assets + `CacheFirst` para Firebase Storage)
- **Offline persistence** do Firestore via `persistentLocalCache` (multi-tab)
- **Ícones** gerados a partir do SVG da marca: 64×64, 192×192, 512×512, maskable e apple-touch-icon
- **Routing inteligente**: o componente `SmartEntry` redireciona para `/admin` ao abrir em modo standalone e com sessão ativa — o usuário vai direto ao painel sem passar pela home pública
- **iOS** — meta tags de `apple-mobile-web-app` e safe-area CSS garantem comportamento nativo na tela cheia
- `sw.js` servido com `no-cache` no Firebase Hosting para garantir atualização imediata do service worker

---

## 🐕 Fila de adoção

Animais com status `under_review` permanecem visíveis no catálogo público. Novos candidatos para o mesmo animal entram em **waitlist** com posição de fila.

### Regras de fila
- Candidaturas são enfileiradas por `queuePosition` (não por `createdAt`)
- Re-entradas (após `rejected` / `withdrawn`) são **anexadas ao fim** da fila via `appendToAnimalQueue`
- `recalibrateAnimalQueue` reordena por `queuePosition` atual em memória, preservando a ordem relativa após re-entradas

### Fluxo de aprovação (Option A+D)
Ao aprovar uma candidatura vinculada a um animal:
1. O admin visualiza um modal de confirmação listando todos os candidatos ativos para o mesmo animal (nome + posição na fila)
2. Após confirmação, os demais candidatos (`pending` / `in_review`) são **convertidos automaticamente** para interesse geral
3. Candidatos convertidos herdam `previousAnimalId`, `previousAnimalName` e os atributos de preferência do animal (espécie, sexo e, para cães, porte)
4. A tela de detalhe exibe `previousAnimalName` para candidaturas convertidas
5. Invalidação do cache das listas é atrasada 2.500 ms para aguardar os triggers do Firestore

### Candidaturas gerais
- O admin pode vincular uma candidatura geral a um animal compatível diretamente no detalhe
- Filtragem server-side por espécie + sexo (+ porte para cães)
- Não é possível aprovar uma candidatura geral sem vínculo com animal

---

## 🔒 Segurança

### Firestore Rules

As regras ficam em [`firestore.rules`](firestore.rules) e usam **Custom Claims** (`request.auth.token.role`) para autorização — eliminando leituras ao Firestore dentro das próprias regras.

| Coleção | Leitura | Escrita |
|---|---|---|
| `animals` | pública | staff (create valida campos obrigatórios e enums) |
| `applications` | staff | create e review bloqueados no cliente (Cloud Functions only); update direto bloqueado |
| `users` | próprio doc ou admin | somente `displayName` pelo próprio usuário; resto via Cloud Functions |
| `metadata` | staff | Cloud Functions only |
| `rateLimits` | — | Cloud Functions only |
| `_processedEvents` | — | Cloud Functions only |
| qualquer outra | — | deny explícito (catch-all rule) |

### Storage Rules

As regras ficam em [`storage.rules`](storage.rules):

- Leitura pública de imagens de animais
- **Create/update** restrito a staff autenticado com Custom Claims
- **Delete** restrito a staff — sem depender de `request.resource` (permite deletar arquivos existentes)
- Upload limitado a `image/*` com até 10 MB

### Cloud Functions — autorização

Todas as functions admin verificam o role diretamente no token JWT (`request.auth.token.role`), sem fazer leitura adicional ao Firestore.

### `createApplication` — allowlist de campos

O payload do formulário é filtrado por allowlist antes de ser gravado no Firestore — campos arbitrários enviados pelo cliente são descartados. O animal vinculado é **resolvido do Firestore** (não confiado nos dados do cliente). Animais `adopted` ou `archived` bloqueiam o envio.

### `updateApplicationReview` — callable exclusivo para triagem

Mutações de review (status, notas, animal vinculado) só podem ser feitas via Cloud Function, que valida regras de negócio no servidor (exclusividade de aprovação, status de animal, etc.).

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
| `updateApplicationReview` | 10 |
| `onApplicationStatusChanged` | 5 |
| `onAnimalChanged` | 5 |
| `refreshUserClaims` | 5 |
| `createUser` | 3 |
| `updateUserRole` | 3 |
| `deleteUser` | 3 |
| `recalibrateCounts` | 3 |
| `recalibrateQueuePositions` | 3 |

### Deduplicação de triggers

Os triggers `onApplicationStatusChanged` e `onAnimalChanged` usam o `event.id` para deduplicação — gravando o ID na coleção `_processedEvents` com `ref.create()` atômico, prevenindo double-counting em eventos retentados pelo Cloud Functions runtime.

### Firestore offline persistence

O cliente web usa `persistentLocalCache` (IndexedDB) com suporte multi-tab — reduz leituras remotas em sessões ativas e permite uso parcial offline.

### Cache-Control

- Imagens enviadas ao Storage recebem `Cache-Control: public, max-age=31536000, immutable` (nomes incluem timestamp, então são imutáveis)
- Firebase Hosting serve JS, CSS e fontes com `max-age=31536000, immutable`
- Imagens estáticas do Hosting com `max-age=31536000`
- `sw.js` servido com `Cache-Control: no-cache` para garantir atualizações imediatas do PWA

---

## 🧩 Stack

### Frontend

- React 19
- TypeScript
- Vite 6 com code splitting manual (firebase, router, query, forms, motion, react-vendor)
- React Router 7
- TanStack Query 5 (`keepPreviousData`, `useInfiniteQuery`, `staleTime` por query)
- React Hook Form + Zod
- Tailwind CSS 4
- Framer Motion
- Recharts (gráficos de status no dashboard)
- `vite-plugin-pwa` + Workbox
- Firebase Web SDK (com `persistentLocalCache`)

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
| `/animais` | Listagem com filtros (inclui animais under_review) |
| `/animais/:id` | Detalhe do animal |
| `/adotar` | Candidatura geral |
| `/adotar/:id` | Candidatura vinculada a um animal |
| `/sobre` | Página institucional |
| `/contato` | Contatos da ONG |

### Administrativas (requerem autenticação)

| Rota | Acesso |
|---|---|
| `/admin/login` | Público |
| `/admin/reset-password` | Público |
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
| `admin` | acesso total, incluindo gestão de usuários, alteração de roles e exclusão de usuários |
| `reviewer` | dashboard, animais, candidaturas e configurações |

O login valida se o usuário tem um perfil em `users/{uid}` com role válido. Se o token não contiver o claim `role` (usuários anteriores ao deploy dos Custom Claims), a function `refreshUserClaims` é chamada automaticamente para sincronizar.

A redefinição de senha está disponível em `/admin/reset-password` via Firebase Auth (email de reset).

---

## ☁️ Cloud Functions

As functions ficam em [`functions/src/index.ts`](functions/src/index.ts).

### `onUserCreated`
Trigger de Auth (1st gen) — espelha o usuário em `users/{uid}` e define Custom Claims. O primeiro usuário criado recebe `role: "admin"`, os demais recebem `role: "reviewer"`.

### `createUser`
Callable — somente `admin`. Cria usuário no Firebase Auth, define Custom Claims e grava o perfil em `users/{uid}`.

### `updateUserRole`
Callable — somente `admin`. Atualiza role de outro usuário (autoalteração bloqueada). Atualiza Custom Claims imediatamente.

### `deleteUser`
Callable — somente `admin`. Remove o usuário do Firebase Auth e do Firestore (autoexclusão bloqueada).

### `createApplication`
Callable — público. Resolve o animal vinculado do Firestore, valida campos obrigatórios, filtra payload por allowlist, aplica rate limiting (5/24h por e-mail), calcula posição na fila e estado de waitlist, e grava via Admin SDK. Retorna metadados de fila para o frontend.

### `updateApplicationReview`
Callable — staff. Centraliza todas as mutações de triagem: atualização de status, notas internas, vinculação/desvinculação de animal. Valida regras de negócio no servidor (exclusividade de aprovação, compatibilidade de animal, estado de adoção) e executa a conversão automática de candidatos concorrentes na aprovação.

### `refreshUserClaims`
Callable — usuário autenticado. Sincroniza Custom Claims a partir do Firestore para usuários que não os possuem no token.

### `recalibrateCounts`
Callable — somente `admin`. Reconstrói `metadata/counts` usando `count()` aggregation queries em paralelo. Chamada automaticamente após o bootstrap e disponível manualmente no dashboard / configurações.

### `recalibrateQueuePositions`
Callable — somente `admin`. Recalcula as `queuePosition` de todas as candidaturas ativas vinculadas a animais. Ferramenta de manutenção exposta em `/admin/configuracoes`.

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
adoptedApplicationId?, adoptedAt?, activeApplicationCount?, queueHead?,
createdAt, updatedAt
```

Status possíveis: `available` · `under_review` · `adopted` · `archived`

#### `applications`

```
animalId?, animalName?, species, fullName, email, phone, birthDate, address,
[respostas completas do formulário de 8 etapas],
status, queuePosition?, isWaitlisted?,
previousAnimalId?, previousAnimalName?,
adminNotes?, createdAt, updatedAt
```

Status possíveis: `pending` · `in_review` · `approved` · `rejected` · `withdrawn`

#### `users`

```
uid, email, displayName, role, createdAt, createdBy, updatedAt?
```

### Storage

Fotos dos animais em `animals/{animalId}/{timestamp}_{filename}`.

### Índices compostos (Firestore)

| Coleção | Campos |
|---|---|
| `applications` | `animalId ASC` + `status ASC` + `createdAt ASC` |
| `applications` | `animalId ASC` + `status ASC` + `queuePosition ASC` |

---

## 🏗️ Estrutura do frontend

O projeto segue organização por features:

```
src/
  app/           # providers globais, router, theme provider
  components/ui/ # button, input, modal, table, pagination, file-upload, stepper,
                 # cep-input, confirm-modal, date-picker, detail-view,
                 # masked-input, tab-group, toast/toaster, university-badge...
  features/
    adoption/    # form multi-step, hooks, schemas, services, tipos de fila
    animals/     # cards, galeria, filtros, quick-view modal, hooks, services, storage
    auth/        # context, protected-route, smart-entry, hooks, services
    admin/       # header context, hooks, metadata service
    contact/     # componentes e config de links
    users/       # hooks e services
  layouts/       # PublicLayout, AdminLayout
  lib/           # firebase.ts (com persistentLocalCache), query-client.ts
  pages/
    admin/       # login, reset-password, dashboard, animais, candidaturas, usuários, configurações
    public/      # home, animais, animal-detail, adotar, adotar-geral, sobre, contato
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
# Completo (hosting + functions + rules + indexes)
firebase deploy

# Só o backend
firebase deploy --only functions,firestore:rules,firestore:indexes,storage

# Só o frontend
firebase deploy --only hosting
```

O deploy das Functions roda automaticamente `lint` e `build` antes de publicar (configurado em `predeploy` no [`firebase.json`](firebase.json)).

---

## 🐣 Bootstrap do primeiro admin

1. Fazer deploy das Functions
2. Criar manualmente o primeiro usuário em **Firebase Console › Authentication**
3. A function `onUserCreated` espelha o usuário em `users/{uid}` e, como não existe nenhum admin ainda, atribui `role: "admin"` automaticamente
4. Após o primeiro login, acessar o dashboard — `recalibrateCounts` é chamada automaticamente no bootstrap
5. Se necessário, acionar **Recalibrar contadores** manualmente em `/admin/configuracoes`

A partir daí, novos usuários devem ser criados pela tela `/admin/usuarios`.

---

## 📝 Observações

- Não há suite automatizada de testes configurada no momento
- A região padrão do projeto para Firestore e Functions é `southamerica-east1`
- `onUserCreated` usa 1st gen (único trigger de Auth disponível nessa geração); as demais functions usam 2nd gen
- O arquivo [`PLAN.md`](PLAN.md) existe no repositório como referência de implementação; este README descreve o estado real do código
