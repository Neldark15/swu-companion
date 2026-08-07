import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dist` es lo construido. Los `*-banco.tsx` / `banco-*.tsx` de la raíz son
  // arneses TEMPORALES de medición —montan una pantalla real fuera del
  // AuthGate e instrumentan WebGL para contar draw calls y fugas de memoria—.
  // Viven en la raíz a propósito, fuera de `src/`, así que nunca entran al
  // bundle; pero el linter los trataba como componentes de la app y su
  // instrumentación (reasignar métodos del contexto WebGL) no puede cumplir
  // esas reglas ni tiene por qué.
  globalIgnores(['dist', 'banco-*.tsx', '*-banco.tsx']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      /**
       * El guion bajo como «esto no se usa a propósito».
       *
       * El código ya venía usando esa convención —`_setCode`, `_gameScore`,
       * `_myName`— para parámetros que la firma exige pero el cuerpo no
       * necesita: quitarlos obligaría a tocar a todos los llamadores para no
       * ganar nada. Es la convención estándar de TypeScript; solo faltaba
       * decírsela al linter.
       *
       * Ojo: es para PARÁMETROS y capturas. Una variable local sin usar sigue
       * siendo un error, porque ahí sí suele ser código muerto de verdad.
       */
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
])
