import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PublicLayout } from '@/layouts/public-layout'
import { AdminLayout } from '@/layouts/admin-layout'
import { ProtectedRoute } from '@/features/auth/components/protected-route'

import { HomePage } from '@/pages/public/home'
import { AnimalsPage } from '@/pages/public/animals'
import { AnimalDetailPage } from '@/pages/public/animal-detail'
import { AdoptionFormPage } from '@/pages/public/adoption-form'
import { AdoptionGeneralPage } from '@/pages/public/adoption-general'
import { AboutPage } from '@/pages/public/about'
import { ContactPage } from '@/pages/public/contact'

import { LoginPage } from '@/pages/admin/login'
import { ResetPasswordPage } from '@/pages/admin/reset-password'
import { DashboardPage } from '@/pages/admin/dashboard'
import { AdminAnimalsPage } from '@/pages/admin/animals'
import { AnimalFormPage } from '@/pages/admin/animal-form'
import { ApplicationsPage } from '@/pages/admin/applications'
import { ApplicationDetailPage } from '@/pages/admin/application-detail'
import { SettingsPage } from '@/pages/admin/settings'
import { UsersPage } from '@/pages/admin/users'

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/',             element: <HomePage /> },
      { path: '/animais',      element: <AnimalsPage /> },
      { path: '/animais/:id',  element: <AnimalDetailPage /> },
      { path: '/adotar',       element: <AdoptionGeneralPage /> },
      { path: '/adotar/:id',   element: <AdoptionFormPage /> },
      { path: '/sobre',        element: <AboutPage /> },
      { path: '/contato',      element: <ContactPage /> },
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
      { path: '/admin',                         element: <DashboardPage /> },
      { path: '/admin/animais',                 element: <AdminAnimalsPage /> },
      { path: '/admin/animais/novo',            element: <AnimalFormPage /> },
      { path: '/admin/animais/:id/editar',      element: <AnimalFormPage /> },
      { path: '/admin/candidaturas',            element: <ApplicationsPage /> },
      { path: '/admin/candidaturas/:id',        element: <ApplicationDetailPage /> },
      { path: '/admin/usuarios',                element: <ProtectedRoute requiredRole="admin"><UsersPage /></ProtectedRoute> },
      { path: '/admin/configuracoes',           element: <SettingsPage /> },
    ],
  },
])

export function Router() {
  return <RouterProvider router={router} />
}
