import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'en', 'nl', 'fr'],
  defaultLocale: 'es',
  // false: la URL explícita siempre manda. Con true, una cookie NEXT_LOCALE
  // existente (o el header Accept-Language) podía redirigir /en/... de vuelta
  // a /es/... por detrás del usuario — justo el bug reportado ("la app no se
  // muestra correctamente en los idiomas").
  localeDetection: false,
})
