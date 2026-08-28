/**
 * The four brand marks the hero's chaos field scatters.
 *
 * Inlined for the same reason `src/components/auth/github-mark.tsx` is:
 * lucide-react v1 dropped its brand icons, so there is nothing to import.
 * Notion, Slack and VS Code are recognisable approximations rather than
 * official artwork.
 *
 * `.icon.solid` fills from `currentColor` — CSS beats a presentation
 * attribute, so a `fill` on the path would lose to the sheet's `fill: none`.
 * Slack is the exception: its four brand colors are set per path and do win,
 * because they beat the inherited value rather than a competing rule.
 */

const PROPS = {
  className: "icon solid",
  viewBox: "0 0 24 24",
  "aria-hidden": true,
} as const;

export function NotionMark() {
  return (
    <svg {...PROPS}>
      <path d="M4 3.6 15.6 2.7c1.4-.1 1.8 0 2.7.6l3 2.1c.6.4.8.5.8 1v13.2c0 .9-.3 1.4-1.5 1.5l-13.4.8c-.9 0-1.3-.1-1.7-.7l-2.2-2.9c-.5-.6-.7-1.1-.7-1.7V5c0-.7.3-1.3 1.4-1.4Zm12 2-11 .8c-.2 0-.2.3 0 .4l1.9 1.4c.3.2.6.3 1 .3l11-.7c.2 0 .2-.3 0-.4l-2-1.4c-.3-.3-.6-.4-.9-.4Zm-9.4 4.2v11c0 .5.3.7.9.7l11.2-.7c.5 0 .6-.4.6-.8V9.4c0-.4-.2-.6-.6-.6L6.9 9.5c-.2 0-.3.2-.3.3Zm10.6 1.1c0 .3 0 .6-.4.6l-.9.2v7.6l-1.4.1c-.3 0-.4-.1-.6-.4l-2.3-3.6v3.4l1 .2s0 .6-.7.6l-2.9.2c0-.3 0-.5.3-.5l.7-.2v-6.8l-1-.1c0-.3.1-.7.6-.7l3.1-.2 2.5 3.8v-3.3l-.9-.1c0-.4.2-.6.6-.6Z" />
    </svg>
  );
}

export function GitHubBrandMark() {
  return (
    <svg {...PROPS}>
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2q-3.3.7-4-1.6c-.3-.7-.7-1-1.2-1.3-.9-.6.1-.6.1-.6a2.4 2.4 0 0 1 1.8 1.2 2.5 2.5 0 0 0 3.4 1 2.5 2.5 0 0 1 .8-1.6c-2.7-.3-5.5-1.3-5.5-5.9a4.7 4.7 0 0 1 1.2-3.2 4.3 4.3 0 0 1 .1-3.2s1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C17.3 5.6 18.3 6 18.3 6a4.3 4.3 0 0 1 .1 3.2 4.6 4.6 0 0 1 1.2 3.2c0 4.6-2.8 5.6-5.5 5.9a2.8 2.8 0 0 1 .8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

export function SlackMark() {
  return (
    <svg {...PROPS}>
      <path
        d="M5.1 15.2a2.1 2.1 0 1 1-2.1-2.1h2.1Zm1 0a2.1 2.1 0 0 1 4.2 0v5.2a2.1 2.1 0 1 1-4.2 0Z"
        fill="#e01e5a"
      />
      <path
        d="M8.2 5.1a2.1 2.1 0 1 1 2.1-2.1v2.1Zm0 1a2.1 2.1 0 0 1 0 4.2H3a2.1 2.1 0 1 1 0-4.2Z"
        fill="#36c5f0"
      />
      <path
        d="M18.9 8.2a2.1 2.1 0 1 1 2.1 2.1h-2.1Zm-1 0a2.1 2.1 0 0 1-4.2 0V3a2.1 2.1 0 1 1 4.2 0Z"
        fill="#2eb67d"
      />
      <path
        d="M15.8 18.9a2.1 2.1 0 1 1-2.1 2.1v-2.1Zm0-1a2.1 2.1 0 0 1 0-4.2H21a2.1 2.1 0 1 1 0 4.2Z"
        fill="#ecb22e"
      />
    </svg>
  );
}

export function VsCodeMark() {
  return (
    <svg {...PROPS}>
      <path d="M17.6 1.3 8.9 9.6 4.4 6.2 2.4 7.2l3.9 4.8-3.9 4.8 2 1 4.5-3.4 8.7 8.3 4.4-2.1V3.4ZM17.7 7.1v9.8L11.6 12Z" />
    </svg>
  );
}
