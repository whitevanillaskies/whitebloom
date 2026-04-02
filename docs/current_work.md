# Current Work

Quality of life features for text editing, bug fixes, etc.

## Work Unit 1 - Add Text Jump To Editing

When creating a new text node, jump straight into editing. Remove the default text. 

## Work Unit 2 - Delete empty nodes

As an extension of WU1 and general housecleaning, whenever a text node is committed, check if it's empty. If it's empty, delete the node.

## Work Unit 3 - Deleting nodes

Support deletion of selected nodes, and their relationships eventually (we don't have relationships/edges yet)

## Work Unit 4 - Pointer tool in CanvasToolbar

onToolChange('pointer') -> the behavior should be that dragging the left mouse button on the canvas creates a selection rectangle. Right now it's panning as if the hand tool was active. onToolChange('hand') is fine (pans even when dragging on top of nodes, which is what we want)

This selection set should also work with WU3 (deleting the whole set)

When the pointer tool is selected, I believe both MMB and RMB should pan the canvas, however RMB should detect click vs drag, so that in the future we can add a context menu. 

