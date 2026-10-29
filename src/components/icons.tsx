import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6.5 3.8 20 12 6.5 20.2V3.8Z" fill="currentColor" stroke="none" />
  </Svg>
);

export const DownloadIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M4 20h16" />
  </Svg>
);

export const FilePdfIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v5h5" />
    <path d="M8.5 17v-3.5h1.6a1.4 1.4 0 0 1 0 2.8H8.5" />
    <path d="M13.5 17v-3.5h1.2a1.75 1.75 0 0 1 0 3.5h-1.2Z" />
  </Svg>
);

export const FileWordIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v5h5" />
    <path d="m8 13 1.3 4 1.7-3.2L12.7 17 14 13" />
  </Svg>
);

export const FileCodeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v5h5" />
    <path d="m10 12-2 2.5 2 2.5" />
    <path d="m14 12 2 2.5-2 2.5" />
  </Svg>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);

export const XIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
);

export const AlertIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Svg>
);

export const SpinnerIcon = ({ size = 16, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.25}
    strokeLinecap="round"
    className={`animate-spin ${className ?? ""}`}
    aria-hidden="true"
    {...rest}
  >
    <path d="M21 12a9 9 0 1 1-6.2-8.6" />
  </svg>
);

export const ExternalLinkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </Svg>
);

export const RefreshIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 3v6h-6" />
  </Svg>
);

export const TerminalIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m4 17 6-6-6-6" />
    <path d="M12 19h8" />
  </Svg>
);

export const SparklesIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3v3M12 18v3M4.5 12h3M16.5 12h3M6.7 6.7l2.1 2.1M15.2 15.2l2.1 2.1M17.3 6.7l-2.1 2.1M8.8 15.2l-2.1 2.1" />
  </Svg>
);

export const CodeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m9 17-5-5 5-5" />
    <path d="m15 7 5 5-5 5" />
  </Svg>
);

export const EyeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const CopyIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);

export const ArrowDownLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M17 7 7 17" />
    <path d="M17 17H7V7" />
  </Svg>
);
