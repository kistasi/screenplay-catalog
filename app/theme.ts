import { createTheme } from '@mui/material/styles'

// Matches the app's previous near-black/light-gray Tailwind palette.
export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'dark',
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
    text: {
      primary: '#ededed',
    },
  },
  typography: {
    fontFamily: 'var(--font-geist-sans), Arial, Helvetica, sans-serif',
  },
  shape: {
    borderRadius: 8,
  },
})
