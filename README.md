# Upeva

Plataforma web para divulgacao de animais, envio de candidaturas de adocao e operacao interna da ONG.

O projeto atual e uma SPA em React com duas areas principais:

- area publica para visitantes, com vitrine de animais e formulario de adocao
- area administrativa para equipe da ONG, protegida por Firebase Auth

O backend operacional usa Firebase Hosting, Firestore, Storage, Authentication e Cloud Functions.

## Estado atual do projeto

Hoje o repositorio ja contem:

- home publica com destaque para animais disponiveis
- listagem publica de animais com filtros por especie, sexo, porte e busca por nome
- pagina de detalhes do animal com galeria e CTA para adocao
- fluxo publico de candidatura de adocao geral e por animal
- paginas institucionais `sobre` e `contato`
- area administrativa com login, dashboard, animais, candidaturas, usuarios e configuracoes
- CRUD basico de animais com upload de fotos no Firebase Storage
- triagem de candidaturas com atualizacao de status
- gestao de usuarios internos com roles `admin` e `reviewer`
- espelhamento automatico de usuarios do Firebase Auth para a colecao `users`
- bootstrap automatico do primeiro admin via Cloud Function

## Stack

### Frontend

- React 19
- TypeScript
- Vite 8
- React Router 7
- TanStack Query 5
- React Hook Form
- Zod
- Tailwind CSS 4
- Framer Motion
- Firebase Web SDK

### Backend e infraestrutura

- Firebase Hosting
- Cloud Firestore
- Firebase Storage
- Firebase Authentication
- Firebase Functions
  - `onUserCreated` em 1st gen
  - `createUser`, `updateUserRole` e `onApplicationStatusChanged` em 2nd gen

## Rotas atuais

### Publicas

- `/`
- `/animais`
- `/animais/:id`
- `/adotar`
- `/adotar/:id`
- `/sobre`
- `/contato`

### Administrativas

- `/admin/login`
- `/admin`
- `/admin/animais`
- `/admin/animais/novo`
- `/admin/animais/:id/editar`
- `/admin/candidaturas`
- `/admin/candidaturas/:id`
- `/admin/usuarios`
- `/admin/configuracoes`

## Auth e roles

A autenticacao administrativa usa `email/senha` no Firebase Auth.

Os roles atuais sao:

- `admin`: acesso total a toda a area administrativa, incluindo gestao de usuarios
- `reviewer`: acesso a dashboard, animais, candidaturas e configuracoes, sem acesso a gestao de usuarios

O frontend valida staff buscando `users/{uid}` no Firestore. Se o usuario autenticado nao tiver um perfil com role valido (`admin` ou `reviewer`), o login e recusado.

## Bootstrap do primeiro admin

O fluxo atual para criar o primeiro admin e:

1. fazer deploy das Functions
2. criar manualmente o primeiro usuario em `Firebase Console > Authentication`
3. a function `onUserCreated` espelha esse usuario em `users/{uid}`
4. se ainda nao existir nenhum usuario com role `admin`, o primeiro usuario espelhado recebe `role: "admin"`

Depois que o primeiro admin existir, a criacao normal de novos usuarios deve ser feita pela tela `/admin/usuarios`, que chama a function `createUser`.

## Funcionalidades por area

### Area publica

- exibe apenas animais com `status = available`
- pagina `/animais` aplica filtros no cliente apos buscar os animais disponiveis
- home mostra animais disponiveis em destaque
- formulario de adocao e multi-step, com campos condicionais por especie
- e possivel iniciar candidatura geral em `/adotar` ou vinculada a um animal em `/adotar/:id`

### Area administrativa

- dashboard com resumo de animais e candidaturas
- cadastro, edicao e alteracao de status de animais
- upload e remocao de fotos de animais no Storage
- listagem de candidaturas e tela de detalhe com atualizacao de status
- pagina de usuarios para admins criarem staff e alterarem roles
- pagina de configuracoes para a conta autenticada

## Estrutura de dados atual

### Firestore

Colecoes usadas hoje:

- `animals`
- `applications`
- `users`

#### `animals`

Cada documento representa um animal da ONG e inclui, entre outros:

- `name`
- `species`
- `sex`
- `size?`
- `breed?`
- `estimatedAge?`
- `description`
- `photos`
- `coverPhotoIndex`
- `status`
- `vaccines`
- `neutered`
- `specialNeeds?`
- `createdAt`
- `updatedAt`

#### `applications`

Cada documento representa uma candidatura de adocao com:

- identificacao do animal quando a candidatura e vinculada a um pet
- respostas completas do formulario
- `status`
- `adminNotes?`
- `createdAt`
- `updatedAt`

Os status atuais sao:

- `pending`
- `in_review`
- `approved`
- `rejected`
- `withdrawn`

