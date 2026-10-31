# Chat and Messages

Student-only /messages provides a paginated exchange inbox and /messages/[exchangeId] provides a thread. Only participant exchanges with accepted_at enter the inbox; closed accepted exchanges remain in History, read only according to the server's can_send flag. Pending/rejected/never-accepted proposals do not open chat.

Existing sent/received APIs are paginated in bounded batches of 50 per direction. Full candidate pages retain Load older conversations even when no eligible chat appears. The inbox is ordered by accepted time; it does not invent last-message previews, activity ordering, or unread counts that these list endpoints do not supply.

ChatPanel retains cursor history, read positions, deduplication and the same idempotency key across uncertain retries. New messages follow the bottom only while the reader is near the bottom; loading older history preserves the scroll position. ExchangeActionBar uses existing handover/cancellation policies and open-issue gates, shared with exchange detail. HTTP polling is used; no WebSocket transport or backend migration is added.
