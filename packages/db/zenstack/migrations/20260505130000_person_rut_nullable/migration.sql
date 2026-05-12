-- Allow people without RUT (foreign nationals, missing data, no-RUT imports)
ALTER TABLE people ALTER COLUMN rut DROP NOT NULL;
