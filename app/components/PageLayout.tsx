type PageLayoutProps = {
  title: string;
  children?: React.ReactNode;
  /**
   * Optional page-level primary action.
   * Pass a single `<s-button slot="primary-action" variant="primary">`.
   */
  primaryAction?: React.ReactNode;
  /**
   * Optional back navigation in the page title bar.
   * Pass `<s-link slot="breadcrumb-actions" href="...">`.
   */
  breadcrumbActions?: React.ReactNode;
};

export function PageLayout({
  title,
  children,
  primaryAction,
  breadcrumbActions,
}: PageLayoutProps) {
  return (
    <s-page heading={title}>
      {breadcrumbActions}
      {primaryAction}
      {children}
    </s-page>
  );
}
