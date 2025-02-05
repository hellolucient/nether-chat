import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>
      p: DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>
      button: DetailedHTMLProps<HTMLAttributes<HTMLButtonElement>, HTMLButtonElement>
      span: DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>
      img: DetailedHTMLProps<HTMLAttributes<HTMLImageElement>, HTMLImageElement>
      h2: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
      main: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
      header: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
      h1: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
      aside: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
} 