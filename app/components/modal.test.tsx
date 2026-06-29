import { describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModalShell, useEscapeKey } from './modal'

describe('useEscapeKey', () => {
  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    renderHook(() => useEscapeKey(onClose))
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', async () => {
    const onClose = vi.fn()
    renderHook(() => useEscapeKey(onClose))
    await userEvent.keyboard('a')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('removes the listener on unmount', async () => {
    const onClose = vi.fn()
    const { unmount } = renderHook(() => useEscapeKey(onClose))
    unmount()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ModalShell', () => {
  it('renders its children', () => {
    render(
      <ModalShell onClose={vi.fn()}>
        <p>Panel content</p>
      </ModalShell>
    )
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <ModalShell onClose={onClose}>
        <p>Inside</p>
      </ModalShell>
    )
    // The backdrop is the outermost element.
    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: container.firstChild as Element,
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when a click originates inside the panel', async () => {
    const onClose = vi.fn()
    render(
      <ModalShell onClose={onClose}>
        <button>Inside</button>
      </ModalShell>
    )
    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: screen.getByText('Inside'),
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <ModalShell onClose={onClose}>
        <p>Inside</p>
      </ModalShell>
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
