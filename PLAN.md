Fase 1 — Planejamento Completo da Plataforma Upeva
1. Estratégia Geral
A plataforma será uma SPA com duas áreas distintas:

Área pública: vitrine de animais, detalhes, formulário de adoção, páginas institucionais. Sem autenticação.
Área administrativa: protegida por Firebase Auth (email/senha), acessível apenas por membros da ONG. Dashboard, gestão de animais, triagem de candidaturas.
A arquitetura segue o princípio de separação por feature (feature-based), onde cada domínio do sistema agrupa seus componentes, hooks, serviços e tipos. Recursos compartilhados ficam em camadas transversais (components/ui, hooks, lib, utils).

O formulário de adoção será um componente multi-step único e reutilizável, parametrizado por espécie (cão/gato), com condicionais dinâmicas entre perguntas.

2. Arquitetura de Pastas

src/
├── app/                          # Setup da aplicação
│   ├── App.tsx                   # Root component
│   ├── router.tsx                # Definição de rotas
│   └── providers.tsx             # Composição de providers
│
├── assets/                       # Imagens, SVGs estáticos
│
├── components/
│   └── ui/                       # Design system (Button, Input, Card, Badge, Modal, etc.)
│       ├── button.tsx
│       ├── input.tsx
│       ├── textarea.tsx
│       ├── select.tsx
│       ├── checkbox.tsx
│       ├── radio-group.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── modal.tsx
│       ├── skeleton.tsx
│       ├── spinner.tsx
│       ├── empty-state.tsx
│       ├── error-state.tsx
│       ├── pagination.tsx
│       ├── data-table.tsx
│       ├── file-upload.tsx
│       ├── stepper.tsx           # Indicador visual de steps do formulário
│       └── index.ts              # Barrel export
│
├── features/
│   ├── animals/                  # Domínio: Animais
│   │   ├── components/           # AnimalCard, AnimalGrid, AnimalFilters, AnimalForm, AnimalStatusBadge
│   │   ├── hooks/                # useAnimals, useAnimal, useAnimalMutations
│   │   ├── services/             # animals.service.ts (CRUD Firestore)
│   │   ├── schemas/              # animal.schema.ts (Zod)
│   │   └── types/                # animal.types.ts
│   │
│   ├── adoption/                 # Domínio: Adoção
│   │   ├── components/           # AdoptionForm, steps/, AdoptionSummary
│   │   │   └── steps/            # Step1Identification, Step2PetPreferences, etc.
│   │   ├── hooks/                # useAdoptionForm, useAdoptionSteps
│   │   ├── services/             # adoption.service.ts
│   │   ├── schemas/              # adoption.schema.ts (schema unificado com refinements por espécie)
│   │   ├── types/                # adoption.types.ts
│   │   └── config/               # form-config.ts (definição de steps, campos condicionais)
│   │
│   ├── auth/                     # Domínio: Autenticação
│   │   ├── components/           # LoginForm, ProtectedRoute
│   │   ├── hooks/                # useAuth
│   │   ├── services/             # auth.service.ts
│   │   └── contexts/             # auth.context.tsx
│   │
│   └── applications/             # Domínio: Candidaturas (admin)
│       ├── components/           # ApplicationList, ApplicationDetail, ApplicationStatusBadge
│       ├── hooks/                # useApplications, useApplication
│       ├── services/             # applications.service.ts
│       └── types/                # application.types.ts
│
├── hooks/                        # Hooks globais (useMediaQuery, useDebounce, useScrollTop)
│
├── layouts/
│   ├── public-layout.tsx         # Navbar + Footer público
│   └── admin-layout.tsx          # Sidebar + Header admin
│
├── lib/
│   ├── firebase.ts               # (já existe) Inicialização Firebase
│   └── query-client.ts           # Configuração TanStack Query
│
├── pages/
│   ├── public/
│   │   ├── home.tsx
│   │   ├── animals.tsx
│   │   ├── animal-detail.tsx
│   │   ├── adoption-form.tsx
│   │   ├── about.tsx
│   │   └── contact.tsx
│   │
│   └── admin/
│       ├── dashboard.tsx
│       ├── animals.tsx
│       ├── animal-form.tsx       # Cadastro e edição (mesmo componente)
│       ├── applications.tsx
│       ├── application-detail.tsx
│       └── settings.tsx
│
├── styles/
│   └── index.css                 # Tema global + tokens + Tailwind imports
│
├── types/
│   └── common.ts                 # Tipos globais (Timestamp wrappers, enums compartilhados)
│
├── utils/
│   ├── cn.ts                     # Utility para merge de classes (clsx + twMerge)
│   ├── format.ts                 # Formatadores (data, telefone, moeda)
│   └── storage.ts                # Helpers para upload/download Firebase Storage
│
├── main.tsx
└── vite-env.d.ts
3. Camadas e Responsabilidades
Camada	Responsabilidade	Exemplo
Pages	Composição de layout + features. Sem lógica de negócio.	pages/public/animals.tsx monta filtros + grid
Features/Components	UI específica do domínio. Recebem dados via props ou hooks.	AnimalCard, AdoptionForm
Features/Hooks	Orquestram TanStack Query + serviços. Expõem dados e mutations.	useAnimals() retorna { data, isLoading, error }
Features/Services	Acesso direto ao Firestore/Storage/Auth. Funções puras. Sem React.	getAnimals(), createApplication()
Features/Schemas	Validação Zod. Fonte única da verdade para validação.	adoptionSchema com refinements condicionais
Features/Types	Interfaces TypeScript derivadas dos schemas ou definidas manualmente.	Animal, AdoptionApplication
Components/UI	Design system. Genéricos, tematizados, sem lógica de negócio.	Button, Input, Modal
Layouts	Estrutura visual das áreas (pública e admin).	Navbar, Sidebar, Footer
Lib	Configuração de libs externas.	Firebase init, QueryClient
Utils	Funções utilitárias puras, sem dependência de React.	cn(), formatPhone()
4. Design System e Tema
Tokens Semânticos (CSS Custom Properties)
Definidos no index.css via Tailwind CSS v4 @theme + variáveis CSS. Suporte completo a light/dark.


