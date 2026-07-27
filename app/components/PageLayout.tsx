type PageLayoutProps = {
  title: string;
};

export function PageLayout({ title }: PageLayoutProps) {
  return <s-page heading={title} />;
}
