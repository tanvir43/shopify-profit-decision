type PageLayoutProps = {
  title: string;
  children?: React.ReactNode;
  /**
   * Optional page-level primary action.
   * Pass a single `<s-button slot="primary-action" variant="primary">`.
   */
  primaryAction?: React.ReactNode;
};

export function PageLayout({ title, children, primaryAction }: PageLayoutProps) {
  return (
    <s-page heading={title}>
      {primaryAction}
      {children}
    </s-page>
  );
}