#### `users`

Cada documento espelha um usuario autenticado da equipe:

- `uid`
- `email`
- `displayName`
- `role`
- `createdAt`
- `createdBy`
- `updatedAt?`

### Storage

As fotos dos animais sao armazenadas em caminhos sob:

- `animals/{animalId}/...`

## Cloud Functions atuais

As Functions ficam em [`functions/src/index.ts`](functions/src/index.ts).

### `onUserCreated`

- trigger de Auth
- espelha usuarios do Firebase Auth para `users/{uid}`
- define o primeiro usuario como `admin`
- define usuarios posteriores criados fora do fluxo do app como `reviewer`

### `createUser`

- callable function
- somente `admin`
- cria usuario no Firebase Auth
- grava o espelho em `users/{uid}`

### `updateUserRole`

- callable function
- somente `admin`
- atualiza o role de outro usuario
- bloqueia autoalteracao do proprio role

### `onApplicationStatusChanged`

- trigger de escrita em `applications/{appId}`
- sincroniza `animals.status` quando o status da candidatura muda
- uso atual:
  - `in_review` -> `under_review`
  - `approved` -> `adopted`
  - `rejected` ou `withdrawn` -> volta para `available` se nao houver outra candidatura ativa

## Regras atuais de seguranca

### Firestore

As regras atuais estao em [`firestore.rules`](firestore.rules).

Resumo do comportamento atual:

- `animals`
  - leitura publica
  - create/update/delete apenas para staff (`admin` ou `reviewer`)
- `applications`
  - create publico
  - read/update/delete apenas para staff
- `users`
  - qualquer usuario autenticado pode ler o proprio documento
  - apenas `admin` pode listar ou ler outros usuarios
  - updates do proprio documento sao limitados a `displayName` e `updatedAt`
  - create/delete via cliente bloqueados

### Storage

As regras atuais estao em [`storage.rules`](storage.rules).

Resumo do comportamento atual:

- leitura publica de imagens de animais
- escrita apenas para usuarios autenticados
- upload limitado a imagens com ate 10 MB

## Estrutura do frontend

O projeto segue uma organizacao por features.

```text
src/
  app/
  components/ui/
  features/
    adoption/
    animals/
    auth/
    users/
  layouts/
  lib/
  pages/
    admin/
    public/
  types/
  utils/
```

### Pastas principais

- `src/app`
  - providers globais
  - router
  - theme provider
- `src/components/ui`
  - componentes reutilizaveis como button, input, modal, table, pagination, file upload e stepper
- `src/features`
  - regras por dominio, com hooks, services, schemas e components
- `src/layouts`
  - layout publico e layout admin
- `src/pages`
  - composicao final das rotas
- `src/lib`
  - integracao com Firebase e Query Client

## Variaveis de ambiente

As variaveis esperadas pelo frontend estao em [`.env.example`](.env.example):

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

## Scripts

### Raiz do projeto

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

### Functions

```bash
npm --prefix functions run lint
npm --prefix functions run build
npm --prefix functions run serve
npm --prefix functions run deploy
```

## Como rodar localmente

1. Instale dependencias da raiz:

```bash
npm install
```

2. Instale dependencias das Functions:

```bash
npm install --prefix functions
```

3. Crie o arquivo `.env` a partir de `.env.example` e preencha com as credenciais do projeto Firebase.

4. Rode o frontend:

```bash
npm run dev
```

5. Se precisar trabalhar nas Functions localmente:

```bash
npm --prefix functions run build
```

ou

```bash
npm --prefix functions run serve
```

## Build e deploy

### Frontend

O build de producao gera a pasta `dist`:

```bash
npm run build
```

### Firebase

O deploy e controlado por [`firebase.json`](firebase.json):

- Hosting publica `dist`
- Functions usam `functions/` como source
- antes do deploy das Functions, o Firebase roda:
  - `npm --prefix "$RESOURCE_DIR" run lint`
  - `npm --prefix "$RESOURCE_DIR" run build`

Deploy completo:

```bash
firebase deploy
```

Deploy apenas do hosting:

```bash
firebase deploy --only hosting
```

Deploy apenas das functions:

```bash
firebase deploy --only functions
```

## Observacoes importantes

- o projeto nao possui suite automatizada de testes configurada neste momento
- a listagem publica de animais mostra apenas animais disponiveis
- a regiao padrao do projeto para Firestore e Functions esta configurada como `southamerica-east1`
- `onUserCreated` usa 1st gen com regiao explicita, enquanto as demais Functions atuais usam 2nd gen
- o repositorio ainda contem o arquivo [`PLAN.md`](PLAN.md), usado como referencia de implementacao, mas o README descreve o estado real do codigo atual
