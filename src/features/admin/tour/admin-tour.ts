import type { DriveStep } from 'driver.js'
import type { UserRole } from '@/types/common'

export const TOUR_VERSION = 'v3'

export interface TourStepConfig {
  step: DriveStep
  // Route to navigate to when the user clicks "Avançar" on this step.
  // When clickAdvances is true and the user clicks the real element instead,
  // navigation already happens via React Router — we skip re-navigating.
  navTarget: string | null
  // If true, clicking the highlighted element also advances the tour.
  // Only set on interactive elements (nav links, route links) where clicking
  // naturally causes navigation. Do NOT set on informational cards/divs.
  clickAdvances: boolean
}

export function firestoreTourKey(role: UserRole): string {
  return `${role}-onboarding-${TOUR_VERSION}`
}

function localStorageTourKey(role: UserRole): string {
  return `upeva-tour-${role}-onboarding-${TOUR_VERSION}`
}

export function isTourCompleted(
  role: UserRole | undefined,
  completedTours?: Record<string, unknown> | null,
): boolean {
  if (!role) return true
  const key = firestoreTourKey(role)
  if (completedTours && key in completedTours) return true
  return !!localStorage.getItem(localStorageTourKey(role))
}

export function markTourCompletedLocally(role: UserRole | undefined): void {
  if (!role) return
  localStorage.setItem(localStorageTourKey(role), 'true')
}

// Nav elements in the sidebar are only always-visible on desktop.
// On mobile, the sidebar closes after each navigation, so returning undefined
// makes driver.js show a centered popover without highlighting — safe on mobile.
function safeNavEl(selector: string): string | undefined {
  if (typeof window !== 'undefined' && window.innerWidth < 768) return undefined
  return selector
}

