# Current Work

General Quality of Life work and small UI/UX improvements.

## Work Unit 1 - Pointers, tools, and selection

Bug: Hand tool allows for selecting nodes.

Bug: Hand tool, when a node is selected, allows for resizing it. The hand tool should not change the state of the board, only pan.

Bug: if a tool changes the cursor (like crosshairs for text, or hand, etc.) the cursor isn't shown as the system pointer when overing over the toolbars. On a toolbar, we should show the system cursor.

Issue: The pointer tool shows a hand with an index finger pointer. Ideally it should show the system cursor if possible, or otherwise a custom pointer, not that one.