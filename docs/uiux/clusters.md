# Clusters UI/UX Contract

- Clusters are user-sized organizational regions, not auto-layout containers.
- A cluster owns a rectangle and a membership list.
- On creation from a selection, the cluster fits its initial children plus padding.
- After creation, a cluster does not auto-resize when its children move.
- Users may resize a cluster manually.
- Users may invoke `Fit Cluster to Children` to reset a cluster to the bounding box of its current children plus padding.

- Membership is spatial.
- A node joins a cluster only when the node is fully inside the cluster bounds.
- A node leaves a cluster only when the node is fully outside the cluster bounds.
- Partial overlap changes nothing.
- A node must never belong to more than one cluster at once.

- When a node is fully inside multiple clusters, the smallest containing cluster wins.
- When a node is fully inside no clusters, it belongs to no cluster.
- Dragging a node across clusters updates membership only when the drag is committed, not continuously mid-drag.
- Dragging a node out of a cluster removes it only when the node is fully outside on commit.
- Dragging a node back in adds it only when the node is fully inside on commit.

- Dragging a cluster moves the cluster and all of its current children together.
- Dragging a cluster does not re-evaluate child membership against other clusters.
- Selecting a cluster does not implicitly select its children.

- Clusters should be resizable from direct pointer interaction.
- Cluster resize should feel like a normal canvas operation, not a modal workflow.
- Resize affordances should stay compact and precise.
- Resize should not silently change membership for partially overlapping nodes.
- Resizing a cluster may add fully enclosed nodes and remove fully excluded nodes when the resize is committed.
