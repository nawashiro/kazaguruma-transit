const DISCUSSION_DESCRIPTION_DISPLAY_LENGTH = 70;

/**
 * Shortens a discussion description for list-style displays.
 */
export function truncateDiscussionDescription(description: string): string {
  if (description.length <= DISCUSSION_DESCRIPTION_DISPLAY_LENGTH) {
    return description;
  }

  return `${description.slice(0, DISCUSSION_DESCRIPTION_DISPLAY_LENGTH)}...`;
}
