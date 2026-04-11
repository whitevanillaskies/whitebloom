# Ink System Overview

## Purpose

Whitebloom needs a single ink system that can work across different kinds of surfaces without forcing all surfaces into the same geometry model.

The goal is not to define ink as "freehand points on screen." The goal is to define ink as a Whitebloom-owned overlay artifact that can be attached to compatible surfaces and rendered consistently regardless of zoom level, viewport transform, or output resolution.

This document defines the high-level model before implementation.

---

## Core Principle

Ink should have **one shared contract** and **multiple coordinate spaces**.

The contract for a layer, stroke, tool, and point should remain structurally consistent across the app. What changes from surface to surface is the coordinate space used by the stroke data.

This avoids two bad outcomes:
- forcing every surface into one fake universal coordinate system
- letting every surface invent its own unrelated annotation format

The correct abstraction is:
- one ink model
- explicit surface binding
- explicit coordinate-space type

---

## Ink as a First-Class Artifact

Ink is not a side effect of PDFs, boards, or images. Ink is its own Whitebloom concept.

At a high level:
- an **ink layer** is a saved or transient annotation artifact
- an ink layer targets a specific surface type
- a compatible surface can expose zero, one, or many ink layers
- a view can decide which layers are visible and which layer is active for drawing

This keeps annotations non-destructive and reusable.

---

## Surface-Oriented Coordinate Spaces

Different surfaces need different coordinate systems.

### 1. Board canvas: world coordinates

The board canvas is an infinite surface. It should use board/world coordinates, not normalized UVs.

Characteristics:
- unbounded
- transform-driven
- tied to the board's spatial model
- appropriate for the glass annotation layer above React Flow

This is the right place for free spatial ink on the board.

### 2. Images: plain UVs

Images are bounded rectangular surfaces. They should use standard normalized UV coordinates.

Characteristics:
- `u`, `v`
- normalized to the image rectangle
- independent of render resolution
- stable under zoom and resampling

This is the simplest bounded-surface ink model.

### 3. PDFs: PagedUVs

PDFs are not infinite, and they are not a single rectangle. They are an ordered list of rectangular pages.

Ink on PDFs should use **PagedUVs**:
- `pageIndex`
- `u`
- `v`

Characteristics:
- page-aware
- resolution-independent
- robust across zoom changes
- appropriate for multipage documents with potentially different page sizes

This is preferable to flattening the entire document into a single fake 2D atlas.

### 4. Video: RangedUVs

Video is a bounded rectangular surface with a time dimension.

Ink on video should use **RangedUVs**:
- a time binding, likely `start` / `end`
- `u`
- `v`

Characteristics:
- spatially normalized like an image
- temporally bound like a clip or interval
- suitable for future frame-accurate or time-range-aware annotation

The exact temporal semantics can be refined later, but the direction is clear: video extends UV-based ink with time.

---

## Coordinate Space Summary

Whitebloom should support these coordinate-space families:

- **World Coordinates**
  - used by the infinite board canvas

- **UVs**
  - used by single bounded rectangular surfaces such as images

- **PagedUVs**
  - used by ordered multipage rectangular surfaces such as PDFs

- **RangedUVs**
  - used by time-based rectangular surfaces such as video

These are not separate annotation systems. They are separate bindings inside one annotation system.

---

## Ink Layer Contract

At a conceptual level, an ink layer should contain:
- layer identity and metadata
- a target surface binding
- one or more strokes
- optional layer state such as visibility, locking, and naming

A stroke should contain:
- tool or stroke type
- visual style data
- one or more sampled points

Each point is interpreted according to the target surface's coordinate-space type.

This means the ink system does **not** define one universal `x/y` point shape. Instead, the layer declares the coordinate space, and the stroke samples follow that contract.

---

## Why This Model

This model gives Whitebloom several important advantages:

- **Resolution independence**
  - Ink does not depend on the current render size.

- **Viewport independence**
  - Zooming and panning do not change stored stroke data.

- **Cross-surface consistency**
  - Boards, PDFs, images, and future surfaces all participate in the same ink system.

- **Non-destructive overlays**
  - Ink remains a Whitebloom-owned artifact rather than being fused into the source material.

- **Future extensibility**
  - Video, image markup, and export workflows all fit naturally.

---

## Layer Model

Ink layers should be first-class from the start.

Expected behavior:
- surfaces can have multiple compatible layers
- the user can choose which layer is active
- layers can be shown or hidden
- temporary quick layers can exist before being saved
- saved layers can be reused deliberately

This avoids the trap where annotations become permanently and implicitly fused into a material with no control over reuse.

---

## Surface Binding

An ink layer should always bind to a specific target surface type.

Examples:
- a board canvas layer binds to a board surface
- a PDF ink layer binds to a PDF resource
- an image ink layer binds to an image resource

This is important because the coordinate system is meaningful only in relation to the target surface.

The system should therefore treat surface type and coordinate-space type as explicit parts of the layer definition, not inferred accidents.

---

## Rendering Implications

The rendering path for ink should be surface-specific, but the underlying data model should remain shared.

Examples:
- board ink may render through a glass layer synchronized to the board viewport
- PDF ink may render in page space above the PDF page surfaces
- image ink may render directly over the image bounds

The renderer adapts the shared ink contract to the local surface transform.

---

## Export and Baking

Ink should remain Whitebloom-owned by default.

That means:
- the editable source of truth is the ink layer
- exporting or baking annotations into another format is a later action
- PDF baking is an output concern, not the primary internal model

This preserves flexibility for layer visibility, reuse, undo, and future editing.

---

## Naming Direction

Current preferred coordinate-space terms:
- `World Coordinates`
- `UVs`
- `PagedUVs`
- `RangedUVs`

These names are good enough for design and architectural work now. File extensions, serialization details, and user-facing labels can be decided later.

---

## Current Direction

The current design direction is:
- board ink uses world coordinates
- images use plain UVs
- PDFs use PagedUVs
- video will use RangedUVs

This should be treated as the foundation for the first implementation pass of Whitebloom ink.
