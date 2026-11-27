type TDocumentationLinkBadgeProps = {
  href: string;
  className?: string;
  /** `minified` renders the external-link icon alone, without the badge chrome. */
  variant?: "default" | "minified";
};

/**
 * Renders nothing: this build links to no external Infisical documentation. The component and its
 * props stay so the many call sites keep compiling and upstream merges stay small.
 */
export const DocumentationLinkBadge: (props: TDocumentationLinkBadgeProps) => null = () => null;
