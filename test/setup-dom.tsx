import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// next/image pulls in server-only machinery and an optimization layer that adds
// nothing in a unit test, so render it as a plain <img>. Next-specific layout
// props are dropped so React doesn't warn about unknown attributes on a native
// element.
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    ...rest
  }: Record<string, unknown> & { src: string; alt: string }) => {
    delete rest.fill
    delete rest.sizes
    delete rest.priority
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...rest} />
  },
}))