Tokens planejados:

--color-background          Fundo principal
--color-foreground          Texto principal
--color-card                Fundo de cards
--color-card-foreground     Texto em cards
--color-primary             Cor de ação principal (botões, links ativos)
--color-primary-foreground  Texto sobre primary
--color-secondary           Cor secundária (ações alternativas)
--color-secondary-foreground
--color-muted               Fundos sutis, seções neutras
--color-muted-foreground    Texto de baixa ênfase
--color-accent              Destaque sutil (hover, seleção)
--color-accent-foreground
--color-border              Bordas e divisores
--color-input               Borda de inputs
--color-ring                Anel de foco (acessibilidade)
--color-success             Feedback positivo
--color-success-foreground
--color-warning             Feedback de alerta
--color-warning-foreground
--color-danger              Feedback de erro / destrutivo
--color-danger-foreground

--radius                    Border radius padrão
Paleta proposta
A identidade visual deve transmitir acolhimento, confiança e profissionalismo. Proponho uma paleta baseada em tons quentes neutros com um primary acolhedor:

Primary: tom de amber/laranja quente (remete a acolhimento, energia, cuidado animal)
Secondary: tom de slate/cinza azulado (profissionalismo, contraste)
Success/Warning/Danger: verde, âmbar, vermelho — semânticos padrão
Background: branco quente (light) / cinza escuro quente (dark)
Os valores exatos de HSL serão definidos na implementação. Todas as cores usadas em qualquer componente virão exclusivamente desses tokens.

Componentes base do design system
Todos tematizados, com variantes, acessíveis e responsivos:

