import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es', 'en', 'nl', 'fr'],
  defaultLocale: 'es',
  localeDetection: true,
})
