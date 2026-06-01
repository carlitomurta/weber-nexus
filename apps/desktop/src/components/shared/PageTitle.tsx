interface PageTitleProps {
  page: string;
  title: string;
  subtitle: string;
}

export const PageTitle = ({ page, title, subtitle }: PageTitleProps) => (
  <div>
    <div className="text-[10px] font-mono tracking-[0.2em] text-primary uppercase">
      {page}
    </div>
    <h1 className="text-3xl font-semibold tracking-tight mt-1">{title}</h1>
    <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
  </div>
);
