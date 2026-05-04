;(() => {
  const STORAGE_KEY = 'upeva-theme'
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && window.navigator.standalone === true)

  const getSystemTheme = () =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

  const getInitialThemeColor = (resolvedTheme, pathname) => {
    if (pathname === '/' && isStandalone) {
      return resolvedTheme === 'dark' ? '#352b22' : '#f3eadc'
    }

    if (pathname === '/' || pathname === '/sobre' || pathname === '/contato') {
      return resolvedTheme === 'dark' ? '#352b22' : '#f3eadc'
    }

    if (pathname === '/admin/login' || pathname === '/admin/reset-password') {
      return resolvedTheme === 'dark' ? 'rgb(27, 22, 20)' : 'rgb(249, 248, 245)'
    }

    if (pathname.startsWith('/admin')) {
      return resolvedTheme === 'dark' ? 'rgb(45, 40, 36)' : 'rgb(255, 255, 255)'
    }

    return resolvedTheme === 'dark' ? 'rgb(27, 22, 20)' : 'rgb(249, 248, 245)'
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
    const resolvedTheme = theme === 'system' ? getSystemTheme() : theme
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme

    const color = getInitialThemeColor(resolvedTheme, window.location.pathname)
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) {
      themeMeta.setAttribute('content', color)
    }
    document.body.style.backgroundColor = color
  } catch {}
})()
