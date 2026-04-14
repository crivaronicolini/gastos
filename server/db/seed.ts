import { db } from ".";
import { categories, expenses, users } from "./schema";

await db.insert(users).values([{ name: "Ingrid" }, { name: "Marco" }, { name: "Casa" }]);

await db
  .insert(categories)
  .values([
    { name: "Comida" },
    { name: "Regalos" },
    { name: "Salidas" },
    { name: "Rappi/comida en casa" },
    { name: "Vivienda" },
    { name: "Salud" },
    { name: "Ropa" },
    { name: "Mascotas" },
    { name: "Servicios" },
    { name: "Transporte" },
    { name: "Deuda" },
    { name: "Otros" },
    { name: "Viajes" },
    { name: "Hobbys" },
  ]);

// await db.insert(expenses).values([
//   {
//     title: "Viajes",
//     origin: "visa",
//     amount: 12,
//     installments: "1",
//     category: 1,
//   },
//   {
//     title: "Comida",
//     origin: "visa",
//     amount: 12,
//     installments: "1",
//     category: 1,
//   },
//   {
//     title: "Ropa",
//     origin: "master",
//     amount: 12,
//     installments: "1",
//     category: 1,
//   },
// ]);

console.log(`Seeding complete.`);
