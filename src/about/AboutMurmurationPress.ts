export const MURMURATION_PRESS_URLS = {
  website: "https://murmurationpress.co.uk/",
  purchasePrimeTrilogy: "https://murmurationpress.co.uk/purchase-prime-trilogy/",
  github: "https://github.com/MurmurationPress/murmuration-writing-companion",
  documentation: "https://github.com/MurmurationPress/murmuration-writing-companion#readme",
  licence: "https://github.com/MurmurationPress/murmuration-writing-companion/blob/main/LICENSE"
} as const;

export interface AboutExternalLink {
  readonly label: string;
  readonly accessibleLabel: string;
  readonly url: string;
  readonly prominent?: boolean;
}

export const ABOUT_EXTERNAL_LINKS: readonly AboutExternalLink[] = [
  {
    label: "Murmuration Press website",
    accessibleLabel: "Open the Murmuration Press website",
    url: MURMURATION_PRESS_URLS.website
  },
  {
    label: "Purchase the PRIME Trilogy",
    accessibleLabel: "Open the PRIME Trilogy purchase page",
    url: MURMURATION_PRESS_URLS.purchasePrimeTrilogy,
    prominent: true
  },
  {
    label: "Writing Companion on GitHub",
    accessibleLabel: "Open the Murmuration Writing Companion GitHub repository",
    url: MURMURATION_PRESS_URLS.github
  },
  {
    label: "Documentation",
    accessibleLabel: "Open Murmuration Writing Companion documentation",
    url: MURMURATION_PRESS_URLS.documentation
  },
  {
    label: "MIT licence",
    accessibleLabel: "Open the Murmuration Writing Companion MIT licence",
    url: MURMURATION_PRESS_URLS.licence
  }
];

export const ABOUT_DESCRIPTION = "Murmuration Writing Companion provides manuscript structure, editorial review, continuity, temporal awareness and Story World tools for writers working in Obsidian.";
export const ABOUT_RELATIONSHIP = "It is developed alongside Murmuration Press, the companion compilation and publishing plugin.";
export const ABOUT_SUPPORT = "Murmuration Writing Companion is developed alongside the PRIME Trilogy. Purchasing the books supports continued development of the tools created to write and publish them.";

export interface AboutPresentation {
  readonly name: "Murmuration Writing Companion";
  readonly version: string;
  readonly description: string;
  readonly relationship: string;
  readonly support: string;
  readonly links: readonly AboutExternalLink[];
}

export function aboutPresentation(pluginVersion: string): AboutPresentation {
  return {
    name: "Murmuration Writing Companion",
    version: pluginVersion,
    description: ABOUT_DESCRIPTION,
    relationship: ABOUT_RELATIONSHIP,
    support: ABOUT_SUPPORT,
    links: ABOUT_EXTERNAL_LINKS
  };
}

export type SafeExternalOpener = (
  url: string,
  target: "_blank",
  features: "noopener,noreferrer"
) => unknown;

export function openAboutExternalLink(url: string, opener: SafeExternalOpener): void {
  if (!ABOUT_EXTERNAL_LINKS.some((link) => link.url === url)) {
    throw new Error("The About link is not an approved Murmuration Writing Companion URL.");
  }
  opener(url, "_blank", "noopener,noreferrer");
}

export interface AboutCommandHost {
  addCommand(command: {
    readonly id: string;
    readonly name: string;
    readonly callback: () => void;
  }): unknown;
}

export function installAboutCommand(host: AboutCommandHost, openAbout: () => void): void {
  host.addCommand({
    id: "about-murmuration-writing-companion",
    name: "About Murmuration Writing Companion",
    callback: openAbout
  });
}

export const ABOUT_SETTINGS_ENTRY = {
  name: "About Murmuration Writing Companion",
  description: "Version, project relationship, documentation, licence and official links.",
  buttonLabel: "Open About",
  accessibleLabel: "Open About Murmuration Writing Companion"
} as const;
