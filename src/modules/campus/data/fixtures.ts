import type { ModuleId } from "./modules";

export interface CampusEvent {
  id: string;
  title: string;
  category: "Technology" | "Community" | "Creative";
  day: string;
  month: string;
  time: string;
  venue: string;
  host: string;
  description: string;
  artwork: "build" | "grow" | "create";
  agenda: string[];
}

export const events: CampusEvent[] = [
  { id: "build-together", title: "Build something that matters.", category: "Technology", day: "12", month: "OCT", time: "14:00–17:00 · Asia/Dhaka", venue: "Innovation Lab · Level 3", host: "Demo Computing Club", description: "An afternoon of small teams, big questions, and useful prototypes. Bring an idea for a campus problem—or just your curiosity. No finished project needed.", artwork: "build", agenda: ["14:00 · Meet your team & choose a problem", "14:30 · A hands-on prototyping session", "16:30 · Share what you made"] },
  { id: "green-campus", title: "A greener campus starts with us.", category: "Community", day: "14", month: "OCT", time: "09:00–11:00 · Asia/Dhaka", venue: "Campus courtyard", host: "Demo Green Circle", description: "Meet fellow students for a thoughtful morning of planting and campus care. Learn how to look after a small shared space, one practical step at a time.", artwork: "grow", agenda: ["09:00 · Welcome & safety briefing", "09:20 · Small-group planting activity", "10:30 · Care plan & community conversation"] },
  { id: "design-circle", title: "Make room for a new perspective.", category: "Creative", day: "18", month: "OCT", time: "15:00–16:30 · Asia/Dhaka", venue: "Creative Studio · Level 2", host: "Demo Design Circle", description: "A friendly sketching and critique session. Explore everyday objects through a new lens. Paper and pencils are enough; all experience levels are welcome.", artwork: "create", agenda: ["15:00 · Visual warm-up", "15:20 · Sketch, observe, experiment", "16:00 · Share & constructive feedback"] },
];

export interface CampusResource {
  id: string;
  title: string;
  course: string;
  category: "Study guide" | "Practice" | "Checklist";
  publisher: string;
  description: string;
  file: string;
  preview: string[];
}

export const resources: CampusResource[] = [
  { id: "sql-guide", title: "SQL joins, without the confusion", course: "CSE 221", category: "Study guide", publisher: "Demo academic team", description: "A short, original guide to INNER and LEFT JOIN, with a campus-library example. A useful companion to the sample Database Systems course.", file: "/samples/sql-study-guide.pdf", preview: ["Start with two tables: Books and Loans. A join lets you ask a question that needs information from both.", "INNER JOIN returns only matching rows. Use it to see books that have a recorded loan.", "LEFT JOIN keeps every row from the left table. Use it to include books that have never been borrowed.", "Check the joining key before running the query. A non-unique key can duplicate your result rows."] },
  { id: "algorithms-practice", title: "A little practice in problem solving", course: "CSE 231", category: "Practice", publisher: "Demo Computing Club", description: "Three approachable exercises on searching, counting, and explaining time complexity. Prompts include hints, without giving away the answer.", file: "/samples/algorithms-practice.pdf", preview: ["1. Find the first repeated value in a list. Can you do better than checking every pair?", "2. Search a sorted list for a target. Explain what happens to the search space at each step.", "3. Count word frequencies in a paragraph. How would you handle capitalization?", "Reflection: state your assumptions and compare time and space complexity."] },
  { id: "presentation-checklist", title: "Your next presentation, prepared", course: "Campus skills", category: "Checklist", publisher: "Demo learning support", description: "A practical checklist for a clear, accessible presentation—from your first outline to the final rehearsal.", file: "/samples/presentation-checklist.pdf", preview: ["Decide the one idea you want your audience to remember.", "Structure your talk: the problem, your approach, what you learned, and the next step.", "Use readable text and describe important visuals aloud.", "Rehearse once with a timer. Leave time for questions and have a local backup of your slides."] },
];

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  steps: string[];
}

export const articles: KnowledgeArticle[] = [
  { id: "getting-started", title: "New here? Start with these four things.", category: "Getting started", excerpt: "A sample orientation checklist, with a sensible order for your first week.", steps: ["Locate your department office and confirm where to find approved academic notices.", "Check your section and course details with the appropriate academic office.", "Find the library, student support desk, and the published transport information.", "Explore clubs and choose a community that matches your interests."] },
  { id: "account-activation", title: "How roster-based activation works", category: "Accounts", excerpt: "Why CampusOS does not use open student signup, and what happens next.", steps: ["An authorized enrollment team must first add your approved student record.", "You enter your student ID through a connected activation flow.", "The managed authentication service sends an activation link to the approved address.", "If your details are incorrect, request help from enrollment. You cannot choose a staff role."] },
  { id: "finding-resources", title: "Finding a resource you can trust", category: "Learning", excerpt: "Use course, category, and publisher information to choose the right material.", steps: ["Start with your course code or a topic in the Resource Hub.", "Check the publisher, format, and description before downloading.", "Keep track of the version when a real publisher updates a document.", "Sample downloads in this preview are original demo text, not university course material."] },
];

export interface SearchItem {
  id: string;
  title: string;
  description: string;
  module: ModuleId;
  kind: "event" | "resource" | "article" | "notice" | "module";
}

export const fixtureSearch: SearchItem[] = [
  ...events.map((event): SearchItem => ({ id: event.id, title: event.title, description: `${event.category} · ${event.host}`, module: "events", kind: "event" })),
  ...resources.map((resource): SearchItem => ({ id: resource.id, title: resource.title, description: `${resource.course} · ${resource.category}`, module: "resources", kind: "resource" })),
  ...articles.map((article): SearchItem => ({ id: article.id, title: article.title, description: article.category, module: "helpdesk", kind: "article" })),
  { id: "course-change", title: "Database Systems: time & room change", description: "CSE 221 · Section A · Sample academic notice", module: "academics", kind: "notice" },
];
