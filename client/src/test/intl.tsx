/* Test helpers: render under next-intl with the real `messages/en/*.json`, so
   tests assert the same strings users see and never import JSON by deep path. */
import React from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { loadMessages } from "@/i18n/messages";

export const messages = loadMessages("en");

/** One namespace (`messages/en/<name>.json`); throws on a typo instead of rendering raw keys. */
export function namespace(name: string): AbstractIntlMessages {
  const ns = messages[name];
  if (!ns) throw new Error(`No messages/en/${name}.json`);
  return ns;
}

export function IntlProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

export function renderWithIntl(ui: React.ReactElement, options?: Omit<RenderOptions, "wrapper">): RenderResult {
  return render(ui, { wrapper: IntlProvider, ...options });
}
