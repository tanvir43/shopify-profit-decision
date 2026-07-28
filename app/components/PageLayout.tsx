type PageLayoutProps = {
  title: string;
  children?: React.ReactNode;
};

export function PageLayout({ title, children }: PageLayoutProps) {
  return <s-page heading={title}>{children}</s-page>;
}
