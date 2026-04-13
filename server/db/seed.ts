import { db } from ".";
import { expenses } from "./schema";

await db.insert(expenses).values([
  {
    title: "Viajes",
    origin: "visa",
  },
  {
    title: "Comida",
    origin: "visa",
  },
  {
    title: "Ropa",
    origin: "master",
  },
]);

console.log(`Seeding complete.`);
