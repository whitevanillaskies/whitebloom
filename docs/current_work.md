# Current Work 

## Work Unit 1 - Board brief

Add a `brief` field to the `.wb.json` board schema — a plain text string where the user writes context for agents reading the board (purpose, domain, constraints, preferences). Optional field; omitting it leaves the board fully valid.

UI: a small toolbar anchored to the bottom-right of the canvas (visually light, doesn't compete with the board). It shows the current filename and a button/icon to open a compact panel with a textarea for the brief. A `?` icon or tooltip on that control explains: *"A message for AI agents — describe what this board is for, what context they should keep in mind, or how you'd like them to help."*

CoreData: `brief` sits at the top level of the board file, right after `version`, so agents encounter it first when reading the manifest.