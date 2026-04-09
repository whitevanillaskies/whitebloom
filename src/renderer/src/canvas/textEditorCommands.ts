import { createCommand, type LexicalCommand } from 'lexical'

/**
 * Dispatch this command inside a LexicalComposer to apply an inline CSS color
 * to the current text selection. Pass an empty string to clear the color.
 */
export const TEXT_COLOR_COMMAND: LexicalCommand<string> = createCommand('TEXT_COLOR_COMMAND')
