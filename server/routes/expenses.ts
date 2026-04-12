import { zValidator } from "@hono/zod-validator";
import { createExpenseSchema, updateExpenseSchema, type Expense } from "@shared/models";
import { Hono } from "hono";

const fakeExpenses: Expense[] = [
  { id: 1, title: "Ropa", amount: 40 },
  { id: 2, title: "Comida", amount: 20 },
  { id: 3, title: "Juegos", amount: 50 },
];

export const expenseRoute = new Hono()
  .get("/", (c) => {
    return c.json({ expenses: fakeExpenses });
  })
  .get("/total-spent", (c) => {
    const total = fakeExpenses.reduce((acc, expense) => acc + expense.amount, 0);
    return c.json({ total });
  })
  .post("/", zValidator("json", createExpenseSchema), (c) => {
    const expense = c.req.valid("json");
    fakeExpenses.push({ ...expense, id: fakeExpenses.length + 1 });
    c.status(201);
    return c.json(expense);
  })
  .get("/:id{[0-9]+}", (c) => {
    const id = Number.parseInt(c.req.param("id"));
    const expense = fakeExpenses.find((expense) => expense.id === id);
    if (!expense) {
      return c.notFound();
    }
    return c.json({ expense });
  })
  .patch("/:id{[0-9]+}", zValidator("json", updateExpenseSchema), (c) => {
    const id = Number.parseInt(c.req.param("id"));
    const patch = c.req.valid("json");
    const index = fakeExpenses.findIndex((expense) => expense.id === id);
    if (index === -1) {
      return c.notFound();
    }
    const expense = fakeExpenses[index];
    if (!expense) {
      return c.notFound();
    }
    const updated = { ...expense, ...patch };
    fakeExpenses[index] = updated;
    return c.json({ expense: updated });
  })
  .delete("/:id{[0-9]+}", (c) => {
    const id = Number.parseInt(c.req.param("id"));
    const index = fakeExpenses.findIndex((expense) => expense.id === id);
    if (index === -1) {
      return c.notFound();
    }
    const deletedExpense = fakeExpenses.splice(index, 1)[0];
    return c.json({ expense: deletedExpense });
  });
