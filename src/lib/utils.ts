import { createCn } from "cn/config";

/**
 * Class merging that knows Clearline's tokens. Without this, the merger treats the
 * custom type-scale utilities (`text-body`, `text-control`, …) as text colours and drops
 * whichever of `text-body` / `text-primary-foreground` comes first; the same goes for
 * the named shadows, dialog widths and sizes declared in globals.css.
 */
export const cn = createCn({
  extend: {
    theme: {
      text: [
        "tag",
        "caption",
        "control",
        "body",
        "body-lg",
        "section",
        "dialog",
        "h1",
        "greeting",
        "kpi",
        "wordmark",
        "wordmark-sm",
        "micro",
      ],
      shadow: ["card", "popover"],
      container: [
        "login",
        "dialog-confirm",
        "dialog-sm",
        "dialog-form",
        "menu",
      ],
      spacing: ["sidebar", "pill", "tag", "touch", "banner"],
    },
  },
});