Button — variantes: default, secondary, outline, ghost, danger; tamanhos: sm, md, lg
Input — com label, erro, ícone opcional
Textarea — mesma API do Input
Select — nativo estilizado
Checkbox / RadioGroup
Card — com header, body, footer opcionais
Badge — variantes por status (disponível, adotado, em análise)
Modal — com overlay, animação Framer Motion, trap de foco
Skeleton — para loading states
Spinner — indicador de carregamento
EmptyState — ícone + mensagem + ação opcional
ErrorState — ícone de erro + mensagem + retry
Pagination — com navegação por página
DataTable — cabeçalho, linhas, ordenação, responsivo
FileUpload — drag & drop + preview
Stepper — indicador visual de progresso do formulário multi-step
5. Rotas e Páginas
Área Pública
Rota	Página	Descrição
/	Home	Landing page com destaques, CTA, animais recentes
/animais	Animals	Listagem com filtros (espécie, sexo, porte, status)
/animais/:id	AnimalDetail	Galeria de fotos, detalhes, CTA para adoção
/adotar/:id	AdoptionForm	Formulário multi-step vinculado ao animal
/sobre	About	Página institucional da ONG
/contato	Contact	Informações de contato e formas de apoio
Área Administrativa
Rota	Página	Descrição
/admin/login	Login	Formulário de login (email/senha)
/admin	Dashboard	Métricas resumidas, ações rápidas
/admin/animais	AdminAnimals	Lista com busca, filtros, status, ações
/admin/animais/novo	AnimalForm	Cadastro de novo animal
/admin/animais/:id/editar	AnimalForm	Edição de animal existente
/admin/candidaturas	Applications	Lista de candidaturas com triagem
/admin/candidaturas/:id	ApplicationDetail	Detalhes completos + ações (aprovar, rejeitar, etc.)
/admin/configuracoes	Settings	Configurações básicas (perfil admin)
Todas as rotas /admin/* (exceto login) são protegidas por ProtectedRoute.

6. Entidades e Tipos Principais
Animal

type Species = 'dog' | 'cat'
type Sex = 'male' | 'female'
type Size = 'small' | 'medium' | 'large' // apenas para cães
type AnimalStatus = 'available' | 'under_review' | 'adopted' | 'archived'

interface Animal {
  id: string
  name: string
  species: Species
  sex: Sex
  size?: Size                    // apenas para cães
  breed?: string
  estimatedAge?: string
  description: string
  photos: string[]               // URLs do Firebase Storage
  coverPhotoIndex: number
  status: AnimalStatus
  vaccines: string[]
  neutered: boolean
  specialNeeds?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
AdoptionApplication

type ApplicationStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'withdrawn'

type HousingType =
  | 'house_open_yard'       // casa com pátio aberto
  | 'house_closed_yard'     // casa com pátio fechado
  | 'house_no_yard'         // casa sem pátio
  | 'apartment_no_screens'  // apartamento sem telas (gatos)
  | 'apartment_with_screens'// apartamento com telas (gatos)
  | 'apartment'             // apartamento (cães)

interface AdoptionApplication {
  id: string
  animalId: string
  animalName: string
  species: Species

  // Dados do adotante
  applicant: {
    email: string
    fullName: string
    birthDate: string          // ISO date string
    phone: string
    address: {
      street: string
      number: string
      complement?: string
      city: string
      state: string
    }
  }

  // Composição familiar
  household: {
    adultsCount: number
    childrenCount: number
    childrenAges?: string       // condicional: só se childrenCount > 0
  }

  // Preferências do pet (campos visíveis no step inicial)
  petPreferences: {
    preferredSize?: Size        // apenas cães
    preferredSex?: Sex
    jointAdoption?: boolean     // apenas gatos
  }

  // Estilo de vida
  lifestyle: {
    adoptionReason: string
    isGift: boolean             // apenas gatos
    hoursHomePeoplePerDay: string
  }

  // Moradia
  housing: {
    isRented: boolean
    landlordAllowsPets?: boolean  // condicional: só se isRented
    housingType: HousingType
  }

  // Histórico com pets
  petHistory: {
    hadPetsBefore: boolean
    previousPets?: string          // condicional: só se hadPetsBefore
    hasCurrentPets: boolean
    currentPetsCount?: number      // condicional: só se hasCurrentPets
    currentPetsVaccinated?: boolean // condicional: só se hasCurrentPets (gatos)
    currentPetsVaccinationReason?: string // condicional: só se !currentPetsVaccinated
  }

  // Responsabilidade e compromisso
  responsibility: {
    canAffordCosts: boolean
    monthlyEstimate: string        // "R$200-350" (cães) / "R$250-300" (gatos)
    scratchBehaviorResponse: string
    escapeResponse: string
    cannotKeepResponse: string
    longTermCommitment: boolean    // 15+ anos
  }

  // Termos e acordos
  agreements: {
    awareOfVaccineCosts: boolean
    allowsHomeInspection: boolean
    wontTransferWithoutConsulting: boolean
    willNotifyAddressChange: boolean
    agreesToAdoptionContract: boolean
    additionalComments?: string
    acceptsLiabilityTerms: boolean
  }

  status: ApplicationStatus
  adminNotes?: string
  reviewedBy?: string
  reviewedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
Admin User

interface AdminUser {
  uid: string
  email: string
  displayName: string
  role: 'admin'
  createdAt: Timestamp
}
7. Estratégia Firebase
Firestore — Collections

/animals/{animalId}                    → Animal
/applications/{applicationId}          → AdoptionApplication
/admins/{uid}                          → AdminUser
Firestore Rules (proposta)

- /animals: read público, write apenas admin autenticado
- /applications: create público (submissão), read/update apenas admin autenticado
- /admins: read/write apenas o próprio admin ou um super-admin
Regra de segurança importante: a criação de applications deve validar que campos obrigatórios estão presentes (validação server-side via rules ou Cloud Function).

Storage Rules

- /animals/{animalId}/*: read público, write apenas admin autenticado
- Upload limitado a imagens (content type image/*), tamanho máximo ~5MB
Otimização de Leituras
Listagem pública de animais: query com where status == 'available' + orderBy createdAt desc + limit para paginação cursor-based
Detalhes do animal: documento único por ID
Dashboard admin: contadores podem ser mantidos em um documento /metadata/counts atualizado via Cloud Function (evita count queries caras)
Candidaturas: paginação por createdAt, filtro por status
Cloud Functions (futuras)
onApplicationCreate: notificação por email para admins
scheduledCleanup: arquivamento de animais adotados há mais de X meses
updateCounters: increment/decrement de contadores no metadata
8. Estratégia do Formulário Multi-Step
Arquitetura
Um único componente AdoptionForm que recebe a species como prop (derivada do animal selecionado). A configuração dos steps, campos e condicionais vive em um arquivo de config separado (form-config.ts), não hardcoded nos componentes.

Estrutura

features/adoption/
├── components/
│   ├── adoption-form.tsx          # Orquestrador: controla navegação entre steps
│   ├── adoption-summary.tsx       # Resumo antes de enviar
│   └── steps/
│       ├── step-identification.tsx      # Email + nome + dados pessoais
│       ├── step-pet-preferences.tsx     # Preferências do pet (com condicionais por espécie)
│       ├── step-household.tsx           # Composição familiar
│       ├── step-lifestyle.tsx           # Motivação + rotina
│       ├── step-housing.tsx             # Moradia
│       ├── step-pet-history.tsx         # Histórico com animais
│       ├── step-responsibility.tsx      # Compromisso financeiro e comportamental
│       └── step-agreements.tsx          # Termos, acordos, termo de ciência
├── hooks/
│   ├── use-adoption-form.ts       # Hook principal: RHF + Zod + step navigation
│   └── use-adoption-steps.ts      # Lógica de quais steps mostrar por espécie
├── schemas/
│   └── adoption.schema.ts         # Schema Zod unificado com superRefine por espécie
├── config/
│   └── form-config.ts             # Definição declarativa de steps e condicionais
└── types/
    └── adoption.types.ts
Fluxo de navegação
O formulário terá 8 steps (reorganizados para melhor UX em relação aos formulários atuais):

Step	Título	Conteúdo
1	Identificação	Email, nome completo, data de nascimento, telefone, endereço completo
2	Preferências do Pet	Sexo preferido, porte (cão), adoção conjunta (gato)
3	Sua Família	Adultos, crianças, idade das crianças (condicional)
4	Estilo de Vida	Motivação, é presente? (gato), horas com pessoas em casa
5	Moradia	Alugada? Proprietário permite? (condicional), tipo de moradia
6	Histórico com Pets	Já teve? Quais? (condicional), tem atualmente? Quantos? (condicional), vacinas em dia? (gato, condicional)
7	Compromisso	Condições financeiras, custo estimado, respostas comportamentais, compromisso longo prazo
8	Termos e Acordos	Vacinas, vistoria, não repassar, notificar mudanças, contrato, termo de ciência
Mudanças em relação aos formulários atuais:

Steps 1 e 3 atuais (email separado dos dados pessoais) foram unificados — não faz sentido ter um step só para email
Steps de "já teve pets" e "tem pets atualmente" que estavam separados em 3-4 steps (gatos) foram consolidados em um único step
Pergunta sobre "idade das crianças" agora é condicional dentro do step de família (não um step separado)
Informações sobre o pet preferido ficam logo no início, após identificação
9. Análise Comparativa: Formulário Cães vs Gatos
Campos COMUNS (idênticos nos dois formulários)
Campo	Observação
Email	Idêntico
Nome do pet visualizado	Idêntico (pré-preenchido via rota)
Sexo do pet	Idêntico
Nome completo	Idêntico
Data de nascimento	Idêntico
Telefone	Idêntico
Endereço	Gatos tem campos separados (rua, número, complemento, cidade/estado). Cães é "endereço completo". Proposta: padronizar com campos estruturados
Adultos na casa	Idêntico
Crianças na casa	Idêntico
Idade das crianças	Idêntico (condicional)
Por que quer adotar	Idêntico
Horas com pessoas em casa	Idêntico
Casa alugada / proprietário permite	Idêntico
Já teve pets	Idêntico
Tem pets atualmente	Idêntico
Condições financeiras	Idêntico (valor estimado diferente)
Respostas comportamentais	Idênticas (arranhar, fugir, não poder cuidar)
Compromisso 15+ anos	Idêntico
Todos os termos e acordos	Idênticos
Termo de ciência	Idêntico
Campos EXCLUSIVOS de Cães
Campo	Observação
Porte do cão	small, medium, large
Tipo de moradia	Opções específicas: casa com pátio aberto/fechado, sem pátio, apartamento
Campos EXCLUSIVOS de Gatos
Campo	Observação
Adoção conjunta (2 animais)	Sim/Não
Vai dar de presente?	Sim/Não
Tipo de moradia	Opções específicas: casa aberta/fechada, apartamento com/sem telas
Vacinas dos pets atuais em dia?	Condicional (se tem pets atualmente)
Motivo de vacinas não estarem em dia	Condicional (se vacinas não estão em dia)
Campos MAL ESTRUTURADOS nos formulários atuais
Problema	Proposta
Endereço como campo único (cães)	Padronizar com campos estruturados: rua, número, complemento, cidade, estado
"Já teve outros pets? Quais?" em um campo só (cães)	Separar em: hadPetsBefore: boolean + previousPets: string (condicional)
Custo mensal embutido na pergunta	Exibir como texto informativo no step, não como campo
Steps excessivos no formulário de gatos (12 steps)	Consolidar de 12 para 8 steps
Steps com uma única pergunta	Agrupar perguntas tematicamente
Pergunta "pets possuem vacinas em dia" só para gatos	Manter apenas para gatos conforme processo atual, mas como campo condicional
10. Proposta de Padronização
Schema Zod Unificado
Um único schema adoptionSchema que usa superRefine para validar condicionalmente:


- Campos base: sempre validados
- Se species === 'dog': validar `preferredSize`, usar HousingType de cães
- Se species === 'cat': validar `jointAdoption`, `isGift`, usar HousingType de gatos
- Se childrenCount > 0: validar `childrenAges`
- Se isRented === true: validar `landlordAllowsPets`
- Se hadPetsBefore === true: validar `previousPets`
- Se hasCurrentPets === true: validar `currentPetsCount`
- Se hasCurrentPets === true && species === 'cat': validar `currentPetsVaccinated`
- Se currentPetsVaccinated === false: validar `currentPetsVaccinationReason`
Componentes de Step
Cada step recebe species como prop e renderiza condicionalmente os campos exclusivos. Um step como StepPetPreferences mostrará o campo size apenas se species === 'dog' e jointAdoption apenas se species === 'cat'.

Persistência parcial
O formulário salva progresso no sessionStorage a cada troca de step, permitindo que o usuário volte sem perder dados. Não salva rascunho no Firestore (economia de escritas + privacidade).

11. Proposta de Condicionais por Resposta
Condição	Campos exibidos
species === 'dog'	preferredSize, housing options de cão
species === 'cat'	jointAdoption, isGift, housing options de gato
childrenCount > 0	childrenAges
housing.isRented === true	landlordAllowsPets
petHistory.hadPetsBefore === true	previousPets
petHistory.hasCurrentPets === true	currentPetsCount
petHistory.hasCurrentPets === true && species === 'cat'	currentPetsVaccinated
petHistory.currentPetsVaccinated === false	currentPetsVaccinationReason
Implementação via watch do React Hook Form — quando o valor observado muda, o campo condicional aparece/desaparece com animação Framer Motion.

12. Componentes Base Reutilizáveis
Todos os componentes do design system serão criados com:

Props tipadas via interface
Variantes via prop variant
Tamanhos via prop size
Forward ref quando necessário
Classes via cn() (clsx + tailwind-merge)
Apenas tokens do tema
Lista dos componentes na ordem de prioridade:

Button — fundação de toda interação
Input — com integração RHF via forwardRef
Textarea — mesma API
Select — nativo estilizado
Checkbox / RadioGroup — para formulário
Card — usado em listagens e detalhes
Badge — status de animais e candidaturas
Modal — confirmações, detalhes rápidos
Skeleton — loading states
Spinner — ações assíncronas
EmptyState / ErrorState — feedback visual
Stepper — indicador de progresso do formulário
Pagination — listagens
DataTable — área admin
FileUpload — cadastro de animais
13. Plano de Implementação por Fases
Fase A — Fundação
Configuração do tema (tokens CSS, light/dark mode)
Utilitário cn()
Componentes UI base (Button, Input, Textarea, Select, Checkbox, RadioGroup, Card, Badge)
Layouts (PublicLayout, AdminLayout com Navbar, Sidebar, Footer)
Setup do React Router com todas as rotas
Setup do TanStack Query (QueryClient, provider)
Contexto de autenticação + ProtectedRoute
Fase B — Área Pública
Página Home
Listagem de animais com filtros
Página de detalhe do animal
Páginas About e Contact
Fase C — Formulário de Adoção
Schema Zod unificado
Hook useAdoptionForm com navegação multi-step
Componente Stepper
Todos os step components com condicionais
Resumo e envio
Serviço de criação no Firestore
Fase D — Área Administrativa
Página de Login
Dashboard com métricas
CRUD de animais (listagem, cadastro, edição, upload de fotos)
Gestão de candidaturas (listagem, detalhe, triagem, mudança de status)
Página de configurações
Fase E — Polimento e Produção
Skeleton/loading em todas as páginas
Empty states e error states
Animações Framer Motion em transições de página
Responsividade completa
Acessibilidade (labels, aria, foco, contraste)
Firestore Rules e Storage Rules definitivas
SEO básico (meta tags, Open Graph)
14. Riscos Técnicos e Decisões de Longo Prazo
Risco/Decisão	Mitigação
Custo Firestore	Paginação cursor-based, contadores em documento metadata, cache agressivo via TanStack Query (staleTime), queries com limit
Storage abuse	Rules restritivas (apenas admin faz upload), limite de tamanho, validação de content type
Segurança de candidaturas	Dados sensíveis (nome, endereço, telefone) acessíveis apenas por admin. Firestore Rules bloqueiam leitura pública.
Escalabilidade do formulário	Config-driven: adicionar novo campo ou step exige editar config + schema, não reescrever componentes
Dark mode	Definido desde o início via tokens CSS. Sem retrabalho futuro.
Futuras espécies (coelhos, etc.)	A arquitetura com species como parâmetro permite extensão sem refatoração estrutural
Multi-admin	Coleção admins permite múltiplos usuários com roles futuros
Cloud Functions region	Já configurado para southamerica-east1, minimizando latência
Sem dependência de component library	Design system próprio garante controle total, sem risco de breaking changes de libs externas
15. Checklist de Aprovação
Preciso da sua aprovação nos seguintes pontos antes de implementar:

 Estrutura de pastas — está de acordo?
 Separação de camadas — pages / features / components / lib / utils
 Tokens semânticos e paleta — amber quente como primary, slate como secondary
 Rotas propostas — públicas e admin
 Entidades e tipos — Animal, AdoptionApplication, AdminUser
 Coleções Firestore — animals, applications, admins
 Reorganização do formulário de 9/12 steps para 8 steps
 Campos comuns vs exclusivos — análise está correta?
 Condicionais — lista de condições está completa?
 Padronização do endereço em campos estruturados
 Persistência do formulário em sessionStorage (não Firestore)
 Plano de fases (A → B → C → D → E)
 Design system próprio (sem Shadcn/Radix)
 Componentes base propostos — lista e prioridade
Aguardo sua análise e aprovação. Se quiser ajustar qualquer ponto — paleta, estrutura, steps do formulário, entidades — é o momento ideal antes de iniciar a implementação.