# Gastos

Gastos is a shared expense tracker for households and small groups. It gives members one place to record purchases, organize spending, and understand how costs are distributed across people, categories, currencies, and monthly periods.

The application supports manual expense entry and PDF statement uploads, with Cloudflare Workflows and AI-assisted extraction turning statements into validated expense records. Users can edit imported rows, assign expenses to a person or the group, categorize transactions, track upload status, and retry failed processing jobs.

Its dashboard summarizes totals in ARS and USD with monthly, category, and member-level charts. The [GitHub repository](https://github.com/crivaronicolini/gastos) combines a React and TanStack frontend with a Hono API, Better Auth, Drizzle ORM, Cloudflare D1 and R2 storage, and a Cloudflare Worker deployment.
