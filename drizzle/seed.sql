INSERT OR IGNORE INTO users (name) VALUES
  ('Ingrid'),
  ('Marco'),
  ('Casa');

INSERT OR IGNORE INTO categories (name) VALUES
  ('Comida'),
  ('Regalos'),
  ('Salidas'),
  ('Rappi/comida en casa'),
  ('Vivienda'),
  ('Salud'),
  ('Ropa'),
  ('Mascotas'),
  ('Servicios'),
  ('Transporte'),
  ('Deuda'),
  ('Otros'),
  ('Viajes'),
  ('Hobbys');

INSERT INTO expenses (title, origin, amount, installments, category)
SELECT 'Viajes', 'visa', 12, '1', 1
WHERE NOT EXISTS (
  SELECT 1 FROM expenses
  WHERE title = 'Viajes' AND origin = 'visa' AND amount = 12 AND installments = '1' AND category = 1
);

INSERT INTO expenses (title, origin, amount, installments, category)
SELECT 'Comida', 'visa', 12, '1', 1
WHERE NOT EXISTS (
  SELECT 1 FROM expenses
  WHERE title = 'Comida' AND origin = 'visa' AND amount = 12 AND installments = '1' AND category = 1
);

INSERT INTO expenses (title, origin, amount, installments, category)
SELECT 'Ropa', 'master', 12, '1', 1
WHERE NOT EXISTS (
  SELECT 1 FROM expenses
  WHERE title = 'Ropa' AND origin = 'master' AND amount = 12 AND installments = '1' AND category = 1
);
