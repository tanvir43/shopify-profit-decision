/// <reference types="vite/client" />
/// <reference types="@react-router/node" />
/// <reference types="@shopify/app-bridge-types" />

declare namespace JSX {
  interface IntrinsicElements {
    "s-skeleton-paragraph": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & { content?: string },
      HTMLElement
    >;
  }
}
