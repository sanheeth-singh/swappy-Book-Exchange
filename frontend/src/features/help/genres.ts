import type { components } from "@/lib/api/generated/schema";
import type { HelpEntry } from "./content";
export const genreGuide = {
  "FICTION": {
    "label": "General fiction",
    "description": "Novels and other fictional stories."
  },
  "FANTASY": {
    "label": "Fantasy",
    "description": "Imagined worlds and fantastical stories."
  },
  "SCIENCE_FICTION": {
    "label": "Science fiction",
    "description": "Speculative science, technology and futures."
  },
  "MYSTERY_THRILLER": {
    "label": "Mystery / thriller",
    "description": "Mysteries, suspense and thrillers."
  },
  "ROMANCE": {
    "label": "Romance",
    "description": "Stories centered on romantic relationships."
  },
  "HISTORICAL_FICTION": {
    "label": "Historical fiction",
    "description": "Fiction set in a historical period."
  },
  "HORROR": {
    "label": "Horror",
    "description": "Stories intended to unsettle or frighten."
  },
  "POETRY": {
    "label": "Poetry",
    "description": "Poems and poetry collections."
  },
  "COMICS_GRAPHIC_NOVELS": {
    "label": "Comics / graphic novels",
    "description": "Stories told through sequential artwork."
  },
  "BIOGRAPHY_MEMOIR": {
    "label": "Biography / memoir",
    "description": "Accounts of real lives and experiences."
  },
  "HISTORY": {
    "label": "History",
    "description": "Nonfiction about the past."
  },
  "SCIENCE_TECHNOLOGY": {
    "label": "Science / technology",
    "description": "Nonfiction about science and technology."
  },
  "SELF_HELP": {
    "label": "Self-help",
    "description": "Personal development and practical guidance."
  },
  "BUSINESS_FINANCE": {
    "label": "Business / finance",
    "description": "Business, economics and personal finance."
  },
  "PHILOSOPHY": {
    "label": "Philosophy",
    "description": "Ideas about knowledge, values and existence."
  },
  "RELIGION_SPIRITUALITY": {
    "label": "Religion / spirituality",
    "description": "Religious traditions and spiritual exploration."
  },
  "TRAVEL": {
    "label": "Travel",
    "description": "Travel writing and destination guides."
  },
  "ACADEMIC": {
    "label": "Academic / textbooks",
    "description": "Coursework, study and reference texts."
  },
  "CHILDREN_YOUNG_ADULT": {
    "label": "Children / young adult",
    "description": "Books written for younger readers."
  },
  "OTHER": {
    "label": "Other",
    "description": "Books that do not fit another genre."
  }
} satisfies Record<components["schemas"]["Genre"], HelpEntry>;
