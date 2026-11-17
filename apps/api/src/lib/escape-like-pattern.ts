/** Escapes the wildcards of a LIKE pattern, so the user's text is matched literally. */
export const escapeLikePattern = (text: string) => text.replace(/[\\%_]/g, '\\$&')
