import type { LucideIcon } from "lucide-react";

/** The site's identity: the name in layout.tsx's metadata, the tagline on the Overview and in
    the footer, the repository and community links in the docs chrome. */
export const SITE_NAME = "Reconix";
export const SITE_TAGLINE = "AI-planned security assessments inside an approved scope.";
/**
 * The Reconix tool's source repository (GitHub link in the navbar and footer).
 * Placeholder: replace with the real repository URL.
 */
export const SITE_REPO_URL = "https://github.com/<org>/reconix";
/**
 * What the name stands for, shown under the footer wordmark. Set it (e.g.
 * "Reconnaissance with Intelligence Transformation") once it is the official meaning;
 * until then the footer shows SITE_TAGLINE.
 */
export const SITE_NAME_MEANING: string | undefined = undefined;
/** true once the tool repository is public under an open-source license (changes the footer's copyright line). */
export const SITE_OPEN_SOURCE = false;

export type CommunityLink = { label: string; href: string; icon?: LucideIcon };
/**
 * Contact / community links for the footer (Community column + icon row), empty until the team
 * has real ones. Examples:
 *   { label: "Email", href: "mailto:team@example.com", icon: Mail },
 *   { label: "Discord", href: "https://discord.gg/<invite>", icon: MessagesSquare },
 */
export const SITE_COMMUNITY: CommunityLink[] = [];
