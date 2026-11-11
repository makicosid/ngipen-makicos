# Integration Notes

## Suggested logical frame IDs

| ID | Access |
|---|---|
| `free_red` | all_users |
| `free_yellow` | all_users |
| `free_blue` | all_users |
| `kitsune_member` | makicos_member |

## Rendering contract

Render the user's avatar image as the base layer and the selected frame PNG as an absolutely positioned overlay with `pointer-events: none`. Keep the frame image transparent. Do not bake the frame into the uploaded avatar.

## Authorization contract

- Client UI may show locked frames, but server-side checks decide whether a frame can be selected.
- A client must not be able to grant itself `makicos_member` access by sending a frame ID.
- Admin grants/revokes must be authenticated and audited.
- Public/event-facing profile data should expose only the selected frame ID or an approved frame asset URL, respecting existing guest/profile visibility rules.

## Responsive checks

Test avatar display in event participant lists, event detail headers, profile pages, and compact mobile layouts. Verify the tail/ears are not clipped for the Kitsune frame and that Free Frame center openings align with the avatar crop.
