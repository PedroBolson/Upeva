import {
  Cat,
  Dog,
  Facebook,
  HandCoins,
  Instagram,
  Music2,
  ShoppingBag,
} from 'lucide-react'

export interface ContactSocialLink {
  label: string
  href: string
  icon: React.ElementType
}

export interface ContactHubLink {
  label: string
  href: string
  description: string
  icon: React.ElementType
  external?: boolean
}

export const contactSocialLinks: ContactSocialLink[] = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/upeva',
    icon: Instagram,
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@upeva',
    icon: Music2,
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/upevaoficial',
    icon: Facebook,
  },
]

export const contactHubLinks: ContactHubLink[] = [
  {
    label: 'Formulário Adoção Cães',
    description: 'Comece a candidatura para adoção de cachorros.',
    href: '/adotar?especie=dog',
    icon: Dog,
  },
  {
    label: 'Formulário Adoção Gatos',
    description: 'Abra o formulário específico para adoção de gatos.',
    href: '/adotar?especie=cat',
    icon: Cat,
  },
  {
    label: 'Lojinha Upeva + Petlove',
    description: 'Compre pelos canais parceiros e apoie a causa.',
    href: 'https://www.petlove.com.br/?utm_source=upeva&utm_medium=lojas_online',
    icon: ShoppingBag,
    external: true,
  },
  {
    label: 'Doe continuamente pelo Apoia.se',
    description: 'Ajude a manter resgates, cuidados e tratamentos.',
    href: 'https://apoia.se/upeva',
    icon: HandCoins,
    external: true,
  },
  {
    label: 'Facebook',
    description: 'Acompanhe campanhas, adoções e novidades.',
    href: 'https://www.facebook.com/upevaoficial',
    icon: Facebook,
    external: true,
  },
  {
    label: 'TikTok',
    description: 'Veja bastidores, resgates e histórias dos animais.',
    href: 'https://www.tiktok.com/@upeva',
    icon: Music2,
    external: true,
  },
]
