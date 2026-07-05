import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Poster } from './poster'

describe('Poster', () => {
  it('renders the image when a src is provided', () => {
    render(<Poster src="https://img/x.jpg" alt="Poster alt" width={32} height={48} />)
    const img = screen.getByAltText('Poster alt')
    expect(img).toHaveAttribute('src', 'https://img/x.jpg')
  })

  it('renders an N/A placeholder when src is null', () => {
    render(<Poster src={null} alt="" width={32} height={48} />)
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('applies the size to the image wrapper', () => {
    const { container } = render(
      <Poster src="https://img/x.jpg" alt="" width={32} height={48} />
    )
    expect(container.firstChild).toHaveStyle({ width: '32px', height: '48px' })
  })

  it('applies a custom placeholder font size', () => {
    render(<Poster src={null} alt="" width={32} height={48} placeholderFontSize={10} />)
    expect(screen.getByText('N/A')).toHaveStyle({ fontSize: '10px' })
  })
})
