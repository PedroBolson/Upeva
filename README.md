# 🐾 Upeva

Plataforma web para divulgação de animais, envio de candidaturas de adoção e operação interna da ONG União Pela Vida Animal — Flores da Cunha/RS.

O projeto é uma SPA em React com duas áreas principais:

- **Área pública** — vitrine de animais, fila de adoção com waitlist e formulário multi-etapas com consentimento LGPD granular
- **Área administrativa** — painel protegido por Firebase Auth para a equipe da ONG

O backend usa Firebase Hosting, Firestore, Storage, Authentication e Cloud Functions, com foco em baixo custo de leitura/escrita, segurança por padrão e conformidade com a LGPD.

---

## 📋 Sumário

- [Estado atual](#-estado-atual-do-projeto)
- [PWA](#-pwa)
- [Fila de adoção](#-fila-de-adoção)
- [Segurança](#-segurança)
- [LGPD e Privacidade](#-lgpd-e-privacidade)
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
- Home com pool curado de até 12 animais em destaque (drag-to-reorder pelo admin, 1 leitura Firestore por visita pública)
- Listagem pública com filtros por espécie, sexo, porte e busca por nome — inclui animais `under_review` com badge de status
- Animações inteligentes que distinguem dados em cache de carregamentos reais
- Página de detalhe do animal com galeria de fotos e CTA de adoção adaptado ao status (disponível ou waitlist)
- Formulário público de candidatura por animal ou geral, com 8 etapas e campos condicionais por espécie
- **Modal de consentimento granular** (LGPD) antes do início do formulário — dois checkboxes por finalidade, bloqueante até ambos marcados
- Tela de sucesso pós-candidatura com posição na fila para candidatos em waitlist
- Páginas institucionais `sobre`, `contato`, `politica-de-privacidade` e `termos-de-uso`

### Área administrativa
- Dashboard com gráficos de distribuição de status (animais e candidaturas) via Recharts, Skeleton loading e miniaturas de fotos
- Listagem de animais com cabeçalhos de coluna ordenáveis e animações por linha
- CRUD de animais com upload de fotos no Firebase Storage
- **Arquivamento de animais com motivo obrigatório** — modal com reason (enum), detalhes livres e data do ocorrido
- **Animais em destaque** — curadoria de até 12 animais com drag-to-reorder (Framer Motion Reorder) em `/admin/destaques`
- Listagem de candidaturas com filtro por animal (no header), posição na fila visível por linha e animações Framer Motion
- **Fluxo de rejeição bifurcado**: `DECLINED` (recusa simples, sem registro) e `REJECTED` (definitivo, com campos obrigatórios, PDF e flag)
- Fluxo de aprovação com conversão automática de candidatos concorrentes para interesse geral
- Detalhe de candidatura com layout multi-coluna, dados de PII decifrados server-side, **alerta de flag de rejeição** para CPF flagado, vinculação de animal, contatos diretos e modal de quick-view do animal
- **Painel de alertas** (`/admin/alertas`) — listagem de flags de rejeição com remoção individual (direito ao esquecimento LGPD Art. 18)
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
| `metadata/featuredAnimals` | pública | Cloud Functions only |
| `metadata/counts` | staff | Cloud Functions only |
| `rejectionFlags` | staff | Cloud Functions only |
| `rateLimits` | — | Cloud Functions only |
| `_processedEvents` | — | Cloud Functions only |
| qualquer outra | — | deny explícito (catch-all rule) |

### Storage Rules

As regras ficam em [`storage.rules`](storage.rules):

- Leitura pública de imagens de animais
- **Create/update** restrito a staff autenticado com Custom Claims
- **Delete** restrito a staff — sem depender de `request.resource` (permite deletar arquivos existentes)
- Upload limitado a `image/*` com até 5 MB

### Cloud Functions — autorização

Todas as functions admin verificam o role diretamente no token JWT (`request.auth.token.role`), sem fazer leitura adicional ao Firestore.

### `createApplication` — allowlist de campos

O payload do formulário é filtrado por allowlist antes de ser gravado no Firestore — campos arbitrários enviados pelo cliente são descartados. O animal vinculado é **resolvido do Firestore** (não confiado nos dados do cliente). Animais `adopted` ou `archived` bloqueiam o envio.

### Criptografia de PII em repouso

Campos sensíveis das candidaturas (`cpf`, `phone`, `address`, `birthDate`) são cifrados com **AES-256-GCM** antes de serem gravados no Firestore:

- IV aleatório por operação — mesmo texto produz ciphertexts distintos
- Auth tag do GCM detecta adulteração dos dados em repouso
- A chave de criptografia e a chave HMAC ficam **exclusivamente no Secret Manager** — nunca em `.env` ou no código
- O admin nunca lê o Firestore diretamente para esses campos — a Cloud Function `getApplicationPII` decifra server-side antes de retornar
- Nenhum campo decifrado jamais aparece em logs (Cloud Functions `logger`)

### Hashes de CPF e email (rejectionFlags)

Flags de rejeição não armazenam CPF ou email em nenhuma forma — apenas **HMAC-SHA256** com chave secreta separada do Secret Manager. Isso elimina vulnerabilidade a rainbow tables (que afeta SHA-256 puro, dado que CPF tem formato previsível).

### `updateApplicationReview` — callable exclusivo para triagem

Mutações de review (status, notas, animal vinculado) só podem ser feitas via Cloud Function, que valida regras de negócio no servidor (exclusividade de aprovação, status de animal, etc.).

---

## 🛡️ LGPD e Privacidade

### Conformidade implementada

| Requisito | Implementação |
|---|---|
| Consentimento granular (Art. 7, I) | Modal de duplo checkbox antes do formulário — finalidades separadas |
| Minimização de dados | PII cifrado em repouso; excluído após prazo de retenção |
| Retenção limitada | Candidaturas aprovadas e animais arquivados: 30 dias → exportados como PDF → excluídos |
| Direito ao esquecimento (Art. 18) | Endpoint `deleteRejectionFlag` + UI de remoção no painel admin |
| Encarregado de Dados (DPO) | Identificado na Política de Privacidade (coordenação da ONG) |
| Accountability (Art. 37) | Dados mapeados neste README; constantes de retenção em `src/types/common.ts` |
| Política pública | `/politica-de-privacidade` e `/termos-de-uso` disponíveis a qualquer visitante |

### Fluxo de exportação e deleção (cron semanal — domingo 2h)

```
applications (approved, > 30 dias)  → PDF contrato  → Drive → deletar Firestore + Storage
applications (rejected, pendingExport) → PDF rejeição → Drive → criar flag HMAC → deletar Firestore
applications (withdrawn, > 30 dias) → deletar Firestore (sem PDF, sem flag)
animals (archived, > 30 dias)       → PDF arquivamento → Drive → deletar Firestore + Storage
```

Nenhum dado pessoal legível permanece no Firestore após o período de retenção. Os PDFs ficam no Google Drive da ONG, acessíveis apenas à equipe.

### Constantes de retenção

Definidas em `src/types/common.ts` e referenciadas na Política de Privacidade:

```typescript
APPROVED_RETENTION_DAYS = 30
ARCHIVED_ANIMAL_RETENTION_DAYS = 30
```

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

### Cache de animais em destaque

A home pública lê **1 documento Firestore por visita** (`metadata/featuredAnimals`) em vez de até 50. O admin cuida um pool de até 12 animais com ordem personalizada; a Cloud Function `updateFeaturedAnimals` mantém o cache atualizado.

### Rate limiting

Candidaturas de adoção são limitadas a **5 por e-mail por 24 horas**, usando transação atômica no Firestore com HMAC do e-mail como chave (resistente a rainbow tables).

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
| `archiveAnimal` | 5 |
| `getApplicationPII` | 10 |
| `checkRejectionFlag` | 10 |
| `deleteRejectionFlag` | 3 |
| `updateFeaturedAnimals` | 3 |
| `cleanOperationalData` (cron diário) | 1 |
| `archiveAndCleanup` (cron semanal) | 1 |

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
- Framer Motion (animações + Reorder para drag-and-drop de destaques)
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
- Google Cloud Secret Manager (chaves de criptografia AES-256-GCM e HMAC)
- Google Drive API v3 (exportação de PDFs via OAuth2 + Secret Manager)
- `pdf-lib` (geração de PDFs em memória, server-side)
- `@googleapis/drive` (cliente Drive autenticado por refresh token)

---

## 🗂️ Rotas

### Públicas

| Rota | Descrição |
|---|---|
| `/` | Home com animais em destaque (1 leitura Firestore) |
| `/animais` | Listagem com filtros (inclui animais under_review) |
| `/animais/:id` | Detalhe do animal |
| `/adotar` | Candidatura geral (com consentimento LGPD) |
| `/adotar/:id` | Candidatura vinculada a um animal (com consentimento LGPD) |
| `/sobre` | Página institucional |
| `/contato` | Contatos da ONG |
| `/politica-de-privacidade` | Política de Privacidade (LGPD) |
| `/termos-de-uso` | Termos de Uso |

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
| `/admin/destaques` | staff |
| `/admin/alertas` | admin only |
| `/admin/usuarios` | admin only |
| `/admin/configuracoes` | staff |

---

## 👥 Auth e roles

A autenticação usa `email/senha` no Firebase Auth com **Custom Claims** para autorização.

| Role | Acesso |
|---|---|
| `admin` | acesso total, incluindo gestão de usuários, alertas de flags e configurações destrutivas |
| `reviewer` | dashboard, animais, candidaturas, destaques e configurações de manutenção |

O login valida se o usuário tem um perfil em `users/{uid}` com role válido. Se o token não contiver o claim `role` (usuários anteriores ao deploy dos Custom Claims), a function `refreshUserClaims` é chamada automaticamente para sincronizar.

A redefinição de senha está disponível em `/admin/reset-password` via Firebase Auth (email de reset).

---

## ☁️ Cloud Functions

As functions ficam em [`functions/src/index.ts`](functions/src/index.ts). Helpers em [`functions/src/lib/`](functions/src/lib/):

- `crypto.util.ts` — AES-256-GCM (`encrypt`/`decrypt`) e HMAC-SHA256 (`hmac`)
- `pdf.helper.ts` — geração de PDFs em memória com `pdf-lib` (3 templates)
- `drive.helper.ts` — upload para Google Drive com OAuth2 e subpastas anuais

### `onUserCreated`
Trigger de Auth (1st gen) — faz apenas o bootstrap seguro do primeiro administrador. O primeiro usuário criado recebe `role: "admin"`; usuários criados depois não recebem role automática e devem ser provisionados pela tela `/admin/usuarios`.

### `createUser`
Callable — somente `admin`. Cria usuário no Firebase Auth, define Custom Claims e grava o perfil em `users/{uid}`.

### `updateUserRole`
Callable — somente `admin`. Atualiza role de outro usuário (autoalteração bloqueada). Atualiza Custom Claims imediatamente.

### `deleteUser`
Callable — somente `admin`. Remove o usuário do Firebase Auth e do Firestore (autoexclusão bloqueada).

### `createApplication`
Callable — público. Resolve o animal vinculado do Firestore, valida campos obrigatórios, filtra payload por allowlist, **cifra PII** (CPF, telefone, endereço, data de nascimento) com AES-256-GCM antes de gravar, aplica rate limiting (5/24h por HMAC do e-mail), calcula posição na fila e estado de waitlist.

### `updateApplicationReview`
Callable — staff. Centraliza todas as mutações de triagem: atualização de status, notas internas, vinculação/desvinculação de animal. Para `REJECTED` (definitivo): valida campos obrigatórios (`rejectionReason`, `rejectionDetails`, confirmação explícita) e marca `pendingExport: true` para o cron de exportação. Para `DECLINED`: deleção simples sem registro.

### `getApplicationPII`
Callable — staff. Decifra os campos sensíveis da candidatura (`cpf`, `phone`, `address`, `birthDate`) server-side e os retorna ao painel admin. O Firestore nunca é lido diretamente pelo cliente para esses campos.

### `checkRejectionFlag`
Callable — staff. Verifica se o CPF de uma candidatura tem flag ativa em `rejectionFlags` (via HMAC), retornando os metadados da flag (motivo, data, contagem).

### `deleteRejectionFlag`
Callable — somente `admin`. Remove uma flag de `rejectionFlags` para exercício do direito ao esquecimento (LGPD Art. 18).

### `archiveAnimal`
Callable — staff. Arquiva um animal com motivo obrigatório (`archiveReason` enum), detalhes livres e data do ocorrido. O status `archived` só pode ser definido via esta function — garante que o motivo sempre seja registrado.

### `updateFeaturedAnimals`
Callable — staff. Valida e grava o pool de animais em destaque em `metadata/featuredAnimals` (cache denormalizado lido pela home pública).

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

### `cleanOperationalData` (cron diário — 3h)
Remove documentos operacionais expirados que os TTLs do Firestore possam deixar como resíduo: `rateLimits` expirados, `_processedEvents` expirados e entradas órfãs em `animalSimilarityCache`.

### `archiveAndCleanup` (cron semanal — domingo 2h)
Exporta e limpa dados conforme as políticas de retenção LGPD:

1. **Candidaturas aprovadas** com mais de 30 dias → PDF contrato → Drive → excluir Firestore + fotos do Storage
2. **Candidaturas rejeitadas** (`pendingExport: true`) → PDF rejeição → Drive → criar flag HMAC em `rejectionFlags` → excluir Firestore
3. **Candidaturas `withdrawn`** com mais de 30 dias → excluir Firestore (sem PDF, sem flag)
4. **Animais arquivados** com mais de 30 dias → PDF arquivamento → Drive → excluir Firestore + fotos do Storage
5. Recalibrar `metadata/counts` após cada lote de deleções

---

## 🗄️ Estrutura de dados

### Coleções Firestore

| Coleção | Descrição |
|---|---|
| `animals` | Animais da ONG |
| `applications` | Candidaturas de adoção (PII cifrado) |
| `users` | Perfis da equipe (espelho do Firebase Auth) |
| `metadata/featuredAnimals` | Cache do pool de destaques da home (leitura pública) |
| `metadata/counts` | Contadores agregados para o dashboard (staff only) |
| `rejectionFlags` | Flags HMAC de rejeição definitiva (sem PII em texto plano) |
| `rateLimits` | Estado do rate limiting por HMAC de e-mail |
| `_processedEvents` | IDs de eventos de trigger já processados (deduplicação) |

#### `animals`

```
name, species, sex, size?, breed?, estimatedAge?, description,
photos, coverPhotoIndex, status, vaccines, neutered, specialNeeds?,
adoptedApplicationId?, adoptedAt?, activeApplicationCount?, queueHead?,
archiveReason?, archiveDetails?, archiveDate?, archivedAt?,
createdAt, updatedAt
```

Status possíveis: `available` · `under_review` · `adopted` · `archived`

#### `applications`

```
animalId?, animalName?, species, fullName, email,
cpf (AES-256-GCM), phone (AES-256-GCM), birthDate (AES-256-GCM), address (AES-256-GCM),
[respostas completas do formulário de 8 etapas],
status, queuePosition?, isWaitlisted?,
previousAnimalId?, previousAnimalName?,
rejectionReason?, rejectionDetails?, rejectedBy?, rejectedAt?,
pendingExport?,
adminNotes?, createdAt, updatedAt
```

Status possíveis: `pending` · `in_review` · `approved` · `rejected` · `withdrawn` · `declined`

#### `rejectionFlags`

```
id: hmac(cpf)         — chave do documento
emailHash: hmac(email)
rejectedAt, rejectionCount, driveUrl, reason
```

Nenhum dado pessoal legível. O documento é identificado e consultado pelo HMAC do CPF.

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

### Google Drive — estrutura de pastas

```
Contratos de Adoção/
  2026/
    application_{id}_{year}.pdf
Rejeições Definitivas/
  2026/
    rejection_{id}_{year}.pdf
Animais Arquivados/
  2026/
    animal_{id}_{year}.pdf
```

Subpastas anuais criadas automaticamente pelo helper `getYearlyFolderId()`.

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
    adoption/    # form multi-step, consent-modal, hooks, schemas, services, tipos de fila
    animals/     # cards, galeria, filtros, quick-view modal, archive-modal, hooks, services, storage
    auth/        # context, protected-route, smart-entry, hooks, services
    admin/       # header context, hooks, metadata service
    contact/     # componentes e config de links
    users/       # hooks e services
  layouts/       # PublicLayout (com footer linkando política e termos), AdminLayout
  lib/           # firebase.ts (com persistentLocalCache), query-client.ts
  pages/
    admin/       # login, reset-password, dashboard, animais, candidaturas,
                 # destaques, alertas, usuários, configurações
    public/      # home, animais, animal-detail, adotar, adotar-geral, sobre,
                 # contato, privacy-policy, terms-of-use
  types/         # tipos compartilhados + constantes de retenção LGPD
  utils/         # cn, animations, format
functions/src/
  index.ts       # ponto de exportação de todas as Cloud Functions
  lib/
    crypto.util.ts   # AES-256-GCM + HMAC-SHA256
    pdf.helper.ts    # geração de PDFs (3 templates com pdf-lib)
    drive.helper.ts  # Google Drive API (upload + subpastas anuais)
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

As chaves sensíveis das Cloud Functions ficam **exclusivamente no Google Cloud Secret Manager** — nunca em `.env`:

| Secret | Uso |
|---|---|
| `PII_ENCRYPTION_KEY` | Chave AES-256 (hex 64 chars) para cifrar CPF, telefone, endereço e data de nascimento |
| `HMAC_SECRET_KEY` | Chave HMAC-SHA256 para hashes de CPF e email em `rejectionFlags` e `rateLimits` |
| `DRIVE_OAUTH_CLIENT_ID` | Client ID OAuth2 usado pelo helper de upload para o Google Drive |
| `DRIVE_OAUTH_CLIENT_SECRET` | Client secret OAuth2 usado pelo helper de upload para o Google Drive |
| `DRIVE_OAUTH_REFRESH_TOKEN` | Refresh token da conta autorizada a gravar nas pastas internas da ONG |

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

> As Cloud Functions que usam Secret Manager (`createApplication`, `getApplicationPII`, `archiveAndCleanup`, etc.) precisam estar deployadas para funcionar com os secrets reais. Localmente, simule os valores via variáveis de ambiente temporárias ou use o emulador com `--import`.

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
- O arquivo [`.claude/ROADMAP.md`](.claude/ROADMAP.md) documenta o histórico de implementação por fase e sprint
- A comarca para fins jurídicos é **Flores da Cunha/RS**
