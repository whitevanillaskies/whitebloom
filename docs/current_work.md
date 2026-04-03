# Current Work 

## Node timestamps

Add `created` and `updatedAt` (ISO 8601) fields to `BoardNode`. Set `created` once on node creation, update `updatedAt` on every content/position/size change. Gives agents a staleness signal — nodes untouched for a long time can be flagged for the user to review.
