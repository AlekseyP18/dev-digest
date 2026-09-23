/* confirm.tsx — in-app confirmation dialog replacing window.confirm: themed,
   translatable, keyboard-friendly (Enter confirms, Esc cancels). */
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";

export interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  /** Defaults to common.actions.delete for `danger`, else common.actions.confirm. */
  confirmLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = React.createContext<Confirm | null>(null);

const s = {
  footer: { display: "flex", justifyContent: "flex-end", gap: 10 } satisfies React.CSSProperties,
  body: { padding: "16px 24px", fontSize: 14, color: "var(--text-secondary)" } satisfies React.CSSProperties,
};

/**
 * `const confirm = useConfirm(); if (await confirm({ title })) …`.
 * Outside <ConfirmProvider> (isolated component tests) it falls back to
 * window.confirm so components stay renderable without the provider.
 */
export function useConfirm(): Confirm {
  const ctx = React.useContext(ConfirmCtx);
  return ctx ?? ((o) => Promise.resolve(window.confirm(o.title)));
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
  /** Route the dialog was opened on; it answers "no" once the route changes. */
  pathname: string;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common.actions");
  const pathname = usePathname();
  const [pending, setPending] = React.useState<Pending | null>(null);
  const current = React.useRef<Pending | null>(null);

  const settle = React.useCallback((ok: boolean) => {
    current.current?.resolve(ok);
    current.current = null;
    setPending(null);
  }, []);

  const confirm = React.useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        current.current?.resolve(false); // one dialog at a time: the older question is answered "no"
        const next = { ...options, resolve, pathname };
        current.current = next;
        setPending(next);
      }),
    [pathname],
  );

  // Leaving the page (back button, link) answers "no" instead of letting a
  // stale dialog confirm an action on a page the user has left.
  const open = pending != null && pending.pathname === pathname;
  React.useEffect(() => {
    if (pending && pending.pathname !== pathname) pending.resolve(false);
  }, [pending, pathname]);

  // Like window.confirm, the dialog owns the keyboard: page shortcuts (j/k/a/d,
  // g-navigation) must not fire behind it. Enter/Space still activate the
  // focused button (default action), Escape cancels.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") settle(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, settle]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {open && pending && (
        <Modal
          width={440}
          title={pending.title}
          onClose={() => settle(false)}
          footer={
            <div style={s.footer}>
              <Button kind="ghost" size="sm" onClick={() => settle(false)}>
                {t("cancel")}
              </Button>
              <Button kind={pending.danger ? "danger" : "primary"} size="sm" onClick={() => settle(true)} autoFocus>
                {pending.confirmLabel ?? (pending.danger ? t("delete") : t("confirm"))}
              </Button>
            </div>
          }
        >
          {pending.body && <div style={s.body}>{pending.body}</div>}
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
