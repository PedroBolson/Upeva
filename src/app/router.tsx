import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PublicLayout } from '@/layouts/public-layout'
import { AdminLayout } from '@/layouts/admin-layout'
import { ProtectedRoute } from '@/features/auth/components/protected-route'

import { SmartEntry } from '@/features/auth/components/smart-entry'
import { AnimalsPage } from '@/pages/public/animals'
import { AnimalDetailPage } from '@/pages/public/animal-detail'
import { AdoptionFormPage } from '@/pages/public/adoption-form'
import { AdoptionGeneralPage } from '@/pages/public/adoption-general'
import { AboutPage } from '@/pages/public/about'
import { ContactPage } from '@/pages/public/contact'
import { PrivacyPolicyPage } from '@/pages/public/privacy-policy'
import { TermsOfUsePage } from '@/pages/public/terms-of-use'

import { LoginPage } from '@/pages/admin/login'
import { ResetPasswordPage } from '@/pages/admin/reset-password'
import { DashboardPage } from '@/pages/admin/dashboard'
import { AdminAnimalsPage } from '@/pages/admin/animals'
import { AnimalFormPage } from '@/pages/admin/animal-form'
import { ApplicationsPage } from '@/pages/admin/applications'
import { ApplicationDetailPage } from '@/pages/admin/application-detail'
import { SettingsPage } from '@/pages/admin/settings'
import { UsersPage } from '@/pages/admin/users'
import { FeaturedAnimalsPage } from '@/pages/admin/featured-animals'
import { RejectionFlagsPage } from '@/pages/admin/rejection-flags'

const router = createBrowserRouter([
  {
    path: '/',
    element: <SmartEntry />,
  },
  {
    element: <PublicLayout />,
    children: [
      { path: '/animais', element: <AnimalsPage /> },
      { path: '/animais/:id', element: <AnimalDetailPage /> },
      { path: '/adotar', element: <AdoptionGeneralPage /> },
      { path: '/adotar/:id', element: <AdoptionFormPage /> },
      { path: '/sobre', element: <AboutPage /> },
      { path: '/contato', element: <ContactPage /> },
      { path: '/politica-de-privacidade', element: <PrivacyPolicyPage /> },
      { path: '/termos-de-uso', element: <TermsOfUsePage /> },
    ],
  },
  {
    path: '/admin/login',
    element: <LoginPage />,
  },
  {
    path: '/admin/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    element: <AdminLayout />,
    children: [
      { path: '/admin', element: <DashboardPage /> },
      { path: '/admin/animais', element: <AdminAnimalsPage /> },
      { path: '/admin/animais/novo', element: <AnimalFormPage /> },
      { path: '/admin/animais/:id/editar', element: <AnimalFormPage /> },
      { path: '/admin/candidaturas', element: <ApplicationsPage /> },
      { path: '/admin/candidaturas/:id', element: <ApplicationDetailPage /> },
      { path: '/admin/usuarios', element: <ProtectedRoute requiredRole="admin"><UsersPage /></ProtectedRoute> },
      { path: '/admin/destaques', element: <FeaturedAnimalsPage /> },
      { path: '/admin/alertas', element: <ProtectedRoute requiredRole="admin"><RejectionFlagsPage /></ProtectedRoute> },
      { path: '/admin/configuracoes', element: <SettingsPage /> },
    ],
  },
])

export function Router() {
  return <RouterProvider router={router} />
}
