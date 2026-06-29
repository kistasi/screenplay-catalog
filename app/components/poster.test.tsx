import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Poster } from './poster'

describe('Poster', () => {
  it('renders the image when a src is provided', () => {
    render(<Poster src="https://img/x.jpg" alt="Poster alt" className="h-12 w-8" />)
    const img = screen.getByAltText('Poster alt')
    expect(img).toHaveAttribute('src', 'https://img/x.jpg')
  })

  it('renders an N/A placeholder when src is null', () => {
    render(<Poster src={null} alt="" className="h-12 w-8" />)
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('applies the size className to the image wrapper', () => {
    const { container } = render(
      <Poster src="https://img/x.jpg" alt="" className="h-12 w-8" />
    )
    expect(container.firstChild).toHaveClass('h-12', 'w-8')
  })

  it('applies a custom placeholder text size', () => {
    render(
      <Poster src={null} alt="" className="h-12 w-8" placeholderText="text-[10px]" />
    )
    expect(screen.getByText('N/A')).toHaveClass('text-[10px]')
  })
})