export function getAdminTourConfigs(): TourStepConfig[] {
  return [
    // 0 – Welcome
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        popover: {
          title: 'Bem-vindo ao painel Upeva',
          description:
            'Este tutorial mostra as principais áreas do sistema e os fluxos mais importantes.<br><br>Use o botão <strong>Avançar</strong> ou a tecla <strong>→</strong> para ir ao próximo passo. Para voltar um passo, use a tecla <strong>←</strong> ou o botão <strong>Voltar</strong>. Para sair, clique no <strong>X</strong> ou pressione a tecla <strong>Esc</strong>.',
        },
      },
    },

    // 1 – Dashboard charts (stay on /admin)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="dashboard-charts"]',
        popover: {
          title: 'Dashboard',
          description:
            'Os gráficos mostram a distribuição de animais por status e o volume de candidaturas recebidas. Use como ponto de partida para entender o estado atual do sistema.',
        },
      },
    },

    // 2 – Animals nav item → navigate to /admin/animais
    {
      navTarget: '/admin/animais',
      clickAdvances: true,
      step: {
        element: safeNavEl('[data-tour="nav-animais"]'),
        popover: {
          title: 'Menu — Animais',
          description:
            'Clique em "Animais" para acessar a lista de animais cadastrados. Você também pode clicar em Avançar que eu abro essa tela para você.',
          side: 'right',
        },
      },
    },

    // 3 – Animal filters (on /admin/animais)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-filters"]',
        popover: {
          title: 'Filtros e busca',
          description:
            'Busque animais pelo nome ou filtre por status (Disponível, Em análise, Adotado, Arquivado). Útil para encontrar rapidamente um animal específico ou ver quais estão disponíveis para adoção.',
          side: 'bottom',
        },
      },
    },

    // 4 – Animals list
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animals-list-area"]',
        popover: {
          title: 'Lista de animais',
          description:
            'Todos os animais cadastrados aparecem aqui. Clique em qualquer linha para abrir o perfil completo, onde você pode editar dados, fotos, status e informações de saúde.',
        },
      },
    },

    // 5 – Create animal button → navigate to /admin/animais/novo
    {
      navTarget: '/admin/animais/novo',
      clickAdvances: true,
      step: {
        element: '[data-tour="create-animal-button"]',
        popover: {
          title: 'Cadastrar novo animal',
          description:
            'Clique aqui para abrir o formulário de cadastro. Durante o tutorial, abriremos o formulário apenas para visualização — você não precisa preencher nem salvar nada.',
          side: 'bottom',
        },
      },
    },

    // 6 – Animal form: basic info
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-form-basic"]',
        popover: {
          title: 'Informações principais',
          description:
            'Preencha nome, espécie, sexo, porte, raça e idade estimada. Esses dados organizam a listagem interna e são exibidos na vitrine pública.',
        },
      },
    },

    // 7 – Animal form: photos
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-form-photos"]',
        popover: {
          title: 'Fotos',
          description:
            'Faça upload de até 10 fotos. Defina a foto de capa clicando na estrela — ela será a imagem principal exibida na vitrine pública e nos resultados de busca.',
        },
      },
    },

    // 8 – Animal form: description
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-form-description"]',
        popover: {
          title: 'Descrição',
          description:
            'Conte a personalidade, o comportamento e o histórico do animal. Uma boa descrição aumenta o engajamento dos candidatos e melhora a qualidade das candidaturas recebidas.',
        },
      },
    },

    // 9 – Animal form: health
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-form-health"]',
        popover: {
          title: 'Saúde e cuidados',
          description:
            'Informe castração, vacinas e necessidades especiais. Essas informações aparecem na página pública do animal e ajudam os candidatos a avaliar a compatibilidade.',
        },
      },
    },

    // 10 – Animal form: publication/status
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-form-publication"]',
        popover: {
          title: 'Publicação e status',
          description:
            '"Disponível" publica o animal na vitrine e permite candidaturas. "Em análise" mantém visível mas indica processo em andamento. "Adotado" e "Arquivado" removem da vitrine.',
          side: 'left',
        },
      },
    },

    // 11 – Animal form: actions (nav-candidaturas step follows)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-form-actions"]',
        popover: {
          title: 'Salvar e ações',
          description:
            'Clique em "Cadastrar animal" para salvar. Após o cadastro, você pode gerar arte de divulgação para redes sociais. A exclusão permanente é somente para administradores.',
          side: 'left',
        },
      },
    },

    // 12 – Candidaturas nav item → navigate to /admin/candidaturas
    {
      navTarget: '/admin/candidaturas',
      clickAdvances: true,
      step: {
        element: safeNavEl('[data-tour="nav-candidaturas"]'),
        popover: {
          title: 'Menu — Candidaturas',
          description:
            'Clique em "Candidaturas" para acessar todas as solicitações de adoção. Você também pode clicar em Avançar que eu abro essa tela para você.',
          side: 'right',
        },
      },
    },

    // 13 – Applications: status tabs (on /admin/candidaturas)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="applications-status-tabs"]',
        popover: {
          title: 'Filtro por status',
          description:
            'Filtre candidaturas por status: Pendente (aguardando triagem), Em análise (avaliação em andamento), Aprovada, Rejeitada ou Retirada (candidato desistiu). No dia a dia, comece pela aba Pendente.',
          side: 'bottom',
        },
      },
    },

    // 14 – Applications: list
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="applications-list-area"]',
        popover: {
          title: 'Lista de candidaturas',
          description:
            'Cada linha mostra o candidato, o animal e o status. Clique em qualquer linha para abrir o detalhe completo: dados pessoais, histórico, PDFs vinculados, nota interna e ações de aprovação ou rejeição. Não é necessário fazer nenhuma ação agora.',
        },
      },
    },

    // 15 – Arquivos nav item → navigate to /admin/arquivos
    {
      navTarget: '/admin/arquivos',
      clickAdvances: true,
      step: {
        element: safeNavEl('[data-tour="nav-arquivos"]'),
        popover: {
          title: 'Menu — Arquivos',
          description:
            'Clique em "Arquivos" para acessar os PDFs gerados pelo sistema. Você também pode clicar em Avançar que eu abro essa tela para você.',
          side: 'right',
        },
      },
    },

    // 16 – Archive files (on /admin/arquivos)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="archive-info-card"]',
        popover: {
          title: 'Arquivos PDF',
          description:
            'O sistema gera automaticamente contratos de adoção, registros de rejeição definitiva e arquivamentos de animais. Os links são temporários (expiram em minutos) — clique no botão de download para gerar um novo link sempre que precisar. Somente administradores podem excluir arquivos.',
        },
      },
    },

    // 17 – Usuários nav item → navigate to /admin/usuarios (ADMIN ONLY)
    {
      navTarget: '/admin/usuarios',
      clickAdvances: true,
      step: {
        element: safeNavEl('[data-tour="nav-usuarios"]'),
        popover: {
          title: 'Menu — Usuários (somente admin)',
          description:
            'Clique em "Usuários" para gerenciar quem tem acesso ao painel. Área exclusiva para administradores. Você também pode clicar em Avançar que eu abro essa tela para você.',
          side: 'right',
        },
      },
    },

    // 18 – Users list (on /admin/usuarios) (ADMIN ONLY)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="users-list-area"]',
        popover: {
          title: 'Gerenciamento de usuários (somente admin)',
          description:
            'Administradores têm acesso total ao sistema, incluindo exclusões e gerenciamento de usuários. Analistas podem fazer triagem e editar animais, mas não têm acesso a usuários ou LGPD. Altere o papel pelo seletor em cada linha. A exclusão de usuário é permanente e irreversível.',
          side: 'top',
        },
      },
    },

    // 19 – Privacidade nav item → navigate to /admin/privacidade (ADMIN ONLY)
    {
      navTarget: '/admin/privacidade',
      clickAdvances: true,
      step: {
        element: safeNavEl('[data-tour="nav-privacidade"]'),
        popover: {
          title: 'Menu — Privacidade / LGPD (somente admin)',
          description:
            'Clique em "Privacidade" para atender solicitações de exclusão de dados pessoais. Área exclusiva para administradores. Você também pode clicar em Avançar que eu abro essa tela para você.',
          side: 'right',
        },
      },
    },

    // 20 – Privacy search area (on /admin/privacidade) → navigate to /admin
    {
      navTarget: '/admin',
      clickAdvances: false,
      step: {
        element: '[data-tour="privacy-header-area"]',
        popover: {
          title: 'Privacidade e LGPD (somente admin)',
          description:
            'Use esta área somente para atender solicitações formais de exclusão de dados (LGPD). Busque pelo CPF ou e-mail para localizar candidaturas, histórico e arquivos vinculados à pessoa. As exclusões são permanentes e não podem ser desfeitas.',
          side: 'bottom',
        },
      },
    },

    // 21 – Tutorial replay button (on /admin)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="tour-replay-button"]',
        popover: {
          title: 'Replay do tutorial',
          description:
            'Você pode rever este tutorial a qualquer momento clicando em "Tutorial" na barra lateral. O tutorial não aparece novamente automaticamente após ser concluído.',
          side: 'right',
        },
      },
    },
  ]
}

