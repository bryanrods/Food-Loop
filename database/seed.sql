-- Insertar Usuarios de prueba (1 Admin, 1 Dueño de Local, 1 Usuario Normal)
INSERT INTO usuario (nombre_usuario, pswrd_usuario, email_usuario, fecha_creacion, rol_usuario) VALUES 
('Bryan Admin', '123456', 'admin@foodloop.com', CURDATE(), 'admin'),
('María Panadería', '123456', 'maria@eltrigo.com', CURDATE(), 'local'),
('Sebastián Cliente', '123456', 'sebas@gmail.com', CURDATE(), 'usuario');

-- Insertar Comercios (Asignado al usuario con rol 'local', que es el ID 2)
INSERT INTO comercio (nombre_comercio, direccion_comercio, telefono_comercio, usuario_id) VALUES 
('Panadería El Trigo', 'Av. de las Torres 123', '6561234567', 2);

-- Insertar Suscripciones (Sebastián Cliente compra la Premium)
INSERT INTO suscripcion_info (usuario_id, tipo_plan, estado_suscripcion, fecha_corte) VALUES 
(3, 'premium', 'activa', DATE_ADD(CURDATE(), INTERVAL 1 MONTH));

-- Registrar el pago de esa suscripción
INSERT INTO suscripcion_pago (suscripcion_id, monto_pago, dia_cobro, estado_pago, referencia_pago) VALUES 
(1, 75.00, CURDATE(), 'pagado', 'REF-FL-987654');

-- Insertar Packs (Panadería publica 2 paquetes de excedentes)
INSERT INTO pack (comercio_id, nombre_pack, descripcion, precio_original, precio_descuento, stock_disponible, hora_activacion, estado) VALUES 
(1, 'Bolsa Sorpresa de Pan Dulce', 'Incluye 5 piezas surtidas del día.', 100.00, 35.00, 10, '19:00:00', 'disponible'),
(1, 'Pastel de Chocolate (Rebanadas)', '3 rebanadas que sobraron en vitrina.', 120.00, 50.00, 2, '20:00:00', 'disponible');

-- Insertar Reservación (Sebastián aparta 1 bolsa de pan dulce)
INSERT INTO reservacion (usuario_id, pack_id, cantidad, estado_reserva) VALUES 
(3, 1, 1, 'pendiente');