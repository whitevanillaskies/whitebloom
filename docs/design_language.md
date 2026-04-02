# Design Language

Primary color is white, but technically almost-full-white. Avoid large swaths of colors, use color as accent. Do not use muddied colors. Rely on vibrant colors that cut through the white. Use tasteful drop shadows and typography, do not use neither full black nor full white. Almost white, and deep charcoal instead.

Prefer premium macOS style. For example, if we have a toolbar, do not frame each button inside a box. Let the icon appear engraved on the toolbar. Use Lucide icons for now, we may switch to custom SVGs later. Icons should be added as React components, so that code doesn't have to change other than the import if we want to replace them.

Optimize this app for high precision pointer interactions. This is a desktop computer app. We do not care for responsive layouts nor touch gestures. Accessibility is not a concern for this app. Prefer compact, high density clusters with whitespace as boundaries.

## Colors

Main Background: almost full white
Main Foreground: dark charcoal
Light Foreground: charcoal, light charcoal

Accents: vibrant colors (pink, magenta, fuchsia, red, blue, green). The only colors I would avoid are those that lack perceived contrast against white, such as some yellows.

Use color to convey information. To group and identify items, to convey intent. Do not use color for its own sake.

## Line Thickness

Prefer thin lines. Avoid the Fisher Price aesthetic of big soft shapes. Somewhat round corners can be fine, but not too much. Allow dashed and dotted lines for connections.

## Typography

Choose one serif, one sans, and one monospaced font for code.

- Sans: DM Sans (I also like Manrope)
- Serif: Source Serif 4
- Code: Source Code Pro