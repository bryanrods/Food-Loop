-- 1. Insertar Usuarios base (1 Admin, 1 Dueño de Local, 1 Usuario Normal)
-- El password original para todos es: 123456
INSERT INTO usuario (nombre_usuario, pswrd_usuario, email_usuario, fecha_creacion, rol_usuario, activo)
VALUES 
    ('Yusa Admin', '$2a$10$9vZVj0JWMe3crEb5PcLb2.qgpkKfraqVZq2t3St2f16mSmNuOG2me', 'admin@foodloop.com', CURDATE(), 'admin', 1),
    ('María Panadería', '$2a$10$ejLw1uj4txwWu7Kmz0rxgOb9oyz5KFQyZ3H7ZTcfo/IwwXrYdsc8q', 'local@gmail.com', CURDATE(), 'local', 1),
    ('Sebastián Loya', '$2a$10$ejLw1uj4txwWu7Kmz0rxgOb9oyz5KFQyZ3H7ZTcfo/IwwXrYdsc8q', 'usuario@gmail.com', CURDATE(), 'usuario', 1);

-- 2. Insertar en Comercio (SOLO asignado al usuario con rol 'local', ID 2)
INSERT INTO comercio (nombre_comercio, direccion_comercio, telefono_comercio, usuario_id, foto_local, hora_apertura, hora_cierre, estado_operativo)
VALUES 
    ('Panadería El Trigo', 'Av. de las Torres 123', '6561234567', 2, NULL, '08:00:00', '20:00:00', 'abierto');

-- 3. Insertar en Datos de Usuario (SOLO asignado al usuario con rol 'usuario', ID 3)
INSERT INTO datos_usuario (usuario_id, edad, telefono, foto_usuario)
VALUES 
    (3, 25, '6569876543', NULL);

-- 4. Insertar Información de Suscripción al usuario
INSERT INTO suscripcion_info (usuario_id, tipo_plan, estado_suscripcion, fecha_corte, folio_suscripcion)
VALUES 
    (3, 'basico', 'inactiva', NULL, 'FL-USR123');
