# Design rules

Light Claymorphism; warm orange/cream palette. No emojis in any product UI. Use Lucide icons selectively, with accessible labels for icon-only controls. Text labels remain the default.

Raw colors live only in src/styles/themes/claysoft.css. src/styles/tokens.css maps semantic variables into Tailwind v4; there is no duplicate tailwind.config palette. Shared component recipes live in globals.css; page/feature code uses semantic utilities. Dynamic layout values may be local, but colors, shadows, font choices and radii must use tokens.

Primary buttons use the darker accent for readable white text; original orange/yellow values remain brand/decorative tokens. Manrope is the preferred font; this package uses its declared fallback stack until licensed local font files are provided, avoiding build-time external font fetches.

Book cover frames are 2:3, object-contain, with a title/author fallback for missing or failed URLs. Public preview deliberately exposes only allowlisted card information and no private details or unsupported book-detail link. Real book cards are not fabricated. Landing artwork is decorative typography.

Explore uses one column of horizontal cover-and-text cards on small screens, two columns from 40rem and three from 64rem. Portrait cards remain an available shared variant. Genre chips use a visible horizontal scrollbar and overflow controls. Shared controls target at least 44px height. Member navigation now links to Discover, My Books, Exchanges and Profile (Collection is linked from My Books). Administration uses a separate sidebar on desktop and wrapped navigation on mobile. Toast width is bounded by viewport. Dialog uses Radix focus trapping, Escape handling, labels and mobile width bounds. Reduced motion disables animation.

Browser QA targets: 320/360/390/768/1280px; no horizontal scroll; toast and dialog remain inside viewport; keyboard focus remains visible; background cannot be operated while dialog is open; no fixed navigation covers content.

Stage 5: ghost/secondary action buttons have token-based surface, border and shadow affordances. Navigation links remain navigation; action links use ButtonLink. PhotoRemoveButton is a shared 44px X control with a red hover/focus state and Delete tooltip. BookGallery groups a book's images with stacked backplates, labelled previous/next controls and thumbnail selection. ImagePicker previews local selections for both listing photos and enrollment proof. No new palette is introduced.
