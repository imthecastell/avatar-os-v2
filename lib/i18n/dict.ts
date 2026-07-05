export type Locale = 'es' | 'en' | 'nl' | 'fr'

export const DICT = {
  createPfp:          { es: 'Crear PFP',                                en: 'Create PFP',                    nl: 'PFP maken',                        fr: 'Créer PFP' },
  random:             { es: 'Aleatorio',                                 en: 'Random',                        nl: 'Willekeurig',                      fr: 'Aléatoire' },
  step:               { es: 'Paso',                                     en: 'Step',                          nl: 'Stap',                              fr: 'Étape' },
  of:                 { es: 'de',                                       en: 'of',                            nl: 'van',                               fr: 'sur' },
  skipGuide:          { es: 'Saltar guía',                               en: 'Skip guide',                    nl: 'Gids overslaan',                    fr: 'Passer le guide' },
  doneCustomize:      { es: '¡Listo! Personalizar todo',                 en: 'Done! Customize everything',    nl: 'Klaar! Alles aanpassen',            fr: 'Terminé ! Tout personnaliser' },
  next:               { es: 'Siguiente',                                 en: 'Next',                          nl: 'Volgende',                          fr: 'Suivant' },
  requiredHint:       { es: 'Elige una opción para continuar',           en: 'Pick an option to continue',    nl: 'Kies een optie om verder te gaan', fr: 'Choisis une option pour continuer' },
  skinTone:           { es: 'Tono de piel',                              en: 'Skin tone',                     nl: 'Huidskleur',                        fr: 'Teint de peau' },
  fantasyHint:        { es: 'Bordes punteados = tonos de fantasía',      en: 'Dashed border = fantasy tones', nl: 'Gestippelde rand = fantasiekleuren', fr: 'Bordure pointillée = teintes fantaisie' },
  front:              { es: 'Frente',                                    en: 'Front',                         nl: 'Voorkant',                          fr: 'Devant' },
  back:               { es: 'Trasero',                                   en: 'Back',                          nl: 'Achterkant',                        fr: 'Arrière' },
  color:              { es: 'Color',                                     en: 'Color',                         nl: 'Kleur',                             fr: 'Couleur' },
  customColor:        { es: 'Color personalizado',                       en: 'Custom color',                  nl: 'Aangepaste kleur',                  fr: 'Couleur personnalisée' },
  customizeColor:     { es: 'Personalizar color',                        en: 'Customize color',               nl: 'Kleur aanpassen',                   fr: 'Personnaliser la couleur' },
  secretCode:         { es: 'CÓDIGO SECRETO',                            en: 'SECRET CODE',                   nl: 'GEHEIME CODE',                      fr: 'CODE SECRET' },
  unlock:             { es: 'Activar',                                   en: 'Unlock',                        nl: 'Ontgrendelen',                      fr: 'Déverrouiller' },
  haveSecretCode:     { es: 'Tengo un código secreto',                   en: 'I have a secret code',           nl: 'Ik heb een geheime code',           fr: "J'ai un code secret" },
  noOptions:          { es: 'Sin opciones',                              en: 'No options',                    nl: 'Geen opties',                       fr: 'Aucune option' },
  createMyPfp:        { es: 'Crear mi PFP',                              en: 'Create my PFP',                 nl: 'Maak mijn PFP',                     fr: 'Créer mon PFP' },
  keysUnlocked:       { es: 'clave(s)',                                  en: 'key(s)',                        nl: 'sleutel(s)',                        fr: 'clé(s)' },
  startOver:          { es: 'Empezar de nuevo',                          en: 'Start over',                    nl: 'Opnieuw beginnen',                  fr: 'Recommencer' },
  startOverConfirm:   { es: '¿Reiniciar tu avatar desde cero?',          en: 'Restart your avatar from scratch?', nl: 'Je avatar helemaal opnieuw beginnen?', fr: 'Recommencer votre avatar depuis le début ?' },

  // Pantalla de bienvenida
  welcomeCta:         { es: 'Crear mi propio avatar',                    en: 'Create my own avatar',          nl: 'Maak mijn eigen avatar',            fr: 'Créer mon propre avatar' },
  haveKeyword:        { es: '¿Tienes una palabra clave?',                en: 'Got a secret word?',             nl: 'Heb je een geheim woord?',          fr: 'Vous avez un mot secret ?' },
  keywordPlaceholder: { es: 'Escríbela aquí…',                           en: 'Type it here…',                 nl: 'Typ het hier…',                     fr: 'Tapez-le ici…' },
  continueToBuilder:  { es: 'Continuar al builder público',              en: 'Continue to the builder',       nl: 'Doorgaan naar de builder',          fr: 'Continuer vers le créateur' },
  unlockExperience:   { es: 'Desbloquear experiencia',                   en: 'Unlock experience',             nl: 'Ervaring ontgrendelen',             fr: "Débloquer l'expérience" },
  followUs:           { es: 'Síguenos',                                  en: 'Follow us',                     nl: 'Volg ons',                          fr: 'Suivez-nous' },
  wrongCode:          { es: 'Código incorrecto',                        en: 'Incorrect code',                nl: 'Onjuiste code',                     fr: 'Code incorrect' },

  // Ajuste de cabello (solo assets con allowTransform)
  adjustFit:          { es: 'Ajustar a tu cabeza',                       en: 'Adjust to your head',           nl: 'Aanpassen aan je hoofd',            fr: 'Ajuster à ta tête' },
  scale:              { es: 'Escala',                                   en: 'Scale',                          nl: 'Schaal',                            fr: 'Échelle' },
  positionX:          { es: 'Posición horizontal',                      en: 'Horizontal position',            nl: 'Horizontale positie',               fr: 'Position horizontale' },
  positionY:          { es: 'Posición vertical',                        en: 'Vertical position',              nl: 'Verticale positie',                 fr: 'Position verticale' },
  resetAdjustment:    { es: 'Restablecer',                              en: 'Reset',                          nl: 'Resetten',                          fr: 'Réinitialiser' },

  // Modal de exportar/compartir
  exportReadyTitle:    { es: 'Tu Avatar está listo ✦',                   en: 'Your Avatar is ready ✦',        nl: 'Je Avatar is klaar ✦',              fr: 'Ton Avatar est prêt ✦' },
  exportReadySubtitle: { es: 'Cada pieza es única, como tú.',            en: 'Every piece is unique, like you.', nl: 'Elk stuk is uniek, net als jij.', fr: 'Chaque pièce est unique, comme toi.' },
  downloadSocial:      { es: 'Descargar para redes',                    en: 'Download for social',            nl: 'Downloaden voor social',            fr: 'Télécharger pour les réseaux' },
  downloadPfp:         { es: 'Descargar PFP',                           en: 'Download PFP',                   nl: 'PFP downloaden',                    fr: 'Télécharger le PFP' },
  share:               { es: 'Compartir',                               en: 'Share',                           nl: 'Delen',                             fr: 'Partager' },
  avatarNamePlaceholder: { es: 'Nombre de tu avatar (opcional)',         en: "Your avatar's name (optional)", nl: 'Naam van je avatar (optioneel)',    fr: 'Nom de ton avatar (facultatif)' },
  myAvatarShareTitle:  { es: 'Mi Avatar',                                en: 'My Avatar',                      nl: 'Mijn Avatar',                       fr: 'Mon Avatar' },
} as const

export type DictKey = keyof typeof DICT

export function makeT(locale: string) {
  return (key: DictKey) => DICT[key][(locale as Locale)] ?? DICT[key].en
}

export const LOCALE_META: Record<Locale, { label: string; flag: string }> = {
  es: { label: 'Español',    flag: '🇪🇸' },
  en: { label: 'English',    flag: '🇬🇧' },
  nl: { label: 'Nederlands', flag: '🇳🇱' },
  fr: { label: 'Français',   flag: '🇫🇷' },
}