export function getReviewerTourConfigs(): TourStepConfig[] {
  return [
    // 0 – Welcome
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        popover: {
          title: 'Bem-vindo ao painel Upeva',
          description:
            'Este tutorial mostra as principais áreas disponíveis para analistas.<br><br>Use o botão <strong>Avançar</strong> ou a tecla <strong>→</strong> para ir ao próximo passo. Para voltar um passo, use a tecla <strong>←</strong> ou o botão <strong>Voltar</strong>. Para sair, clique no <strong>X</strong> ou pressione a tecla <strong>Esc</strong>.',
        },
      },
    },

    // 1 – Dashboard charts
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="dashboard-charts"]',
        popover: {
          title: 'Dashboard',
          description:
            'Visão geral da distribuição de animais e volume de candidaturas. Use como ponto de partida para entender o estado atual do sistema.',
        },
      },
    },

    // 2 – Animals nav item → navigate to /admin/animais
    {
      navTarget: '/admin/animais',
      clickAdvances: true,
      step: {
        element: safeNavEl('[data-tour="nav-animais"]'),
        popover: {
          title: 'Menu — Animais',
          description:
            'Clique em "Animais" para acessar a lista de animais. Como analista, você pode cadastrar e editar animais. Você também pode clicar em Avançar que eu abro essa tela para você.',
          side: 'right',
        },
      },
    },

    // 3 – Animal filters (on /admin/animais)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-filters"]',
        popover: {
          title: 'Filtros e busca',
          description:
            'Busque animais pelo nome ou filtre por status (Disponível, Em análise, Adotado, Arquivado). Útil para encontrar animais disponíveis, em processo de adoção ou já adotados.',
          side: 'bottom',
        },
      },
    },

    // 4 – Animals list
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animals-list-area"]',
        popover: {
          title: 'Lista de animais',
          description:
            'Todos os animais cadastrados aparecem aqui. Clique em qualquer linha para abrir o perfil completo e editar dados, fotos ou status.',
        },
      },
    },

    // 5 – Create animal button → navigate to /admin/animais/novo
    {
      navTarget: '/admin/animais/novo',
      clickAdvances: true,
      step: {
        element: '[data-tour="create-animal-button"]',
        popover: {
          title: 'Cadastrar novo animal',
          description:
            'Clique aqui para abrir o formulário de cadastro. Durante o tutorial, abriremos o formulário apenas para visualização — você não precisa preencher nem salvar nada.',
          side: 'bottom',
        },
      },
    },

    // 6 – Animal form: basic info
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-form-basic"]',
        popover: {
          title: 'Informações principais',
          description:
            'Preencha nome, espécie, sexo, porte, raça e idade. Esses dados organizam a listagem interna e são exibidos na vitrine pública.',
        },
      },
    },

    // 7 – Animal form: publication/status
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-form-publication"]',
        popover: {
          title: 'Publicação e status',
          description:
            '"Disponível" publica o animal na vitrine e permite receber candidaturas. "Em análise" mantém visível mas indica processo em andamento.',
          side: 'left',
        },
      },
    },

    // 8 – Animal form: actions (nav-candidaturas step follows)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="animal-form-actions"]',
        popover: {
          title: 'Salvar alterações',
          description:
            'Clique em "Cadastrar animal" ou "Salvar alterações" para confirmar. As alterações só são aplicadas após salvar. A exclusão de animais não está disponível para analistas.',
          side: 'left',
        },
      },
    },

    // 9 – Candidaturas nav item → navigate to /admin/candidaturas
    {
      navTarget: '/admin/candidaturas',
      clickAdvances: true,
      step: {
        element: safeNavEl('[data-tour="nav-candidaturas"]'),
        popover: {
          title: 'Menu — Candidaturas',
          description:
            'Clique em "Candidaturas" — é o principal espaço de trabalho da triagem. Você também pode clicar em Avançar que eu abro essa tela para você.',
          side: 'right',
        },
      },
    },

    // 10 – Applications: status tabs (on /admin/candidaturas)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="applications-status-tabs"]',
        popover: {
          title: 'Filtro por status',
          description:
            'Comece pela aba "Pendente" para ver candidaturas aguardando triagem. Use "Em análise" para as que você já iniciou. Os demais status (Aprovada, Rejeitada, Retirada) ficam para consulta.',
          side: 'bottom',
        },
      },
    },

    // 11 – Applications: list
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="applications-list-area"]',
        popover: {
          title: 'Lista de candidaturas',
          description:
            'Clique em qualquer linha para abrir o detalhe: dados pessoais, histórico de moradia e família, PDFs vinculados e nota interna. Na triagem, você pode alterar o status e registrar observações. As ações de aprovação e rejeição ficam no detalhe da candidatura.',
        },
      },
    },

    // 12 – Arquivos nav item → navigate to /admin/arquivos
    {
      navTarget: '/admin/arquivos',
      clickAdvances: true,
      step: {
        element: safeNavEl('[data-tour="nav-arquivos"]'),
        popover: {
          title: 'Menu — Arquivos',
          description:
            'Clique em "Arquivos" para acessar os PDFs gerados pelo sistema. Você também pode clicar em Avançar que eu abro essa tela para você.',
          side: 'right',
        },
      },
    },

    // 13 – Archive files (on /admin/arquivos) → navigate to /admin
    {
      navTarget: '/admin',
      clickAdvances: false,
      step: {
        element: '[data-tour="archive-info-card"]',
        popover: {
          title: 'Arquivos PDF',
          description:
            'Contratos de adoção e registros de rejeição gerados automaticamente. Os links são temporários (expiram em minutos) — clique no botão de download para gerar um novo link sempre que precisar.',
        },
      },
    },

    // 14 – Tutorial replay button (on /admin)
    {
      navTarget: null,
      clickAdvances: false,
      step: {
        element: '[data-tour="tour-replay-button"]',
        popover: {
          title: 'Replay do tutorial',
          description:
            'Clique em "Tutorial" na barra lateral a qualquer momento para rever este tutorial. O tutorial não aparece novamente automaticamente após ser concluído.',
          side: 'right',
        },
      },
    },
  ]
}
