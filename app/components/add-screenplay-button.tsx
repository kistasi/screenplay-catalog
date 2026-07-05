'use client'

import { useEffect, useRef, useState } from 'react'
import type { TmdbResult } from '@/lib/types'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { PdfUploadForm } from './pdf-upload-form'
import { Poster } from './poster'

export default function AddScreenplayButton({
  onAdd,
}: {
  // Resolves once the screenplay is persisted; rejects on failure.
  onAdd: (result: TmdbResult, pdf: File | null) => Promise<void>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
        Add screenplay
      </Button>

      {open && (
        <AddModal
          onClose={() => setOpen(false)}
          onConfirm={async (movie, pdf) => {
            await onAdd(movie, pdf)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function AddModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (result: TmdbResult, pdf: File | null) => Promise<void>
}) {
  // The title picked in step one; null while still searching.
  const [selected, setSelected] = useState<TmdbResult | null>(null)

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-label="Add screenplay"
    >
      {selected ? (
        <UploadStep movie={selected} onBack={() => setSelected(null)} onConfirm={onConfirm} />
      ) : (
        <SearchStep onSelect={setSelected} onClose={onClose} />
      )}
    </Dialog>
  )
}

function SearchStep({
  onSelect,
  onClose,
}: {
  onSelect: (result: TmdbResult) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced search against our TMDB proxy. Stale requests are aborted.
  useEffect(() => {
    const trimmed = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!trimmed) {
        setResults([])
        setError(null)
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/tmdb/search?query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Search failed.')
        setResults(data.results)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 1000)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ p: 2, borderBottom: 1, borderColor: 'divider', alignItems: 'center' }}
      >
        <TextField
          inputRef={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a film or TV show…"
          variant="standard"
          fullWidth
          slotProps={{ input: { disableUnderline: true } }}
        />
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Box sx={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {loading && (
          <Typography variant="body2" sx={{ p: 2, opacity: 0.6 }}>
            Searching…
          </Typography>
        )}
        {error && (
          <Typography variant="body2" color="error" sx={{ p: 2 }}>
            {error}
          </Typography>
        )}
        {!loading && !error && query.trim() && results.length === 0 && (
          <Typography variant="body2" sx={{ p: 2, opacity: 0.6 }}>
            No results found.
          </Typography>
        )}

        <List disablePadding>
          {results.map((result) => (
            <ListItemButton
              key={`${result.mediaType}-${result.id}`}
              onClick={() => onSelect(result)}
              alignItems="flex-start"
              sx={{ gap: 1.5, py: 1.5 }}
            >
              <Poster src={result.posterUrl} alt="" width={48} height={72} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 500 }}>
                  {result.title}
                  {result.year && (
                    <Typography component="span" sx={{ opacity: 0.5 }}>
                      {' '}
                      ({result.year})
                    </Typography>
                  )}
                  <MediaTypeBadge mediaType={result.mediaType} />
                </Typography>
                {result.overview && (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.25,
                      opacity: 0.6,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {result.overview}
                  </Typography>
                )}
              </Box>
            </ListItemButton>
          ))}
        </List>
      </Box>
    </>
  )
}

function UploadStep({
  movie,
  onBack,
  onConfirm,
}: {
  movie: TmdbResult
  onBack: () => void
  onConfirm: (result: TmdbResult, pdf: File | null) => Promise<void>
}) {
  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Poster src={movie.posterUrl} alt="" width={48} height={72} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 500 }}>
            {movie.title}
            {movie.year && (
              <Typography component="span" sx={{ opacity: 0.5 }}>
                {' '}
                ({movie.year})
              </Typography>
            )}
            <MediaTypeBadge mediaType={movie.mediaType} />
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25, opacity: 0.6 }}>
            {movie.mediaType === 'tv'
              ? 'You can attach episode PDFs after adding the show.'
              : 'Attach the screenplay PDF (optional).'}
          </Typography>
        </Box>
      </Stack>

      {movie.mediaType === 'tv' ? (
        <ConfirmAddStep movie={movie} onBack={onBack} onConfirm={onConfirm} />
      ) : (
        <PdfUploadForm
          cancelLabel="Back"
          submitLabel="Add to catalog"
          submittingLabel="Adding…"
          requirePdf={false}
          onCancel={onBack}
          onSubmit={(pdf) => onConfirm(movie, pdf)}
        />
      )}
    </Box>
  )
}

function ConfirmAddStep({
  movie,
  onBack,
  onConfirm,
}: {
  movie: TmdbResult
  onBack: () => void
  onConfirm: (result: TmdbResult, pdf: File | null) => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Box sx={{ mt: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button variant="text" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button
          variant="contained"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true)
            setError(null)
            try {
              await onConfirm(movie, null)
            } catch (err) {
              setError((err as Error).message)
              setSubmitting(false)
            }
          }}
        >
          {submitting ? 'Adding…' : 'Add to catalog'}
        </Button>
      </Stack>
    </Box>
  )
}

function MediaTypeBadge({ mediaType }: { mediaType: TmdbResult['mediaType'] }) {
  return (
    <Chip
      component="span"
      label={mediaType === 'tv' ? 'TV' : 'Movie'}
      size="small"
      sx={{ ml: 1, height: 18, fontSize: 10, textTransform: 'uppercase', verticalAlign: 'middle' }}
    />
  )
}
